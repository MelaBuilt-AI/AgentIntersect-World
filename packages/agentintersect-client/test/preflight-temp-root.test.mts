import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { watch } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  captureEmergencyStopContract,
  captureHttpSseContract,
  captureLifecycleContract,
  captureMcpContract,
} from "../src/index.ts";

const execFileAsync = promisify(execFile);
const fixedTemporaryRoot = "/tmp";

function replaceTemporaryEnvironment(value: string): () => void {
  const names = ["TMPDIR", "TMP", "TEMP"] as const;
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  ) as Record<(typeof names)[number], string | undefined>;
  for (const name of names) process.env[name] = value;
  return () => {
    for (const name of names) {
      const original = previous[name];
      if (original === undefined) delete process.env[name];
      else process.env[name] = original;
    }
  };
}

function observeWorkspaceEntries(directory: string): {
  entries: Set<string>;
  close(): void;
} {
  const entries = new Set<string>();
  const watcher = watch(directory, (_event, filename) => {
    if (filename) entries.add(filename.toString());
  });
  return { entries, close: () => watcher.close() };
}

async function git(checkout: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", checkout, ...args], {
    encoding: "utf8",
  });
  return stdout.trim();
}

test("every public capture rejects a drifted checkout before code or workspace side effects", async () => {
  const sourceCheckout = process.env.AGENTINTERSECT_CHECKOUT;
  assert.ok(sourceCheckout, "AGENTINTERSECT_CHECKOUT is required");
  const testRoot = await fs.mkdtemp(
    path.join(fixedTemporaryRoot, "aiw-preflight-regression-"),
  );
  const driftedCheckout = path.join(testRoot, "drifted-checkout");
  const trappedTemporaryRoot = path.join(testRoot, "trapped-temp");
  const sentinel = path.join(testRoot, "sentinel.log");
  const restoreTemporaryEnvironment =
    replaceTemporaryEnvironment(trappedTemporaryRoot);
  const previousSentinel = process.env.AGENTINTERSECT_PHASE0_SENTINEL;
  process.env.AGENTINTERSECT_PHASE0_SENTINEL = sentinel;

  try {
    await fs.mkdir(trappedTemporaryRoot);
    await execFileAsync("git", [
      "clone",
      "--local",
      "--no-hardlinks",
      sourceCheckout,
      driftedCheckout,
    ]);

    const cliPath = path.join(driftedCheckout, "bin", "clm.mjs");
    const cli = await fs.readFile(cliPath, "utf8");
    const [shebang = "#!/usr/bin/env node", ...cliBody] = cli.split("\n");
    await fs.writeFile(
      cliPath,
      `${shebang}\nimport { appendFile as appendPhase0Sentinel } from "node:fs/promises";\nif (process.env.AGENTINTERSECT_PHASE0_SENTINEL) await appendPhase0Sentinel(process.env.AGENTINTERSECT_PHASE0_SENTINEL, \`cli:\${process.cwd()}\\n\`);\n${cliBody.join("\n")}`,
      "utf8",
    );

    const ownedModulePath = path.join(
      driftedCheckout,
      "src",
      "owned-processes.mjs",
    );
    const ownedModule = await fs.readFile(ownedModulePath, "utf8");
    await fs.writeFile(
      ownedModulePath,
      `import { appendFile as appendPhase0ModuleSentinel } from "node:fs/promises";\nif (process.env.AGENTINTERSECT_PHASE0_SENTINEL) await appendPhase0ModuleSentinel(process.env.AGENTINTERSECT_PHASE0_SENTINEL, \`module:\${process.cwd()}\\n\`);\n${ownedModule}`,
      "utf8",
    );

    const workspaceObservation = observeWorkspaceEntries(trappedTemporaryRoot);
    const captures = [
      ["HTTP/SSE", captureHttpSseContract],
      ["MCP", captureMcpContract],
      ["lifecycle", captureLifecycleContract],
      ["emergency stop", captureEmergencyStopContract],
    ] as const;
    const outcomes: Array<{ label: string; error: unknown }> = [];
    try {
      for (const [label, capture] of captures) {
        const implementation = capture.toString();
        const preflightIndex = implementation.indexOf("preflightCheckout");
        const workspaceIndex = implementation.indexOf(
          "createSafeTemporaryWorkspace",
        );
        assert.ok(
          preflightIndex >= 0 && workspaceIndex > preflightIndex,
          `${label} does not place checkout preflight before workspace creation`,
        );
        let error: unknown = null;
        try {
          await capture(driftedCheckout);
        } catch (caught) {
          error = caught;
        }
        outcomes.push({ label, error });
      }
    } finally {
      workspaceObservation.close();
    }

    const sentinelExecuted = await fs
      .readFile(sentinel, "utf8")
      .then((content) => content.trim().split("\n"))
      .catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
      });
    assert.deepEqual(
      {
        rejectedByPreflight: Object.fromEntries(
          outcomes.map(({ label, error }) => [
            label,
            error instanceof Error &&
              /checkout preflight failed/.test(error.message),
          ]),
        ),
        sentinelExecuted,
        workspaceEntries: [...workspaceObservation.entries].filter((entry) =>
          entry.startsWith("aiw-"),
        ),
      },
      {
        rejectedByPreflight: {
          "HTTP/SSE": true,
          MCP: true,
          lifecycle: true,
          "emergency stop": true,
        },
        sentinelExecuted: [],
        workspaceEntries: [],
      },
    );
  } finally {
    restoreTemporaryEnvironment();
    if (previousSentinel === undefined)
      delete process.env.AGENTINTERSECT_PHASE0_SENTINEL;
    else process.env.AGENTINTERSECT_PHASE0_SENTINEL = previousSentinel;
    await fs.rm(testRoot, { recursive: true, force: true });
  }
});

