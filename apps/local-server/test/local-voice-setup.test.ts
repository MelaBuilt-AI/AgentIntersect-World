import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { LocalVoiceInstaller } from "@agentintersect-world/voice/node";
import { createLocalServer } from "../src/server.js";
it("offers setup before any agent exists and rejects absent consent without downloading", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "aiw-setup-api-"));
  const fetcher = vi.fn();
  const server = createLocalServer({
    localVoiceInstaller: new LocalVoiceInstaller({ directory, fetcher }),
  });
  try {
    const status = await server.inject({ method: "GET", url: "/voice/setup" });
    expect(status.statusCode).toBe(200);
    expect(status.json().data.state).toBe("not-installed");
    const denied = await server.inject({
      method: "POST",
      url: "/voice/setup",
      payload: { consent: false },
    });
    expect(denied.statusCode).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
