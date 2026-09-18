import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as provider from "../src/node.js";

const roots: string[] = [];
const root = () => {
  const p = mkdtempSync(path.join(tmpdir(), "aiw-voice-install-"));
  roots.push(p);
  return p;
};
afterEach(() => {
  for (const p of roots.splice(0)) rmSync(p, { recursive: true, force: true });
});
describe("local voice provisioning", () => {
  it("selects separate pinned Linux and Windows x64 runtimes, never substitutes an unsupported host", () => {
    expect(provider).toHaveProperty("voicePlatformPin");
    expect(provider.voicePlatformPin("linux", "x64")?.cli).toContain(
      "whisper-cli",
    );
    expect(provider.voicePlatformPin("win32", "x64")?.cli).toContain(
      "whisper-cli.exe",
    );
    expect(provider.voicePlatformPin("darwin", "arm64")).toBeNull();
  });
  it("requires consent before network or installation and leaves corrupt downloads inactive", async () => {
    expect(provider).toHaveProperty("LocalVoiceInstaller");
    const fetcher = vi.fn(async () => new Response("wrong artifact"));
    const directory = root();
    const installer = new provider.LocalVoiceInstaller({ directory, fetcher });
    expect(await installer.status()).toMatchObject({ state: "not-installed" });
    await expect(installer.install(false)).rejects.toThrow(/consent/i);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(installer.install(true)).rejects.toThrow(/verification/i);
    expect(await installer.status()).toMatchObject({ state: "failed" });
    expect(readdirSync(directory)).toEqual([]);
  });
});
