# Application restart continuity

## Scope approved September 16, 2026

Aaron authorized the recommended bounded continuity slice and a new private PR
(Discord `1549772861923926187`). Base: merged PR13, main `0d88b3a`.

Journey: disposable real project → native Codex Workstream edit/test → approved
healthy preview → completed-turn application shutdown → fresh World backend and
browser with the same saved state → same repository/session/history/worktree →
explicit Continue → healthy preview recovery → one deliberate follow-up edit/test.

This is newly created continuity, not recovery of an older retained operator World.

## Acceptance contract

- Application shutdown and restart preserve project identity, branch/HEAD, dirty
  tracked and untracked files, task, owned worktree, native root session and chat.
- Restoration never dispatches replacement coding work. Continue re-attests the
  exact saved worktree and selected native session; ambiguity is reported, not
  silently replaced with a new session.
- Graceful shutdown stops only owned preview processes. Persisted PIDs are not
  restart signalling authority. The old preview is not reported as currently live.
- Explicit Continue may relaunch the unchanged previously approved preview recipe
  in the same authoritative worktree. A deliberately stopped preview stays stopped;
  failed recovery is visible and does not falsely show a current healthy result.
- A deliberate post-restart iteration uses the same Workstream/native session and
  produces real changes, focused test evidence and an updated healthy preview.
- Built-browser proof covers saved entry/history/Continue and truthful preview
  states. Deterministic browser fixtures are labelled separately from real native
  process/HTTP/Git proof. Aaron's manual visual acceptance remains a separate gate.

## Delivery and boundaries

Direct implementation. Reuse existing persistence/Continue/preview services; add
focused regressions for demonstrated gaps, not a new session abstraction. Run
impacted tests/types/lint/build and one bounded real native proof. Open a private
PR, verify its exact-head CI, and leave merge held for acceptance/authorization.

Supported initial lane: one operator, local WSL Node 24, one disposable Codex
session using existing configuration, completed work before graceful application
restart. No gateway restart or provider/model/configuration changes.

Retain TEST45353/43953 and TEST45351/43951, their browser profiles, state/history
and served builds. Preserve all seven inherited Git residuals. Build the web
artifact to a separate output directory, never over a retained served directory.
Original AgentIntersect is untouched. No WSL/host reboot, Omarchy/environment
matrix, crash-during-active-work promise, multi-agent reconciliation, Workbench
pagination/GitHub breadth, saved layouts, speech timing investigation, Hermes
bookkeeping changes, Phase20, release/tag/publication/deployment or visibility
change is authorized by this slice.

## Status

### Implemented correction

The server already returns `previewResume` from Continue. The browser mutation
client dropped it, and Workbench always showed the generic restoration success.
The client now preserves the bounded outcome and both surfaces show the same
message: restored work is separate from ready, failed, or unnecessary preview
recovery. A later successful retry clears the failed-preview message. No native
session, persistence, execution, process-ownership or consent policy was changed.

### Verification

- Client RED: all three real recovery outcomes were lost. GREEN: 26 client/tracer
  tests pass with the outcome preserved.
- Built-browser RED: the failed-preview diagnostic was absent. GREEN: explicit
  Continue shows failure; retry shows ready and removes stale failure copy.
  Inspected screenshots show legible, contained text.
- Extended the existing real-startup test across an actual backend exit/new PID:
  same session/task/worktree/branch/HEAD, tracked and untracked dirty files,
  unchanged history, old listener closed, no false current preview before
  Continue, and a healthy relaunched approved preview. Its Hermes provider is
  a fixture; this is production composition proof, not real-model evidence.
- Final focused milestone: 47 tests across four files; web/local-server no-emit
  types, scoped ESLint, formatting, package/web builds and diff checks pass.
- Three distinct built-browser journeys pass: Workbench failure/retry, ordinary
  exact-session/history refresh, and the normal explicit-work conversation loop.
  These use deterministic HTTP fixtures, not the real native acceptance provider.
- Real native Codex / production HTTP proof passes: actual initial edit/test,
  graceful backend shutdown, fresh backend PID, identical worktree/files/HEAD/
  branch/task/root session/history, no replacement coding turn, and approved
  preview relaunch. One explicit follow-up in that same native session changes
  the page to `Back for another cup`, passes `node --test homepage.test.mjs`
  (independently rerun), and serves the updated healthy preview. History grows
  from two to four messages only for that deliberate follow-up. Final owned
  preview is persisted stopped/port-closed after cleanup. Receipt and actual
  files are retained under `native-rd1ut_15/` in the evidence namespace.
- Failed harness attempts remain retained: discovery used an obsolete `local`
  environment identity; a later attempt called iteration bookkeeping without
  the separate native message dispatch. These are not product defects or
  evidence for a broader integration PASS.

Evidence namespace: `/home/mela_ai/.hermes/runs/aiw-continuity-20260916/`.
All seven inherited residual hashes remain unchanged. Retained operator Worlds
are not candidates for this code, and no operator visual verdict is inferred.

### Manual acceptance boundary

After technical verification, use a separately paired candidate, not the old
retained TEST, for Aaron's full browser/application close-and-return verdict:

1. Load a disposable checkpointed project and create one real Workstream. Verify
   its actual code, test result, and explicitly approved World View.
2. Finish the turn, note the agent/worktree/branch, and close/restart the candidate
   application components while retaining their saved state and browser profile.
3. Re-enter the same project/session, inspect history, and explicitly Continue.
   Verify no coding turn was sent and preview recovery is stated truthfully.
4. Send one explicit `/work` follow-up, verify same-session edit/test evidence,
   and verify the approved preview updates (or use its explicit Refresh action).

Manual verdict, full browser/application integration, exact-head remote CI and
merge authorization remain individually recorded gates. No WSL reboot,
four-harness matrix, active-turn crash recovery, or Phase20 claim is made.
