import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type Server } from "node:net";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

async function reservePort(): Promise<{ port: number; server: Server }> {
  const server = createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("failed to reserve a port");
  }
  return { port: address.port, server };
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
}

function start(environment: Record<string, string>) {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", resolve("apps/local-server/src/index.ts")],
    {
      cwd: resolve("."),
      env: { ...process.env, ...environment },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    stderr += chunk;
  });
  return { child, stdout: () => stdout, stderr: () => stderr };
}

async function waitFor(
  condition: () => boolean,
  description: string,
  timeoutMs = 5_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
  throw new Error(`timed out waiting for ${description}`);
}

async function waitForExit(child: ChildProcessWithoutNullStreams) {
  return await new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolveExit({ code, signal }));
  });
}

describe("local-server process lifecycle", () => {
  const children: ChildProcessWithoutNullStreams[] = [];
  const reservations: Server[] = [];

  afterEach(async () => {
    for (const child of children.splice(0)) {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
    }
    await Promise.all(reservations.splice(0).map(closeServer));
  });

  it.each([
    ["loopback", "127.0.0.1", "SIGINT"],
    ["lan", "0.0.0.0", "SIGTERM"],
  ] as const)(
    "starts in %s mode, reports actual scope/URL, and shuts down cleanly",
    async (networkScope, host, signal) => {
      const reservation = await reservePort();
      await closeServer(reservation.server);
      const processResult = start({
        AIW_NETWORK_SCOPE: networkScope,
        AIW_HOST: host,
        AIW_PORT: String(reservation.port),
        ...(networkScope === "lan"
          ? {
              AIW_PRESENTATION_ALLOWED_ORIGIN: "http://192.168.1.20:45173",
              AIW_PRESENTATION_ALLOWED_HOST: "192.168.1.20:45173",
              AIW_PRESENTATION_TOKEN: "lifecycle-presentation-only",
            }
          : {}),
      });
      children.push(processResult.child);
      await waitFor(
        () => processResult.stdout().includes("ready"),
        "startup output",
      );

      expect(processResult.stdout()).toContain(
        `network scope: ${networkScope}`,
      );
      expect(processResult.stdout()).toMatch(
        new RegExp(`ready at http://[^\\s]+:${reservation.port}`),
      );
      expect(processResult.stdout()).toContain(
        `bound at ${host}:${reservation.port}`,
      );
      const configResponse = await fetch(
        `http://127.0.0.1:${reservation.port}/config`,
      );
      expect((await configResponse.json()).data).toMatchObject({
        networkScope,
        host,
      });

      const exited = waitForExit(processResult.child);
      processResult.child.kill(signal);
      await expect(exited).resolves.toEqual({ code: 0, signal: null });
      expect(processResult.stderr()).toContain(`received ${signal}; stopping`);
      await expect(
        fetch(`http://127.0.0.1:${reservation.port}/health`),
      ).rejects.toThrow();
    },
  );

  it("reports a clear real port collision and exits without disturbing the listener", async () => {
    const reservation = await reservePort();
    reservations.push(reservation.server);
    const processResult = start({
      AIW_NETWORK_SCOPE: "loopback",
      AIW_HOST: "127.0.0.1",
      AIW_PORT: String(reservation.port),
    });
    children.push(processResult.child);
    const exited = await waitForExit(processResult.child);

    expect(exited).toEqual({ code: 1, signal: null });
    expect(processResult.stderr()).toContain(
      `Port ${reservation.port} is already in use on 127.0.0.1`,
    );
    expect(reservation.server.listening).toBe(true);
  });
});
