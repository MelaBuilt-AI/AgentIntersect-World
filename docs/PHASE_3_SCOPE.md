# Phase 3 Scope Contract — Repository Discovery and Deterministic Metadata Index

Date: 2026-07-19
Status: Frozen for implementation
Risk/delivery mode: Standard functionality-first bounded phase
Authorized by: user request after green/completed Phase 2
Baseline commit: `4a75ca099ca3a5fb0d0c9638cc4eef680c1bdb03`
Private remote: `https://github.com/MelaBuilt-AI/AgentIntersect-World`
Authoritative local rules: `AGENTS.md`
Canonical design: `AgentIntersect_WorldDD.md`, Phase 3

## Observable vertical slice

From the local web UI, one operator can enter a local Git or non-Git directory, start or cancel a bounded metadata index, watch deterministic progress, and inspect the current operation plus the last successful generation. The index reports canonical repository identity, directories/files, language/file-kind classification, package manifests, bounded content hashes, and safe Git branch/HEAD/status metadata without executing repository content.

Re-running an unchanged repository produces the same deterministic fingerprint. A cancelled or failed attempt never replaces the last successful generation.

## Supported environment

- Node 24 on the current WSL/Linux host.
- pnpm `11.15.0` through the existing Node 24 launcher.
- Local filesystem roots selected by the operator.
- Git and non-Git directories.
- Loopback by default; explicit trusted-LAN local-authority mode remains supported.
- Git CLI from the trusted host toolchain may be invoked only through argument arrays and hardened metadata-only commands.

Unsupported platforms and broad hostile/public-internet deployment are not Phase 3 blockers.

## Frozen dependency and version changes

- Add `ignore@7.0.6` to `@agentintersect-world/repo-indexer` for bounded non-Git root `.gitignore` evaluation.
- Use Node built-ins for traversal, hashing, cancellation, paths, and trusted-system-Git invocation.
- Do not add SQLite, a database ORM, worker framework, filesystem watcher library, shell library, parser farm, spatial dependency, or cloud service.
- Bump root and workspace package versions to `0.3.0-phase3`.
- Keep `@fastify/swagger@9.8.1`, Fastify, Zod, React, Vite, Vitest, Playwright, and the Phase 2 toolchain pinned unless a concrete compatibility failure requires an exact correction.

## Package graph

### `@agentintersect-world/repo-indexer`

Becomes a Node-only functional package and owns:

- canonical root validation with `realpath`;
- deterministic file discovery and directory derivation;
- Git/non-Git detection;
- fixed vendor/build/cache exclusions;
- Git-standard ignored-file discovery for Git roots;
- bounded root `.gitignore` behavior for non-Git roots;
- symlink skipping, including escapes;
- language/file-kind/binary/oversize classification;
- bounded SHA-256 content hashing;
- package-manifest discovery;
- safe Git branch/HEAD/status reads;
- stable sorted output and generation fingerprint;
- cancellation/progress callbacks.

It must never be browser-reachable and must never execute repository scripts, hooks, binaries, package managers, commands, or arbitrary content.

### `@agentintersect-world/world-schema`

Owns browser-safe Zod schemas and DTOs for:

- repository-index create request;
- index status/progress/operation record;
- file/directory/package/Git metadata;
- successful generation and deterministic fingerprint;
- list/current-generation responses.

### `@agentintersect-world/config`

Adds a validated, safe repository-file limit with a default of `2500` and a hard maximum of `10000`. Node-only parsing remains behind `@agentintersect-world/config/node`.

### `apps/local-server`

Adds an in-memory `RepositoryIndexService` composition root around `repo-indexer` with bounded operation history, progress, cancellation, idempotency, last-good generation activation, and cleanup on server close.

### `apps/web`

Adds a browser-only typed client and visible repository-index workflow while retaining Phase 2 authority health/configuration and demo-operation behavior.

### `packages/persistence`

Remains skeletal. Phase 3 last-good generations are intentionally process-memory-only. Durable SQLite persistence and restart recovery are deferred until a later phase explicitly needs them.

## Discovery and safety contract

