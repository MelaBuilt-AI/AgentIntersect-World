import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";

import { loadLocalServerConfig } from "@agentintersect-world/config/node";

import { createLocalServer } from "../src/server.js";

const ORIGIN = "http://127.0.0.1:45173";
const HOST = "127.0.0.1:45173";
const servers: ReturnType<typeof createLocalServer>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  delete process.env.AIW_ADMIN_SHELL_NO_SUDO;
});

async function start() {
  const server = createLocalServer({
    config: loadLocalServerConfig({
      AIW_PORT: "43771",
      AIW_PRESENTATION_ALLOWED_ORIGIN: ORIGIN,
      AIW_PRESENTATION_ALLOWED_HOST: HOST,
    }),
  });
  servers.push(server);
  await server.listen({ host: "127.0.0.1", port: 0 });
  const address = server.server.address();
  if (!address || typeof address === "string") throw new Error("no address");
  return { server, port: address.port };
}

const open = (url: string, origin = ORIGIN) =>
  new WebSocket(url, { headers: { origin, host: HOST } });

describe("in-World admin shells", () => {
  it("streams a real PTY shell through the helper", async () => {
    process.env.AIW_ADMIN_SHELL_NO_SUDO = "1";
    const { server, port } = await start();
    const created = await server.inject({
      method: "POST",
      url: "/admin-shells",
      headers: { origin: ORIGIN, host: HOST },
      payload: { kind: "terminal" },
    });
    expect(created.statusCode).toBe(201);
    const { websocketPath, ticket, elevation } = created.json().data;
    expect(elevation).toBe("sudo");
    const socket = open(
      `ws://127.0.0.1:${port}${websocketPath}?ticket=${ticket}`,
    );
    let output = "";
    const marker = new Promise<void>((resolve) =>
      socket.on("message", (raw) => {
        const message = JSON.parse(String(raw));
        if (message.type === "output") output += message.data;
        if (output.includes("AIW_MARK_42")) resolve();
      }),
    );
    await new Promise((resolve) => socket.on("open", resolve));
    socket.send(JSON.stringify({ type: "resize", cols: 90, rows: 20 }));
    const typed = setInterval(
      () =>
        socket.send(
          JSON.stringify({ type: "input", data: "echo AIW_MARK_$((6*7))\r" }),
        ),
      500,
    );
    await marker.finally(() => clearInterval(typed));
    socket.close();
  }, 20_000);

  it("refuses other origins, reused tickets and unknown sessions", async () => {
    const { server, port } = await start();
    const foreign = await server.inject({
      method: "POST",
      url: "/admin-shells",
      headers: { origin: "http://evil.example", host: HOST },
      payload: { kind: "powershell" },
    });
    expect(foreign.statusCode).toBe(403);
    const { websocketPath, ticket } = (
      await server.inject({
        method: "POST",
        url: "/admin-shells",
        headers: { origin: ORIGIN, host: HOST },
        payload: { kind: "powershell" },
      })
    ).json().data;
    const status = (socket: WebSocket) =>
      new Promise<number>((resolve) =>
        socket.on("unexpected-response", (_request, response) =>
          resolve(response.statusCode ?? 0),
        ),
      );
    const base = `ws://127.0.0.1:${port}${websocketPath}`;
    expect(
      await status(open(`${base}?ticket=${ticket}`, "http://evil.example")),
    ).toBe(403);
    expect(await status(open(`${base}?ticket=wrong`))).toBe(401);
    expect(
      await status(
        open(
          `ws://127.0.0.1:${port}/admin-shell-helper/shell_00000000-0000-0000-0000-000000000000?token=x`,
        ),
      ),
    ).toBe(401);
  });
});
