import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import { expect, it } from "vitest";
import { ENVIRONMENT_PRESETS } from "@agentintersect-world/world-schema/environment";

it("persists numbered slots across server restart and refuses silent replacement or invalid recipes", async () => {
  const api = await import("../src/environment-library.js").catch(() => null);
  expect(api, "install-local environment library routes").not.toBeNull();
  if (!api) return;
  const root = await mkdtemp(join(tmpdir(), "aiw-slots-"));
  const start = () => {
    const server = Fastify();
    api.registerEnvironmentLibraryRoutes(server, root);
    return server;
  };
  let server = start();
  const recipe = {
    ...ENVIRONMENT_PRESETS[1]!.recipe!,
    weather: {
      particles: "none",
      intensity: 0.7,
      wind: 0,
      lightning: "both",
      lightningInterval: 14,
      flashes: true,
      horizonLightning: { density: 0.9, interval: 3, elevation: 14 },
    },
  };
  try {
    expect(
      (await server.inject({ url: "/environment-library" })).json().slots,
    ).toEqual(Array(8).fill(null));
    expect(
      (
        await server.inject({
          method: "PUT",
          url: "/environment-library/3",
          payload: { recipe },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      JSON.parse(await readFile(join(root, "slot-3.json"), "utf8")),
    ).toEqual(recipe);
    await server.close();
    server = start();
    const restored = (
      await server.inject({ url: "/environment-library" })
    ).json().slots;
    expect(restored[2]).toEqual(recipe);
    expect(restored[0]).toBeNull();
    expect(
      (
        await server.inject({
          method: "PUT",
          url: "/environment-library/3",
          payload: { recipe },
        })
      ).statusCode,
    ).toBe(409);
    const replacement = { ...recipe, name: "Second World" };
    expect(
      (
        await server.inject({
          method: "PUT",
          url: "/environment-library/3",
          payload: { recipe: replacement, replace: true },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await server.inject({
          method: "PUT",
          url: "/environment-library/9",
          payload: { recipe },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await server.inject({
          method: "PUT",
          url: "/environment-library/1",
          payload: { recipe: { ...recipe, script: "no" } },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await server.inject({ method: "DELETE", url: "/environment-library/3" }))
        .statusCode,
    ).toBe(200);
    expect(
      (await server.inject({ url: "/environment-library" })).json().slots,
    ).toEqual(Array(8).fill(null));
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

it("retains the exact original prompt across restart, reads old slots and clears it on replacement", async () => {
  const { registerEnvironmentLibraryRoutes } =
    await import("../src/environment-library.js");
  const root = await mkdtemp(join(tmpdir(), "aiw-slot-prompts-"));
  const start = () => {
    const server = Fastify();
    registerEnvironmentLibraryRoutes(server, root);
    return server;
  };
  let server = start();
  const recipe = ENVIRONMENT_PRESETS[1]!.recipe!;
  const originalDescription = "  Azure dunes\nwith distant lightning ⚡  ";
  try {
    const saved = await server.inject({
      method: "PUT",
      url: "/environment-library/1",
      payload: { recipe, originalDescription },
    });
    expect(saved.statusCode).toBe(200);
    expect(
      JSON.parse(await readFile(join(root, "slot-1.json"), "utf8")),
    ).toEqual({ ...recipe, originalDescription });
    await server.inject({
      method: "PUT",
      url: "/environment-library/2",
      payload: { recipe },
    });
    await server.close();
    server = start();
    const restored = (
      await server.inject({ url: "/environment-library" })
    ).json().slots;
    expect(restored[0].originalDescription).toBe(originalDescription);
    expect(restored[1]).toEqual(recipe); // Existing recipe-only files remain valid.
    expect(
      (
        await server.inject({
          method: "PUT",
          url: "/environment-library/1",
          payload: {
            recipe,
            originalDescription: "word ".repeat(501),
            replace: true,
          },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await server.inject({
          method: "PUT",
          url: "/environment-library/1",
          payload: { recipe, replace: true },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await server.inject({ url: "/environment-library" })).json().slots[0],
    ).toEqual(recipe);
    await server.inject({ method: "DELETE", url: "/environment-library/1" });
    expect(
      (await server.inject({ url: "/environment-library" })).json().slots[0],
    ).toBeNull();
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