1. Resolve the selected root with `realpath`; reject missing paths and non-directories with stable validation errors.
2. Normalize relative output paths to forward-slash POSIX form and sort deterministically.
3. Never follow symlinks. Count skipped symlinks; do not read targets.
4. Always exclude at least `.git`, `node_modules`, `vendor`, `dist`, `build`, `coverage`, `.cache`, `.turbo`, and Playwright/test-result output directories even if tracked.
5. For Git roots, discover cached/untracked non-ignored files using hardened metadata-only Git argument arrays.
6. For non-Git roots, apply fixed exclusions plus root `.gitignore` through `ignore@7.0.6`. Nested-gitignore completeness is not required in this first non-Git slice and must be documented truthfully.
7. Use trusted system Git only for metadata; disable hooks, fsmonitor, pagers, optional locks, prompts, submodule recursion, and system attributes/config where applicable.
8. Never use shell interpolation, `shell: true`, `eval`, dynamic imports from the target, package managers, repository scripts, hooks, or repository binaries.
9. Default maximum indexed files: `2500`; hard maximum: `10000`.
10. Maximum content-hash size per file: `2 MiB`; maximum cumulative hashed bytes: `64 MiB`. Oversize files remain metadata records with `contentHash: null` and `oversized: true`.
11. Detect binary files from known extensions and a bounded byte sample. Binary metadata may be reported without interpreting content.
12. Yield cooperatively during traversal/hashing so cancellation is observable. Cancellation must settle promptly in the synthetic large-fixture test.
13. A failed or cancelled attempt must not replace the last successful generation.
14. Keep at most 20 index operation records in newest-first order.
15. No selected repository is mutated: no lock files, databases, caches, generated files, Git changes, or sentinel execution artifacts may appear inside it.
16. Coverage `prunedEntries` counts traversal entries or Git candidates directly observed and excluded. A pruned directory counts once regardless of how many descendants it contains. Git-ignored candidates hidden by `git ls-files --exclude-standard` are not exhaustively enumerated, and ignored vendor trees are never scanned merely to total their files.

## Metadata output

A successful generation includes at minimum:

- generation ID and stable fingerprint;
- canonical root and repository name;
- start/completion timestamps and duration;
- Git presence, branch, HEAD, and dirty state;
- sorted directory records;
- sorted file records with path, size, file kind, optional language, binary/oversize flags, bounded content hash, and Git status;
- package-manifest records for at least `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, and `pom.xml` with safely extracted names when available;
- coverage totals for discovered/indexed files, directly pruned entries, skipped symlinks, directories, packages, binary/oversize files, and bytes hashed.

Timestamps and generated UUIDs are excluded from the deterministic fingerprint. Unchanged indexed input and Git metadata must produce the same fingerprint.

## Local API

Preserve every Phase 2 route and add:

- `POST /repository-indexes`
  - body: `{ rootPath: string }`;
  - requires `idempotency-key`;
  - first creation returns `202`;
  - identical replay returns `200` with the same operation and replay header;
  - same key with a different root returns correlated `409 conflict`.
- `GET /repository-indexes`
  - newest-first bounded operation list.
- `GET /repository-indexes/current`
  - returns `{ generation: null }` before the first success and the last-good generation afterward.
- `GET /repository-indexes/:id`
  - current operation/progress/result/error.
- `POST /repository-indexes/:id/cancel`
  - idempotent cancellation.

Register `/repository-indexes/current` before the dynamic `/:id` route. Add generated OpenAPI coverage for the new paths without breaking the existing Phase 2 document.

On Fastify close, cancel active index work and wait for its cleanup before resolution.

## Operator UI

Retain the Phase 2 local-authority summary and demo-operation flow. Add a repository-index section with three numbered steps:

1. **Step 1 — Select and index repository**
   - labeled repository-root text input;
   - blue Start index / Rescan action when valid and idle;
   - no automatic indexing on page load.
2. **Step 2 — Cancel current index**
   - blue only while running;
   - grey and disabled otherwise.
3. **Step 3 — Review repository metadata**
   - visible Current index status/progress;
   - visible Last good generation result;
   - repository/Git identity, fingerprint, counts, packages, and a bounded file preview;
   - clear empty, cancelled, failed, unavailable, and succeeded states.

Polling must run only while an index is active and be cleaned up on terminal state/unmount. Current/last-good labels and action errors remain reachable. No content may clip, overlap, or create horizontal page overflow at the supported desktop viewport.

## Required RED → GREEN evidence

Implement tests before or alongside each slice and record initial RED reasons. Required regressions include:

### `repo-indexer`

- valid non-Git root indexing;
- real temporary Git root with branch/HEAD/status;
- fixed ignored/vendor paths excluded;
- root `.gitignore` honored for non-Git roots;
- symlink and external-target skip;
- language/file-kind/package classification;
- binary and oversize handling;
- unchanged rebuild fingerprint equality;
- changed file or Git state changes relevant metadata/fingerprint;
- malicious package script and Git hook sentinels are never executed;
- invalid root/non-directory rejection;
- cancellation/progress and bounded limits.

### Local server/service

- create/replay/conflict/list/get/cancel/current-generation API behavior;
- last-good generation preserved after cancellation and injected failure;
- operation history bound and close cleanup;
- stable correlated errors and OpenAPI paths.

### Web

- typed client schema/error handling;
- polling terminal-state cleanup;
- numbered controls and Current/Last good presentation;
- Playwright against a disposable repository: fill path, start, observe progress/success, verify metadata, rescan same fingerprint, start a larger fixture and cancel, retain last good.

### Architecture/tooling

- browser packages cannot import the Node-only repo indexer directly or transitively;
- smoke creates and removes a disposable repository, indexes it, and verifies no sentinel execution;
- fresh-copy verification uses a Phase 3 prefix and runs the complete aggregate command.

## Parent acceptance commands

Run through Node 24 and pinned pnpm:

```bash
npx --yes --package=node@24 --call \
  'corepack pnpm@11.15.0 install --frozen-lockfile'

