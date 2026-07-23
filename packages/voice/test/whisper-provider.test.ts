import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { encodePcm16Wav } from "../src/index.js";
import {
  ProviderUnavailableError,
  WhisperCliProvider,
  verifyRuntimeInventory,
  type WhisperProcessRunner,
} from "../src/node.js";

const root = () => mkdtempSync(path.join(tmpdir(), "aiw-voice-provider-test-"));

describe("Phase 15 pinned whisper provider", () => {
  it("re-attests every current runtime file against the pinned inventory", () => {
    const root = mkdtempSync(path.join(tmpdir(), "aiw-runtime-inventory-"));
    const runtimeRoot = path.join(root, "runtime-extracted");
    const library = path.join(
      runtimeRoot,
      "whisper-bin-ubuntu-x64",
      "libwhisper.so.1",
    );
    mkdirSync(path.dirname(library), { recursive: true });
    writeFileSync(library, "approved-runtime", "utf8");
    chmodSync(library, 0o600);
    const inventory = path.join(root, "runtime-inventory.json");
    writeFileSync(
      inventory,
      JSON.stringify([
        {
          mode: "0o600",
          path: "whisper-bin-ubuntu-x64/libwhisper.so.1",
          sha256:
            "7a977b135935d08263ef6b0478cdfcc5c56ee9452bc668d4fc63d4aee28f4c1d",
          size: 16,
        },
      ]),
      "utf8",
    );
    expect(verifyRuntimeInventory(runtimeRoot, inventory)).toBe(true);
    writeFileSync(library, "mutated-runtime!", "utf8");
    expect(verifyRuntimeInventory(runtimeRoot, inventory)).toBe(false);
  });

  it("defaults unavailable and fails closed on a hash mismatch", async () => {
    expect((await new WhisperCliProvider({}).attest()).available).toBe(false);
    const provider = new WhisperCliProvider({ providerRoot: root() });
    await expect(
      provider.transcribe(encodePcm16Wav(new Float32Array(10), 16_000)),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it("uses fixed English CPU argv, bounds output, and removes every temp payload", async () => {
    const calls: { argv?: readonly string[]; cwd?: string }[] = [];
    const runner: WhisperProcessRunner = async (input) => {
      calls.push({ argv: input.argv, cwd: input.cwd });
      input.onOutput("stdout", "");
      input.writeResult(
        JSON.stringify({ transcription: [{ text: " deterministic final " }] }),
      );
      return { exitCode: 0, signal: null, elapsedMs: 12, peakRssBytes: 1024 };
    };
    const provider = new WhisperCliProvider({
      providerRoot: root(),
      attest: async () => ({ available: true, reason: null }),
      runner,
    });
    const result = await provider.transcribe(
      encodePcm16Wav(new Float32Array(160), 16_000),
    );
    expect(result.finalText).toBe("deterministic final");
    expect(calls[0]?.argv).toEqual(
      expect.arrayContaining([
        "--threads",
        "8",
        "--processors",
        "1",
        "--language",
        "en",
        "--no-gpu",
        "--no-fallback",
        "--output-json-full",
      ]),
    );
    expect(calls[0]?.argv.join(" ")).not.toMatch(
      /whisper-server|--detect-language/,
    );
    expect(existsSync(calls[0]!.cwd!)).toBe(false);
  });

  it("enforces one active plus one queued and supports queued cancellation", async () => {
    let release!: () => void;
    const wait = new Promise<void>((resolve) => (release = resolve));
    const runner: WhisperProcessRunner = async (input) => {
      await wait;
      input.writeResult(JSON.stringify({ transcription: [{ text: "ok" }] }));
      return { exitCode: 0, signal: null, elapsedMs: 1, peakRssBytes: 1 };
    };
    const provider = new WhisperCliProvider({
      providerRoot: root(),
      attest: async () => ({ available: true, reason: null }),
      runner,
    });
    const wav = encodePcm16Wav(new Float32Array(160), 16_000);
    const active = provider.transcribe(wav);
    const queuedController = new AbortController();
    const queued = provider.transcribe(wav, {
      signal: queuedController.signal,
    });
    await expect(provider.transcribe(wav)).rejects.toMatchObject({
      code: "queue-full",
    });
    queuedController.abort();
    await expect(queued).rejects.toMatchObject({ code: "cancelled" });
    release();
    await expect(active).resolves.toMatchObject({ finalText: "ok" });
  });

  it("never leaves raw WAV or provider JSON after timeout/output failure", async () => {
    const directories: string[] = [];
    const runner: WhisperProcessRunner = async (input) => {
      directories.push(input.cwd);
      input.onOutput("stderr", "x".repeat(1_048_577));
      return { exitCode: 1, signal: null, elapsedMs: 10_001, peakRssBytes: 1 };
    };
    const provider = new WhisperCliProvider({
      providerRoot: root(),
      attest: async () => ({ available: true, reason: null }),
      runner,
    });
    await expect(
      provider.transcribe(encodePcm16Wav(new Float32Array(160), 16_000)),
    ).rejects.toMatchObject({ code: "output-ceiling" });
    for (const directory of directories) {
      expect(existsSync(directory)).toBe(false);
    }
  });

  it("fails unavailable for non-English and times out at the hard ceiling", async () => {
    const provider = new WhisperCliProvider({
      providerRoot: root(),
      attest: async () => ({ available: true, reason: null }),
      runner: async (input) => {
        input.writeResult(
          JSON.stringify({ transcription: [{ text: "late" }] }),
        );
        return {
          exitCode: 0,
          signal: null,
          elapsedMs: 10_001,
          peakRssBytes: 1,
        };
      },
    });
    const wav = encodePcm16Wav(new Float32Array(160), 16_000);
    await expect(
      provider.transcribe(wav, { language: "fr" }),
    ).rejects.toMatchObject({
      code: "non-english",
    });
    await expect(provider.transcribe(wav)).rejects.toMatchObject({
      code: "timeout",
    });
  });

  it("enforces the 1 MiB ceiling across combined stdout, stderr, and JSON", async () => {
    const provider = new WhisperCliProvider({
      providerRoot: root(),
      attest: async () => ({ available: true, reason: null }),
      runner: async (input) => {
        input.onOutput("stdout", "x".repeat(600_000));
        input.writeResult(
          JSON.stringify({
            transcription: [{ text: "valid" }],
            padding: "y".repeat(600_000),
          }),
        );
        return { exitCode: 0, signal: null, elapsedMs: 1, peakRssBytes: 1 };
      },
    });
    await expect(
      provider.transcribe(encodePcm16Wav(new Float32Array(160), 16_000)),
    ).rejects.toMatchObject({ code: "output-ceiling" });
  });

  it("waits for an output-ceiling process tree to exit before cleanup returns", async () => {
    const providerRoot = root();
    const executable = path.join(
      providerRoot,
      "runtime-extracted/whisper-bin-ubuntu-x64/whisper-cli",
    );
    mkdirSync(path.dirname(executable), { recursive: true });
    const pidFile = path.join(providerRoot, "child.pid");
    writeFileSync(
      executable,
      `#!/bin/sh\necho $$ > '${pidFile}'\ntrap 'sleep 0.1; exit 0' TERM\nhead -c 1100000 /dev/zero | tr '\\0' x\nsleep 10\n`,
    );
    chmodSync(executable, 0o700);
    const provider = new WhisperCliProvider({
      providerRoot,
      attest: async () => ({ available: true, reason: null }),
    });
    const started = performance.now();
    await expect(
      provider.transcribe(encodePcm16Wav(new Float32Array(160), 16_000)),
    ).rejects.toMatchObject({ code: "output-ceiling" });
    const pid = Number(readFileSync(pidFile, "utf8").trim());
    expect(performance.now() - started).toBeGreaterThanOrEqual(75);
    expect(() => process.kill(pid, 0)).toThrow();
  });
});
