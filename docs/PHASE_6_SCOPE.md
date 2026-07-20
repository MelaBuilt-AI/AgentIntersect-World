# AgentIntersect World — Phase 6 Scope

Date frozen: 2026-07-19
Status: FROZEN SCOPE / PHASE 6 COMPLETE
Risk tier: High-risk persistent-state and external-contract integration, under the project-local functionality-first review budget
Baseline: `344e73d24bdc18f7dcc7e9dc22ec7952eb2960f2` (`0.5.0-phase5`)
Runtime: Node `v24.18.0`, pnpm `11.15.0`

## Objective

Project supported read-only AgentIntersect health, workspace, state, dashboard snapshot, event-feed, and SSE observations into a durable, idempotent AgentIntersect World integration projection. Restart, reconnect, duplicate delivery, and supported out-of-order delivery must converge on the same truthful final state without mutating AgentIntersect or implying worker execution.

## Supported environment and trust model

- One operator using AgentIntersect World and their own AgentIntersect instance on the same computer or trusted LAN.
- AgentIntersect World defaults to loopback and receives explicit configuration for the AgentIntersect daemon URL, dashboard URL, and expected workspace.
- Node 24 is authoritative. Linux/WSL is the required functional environment; code and tests must remain path-portable where the existing project already claims portability.
- AgentIntersect responses, SSE frames, telemetry strings, timestamps, identifiers, and persisted replay files are untrusted inputs.
- The compatibility baseline is the World-owned Phase 0 contract and fixtures pinned to AgentIntersect commit `14c620271cd02e455d3244241de951e00ef77a4d`. The original AgentIntersect checkout is not a recurring dependency and must not be modified.
- Dashboard routes are current private integration candidates, not independently versioned public APIs. Unsupported or malformed contracts fail closed with diagnostics.

## Frozen compatibility matrix

| Source                   | Supported read surface   | Required compatibility behavior                                                                                                                                                                                                                                            |
| ------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AgentIntersect daemon    | health attestation       | Require HTTP 200 JSON, service `agentintersect-daemon/v1`, protocol `1`, live process identity where supported, and exact expected workspace identity.                                                                                                                     |
| AgentIntersect daemon    | `GET /v1/state`          | Parse only the pinned supported state shape needed for phase/session/run projection; preserve unknown fields only as bounded redacted summaries, never as authority.                                                                                                       |
| AgentIntersect dashboard | `GET /api/snapshot`      | Parse the pinned Phase 0 snapshot keys and the bounded phase/session/job/dashboard fields used by World projections.                                                                                                                                                       |
| AgentIntersect dashboard | `GET /api/events`        | Accept the pinned `{ ok, events }` feed, bound the event count and each event payload, and reconcile it with snapshot/state observations.                                                                                                                                  |
| AgentIntersect dashboard | `GET /api/events/stream` | Accept `text/event-stream`, event name `events`, and data frames. The pinned source has no reliable event IDs and does not honor `Last-Event-ID`, so World must use canonical fallback IDs and snapshot/feed reconciliation rather than claiming resumable source cursors. |

Compatibility states are `disabled`, `connecting`, `ready`, `stale`, `offline`, `mismatch`, and `error`. Only `ready` may support a readiness claim. No state may imply authentication, command authority, job dispatch, worker execution, or success.

## Normalized event contract

Phase 6 advances the World event protocol to a concrete versioned normalized envelope. Every accepted observation must produce a deterministic envelope containing at least:

- schema/version;
- canonical World event ID;
- event type and source kind (`daemon-state`, `dashboard-snapshot`, `dashboard-feed`, or `dashboard-sse`);
- source cursor when the source supplies one, otherwise an explicit canonical-fallback cursor;
- observed/occurred timestamps with deterministic ordering rules;
- correlation and supported phase/session/job/run identifiers when present;
- bounded, redacted payload;
- source compatibility metadata and an explicit synthetic/fallback-ID marker.

Canonical fallback IDs must be derived from canonicalized normalized content and stable source coordinates, not arrival order. Duplicate source/fallback events must reuse the same World event and animation ID.

