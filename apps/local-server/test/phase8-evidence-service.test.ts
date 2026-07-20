import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { indexRepository } from "@agentintersect-world/repo-indexer";
import { projectRepositoryGeneration } from "@agentintersect-world/spatial-code-graph";
import { afterEach, describe, expect, it } from "vitest";

import { EvidenceService } from "../src/evidence-service.js";
import { createLocalServer } from "../src/server.js";

const temporaryRoots: string[] = [];
const servers: Array<ReturnType<typeof createLocalServer>> = [];
const intentId = "670774c6-d71f-48b7-8936-8bd54a6cc520";
const serverConfig = {
  networkScope: "loopback" as const,
  host: "127.0.0.1",
  port: 3770,
  instanceName: "Phase 8 Evidence Test",
  demoOperationMaxMs: 500,
  repositoryMaxFiles: 100,
  presentationSync: {
    dataDir: "/tmp/aiw-evidence-presentation",
    allowedOrigin: "http://127.0.0.1:5173",
    allowedHost: "127.0.0.1:5173",
  },
};

function write(root: string, relative: string, value: string | Buffer): void {
  const filename = path.join(root, relative);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, value);
}

function git(root: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      LANG: "C",
      LC_ALL: "C",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_TERMINAL_PROMPT: "0",
    },
  }).trim();
}

