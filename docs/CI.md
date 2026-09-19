# Proportional CI

World's `phase-1-checks` workflow separates development feedback from merge acceptance. Normal Git pushes need no special commands.

## Routing

- **Feature-branch push:** the existing core checks (format, lint, types, architecture, unit tests, build and smoke). No complete browser journeys or measurement lanes.
- **Draft PR:** core feedback; it does not satisfy `merge-gate`.
- **Ready PR with code/configuration changes:** core, measurements, all six flagged browser shards and the unflagged browser suite. `merge-gate` succeeds only when every required lane succeeds.
- **Documentation-only change:** Markdown formatting plus `merge-gate` on a ready PR. The allowlist is deliberately narrow: root Markdown and Markdown under `docs/`. Fixtures, workflow files, unknown paths and mixed code/docs changes retain code coverage. Both sides of renames are checked.
- **Main or tag push with code changes:** full acceptance, preserving protection for direct changes. Main runs are not automatically cancelled.
- **Manual workflow dispatch:** full acceptance regardless of changed paths.

Feature pushes and ready-PR updates no longer both launch the expensive browser matrix. Newer runs supersede older runs for the same event/ref, not across unrelated branches or push/PR events. Core is intentionally a small complete non-journey gate, rather than a fragile source-to-test dependency guess across built workspace packages. Some unit/smoke checks use Chromium; the long browser journeys are the avoided work.

`.github/scripts/ci_scope.py` classifies actual Git changes, including new branches, deletions and renames. It also verifies final dependency results; failed, cancelled or unexpectedly skipped required jobs cannot pass a gate. Routing tests exercise real temporary Git histories and the parsed workflow. No existing browser assertion, timeout, threshold, shard selection or retry policy is changed here.

## Merge policy

Use **`merge-gate`**, not a fast `push-checks` result, as the required status check on `main`. Aaron explicitly approved enabling that requirement after this change passes, without adding reviewer requirements. Repository settings are a separate operation and must be read back before claiming protection is active. Do not merge a code PR based only on its feature-push run.

Full pre-merge coverage is still required for shared renderer, navigation and session-lifecycle changes. Documentation-only success means documentation checks passed—not that browser tests ran. Full runs and branch-policy activation are recorded in the PR/handoff so status documentation does not create recursive SHA/CI cycles.

## Local cadence

Run focused tests for the changed behavior and relevant lint/type/build checks. Reuse current proof for untouched behavior. Run the affected browser journey when interaction changes, broader browser coverage for shared runtime changes, and native/manual visual checks when the changed behavior needs them. Do not rebuild underneath a retained user test environment.
