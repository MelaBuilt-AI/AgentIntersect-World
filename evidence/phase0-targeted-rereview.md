# Phase 0 targeted High-risk re-review

Date: 2026-07-19
Reviewer: targeted read-only Codex `gpt-5.6-sol` / high
Scope: only the two frozen blockers from the initial review

## Verdict

**APPROVED**

## Blocker 1 — fixed

The pinned preflight now performs exact Git, package, Node-major, cleanliness, and six-file SHA-256 validation using read-only Git operations with optional locks disabled. Its only local dependency is the acyclic temporary-root helper.

All four capture functions await preflight before workspace creation, checkout CLI execution, or checkout module import. The regression exercises all four against a drifted disposable clone with CLI/module sentinels and verifies:

- preflight rejection;
- no sentinel execution;
- no capture-workspace side effect;
- deterministic clone cleanup.

Relevant implementation and regression:

- `packages/agentintersect-client/src/checkout-preflight.ts`
- `packages/agentintersect-client/src/phase0-harness.ts`
- `packages/agentintersect-client/test/preflight-temp-root.test.mts`

## Blocker 2 — fixed

The temporary-root helper hard-codes canonical `/tmp`, rejects unavailable/non-directory/non-canonical roots, rejects both checkout-overlap directions, creates only attested `/tmp` workspaces, and forces `TMPDIR`, `TMP`, and `TEMP` for child processes.

The poisoned-environment regression observes the disposable protected checkout and `/tmp`, verifies capture activity only under `/tmp`, checks protected entries/HEAD/status/diff, and restores all variables deterministically. Health-attestation workspaces use the same helper.

Relevant implementation and regressions:

- `packages/agentintersect-client/src/safe-temporary-root.ts`
- `packages/agentintersect-client/test/preflight-temp-root.test.mts`
- `packages/agentintersect-client/test/compatibility.test.mts`

## Newly introduced critical blocker

None.

## Evidence inspected

- Exact staged blobs
- Dependency graph/cycle structure
- Staged and worktree diff checks
- Pinned checkout HEAD/origin/main/branch/status
- Independent SHA-256 verification of all six pinned sources
- Cached Node 24 checkout-preflight execution
- Parent-provided focused result: 2 passed, 0 failed
- Parent-provided full result: 12 passed, 0 failed

The reviewer could not repeat the focused `npx` invocation because its read-only environment encountered transient network resolution failure. This did not invalidate the separately observed parent execution or the reviewer’s direct source and cached-preflight inspection.

## Exit gate

**Phase 0 High-risk exit gate: SIGNED.**
