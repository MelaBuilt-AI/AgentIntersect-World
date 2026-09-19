import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

interface RootManifest {
  scripts: Record<string, string>;
}

const repositoryRoot = resolve(import.meta.dirname, "../..");

async function readProjectFile(path: string): Promise<string> {
  return await readFile(resolve(repositoryRoot, path), "utf8");
}

function requireScript(manifest: RootManifest, name: string): string {
  const script = manifest.scripts[name];
  if (script === undefined) throw new Error(`missing root script: ${name}`);
  return script;
}

describe("acceptance command graph", () => {
  it("disables only Chrome APT list entries without changing other sources", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "aiw-apt-source-"));
    const ubuntu =
      "Types: deb\nURIs: http://archive.ubuntu.com/ubuntu/\nSuites: noble\nComponents: main\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n";
    const other =
      "deb [signed-by=/keys/cloud.gpg] https://packages.cloud.google.com/apt cloud-sdk main\n";
    const chrome =
      "deb [arch=amd64 signed-by=/keys/chrome.gpg] https://dl.google.com/linux/chrome-stable/deb/ stable main\n";
    const legacyChrome =
      "deb http://dl.google.com/linux/chrome/deb/ stable main\n";
    try {
      await writeFile(resolve(directory, "ubuntu.sources"), ubuntu);
      await writeFile(
        resolve(directory, "mixed.list"),
        other + chrome + legacyChrome,
      );
      execFileSync("python3", [
        resolve(
          repositoryRoot,
          "tooling/scripts/disable-ci-chrome-apt-source.py",
        ),
        directory,
      ]);
      expect(await readFile(resolve(directory, "ubuntu.sources"), "utf8")).toBe(
        ubuntu,
      );
      const disabled = await readFile(resolve(directory, "mixed.list"), "utf8");
      expect(disabled).toBe(
        other +
          "# CI: unused Chrome source disabled: " +
          chrome +
          "# CI: unused Chrome source disabled: " +
          legacyChrome,
      );
      execFileSync("python3", [
        resolve(
          repositoryRoot,
          "tooling/scripts/disable-ci-chrome-apt-source.py",
        ),
        directory,
      ]);
      expect(await readFile(resolve(directory, "mixed.list"), "utf8")).toBe(
        disabled,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("bootstraps project-pinned Chromium before every root E2E path", async () => {
    const manifest = JSON.parse(
      await readProjectFile("package.json"),
    ) as RootManifest;
    const freshVerification = await readProjectFile(
      "tooling/scripts/verify-fresh.ts",
    );
    const browserInstall = requireScript(manifest, "test:e2e:install");
    const endToEnd = requireScript(manifest, "test:e2e");
    const flaggedEndToEnd = requireScript(manifest, "test:e2e:flagged");
    const unflaggedEndToEnd = requireScript(manifest, "test:e2e:unflagged");
    const phase11Measurement = requireScript(manifest, "measure:phase11");
    const phase13Measurement = requireScript(manifest, "measure:phase13");
    const aggregate = requireScript(manifest, "check");

    expect(browserInstall).toBe("playwright install chromium");
    expect(endToEnd).toContain("corepack pnpm@11.15.0 test:e2e:install");
    expect(endToEnd).toContain("corepack pnpm@11.15.0 test:e2e:flagged");
    expect(endToEnd).toContain("corepack pnpm@11.15.0 test:e2e:unflagged");
    expect(endToEnd.indexOf("test:e2e:install")).toBeLessThan(
      endToEnd.indexOf("test:e2e:flagged"),
    );
    expect(endToEnd.indexOf("test:e2e:flagged")).toBeLessThan(
      endToEnd.indexOf("test:e2e:unflagged"),
    );
    expect(flaggedEndToEnd).toContain("VITE_AIW_LOCAL_DEVELOPER_UI=1");
    expect(flaggedEndToEnd).toContain(
      "xvfb-run -a playwright test --config playwright.config.ts",
    );
    expect(flaggedEndToEnd.indexOf("corepack pnpm@11.15.0 build")).toBeLessThan(
      flaggedEndToEnd.indexOf("xvfb-run -a playwright test"),
    );
    expect(unflaggedEndToEnd).toContain(
      "xvfb-run -a playwright test --config playwright.unflagged.config.ts",
    );
    expect(
      unflaggedEndToEnd.indexOf("corepack pnpm@11.15.0 build"),
    ).toBeLessThan(unflaggedEndToEnd.indexOf("xvfb-run -a playwright test"));
    expect(phase11Measurement).toContain(
      "VITE_AIW_LOCAL_DEVELOPER_UI=1 corepack pnpm@11.15.0 exec vite build apps/web --config apps/web/vite.config.ts",
    );
    expect(phase11Measurement).toContain(
      "VITE_AIW_LOCAL_DEVELOPER_UI=1 playwright test apps/web/e2e/phase11-avatar-journey.spec.ts",
    );
    expect(
      phase11Measurement.indexOf("VITE_AIW_LOCAL_DEVELOPER_UI=1 corepack"),
    ).toBeLessThan(
      phase11Measurement.indexOf("VITE_AIW_LOCAL_DEVELOPER_UI=1 playwright"),
    );
    expect(phase13Measurement).toContain(
      "xvfb-run -a playwright test apps/web/e2e/phase13-world-action-journey.spec.ts --workers=1",
    );
    expect(aggregate).toContain("corepack pnpm@11.15.0 test:e2e");
    expect(aggregate).not.toMatch(/(?:^|&&)\s*playwright test/);
    expect(freshVerification).toContain('["pnpm@11.15.0", "check"]');
    expect(freshVerification).toContain('["pnpm@11.15.0", "measure:phase10"]');
    expect(freshVerification).toContain('["pnpm@11.15.0", "avatar:verify"]');
    expect(freshVerification).toContain('["pnpm@11.15.0", "measure:phase11"]');
  });

  it("routes only the real pointer-lock journeys through headed Chromium", async () => {
    const { default: config } = await import("../../playwright.config.js");
    const pointerLockSpecs = [
      "**/phase13-world-action-journey.spec.ts",
      "**/world-entry-single-agent.spec.ts",
    ];
    const pointerLockTag = /@pointer-lock/;
    const phase13Spec = await readProjectFile(
      "apps/web/e2e/phase13-world-action-journey.spec.ts",
    );
    const worldEntrySpec = await readProjectFile(
      "apps/web/e2e/world-entry-single-agent.spec.ts",
    );
    const projects = config.projects ?? [];

    expect(phase13Spec.match(/@pointer-lock/g)).toHaveLength(2);
    expect(worldEntrySpec.match(/@pointer-lock/g)).toHaveLength(4);
    expect(worldEntrySpec).toContain(
      "@arrangement-controls @pointer-lock contains selectors and manipulates visual props",
    );
    expect(worldEntrySpec).toContain(
      "@repository-code-screen @pointer-lock inspects an object in World and fullscreen",
    );
    expect(config.testIgnore).toEqual([
      "**/world-entry-internal-fail-closed.spec.ts",
      "**/phase19-task12-two-agent-coding.spec.ts",
    ]);
    expect(projects).toHaveLength(2);
    expect(projects[0]?.name ?? "").toBe("");
    expect(projects).toEqual([
      expect.objectContaining({
        grepInvert: pointerLockTag,
        use: expect.objectContaining({
          browserName: "chromium",
          headless: true,
        }),
      }),
      expect.objectContaining({
        name: "headed-pointer-lock",
        testMatch: pointerLockSpecs,
        grep: pointerLockTag,
        use: expect.objectContaining({
          browserName: "chromium",
          headless: false,
        }),
      }),
    ]);
    expect(config.use).toMatchObject({
      baseURL: "http://127.0.0.1:45173",
      trace: "retain-on-failure",
    });
    const webServers = Array.isArray(config.webServer)
      ? config.webServer
      : [config.webServer];
    expect(webServers).toHaveLength(2);
    expect(webServers[0]).toMatchObject({
      // A TCP probe can race a failed bind and accept somebody else's socket.
      // Only this child process can publish the backend's successful startup.
      wait: { stdout: /AgentIntersect World local server ready at / },
      env: {
        AIW_AGENT_SESSIONS_ENABLED: "true",
        AIW_AGENT_SESSION_DATA_DIR: expect.stringMatching(/\/agent-sessions$/u),
        AIW_HERMES_API_KEY: "playwright-fixture-key",
      },
    });
    expect(webServers[0]).not.toHaveProperty("port");
    expect(webServers[0]).not.toHaveProperty("url");
  });

  it("retains traces only for the repository city correction journey", async () => {
    const worldEntrySpec = await readProjectFile(
      "apps/web/e2e/world-entry-single-agent.spec.ts",
    );
    const journeyTitle =
      "repository city correction keeps loading local, restores source materials, and moves by both paths";

    expect(worldEntrySpec).toContain(
      'const test = base.extend({ trace: "off" });',
    );
    expect([
      ...worldEntrySpec.matchAll(/trace: "retain-on-failure"/gu),
    ]).toHaveLength(1);
    expect(worldEntrySpec).not.toMatch(/\.use\(\{ trace:/u);
    expect(worldEntrySpec).toContain(
      'const traceTest = test.extend({ trace: "retain-on-failure" });',
    );
    expect(worldEntrySpec).toContain(
      `const repositoryCityCorrectionTitle =\n  "${journeyTitle}";`,
    );
    expect(worldEntrySpec).toContain(
      "traceTest(repositoryCityCorrectionTitle, async ({ page }) => {",
    );

    const shardListing = execFileSync(
      process.execPath,
      [
        resolve(repositoryRoot, "node_modules/@playwright/test/cli.js"),
        "test",
        "--config",
        "playwright.config.ts",
        "--grep-invert",
        "@phase18-5-performance",
        "--fully-parallel",
        "--shard=6/6",
        "--list",
      ],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    expect(shardListing).toContain(`› ${journeyTitle}`);
  });

  it("installs pinned pnpm before every isolated CI acceptance lane", async () => {
    const workflowSource = await readProjectFile(".github/workflows/ci.yml");
    const workflow = parse(workflowSource) as {
      jobs: Record<
        string,
        {
          "timeout-minutes"?: number;
          strategy?: { matrix?: { shard?: string[] } };
          steps: Array<{
            name?: string;
            if?: string;
            run?: string;
            uses?: string;
            with?: {
              "node-version"?: number;
              name?: string;
              path?: string;
              "retention-days"?: number;
            };
          }>;
        }
      >;
    };
    const commands = (jobName: string) =>
      workflow.jobs[jobName]?.steps.flatMap(({ run }) =>
        run === undefined ? [] : [run],
      ) ?? [];
    const expectOrderedCommands = (
      jobName: string,
      requiredSequence: string[],
    ) => {
      const jobCommands = commands(jobName);
      const positions = requiredSequence.map((required) =>
        jobCommands.findIndex((command) => command.includes(required)),
      );
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect(positions).toEqual(
        [...positions].sort((left, right) => left - right),
      );
    };
    const pinnedBootstrap = [
      "corepack enable",
      "corepack prepare pnpm@11.15.0 --activate",
      "pnpm install --frozen-lockfile",
      "sudo python3 tooling/scripts/disable-ci-chrome-apt-source.py /etc/apt/sources.list.d",
    ];

    expect(workflowSource).not.toMatch(/cache:\s*pnpm/);
    for (const job of Object.values(workflow.jobs)) {
      expect(job.steps).toContainEqual(
        expect.objectContaining({
          uses: "actions/setup-node@v7",
          with: { "node-version": 24 },
        }),
      );
    }
    expectOrderedCommands("core", [
      ...pinnedBootstrap,
      "pnpm exec playwright install --with-deps chromium",
      "pnpm verify:imported-avatar-current-inputs",
      "pnpm avatar:verify:compatibility",
      "pnpm check:core",
    ]);
    expectOrderedCommands("measurements", [
      ...pinnedBootstrap,
      "pnpm exec playwright install --with-deps chromium",
      "pnpm measure:phase10",
      "pnpm measure:phase11",
    ]);
    expectOrderedCommands("e2e-flagged", [
      ...pinnedBootstrap,
      "pnpm exec playwright install --with-deps chromium",
      "pnpm build",
      "VITE_AIW_LOCAL_DEVELOPER_UI=1 pnpm exec vite build",
      "VITE_AIW_LOCAL_DEVELOPER_UI=1 xvfb-run -a pnpm exec playwright test",
      "--config playwright.config.ts",
      "--fully-parallel --workers=1",
      "--shard=${{ matrix.shard }}",
    ]);
    expect(workflow.jobs["e2e-flagged"]?.strategy?.matrix?.shard).toEqual([
      "1/6",
      "2/6",
      "3/6",
      "4/6",
      "5/6",
      "6/6",
    ]);
    expect(workflow.jobs["e2e-flagged"]?.["timeout-minutes"]).toBe(30);
    expect(workflow.jobs["e2e-flagged"]?.steps).toContainEqual({
      name: "Upload flagged browser failure evidence",
      if: "failure()",
      uses: "actions/upload-artifact@v7",
      with: {
        name: "e2e-flagged-failure-${{ strategy.job-index }}",
        path: "test-results",
        "retention-days": 7,
      },
    });
    expectOrderedCommands("e2e-unflagged", [
      ...pinnedBootstrap,
      "pnpm exec playwright install --with-deps chromium",
      "pnpm build",
      "pnpm exec vite build apps/web",
      "xvfb-run -a pnpm exec playwright test",
      "--config playwright.unflagged.config.ts",
    ]);
  });
});
