import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it, vi } from "vitest";

import { PreviewManagerService } from "../src/preview-manager-service.js";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    open: async (...args: Parameters<typeof actual.open>) => {
      const handle = await actual.open(...args);
      if (args[1] === "r") {
        // Windows rejects flushing a handle without write access.
        handle.sync = async () => {
          throw Object.assign(
            new Error("EPERM: operation not permitted, fsync"),
            {
              code: "EPERM",
              syscall: "fsync",
            },
          );
        };
      }
      return handle;
    },
  };
});

it("durably updates approved recipes with Windows flush semantics without truncating the backup", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aiw-preview-persistence-"));
  const service = new PreviewManagerService({
    directory,
    resolveWorkstream: () => {
      throw new Error("Recipe persistence must not dispatch a Workstream");
    },
  });
  const recipe = {
    requestId: "approve-one",
    correlationId: "approve-one",
    recipeId: "static-site",
    expectedRevision: null,
    repositoryId: "repository-one",
    label: "Static website",
    executable: process.execPath,
    args: ["preview.mjs", "{port}"],
    readinessPath: "/",
    browserPath: "/",
  };
  try {
    await service.approveRecipe(recipe);
    const original = await readFile(
      join(directory, "preview-manager.current.json"),
      "utf8",
    );
    await service.approveRecipe({
      ...recipe,
      requestId: "approve-two",
      correlationId: "approve-two",
      expectedRevision: 1,
      label: "Updated static website",
    });
    expect(
      await readFile(join(directory, "preview-manager.previous.json"), "utf8"),
    ).toBe(original);
    const saved = JSON.parse(
      await readFile(join(directory, "preview-manager.current.json"), "utf8"),
    );
    expect(saved.generation).toBe(2);
    expect(saved.payload.recipes[0]).toMatchObject({
      revision: 2,
      label: "Updated static website",
    });
  } finally {
    // No preview process is launched by recipe-only persistence.
    await rm(directory, { recursive: true, force: true });
  }
});
