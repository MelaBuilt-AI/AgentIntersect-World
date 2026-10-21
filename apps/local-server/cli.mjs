#!/usr/bin/env node
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { markRunning, runUpdate } from "./update.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
try {
  if (args[0] === "--help" || args[0] === "help") {
    console.log(
      "Usage: agentintersect-world [--no-open]\n       agentintersect-world update [--check] [--yes]\n       agentintersect-world --version\nUpdates require a published release. Close World first; saved state and agent profiles are preserved.",
    );
  } else if (args[0] === "--version") {
    console.log(
      JSON.parse(await readFile(join(root, "BUILD.json"), "utf8")).version,
    );
  } else if (args[0] === "update") {
    await runUpdate(root, args.slice(1));
  } else {
    if (args.some((arg) => arg !== "--no-open"))
      throw new Error("Unknown argument. Run agentintersect-world --help.");
    const cleanup = await markRunning(root);
    try {
      await import("./launch.mjs");
    } catch (error) {
      cleanup();
      throw error;
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
