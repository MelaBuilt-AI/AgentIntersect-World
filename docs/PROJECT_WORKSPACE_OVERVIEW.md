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

Direct implementation with focused RED/GREEN, affected type/lint/build and isolated production-browser proof. Update migrated callers/tests rather than retaining misleading labels. Open a private PR; the initial hold pending first-hand acceptance is superseded by Aaron’s September 15 acceptance and conditional delivery authorization below. Aaron subsequently authorized closing the old TEST45345, launching a fresh matching TEST after implementation, leaving it running, and preparing the end-session handoff. Preserve the old saved profile/history on disk. No provider/gateway changes, automated native coding dispatch, history deletion, publication, releases, Phase20, original AgentIntersect changes, or historical residual staging.

## Verification

- Focused RED→GREEN for contextual code questions, default overview/optional arrangement, current-worktree binding and snapshot-derived diff/validation; skipped checks do not invent a passed source event.
- Final web suite: **81 files / 426 tests passed**. Web and root non-emitting typechecks, scoped ESLint, formatting and whitespace checks passed. Monorepo build: **20/20 tasks successful**; final normal frontend rebuilt after the last metadata correction. Existing large-renderer chunk advisory remains unchanged.
- Four distinct production-browser journeys passed across scoped attempts: normal Workstream conversation/contextual source draft; source spatial/fullscreen scroll continuity; no-WebGL prop placement; spatial screen movement/projection/Reduced Motion/fallback. The corrected overview clears Escape and keeps Arrange visible; pixels inspected. Final metadata-only source-event correction was covered by its RED/GREEN plus final web suite, not claimed as a new complete browser matrix.
- Preserved failed attempts: overview geometry regression before CSS correction; migrated spatial helper initially assumed one toggle although Arrange now contains three. Assertion now checks the explicit set without weakening disabled-state or motion checks.
- Initial PR13 was draft/unmerged during review. Exact-head hosted CI remains distinct from first-hand acceptance; final PR/merge receipts are recorded externally. No native coding dispatch or operator acceptance is inferred from fixture-driven browser proof.

## September 15 operator corrections

Aaron reported two native dropdown popups escaping their spatial screens, move-handle text wrapping incorrectly, and a Codex conversation activity object incorrectly labelled Mr Fluff. He accepted the other tested behavior and additionally authorized placed-prop manipulation. Aaron subsequently passed the corrected behavior (`1549581992486641685`), requesting only vertical centering of the footer text. That final CSS adjustment is verified separately; he explicitly waived another manual test and authorized commit/push, green CI/readiness, conditional merge, merged-main green and end-session handoff.

- Object/category menus now render in-flow inside the same transformed/scrolling screen, with mouse and keyboard selection.
- Manual visual-only props support held left-button floor dragging, held-wheel rotation and release placement. Live repository objects keep their existing layout authority. Pointer cancellation, Escape, blur and hidden-page transitions end the hold. Layout remains local to the open World.
- The footer uses separate title, movement instruction and rotation instruction columns. Its fixed-height grid centers content with zero vertical padding so wrapped instructions remain contained and vertically balanced.
- City activity labels use the same selected-agent presentation identity as the chat status, preserving multi-agent aggregate labels.
- Verification: 541 web/renderer tests across 98 files passed; affected typechecks, scoped lint and production build passed. The dedicated production-browser fixture journey passed spatial-menu containment, footer geometry, Codex-named activity, real prop drag/rotation, camera-zoom exclusion and release. Captured pixels inspected. This is fixture-driven rendering/input proof, not native Codex execution or manual acceptance.
- Fresh review URL: http://127.0.0.1:45353/ (readiness tracked in the run README). Prior TEST45351 state/profile and all seven inherited residual files are preserved. The retained TEST is not rebuilt/reloaded for final footer alignment; delivery uses the source candidate and exact-head CI.

## Completed operator review scope

1. In the fresh TEST, complete your own avatar/agent setup and load a repository. A no-remote starter repository is provided by the TEST launcher; old history is preserved separately, not imported.
2. Check Project / Current Work in empty/current/completed states; use its Workbench, New Workstream and work-details controls.
3. Click a file, inspect source, then Ask about this. Confirm the chat draft names the selected file and correct repository/worktree branch; it must not send automatically.
4. Perform your chosen real Workstream task. Inspect changed-file source, diff and validation objects; they should open the existing source/details surfaces.
5. Open Arrange workspace, move/project screens, focus/pin an object, reveal Visual-only props, place/remove a prop and close arrangement. Live work should continue; props must not create work.

Saved layouts and spatial planning remain future scope. This is a local open-World arrangement, not persistence across reload or a new task engine.
