import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  GraphParserPool,
  assignDependencyCycleGroups,
  deriveDependencyIdentity,
  deriveSymbolIdentity,
  languageForPath,
  resolveStaticDependencies,
  verifyParserArtifacts,
} from "@agentintersect-world/spatial-code-graph/node";

const repositoryId = "88888888888888888888888888888888";
const fileRef = "aiw://object/11111111111111111111111111111111" as const;
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("Phase 10 parser registry and identity", () => {
  it("verifies only the frozen runtime and grammar SHA-256 allowlist", async () => {
    const verified = await verifyParserArtifacts();
    expect(verified).toEqual([
      [
        "tree-sitter-javascript.wasm",
        "5fb488d0cabb4775a594bab85682de5ad6ce83c0d6ac997a9f82dd084d571240",
      ],
      [
        "tree-sitter-tsx.wasm",
        "79e5da75ea62855a0cd67177685f0164eac87d5f630b3cbe1e0a099751ad30f8",
      ],
      [
        "tree-sitter-typescript.wasm",
        "778025db5a8be0e70f8ccc3671e486dfeddd048c25d9e8a70c26de2e1bf6f97d",
      ],
      [
        "tree-sitter.wasm",
        "3a31af706ffdf4a7116b064cdd4988df6791823298615009fc5b6bccbd42909b",
      ],
    ]);
    expect(languageForPath("src/a.ts")).toBe("typescript");
    expect(languageForPath("src/a.mts")).toBe("typescript");
    expect(languageForPath("src/a.cts")).toBe("typescript");
    expect(languageForPath("src/a.tsx")).toBe("tsx");
    expect(languageForPath("src/a.jsx")).toBe("jsx");
    expect(languageForPath("src/a.css")).toBeNull();
  });

  it("derives deterministic duplicate identities from file identity, not path", () => {
    const first = deriveSymbolIdentity({
      repositoryId,
      fileRef,
      language: "typescript",
      kind: "function",
      qualifiedName: "run",
      duplicateOrdinal: 0,
    });
    const duplicate = deriveSymbolIdentity({
      repositoryId,
      fileRef,
      language: "typescript",
      kind: "function",
      qualifiedName: "run",
      duplicateOrdinal: 1,
    });
    expect(first.ref).toMatch(/^aiw:\/\/symbol\/[0-9a-f]{32}$/u);
    expect(first.groupKey).toBe(duplicate.groupKey);
    expect(first.id).not.toBe(duplicate.id);
    expect(first).toEqual(
      deriveSymbolIdentity({
        repositoryId,
        fileRef,
        language: "typescript",
        kind: "function",
        qualifiedName: "run",
        duplicateOrdinal: 0,
      }),
    );
  });
});