test("capture ignores attacker-controlled temp variables and confines work to canonical /tmp", async () => {
  const sourceCheckout = process.env.AGENTINTERSECT_CHECKOUT;
  assert.ok(sourceCheckout, "AGENTINTERSECT_CHECKOUT is required");
  const testRoot = await fs.mkdtemp(
    path.join(fixedTemporaryRoot, "aiw-temp-root-regression-"),
  );
  let restoreTemporaryEnvironment: (() => void) | undefined;
  let protectedObservation:
    | ReturnType<typeof observeWorkspaceEntries>
    | undefined;
  let fixedRootObservation:
    | ReturnType<typeof observeWorkspaceEntries>
    | undefined;

  try {
    const protectedCheckout = path.join(testRoot, "protected-checkout");
    await execFileAsync("git", [
      "clone",
      "--local",
      "--no-hardlinks",
      sourceCheckout,
      protectedCheckout,
    ]);
    const baseline = {
      head: await git(protectedCheckout, "rev-parse", "HEAD"),
      status: await git(protectedCheckout, "status", "--porcelain=v1"),
      diff: await git(protectedCheckout, "diff", "--no-ext-diff"),
      entries: (await fs.readdir(protectedCheckout)).sort(),
    };
    restoreTemporaryEnvironment =
      replaceTemporaryEnvironment(protectedCheckout);
    protectedObservation = observeWorkspaceEntries(protectedCheckout);
    fixedRootObservation = observeWorkspaceEntries(fixedTemporaryRoot);

    const capture = await captureMcpContract(sourceCheckout);
    assert.equal(capture.workspaceDisposed, true);
    protectedObservation.close();
    fixedRootObservation.close();
    restoreTemporaryEnvironment();
    restoreTemporaryEnvironment = undefined;

    assert.deepEqual(
      [...protectedObservation.entries].filter((entry) =>
        entry.startsWith("aiw-mcp-"),
      ),
      [],
      "capture created a workspace entry under the protected checkout",
    );
    assert.ok(
      [...fixedRootObservation.entries].some((entry) =>
        entry.startsWith("aiw-mcp-"),
      ),
      "capture workspace was not observed under canonical /tmp",
    );
    assert.deepEqual(
      (await fs.readdir(protectedCheckout)).sort(),
      baseline.entries,
    );
    assert.equal(
      await git(protectedCheckout, "rev-parse", "HEAD"),
      baseline.head,
    );
    assert.equal(
      await git(protectedCheckout, "status", "--porcelain=v1"),
      baseline.status,
    );
    assert.equal(
      await git(protectedCheckout, "diff", "--no-ext-diff"),
      baseline.diff,
    );
  } finally {
    protectedObservation?.close();
    fixedRootObservation?.close();
    restoreTemporaryEnvironment?.();
    await fs.rm(testRoot, { recursive: true, force: true });
  }
});
