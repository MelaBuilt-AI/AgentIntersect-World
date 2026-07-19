import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";

import { HealthResponseSchema } from "@agentintersect-world/world-schema";

async function disposablePort(): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close();
        reject(new Error("failed to allocate a disposable port"));
        return;
      }
      probe.close((error) =>
        error ? reject(error) : resolvePort(address.port),
      );
    });
  });
}

async function waitFor(url: string, timeoutMs = 20_000): Promise<Response> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`timed out waiting for ${url}`, { cause: lastError });
}

async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await new Promise<void>((resolveExit) => {
    const forceTimeout = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
    }, 5_000);
    const absoluteTimeout = setTimeout(resolveExit, 7_000);
    child.once("exit", () => {
      clearTimeout(forceTimeout);
      clearTimeout(absoluteTimeout);
      resolveExit();
    });
  });
}

const serverPort = await disposablePort();
let webPort = await disposablePort();
while (webPort === serverPort) webPort = await disposablePort();
const children: ChildProcess[] = [];

try {
  const server = spawn(
    process.execPath,
    [resolve("apps/local-server/dist/index.js")],
    {
      cwd: resolve("."),
      env: {
        ...process.env,
        AIW_HOST: "127.0.0.1",
        AIW_PORT: String(serverPort),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  children.push(server);

  const web = spawn(
    process.execPath,
    [
      resolve("node_modules/vite/bin/vite.js"),
      "preview",
      "apps/web",
      "--config",
      "apps/web/vite.config.ts",
      "--host",
      "127.0.0.1",
      "--port",
      String(webPort),
      "--strictPort",
    ],
    {
      cwd: resolve("."),
      env: {
        ...process.env,
        AIW_LOCAL_SERVER_URL: `http://127.0.0.1:${serverPort}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  children.push(web);

  const healthResponse = await waitFor(`http://127.0.0.1:${serverPort}/health`);
  const health = HealthResponseSchema.parse(await healthResponse.json());
  const correlationHeader = healthResponse.headers.get("x-correlation-id");
  if (correlationHeader !== health.correlationId)
    throw new Error("health correlation header mismatch");

  const webResponse = await waitFor(`http://127.0.0.1:${webPort}/`);
  const html = await webResponse.text();
  if (!html.includes("AgentIntersect World"))
    throw new Error("built web page identity is missing");

  process.stdout.write(
    `Smoke passed: health schema valid and built web served on disposable ports ${serverPort}/${webPort}.\n`,
  );
} finally {
  await Promise.all(children.reverse().map(stop));
}
