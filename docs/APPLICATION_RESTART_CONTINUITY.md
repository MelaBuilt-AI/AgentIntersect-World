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
PR and verify its exact-head CI. The later recovery-polish authorization below
supersedes the original acceptance/authorization hold with a conditional merge.

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

### Original implemented correction

The server already returns `previewResume` from Continue. The browser mutation
client dropped it, and Workbench always showed the generic restoration success.
The client now preserves the bounded outcome and both surfaces show the same
message: restored work is separate from ready, failed, or unnecessary preview
recovery. A later successful retry clears the failed-preview message. No native
session, persistence, execution, process-ownership or consent policy was changed.

### Original baseline verification

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

### September 16 recovery-polish delivery authorization

Aaron (`1549800076539469976`) supersedes the cloud deferral below and authorizes
including its correction and concrete recovery polish in PR14, then commit/push,
merge only once exact-head CI and readiness are green, and prep end session.
The bounded correction criteria are:

- Ordinary Project / Current Work and sibling spatial screens stay below the
  canvas/cloud layer; current camera-depth masks still hide only cloud pixels
  behind nearer screens. Focused code/HUD controls retain their higher layers.
- A restored accepted single-agent World reads the existing repository snapshot
  and restores its city/Workbench repository authority without reindexing,
  dispatching work, or choosing an unrelated recent project. Missing repository
  state must not discard the valid agent/session restoration.
- Successful Continue closes the repository dialog and shows the current-work
  summary, with its truthful recovery message in view. Work Inspector remains an
  explicit action rather than autofocus scrolling that message away. Failed preview recovery stays visible
  with the existing explicit retry; failure must not be disguised by dismissal.

Risk: standard browser presentation/restore wiring. Reuse existing authority,
read-only snapshot, preview and consent contracts. No saved-layout system,
provider/gateway changes, native dispatch changes, test-state reset, Phase20,
public release or publication. Keep retained operator artifacts/state untouched;
verify corrections in an isolated build/browser lane. Automated correction proof
is not a new first-hand operator verdict. Final SHA/CI/merge receipts remain
external to avoid recursive status-only commits.

### Recovery-polish implementation and evidence

- The ordinary spatial screen ranks are 1–4; canvas rank 3 collided with nearer
  DOM stacking ranks. Canvas rank 5 clears every ordinary screen while existing
  cloud depth clipping and focused-screen/HUD layers remain unchanged. A Chromium
  composition regression loads both real stylesheets, compares visible/hidden
  cloud pixels with all four ranks present and asserts their stacking bounds;
  existing physical-shell occlusion tests remain green.
- Single-agent saved entry now calls the existing read-only current-repository
  endpoint and follows the reducer's request → activation transition. It never
  selects a recent-project guess. The browser regression checks restored city /
  repository authority, no restore-time index/intake/work writes, and preservation
  of the accepted native session when saved repository loading fails.
- Continue preserves failed-preview inspection/retry. A successful retry closes
  Workbench, clears the old error and returns to the compact current-work summary.
  An extra viewport assertion reproduced inspector autofocus hiding the success
  message; leaving the inspector explicitly collapsible addresses that visible
  feedback defect without changing process/native recovery semantics.
- Five isolated built-browser journeys passed before the final compact-summary
  adjustment: Workbench failure/retry, ordinary restore, explicit-work discussion,
  spatial-screen interactions and focused code. Nearer shell occlusion and farther
  screen cloud pixels were inspected. The affected feedback/layout retest and
  final CI receipts are recorded externally with their own verification era.
- Camera/layout fixtures that intentionally start on a blank floor now explicitly
  return no saved repository for their first discovery read. Their later explicit
  repository loads still use the normal snapshot; product restoration is not
  disabled to preserve an obsolete test assumption.

Polish evidence: `/home/mela_ai/.hermes/runs/aiw-continuity-polish-20260916/`.
This is deterministic UI/composition evidence. Real native restart and first-hand
operator evidence remain the separately scoped baseline above/below; retained
operator services are not rebuilt or used for automated actions.

### September 16 operator results and historical deferred follow-up

Aaron's Discord report `1549797505435312138` and supplied screenshots establish
the deliberate follow-up completed and everything updated in the same Workstream.
The screenshot shows ready-for-review, two passed checks / zero failed,
preview revision 3, and the current verified preview heading `Back after restart`.
Record this same-Workstream edit/test/preview transition as manual PASS, not an
independent fresh filesystem/native-history audit.

Earlier transitions in this operator journey remain separately recorded:

- Candidate-only service restart and same-profile browser reopen were verified;
  old application processes exited, new backend/proxy health passed, served index
  was unchanged, and protected older tests/gateways retained their identities.
- Avatar/Codex presence returned. Repository selection did not: Aaron manually
  selected the recent repository in Load Repo before saved work became visible.
  Automatic project restoration therefore did not meet the assistant's checklist
  expectation in that build; the later authorized polish adds automatic snapshot
  restoration, with isolated browser evidence rather than a new manual verdict.
- Explicit Continue restored saved work and the verified preview. Aaron reported
  no message to Codex during that step; no backend no-dispatch audit was performed
  on this operator lane. Continue left Workbench open, requiring manual Close
  Workbench: retain this as a completion-feedback/UI-flow observation.
- Aaron manually replaced spatial screens. Do not claim automatic spatial-layout
  restoration; saved layouts remain outside this slice.

**Historical deferral, superseded by the authorization above:** Codex's chat
cloud is occluded by the Project / Current Work spatial screen when Codex stands
between Aaron/the camera and that screen. Expected: the nearer agent's cloud is
in front of the farther screen. Aaron reports other screens work properly;
preserve that behavior in the correction. Supplied image documents the
overlap, not its rendering cause. The original deferral alone authorized no fix;
the subsequent instruction explicitly includes it in PR14.

Evidence retained in
`/home/mela_ai/.hermes/runs/aiw-continuity-test-20260916/operator-evidence/`:
`deferred-codex-cloud-occlusion.png` and `same-workstream-followup.png`.
The operator lane/state/profile remain retained. Successful recovery and follow-up
are qualified by the manual repository/screen steps above; no blanket seamless
restart PASS, merge authorization, cleanup, or Phase20 authorization is inferred.
