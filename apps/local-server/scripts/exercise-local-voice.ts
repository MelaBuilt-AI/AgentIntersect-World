// Bounded native backend/provider smoke. Run with a private directory and a public test WAV.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import Fastify from "fastify";
import {
  LocalVoiceInstaller,
  WhisperCliProvider,
} from "@agentintersect-world/voice/node";
import { registerLocalVoiceSetupRoutes } from "../src/voice-routes.js";

async function main() {
  const [directory, wavPath] = process.argv.slice(2);
  assert(
    directory && wavPath,
    "Pass installation directory and English test WAV path",
  );
  const installer = new LocalVoiceInstaller({ directory });
  const before = await installer.status();
  const server = Fastify();
  registerLocalVoiceSetupRoutes(server, installer, {
    success: (_request, data) => ({ ok: true, data }),
    failure: (_request, code, message) => ({
      ok: false,
      error: { code, message },
    }),
  });
  const url = await server.listen({ host: "127.0.0.1", port: 0 });
  try {
    const denied = await fetch(`${url}/voice/setup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ consent: false }),
    });
    assert.equal(denied.status, 400);
    const install = await fetch(`${url}/voice/setup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ consent: true }),
    });
    const result = await install.json();
    assert.equal(install.status, 200, JSON.stringify(result));
    assert.equal(result.data.state, "ready");
    assert.equal(
      (await new LocalVoiceInstaller({ directory }).status()).state,
      "ready",
    );
    const provider = new WhisperCliProvider({
      managedDirectory: directory,
      tempRoot: path.join(directory, "volatile"),
    });
    assert.equal((await provider.attest()).available, true);
    const transcription = await provider.transcribe(await fs.readFile(wavPath));
    assert.match(transcription.finalText, /ask not/i);
    assert.equal(
      (await fs.readdir(path.join(directory, "volatile"))).length,
      0,
    );
    console.log(
      JSON.stringify(
        {
          platform: process.platform,
          arch: process.arch,
          node: process.version,
          before: before.state,
          consentGate: denied.status,
          setup: result.data,
          restartReady: true,
          transcription,
          volatileFiles: 0,
          scope:
            "native Fastify setup routes and real CLI; not full harness or microphone acceptance",
        },
        null,
        2,
      ),
    );
  } finally {
    await server.close();
  }
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