async function fixture(duplicateRenameContent = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-phase8-repo-"));
  const storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aiw-phase8-store-"));
  temporaryRoots.push(root, storeRoot);
  git(root, "init", "-q", "--initial-branch=main");
  git(root, "config", "user.name", "AgentIntersect World Fixture");
  git(root, "config", "user.email", "fixture@example.invalid");
  write(root, "tracked.txt", "before\n");
  write(root, "delete-me.txt", "delete me\n");
  write(root, "old-name.txt", "rename bytes\n");
  if (duplicateRenameContent)
    write(root, "old-name-copy.txt", "rename bytes\n");
  write(root, "binary.bin", Buffer.from([0, 1, 2, 3]));
  write(root, "blob.bin", Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]));
  write(root, "concurrent.txt", "before concurrent\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "fixture baseline");
  const generation = await indexRepository({ rootPath: root, maxFiles: 100 });
  const snapshot = projectRepositoryGeneration(generation);
  let clock = Date.parse("2026-07-20T12:00:00.000Z");
  return {
    root,
    storeRoot,
    generation,
    snapshot,
    now: () => (clock += 1_000),
  };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

describe("Phase 8 evidence capture, reconciliation, and retention", () => {
  it("never embeds a binary file without a NUL byte as text", async () => {
    const state = await fixture();
    const service = new EvidenceService({
      root: state.storeRoot,
      selectedRepository: () => ({
        generation: state.generation,
        snapshot: state.snapshot,
      }),
      now: state.now,
    });

    const baseline = service.prepare(intentId);
    const baselineFile = baseline.files.find(
      (file) => file.path === "blob.bin",
    );
    expect(baselineFile).toMatchObject({ binary: true, oversized: false });
    expect(baselineFile).not.toHaveProperty("sanitizedText");

    write(state.root, "blob.bin", Buffer.from([1, 2, 3, 4, 5, 6, 7, 9]));
    const evidence = service.finalize({
      intentId,
      jobId: "job-binary-no-nul",
      runId: "run-binary-no-nul",
      lifecycle: "complete",
      reportedPaths: ["blob.bin"],
    });
    const change = evidence.changes.find((item) => item.path === "blob.bin");

    expect(change).toMatchObject({
      outcome: "binary",
      binary: true,
      before: { size: 8, contentHash: expect.stringMatching(/^[0-9a-f]{64}$/) },
      after: { size: 8, contentHash: expect.stringMatching(/^[0-9a-f]{64}$/) },
      diffBytes: 0,
      diagnostics: [
        "Binary content is unavailable; bounded metadata and content hash only.",
      ],
    });
    expect(change).not.toHaveProperty("diff");
  });

  it("uses the authoritative cached World snapshot for renamed evidence refs", async () => {
    const state = await fixture();
    const server = createLocalServer({ config: serverConfig });
    servers.push(server);
    const index = async (key: string) => {
      const created = await server.inject({
        method: "POST",
        url: "/repository-indexes",
        headers: { "idempotency-key": key },
        payload: { rootPath: state.root },
      });
      const operationId = created.json().data.id as string;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const operation = await server.inject({
          method: "GET",
          url: `/repository-indexes/${operationId}`,
        });
        if (operation.json().data.status !== "running") {
          expect(operation.json().data.status).toBe("succeeded");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      throw new Error("repository index did not settle");
    };
    const authoritativeFileRef = async (filePath: string) => {
      const response = await server.inject({
        method: "GET",
        url: "/world/current",
      });
      expect(response.statusCode).toBe(200);
      const file = response
        .json()
        .data.snapshot.objects.find(
          (object: { kind: string; path?: string }) =>
            object.kind === "file" && object.path === filePath,
        );
      return file.ref as string;
    };

    await index("evidence-continuity-a");
    const oldRef = await authoritativeFileRef("old-name.txt");
    fs.renameSync(
      path.join(state.root, "old-name.txt"),
      path.join(state.root, "renamed.txt"),
    );
    git(state.root, "add", "-A");
    git(state.root, "commit", "-qm", "exact-content rename");
    await index("evidence-continuity-b");
    const authoritativeRef = await authoritativeFileRef("renamed.txt");
    expect(authoritativeRef).toBe(oldRef);

    type RepositorySelection = {
      generation: typeof state.generation;
      snapshot: typeof state.snapshot;
    };
    const selectedRepository = (): RepositorySelection | null => {
      const accessor = (
        server as typeof server & {
          currentRepositorySelection?: () => RepositorySelection | null;
        }
      ).currentRepositorySelection;
      if (accessor) return accessor();
      const generation = server.repositoryIndexService.current();
      return generation
        ? { generation, snapshot: projectRepositoryGeneration(generation) }
        : null;
    };
    const service = new EvidenceService({
      root: state.storeRoot,
      selectedRepository,
      now: state.now,
    });
    const baseline = service.prepare(intentId);
    expect(
      baseline.files.find((file) => file.path === "renamed.txt")?.objectRef,
    ).toBe(authoritativeRef);

    write(state.root, "renamed.txt", "changed after rename\n");
    const evidence = service.finalize({
      intentId,
      jobId: "job-rename-continuity",
      runId: "run-rename-continuity",
      lifecycle: "complete",
      reportedPaths: ["renamed.txt"],
    });
    expect(
      evidence.changes.find((change) => change.path === "renamed.txt")
        ?.objectRef,
    ).toBe(authoritativeRef);
  });

  it("seals before mutation, restarts, reconciles exact outcomes, redacts, maps refs, and finalizes once", async () => {
    const state = await fixture();
    const options = {
      root: state.storeRoot,
      selectedRepository: () => ({
        generation: state.generation,
        snapshot: state.snapshot,
      }),
      now: state.now,
    };
    const first = new EvidenceService(options);
    const baseline = await first.prepare(intentId);
    expect(baseline.intentId).toBe(intentId);
    expect(baseline.git.dirty).toBe(false);

    write(
      state.root,
      "tracked.txt",
      "after\nAPI_TOKEN=world-phase8-secret-canary\n",
    );
    write(state.root, "new-file.txt", "new text\n");
    fs.unlinkSync(path.join(state.root, "delete-me.txt"));
    fs.renameSync(
      path.join(state.root, "old-name.txt"),
      path.join(state.root, "renamed.txt"),
    );
    write(state.root, "binary.bin", Buffer.from([0, 1, 2, 4]));
    write(state.root, "concurrent.txt", "unreported concurrent change\n");

    const jobId = "job-phase8";
    const runId = "run-phase8";
    const artifactPath = ".agentintersect-world/test-evidence.json";
    const artifact = `${JSON.stringify({
      schema: "aiw.test-evidence/0.8",
      intentId,
      jobId,
      runId,
      state: "passed",
    })}\n`;
    write(state.root, artifactPath, artifact);
    const artifactHash = createHash("sha256").update(artifact).digest("hex");

    const restarted = new EvidenceService({
      ...options,
      selectedRepository: () => null,
    });
    expect(restarted.pending(intentId)?.sealedAt).toBe(baseline.sealedAt);
    const evidence = await restarted.finalize({
      intentId,
      jobId,
      runId,
      lifecycle: "complete",
      reportedPaths: [
        "tracked.txt",
        "new-file.txt",
        "delete-me.txt",
        "renamed.txt",
        "binary.bin",
        artifactPath,
        "reported-but-missing.txt",
      ],
      testEvidence: { path: artifactPath, hash: artifactHash, state: "passed" },
    });

    expect(
      evidence.changes.map((change) => [
        change.previousPath ?? change.path,
        change.path,
        change.outcome,
        change.attribution,
      ]),
    ).toEqual([
      [artifactPath, artifactPath, "created", "reported-and-confirmed"],
      ["binary.bin", "binary.bin", "binary", "reported-and-confirmed"],
      ["concurrent.txt", "concurrent.txt", "modified", "ambiguous"],
      ["delete-me.txt", "delete-me.txt", "deleted", "reported-and-confirmed"],
      ["new-file.txt", "new-file.txt", "created", "reported-and-confirmed"],
      ["old-name.txt", "renamed.txt", "renamed", "reported-and-confirmed"],
      [
        "reported-but-missing.txt",
        "reported-but-missing.txt",
        "reported",
        "reported-unverified",
      ],
      ["tracked.txt", "tracked.txt", "modified", "reported-and-confirmed"],
    ]);
    const durable = fs.readFileSync(
      path.join(state.storeRoot, "phase8-evidence.json"),
      "utf8",
    );
    expect(durable).not.toContain("world-phase8-secret-canary");
    expect(JSON.stringify(evidence)).not.toContain(
      "world-phase8-secret-canary",
    );
    expect(
      evidence.changes.find((change) => change.path === "tracked.txt")?.diff,
    ).toContain("[REDACTED: secret-like content]");
    expect(evidence.test).toMatchObject({
      state: "passed",
      verification: "verified",
      artifactPath,
      artifactHash,
    });
    expect(
      evidence.changes.find((change) => change.path === "delete-me.txt")
        ?.objectRef,
    ).toMatch(/^aiw:\/\/object\/[0-9a-f]{32}$/);
    expect(
      evidence.changes.find((change) => change.outcome === "renamed")
        ?.objectRef,
    ).toMatch(/^aiw:\/\/object\/[0-9a-f]{32}$/);

    const completedAt = evidence.completedAt;
    const idempotent = await restarted.finalize({
      intentId,
      jobId,
      runId,
      lifecycle: "complete",
      reportedPaths: [],
    });
    expect(idempotent).toEqual(evidence);
    expect(idempotent.completedAt).toBe(completedAt);
    expect(restarted.lookup({ intentId }).current).toEqual(evidence);
    expect(restarted.lookup({ jobId }).current).toEqual(evidence);
    expect(restarted.lookup({ runId }).current).toEqual(evidence);
    expect(new EvidenceService(options).lookup({ intentId }).current).toEqual(
      evidence,
    );
  });

  it("fails closed without a selected successful generation", async () => {
    const storeRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "aiw-phase8-store-"),
    );
    temporaryRoots.push(storeRoot);
    const service = new EvidenceService({
      root: storeRoot,
      selectedRepository: () => null,
      now: () => Date.parse("2026-07-20T12:00:00.000Z"),
    });
    expect(() => service.prepare(intentId)).toThrow(
      "No successful selected repository generation",
    );
    expect(service.pending(intentId)).toBeNull();
  });

  it("keeps a non-unique exact-hash rename collision as separate create and deletes", async () => {
    const state = await fixture(true);
    const service = new EvidenceService({
      root: state.storeRoot,
      selectedRepository: () => ({
        generation: state.generation,
        snapshot: state.snapshot,
      }),
      now: state.now,
    });
    service.prepare(intentId);
    fs.unlinkSync(path.join(state.root, "old-name.txt"));
    fs.unlinkSync(path.join(state.root, "old-name-copy.txt"));
    write(state.root, "renamed.txt", "rename bytes\n");
    const evidence = service.finalize({
      intentId,
      jobId: "job-collision",
      runId: "run-collision",
      lifecycle: "complete",
      reportedPaths: ["renamed.txt"],
    });
    expect(
      evidence.changes
        .filter((change) =>
          ["old-name.txt", "old-name-copy.txt", "renamed.txt"].includes(
            change.path,
          ),
        )
        .map((change) => [change.path, change.outcome]),
    ).toEqual([
      ["old-name-copy.txt", "deleted"],
      ["old-name.txt", "deleted"],
      ["renamed.txt", "created"],
    ]);
    expect(
      evidence.changes.some((change) => change.outcome === "renamed"),
    ).toBe(false);
  });

  it("caps completed retention at 20 and recovers only a verified previous generation", async () => {
    const state = await fixture();
    const options = {
      root: state.storeRoot,
      selectedRepository: () => ({
        generation: state.generation,
        snapshot: state.snapshot,
      }),
      now: state.now,
    };
    const service = new EvidenceService(options);
    const ids = Array.from(
      { length: 21 },
      (_, index) =>
        `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    );
    for (const [index, id] of ids.entries()) {
      service.prepare(id);
      service.finalize({
        intentId: id,
        jobId: `job-retention-${index}`,
        runId: `run-retention-${index}`,
        lifecycle: "complete",
      });
    }
    expect(() => service.lookup({ intentId: ids[0] })).toThrow(
      "Evidence record not found",
    );
    expect(service.latest().current?.runId).toBe("run-retention-20");

    const filename = path.join(state.storeRoot, "phase8-evidence.json");
    fs.writeFileSync(filename, "{corrupt", "utf8");
    expect(new EvidenceService(options).latest().current?.runId).toBe(
      "run-retention-19",
    );
    fs.writeFileSync(`${filename}.previous`, "{also-corrupt", "utf8");
    expect(() => new EvidenceService(options)).toThrow(/corrupt.*fail-closed/i);
  });
});
