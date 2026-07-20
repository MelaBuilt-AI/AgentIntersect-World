# AgentIntersect World — Phase 10 Frozen Scope

Date frozen: 2026-07-20
Status: **IMPLEMENTATION AND INDEPENDENT PARENT PROOF COMPLETE / PRIVATE EXACT-SHA CI CLOSEOUT PENDING**
Dependency: completed Phase 3 indexing pipeline, Phase 4 layout/identity, Phase 5 renderer, and Phase 9 exact-SHA closeout at `88e87e51a5edc217399fba1eb0508543b0b7ad66`
Runtime baseline: Node `v24.18.0`, pnpm `11.15.0`
Delivery mode: functionality-first bounded phase; one `gpt-5.6-sol` / `high` Codex implementation report, independent Mr Fluff source/functional/browser proof, one focused correction pass only for observed defects, then private commit/push and exact-SHA CI. No routine broad code audit.

## Objective

Add a bounded TypeScript/JavaScript symbol and static dependency vertical slice, connect it to authoritative repository generations and the existing World/renderer selection lane, and prove truthful fallback plus bounded 10,000/100,000-logical-object behavior.

## Frozen decisions

### 1. Tier 1 language and grammar matrix

Tier 1 is intentionally limited to languages already exercised by this TypeScript monorepo:

| Language   | Extensions            | Grammar artifact              |
| ---------- | --------------------- | ----------------------------- |
| TypeScript | `.ts`, `.mts`, `.cts` | `tree-sitter-typescript.wasm` |
| TSX        | `.tsx`                | `tree-sitter-tsx.wasm`        |
| JavaScript | `.js`, `.mjs`, `.cjs` | `tree-sitter-javascript.wasm` |
| JSX        | `.jsx`                | `tree-sitter-javascript.wasm` |

Use exactly `@vscode/tree-sitter-wasm@0.3.1`, published by the Visual Studio Code Team under MIT, from `https://github.com/Microsoft/vscode-tree-sitter-wasm`. The package declares Tree-sitter JavaScript `^0.25.0` and TypeScript `^0.23.2` as its build inputs. Runtime network fetches and runtime grammar updates are forbidden.

Pinned npm evidence:

- tarball: `https://registry.npmjs.org/@vscode/tree-sitter-wasm/-/tree-sitter-wasm-0.3.1.tgz`
- npm integrity: `sha512-RJFoomET6FajjG511fmQxeBQfU6M24a0aFZPqpid+ttIxanWf1VGytBG0UmsGjt07qmIPJS8U31D+aecuCucsQ==`
- package tarball SHA-1: `81d046fb37c09a1e950a20a1f233e8d868d76c77`
- runtime `tree-sitter.wasm` SHA-256: `3a31af706ffdf4a7116b064cdd4988df6791823298615009fc5b6bccbd42909b`
- JavaScript/JSX grammar SHA-256: `5fb488d0cabb4775a594bab85682de5ad6ce83c0d6ac997a9f82dd084d571240`
- TypeScript grammar SHA-256: `778025db5a8be0e70f8ccc3671e486dfeddd048c25d9e8a70c26de2e1bf6f97d`
- TSX grammar SHA-256: `79e5da75ea62855a0cd67177685f0164eac87d5f630b3cbe1e0a099751ad30f8`

The implementation must verify these hashes before grammar load and load only these four files from the package. A missing package/artifact, hash mismatch, initialization failure, or unsupported extension yields an explicit file-level `unsupported`/`unavailable` fallback; it must not download, compile, substitute, or execute another parser. Version updates are manual, require a new provenance record and regenerated measured evidence, and are not automatic Phase 10 maintenance.

### 2. Schema, identity, duplicates, and confidence

Add strict versioned `aiw.code-graph/0.10`, `aiw.symbol/0.10`, and `aiw.dependency/0.10` DTOs with opaque references and no absolute paths or source bodies.

- Symbol identity is SHA-256-derived from the schema domain, authoritative repository ID, authoritative Phase 4 file object ID, language, declaration kind, normalized qualified name, and a deterministic source-order ordinal only among declarations with the same kind/name in that file.
- A Phase 4 content-preserving file rename therefore preserves symbol IDs because the authoritative file object ID is preserved. A symbol rename intentionally creates a new symbol ID; Phase 10 performs no fuzzy identity donation.
- Overloads/duplicates are distinct by the duplicate ordinal and expose an explicit duplicate/overload group key. They are never silently merged.
- Persist only safe declaration metadata: opaque ID/ref, safe name/qualified name, kind, language, exported flag, bounded line/column range, file ref, and confidence. No source body, comment, docstring, prompt, token, secret, or absolute path is stored or shared.
- Static dependency-edge identity is derived from source file ref, import/export/require kind, literal specifier, occurrence ordinal, and sorted resolved candidate refs.
- Confidence/state values are exact and non-exclusive: `exact_file`, `exact_workspace_package`, `external`, `ambiguous`, `unresolved`, `unsupported`, and `unavailable`. Cycles are represented as explicit deterministic SCC group IDs; no edge is dropped merely because it is cyclic.
- Every indexed file has a coverage/fallback record even when it has zero symbols or cannot be parsed.

