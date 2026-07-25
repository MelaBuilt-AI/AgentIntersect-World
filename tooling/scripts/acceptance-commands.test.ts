import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

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
    expect(worldEntrySpec.match(/@pointer-lock/g)).toHaveLength(1);
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
    expect(config.webServer).toHaveLength(2);
  });

  it("installs pinned pnpm before the frozen CI acceptance sequence", async () => {
    const workflow = await readProjectFile(".github/workflows/ci.yml");

    expect(workflow).toContain("node-version: 24");
    expect(workflow).not.toMatch(/cache:\s*pnpm/);

    const requiredSequence = [
      "corepack enable",
      "corepack prepare pnpm@11.15.0 --activate",
      "pnpm install --frozen-lockfile",
      "pnpm exec playwright install --with-deps chromium",
      "pnpm measure:phase10",
      "pnpm avatar:verify",
      "pnpm measure:phase11",
      "pnpm check",
    ];
    const positions = requiredSequence.map((command) =>
      workflow.indexOf(command),
    );

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual(
      [...positions].sort((left, right) => left - right),
    );
  });
});
