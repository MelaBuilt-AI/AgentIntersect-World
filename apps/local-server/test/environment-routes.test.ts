import Fastify from "fastify";
import { expect, it, vi } from "vitest";
import { ENVIRONMENT_PRESETS } from "@agentintersect-world/world-schema/environment";
import { registerEnvironmentRoutes } from "../src/environment-routes.js";
import type { AgentSessionGateway } from "../src/agent-sessions.js";

it("discovers MCP tools, validates data-only proposals and propagates HTTP request cancellation", async () => {
  const server = Fastify();
  const sessionId = "11111111-1111-4111-8111-111111111111";
  const generateEnvironment = vi.fn(
    async (_id: string, _body: unknown, signal: AbortSignal) => {
      expect(signal.aborted).toBe(false);
      return {
        recipe: ENVIRONMENT_PRESETS[1]!.recipe,
        summary: "Preview ready",
      };
    },
  );
  const gateway = {
    environmentCapability: vi.fn(() => ({
      available: true,
      sessionId,
      reason: null,
    })),
    generateEnvironment,
  } as unknown as AgentSessionGateway;
  registerEnvironmentRoutes(server, gateway, {
    success: (_req, data) => ({ ok: true, data }),
    error: () => ({ ok: false }),
  });
  const url = `/agent-sessions/${sessionId}/environment`;
  try {
    const capability = await server.inject({ url });
    expect(capability.json().data.available).toBe(true);
    const call = (method: string, params?: unknown) =>
      server.inject({
        method: "POST",
        url: url + "/mcp",
        payload: {
          jsonrpc: "2.0",
          id: 1,
          method,
          ...(params ? { params } : {}),
        },
      });
    const listed = await call("tools/list");
    expect(
      listed.json().result.tools.map((t: { name: string }) => t.name),
    ).toEqual(["describe_environment", "propose_environment"]);
    const discovered = await call("tools/call", {
      name: "describe_environment",
      arguments: {},
    });
    expect(discovered.json().result.content[0].text).toContain("winding_paths");
    const accepted = await call("tools/call", {
      name: "propose_environment",
      arguments: { recipe: ENVIRONMENT_PRESETS[1]!.recipe },
    });
    expect(accepted.json().result.structuredContent.recipe).toHaveProperty(
      "sky",
    );
    const refused = await call("tools/call", {
      name: "propose_environment",
      arguments: {
        recipe: { ...ENVIRONMENT_PRESETS[1]!.recipe, script: "evil" },
      },
    });
    expect(refused.json().error.code).toBe(-32602);
    expect(generateEnvironment).not.toHaveBeenCalled();
    const generated = await server.inject({
      method: "POST",
      url,
      payload: { description: "World", current: null },
    });
    expect(generated.json().data.summary).toBe("Preview ready");
    expect(generateEnvironment).toHaveBeenCalledOnce();
  } finally {
    await server.close();
  }
});
