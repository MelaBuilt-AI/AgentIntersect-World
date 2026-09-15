# Project / Current Work workspace

## Approved scope

Aaron approved the Live/Director product audit and all five changes: source inspection plus Ask about this in Code View; Workstream-owned plan/diff/validation/evidence; automatic meaningful city projection; a compact Project / Current Work starting screen; optional workspace arrangement with the raw prop catalog tucked away.

This PR implements those together on top of merged PR12. It does not replace Workbench authority or introduce another task system.

## Acceptance contract

1. The former Live / Director screen is Project / Current Work. Its default is a compact project identity/current-task summary, with actions into existing Workbench/New Workstream/current-work surfaces. Empty, working, blocked and completed states remain truthful. No asset grid or duplicate Work Inspector in the default overview.
2. Code View includes Ask about this, explicitly identifies repository versus current Workstream/branch source, and prepares a contextual chat draft for the selected agent without submitting. Nested file selection must be reflected in the draft. Unlinked props show prop information rather than pretend source; work evidence opens the existing Work Inspector.
3. Current-work objects preserve real Workstream identity. Existing source-path city objects expose current-worktree source when part of the current Workstream; diff and validation objects derive from actual evidence, never model names or assistant prose. Selecting evidence opens existing work details. Completion/failure changes the projected state, never inventing checks.
4. Arrange workspace is optional, with existing screen projection/movement controls and explicit object focus/pin controls. Props are hidden behind an additional disclosure and clearly marked visual-only; placing/removing props does not execute work. Live work keeps updating while arranging. Persistent saved layouts and a spatial planning canvas are future scope, not this PR.
5. Keep current chat routing, Workstream discussion/explicit iteration, source/worktree identity, preview and native sessions unchanged. Preserve camera/DOM continuity, source scroll/fullscreen behavior, blue-enabled/grey-disabled styling, reduced motion and responsive containment. Retain Alt+1 and the internal screen id for compatibility while changing the displayed name.

## Delivery and non-goals

Direct implementation with focused RED/GREEN, affected type/lint/build and isolated production-browser proof. Update migrated callers/tests rather than retaining misleading labels. Open a private PR; leave unmerged pending Aaron's first-hand acceptance. No provider/gateway changes, native coding dispatch, TEST45345 reload/replacement, history deletion, publication, releases, Phase20, original AgentIntersect changes, or historical residual staging.

## Verification

Implementation and verification in progress. No manual acceptance or CI success claimed yet.
