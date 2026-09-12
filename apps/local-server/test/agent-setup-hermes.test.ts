import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { HermesSessionAdapter } from "../src/agent-sessions.js";
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
