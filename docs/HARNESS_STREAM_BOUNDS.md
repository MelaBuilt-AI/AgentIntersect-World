# Harness stream accounting correction

> **Delivery update — September 20:** Aaron1551395372600008805 accepts this cumulative PR slice and authorizes commit/push, then merge PR20 only after exact-head CI and readiness pass. Earlier LOCAL/UNCOMMITTED, pending-verdict, no-delivery and runtime statements below describe historical stages, not current authorization. Final commit/CI/merge receipts are recorded on PR20 and in the session handoff. TEST45399 is retained; PR19, releases, signing and public visibility remain separate.

## Scope and diagnosis

Aaron1551279192631410880 authorized correcting the observed OpenClaw event-bound failure and checking Codex, Claude Code and Hermes for the same failure class. Keep operator TEST45393, project files, preview, native conversations/configuration and persisted failure/quarantine unchanged. No replay, deployment, recovery-state rewrite, provider change or Git delivery authorized.

Read-only operator evidence: Beans correctly inherited Codex's uncommitted website in the AG test1 repository, changed title/body and corresponding test expectation, wrote passing receipts and completed natively (`session.ended success`, aborted=false). World recorded an event-bound failure. Current preview HTTP200 bytes match the actual Beans worktree; previous Codex files remain separate. Raw gateway frames were not retained, so their exact composition is unknown. Native trajectory had10 tool calls, not1024.

## Implementation

- OpenClaw: discard irrelevant session/run and unused telemetry before semantic tool-event accounting. Assistant fragments use existing text byte limits, not the tool count. Replace the unrelated whole-connection frame-count ceiling with a finite16MiB aggregate wire-byte ceiling; retain1MiB per-frame,32KiB delta and64KiB assistant-output limits. Keep1024 normalized tool-activity events and the existing finite turn deadline. Excessive relevant tool activity requests one exact-run abort; ambiguous disconnects still quarantine.
- OpenClaw completion: a valid final reply confirms native termination immediately, removes the stream/failure/abort listeners and timer, then drains already-enqueued World callbacks. Subsequent irrelevant events/socket close cannot turn that completion into a false failed/quarantined turn. A prior real budget/cancel failure still wins over a late final; a matching terminal can confirm the native run ended without relabeling the failed turn successful.
- Codex: reproduced valid1100-fragment response failing old1024 raw-line ceiling. Count normalized tool activity instead. Existing stdout/stderr/per-frame/output/time limits, expected-session validation, terminal requirement and successful process-exit checks remain.
- Claude Code: same reproduced fragmentation failure and correction. Existing envelope/session validation, permission-denial semantics, byte/deadline/process cleanup and successful result/exit requirements remain.
- Hermes: reproduced valid1100-delta SSE response failing the raw-event ceiling. Count normalized tool activity instead. Keep1MiB stream, per-event/delta/final bounds, strict sequence/session/continuation checks and required assistant/run/done terminals. No Hermes service, profile or plugin edits.

No general stream framework or adapter API change; four native adapter implementations and their owning tests changed. No frontend change.

## Proof

137 tests across5 affected files PASS:

- phase19-openclaw-session-adapter.test.ts
- phase19-codex-session-adapter.test.ts
- phase19-claude-code-session-adapter.test.ts
- phase12-agent-sessions.test.ts
- workstream-feature-loop.test.ts

Focused REDs reproduced all four premature count failures and the OpenClaw post-final callback-drain race. GREEN verifies success and a subsequent same-session turn, no leakage of other-session text/private reasoning, aggregate-byte and tool-event bounds, exactly-one abort, valid late-terminal precedence, and existing malformed/oversize/cancellation/quarantine/identity behaviors. The broader run retains Workstream inheritance tests. OpenClaw's terminal-before-abort-receipt test awaits actual fixture request observation rather than assuming callbacks share timing.

Server typecheck, focused ESLint, Prettier, git diff --check and corrected backend build PASS. All four compiled adapters import under pinned Node24.18.0. These are real local WS/HTTP/CLI fixture integration tests, not new live provider calls or manual acceptance. No UI bytes changed, so prior handoff browser evidence is not rerun or relabeled.

Corrected backend: `/home/mela_ai/.hermes/runs/aiw-stream-bounds-20260920/backend/dist/index.js`. Preserve backend/package.json and node_modules link. Standard dist layout includes the static preview CLI; do not pair the next frontend with the old backend. Existing TEST45393 remains running its older copied runtime, with the historical blocked/quarantined connection untouched. Next gate: explicitly authorized replacement/retest; do not resend the already-completed task or erase evidence as recovery.
