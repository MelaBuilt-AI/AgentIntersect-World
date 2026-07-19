import { describe, expect, it, vi } from "vitest";

import { PHASE5_WORLD_FIXTURE } from "../src/fixtures/phase5-world.js";
import { safeObjectPath } from "../src/repository/repository-browser-model.js";
import { getCurrentWorld, getWorldTiles } from "../src/world-client.js";

const envelope = (data: unknown) => ({
  ok: true,
  data,
  meta: {
    correlationId: "a5cf11a9-754e-4d76-946b-55a77c0eef28",
    schema: "aiw.api/0.3",
  },
});

describe("typed World browser clients", () => {
  it("validates current snapshot and bounded tile responses", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(envelope({ snapshot: PHASE5_WORLD_FIXTURE })),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            envelope({
              schema: PHASE5_WORLD_FIXTURE.schema,
              snapshotId: PHASE5_WORLD_FIXTURE.snapshotId,
              query: {
                lod: 0,
                minX: 0,
                maxX: 15,
                minZ: 0,
                maxZ: 15,
                limit: 128,
              },
              tiles: PHASE5_WORLD_FIXTURE.tiles,
            }),
          ),
        ),
      );
    expect((await getCurrentWorld(fetcher)).status).toBe("ok");
    expect((await getWorldTiles(undefined, fetcher)).status).toBe("ok");
    expect(fetcher.mock.calls[1]?.[0]).toContain("/world/tiles?lod=0");
  });

  it("rejects path-leaking or malformed responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify(
          envelope({
            snapshot: { ...PHASE5_WORLD_FIXTURE, rootPath: "/private" },
          }),
        ),
      ),
    );
    expect(await getCurrentWorld(fetcher)).toEqual({
      status: "error",
      message: "Invalid local server response",
    });
  });

  it.each([
    "\\\\server\\share\\private\\repo\\file.ts",
    "\\home\\operator\\private\\file.ts",
    "file:///home/operator/private/file.ts",
  ])("redacts a typed nested absolute object path %s", async (path) => {
    const fileIndex = PHASE5_WORLD_FIXTURE.objects.findIndex(
      (object) => object.kind === "file",
    );
    const objects = [...PHASE5_WORLD_FIXTURE.objects];
    objects[fileIndex] = { ...objects[fileIndex]!, path };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify(
            envelope({ snapshot: { ...PHASE5_WORLD_FIXTURE, objects } }),
          ),
        ),
      );

    const result = await getCurrentWorld(fetcher);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const object = result.data.snapshot.objects[fileIndex]!;
    expect(safeObjectPath(object)).toBeNull();
  });
});