### 3. Parser isolation and bounds

Parsing runs only in Node `worker_threads`; the local-server/main/browser thread never parses selected-repository source.

- Maximum worker count: `2`, serialized to `1` when only one CPU is available.
- Per-worker Node resource limits: old generation `128 MiB`, young generation `32 MiB`, stack `4 MiB`.
- Maximum queued files: `128`; additional work waits behind bounded backpressure rather than spawning workers.
- Maximum UTF-8 source input: `512 KiB` per file.
- Hard wall-clock budget: `500 ms` per file. A timed-out worker is terminated and replaced before further work.
- Maximum accepted AST/declaration nesting: `256`.
- Maximum extracted symbols: `2,000` per file.
- Maximum extracted static dependency occurrences: `2,000` per file.
- Maximum stored parser diagnostics: `50` per file; diagnostics contain safe codes/counts only, not source excerpts.
- Any syntax error node, invalid UTF-8, malformed worker response, crash, timeout, cancellation, depth/count/byte excess, grammar mismatch, or unavailable grammar produces an explicit file-level fallback and contributes no partial symbol/dependency truth for that file.
- Generation cancellation terminates or discards outstanding work and may not commit a partial generation.

All hostile fixtures must be finite. No unbounded streams, recursive generators, or deliberate host-OOM producers are allowed.

### 4. Static dependency resolution and no-execution boundary

Only syntax and already-indexed repository metadata may resolve dependencies:

- static ES `import`, `export ... from`, side-effect import, literal `import("...")`, and literal CommonJS `require("...")` occurrences;
- exact relative resolution against authoritative indexed files using the supported extensions and deterministic `index.*` candidates;
- exact internal workspace-package resolution from parsed `package.json` data (`name`, `exports`, `imports`, `main`, `module`, and `types`) when a single indexed target is provable;
- external bare package specifiers represented as `external` without reading or executing dependency code;
- ambiguous candidates preserved as sorted opaque refs; unresolved literals preserved as unresolved metadata; SCC cycle groups computed deterministically.

The indexer must never execute or spawn selected-repository code, package scripts, hooks, package managers, shells, language servers, compilers, tests, binaries, native addons from the selected repository, or arbitrary commands. It must not import selected-repository modules or traverse `node_modules`. Acceptance fixtures include executable/package-script/hook canaries that would create a sentinel if run; the sentinel must remain absent.

### 5. Incremental invalidation, atomic recovery, and migration

- The authoritative Phase 3 successful generation ID is the commit boundary.
- A cache entry is keyed by repository ID, authoritative file object ID, file content hash, Tier 1 grammar hash, schema version, and extractor version.
- Unchanged matching entries are reused; changed/new files alone are reparsed. A content-preserving Phase 4 rename with the same authoritative file object ID and content hash reuses symbol identity and results. Deleted-file entries disappear only when the new generation commits.
- Each generation is staged separately and checksum-protected. Only a complete, current, uncancelled generation may atomically replace the current snapshot.
- Superseded/cancelled/failed generations are discarded without mutating current state. The last verified good snapshot remains readable with explicit stale/degraded truth.
- Corrupt envelopes, checksum failure, grammar/schema/extractor mismatch, or incompatible migration fail closed and trigger a bounded rebuild from authoritative file state; they never reinterpret old records as current truth.
- Retain current plus one previous verified graph snapshot. Do not add unbounded graph history in Phase 10.

### 6. LOD, bundling, selection, and renderer contract

Use the existing Phase 4 LOD `0–4`, tile stream, Phase 5 semantic DOM/R3F lane, and authoritative selection state.

- LOD 0–1: workspace/package/directory/file truth only; dependency edges are deterministic package/directory bundles.
- LOD 2: visible-tile file nodes and bundled file/package dependency edges; no symbol instances.
- LOD 3–4: symbol detail is available only for one explicitly focused authoritative file. There is no whole-repository symbol-detail request.
- Focus-detail API responses may contain at most all `2,000` schema-valid symbols in a virtualized semantic list, but the R3F renderer may instantiate at most `512` visible symbol nodes and `1,024` visible direct/bundled dependency edges at once. Truncation/aggregation is explicit.
- Visible tile responses remain capped at the existing `128` tiles. Aggregate dependency responses are capped at `1,024` edges.
- Quality auto-scaling may reduce cosmetic density/animation but may not change selected ref, coverage state, fallback reason, counts, or current-versus-previous truth.
- Semantic DOM status, keyboard/search/selection, reduced-motion mode, and WebGL fallback are authoritative and equivalent. Animation is never proof of successful indexing.
- A request for all-detail 100k symbols is structurally impossible through the API and receives a controlled validation failure if attempted.

### 7. Deterministic fixtures and performance budgets

Add two World-owned finite fixtures and a repeatable serialized measurement script under Node 24/Linux x64. Measurements report actual hardware/runtime, cold and warm behavior, counts, event-loop delay, and RSS delta.

