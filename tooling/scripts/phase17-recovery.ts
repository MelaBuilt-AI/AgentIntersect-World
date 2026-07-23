import { isAbsolute } from "node:path";

import { Phase17Service } from "../../apps/local-server/src/phase17-service.js";

type CliOptions = {
  readonly command: string;
  readonly stateRoot: string;
  readonly repositoryId: string;
  readonly sessionId: string;
  readonly revision?: number;
  readonly operationId?: string;
  readonly previewId?: string;
  readonly exportId?: string;
};

function parse(argv: readonly string[]): CliOptions {
  const [command, ...rest] = argv;
  if (!command)
    throw new Error(
      "Command required: inspect | preview-recovery | apply-recovery | preview-diagnostics | export-diagnostics | delete-export",
    );
  const values = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith("--") || value === undefined)
      throw new Error("CLI options must be --name value pairs");
    values.set(key.slice(2), value);
  }
  const stateRoot = values.get("state-root");
  const repositoryId = values.get("repository");
  const sessionId = values.get("session");
  if (!stateRoot || !isAbsolute(stateRoot))
    throw new Error("--state-root must be an explicit absolute path");
  if (!repositoryId || !sessionId)
    throw new Error("--repository and --session are required");
  const revisionText = values.get("revision");
  const revision =
    revisionText === undefined ? undefined : Number.parseInt(revisionText, 10);
  if (
    revisionText !== undefined &&
    (!Number.isSafeInteger(revision) || (revision as number) < 0)
  )
    throw new Error("--revision must be a nonnegative integer");
  return {
    command,
    stateRoot,
    repositoryId,
    sessionId,
    ...(revision === undefined ? {} : { revision }),
    ...(values.get("operation")
      ? { operationId: values.get("operation") as string }
      : {}),
    ...(values.get("preview")
      ? { previewId: values.get("preview") as string }
      : {}),
    ...(values.get("export")
      ? { exportId: values.get("export") as string }
      : {}),
  };
}

function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`${name} is required`);
  return value;
}

export async function runPhase17Cli(
  argv: readonly string[],
  write: (value: string) => void = (value) => process.stdout.write(value),
): Promise<unknown> {
  const options = parse(argv);
  const service = new Phase17Service({ directory: options.stateRoot });
  try {
    const identity = {
      repositoryId: options.repositoryId,
      sessionId: options.sessionId,
    };
    let result: unknown;
    if (options.command === "inspect") {
      result = await service.inspect(identity);
    } else if (options.command === "preview-recovery") {
      result = await service.previewRecovery({
        ...identity,
        expectedRevision: required(options.revision, "--revision"),
        operationId: required(options.operationId, "--operation"),
      });
    } else if (options.command === "apply-recovery") {
      result = await service.applyRecovery({
        ...identity,
        expectedRevision: required(options.revision, "--revision"),
        operationId: required(options.operationId, "--operation"),
        operatorApproval: "approved",
      });
    } else if (options.command === "preview-diagnostics") {
      result = await service.previewDiagnostics({
        ...identity,
        expectedRevision: required(options.revision, "--revision"),
      });
    } else if (options.command === "export-diagnostics") {
      result = await service.exportDiagnostics({
        ...identity,
        expectedRevision: required(options.revision, "--revision"),
        previewId: required(options.previewId, "--preview"),
        operatorApproval: "approved",
      });
    } else if (options.command === "delete-export") {
      result = await service.deleteExport({
        ...identity,
        expectedRevision: required(options.revision, "--revision"),
        exportId: required(options.exportId, "--export"),
        operatorApproval: "approved",
      });
    } else {
      throw new Error(`Unsupported Phase 17 command: ${options.command}`);
    }
    write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await service.dispose();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await runPhase17Cli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Phase 17 CLI failed"}\n`,
    );
    process.exitCode = 1;
  }
}
