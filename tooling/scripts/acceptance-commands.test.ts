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

describe("Phase 1 acceptance command graph", () => {
  it("bootstraps project-pinned Chromium before every root E2E path", async () => {
    const manifest = JSON.parse(
      await readProjectFile("package.json"),
    ) as RootManifest;
    const freshVerification = await readProjectFile(
      "tooling/scripts/verify-fresh.ts",
    );
    const browserInstall = requireScript(manifest, "test:e2e:install");
    const endToEnd = requireScript(manifest, "test:e2e");
    const aggregate = requireScript(manifest, "check");

    expect(browserInstall).toBe("playwright install chromium");
    expect(endToEnd).toContain("corepack pnpm@11.15.0 test:e2e:install");
    expect(endToEnd.indexOf("test:e2e:install")).toBeLessThan(
      endToEnd.indexOf("playwright test"),
    );
    expect(aggregate).toContain("corepack pnpm@11.15.0 test:e2e");
    expect(aggregate).not.toMatch(/(?:^|&&)\s*playwright test/);
    expect(freshVerification).toContain('["pnpm@11.15.0", "check"]');
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
