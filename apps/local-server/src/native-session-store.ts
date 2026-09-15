import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const BindingSchema = z.object({
  worldInstanceId: z.string().min(1).max(256),
  rootSessionRef: z.string().max(256).optional(),
  nativeSessionId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/),
  title: z.string().max(80),
  runtimeHome: z.string().min(1).max(4096),
  ended: z.boolean(),
  quarantined: z.boolean(),
});
export type NativeOwnedBinding = z.infer<typeof BindingSchema>;
const StoreSchema = z.object({
  schema: z.literal("aiw.native-sessions/1"),
  bindings: z.array(BindingSchema),
});

/** World-owned metadata only. Native histories, profiles and credentials stay native. */
export class NativeSessionStore {
  readonly bindings = new Map<string, NativeOwnedBinding>();
  readonly filename: string;
  #loaded: Promise<void> | undefined;
  #write = Promise.resolve();
  constructor(
    directory: string,
    harness: "codex" | "claude-code" | "hermes" | "openclaw",
  ) {
    this.filename = path.join(directory, `${harness}-bindings.json`);
  }
  load(): Promise<void> {
    return (this.#loaded ??= this.#read());
  }
  async #read(): Promise<void> {
    let text: string;
    try {
      text = await readFile(this.filename, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    const stored = StoreSchema.parse(JSON.parse(text));
    for (const binding of stored.bindings)
      this.bindings.set(
        binding.rootSessionRef ?? binding.nativeSessionId,
        binding,
      );
  }
  save(): Promise<void> {
    this.#write = this.#write.then(async () => {
      await mkdir(path.dirname(this.filename), {
        recursive: true,
        mode: 0o700,
      });
      const temporary = `${this.filename}.${randomUUID()}.tmp`;
      try {
        await writeFile(
          temporary,
          JSON.stringify({
            schema: "aiw.native-sessions/1",
            bindings: [...this.bindings.values()],
          }) + "\n",
          { flag: "wx", mode: 0o600 },
        );
        await rename(temporary, this.filename);
      } finally {
        await rm(temporary, { force: true });
      }
    });
    return this.#write;
  }
}
