# AgentIntersect World — Phase 3 Completion Report

Date: 2026-07-19
Status: COMPLETE
Phase: Repository discovery and deterministic metadata indexing
Baseline: `4a75ca099ca3a5fb0d0c9638cc4eef680c1bdb03` (completed Phase 2)
Version: `0.3.0-phase3`

## Result

Phase 3 delivers a working, operator-started repository metadata index for selected local Git and non-Git directory roots. It discovers and classifies repository content without executing selected-repository scripts, hooks, binaries, package managers, shells, or arbitrary commands. The completed slice includes deterministic fingerprints, bounded hashing, package and Git metadata, observable progress, cancellation, last-good preservation, local APIs, and a numbered browser workflow.

The phase completed its required cadence:

1. frozen scope contract;
2. one Codex implementation worker;
3. parent source/runtime/browser/fresh-copy verification;
4. one bounded read-only audit;
5. one targeted correction pass for three confirmed truthfulness defects;
6. parent targeted re-review and complete retest;
7. no second broad review.

## Delivered functionality

### Repository selection and containment

- User-selected absolute directory root validated through `realpath`.
- Missing paths and file roots rejected.
- Git and non-Git roots supported.
- Symlink entries skipped; targets are never followed or read.
- Fixed vendor/build/cache exclusions applied.
- Git roots honor `git ls-files --exclude-standard`.
- Non-Git roots honor fixed exclusions plus the selected root's `.gitignore`.

### Deterministic metadata

Each successful generation contains sorted, schema-validated:

- canonical root and repository name;
- directories with file counts;
- files with relative POSIX paths, size, language, file kind, binary/oversize flags, bounded content hash, and Git status where applicable;
- npm, Python, Cargo, Go, and Maven package manifests with safe best-effort names;
- Git presence, branch, HEAD, and dirty state;
- coverage and bounded-work totals;
- SHA-256 generation fingerprint.

Operation IDs, timestamps, and duration are excluded from the stable fingerprint. Unchanged rescans of the same root/config produce the same fingerprint; relevant content or Git metadata changes produce a different fingerprint.

### Frozen limits

- Default file limit: 2,500.
- Configurable hard maximum: 10,000.
- Per-file hash limit: 2 MiB.
- Cumulative hash budget: 64 MiB.
- Repository-index history: 20 newest operation records.
- Browser file preview: first 12 deterministic records.
- Persistence: process memory only.
- Rescan: explicit/manual only; no background watcher.

`coverage.prunedEntries` is deliberately a bounded observation, not an ignored-file total. A non-Git ignored directory counts once because descendants are not scanned. Git-ignored candidates hidden by `git ls-files --exclude-standard` are not enumerated merely to count them.

### Safe package and Git reads

- Package manifests are read as bounded text only; package scripts are never run.
- Maven names are accepted only from one unambiguous direct `project/artifactId`; parent, dependency, and plugin artifacts are ignored, while malformed/ambiguous identity returns `null`.
- Git is invoked only as the trusted host executable with argument arrays.
- Hooks, fsmonitor, pagers, prompts, optional locks, submodule recursion, global/system config, system attributes, and external diff behavior are disabled for metadata reads.
- Selected repository fixtures remained byte-identical and no execution sentinel appeared.

### Service and API

The in-memory `RepositoryIndexService` provides:

- asynchronous progress;
- idempotent creation and conflict detection;
- idempotent cancellation;
- terminal succeeded/cancelled/failed states;
- last-good activation only after success;
- preservation of last good after cancellation or failure;
- bounded newest-first history;
- active-task abort and await during server close.

API surface:

- `POST /repository-indexes`
- `GET /repository-indexes`
- `GET /repository-indexes/current`
- `GET /repository-indexes/:id`
- `POST /repository-indexes/:id/cancel`

The generated OpenAPI document remains 3.0.3 and exposes 12 total application paths after the Phase 3 additions.

### Browser workflow

The Phase 2 authority/demo operation flow remains available. Phase 3 adds:

1. **Select and index repository** — explicit path input and Start/Rescan action.
2. **Cancel current index** — enabled only during active work.
3. **Review repository metadata** — distinct Current index and Last good generation cards.

The UI performs no automatic index on page load. It polls only while an operation is running and cleans timers on unmount. Last-good presentation now distinguishes:

- loading;
- successful empty state (`None yet`);
- unavailable/invalid response with an alert;
- successful generation;
- recovery from an initial error after a successful index.

Actionable controls are blue and disabled controls are grey. Desktop and 390 px mobile verification showed no horizontal overflow, clipping, or overlap; long paths and fingerprints remain contained.

