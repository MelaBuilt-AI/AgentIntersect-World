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
    const phase13Measurement = requireScript(manifest, "measure:phase13");
    const aggregate = requireScript(manifest, "check");

    expect(browserInstall).toBe("playwright install chromium");
    expect(endToEnd).toContain("corepack pnpm@11.15.0 test:e2e:install");
    expect(endToEnd).toContain("xvfb-run -a playwright test");
    expect(endToEnd.indexOf("test:e2e:install")).toBeLessThan(
      endToEnd.indexOf("xvfb-run -a playwright test"),
    );
    expect(endToEnd.indexOf("corepack pnpm@11.15.0 build")).toBeLessThan(
      endToEnd.indexOf("xvfb-run -a playwright test"),
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

  it("routes only the real Phase 13 pointer-lock journey through headed Chromium", async () => {
    const { default: config } = await import("../../playwright.config.js");
    const pointerLockSpec = "**/phase13-world-action-journey.spec.ts";
    const pointerLockTag = /@pointer-lock/;
    const phase13Spec = await readProjectFile(
      "apps/web/e2e/phase13-world-action-journey.spec.ts",
    );
    const projects = config.projects ?? [];

    expect(phase13Spec.match(/@pointer-lock/g)).toHaveLength(2);
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
        testMatch: pointerLockSpec,
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
