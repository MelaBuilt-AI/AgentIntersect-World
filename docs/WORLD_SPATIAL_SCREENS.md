# World spatial screens — local implementation contract

Aaron authorized implementation of spatial Live/Director, Workbench Workstream, and World View screens. This supersedes the prior Slice 6 next-action sequence only for these presentation changes. Full Slice 6 acceptance and delivery remain paused.

## Acceptance

- Each existing surface toggles independently between its current 2D HUD location and a freestanding perspective screen anchored in the 3D room: Alt+1 Live/Director, Alt+2 Workbench, Alt+3 World View. Provide equivalent labeled buttons.
- Each spatial screen has a physical frame/stand/base. Hold left mouse on the base and drag along the floor; release drops it. Cancel/blur releases drag ownership. Keep the last placement when toggling back and forth during this World session.
- Screen controls remain real clickable/scrollable/keyboard-accessible controls. Preserve panel state and the preview iframe node across presentation toggles; no duplicate business logic or preview dispatch.
- Spatial World View exposes its existing explicit preview input ownership and Return to World control, without becoming a fullscreen modal. Preview keyboard input must not move the avatar.
- Screen interaction/base dragging must not trigger mouse-look, avatar movement, or repository-object actions. Suppress toggle autorepeat and shortcuts while typing; retain buttons outside cross-origin preview frames.
- Keep 2D as the default and usable fallback when WebGL is unavailable. No rendering-only feature may change Workstream/preview authority, validation, refresh, consent, or agent lifecycle.
- Added by Aaron mid-implementation: single-agent camera framing/distance must match the existing multi-agent defaults (including portrait pullback). Mouse wheel over the World zooms in/out with bounded distance; wheel over UI/screens/previews keeps scrolling that surface.
- Verify focused component/model and browser regressions, impacted type/lint/build gates, and direct pixel inspection. Aaron's manual spatial/interaction verdict remains separate.

## Verification and use

Technical GREEN; Aaron's manual verdict pending. Both production-shaped browser journeys pass against the final rebuilt artifact, with strict feature-owned browser-error assertions intact. Six focused test files pass 78 tests; the separate startup/lazy-boundary test, renderer build, web/root type checks, and affected lint/format checks pass. The existing 2D preview-height correction remains included and verified.

- Alt+1: Live/Director; Alt+2: Workbench; Alt+3: World View. Equivalent buttons work from each surface. Defaults remain 2D.
- Left-hold the physical base or labeled grab strip, drag, then release. Arrow keys on the grab strip nudge placement; Escape cancels the grab at its current position. Positions are remembered in this World session only.
- Right-hold on World: look; WASD/arrows: move; wheel over World: zoom. Existing single/multi framing now matches within each renderer; zoom remains independent of screen placement.
- Use `Interact with preview` for iframe input and `Return to World` to resume avatar controls. Docking keeps that return control available even when preview input is still owned.
- A real WebGL context-loss regression confirms HUD recovery, disabled undock controls, and preserved iframe identity.

Final retained technical receipts/screenshots: `/home/user/.hermes/outputs/world-spatial-screens-2026-09-04-final2/`. Browser run `/tmp/aiw-spatial-screens-final2/`: both selected journeys passed. The JSON receipt enumerates all three unique screen IDs and preserved preview-node/text state. Screenshots are from an automated test scene; they are not a manual real-project verdict. Test servers are stopped. No commit/push/PR was performed.

## Scope and boundaries

Standard frontend feature on the existing local/single-human browser product. Existing approved iframe URLs and backend contracts remain the external boundaries. No new dependency, network service, provider/profile change, repository creation, original-AgentIntersect edit, Phase 20, public exposure, or commit/push/PR/merge is authorized by this work. Preserve the inherited three-path uncommitted spacing correction. Placement is session-local, not synchronized or persisted across reloads in this slice.
