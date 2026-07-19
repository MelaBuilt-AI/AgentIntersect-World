import {
  ConfigurationError,
  loadLocalServerConfig,
} from "@agentintersect-world/config/node";

import { createLocalServer } from "./server.js";

const config = (() => {
  try {
    return loadLocalServerConfig();
  } catch (error) {
    const message =
      error instanceof ConfigurationError
        ? error.message
        : "Local server configuration is invalid";
    process.stderr.write(`Configuration error: ${message}\n`);
    process.exitCode = 1;
    return undefined;
  }
})();

if (config !== undefined) {
  const server = createLocalServer({ config });
  let closePromise: Promise<void> | undefined;

  const closeOnce = (): Promise<void> => {
    closePromise ??= server.close();
    return closePromise;
  };

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      process.stderr.write(
        `AgentIntersect World local server received ${signal}; stopping\n`,
      );
      void closeOnce()
        .then(() => {
          process.stderr.write("AgentIntersect World local server stopped\n");
          process.exitCode = 0;
        })
        .catch(() => {
          process.stderr.write(
            "AgentIntersect World local server could not stop cleanly\n",
          );
          process.exitCode = 1;
        });
    });
  }

  try {
    const address = await server.listen({
      host: config.host,
      port: config.port,
    });
    process.stdout.write(
      `AgentIntersect World local server ready at ${address} (bound at ${config.host}:${config.port}; network scope: ${config.networkScope})\n`,
    );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EADDRINUSE") {
      process.stderr.write(
        `Port ${config.port} is already in use on ${config.host}. Choose another AIW_PORT or stop the existing listener.\n`,
      );
    } else {
      process.stderr.write(
        "AgentIntersect World local server failed to start\n",
      );
    }
    await closeOnce().catch(() => undefined);
    process.exitCode = 1;
  }
}
