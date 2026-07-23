import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  MAX_PROVIDER_OUTPUT_BYTES,
  MAX_STT_MS,
  VoiceProviderAttestationSchema,
  inspectPcm16Wav,
  type VoiceProviderAttestation,
} from "./index.js";

const PROVIDER_ID = "whisper.cpp-v1.9.1-base.en" as const;
const CLI_SHA256 =
  "427dfb509f2c04d0f01c101978b5666102c6f7e3abf2a236452db5939f5b533a";
const MODEL_SHA256 =
  "a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002";
const MODEL_SIZE = 147_964_211;
const INVENTORY_SHA256 =
  "cec21291ef72fc23ddfe92ad8bd8ea211eb2bc403356943eb50433b4f529b15d";
const CLI_RELATIVE = "runtime-extracted/whisper-bin-ubuntu-x64/whisper-cli";
const MODEL_RELATIVE =
  "model/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base.en.bin";
const INVENTORY_RELATIVE = "evidence/runtime-inventory.json";
const PROVENANCE_RELATIVE = "evidence/provenance-manifest.json";

export class VoiceProviderError extends Error {
  constructor(
    readonly code:
      | "unavailable"
      | "invalid-audio"
      | "non-english"
      | "timeout"
      | "queue-full"
      | "cancelled"
      | "output-ceiling"
      | "provider-failed"
      | "empty-transcript",
    message: string,
  ) {
    super(message);
    this.name = "VoiceProviderError";
  }
}

export class ProviderUnavailableError extends VoiceProviderError {
  constructor(message = "The pinned local speech provider is unavailable.") {
    super("unavailable", message);
    this.name = "ProviderUnavailableError";
  }
}

type RunnerInput = {
  readonly executable: string;
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly signal?: AbortSignal;
  readonly timeoutMs: number;
  readonly outputCeilingBytes: number;
  readonly resultPath: string;
  readonly onOutput: (source: "stdout" | "stderr", chunk: string) => void;
  readonly writeResult: (value: string) => void;
};

export type WhisperProcessRunner = (input: RunnerInput) => Promise<{
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly elapsedMs: number;
  readonly peakRssBytes: number | null;
}>;

type AttestOverride = () => Promise<{
  available: boolean;
  reason: string | null;
}>;

export type WhisperTranscription = {
  readonly finalText: string;
  readonly elapsedMs: number;
  readonly peakRssBytes: number | null;
  readonly providerId: typeof PROVIDER_ID;
  readonly outputBytes: number;
};