## Parent verification

All commands used Node 24 and project-pinned pnpm `11.15.0`.

| Verification             | Final result                                                                    |
| ------------------------ | ------------------------------------------------------------------------------- |
| Frozen install           | 15 workspace projects, green                                                    |
| Focused Phase 3 tests    | 4 files / 22 tests, green                                                       |
| Formatting               | Prettier, green                                                                 |
| Lint                     | ESLint, green                                                                   |
| Typecheck                | 19/19 Turborepo tasks, green                                                    |
| Architecture checker     | 14 packages, no violations                                                      |
| Architecture regressions | 9/9, green                                                                      |
| Complete Vitest suite    | 13 files / 54 tests, green                                                      |
| Production build         | 13/13 tasks, green                                                              |
| Disposable smoke         | Git/non-Git index, no-execution, no-mutation, demo operations, built web, green |
| Playwright               | 6/6, green                                                                      |
| Fresh-copy verification  | full aggregate green for 132 source files                                       |
| `git diff --check`       | green                                                                           |

### Live API and repository proof

Parent-created disposable fixtures proved:

- HTTP 200 health with matching correlation header/body;
- OpenAPI 3.0.3 with 12 paths;
- non-Git ignore/vendor/symlink/binary/oversize/package behavior;
- unchanged rescan fingerprint equality;
- changed content fingerprint inequality;
- package bytes unchanged;
- package-script sentinel absent;
- Git branch, HEAD, dirty state, tracked modification, and untracked status;
- Git-hook sentinel absent;
- create 202, replay 200 with same ID, conflict 409;
- cancellation reaches `cancelled`;
- cancellation preserves the exact prior last-good generation.

All disposable repositories were removed after verification.

### Browser and visual proof

- Desktop screenshot: `/tmp/agentintersect-world-phase3.png` (354,412 bytes at capture).
- Mobile screenshot: `/tmp/agentintersect-world-phase3-mobile.png` (273,362 bytes at capture).
- Desktop viewport: 1,440 px; document/client width both 1,440 px.
- Mobile viewport: 390 px; document/client width both 390 px.
- Browser console/page errors: zero.
- Active button color: `rgb(37, 99, 235)`.
- Disabled button color: `rgb(75, 85, 99)`.

## Sole bounded audit and correction

The one read-only audit initially returned FAIL for three Moderate truthfulness defects:

1. `ignoredFiles` implied an exhaustive file count although traversal pruned directory entries.
2. Maven extraction could select a parent/dependency/plugin artifact instead of the direct project artifact.
3. Failure to load the initial last-good endpoint rendered `None yet`, falsely claiming known absence.

One targeted correction pass fixed all three:

- renamed/documented the bounded count as `prunedEntries` and added an exact pruned-directory regression;
- added bounded direct-project Maven extraction with parent/nested/missing/ambiguous fixtures;
- added explicit last-good loading/ready/error state and three Playwright regressions for loading, unavailable, invalid response, and successful recovery.

The correction also added cumulative 64 MiB hash-budget coverage and moved disposable smoke setup under cleanup protection. Parent targeted re-review inspected each fix and reran focused, aggregate, browser, and fresh-copy checks successfully. No second broad audit was run.

## Deferred non-blocking scope

- Generations and operation history are lost on server restart.
- Non-Git ignore behavior reads only the selected root's `.gitignore`; nested completeness is deferred.
- Git-ignored candidates hidden by `exclude-standard` are not enumerated for exhaustive counts.
- No filesystem watcher or automatic rescan exists.
- Browser polling stops and exposes the message after a polling request error; retry policy is deferred.
- No symbol/AST/call graph, spatial renderer, agents/workers, terminals, chat, PartyKit/Yjs, database, unrelated-user, public-ingress, or Phase 4+ behavior was added.

## Scope and repository compliance

- The Phase 3 implementation, audit, and correction workers did not access or modify original AgentIntersect.
- The parent's separately authorized read-only identity/dashboard visual inventory is documented as a future Phase 5 decision and did not enter Phase 3 code.
- No selected repository was executed or mutated.
- No GitHub settings, visibility, release, tag, or package publication action occurred during implementation/review.
- The World repository remains private.

## Next milestone

**Phase 4 — World object model, deterministic identity, and layout.**

Phase 4 should consume the completed Phase 3 generation rather than rebuilding discovery. The accepted original-AgentIntersect identity/avatar/dashboard extraction remains scheduled for Phase 5 and must not be pulled into Phase 4.
