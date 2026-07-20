# AgentIntersect World — Phase 10 Implementation and Parent Verification Report

Date: 2026-07-20
Status: **LOCAL IMPLEMENTATION AND INDEPENDENT PARENT VERIFICATION COMPLETE — private exact-SHA CI closeout pending**
Runtime: Node `v24.18.0`, pnpm `11.15.0`
Version: `0.10.0-phase10`
Baseline: Phase 9 closeout `88e87e51a5edc217399fba1eb0508543b0b7ad66`

## Delivered

- Strict `aiw.code-graph/0.10`, `aiw.symbol/0.10`, and `aiw.dependency/0.10` schemas with opaque refs, bounded safe metadata, explicit confidence/fallback states, deterministic duplicate ordinals, and deterministic dependency-cycle groups.
- Tier 1 TypeScript/TSX/JavaScript/JSX parsing from exact `@vscode/tree-sitter-wasm@0.3.1` runtime/grammar bytes. The worker verifies the four frozen SHA-256 values before load and never downloads, compiles, substitutes, or executes a parser at runtime.
- A maximum-two-worker parser pool with 128 MiB old-generation, 32 MiB young-generation, 4 MiB stack, 128 queued-file, 512 KiB/file, 500 ms/file, 256-depth, 2,000-symbol, 2,000-dependency, and 50-diagnostic limits. Timeout/crash/malformed/cancelled/over-budget input degrades at whole-file granularity.
- Read-only static ES import/export/dynamic-import and CommonJS literal-require extraction plus exact relative/workspace-package resolution, explicit ambiguity/unresolved/external truth, and no selected-repository package/script/hook/LSP/compiler/test/binary execution.
- Generation-coupled checksum cache with exact non-null content-hash reuse, Phase 4 content-rename continuity, current plus previous last-good state, corruption recovery, explicit rebuild truth, cancellation/supersession, and atomic commits.
- Strict current/aggregate/focused-file local APIs with path privacy, OpenAPI/status parity, 1,024-edge caps, one-file focus, and structural rejection of whole-repository symbol detail.
- Production semantic DOM and R3F dependency bridges, exact/non-drawable/cycle confidence, current/previous/degraded labels, one-file symbol focus, 512 symbol-instance/1,024 bridge/2,000 object/200 semantic-symbol-row caps, reduced-motion/WebGL fallback equivalence, and generation-keyed focused queries.
- Deterministic 500-source-file/approximately-10k-object and 5,000-source-file/approximately-100k-object fixtures with malformed, unsupported, external, unresolved, cyclic, rename, and no-execution sentinel cases.
- Enforcing `measure:phase10` verdicts in CI and fresh-copy verification. A failed wall/RSS/sentinel ceiling now exits nonzero rather than recording a false pass.

## RED → GREEN and delegated implementation

One bounded `gpt-5.6-sol` / `high` Codex implementation pass followed the frozen scope and TDD brief. Its final focused implementation sweep passed 8 files / 34 tests and its complete local sweep passed before parent review. The worker did not commit, push, release, publish, change visibility, modify original AgentIntersect, or begin Phase 11.

Independent parent review treated that report as context rather than proof and reproduced three failures in a disposable built-code probe:

```json
{
  "restartVisibleBeforeNewGeneration": null,
  "workspaceSubpath": {
    "confidence": ["exact_workspace_package"]
  },
  "hashlessInvalidation": {
    "reusedFiles": 1,
    "parsedFiles": 0,
    "firstSymbol": "before",
    "secondSymbol": "before"
  }
}
```

Source inspection also proved that performance failures did not fail the command and the dependency bridge was test-only/dead in the product lane. The one targeted Codex correction pass added RED regressions and corrected all five observed blockers:

1. explicit async checksum-cache initialization and truthful recovered-previous/rebuild status before server readiness;
2. no root-package identity donation to unexported subpaths, plus safe normalization of common npm fallback targets;
3. no reuse when either content hash is null;
4. enforceable performance/sentinel verdicts wired into CI/fresh verification;
5. real aggregate/focused dependency requests, semantic truth, and bounded R3F line bridges.

Parent retesting then found and directly corrected two small completion misses without another broad audit: R3F prepared symbol groups were not mounted/selectable in the canvas, and focused-file query identity omitted the current graph generation. Shared renderer kinds now include symbols in preparation, mounting, and selection; focused results are generation-keyed and generation-checked.

## Independent parent verification

- Parent disposable repro after correction:
  - persisted generation visible after explicit initialization: `true`;
  - unexported workspace subpath: `unresolved`, zero candidates;
  - changed hashless file: `reusedFiles: 0`, `parsedFiles: 1`, symbol changed from `before` to `after_`.
