import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type Phase10FixtureScale = "10k" | "100k";

const extensions = [".ts", ".tsx", ".js", ".jsx"] as const;

function supportedSource(
  index: number,
  nextPath: string,
  path: string,
): string {
  const typed = path.endsWith(".ts") || path.endsWith(".tsx");
  const declarations = Array.from(
    { length: 16 },
    (_, symbol) =>
      `export function symbol_${index}_${symbol}(value${typed ? ": number" : ""}) { return value ?? ${symbol}; }`,
  );
  return [
    `import ${JSON.stringify(`./${nextPath}`)};`,
    `import ${JSON.stringify(`external-${index % 7}`)};`,
    `export * from ${JSON.stringify(`./missing-${index}`)};`,
    ...declarations,
    "",
  ].join("\n");
}

export async function buildPhase10Fixture(
  root: string,
  scale: Phase10FixtureScale,
): Promise<{
  readonly files: number;
  readonly approximateDeclarations: number;
  readonly approximateDependencies: number;
  readonly sentinel: string;
}> {
  const fileCount = scale === "10k" ? 500 : 5_000;
  const sentinel = join(root, "phase10-executed-sentinel");
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(
    join(root, "package.json"),
    `${JSON.stringify({
      name: `@aiw/phase10-${scale}`,
      exports: "./src/file-00000.ts",
      scripts: {
        postinstall: `node -e "require('fs').writeFileSync('${sentinel}','executed')"`,
        test: `node -e "require('fs').writeFileSync('${sentinel}','executed')"`,
      },
    })}\n`,
  );
  const paths = Array.from({ length: fileCount }, (_, index) => {
    if (scale === "10k" && index === fileCount - 1)
      return `file-${String(index).padStart(5, "0")}.css`;
    return `file-${String(index).padStart(5, "0")}${extensions[index % extensions.length]}`;
  });
  for (let offset = 0; offset < paths.length; offset += 100) {
    await Promise.all(
      paths.slice(offset, offset + 100).map(async (path, localIndex) => {
        const index = offset + localIndex;
        const next = paths[(index + 1) % paths.length]!;
        const source =
          scale === "10k" && index === 1
            ? "export function malformed( {"
            : scale === "10k" && index === 2
              ? "export const renamed_fixture = true;\n"
              : supportedSource(index, next, path);
        await writeFile(join(root, "src", path), source);
      }),
    );
  }
  return {
    files: fileCount,
    approximateDeclarations: fileCount * 16,
    approximateDependencies: fileCount * 3,
    sentinel,
  };
}