describe("Phase 10 worker-isolated extraction and fallback", () => {
  it.each([
    [
      "typescript",
      "file.ts",
      "export function typed(value: string) { return value; }",
    ],
    ["tsx", "file.tsx", "export function View() { return <main />; }"],
    ["javascript", "file.js", "export function plain(value) { return value; }"],
    ["jsx", "file.jsx", "export function Card() { return <article />; }"],
  ] as const)(
    "extracts declarations with the pinned %s grammar",
    async (language, path, source) => {
      const pool = new GraphParserPool({ workerCount: 1 });
      try {
        const parsed = await pool.parse({
          repositoryId,
          fileRef,
          path,
          source: new TextEncoder().encode(source),
        });
        expect(parsed.coverage.state).toBe("parsed");
        expect(parsed.coverage.language).toBe(language);
        expect(parsed.symbols[0]?.name).toMatch(/typed|View|plain|Card/u);
      } finally {
        await pool.close();
      }
    },
  );

  it("falls back for syntax errors, no-NUL invalid UTF-8, oversized files, and unavailable artifacts", async () => {
    const pool = new GraphParserPool({ workerCount: 1 });
    try {
      const syntax = await pool.parse({
        repositoryId,
        fileRef,
        path: "bad.ts",
        source: new TextEncoder().encode("export function bad( {"),
      });
      expect(syntax).toMatchObject({
        symbols: [],
        dependencies: [],
        coverage: { state: "fallback", fallbackReason: "syntax_error" },
      });
      const invalid = await pool.parse({
        repositoryId,
        fileRef,
        path: "bad.ts",
        source: new Uint8Array([0xc3, 0x28]),
      });
      expect(invalid.coverage.fallbackReason).toBe("invalid_utf8");
      const oversized = await pool.parse({
        repositoryId,
        fileRef,
        path: "huge.ts",
        source: new Uint8Array(512 * 1024 + 1),
      });
      expect(oversized.coverage.fallbackReason).toBe("source_too_large");
    } finally {
      await pool.close();
    }

    const root = await mkdtemp(join(tmpdir(), "aiw-phase10-artifacts-"));
    roots.push(root);
    await expect(verifyParserArtifacts(root)).rejects.toThrow(/unavailable/u);
  });

  it.each([
    ["timeout", "timeout"],
    ["crash", "worker_crash"],
    ["malformed", "malformed_worker_response"],
    ["unavailable", "grammar_unavailable"],
  ] as const)(
    "falls back at whole-file granularity after worker %s",
    async (workerFixture, reason) => {
      const pool = new GraphParserPool({ workerCount: 1, workerFixture });
      try {
        const parsed = await pool.parse({
          repositoryId,
          fileRef,
          path: "worker.ts",
          source: new TextEncoder().encode("export const partial = 1;"),
        });
        expect(parsed).toMatchObject({
          symbols: [],
          dependencies: [],
          coverage: { state: "fallback", fallbackReason: reason },
        });
      } finally {
        await pool.close();
      }
    },
  );

  it("terminates active work on cancellation and returns no partial truth", async () => {
    const controller = new AbortController();
    const pool = new GraphParserPool({
      workerCount: 1,
      workerFixture: "timeout",
    });
    try {
      const pending = pool.parse({
        repositoryId,
        fileRef,
        path: "cancel.ts",
        source: new TextEncoder().encode("export const partial = 1;"),
        signal: controller.signal,
      });
      controller.abort();
      await expect(pending).resolves.toMatchObject({
        symbols: [],
        dependencies: [],
        coverage: { state: "fallback", fallbackReason: "cancelled" },
      });
    } finally {
      await pool.close();
    }
  });

  it.each([
    [
      "symbol_limit_exceeded",
      Array.from(
        { length: 2_001 },
        (_, index) => `export const value_${index} = ${index};`,
      ).join("\n"),
    ],
    [
      "dependency_limit_exceeded",
      Array.from(
        { length: 2_001 },
        (_, index) => `import "./missing_${index}";`,
      ).join("\n"),
    ],
    ["depth_exceeded", `${"{".repeat(258)}let value = 1;${"}".repeat(258)}`],
  ] as const)(
    "falls back without partial truth when %s",
    async (reason, source) => {
      const pool = new GraphParserPool({ workerCount: 1 });
      try {
        const result = await pool.parse({
          repositoryId,
          fileRef,
          path: "bounded.ts",
          source: new TextEncoder().encode(source),
        });
        expect(result).toMatchObject({
          symbols: [],
          dependencies: [],
          coverage: { state: "fallback", fallbackReason: reason },
        });
      } finally {
        await pool.close();
      }
    },
  );
});

