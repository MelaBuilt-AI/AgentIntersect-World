import { expect, it, vi } from "vitest";
it("keeps discovery, attachment and completion as separate explicit requests", async () => {
  const client = await import("../src/world-entry/agent-setup-client.js").catch(
    () => null,
  );
  expect(client?.loadAgentSetup).toBeTypeOf("function");
  if (!client) return;
  const state = {
    schema: "aiw.agent-setup/1",
    completed: false,
    registrations: [],
  };
  const fetcher = vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify({ ok: true, data: state })),
  );
  expect(await client.loadAgentSetup(fetcher)).toEqual(state);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await client.discoverSetupAgents(fetcher);
  expect(fetcher.mock.calls[1]).toEqual([
    "/api/agent-setup/discover",
    expect.objectContaining({ method: "POST", body: "{}" }),
  ]);
  await client.attachSetupAgent(
    {
      installationId: "installation",
      identityId: "work",
      displayName: "My Agent",
    },
    fetcher,
  );
  expect(fetcher.mock.calls[2]).toEqual([
    "/api/agent-setup/attach",
    expect.objectContaining({
      body: JSON.stringify({
        installationId: "installation",
        identityId: "work",
        displayName: "My Agent",
      }),
    }),
  ]);
  expect(
    fetcher.mock.calls.some((call) => call[0] === "/api/agent-setup/complete"),
  ).toBe(false);
});
