import { LOCAL_SERVER_DEFAULTS } from "@agentintersect-world/config";

import { createLocalServer } from "./server.js";

const host = process.env.AIW_HOST ?? LOCAL_SERVER_DEFAULTS.host;
const parsedPort = Number(process.env.AIW_PORT ?? LOCAL_SERVER_DEFAULTS.port);

if (!Number.isInteger(parsedPort) || parsedPort < 0 || parsedPort > 65_535) {
  throw new Error("AIW_PORT must be an integer between 0 and 65535");
}

const server = createLocalServer();

async function stop(signal: NodeJS.Signals) {
  process.stderr.write(
    `AgentIntersect World local server received ${signal}; stopping\n`,
  );
  await server.close();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void stop(signal).finally(() => process.exit(0));
  });
}

try {
  const address = await server.listen({ host, port: parsedPort });
  process.stdout.write(
    `AgentIntersect World local server ready at ${address}\n`,
  );
} catch (error) {
  server.log.error(error);
  process.exitCode = 1;
}
