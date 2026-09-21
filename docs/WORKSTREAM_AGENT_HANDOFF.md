# Cross-agent project continuation

> **Delivery update — September 20:** Aaron1551395372600008805 accepts this cumulative PR slice and authorizes commit/push, then merge PR20 only after exact-head CI and readiness pass. Earlier LOCAL/UNCOMMITTED, pending-verdict, no-delivery and runtime statements below describe historical stages, not current authorization. Final commit/CI/merge receipts are recorded on PR20 and in the session handoff. TEST45399 is retained; PR19, releases, signing and public visibility remain separate.

## Delivery state

Current operator lane **TEST45397** is updated in place with saved-project continuity plus the prior clean-commit/slab corrections. Existing setup, session identity, project catalog and source worktrees are preserved; refresh the page for the new Workbench file inspector. See [PROJECT_WORKSTREAM_CONTINUITY.md](PROJECT_WORKSTREAM_CONTINUITY.md) for recovery proof and current backend/build paths. Prior reported committed/uncommitted handoff passes remain accepted; continuity manual retest pending. Source LOCAL/UNCOMMITTED/PRIVATE; no product commit/push/CI retry/merge/release. Older lane/evidence descriptions below are historical.

### Verified behavior

- A selected single-agent mismatch is rejected before iteration bookkeeping, creation or native enqueue. Exact requested explanatory message is displayed; no false Starting report. Existing multi-agent owner routing remains separate.
- Change Agent checks live Git for the selected agent’s current project Workstream. Dirty work offers commit review / change without committing / Cancel; a clean tree offers clear continuation without another commit. Local commits reuse explicit selected-file Review and Confirm; only a clean result automatically advances. Skipped/cancelled prompts do not commit or start work. Prompt makes the retained World inert, focuses the dialog and supports Escape cancellation.
- New Workstream identifies the prior Workstream and requires choosing current-uncommitted copy, its last commit, or independent project HEAD/exact SHA. Local-only remains delivery intent, not a file-source choice.
- Backend carries `sourceWorkstream` with exact ID/revision/head/mode, validates source ownership/repository and live busy state, copies before binding/dispatch, and persists `origin`. Uncommitted mode copies the current combined staged/unstaged file contents, deletions and non-ignored new files; it does not preserve staging in the destination, create a commit or change the original. Last-commit mode uses that source worktree’s current HEAD, not the parent project’s HEAD.
- Copy bounds:256 changed/new paths and64MiB; changed links/special files are refused with a commit-first fallback, rather than dereferenced. Ignored dependencies/build outputs are not copied. No automatic merge, push, reassignment or live native turn was used for verification.

### Evidence

Root: `/home/mela_ai/.hermes/runs/aiw-agent-handoff-20260920/`.

-106 affected tests/9 files passed (real filesystem/Git, actual create-route schema, source-before-dispatch, source file/index/HEAD preservation, stale/busy/foreign refusal, existing Workstream/commit behavior, UI/static tests).31 affected UI/model tests reran green after final modal changes. Server/web typechecks, focused ESLint, formatting and git diff --check passed.

- Final normal build and **2/2 production-browser journeys PASS**, no skips/flakes: complete handoff prompt/commit/skip/cancel/Escape, retained canvas, exact source request modes, wrong-owner no-dispatch/report, and prior four-harness switch/chat/refresh/movement journey (`browser-final/results.json`). Backend actions in this browser proof are fixtures; source copying/commit isolation has independent real-Git backend coverage. Not a claim of a new native-agent manual handoff.
- Final desktop/portrait captures inspected: opaque readable source choices and reachable scroll-contained actions. Initial fixture attempts omitted repository/Workstream activation and later used an ambiguous error locator; retained separately. A modal-inert RED was corrected, and background-text bleed was removed.
- Corrected backend compiled under `backend/dist/` (with module manifest/dependency link at backend/). Exact registered `dist/static-site-preview.js` CLI independently served real prior native-proof HTML HTTP200 and its owned listener closed (`preview-cli-smoke.py`); no repeat of the prior relocated-layout launch mistake. Frontend: normal `apps/web/dist`.
- Browser-proof43770/45173 listeners absent after final run. Operator45391 browser, runtime owners, worktrees and native sessions preserved; it still serves its copied PRE-handoff frontend/backend.

Next: separately authorized updated test of clean-state messaging and persistent slab visibility. Both reported handoff paths and prior AA, movement/Dig and World View passes remain accepted at their reported scope.

## Frozen scope

Scope: keep existing Workstream ownership and isolated branches; do not reassign active work. Preserve live TEST45391 and its source files/runtime.

Acceptance:

