# Repository object code screen

## Local implementation contract

- Left-click a Repository City object to open one read-only code inspection screen beside that exact object. Selecting another object replaces the selection, not the existing three HUD/spatial panels.
- Click the screen or Focus view to frame its face for reading. Scrolling and keyboard inspection must not move the avatar or zoom the World. Return to World releases focus.
- Alt+4 toggles the same mounted scroll viewport between fullscreen 2D and its original object-anchored World pose; preserve scroll position. Accessible buttons provide the same actions. Escape returns from fullscreen/focus before opening the World menu.
- Read actual current selected-repository text through an explicit bounded read-only endpoint. Resolve object references against server-owned current selection; do not accept filesystem roots from the browser. Directories/packages list indexed descendant files instead of inventing source. Manual/unlinked objects and unavailable/binary/oversized files show truthful explanations.
- Text is rendered literally, never executed. Current-generation identity and bounded file reads prevent wrong-repository results; indexed-file allowlist and canonical containment prevent arbitrary filesystem access.
- Supported: existing local/trusted-LAN World, imported and procedural renderers; WebGL failure falls back to 2D. Standard-risk feature; focused API/unit checks, relevant type/build/lint, and a production-shaped browser/pixel proof. Aaron's manual verdict remains separate.
- No editing, saving, agent execution, commits/pushes, publication, protected-service changes, original AgentIntersect changes, or full Slice 6 acceptance.

## Implementation

- `RepositoryCodeScreen.tsx` keeps one read-only, line-numbered viewport mounted while the screen switches between an object-bound World pose and a fixed fullscreen dialog. The camera fits the selected screen on code-click; Return to World / Escape restores the prior view. Alt+4 works independently of Alt+1/2/3.
- Files open directly. Directory/package objects list their indexed descendants. Decorative instances without a repository reference show an explicit unavailable state; no source content is invented.
- Existing 2D panel HUDs are hidden (not unmounted) while the code screen is open. Chat/navigation/status overlays are additionally hidden during focused reading. Closing restores them. Viewport wheel events scroll the code rather than the camera, including CSS3D Chromium compositor cases.
- `GET /api/world/repository-code?objectRef=...&fileRef=...` reads from the server-selected repository only. It validates indexed object/file membership, resolves canonical paths within the root, refuses non-regular or binary files, caps reads at 512 KiB, and uses `Cache-Control: no-store`. It returns current working-file text, not an immutable historical generation; there are no edit/save/execution controls.

## Verification boundary

The API tests use a real disposable repository, including source content, directory membership, foreign references, and an outside-root symlink rejection. The browser journey uses explicitly synthetic source text to check real mesh picking, camera framing, scrolling, fullscreen round trips, mounted-node/pose retention, and HUD restoration. Automated technical evidence is not Aaron's hands-on visual acceptance, and does not resume the deferred full Slice 6 acceptance journey.
