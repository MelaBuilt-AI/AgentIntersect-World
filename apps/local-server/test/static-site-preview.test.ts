import { mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { startStaticSitePreview } from "../src/static-site-preview.js";

it("serves a real static homepage and blocks private files and links outside its owned root", async () => {
  const root = await mkdtemp(join(tmpdir(), "aiw-static-preview-"));
  await writeFile(join(root, "index.html"), "<h1>Owned homepage</h1>");
  await writeFile(join(root, ".env"), "PRIVATE_SENTINEL");
  await symlink(join(root, ".env"), join(root, "leak.html"));
  const server = await startStaticSitePreview(root, 0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw Error("not listening");
    const origin = `http://127.0.0.1:${address.port}`;
    expect(await (await fetch(origin)).text()).toContain("Owned homepage");
    for (const path of ["/.env", "/leak.html", "/%2eenv", "/missing.html"])
      expect((await fetch(origin + path)).status).toBe(404);
    expect((await fetch(origin, { method: "POST" })).status).toBe(405);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(root, { recursive: true, force: true });
  }
});
