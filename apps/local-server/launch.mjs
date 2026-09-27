#!/usr/bin/env node
// Installed browser-based World: one process owns both loopback listeners.
import Fastify from "fastify";
import staticFiles from "@fastify/static";
import proxy from "@fastify/http-proxy";
import { access, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.AIW_APP_PORT || 3771);
const backendPort = Number(process.env.AIW_PORT || 3770);
if (
  ![port, backendPort].every(
    (p) => Number.isInteger(p) && p > 0 && p <= 65535,
  ) ||
  port === backendPort
)
  throw Error("Use two distinct valid AIW_APP_PORT and AIW_PORT values.");
const origin = `http://127.0.0.1:${port}`;
const state = resolve(
  process.env.AIW_DATA_DIR ||
    (process.platform === "win32"
      ? join(
          process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"),
          "AgentIntersect-World",
        )
      : join(
          process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"),
          "agentintersect-world",
        )),
);
const web = resolve(here, "../web/dist");
await access(join(web, "index.html"));
await mkdir(state, { recursive: true });
Object.assign(process.env, {
  AIW_HOST: "127.0.0.1",
  AIW_NETWORK_SCOPE: "loopback",
  AIW_PORT: String(backendPort),
  AIW_PRESENTATION_ALLOWED_ORIGIN: origin,
  AIW_PRESENTATION_ALLOWED_HOST: `127.0.0.1:${port}`,
  AIW_PRESENTATION_DATA_DIR: join(state, "presentation"),
  AIW_AGENT_SESSION_DATA_DIR: join(state, "agent-sessions"),
  AIW_PHASE17_STATE_DIR: join(state, "diagnostics"),
});
const frontend = Fastify({ logger: false });
frontend.addHook("onRequest", async (request, reply) => {
  if (
    request.headers.host !== `127.0.0.1:${port}` ||
    (request.headers.origin && request.headers.origin !== origin)
  )
    return reply.code(403).send({ error: "Local World origin required" });
});
await frontend.register(proxy, {
  upstream: `http://127.0.0.1:${backendPort}`,
  prefix: "/api",
  websocket: true,
  wsServerOptions: {
    verifyClient: ({ origin: requestOrigin, req }, done) =>
      done(
        requestOrigin === origin && req.headers.host === `127.0.0.1:${port}`,
        403,
      ),
  },
  wsClientOptions: {
    rewriteRequestHeaders: (_headers, request) => ({
      origin: request.headers.origin,
      host: `127.0.0.1:${port}`,
    }),
  },
  replyOptions: {
    rewriteRequestHeaders: (_request, headers) => ({
      ...headers,
      host: `127.0.0.1:${port}`,
    }),
  },
});
await frontend.register(staticFiles, {
  root: web,
  dotfiles: "deny",
  index: "index.html",
  redirect: false,
});
let input;
const close = async () => {
  input?.close();
  process.stdin.pause();
  process.stdin.unref?.();
  await frontend.close();
};
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    void close();
  });
try {
  await frontend.listen({ host: "127.0.0.1", port });
  await import("./dist/index.js");
  if (process.exitCode) throw Error("World backend did not start.");
  const health = await fetch(`http://127.0.0.1:${backendPort}/health`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!health.ok) throw Error("World backend is not ready.");
  console.log(
    `Open World: ${origin}\nKeep this window open. Type quit and Enter (or Ctrl+C) to stop World.\nYour saved state is retained when the application closes.`,
  );
  input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  input.on("line", (line) => {
    if (line.trim().toLowerCase() === "quit") process.emit("SIGTERM");
  });
  if (!process.argv.includes("--no-open")) {
    const command = process.platform === "win32" ? "explorer.exe" : "xdg-open";
    const opener = spawn(command, [origin], {
      stdio: "ignore",
      detached: true,
      windowsHide: true,
    });
    opener.on("error", () =>
      console.log("Open the URL above in your browser."),
    );
    opener.unref();
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "World could not start.",
  );
  process.exitCode = 1;
  process.emit("SIGTERM");
  await close();
}
