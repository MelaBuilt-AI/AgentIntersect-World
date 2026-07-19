export interface SanitizationContext {
  homePaths?: readonly string[];
  tempPaths?: readonly string[];
  livePids?: readonly number[];
}

export interface EvidenceScan {
  files: string[];
  violations: Array<{ file: string; pattern: string }>;
}

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await fs
    .readdir(directory, { withFileTypes: true })
    .catch(() => []);
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory()
        ? walkFiles(target)
        : Promise.resolve([target]);
    }),
  );
  return nested.flat();
}

export async function scanCommittedEvidence(
  root: string,
): Promise<EvidenceScan> {
  const candidates = [
    path.join(root, "PHASE_0_REPORT.md"),
    ...(await walkFiles(
      path.join(root, "packages", "agentintersect-client", "fixtures"),
    )),
    ...(await walkFiles(path.join(root, "evidence"))),
  ];
  const files: string[] = [];
  const violations: EvidenceScan["violations"] = [];
  const patterns = [
    {
      name: "raw_home_or_temp_path",
      regex: /(?:\/home\/|\/tmp\/|\/var\/tmp\/|[A-Z]:\\Users\\)/,
    },
    {
      name: "live_pid",
      regex: /(?:"(?:pid|pids)"\s*:\s*\d+|(?:^|\s)pid=\d+|\/proc\/\d+)/m,
    },
    {
      name: "bearer_or_private_key",
      regex:
        /(?:Bearer\s+(?!<REDACTED>)[A-Za-z0-9._-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i,
    },
    {
      name: "credential_value",
      regex:
        /(?:"(?:token|password|secret|credential|api[_-]?key|client[_-]?secret)"\s*:\s*"(?!<REDACTED>)[^"]+"|https?:\/\/[^\s/:]+:[^\s/@]+@)/i,
    },
  ];

  for (const filename of candidates) {
    const stat = await fs.stat(filename).catch(() => null);
    if (!stat?.isFile()) continue;
    const relative = path.relative(root, filename);
    files.push(relative);
    const content = await fs.readFile(filename, "utf8");
    for (const pattern of patterns) {
      if (pattern.regex.test(content)) {
        violations.push({ file: relative, pattern: pattern.name });
      }
    }
  }
  return { files: files.sort(), violations };
}

function replaceAllLiteral(
  value: string,
  search: string,
  replacement: string,
): string {
  return search ? value.split(search).join(replacement) : value;
}

export function sanitizeEvidence<T>(
  value: T,
  context: SanitizationContext = {},
): T {
  const livePids = new Set(context.livePids ?? []);
  const homes = [...(context.homePaths ?? [])].sort(
    (a, b) => b.length - a.length,
  );
  const temps = [...(context.tempPaths ?? [])].sort(
    (a, b) => b.length - a.length,
  );

  const stringValue = (input: string) => {
    let output = input;
    for (const home of homes)
      output = replaceAllLiteral(output, home, "<CHECKOUT>");
    for (const temp of temps)
      output = replaceAllLiteral(output, temp, "<TEMP>");
    for (const pid of livePids) {
      output = replaceAllLiteral(output, `/proc/${pid}/`, "/proc/<PID>/");
    }
    output = output.replace(/\bBearer\s+[^\s]+/gi, "Bearer <REDACTED>");
    return output;
  };

  const visit = (input: unknown, key = ""): unknown => {
    if (/token|secret|password|credential|api[_-]?key/i.test(key)) {
      return "<REDACTED>";
    }
    if (
      typeof input === "number" &&
      /^(?:pid|pids)$/i.test(key) &&
      livePids.has(input)
    ) {
      return "<PID>";
    }
    if (typeof input === "string") return stringValue(input);
    if (Array.isArray(input)) return input.map((item) => visit(item, key));
    if (input !== null && typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input).map(([childKey, child]) => [
          childKey,
          visit(child, childKey),
        ]),
      );
    }
    return input;
  };

  return visit(value) as T;
}
import fs from "node:fs/promises";
import path from "node:path";