- Parent focused Phase 10 retest: 9 files / 48 tests passed before the final renderer/query completion fix.
- Final focused renderer/web retest: 2 files / 8 tests passed.
- Formatting and ESLint: passed with zero errors.
- Typecheck: 26/26 workspace tasks passed after 12 package-build tasks and root TypeScript validation.
- Architecture: checker passed across 14 packages; 11/11 architecture tests passed, including browser-safe Node parser subpath boundaries.
- Complete Vitest: 55 files / 289 tests passed.
- Production build: 14/14 workspace tasks passed.
- Smoke: passed against disposable server/web ports with no-execution sentinels absent.
- Playwright: 25/25 passed with one worker; Phase 10 contributed focused/degraded/fallback truth plus deterministic 10k/100k aggregate journeys.
- Storybook production build: passed with current/degraded, reduced-motion/WebGL-fallback, and aggregate/focused dependency states.
- Production dependency audit: no known vulnerabilities.
- Exact runtime artifact verification matched all four frozen parser/grammar SHA-256 values; npm reported the frozen MIT package, Microsoft repository, version, and integrity.
- Fresh-copy verification: passed for 297 project source files, including enforcing 10k/100k measurements, format, lint, 26/26 typecheck tasks, 11/11 architecture tests, 289/289 Vitest, 14/14 production build tasks, smoke, and 25/25 Playwright.

## Measured performance

The final parent enforcing run on Node `v24.18.0`, Linux x64, AMD Ryzen 7 7800X3D, 16 reported CPUs, and 15,796 MiB host memory passed every applicable ceiling:

| Fixture |    Cold wall |                           Warm wall |   RSS delta | Sentinel |
| ------- | -----------: | ----------------------------------: | ----------: | -------- |
| 10k     |   581.501 ms |                          196.019 ms | 233.191 MiB | absent   |
| 100k    | 4,141.159 ms | 2,957.537 ms (reported; no ceiling) | 651.148 MiB | absent   |

The 10k graph produced 501 coverage records, 498 parsed files, 7,953 symbols, 1,491 dependencies, and three truthful fallbacks. The 100k graph produced 5,001 coverage records, 5,000 parsed files, 80,000 symbols, 15,000 dependencies, and one manifest fallback.

Fresh-copy Chromium measured the 10k aggregate view at 16.7 ms p95 with a 61 ms longest task and the 100k view at 16.8 ms p95 with a 59 ms longest task over 120 frames each, with zero whole-repository symbol rows. Five repeated focused browser runs also passed with p95 16.7–16.8 ms and longest tasks 70–77 ms.

The first two exact-SHA CI attempts exposed flaws in the benchmark path rather than threshold changes: zero-based `floor(N×0.95)` selected the 95.83rd percentile for 120 samples, and both large fixture payloads were deeply Zod-parsed at module import before either scale was selected. The final gate uses standard nearest-rank p95 with 0.001 ms timestamp normalization, lazily constructs only the requested type-safe fixture, validates both large fixtures in Vitest, and couples fixture aggregates/focused detail to the current generation. The frozen 33.3 ms and 100 ms ceilings were not changed.

## First-hand visual proof

- Desktop production-build proof at 1,440×1,000 showed one live WebGL canvas, one rendered exact dependency bridge, truthful external non-drawable state, three focused symbols, two focused dependencies, current/previous/degraded labels, and equal 1,440 px client/scroll widths.
- Focusing `main.ts` increased prepared R3F instances from five to eight, proving the three symbol objects were mounted after the parent renderer correction.
- Mobile 390×844 reduced-motion/WebGL-disabled proof retained every repository action, focused symbol/dependency truth, semantic fallback, current/previous/degraded labels, and equal 390 px client/scroll widths.
- Desktop and mobile probes reported zero console errors or uncaught page errors. Screenshot inspection found no clipping, overlap, unreachable result, or horizontal overflow; long cycle IDs wrapped inside bounded panels.

## Supply-chain and no-execution boundary

The bounded provenance record is `docs/PHASE_10_PARSER_PROVENANCE.md`. The package is exact `@vscode/tree-sitter-wasm@0.3.1`, MIT, from Microsoft’s `vscode-tree-sitter-wasm` repository with npm integrity `sha512-RJFoomET6FajjG511fmQxeBQfU6M24a0aFZPqpid+ttIxanWf1VGytBG0UmsGjt07qmIPJS8U31D+aecuCucsQ==`.

Only the allowlisted runtime, JavaScript/JSX, TypeScript, and TSX WASM files load. Missing/mismatched bytes fail to file-level fallback. Selected repository code, scripts, hooks, package managers, shells, tests, language servers, compilers, binaries, and native addons are not executed; both real performance fixtures left their execution sentinels absent.

## Boundaries and residual risks

- Phase 10 remains one private/local trusted operator. No public ingress, accounts, multi-tenancy, cloud parser service, runtime grammar download, release, deployment, package publication, tag, or visibility change was added.
- Original `/home/mela_ai/AgentIntersect` was not modified or used as a Phase 10 implementation surface.
- Tier 1 remains deliberately limited to TypeScript/TSX/JavaScript/JSX. Unsupported/malformed/unavailable/over-budget files truthfully remain file-level World state.
- The pinned third-party WASM parser can still contain defects; hash pinning, workers, resource limits, timeout/replacement, whole-file fallback, and manual-only upgrades bound that residual risk.
- Existing Vite/Storybook large-chunk warnings remain non-blocking backlog. They do not alter Phase 10 caps or the measured local/browser results.
- Phase 11 did not start.

Private commit/push and exact-SHA CI closeout occur after this pre-commit report. Exact immutable SHA/run evidence is maintained in the final user response and external handoff to avoid a self-referential documentation-commit loop.

Verdict: **LOCAL COMPLETE — private exact-SHA CI closeout pending**