describe("Phase 10 static resolver", () => {
  it("preserves exact, ambiguous, unresolved, external, and cyclic truth without execution", async () => {
    const sentinelRoot = await mkdtemp(join(tmpdir(), "aiw-phase10-canary-"));
    roots.push(sentinelRoot);
    const sentinel = join(sentinelRoot, "executed");
    const canaryPackage = JSON.stringify({
      scripts: {
        postinstall: `node -e "require('fs').writeFileSync('${sentinel}','bad')"`,
      },
    });
    await writeFile(join(sentinelRoot, "package.json"), canaryPackage);
    const occurrences = [
      { kind: "import", specifier: "./exact", occurrenceOrdinal: 0 },
      { kind: "import", specifier: "./ambiguous", occurrenceOrdinal: 1 },
      { kind: "require", specifier: "./missing", occurrenceOrdinal: 2 },
      { kind: "import", specifier: "external-lib", occurrenceOrdinal: 3 },
    ] as const;
    const refs = new Map([
      ["src/exact.ts", "aiw://object/22222222222222222222222222222222"],
      ["src/ambiguous.ts", "aiw://object/33333333333333333333333333333333"],
      [
        "src/ambiguous/index.ts",
        "aiw://object/44444444444444444444444444444444",
      ],
    ] as const);
    const edges = resolveStaticDependencies({
      sourcePath: "src/source.ts",
      sourceFileRef: fileRef,
      occurrences,
      indexedFiles: refs,
      workspacePackages: new Map(),
    });
    expect(edges.map((edge) => edge.confidence[0])).toEqual([
      "exact_file",
      "ambiguous",
      "unresolved",
      "external",
    ]);
    expect(edges[1]?.candidateRefs).toHaveLength(2);
    expect(deriveDependencyIdentity(edges[0]!)).toEqual(edges[0]!.id);
    await expect(readFile(sentinel)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps workspace package matching exact for roots and exported subpaths", () => {
    const rootRef = "aiw://object/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
    const exportRef = "aiw://object/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
    const edges = resolveStaticDependencies({
      sourcePath: "src/source.ts",
      sourceFileRef: fileRef,
      occurrences: [
        { kind: "import", specifier: "@scope/pkg", occurrenceOrdinal: 0 },
        {
          kind: "import",
          specifier: "@scope/pkg/exported",
          occurrenceOrdinal: 1,
        },
        {
          kind: "import",
          specifier: "@scope/pkg/not-exported",
          occurrenceOrdinal: 2,
        },
        {
          kind: "import",
          specifier: "external-pkg/subpath",
          occurrenceOrdinal: 3,
        },
        { kind: "import", specifier: "#not-mapped", occurrenceOrdinal: 4 },
      ],
      indexedFiles: new Map(),
      workspacePackages: new Map([
        ["@scope/pkg", [rootRef]],
        ["@scope/pkg/exported", [exportRef]],
      ]),
    });
    expect(
      edges.map((edge) => ({
        specifier: edge.specifier,
        confidence: edge.confidence,
        candidates: edge.candidateRefs,
      })),
    ).toEqual([
      {
        specifier: "@scope/pkg",
        confidence: ["exact_workspace_package"],
        candidates: [rootRef],
      },
      {
        specifier: "@scope/pkg/exported",
        confidence: ["exact_workspace_package"],
        candidates: [exportRef],
      },
      {
        specifier: "@scope/pkg/not-exported",
        confidence: ["unresolved"],
        candidates: [],
      },
      {
        specifier: "external-pkg/subpath",
        confidence: ["external"],
        candidates: [],
      },
      {
        specifier: "#not-mapped",
        confidence: ["unresolved"],
        candidates: [],
      },
    ]);
  });

  it("assigns one deterministic SCC ID without dropping cyclic edges", () => {
    const left = "aiw://object/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
    const right = "aiw://object/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
    const indexed = new Map([
      ["src/left.ts", left],
      ["src/right.ts", right],
    ] as const);
    const edges = [
      ...resolveStaticDependencies({
        sourcePath: "src/left.ts",
        sourceFileRef: left,
        occurrences: [
          { kind: "import", specifier: "./right", occurrenceOrdinal: 0 },
        ],
        indexedFiles: indexed,
        workspacePackages: new Map(),
      }),
      ...resolveStaticDependencies({
        sourcePath: "src/right.ts",
        sourceFileRef: right,
        occurrences: [
          { kind: "import", specifier: "./left", occurrenceOrdinal: 0 },
        ],
        indexedFiles: indexed,
        workspacePackages: new Map(),
      }),
    ];
    const cyclic = assignDependencyCycleGroups(edges);
    expect(cyclic).toHaveLength(2);
    expect(cyclic[0]?.cycleGroupId).toMatch(/^[0-9a-f]{32}$/u);
    expect(cyclic[1]?.cycleGroupId).toBe(cyclic[0]?.cycleGroupId);
  });
});