npx --yes --package=node@24 --call \
  'corepack pnpm@11.15.0 exec vitest run packages/repo-indexer/test apps/local-server/test/repository-index.test.ts apps/web/test/repository-index-client.test.ts tooling/scripts/architecture.test.ts'

npx --yes --package=node@24 --call \
  'corepack pnpm@11.15.0 check'

npx --yes --package=node@24 --call \
  'corepack pnpm@11.15.0 verify:fresh'
```

Parent also performs:

- manual live API proof against a disposable Git and non-Git repository;
- deterministic rescan comparison;
- cancellation and last-good preservation proof;
- selected-root before/after mutation comparison;
- live browser flow and visual/console inspection;
- listener/process/temp-root cleanup verification;
- `git diff --check`;
- one bounded read-only Phase 3 audit;
- one targeted correction pass only if the audit confirms blockers;
- affected regressions plus aggregate retest after any correction.

## Frozen non-goals

- Accessing, indexing, diffing, hashing, testing, or modifying `/home/mela_ai/AgentIntersect`.
- Executing target repository scripts, hooks, package managers, binaries, shell/PTY commands, or arbitrary code.
- Durable SQLite/database persistence or restart recovery.
- Background filesystem watchers; Phase 3 uses explicit manual rescan.
- Nested `.gitignore` completeness for non-Git roots.
- Symbol/AST parsing, dependency/call graphs, search ranking, embeddings, or LSP integration.
- Spatial layout/rendering, avatars, agents, worker mutation, terminals, chat, Yjs, PartyKit, multiplayer rooms, or Phase 4+ behavior.
- Public-internet ingress, unrelated users, cloud multi-tenancy, enterprise auth/policy matrices, or broad security hardening.
- Releases, tags, package publication, public visibility, or repository settings changes.

## Phase exit gate

Phase 3 is complete only when:

1. the repository-index vertical slice works against parent-created temporary Git and non-Git roots;
2. deterministic rebuild, progress/cancellation, last-good preservation, no-execution, no-mutation, and bounded-resource tests pass;
3. focused, aggregate, build, Playwright, smoke, and fresh-copy checks are green under Node 24/pnpm 11.15.0;
4. live API/browser behavior and cleanup are parent-observed;
5. one bounded audit is complete;
6. confirmed audit defects are fixed once if needed and parent-retested;
7. Phase 3 report/status/design/handoff/index are updated;
8. the completed commit matches private `origin/main`.

Phase 4 does not begin automatically.
