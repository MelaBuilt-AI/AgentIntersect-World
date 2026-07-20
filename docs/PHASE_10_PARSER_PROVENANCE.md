# Phase 10 parser provenance and bounded review

Recorded: 2026-07-20

## Pinned package

- Package: `@vscode/tree-sitter-wasm@0.3.1`
- Publisher/author: Visual Studio Code Team
- Repository: `https://github.com/Microsoft/vscode-tree-sitter-wasm`
- License: MIT (`LICENSE` is included in the installed package)
- Tarball: `https://registry.npmjs.org/@vscode/tree-sitter-wasm/-/tree-sitter-wasm-0.3.1.tgz`
- npm integrity: `sha512-RJFoomET6FajjG511fmQxeBQfU6M24a0aFZPqpid+ttIxanWf1VGytBG0UmsGjt07qmIPJS8U31D+aecuCucsQ==`
- Published tarball SHA-1: `81d046fb37c09a1e950a20a1f233e8d868d76c77`
- Lock evidence: the exact integrity is recorded for `@vscode/tree-sitter-wasm@0.3.1` in `pnpm-lock.yaml`; the spatial-code-graph manifest pins exact `0.3.1`.
- Declared build inputs in the published package: `tree-sitter-javascript ^0.25.0` and `tree-sitter-typescript ^0.23.2`.

## Runtime loaded-file allowlist

`verifyParserArtifacts` reads and verifies exactly these files before parser initialization. No other grammar is selected or substituted.

| File                          | Verified SHA-256                                                   |
| ----------------------------- | ------------------------------------------------------------------ |
| `tree-sitter.wasm`            | `3a31af706ffdf4a7116b064cdd4988df6791823298615009fc5b6bccbd42909b` |
| `tree-sitter-javascript.wasm` | `5fb488d0cabb4775a594bab85682de5ad6ce83c0d6ac997a9f82dd084d571240` |
| `tree-sitter-typescript.wasm` | `778025db5a8be0e70f8ccc3671e486dfeddd048c25d9e8a70c26de2e1bf6f97d` |
| `tree-sitter-tsx.wasm`        | `79e5da75ea62855a0cd67177685f0164eac87d5f630b3cbe1e0a099751ad30f8` |

The worker maps only `.ts`, `.mts`, `.cts`, `.tsx`, `.js`, `.mjs`, `.cjs`, and `.jsx`. Missing or mismatched files produce whole-file `unavailable` fallback. Runtime download, compilation, update, network fetch, native-addon loading, selected-module import, package-manager invocation, shell invocation, compiler/LSP/test execution, and `node_modules` traversal are absent from the product path.

## Bounded review evidence

- Artifact verification matched all four frozen SHA-256 values on the installed package.
- Worker tests cover each grammar, unavailable/hash failure, malformed syntax, invalid UTF-8 without relying on NUL, byte/depth/symbol/dependency bounds, timeout, crash, malformed response, cancellation, and whole-file fallback.
- Worker count is capped at two (one on a single-CPU host); each worker uses old-generation 128 MiB, young-generation 32 MiB, and stack 4 MiB resource limits.
- The finite no-execution fixture includes package-script canaries. Both focused tests and the measured 500/5,000-source-file runs left the sentinel absent.
- The npm installer reported that the lockfile passed configured supply-chain policies. `corepack pnpm@11.15.0 audit --prod` completed with exit 0 and reported no known vulnerabilities on 2026-07-20.

## Residual risk

The pinned WASM runtime and grammars remain third-party parser code processing selected source inside bounded Node workers. Hash verification prevents silent artifact substitution but does not prove absence of defects in the pinned bytes. Version changes are manual and require a new provenance record and measured evidence.