- **10k logical-object fixture:** 500 mixed TS/TSX/JS/JSX files, approximately 8,000 declarations and 1,500 static dependency occurrences plus file/package objects, including exact, external, ambiguous, unresolved, cyclic, malformed, unsupported, and rename cases.
- **100k logical-object fixture:** 5,000 deterministic small files and approximately 80,000 declarations plus dependency/file/package objects. It may be generated in memory/on disk by a bounded deterministic fixture builder, but the browser may consume only aggregate/tile plus one-focused-file detail.

Hard acceptance ceilings on the supported parent/CI environment:

- per-file parser hard timeout: `500 ms`;
- cold 10k graph generation: `<= 30 s` wall time and `<= 512 MiB` RSS delta;
- warm no-change 10k generation: `<= 8 s` wall time;
- cold 100k graph generation: `<= 90 s` wall time and `<= 768 MiB` RSS delta;
- browser initial/LOD projection longest measured main-thread task: `<= 100 ms`;
- steady 10k/100k aggregate-view frame time: p95 `<= 33.3 ms` over at least 120 frames;
- visible renderer caps: `<= 2,000` total visible repository objects, `<= 512` symbol instances, `<= 1,024` dependency edges, and `<= 128` tiles;
- one focused semantic list is virtualized; the DOM may mount at most `200` symbol rows at once;
- the 100k fixture must prove zero whole-repository symbol-detail materialization in browser state, network payloads, DOM, and R3F instances.

A threshold change requires explicit user approval; an environmental inability to collect a metric must be reported as unverified rather than silently passed.

### 8. Acceptance transcript and bounded parser supply-chain gate

Required evidence:

1. vertical RED→GREEN unit tests for schemas/identity, each grammar, extraction, exact/ambiguous/unresolved/cyclic resolution, bounds, malformed/unavailable fallback, worker timeout/crash/cancellation, cache reuse/invalidation, file rename, corruption/last-good recovery, and no-execution canaries;
2. local-server API tests for current graph, coverage/degraded truth, aggregate edges, focused-file symbols, validation/status/OpenAPI parity, path privacy, and all-detail denial;
3. renderer/web tests for LOD/bundling, current-versus-previous status, focus-only symbols, semantic selection, virtualization, reduced motion, WebGL fallback, and visible caps;
4. a first-hand browser journey from repository index to symbol focus/dependency display, including an unsupported/malformed fallback state and zero JavaScript errors/overflow;
5. repeatable `measure:phase10` 10k/100k evidence meeting every frozen ceiling;
6. complete repository format, lint, typecheck, architecture, Vitest, build, smoke, Playwright, Storybook, production dependency audit, and final fresh-copy verification;
7. a bounded parser provenance/review artifact that records package publisher/repository/license/version/integrity, the four loaded artifact hashes above, package lock evidence, runtime no-network behavior, loaded-file allowlist, production advisory result, and any non-blocking residual risk.

The parent must independently inspect the diff, challenge at least one no-NUL/malformed parser fallback, one cancellation/last-good race, one file-rename identity case, the no-execution sentinel, the all-detail denial, and visible browser caps. Only concrete observed defects receive one focused correction pass and parent retest. Do not launch a routine broad code audit.

## Required implementation artifacts

- a dedicated World-owned symbol/code-graph package with parser registry, worker boundary, schema integration, cache/recovery, and static resolver;
- exact dependency/provenance lock evidence;
- local-server graph service and strict APIs;
- Phase 4/5 LOD and renderer projection plus focus-only web UI/Storybook state;
- World-owned malformed/adversarial, unavailable, rename/invalidation, no-execution, 10k, and 100k fixtures;
- repeatable Phase 10 performance report and bounded parser provenance/review;
- `PHASE_10_REPORT.md`, updated `PROJECT_STATUS.md`, canonical Phase 10 completion status, and version `0.10.0-phase10` only after final proof.

## Explicit non-goals and prohibited side effects

- Perfect/whole-program call graphs, fuzzy symbol identity, semantic type resolution, runtime call graphs, or all languages.
- Executing repository tools/code/tests/hooks/package managers/shells/LSP/compilers/binaries, traversing `node_modules`, or downloading parsers at runtime.
- Full-detail whole-repository symbol rendering, generalized semantic editing, or repository mutation.
- Phase 11 avatar work or later lifecycle/observability work.
- Public ingress, unrelated users/agents, accounts, multi-tenancy, cloud parser services, or internet discovery.
- Modification or routine inspection of original `/home/mela_ai/AgentIntersect`.
- Commit, push, tag, release, deployment, package publication, public visibility, or external publication by the Codex worker. Mr Fluff retains private commit/push/exact-SHA-CI authority; release/public actions remain explicit user gates.

## Completion boundary

Phase 10 is complete only after all frozen acceptance evidence is independently green, the private repository is committed/pushed, exact-SHA CI succeeds, final process/listener/temp cleanup is proven, and continuity documents reflect computed—not predicted—results. Do not begin Phase 11 automatically.
