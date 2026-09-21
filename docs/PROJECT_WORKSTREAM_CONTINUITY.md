# Repository Workstream continuity across World instances

> **Delivery update — September 20:** Aaron1551395372600008805 accepts this cumulative PR slice and authorizes commit/push, then merge PR20 only after exact-head CI and readiness pass. Earlier LOCAL/UNCOMMITTED, pending-verdict, no-delivery and runtime statements below describe historical stages, not current authorization. Final commit/CI/merge receipts are recorded on PR20 and in the session handoff. TEST45399 is retained; PR19, releases, signing and public visibility remain separate.

## State

Authorized by Aaron1551362290605891686 after1551361123599777813. Implemented directly in application source; LOCAL/UNCOMMITTED/PRIVATE. No Git delivery, CI retry, merge, release or provider/profile change.

**TEST45397 is now closed and retained** after the first-hand PASS below. Aaron authorized the sound-effects follow-up and replacement TEST45399 (http://127.0.0.1:45399/), documented in `REPOSITORY_STREAM_AUDIO.md`. Its saved-project library is carried forward; all old roots backing worktrees are retained. The TEST45397 activation details below are historical.

## First-hand acceptance

Aaron1551385127475748967: **PASS**. Loaded the saved projects, explicitly continued a saved Workstream, asked Codex to change the site in a new Workstream, committed, saw the clean **All changes committed / Continue** prompt during Change Agent, switched to Beans and changed the site text from the last commit. This accepts those real continuation/commit/handoff transitions. New repository-stream sounds are a separately authorized follow-up with listening acceptance pending. Replacement of TEST45397 is authorized; retain its saved state/worktrees.

## Cause and correction

- `/home/mela_ai/projects/Diff test 1` and `/home/mela_ai/projects/Beans test 2` contain empty initial-checkpoint main branches. Agent files and the manually committed Beans version live in registered Workstream worktrees, not on project main.
- Previous Workbench discovery read only the current server's archive. Worktree restoration also assumed that server's own worktree parent. A fresh server hid valid older work even though its files and records survived.
- `WorktreeAuthority` now discovers selected-repository registered worktrees, resolves an exact saved receipt across state roots, and keeps arbitrary external attach forbidden. Private linked-worktree Git metadata records the latest Workstream store location after persistence. Legacy registered worktrees discover their existing sibling workstreams store without rewriting it.
- `WorkstreamService` merges the highest saved revision for the selected repository, verifies the exact worktree association, reads archived source without activating current work, preserves report evidence on explicit Continue and publishes the new store location. Missing native sessions are not queried for nonexistent event history. Restored current-work projection resolves the original path after restart rather than returning stale empty file metadata.
- Workbench exposes **Inspect saved files** independently from **Continue saved work**. File inspection is read-only and does not bind an agent, create a task or dispatch coding. Continue uses the existing explicit confirmation; it is the step that activates saved work in the current World.

## Recovered originals

Real application-service proof located and read all five retained Workstreams:

- **Diff test 1:** three records, including Codex's initial website, Beans's committed `Beans 2 test 2 the second!`, and Mr Fluff's uncommitted `this is fluffs turn`; `index.html` and `test_homepage.py` retained. Original validation counts3/2/2 read back for the respective saved records.
- **Beans test 2:** two records containing `Beans is Cute!` and `Mr Fluff is fluffier then beans is cute!`. The older record's historical working status is retained, not presented as proof of a current native run. The later report retains its three validations.
- Original source files, saved record/report bytes, all worktree/source HEADs, branches, staging and status remained unchanged: **17 files and7 Git roots**, verified before/after runtime activation.
- No source copying, relocation, hidden commit, merge into main, native-session replay or historical state rewrite.

## Verification

Evidence: `/home/mela_ai/.hermes/runs/aiw-project-continuity-20260920/`.

- Independent-state-root RED returned empty history for a real existing worktree. GREEN proves discovery, actual source bytes, exact Git target and no current-work activation.
- Legacy/no-locator discovery → explicit continuation → third World rediscovery preserves IDs/branch/source/validation. A second RED caught stale empty file projection after restarting the continued instance; corrected and rerun GREEN.
- Foreign-repository receipt rejected and arbitrary external-path attach remains refused. Existing missing-worktree recovery regressions retained.
- **61 affected tests in9 files PASS**; separate startup chunk-boundary test PASS. Server/web typechecks, affected ESLint, Prettier, production server compilation and production frontend build PASS.
- Final production browser journey **PASS37.8s**, zero skipped/flaky/unexpected: saved-file list/content/close, no new commit/create/iterate during inspection, manual commit and clean Change Agent behavior, explicit source modes and retained canvas. Native/API work in this browser journey is fixture-controlled; actual recovered-file proof is separate and real.
- Initial concurrent verification timed out under observed heavy local load; first browser reached saved-file and clean-commit screenshots but its outer budget terminated it. Preserved failed artifacts; exact orphaned proof servers were identity-closed. Sequential unchanged-source reruns passed, with no weakened assertions/deadlines. A source-probe ESM setup mistake was corrected before execution; not product evidence.

## Current runtime activation

- URL `http://127.0.0.1:45397/`, backend43997, Edge CDP49399. Kit/service remains `aiw-commit-slab-review-20260920`.
- Backend now `/home/mela_ai/.hermes/runs/aiw-project-continuity-20260920/backend/dist/index.js`, with its normal static-preview CLI layout and pinned Node24.18.0.
- New tested frontend copied into current kit/web; prior frontend retained as `web-before-project-continuity`. Prior launcher/readiness saved under proof kit/before-activation. Refreshed owner/readiness/stopper checks pass.
- Pre-restart: existing Codex session idle, no active run/current work. Post-restart: same session IDs and message count, byte-identical agent setup and project catalog. Browser never closed/reset/reloaded by automation.
- Restored the previously selected **Diff test 1** through the production metadata index route; succeeded. Actual current-server history returns all three records and their `index.html` source reads succeed. Both projects were independently proven through the application service; Beans test2 is discovered when selected. No task/agent bind was sent by recovery.
- The old test roots remain backing storage for these existing worktrees and records. Keep them. This is same-machine retained-data continuity, not recovery after deleting directories or automatic transfer through Git clone.

## Operator path / delivery limits

Refresh TEST45397 → load the desired project → Workbench → select its saved Workstream → Inspect saved files. To resume it in the scene, explicitly confirm Continue saved work with the selected connected agent; no coding turn is sent by Continue. Agent conversation recovery, preview relaunch and subsequent real coding remain distinct operator checks.

These production source changes carry into later built/delivered World versions. An already-running or packaged live version does not change automatically; package/publication gates remain separate. Previous handoff/AA/movement/slab/commit-state passes stay scoped; manual acceptance of saved-work recovery and subsequent committed-source coding is PASS as recorded above.
