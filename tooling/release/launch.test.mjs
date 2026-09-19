import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
async function port() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const p = server.address().port;
  await new Promise((r) => server.close(r));
  return p;
}
test(
  "installed-shape launcher serves real UI/API, refuses foreign origin and releases both ports",
  { timeout: 30000 },
  async () => {
    const front = await port(),
      back = await port();
    const state = await mkdtemp(join(tmpdir(), "aiw-package-state-"));
    const child = spawn(
      process.execPath,
      [resolve("apps/local-server/launch.mjs"), "--no-open"],
      {
        env: {
          ...process.env,
          AIW_APP_PORT: String(front),
          AIW_PORT: String(back),
          AIW_DATA_DIR: state,
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    let output = "";
    child.stdout.on("data", (b) => {
      output += b;
    });
    child.stderr.on("data", (b) => {
      output += b;
    });
    try {
      const deadline = Date.now() + 15000;
      while (
        !output.includes("Open World:") &&
        child.exitCode === null &&
        Date.now() < deadline
      )
        await new Promise((r) => setTimeout(r, 50));
      assert.match(output, /Open World:/, output);
      const origin = `http://127.0.0.1:${front}`;
      const page = await fetch(origin);
      assert.equal(page.status, 200);
      assert.match(await page.text(), /AgentIntersect/);
      const health = await fetch(origin + "/api/health");
      assert.equal(health.status, 200);
      assert.equal(
        (await health.json()).service,
        "agentintersect-world-local-server",
      );
      const foreign = await fetch(origin + "/api/health", {
        headers: { Origin: "https://untrusted.example" },
      });
      assert.equal(foreign.status, 403);
      const hidden = await fetch(origin + "/.env");
      assert.equal(hidden.status, 403);
      const repository = join(state, "sample-repository");
      await mkdir(repository);
      await writeFile(
        join(repository, "sample.ts"),
        "export const sample = 1;\n",
      );
      const started = await fetch(origin + "/api/repository-indexes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "package-smoke-index",
          origin,
        },
        body: JSON.stringify({ rootPath: repository }),
      });
      assert.ok(started.ok);
      const operation = (await started.json()).data;
      let status;
      for (let i = 0; i < 100; i++) {
        status = (
          await (
            await fetch(origin + "/api/repository-indexes/" + operation.id)
          ).json()
        ).data.status;
        if (status !== "running") break;
        await new Promise((r) => setTimeout(r, 50));
      }
      assert.equal(status, "succeeded");
      const presentation = await fetch(origin + "/api/presentation/status", {
        headers: { origin },
      });
      assert.equal(presentation.status, 200);
      const documentId = (await presentation.json()).data.documentId;
      const issued = await fetch(origin + "/api/presentation/tickets", {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      assert.equal(issued.status, 201);
      const ticket = (await issued.json()).data.ticket;
      const WebSocket = createRequire(
        resolve("apps/local-server/package.json"),
      )("ws");
      const socket = new WebSocket(
        `ws://127.0.0.1:${front}/api/presentation-sync/${documentId}?ticket=${ticket}`,
        { origin },
      );
      try {
        const [message] = await once(socket, "message", {
          signal: AbortSignal.timeout(5000),
        });
        assert.ok(
          message.byteLength > 0,
          "Real presentation sync payload arrives through proxy",
        );
      } finally {
        socket.close();
        await once(socket, "close");
      }
      child.stdin.write("quit\n");
      await once(child, "exit");
      assert.equal(child.exitCode, 0, output);
      for (const p of [front, back])
        await assert.rejects(
          fetch(`http://127.0.0.1:${p}/health`, {
            signal: AbortSignal.timeout(1000),
          }),
        );
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
        await once(child, "exit");
      }
      await rm(state, { recursive: true, force: true });
    }
  },
);
