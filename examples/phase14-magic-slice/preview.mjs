import { createServer } from "node:http";

import { greeting } from "./src/greeting.mjs";

const expectedArguments = ["--host", "127.0.0.1", "--port", "0"];
if (process.argv.slice(2).join("\u0000") !== expectedArguments.join("\u0000")) {
  process.stderr.write(
    "Phase 14 preview requires --host 127.0.0.1 --port 0.\n",
  );
  process.exit(2);
}

const health = JSON.stringify({ ok: true, schema: "aiw.phase14-preview/1" });
const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "content-length": Buffer.byteLength(health),
      "cache-control": "no-store",
    });
    response.end(health);
    return;
  }
  if (request.method === "GET" && request.url === "/") {
    const body = `${greeting}\n`;
    response.writeHead(200, {
      "content-type": "text/plain; charset=utf-8",
      "content-length": Buffer.byteLength(body),
      "cache-control": "no-store",
    });
    response.end(body);
    return;
  }
  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Not found\n");
});

const listen = () =>
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      process.stderr.write("Preview did not receive a TCP address.\n");
      process.exitCode = 1;
      return;
    }
    process.stdout.write(
      `${JSON.stringify({
        schema: "aiw.phase14-preview-ready/1",
        host: "127.0.0.1",
        port: address.port,
        pid: process.pid,
      })}\n`,
    );
  });

if (process.env.AIW_PHASE14_PREVIEW_MODE === "hang-startup") {
  setInterval(() => undefined, 1_000);
  await new Promise(() => undefined);
} else {
  listen();
}

const stop = () => {
  server.close((error) => {
    if (error) process.stderr.write(`${error.message}\n`);
    process.exit(error ? 1 : 0);
  });
};
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
