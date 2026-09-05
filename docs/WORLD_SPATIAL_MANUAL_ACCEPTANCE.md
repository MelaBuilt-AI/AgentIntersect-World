# World spatial screens — manual acceptance

Status: first-hand verdict pending. Commit/push and technical CI are authorized; merge and auto-merge are explicitly held until Aaron tests and authorizes the next step.

## Scope

Test the current spatial panels, camera framing/zoom, repository-object code inspection, and preserved World View spacing. This is not the deferred full Slice 6 create/build/validate/iterate acceptance and does not authorize changes to original AgentIntersect.

Use the fresh candidate URL in the handoff. The operator owns all browser actions and consent. Candidate state is isolated; do not reuse a retained earlier acceptance generation. Stop and report a missing prerequisite rather than switching to the protected production service.

## Checklist

1. Enter World normally with your selected avatar/agent. Confirm normal camera framing, movement, and wheel zoom.
2. Toggle **Alt+1**, **Alt+2**, and **Alt+3** to move Live/Director, Workbench Workstream, and World View between their existing HUD positions and freestanding World screens. A preview needs an actual current Workstream/preview; an unavailable preview is not an accepted test.
3. Hold left-click on each movable screen's **base**, move it, and release. Stand in front and use its controls. Check readability, frame/content alignment, avatar foreground occlusion, accessible bases, and absence of clipped controls. Escape should cancel a grab without opening another menu.
4. Toggle each screen back to its HUD position and into World again. Confirm its state survives. For World View, confirm the same preview remains interactive and the expanded 2D view has usable height. Preview input must not move the avatar.
5. Load your chosen repository using the normal World flow. Left-click a file object in the repository city. Confirm the in-world code screen belongs to that object and displays its actual current working-file text. Folder/package objects should offer their indexed files, not invented source.
6. Click the code to frame the view. Scroll; confirm the code moves but the avatar and World zoom do not. Check that other HUD elements do not cover it.
7. Press **Alt+4** to inspect fullscreen. Scroll further, then press **Alt+4** again. Confirm the screen returns to the same object with your new scroll position preserved.
8. Use Escape / Return to World to release focus. Close code and confirm the ordinary HUD and World controls return. Select a different object and confirm the source changes correctly.

## Verdict

Report PASS or the first failed step, what you expected, what actually happened, and a screenshot/video when useful. Passing automated checks is not a manual verdict. Report untested steps explicitly, especially any preview-dependent step without an available preview.

Leave the candidate running until testing is complete or cleanup is explicitly requested. WSL/host shutdown stops its listeners; use the recorded owner-aware manager to verify/restart rather than starting duplicate servers.
