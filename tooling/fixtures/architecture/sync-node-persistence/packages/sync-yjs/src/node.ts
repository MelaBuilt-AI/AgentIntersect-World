import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const persistPresentationSnapshot = (
  directory: string,
  bytes: Uint8Array,
) =>
  writeFile(
    resolve(directory, createHash("sha256").update(bytes).digest("hex")),
    bytes,
  );
