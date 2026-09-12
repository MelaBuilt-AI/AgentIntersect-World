import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { HermesSessionAdapter } from "../src/agent-sessions.js";
it("attests selected-environment plugin metadata without a local-path shortcut", async () => {
  const adapter = new HermesSessionAdapter({
    baseUrl: "http://127.0.0.1:8642",
    apiKey: "fixture",
    profile: "selected",
    fetch: async () =>
      new Response(
        JSON.stringify({
          api_version: "1",
          features: { session_resources: true, session_chat_streaming: true },
        }),
      ),
    pluginCapabilityReader: async () => ({
      content: JSON.stringify({
        schema: "aiw.hermes-plugin-capabilities/0.12",
        plugin: "agentintersect-world",
        version: "0.12.0",
        sameSessionArbiter: "fcntl-turn-lock-v1",
      }),
      mode: 0o600,
      size: 200,
      isFile: true,
      isSymbolicLink: false,
    }),
  });
  expect((await adapter.attest()).capabilities.sendText).toBe(true);
});

it("explicitly binds an existing profile conversation without creating, renaming or deleting it", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aiw-hermes-selected-"));
  const fetcher = vi.fn<typeof fetch>(async (url, init) => {
    expect(init?.method ?? "GET").toBe("GET");
    const pathname = new URL(String(url)).pathname;
    expect(pathname).toMatch(/^\/p\/research\//);
    return Response.json(
      pathname.endsWith("/messages")
        ? { object: "list", session_id: "native-existing", data: [] }
        : {
            id: "native-existing",
            title: "Keep original title",
            source: "discord",
          },
    );
  });
  try {
    const options = {
      baseUrl: "http://127.0.0.1:8642",
      apiKey: "fixture",
      profile: "research",
      worldOwnedDirectory: root,
      pinnedSessionRef: "native-existing",
      agentDisplayName: "World label",
      fetch: fetcher,
    };
    const adapter = new HermesSessionAdapter(options);
    const selected = await adapter.createWorldSession("world-a", "World label");
    expect(selected.rootId).toBe("native-existing");
    const restored = new HermesSessionAdapter(options);
    expect(
      await restored.attach("native-existing", { worldInstanceId: "world-a" }),
    ).toMatchObject({
      rootId: "native-existing",
      title: "Keep original title",
    });
    await expect(restored.createWorldSession("world-b")).rejects.toThrow(
      /ownership|another World/i,
    );
    await restored.endWorldSession("world-a", "native-existing");
    expect((await restored.createWorldSession("world-b")).rootId).toBe(
      "native-existing",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("creates separate profile-routed Hermes conversations and restores exact World ownership", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aiw-hermes-owned-"));
  const sessions = new Map<string, { id: string; title: string }>();
  const fetcher = vi.fn<typeof fetch>(async (url, init) => {
    const pathname = new URL(String(url)).pathname;
    expect(pathname).toMatch(/^\/p\/research\//);
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      sessions.set(body.id, body);
      return Response.json(body, { status: 201 });
    }
    const id = pathname.split("/")[5]!;
    return Response.json(
      pathname.endsWith("/messages")
        ? { object: "list", session_id: id, data: [] }
        : sessions.get(id),
    );
  });
  try {
    const options = {
      baseUrl: "http://127.0.0.1:8642",
      apiKey: "fixture-secret",
      profile: "research",
      worldOwnedDirectory: root,
      fetch: fetcher,
    };
    const adapter = new HermesSessionAdapter(options);
    expect(adapter.createWorldSession).toBeTypeOf("function");
    const first = await adapter.createWorldSession("world-a", "Research");
    const second = await adapter.createWorldSession("world-b", "Research");
    expect(first.id).not.toBe(second.id);
    const restored = new HermesSessionAdapter(options);
    expect(
      await restored.attach(first.id, { worldInstanceId: "world-a" }),
    ).toMatchObject({ rootId: first.id });
    await expect(
      restored.attach(first.id, { worldInstanceId: "world-b" }),
    ).rejects.toThrow(/ownership/i);
    expect(
      fetcher.mock.calls.filter(([, init]) => init?.method === "POST"),
    ).toHaveLength(2);
    await restored.endWorldSession("world-a", first.id);
    expect(sessions.has(first.id)).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
