import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  encodePcm16Wav,
  inspectPcm16Wav,
} from "../../packages/voice/src/index.js";
import { WhisperCliProvider } from "../../packages/voice/src/node.js";

const providerRoot = process.env.AIW_PHASE15_STT_PROVIDER_ROOT;
if (!providerRoot)
  throw new Error(
    "AIW_PHASE15_STT_PROVIDER_ROOT must explicitly select the verified staging tree.",
  );

const ownedRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "aiw-phase15-live-provider-"),
);
fs.chmodSync(ownedRoot, 0o700);
const suffix = randomUUID();
const windowsName = `aiw-phase15-${suffix}.wav`;
const windowsPath = `C:\\Windows\\Temp\\${windowsName}`;
const wslWindowsPath = `/mnt/c/Windows/Temp/${windowsName}`;
const convertedRawPath = path.join(ownedRoot, "input-16k-mono.s16le");
const convertedPath = path.join(ownedRoot, "input-16k-mono.wav");
const sha256 = (file: string) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const inventory = (root: string) => {
  let regularFiles = 0;
  let regularBytes = 0;
  let symlinks = 0;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const name of fs.readdirSync(current)) {
      const entry = path.join(current, name);
      const stat = fs.lstatSync(entry);
      if (stat.isSymbolicLink()) symlinks += 1;
      else if (stat.isDirectory()) stack.push(entry);
      else if (stat.isFile()) {
        regularFiles += 1;
        regularBytes += stat.size;
      }
    }
  }
  return { regularFiles, regularBytes, symlinks };
};

let evidence: Record<string, unknown> | undefined;
try {
  const escapedWindowsPath = windowsPath.replaceAll("'", "''");
  const synthesis = [
    "Add-Type -AssemblyName System.Speech",
    "$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    `$voice.SetOutputToWaveFile('${escapedWindowsPath}')`,
    "$voice.Speak('Voice input remains editable before sending.')",
    "$voice.Dispose()",
  ].join("; ");
  const generated = spawnSync(
    "/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", synthesis],
    { shell: false, encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024 },
  );
  if (generated.status !== 0)
    throw new Error(
      `Installed system voice fixture generation failed (${generated.status}).`,
    );
  const converted = spawnSync(
    "/usr/bin/ffmpeg",
    [
      "-nostdin",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      wslWindowsPath,
      "-ac",
      "1",
      "-ar",
      "16000",
      "-sample_fmt",
      "s16",
      "-f",
      "s16le",
      "-y",
      convertedRawPath,
    ],
    { shell: false, encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024 },
  );
  if (converted.status !== 0)
    throw new Error(
      `Deterministic PCM conversion failed (${converted.status}).`,
    );
  const rawPcm = fs.readFileSync(convertedRawPath);
  if (rawPcm.byteLength % 2 !== 0)
    throw new Error("Converted PCM byte length is invalid.");
  const samples = new Float32Array(rawPcm.byteLength / 2);
  for (let index = 0; index < samples.length; index += 1)
    samples[index] = rawPcm.readInt16LE(index * 2) / 0x8000;
  const canonical = encodePcm16Wav(samples, 16_000);
  fs.writeFileSync(convertedPath, canonical, { mode: 0o600 });
  rawPcm.fill(0);
  samples.fill(0);
  canonical.fill(0);
  const wav = fs.readFileSync(convertedPath);
  const wavContract = inspectPcm16Wav(wav);
  const provider = new WhisperCliProvider({
    providerRoot,
    tempRoot: path.join(ownedRoot, "volatile-provider-payload"),
  });
  const attestation = await provider.attest();
  if (!attestation.available)
    throw new Error(`Pinned provider unavailable: ${attestation.reason}`);
  const result = await provider.transcribe(wav);
  wav.fill(0);
  const stagedInventory = inventory(providerRoot);
  const runtime = path.join(
    providerRoot,
    "runtime-extracted/whisper-bin-ubuntu-x64/whisper-cli",
  );
  const model = path.join(
    providerRoot,
    "model/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base.en.bin",
  );
  evidence = {
    schema: "aiw.phase15-live-provider/1",
    measuredAt: new Date().toISOString(),
    provider: attestation,
    pins: {
      whisperCliSha256: sha256(runtime),
      modelSha256: sha256(model),
      modelBytes: fs.statSync(model).size,
      runtimeInventorySha256:
        "cec21291ef72fc23ddfe92ad8bd8ea211eb2bc403356943eb50433b4f529b15d",
    },
    command: {
      executable: "whisper-cli",
      shell: false,
      argvShape: [
        "--model <attested-model>",
        "--file <app-owned-wav>",
        "--language en",
        "--threads 8",
        "--processors 1",
        "--no-gpu",
        "--no-fallback",
        "--no-prints",
        "--no-timestamps",
        "--output-json-full",
        "--output-file <app-owned-result>",
      ],
    },
    inputContract: {
      ...wavContract,
      encodedBytes: fs.statSync(convertedPath).size,
      generatedBy:
        "installed Windows System.Speech voice plus installed ffmpeg",
      committedRawAudio: false,
    },
    result: {
      lexicalTextProduced: result.finalText.length > 0,
      finalTextUtf8Bytes: Buffer.byteLength(result.finalText, "utf8"),
      expectedFixtureMatch:
        result.finalText === "Voice input remains editable before sending.",
      elapsedMs: result.elapsedMs,
      peakRssBytes: result.peakRssBytes,
      outputBytes: result.outputBytes,
      elapsedTargetMs: 2_000,
      elapsedHardCeilingMs: 10_000,
      outputCeilingBytes: 1024 * 1024,
      pass:
        result.elapsedMs <= 10_000 &&
        result.outputBytes <= 1024 * 1024 &&
        result.finalText.length > 0,
    },
    stagedInventory,
  };
} finally {
  fs.rmSync(wslWindowsPath, { force: true });
  fs.rmSync(ownedRoot, { recursive: true, force: true });
}

if (!evidence) throw new Error("Live provider evidence was not produced.");
const whisperProcesses = fs
  .readdirSync("/proc")
  .filter((name) => /^\d+$/.test(name))
  .filter((pid) => {
    try {
      return fs
        .readFileSync(`/proc/${pid}/cmdline`, "utf8")
        .includes("whisper-cli");
    } catch {
      return false;
    }
  });
const whisperServerProcesses = fs
  .readdirSync("/proc")
  .filter((name) => /^\d+$/.test(name))
  .filter((pid) => {
    try {
      return fs
        .readFileSync(`/proc/${pid}/cmdline`, "utf8")
        .includes("whisper-server");
    } catch {
      return false;
    }
  });
const cleanup = {
  ownedTempRootExists: fs.existsSync(ownedRoot),
  generatedSourceWavExists: fs.existsSync(wslWindowsPath),
  whisperProcessCount: whisperProcesses.length,
  providerListenerProcessCount: whisperServerProcesses.length,
  pass:
    !fs.existsSync(ownedRoot) &&
    !fs.existsSync(wslWindowsPath) &&
    whisperProcesses.length === 0 &&
    whisperServerProcesses.length === 0,
};
evidence = { ...evidence, cleanup, verdict: cleanup.pass };
if (!cleanup.pass)
  throw new Error(
    `Phase 15 provider cleanup failed: ${JSON.stringify(cleanup)}`,
  );
const directory = path.resolve("artifacts/phase15");
fs.mkdirSync(directory, { recursive: true, mode: 0o755 });
fs.writeFileSync(
  path.join(directory, "phase15-live-provider.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`[phase15-live-provider] ${JSON.stringify(evidence)}\n`);
