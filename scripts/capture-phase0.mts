import {
  captureEmergencyStopContract,
  captureHttpSseContract,
  captureLifecycleContract,
  captureMcpContract,
  observeCheckout,
  sanitizeEvidence,
  validateCompatibility,
  validatePhase0Evidence,
} from "../packages/agentintersect-client/src/index.ts";

function option(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

const checkout = option("--agentintersect-checkout");
if (!checkout) {
  throw new Error("--agentintersect-checkout is required");
}

const observed = await observeCheckout(checkout);
const compatibility = validateCompatibility(observed.compatibility);
if (!compatibility.ok) {
  throw new Error(
    `unsupported AgentIntersect compatibility: ${compatibility.mismatches.join(",")}`,
  );
}

const httpSse = await captureHttpSseContract(checkout);
const mcp = await captureMcpContract(checkout);
const lifecycle = await captureLifecycleContract(checkout);
const emergencyStop = await captureEmergencyStopContract(checkout);
const aggregateCompatibility = validatePhase0Evidence({
  checkout: observed,
  healthAttested: httpSse.attested,
  healthKeys: httpSse.healthKeys,
  mcp,
});
if (!aggregateCompatibility.ok) {
  throw new Error(
    `unsupported AgentIntersect contract evidence: ${aggregateCompatibility.mismatches.join(",")}`,
  );
}

const evidence = sanitizeEvidence(
  {
    schemaVersion: 1,
    support: "current-private-implementation-candidate",
    checkout: observed,
    httpSse,
    mcp,
    lifecycle,
    emergencyStop,
  },
  { homePaths: [checkout] },
);

process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