function sha256(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

type RuntimeInventoryEntry = {
  readonly mode: string;
  readonly path: string;
  readonly sha256: string;
  readonly size: number;
};

function containedBy(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!path.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`))
  );
}

export function verifyRuntimeInventory(
  runtimeRoot: string,
  inventoryPath: string,
): boolean {
  try {
    const root = fs.realpathSync(runtimeRoot);
    const parsed: unknown = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
    if (!Array.isArray(parsed) || parsed.length === 0) return false;
    const seen = new Set<string>();
    for (const candidate of parsed) {
      if (!candidate || typeof candidate !== "object") return false;
      const entry = candidate as Partial<RuntimeInventoryEntry>;
      if (
        typeof entry.path !== "string" ||
        entry.path.length === 0 ||
        entry.path.includes("\\") ||
        path.posix.isAbsolute(entry.path) ||
        path.posix.normalize(entry.path) !== entry.path ||
        entry.path.split("/").includes("..") ||
        seen.has(entry.path) ||
        typeof entry.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(entry.sha256) ||
        typeof entry.size !== "number" ||
        !Number.isSafeInteger(entry.size) ||
        entry.size < 0 ||
        typeof entry.mode !== "string" ||
        !/^0o[0-7]{3}$/.test(entry.mode)
      )
        return false;
      seen.add(entry.path);
      const unresolved = path.resolve(root, entry.path);
      if (!containedBy(root, unresolved)) return false;
      const metadata = fs.lstatSync(unresolved);
      if (!metadata.isFile() || metadata.isSymbolicLink()) return false;
      const resolved = fs.realpathSync(unresolved);
      if (!containedBy(root, resolved)) return false;
      const mode = `0o${(metadata.mode & 0o777).toString(8).padStart(3, "0")}`;
      if (
        metadata.size !== entry.size ||
        mode !== entry.mode ||
        sha256(resolved) !== entry.sha256
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}

function regularNoSymlink(file: string): boolean {
  const stat = fs.lstatSync(file);
  return stat.isFile() && !stat.isSymbolicLink();
}

function noSymlinks(root: string): boolean {
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const name of fs.readdirSync(current)) {
      const entry = path.join(current, name);
      const stat = fs.lstatSync(entry);
      if (stat.isSymbolicLink()) return false;
      if (stat.isDirectory()) stack.push(entry);
    }
  }
  return true;
}

function attestation(
  available: boolean,
  reason: string | null,
): VoiceProviderAttestation {
  return VoiceProviderAttestationSchema.parse({
    schema: "aiw.stt-attestation/0.15",
    providerId: PROVIDER_ID,
    implementation: "whisper-cli",
    processing: "local-process",
    language: "en",
    available,
    reason,
    partials: "unavailable",
    retention: "volatile-until-text-send",
    rawAudioLeavesMachine: false,
  });
}

async function defaultRunner(input: RunnerInput) {
  const started = performance.now();
  return await new Promise<{
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    elapsedMs: number;
    peakRssBytes: number | null;
  }>((resolve, reject) => {
    const child = spawn(input.executable, [...input.argv], {
      cwd: input.cwd,
      env: input.env,
      shell: false,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let bytes = 0;
    let terminal = false;
    let terminalError: Error | undefined;
    let peakRssBytes = 0;
    let killTimer: NodeJS.Timeout | undefined;
    const rssTimer = setInterval(() => {
      if (!child.pid) return;
      try {
        const status = fs.readFileSync(`/proc/${child.pid}/status`, "utf8");
        const kib = Number(/^VmRSS:\s+(\d+)\s+kB$/m.exec(status)?.[1] ?? 0);
        peakRssBytes = Math.max(peakRssBytes, kib * 1024);
      } catch {
        // Short-lived process may exit between samples.
      }
    }, 10);
    rssTimer.unref();
    const terminate = () => {
      if (!child.pid || child.killed) return;
      try {
        process.kill(
          process.platform === "win32" ? child.pid : -child.pid,
          "SIGTERM",
        );
      } catch {
        // Process already exited.
      }
      killTimer = setTimeout(() => {
        try {
          if (child.pid)
            process.kill(
              process.platform === "win32" ? child.pid : -child.pid,
              "SIGKILL",
            );
        } catch {
          // Process already exited.
        }
      }, 250);
      killTimer.unref();
    };
    const timeout = setTimeout(terminate, input.timeoutMs);
    timeout.unref();
    const abort = () => terminate();
    input.signal?.addEventListener("abort", abort, { once: true });
    const output = (source: "stdout" | "stderr", chunk: Buffer) => {
      bytes += chunk.byteLength;
      if (bytes > input.outputCeilingBytes) {
        terminate();
        terminalError ??= new VoiceProviderError(
          "output-ceiling",
          "Provider output exceeded 1 MiB.",
        );
        return;
      }
      input.onOutput(source, chunk.toString("utf8"));
    };
    child.stdout.on("data", (chunk: Buffer) => output("stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => output("stderr", chunk));
    child.once("error", (error) => {
      clearInterval(rssTimer);
      if (!terminal) {
        terminal = true;
        reject(error);
      }
    });
    child.once("close", (exitCode, signal) => {
      clearTimeout(timeout);
      clearInterval(rssTimer);
      if (killTimer) clearTimeout(killTimer);
      input.signal?.removeEventListener("abort", abort);
      if (terminal) return;
      terminal = true;
      if (terminalError) reject(terminalError);
      else
        resolve({
          exitCode,
          signal,
          elapsedMs: performance.now() - started,
          peakRssBytes: peakRssBytes || null,
        });
    });
  });
}

function transcriptText(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const record = raw as Record<string, unknown>;
  const transcription = record.transcription;
  if (!Array.isArray(transcription)) return "";
  return transcription
    .map((entry) =>
      entry &&
      typeof entry === "object" &&
      typeof (entry as { text?: unknown }).text === "string"
        ? (entry as { text: string }).text
        : "",
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16_384);
}

export class WhisperCliProvider {
  readonly #providerRoot: string | undefined;
  readonly #tempRoot: string;
  readonly #runner: WhisperProcessRunner;
  readonly #attestOverride: AttestOverride | undefined;
  #active = false;
  #queued = false;

  constructor(options: {
    readonly providerRoot?: string;
    readonly tempRoot?: string;
    readonly runner?: WhisperProcessRunner;
    readonly attest?: AttestOverride;
  }) {
    this.#providerRoot = options.providerRoot;
    this.#tempRoot =
      options.tempRoot ?? path.join(os.tmpdir(), "agentintersect-world-voice");
    this.#runner = options.runner ?? defaultRunner;
    this.#attestOverride = options.attest;
    fs.mkdirSync(this.#tempRoot, { recursive: true, mode: 0o700 });
    fs.chmodSync(this.#tempRoot, 0o700);
    for (const entry of fs.readdirSync(this.#tempRoot))
      if (entry.startsWith("utterance-"))
        fs.rmSync(path.join(this.#tempRoot, entry), {
          recursive: true,
          force: true,
        });
  }

  async attest(): Promise<VoiceProviderAttestation> {
    if (this.#attestOverride) {
      const result = await this.#attestOverride();
      return attestation(result.available, result.reason);
    }
    if (!this.#providerRoot)
      return attestation(
        false,
        "Provider staging root is not explicitly configured.",
      );
    try {
      const root = fs.realpathSync(this.#providerRoot);
      if (!fs.statSync(root).isDirectory() || !noSymlinks(root))
        return attestation(
          false,
          "Provider inventory is not a regular-file-only tree.",
        );
      const cli = path.join(root, CLI_RELATIVE);
      const model = path.join(root, MODEL_RELATIVE);
      const inventory = path.join(root, INVENTORY_RELATIVE);
      const provenanceFile = path.join(root, PROVENANCE_RELATIVE);
      if (![cli, model, inventory, provenanceFile].every(regularNoSymlink))
        return attestation(false, "Pinned provider files are missing.");
      if (
        sha256(cli) !== CLI_SHA256 ||
        sha256(model) !== MODEL_SHA256 ||
        fs.statSync(model).size !== MODEL_SIZE ||
        sha256(inventory) !== INVENTORY_SHA256 ||
        !verifyRuntimeInventory(path.join(root, "runtime-extracted"), inventory)
      )
        return attestation(false, "Pinned provider hash or size mismatch.");
      const provenance = JSON.parse(
        fs.readFileSync(provenanceFile, "utf8"),
      ) as Record<string, unknown>;
      const cliPin = provenance.whisper_cli as
        Record<string, unknown> | undefined;
      const modelPin = provenance.model as Record<string, unknown> | undefined;
      if (
        provenance.schema !== "aiw.phase15-stt-artifact-verification/1" ||
        provenance.runtime_inventory_sha256 !== INVENTORY_SHA256 ||
        cliPin?.sha256 !== CLI_SHA256 ||
        modelPin?.sha256 !== MODEL_SHA256 ||
        provenance.raw_audio_stored !== false ||
        provenance.credentials_stored !== false
      )
        return attestation(false, "Provider provenance mismatch.");
      return attestation(true, null);
    } catch {
      return attestation(false, "Pinned provider could not be re-attested.");
    }
  }

  async transcribe(
    wav: Uint8Array,
    options: { readonly language?: string; readonly signal?: AbortSignal } = {},
  ): Promise<WhisperTranscription> {
    if ((options.language ?? "en") !== "en")
      throw new VoiceProviderError(
        "non-english",
        "Only English speech is available.",
      );
    try {
      inspectPcm16Wav(wav);
    } catch (error) {
      throw new VoiceProviderError(
        "invalid-audio",
        error instanceof Error ? error.message : "Voice WAV is invalid.",
      );
    }
    if (!(await this.attest()).available) throw new ProviderUnavailableError();
    if (options.signal?.aborted)
      throw new VoiceProviderError("cancelled", "Transcription was cancelled.");
    if (this.#active) {
      if (this.#queued)
        throw new VoiceProviderError(
          "queue-full",
          "The local speech queue is full.",
        );
      this.#queued = true;
      try {
        await new Promise<void>((resolve, reject) => {
          const poll = setInterval(() => {
            if (!this.#active) {
              clearInterval(poll);
              options.signal?.removeEventListener("abort", abort);
              resolve();
            }
          }, 2);
          const abort = () => {
            clearInterval(poll);
            reject(
              new VoiceProviderError(
                "cancelled",
                "Queued transcription was cancelled.",
              ),
            );
          };
          options.signal?.addEventListener("abort", abort, { once: true });
        });
      } finally {
        this.#queued = false;
      }
    }
    this.#active = true;
    const directory = fs.mkdtempSync(path.join(this.#tempRoot, "utterance-"));
    fs.chmodSync(directory, 0o700);
    const inputPath = path.join(directory, "input.wav");
    const outputBase = path.join(directory, "result");
    const resultPath = `${outputBase}.json`;
    try {
      fs.writeFileSync(inputPath, wav, { mode: 0o600, flag: "wx" });
      const providerRoot = fs.realpathSync(
        this.#providerRoot ?? this.#tempRoot,
      );
      const executable = path.join(providerRoot, CLI_RELATIVE);
      const model = path.join(providerRoot, MODEL_RELATIVE);
      let capturedBytes = 0;
      const result = await this.#runner({
        executable,
        argv: [
          "--model",
          model,
          "--file",
          inputPath,
          "--language",
          "en",
          "--threads",
          "8",
          "--processors",
          "1",
          "--no-gpu",
          "--no-fallback",
          "--no-prints",
          "--no-timestamps",
          "--output-json-full",
          "--output-file",
          outputBase,
        ],
        cwd: directory,
        env: {
          PATH: "/usr/bin:/bin",
          HOME: directory,
          LD_LIBRARY_PATH: path.dirname(executable),
          LC_ALL: "C",
        },
        ...(options.signal ? { signal: options.signal } : {}),
        timeoutMs: MAX_STT_MS,
        outputCeilingBytes: MAX_PROVIDER_OUTPUT_BYTES,
        resultPath,
        onOutput: (_source, chunk) => {
          capturedBytes += Buffer.byteLength(chunk);
          if (capturedBytes > MAX_PROVIDER_OUTPUT_BYTES)
            throw new VoiceProviderError(
              "output-ceiling",
              "Provider output exceeded 1 MiB.",
            );
        },
        writeResult: (value) =>
          fs.writeFileSync(resultPath, value, { mode: 0o600 }),
      });
      if (options.signal?.aborted)
        throw new VoiceProviderError(
          "cancelled",
          "Transcription was cancelled.",
        );
      if (
        result.elapsedMs > MAX_STT_MS ||
        result.signal === "SIGTERM" ||
        result.signal === "SIGKILL"
      )
        throw new VoiceProviderError(
          "timeout",
          "Local transcription exceeded 10 seconds.",
        );
      if (result.exitCode !== 0)
        throw new VoiceProviderError(
          "provider-failed",
          "Local transcription failed.",
        );
      const stat = fs.statSync(resultPath);
      if (capturedBytes + stat.size > MAX_PROVIDER_OUTPUT_BYTES)
        throw new VoiceProviderError(
          "output-ceiling",
          "Combined provider output exceeded 1 MiB.",
        );
      const finalText = transcriptText(
        JSON.parse(fs.readFileSync(resultPath, "utf8")),
      );
      if (!finalText)
        throw new VoiceProviderError(
          "empty-transcript",
          "No lexical transcript was produced.",
        );
      return {
        finalText,
        elapsedMs: result.elapsedMs,
        peakRssBytes: result.peakRssBytes,
        providerId: PROVIDER_ID,
        outputBytes: capturedBytes + stat.size,
      };
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
      this.#active = false;
    }
  }
}
