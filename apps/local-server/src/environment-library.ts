import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { EnvironmentRecipeSchema } from "@agentintersect-world/world-schema/environment";

/** The configured World data root owns these slots, independently of browser origins. */
export function registerEnvironmentLibraryRoutes(
  server: FastifyInstance,
  directory: string,
) {
  const filename = (slot: number) => join(directory, `slot-${slot}.json`);
  const read = async (slot: number) => {
    try {
      return EnvironmentRecipeSchema.parse(
        JSON.parse(await readFile(filename(slot), "utf8")),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error; // A damaged saved World is not an empty slot to overwrite.
    }
  };
  let writes = Promise.resolve();
  const params = z.object({ slot: z.coerce.number().int().min(1).max(8) });
  const body = z.strictObject({
    recipe: EnvironmentRecipeSchema,
    replace: z.boolean().default(false),
  });
  server.get("/environment-library", async (_request, reply) => {
    try {
      await writes;
      return {
        slots: await Promise.all(
          Array.from({ length: 8 }, (_, i) => read(i + 1)),
        ),
      };
    } catch {
      return reply.code(503).send({
        error:
          "Custom slots could not be read. Saved files have been preserved.",
      });
    }
  });
  server.route({
    method: ["PUT", "DELETE"],
    url: "/environment-library/:slot",
    bodyLimit: 32768,
    handler: async (request, reply) => {
      const target = params.safeParse(request.params);
      const input =
        request.method === "PUT" ? body.safeParse(request.body) : null;
      if (!target.success || (input && !input.success))
        return reply
          .code(400)
          .send({ error: "Choose a slot from 1–8 and a valid World recipe." });
      const operation = writes.then(async () => {
        const file = filename(target.data.slot);
        if (input?.success) {
          if ((await read(target.data.slot)) && !input.data.replace)
            return reply.code(409).send({
              error: "This slot is occupied. Confirm replacement first.",
            });
          await mkdir(directory, { recursive: true });
          const temporary = `${file}.${randomUUID()}.tmp`;
          try {
            await writeFile(
              temporary,
              JSON.stringify(input.data.recipe) + "\n",
              { mode: 0o600 },
            );
            await rename(temporary, file);
          } finally {
            await rm(temporary, { force: true });
          }
        } else {
          await rm(file, { force: true });
        }
        return { slot: target.data.slot, recipe: await read(target.data.slot) };
      });
      writes = operation.then(
        () => undefined,
        () => undefined,
      );
      try {
        return await operation;
      } catch {
        return reply.code(503).send({
          error:
            "Custom slot could not be saved. Your preview is still available; retry saving.",
        });
      }
    },
  });
}
