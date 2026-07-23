import { mkdir, writeFile } from "node:fs/promises";

import { runPhase17Drill } from "./phase17-fixture.js";

const result = await runPhase17Drill();
await mkdir(new URL("../../artifacts/phase17/", import.meta.url), {
  recursive: true,
});
await writeFile(
  new URL("../../artifacts/phase17/recovery-drill.json", import.meta.url),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);
process.stdout.write(
  `Phase 17 recovery drill ${result.verdict}: ${Object.keys(result.checks).length} checks, ${result.measurements.eventCount} events, ${result.measurements.readinessRows} readiness rows.\n`,
);
if (result.verdict !== "PASS") process.exitCode = 1;
