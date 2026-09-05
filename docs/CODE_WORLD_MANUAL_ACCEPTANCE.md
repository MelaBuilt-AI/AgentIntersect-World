# Code World projections — manual acceptance

## Boundary

New follow-up PR from the accepted spatial-screen baseline, not a reopening of PR #7. **Manual verdict: PENDING.** The automated fixture journeys are technical proof only. The full real-repository Slice 6 product loop is separate. Do not merge or clean up retained generations without Aaron's instruction.

Fresh runtime planned at **http://127.0.0.1:45272/**. Exact commit/CI, runtime ownership and entry-readiness receipts are external under `~/.hermes/runs/aiw-code-world-manual-20260905/`; technical proof is under `~/.hermes/runs/aiw-code-world-20260905/`. Check that root's README and `last-verification.json` for actual launch status rather than assuming this document proves liveness.

## Start

1. Use the fresh **45272** native Edge window. Complete Create Avatar and onboarding yourself, select **Codex**, and create a new World-owned agent session/avatar. No session, message, consent or native dispatch is pre-attached by preparation.
2. Send `Let's pick up work on the spatial-screen demo`. If asked for a path, use `/home/mela_ai/.hermes/runs/aiw-code-world-manual-20260905/demo-repository`.
3. Create a Workstream with `/work start Inspect this demo without changing files`. Grant Collaborate only if you choose. Use its World View action and the prepared **Disposable spatial-screen demo** recipe. This is a real no-remote disposable repository and preview, not the full Slice 6 acceptance project.

## Checklist — stop at first failure

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
