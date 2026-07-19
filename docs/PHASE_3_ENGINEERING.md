# Phase 3 Engineering — Repository Discovery and Deterministic Metadata Index

Date: 2026-07-19

## Delivered behavior

Phase 3 adds an explicit, operator-started metadata index for local Git and non-Git directory roots. The Node-only indexer resolves the selected root through `realpath`, never follows symlinks, applies fixed vendor/build/cache exclusions, and produces sorted directory, file, package, Git, coverage, and bounded SHA-256 metadata. Generated IDs and timestamps do not participate in the stable fingerprint.

Git roots use the trusted host Git executable only through argument arrays. Calls disable hooks, fsmonitor, pagers, prompts, optional locks, submodule recursion, global/system Git configuration, and system attributes where applicable. Target repository scripts, hooks, package managers, binaries, dynamic imports, and arbitrary content are never executed.

Non-Git roots use `ignore@7.0.6` for fixed exclusions and the selected root's `.gitignore`. Nested `.gitignore` completeness is intentionally deferred.

The local server keeps at most 20 newest repository-index operation records in process memory. Creation is idempotent, progress is observable, cancellation is repeatable, and failed/cancelled work cannot replace the last successful generation. Server close aborts and awaits active index tasks. No database or restart recovery is claimed.

The browser retains the Phase 2 authority and demo-operation flow and adds three explicit repository steps: select/start or rescan, cancel active work, and inspect Current index plus Last good generation. It performs no automatic indexing on page load and polls only while an operation is running.

## Supported environment and configuration

- Node 24 on the current WSL/Linux host.
- pnpm `11.15.0` through Corepack.
- Loopback by default, with the existing explicit trusted-LAN mode.
- `AIW_REPOSITORY_MAX_FILES` defaults to `2500`, accepts `1..10000`, and is included in the safe configuration projection.

## Frozen limits

- Files per generation: default `2500`, hard maximum `10000`.
- Content hash per file: at most `2 MiB`.
- Cumulative content hashed per generation: at most `64 MiB`.
- Repository-index operation history: 20 newest records.
- Symlinks: always skipped; targets are not read.
- File preview in the browser: first 12 deterministic records.

Coverage `prunedEntries` is a bounded traversal/candidate count, not an ignored-file total. Each directory excluded during non-Git traversal counts once and its descendants are not scanned. For Git roots, candidates omitted by `git ls-files --exclude-standard` are not enumerated; only directly observed candidates pruned by fixed exclusions contribute.

Files larger than `2 MiB` remain metadata records with `oversized: true` and `contentHash: null`. Once the cumulative hash budget is exhausted, later files remain metadata records without a content hash.

## Verification commands

Run from the repository root:

```bash
npx --yes --package=node@24 --call \
  'corepack pnpm@11.15.0 install --frozen-lockfile'

npx --yes --package=node@24 --call \
  'corepack pnpm@11.15.0 exec vitest run packages/repo-indexer/test apps/local-server/test/repository-index.test.ts apps/web/test/repository-index-client.test.ts tooling/scripts/architecture.test.ts'

npx --yes --package=node@24 --call \
  'corepack pnpm@11.15.0 check'

npx --yes --package=node@24 --call \
  'corepack pnpm@11.15.0 verify:fresh'

git diff --check
```

The aggregate check includes formatting, lint, typechecking, architecture checks, unit/integration tests, production builds, disposable Git/non-Git smoke indexing, Playwright browser flows, no-execution sentinels, and cleanup.

## Non-goals

- Durable SQLite/database persistence or restart recovery.
- Background filesystem watchers or automatic indexing.
- Complete nested `.gitignore` behavior for non-Git roots.
- Symbol/AST parsing, dependency/call graphs, search, embeddings, or LSP behavior.
- Spatial/3D rendering, agents/workers, terminals, chat, PartyKit, Yjs, or Phase 4+ functionality.
- Public-internet ingress, unrelated users, cloud multi-tenancy, or broad hardening.
- Executing or mutating selected repository content.
- Release, tag, publication, visibility, remote, or repository-settings changes.
