import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import viteConfig from "../../web/vite.config.js";
import { CoordinationService } from "../src/coordination-service.js";
import { createLocalServer } from "../src/server.js";

describe("Phase 16 browser proxy contract", () => {
  it("uses the real Vite preview rewrite against the unprefixed server route", async () => {
    const proxy = viteConfig.preview?.proxy as
      | Record<
          string,
          {
            readonly target?: string;
            readonly rewrite?: (path: string) => string;
          }
        >
      | undefined;
    const apiProxy = proxy?.["/api"];
    expect(apiProxy?.target).toBeTypeOf("string");
    expect(apiProxy?.rewrite).toBeTypeOf("function");
    const rewritten = apiProxy?.rewrite?.("/api/coordination/snapshot");
    expect(rewritten).toBe("/coordination/snapshot");

    const coordinationService = new CoordinationService({
      directory: await mkdtemp(join(tmpdir(), "aiw-phase16-proxy-contract-")),
    });
    const server = createLocalServer({ coordinationService });
    const response = await server.inject({
      method: "GET",
      url: rewritten,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.truth).toBe("current");
    await server.close();
  });
});