## Persistence and replay invariants

- Use a World-owned SQLite store for uniqueness/dedupe metadata, replay cursor/checkpoint state, source observations, and deterministic reducer state needed for restart recovery.
- Use an append-oriented World-owned JSONL ledger for accepted normalized events.
- Enforce uniqueness transactionally before appending a new logical event; duplicate ingestion must not append a second ledger row.
- Persist only bounded, redacted normalized data. Raw hostile AgentIntersect payloads, secrets, absolute selected-workspace paths, and unlimited telemetry must not be durably stored or displayed.
- A partial/truncated final JSONL record, corrupt record, schema mismatch, or incompatible migration must fail closed with a precise degraded diagnostic and preserve the last verified projection.
- Replay from the ledger and checkpoint must be deterministic. Replaying the same accepted set after restart must yield byte-equivalent normalized final projection and identical event/animation IDs.
- Reconciliation order is health/workspace attestation → daemon state → dashboard snapshot → bounded event feed → SSE continuation. Snapshot/feed reconciliation must recover gaps, overflow/reset, reconnect, and out-of-order cross-source observations without inventing execution.
- Backpressure is bounded: cap queued frames, payload bytes, string lengths, identifier lengths, and retained timeline entries. Overflow triggers an explicit reset/reconciliation diagnostic, not silent loss.

## Required projections and UI behavior

Phase 6 must expose a strict World API projection and integrate it into the inherited Phase 5 shell:

- integration status and compatibility diagnostics;
- current phase board;
- owned-agent/worker roster observations when present;
- bounded normalized timeline;
- replay/reconciliation metadata and stale/offline/mismatch indicators;
- truthful real `ready`/`offline`/`mismatch` state for the currently selected Phase 5 hero harness.

The UI must preserve the user’s operator-flow conventions:

- active controls are blue and disabled controls are grey;
- status/results stay visible and reachable;
- current versus previous/replayed state is labeled where applicable;
- loading, truthful empty, stale/offline, mismatch, malformed/incompatible, and recovered states are distinguishable;
- execution controls remain disabled and explicitly explain that Phase 6 is observation-only;
- no clipping, wrapping, horizontal overflow, or semantic/canvas-only access regression on supported desktop/mobile views.

Harness readiness rules:

- The selected harness can display `ready` only when AgentIntersect health/workspace/contract checks are fresh and the observed state supports that harness without contradiction.
- `offline`, `stale`, `mismatch`, or `error` must override any locally stored Phase 5 selection intent.
- A selected harness never causes a command, worker, process, authentication flow, or external configuration write.

## Required vertical tests and evidence

Use strict RED → GREEN tracer slices. At minimum, test and prove:

1. supported health/workspace/state/snapshot/feed parsing and a ready projection;
2. fake health, process/workspace mismatch, malformed payload, unsupported contract, and offline/stale diagnostics;
3. duplicate feed/SSE/snapshot observations produce one normalized event and one animation ID;
4. canonical fallback IDs are stable across process restart and arrival-order changes;
5. out-of-order cross-source observations reduce deterministically;
6. SSE reconnect, gap, overflow, reset, and backpressure trigger snapshot/feed reconciliation and truthful diagnostics;
7. SQLite dedupe and JSONL ledger survive restart and replay to an identical final projection;
8. partial/corrupt ledger input preserves the last verified projection and fails closed;
9. hostile telemetry, secrets, absolute POSIX/Windows/UNC/file-URI paths, oversized strings, and deep payloads are redacted/truncated before persistence and display;
10. phase/session/job/run mapping drives bounded phase-board, roster, and timeline projections;
11. the selected hero harness displays real ready/offline/mismatch state while every execution action remains disabled;
12. focused browser coverage for normal, empty/offline, mismatch, replayed/recovered, and hostile-data states with accessibility and mobile-overflow checks.

Parent verification must include focused Phase 6 tests, the complete Vitest suite, formatting, lint, typecheck, architecture checks, production build, smoke, Playwright, production dependency audit, fresh-copy verification, live local-server/API/browser proof, restart/replay proof, and cleanup of ports/processes/disposable state.