- Reject single-agent /work against another agent's Workstream before iterate/create/native dispatch or report emission.
- Change Agent with same-session owned repository work offers review/confirm local commit, skip commit, cancel; no commit or task merely by opening/switching.
- New Workstream names its source and supports current uncommitted files (tracked modifications/deletions + non-ignored untracked files, no hidden commit) or that Workstream's last local commit; keep explicit source-repository HEAD/SHA path for independent work.
- Copy source into a separate target branch/worktree before binding or dispatch; original worktree/index/branch/HEAD unchanged. Preserve durable source ID/head/mode. Refuse active, stale, wrong-repository or unavailable sources before allocation/dispatch.
- Reuse existing local Git review confirmation; no push/PR/merge or provider configuration changes. No automatic change to main, no ignored-file/dependency copying, no copying external symlink targets. Explain excluded ignored files.
- Verify focused backend filesystem/branch tests, request schema, actual UI prompt/skip/commit/cancel and source choices on normal production build. Existing manual lane remains untouched pending separate new-test request.

## September20 — committed-state detection and retained slab visibility

User request:1551309048689860661. Direct implementation; no delegated worker. Existing private dirty branch retained; no product commit/push/CI retry/merge/release, provider/profile mutation or operator reload/rebuild/task replay.

### Corrections

- `AgentChangeWorkDialog` now reads the exact source Workstream's real Git status when opened. A manually committed clean tree shows **All changes committed**, its current short SHA, **No new commit needed**, and **Continue to Change Agent**. Dirty files retain review/skip; loading/error do not assume clean and failure offers Retry. An empty unborn tree is described as clean without claiming a saved commit.
- `RepositoryGitPanel` supplies commit-result status to its callback. Selected-file commits that leave edits do not automatically advance agent switching.
- Live read-only CDP inspection located the reported `test_homepage.py` object at(-10.5,0,-13.5). Geometry, original material, opacity and mesh visibility remained intact; its completed materialization parent was invisible while the separate rain and click/code surface survived.
- The arrival wrapper had imperatively revealed its body but permanently declared `visible={false}` to R3F. A genuine Suspense hide/show cycle left it hidden because R3F restores declared visibility; the completed frame callback had already stopped. A once-per-completion React state update now keeps declared visibility true. No per-frame force-show, asset replacement, remount, shortened animation or graphics downgrade.
- The exact historical trigger that first hid the owner's object was not captured. The live state and a deterministic real-R3F reproduction establish the failure mechanism, rather than claiming a traced historical event.

### Verification

Evidence:`~/.hermes/runs/aiw-commit-slab-20260920/`.

- Commit-state RED: source Workstream Git status was never queried. Focused GREEN covers clean manual commit, dirty remainder, loading, status failure and unborn clean state.
- Real renderer RED: same object UUID, completed assembly, visible before suspension but invisible after resolving it. Corrected GREEN preserves the same UUID and visibility; actual `01-code-slab.glb` final pixels separately inspected and complete. Zero page errors. `red/`, `green/`, `glb-green/` retain receipts/screenshots. These are isolated renderer proofs, not an automated repair of the operator page.
- Affected suite **144 tests /26 files PASS** (renderer suite + relevant Workbench/embodiment/UI tests). Startup chunk-boundary test separately PASS. Renderer/web typechecks, affected ESLint, Prettier, diff-check and production build PASS. Final inline-SHA presentation change additionally reran its five tests, lint/format and production browser proof.
- **Final production-browser handoff journey PASS43.5s**, zero skipped/flaky/unexpected tests, strict page-error list empty: dialog commit, explicit manual Workbench commit on the selected source, clean prompt despite stale dirty Workstream projection, cancel/continue/skip, retained canvas, wrong-owner refusal and exact new-source modes. API/native work is fixture-controlled; no new real provider coding claimed. Final artifact:kit/web; results:`browser-3-results.json`; clean prompt screenshot under browser-3 inspected for inline SHA, clear actions and no clipping.
- Attempt history retained: first background launcher chose unsupported Node22; all counted build/test/browser gates reran with explicit Node24.18.0. First browser attempt intentionally stopped after discovering a newly written test used region instead of the actual Workbench dialog role; not a product failure. Browser2 passed48.8s; final browser3 also fixes/validates the initially awkward block-style SHA wrapping.
- Owned proof servers43770/45173/45411 closed; operator45395/43995 remains healthy and serves its unchanged copied build. Operator checker has a historical fixed `manualVerdict:PENDING` field; it does not override Aaron's scoped passes above. Edge not clicked, reloaded or closed.

### Delivery boundary

Corrections are **LOCAL/UNCOMMITTED/PRIVATE, technically green, not installed into TEST45395**. Owner retest of the two corrections remains pending a separately authorized updated test lane. Prior cross-agent handoff/AA/movement/World View acceptance remains preserved. Full hosted CI, four-provider live matrix and release artifacts were not rerun. Current tree:45 tracked modifications,10 untracked,0 staged; newest untracked file is `apps/web/test/agent-change-work-dialog.test.tsx`.
