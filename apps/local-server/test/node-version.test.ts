import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { unsupportedNodeMessage } from "../src/node-version.js";

describe("Node 24 startup guard", () => {
  it("accepts Node 24 and names the found version otherwise", () => {
    expect(unsupportedNodeMessage("v24.18.0")).toBeNull();
    expect(unsupportedNodeMessage("v26.7.0")).toBe(
      "AgentIntersect World needs Node 24, found v26.7.0. Use Node 24 (see .nvmrc) and start again.",
    );
    expect(unsupportedNodeMessage("v240.0.0")).not.toBeNull();
  });

  it("stops the server before listening on another Node major", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "-e",
        `Object.defineProperty(process, "version", { value: "v26.7.0" }); await import(${JSON.stringify(path.resolve("apps/local-server/src/index.ts"))});`,
      ],
      {
        encoding: "utf8",
        timeout: 60_000,
        env: { ...process.env, AIW_PORT: "0" },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "AgentIntersect World needs Node 24, found v26.7.0",
    );
    expect(result.stdout).not.toContain("ready at");
  }, 60_000);
});
