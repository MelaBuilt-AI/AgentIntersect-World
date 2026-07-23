import { access, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { cleanupPhase17PlaywrightRoot } from "./playwright-global-teardown.js";

describe("Phase 17 Playwright state cleanup", () => {
  it("removes only an exact managed per-run root", async () => {
    const root = join(
      tmpdir(),
      `aiw-phase17-playwright-${process.pid}-cleanup-test`,
    );
    await mkdir(join(root, "phase17"), { recursive: true });
    await writeFile(join(root, "phase17", "observability.current.json"), "{}");

    await cleanupPhase17PlaywrightRoot(root);

    await expect(access(root)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects a broad or unmanaged cleanup target", async () => {
    await expect(cleanupPhase17PlaywrightRoot(tmpdir())).rejects.toThrow(
      "Refusing unsafe Phase 17 Playwright cleanup root",
    );
  });
});