## Expected artifacts

- Expanded `packages/agentintersect-client` read-only compatibility facade and pinned Phase 6 fixtures.
- Concrete `packages/world-event-protocol` normalized envelope, deterministic IDs, ordering, redaction/truncation, mapping, and reducer contracts.
- `packages/persistence` SQLite dedupe/checkpoint plus append-oriented JSONL ledger and replay support.
- Config/schema additions for explicit AgentIntersect read integration and bounded persistence.
- Local-server integration service and strict read-only World API endpoints.
- Phase-board, roster, timeline, integration-state, and selected-harness readiness UI integrated into the existing shell.
- Focused unit/integration/restart/reconciliation/browser fixtures and tests.
- Version advancement to `0.6.0-phase6` only at verified closeout.
- `PHASE_6_REPORT.md`, updated `PROJECT_STATUS.md`, and updated Phase 6 design status at closeout.

## Explicit non-goals

Phase 6 must not add or invoke:

- job enqueue or any AgentIntersect mutation endpoint;
- safe-pause, cancel, resume, auto-advance, or Emergency Stop mutation;
- MCP resources or MCP command authority;
- harness/worker process launch, claim, execution, completion, or telemetry submission;
- browser-side direct access to AgentIntersect;
- external harness configuration writes or authentication;
- file editing, diff/evidence construction effects, Yjs/multi-view sync, symbol/dependency indexing, 3D avatars, Blender, physics, or XR;
- public ingress, deployment, tags, releases, package publication, or repository visibility changes;
- original AgentIntersect source changes or recurring source-checkout verification.

Phase 7 remains the first bounded command-authority and real-worker milestone.

## Review and authority budget

- One Codex `gpt-5.6-sol`/high implementation worker.
- Parent inspection and independent focused/full/live/fresh-copy proof.
- First-hand operator-style testing immediately after parent proof.
- Audit only when parent/first-hand testing exposes a concrete supported issue or the user explicitly requests one. Do not run a routine post-correction audit or targeted re-audit.
- If testing proves a defect, use one focused regression/correction pass and rerun the affected functional proof; place speculative hardening outside this phase.
- Codex may edit/test only inside `/home/mela_ai/AgentIntersect-World`. It may not commit, push, tag, release, publish, change visibility, modify AgentIntersect, or access unrelated credentials.
- After all gates pass, Mr Fluff may commit and push privately through the user-authorized normal path and must verify exact-final-SHA CI success. No release or publication action is authorized.

## Acceptance criteria

Phase 6 is complete only when all of the following are evidenced:

1. Restart/replay produces an identical final projection and stable IDs.
2. Duplicate input cannot create duplicate timeline or animation IDs.
3. Snapshot, feed, and SSE reconciliation is deterministic.
4. SSE gaps, overflow/reset, reconnect, and out-of-order cross-source events recover truthfully.
5. The selected hero harness shows fresh real `ready`, `offline`, `stale`, or `mismatch` state without implying execution.
6. Every execution control remains disabled and no mutation request is possible through the Phase 6 API/UI.
7. Unsupported AgentIntersect contracts and workspace mismatches fail closed with useful diagnostics.
8. Hostile telemetry is bounded, redacted, and truncated before durable display/storage.
9. SQLite dedupe and the JSONL ledger provide durable idempotent replay without losing the last verified projection on corrupt tail input.
10. Phase-board, roster, and timeline projections are usable and accessible in the inherited shell.
11. Parent focused/full/build/browser/live/fresh-copy gates and first-hand testing pass, with any concretely observed defect resolved and retested.
12. Local `main`, private `origin/main`, and successful GitHub Actions `headSha` match the exact final Phase 6 commit.

## Stop boundary

Stop after Phase 6 documentation, private commit/push, exact-SHA CI proof, index refresh, and continuity updates. Do not begin Phase 7 or any release/publication/public-visibility work without a new explicit user instruction.
