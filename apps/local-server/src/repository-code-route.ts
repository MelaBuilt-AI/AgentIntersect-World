import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import type { CurrentRepositorySelection } from "./server.js";

const MAX_CODE_BYTES = 512 * 1024;

/** Explicit read-only inspection of objects in the server-selected repository. */
export function registerRepositoryCodeRoute(
  server: FastifyInstance,
  current: () => CurrentRepositorySelection | null,
) {
  server.get<{ Querystring: { repositoryRef: string; objectRef: string } }>(
    "/repository-code",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          required: ["repositoryRef", "objectRef"],
          properties: {
            repositoryRef: { type: "string", minLength: 1, maxLength: 256 },
            objectRef: { type: "string", minLength: 1, maxLength: 256 },
          },
        },
      },
    },
    async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      const selection = current();
      if (
        !selection ||
        selection.snapshot.repositoryRef !== request.query.repositoryRef
      )
        return reply.code(409).send({
          error: "Repository selection changed. Select the object again.",
        });
      const { snapshot, generation } = selection;
      const object = snapshot.objects.find(
        ({ ref }) => ref === request.query.objectRef,
      );
      if (!object || object.kind === "tombstone")
        return reply
          .code(404)
          .send({ error: "This repository object is no longer available." });
      const path = "path" in object ? object.path : "";
      const base = {
        objectRef: object.ref,
        repositoryRef: snapshot.repositoryRef,
        generation: generation.id,
        path,
        kind: object.kind,
      };
      if (object.kind !== "file") {
        const prefix = path ? `${path}/` : "";
        const files = snapshot.objects
          .filter(
            (candidate) =>
              candidate.kind === "file" && candidate.path.startsWith(prefix),
          )
          .map((candidate) => ({
            ref: candidate.ref,
            path: "path" in candidate ? candidate.path : "",
          }));
        return {
          data: {
            ...base,
            content: null,
            files,
            message: files.length
              ? "Select a file to inspect its code."
              : "This object has no indexed source files.",
          },
        };
      }
      const indexed = generation.files.find((file) => file.path === path);
      if (!indexed || indexed.binary || indexed.oversized)
        return {
          data: {
            ...base,
            content: null,
            files: [],
            message:
              "This file is binary, oversized, or unavailable for text inspection.",
          },
        };
      try {
        const root = await realpath(generation.rootPath);
        const target = await realpath(resolve(root, path));
        const inside = relative(root, target);
        if (
          inside === ".." ||
          inside.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
          isAbsolute(inside)
        )
          return reply
            .code(403)
            .send({ error: "File is outside the selected repository." });
        const handle = await open(
          target,
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
        try {
          const stat = await handle.stat();
          if (!stat.isFile() || stat.size > MAX_CODE_BYTES)
            return {
              data: {
                ...base,
                content: null,
                files: [],
                message:
                  "Text inspection is limited to regular files up to 512 KiB.",
              },
            };
          const bytes = Buffer.alloc(MAX_CODE_BYTES + 1);
          const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
          if (
            bytesRead > MAX_CODE_BYTES ||
            bytes.subarray(0, bytesRead).includes(0)
          )
            return {
              data: {
                ...base,
                content: null,
                files: [],
                message:
                  "This file is binary or exceeds the 512 KiB inspection limit.",
              },
            };
          if (current()?.generation.id !== generation.id)
            return reply.code(409).send({
              error: "Repository selection changed. Select the object again.",
            });
          return {
            data: {
              ...base,
              content: bytes.toString("utf8", 0, bytesRead),
              files: [],
              message: "Current working-file contents · read only",
            },
          };
        } finally {
          await handle.close();
        }
      } catch {
        return reply.code(404).send({
          error:
            "Source file is no longer readable. Refresh the repository and select it again.",
        });
      }
    },
  );
}
