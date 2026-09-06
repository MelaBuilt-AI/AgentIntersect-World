# Code World projections — manual acceptance

## Latest sky candidate — three streaming layers

Aaron rejected both constellation versions and requested the supplied aurora + foreground nebula + rear downward Matrix rain (`1545986320525041675`). This supersedes all constellation/twinkle instructions below. New authorized manual preview target: **http://127.0.0.1:45275/** under `~/.hermes/runs/aiw-aurora-retest-20260905/`; check its README/receipts for actual launch state. Older 45273/45274 generations are not updated.

- Complete normal entry; no repository or Workstream task is needed for a sky-only test.
- Aurora curtains and foreground nebula must visibly stream on separate currents with transparent dark areas; rear terminal rain falls downward at 25% opacity.
- No dome rotation or constellation patch animation remains. Reduced Motion holds all layers.
- Check standing-still appearance/comfort, then normal look/walk. Preserve previously accepted screens/grid/floor; report changed sky PASS/FAIL separately from conversational-follow failure, which is not fixed here.

## Boundary

New follow-up PR from the accepted spatial-screen baseline, not a reopening of PR #7. **Manual verdict: MIXED — screens/grid/floor accepted; sky refinement and conversational follow unresolved.** The automated fixture journeys are technical proof only. The full real-repository Slice 6 product loop is separate. Do not merge or clean up retained generations without Aaron's instruction.

The corrected operator runtime was launched at **http://127.0.0.1:45273/** under `~/.hermes/runs/aiw-code-world-retest-20260905/`. Its frozen build does not include the subsequent sky refinement. The older 45272 runtime is stopped with state retained. Historical initial-launch records follow. Exact commit/CI, runtime ownership and entry-readiness receipts are external under `~/.hermes/runs/aiw-code-world-manual-20260905/`; technical proof is under `~/.hermes/runs/aiw-code-world-20260905/`. Check that root's README and `last-verification.json` for actual launch status rather than assuming this document proves liveness.

## September 5 corrected retest — operator report

Discord `1545972568798793838`: Aaron reports screens, grid expansion and floor/screen textures worked perfectly. Whole-sky rotation is too strong and potentially motion-sickness-inducing; this criterion fails. Conversational Codex follow produced a claim of following but no movement; `/agent follow` remains untested (not `/follow`). Preserve these independent verdicts.

Authorized sky refinement keeps the accepted floor/screens unchanged, reduces global motion to a tiny bounded sway, adds independently phased local motif rotations with pinned edges, and two sparse softly twinkling star layers. First-hand comfort must be retested on the new build; existing 45273 is not silently updated.

## Earlier September 5 operator corrections — historical

Aaron reported a camera snap on Alt+1 and an invisible movement boundary at the old floor edge, and requested flowing code artwork with rotating/twinkling sky. Local corrections preserve camera state during HUD/spatial toggles, share monotonic floor bounds across rendering/user/agent/screen movement, permit Director placements in expanded space, and animate the existing artwork while honoring Reduced Motion. **This paragraph describes the pre-45273 correction; see the latest verdict above.** Prior repository-city code-projection PASS is preserved, not generalized to the changed behavior.

## Start — corrected command semantics

1. In the intended generation, complete Create Avatar and onboarding yourself, select **Codex**, and create a new World-owned agent session/avatar. No session, message, consent or native dispatch should be pre-attached by preparation.
2. Use `load repo` / Repository Intake for the disposable demo. `Let's pick up work on the spatial-screen demo` also opens intake; the shorter `Let's pick up work` is ordinary agent chat and creates no Workstream. Repository visualization does not change the native chat workspace.
3. If you choose to start real inspection work, grant Collaborate and send `/work start Inspect this demo without changing files`. This allocates/binds a Workstream and dispatches a real task; the text requests no changes but is not a read-only sandbox or setup-only command. Confirm an actual Current Workstream before opening Workbench/World View and starting the prepared **Disposable spatial-screen demo** recipe. Await preview readiness before screen checks. This is not the full Slice 6 acceptance project. Exact routing/UI/service tests passed; the corrected live Codex sequence remains untested.

## Checklist — stop at first failure

- **No camera snap:** turn/look up or down and zoom first; toggle Alt+1/Alt+2/Alt+3 HUD → World → HUD. Your view, position and focus must not jump. Explicit code-focus remains a separate intentional camera action.
- **Animated artwork:** floor code drifts beneath a stationary structural grid; screen shell code flows; the same constellation motifs gently turn locally, with sparse layered twinkle and barely perceptible bounded whole-sky sway—not a sweeping/spinning room. Check side/back shells, not only DOM contents. Reduced Motion must hold all three animations still.
- **Usable expanded space:** walk/sprint past the former boundary in every direction. Agents should be able to follow into that area; screens and Director objects should remain placeable there. After repository/content/travel expands the floor, use that new area and return; floor size must not shrink.

- **Scene continuity:** watch the initial repository load. The floor and avatars must remain present while new city objects appear. In Director, drop an asset type not already present; existing objects must not disappear/replay their entrance. Try another drop, then return to Live.
- **Code-built environment:** inspect the larger floor, constellation sky, terminal-rain backs/sides, lighting and shadows. Walk around screens to see their backs. Check readability, clipping and performance at your normal window size. Code artwork is decorative, not live repository evidence.
- **Footer-only movement:** Alt+1 / Alt+2 / Alt+3 put Live/Director, Workbench and World View into World. On each, left-click and hold the bottom `Hold here to move` strip; move and release. Holding the projection glow or screen content must not drag the panel. Right click must not drag it. Overlapping panels/avatars may occlude part of a footer; use an exposed portion.
- **Held-wheel rotation:** while still left-holding the footer, scroll both directions, keep moving, then drop. The new facing and position must remain. Wheel without holding still zooms the unobstructed World; panel/code/preview scrolling must not zoom it. Escape during a hold releases movement without opening the menu.
- **No physical bases:** each general screen has a subtle floor-up projection instead of a stand. A repo code panel rises from its selected object, with light originating from the object rather than a separate screen base.
- **Repo code orientation/reveal:** approach an object from one view direction and click it. The smaller code screen progressively opens upward and faces that opening view without snapping your camera. Rotate/walk afterward: the open screen must retain its original orientation. Close it, approach from another direction and reopen; its facing must change for that new opening. Reduced Motion should open immediately.
- **Code inspection:** click code to focus. Scroll, use Alt+4 for fullscreen, scroll further, return with Alt+4; the same viewport and latest scroll position must remain. Escape releases focus; Close code returns to the normal World. Keyboard inspection can select an offscreen object; Alt+4 makes its controls accessible without moving the camera.
- **Growth:** the floor starts at 68 units per side (formerly 34). Larger loaded repository snapshots and in-session object/user/screen extents can expand it; removing content or moving back must not shrink it during this World session. Rendering remains bounded independently of repository size.
- **Carry-forward controls:** toggle all panels HUD → World → HUD → World. Verify preview input/counter/scroll state, no World View flicker at oblique angles, usable Workbench controls, and no Asset Inspector overlap at the end of the palette.

Report each criterion PASS/FAIL and the first failing transition; include a short video for motion/flicker. Automated green does not supply your verdict. Keep the lane intact for diagnosis if anything fails.

## Retained runtime

User requested this candidate remain running across session handoff. Neither this candidate nor the old 45270 / 45271 generations should be reloaded, rebuilt in-place, stopped or deleted casually. The README supplies generation-owned read-only verification and separately authorized stop commands. Detached processes survive chat rotation, not necessarily host shutdown, WSL shutdown, sleep or process failure.
