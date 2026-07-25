# Phase 18 First-Hand Acceptance Correction Backlog

Status: USER RETESTED / CORRECTIONS REQUIRED / NEXT-SESSION IMPLEMENTATION AUTHORIZED

Recorded: 2026-07-25

## Authority

Aaron completed a clean native-browser Phase 18 fixture-assisted retest after parent verification and exact-SHA CI. His direct observations and four annotated captures are authoritative acceptance evidence. Phase 18 remains open and must not be called user accepted or sealed until these corrections are implemented, independently verified, and retested first-hand.

Evidence:

- `artifacts/phase18/user-retest/01-avatar-grounding-profile.jpeg`
- `artifacts/phase18/user-retest/02-avatar-grounding-rear.jpeg`
- `artifacts/phase18/user-retest/03-transcript-composer-alignment.webp`
- `artifacts/phase18/user-retest/04-agent-button-spacing.jpeg`

## First-Hand Behaviors That Passed

- Clean first launch and avatar creation completed.
- Single Agent → `hermes_` → Mr Fluff → World completed.
- Chat composer accepted text and sent messages.
- Persistent transcript and compact spatial activity/status presentation worked.
- The approved repository request transformed the current floor as expected.
- Native responsive browser filling worked without the previous fixture-imposed viewport size.

The acceptance API was a bounded fixture. Its “Hello Mela” text was not a live Hermes response and is not evidence of live continuity.

## Required Corrections

### 1. Ground every avatar on the floor surface

Observed in captures 01 and 02: the human and cat avatar lower legs/feet intersect the floor plane.

Acceptance criteria:

- Align the lowest visible foot/paw geometry with the rendered floor surface; no feet, paws, or lower legs may penetrate the plane.
- Derive the placement from the actual avatar/model bounds or one canonical species-aware ground offset rather than a camera-dependent visual fudge.
- Preserve correct grounding for human, cat, and dog variants in blank-floor and repository-floor states.
- Cover front, rear, and oblique camera views and movement updates with renderer/browser regressions.

### 2. Couple the controlled avatar’s heading to the camera heading

The user-controlled avatar must face the same horizontal direction as the third-person camera view. Rotating the camera must rotate the controlled avatar with it so forward movement and visual heading agree.

Acceptance criteria:

- Horizontal camera yaw updates the controlled avatar yaw continuously.
- Pressing forward moves in the direction the avatar and camera face.
- Noncontrolled agent avatars do not mirror the user camera unless their own behavior directs them.
- Heading remains stable across movement, repository-floor transformation, focus changes, and responsive resizing.

### 3. Replace click/pointer-lock camera entry with hold-right-mouse look

Current left-click/persistent lock behavior is rejected.

Acceptance criteria:

- Pressing and holding the right mouse button over the 3D canvas enters camera movement mode.
- Releasing the right mouse button exits camera movement mode immediately.
- Left click does not enter camera movement mode.
- The browser context menu is suppressed only for the deliberate canvas right-drag gesture.
- Typing/focusing the composer never rotates the camera or moves the avatar.
- Keyboard-only and reduced-motion paths remain usable; no permanent pointer capture survives release, blur, visibility loss, or route change.

### 4. Reverse both current mouse-look axes

Both horizontal and vertical camera deltas currently move opposite the intended direction.

Acceptance criteria:

- Moving the held-right-mouse gesture right turns the view right; left turns left.
- Moving upward pitches the view upward; downward pitches downward.
- Automated tests assert both axes and would fail if either direction is inverted again.

### 5. Link transcript and composer bottom alignment responsively

Capture 03 shows the lower-left transcript panel ending above the bottom of the bottom-center composer. Its bottom border must align with the composer’s bottom border at every supported viewport.

Acceptance criteria:

- The transcript and composer share one responsive bottom anchor/layout track; do not use unrelated hard-coded pixel offsets.
- Their bottom edges remain aligned across native desktop, narrower desktop, mobile/forced-colors, zoom, and resize.
- Preserve transcript readability, independent scrolling, composer reachability, and no horizontal overflow.

### 6. Move all four agent-selection buttons farther outward

Capture 04 marks the desired outward placement for `openclaw_`, `hermes_`, `claude_`, and `codex_`.

Acceptance criteria:

- Move upper-left/upper-right/lower-left/lower-right buttons farther from the center toward the annotated outer boxes.
- Keep each button paired with its correct colored endpoint and connector.
- Use responsive/radial constraints rather than one fixed desktop-only offset.
- Preserve visibility, keyboard focus order, hit targets, active-blue/disabled-grey truth, and mobile containment.

### 7. Make all agent addressing use the avatar’s chosen user name

The fixture replied “Hello Mela” even though the user avatar was named Aaron. This is rejected as a fixed-name assumption.

Acceptance criteria:

- Derive the current user display name from the canonical saved avatar/identity state and include it in the agent/session context where addressing is supported.
- Fixture responses must use the current saved name rather than a hard-coded name.
- Future live Hermes acceptance must prove the response can address the current user name dynamically; test at least `Aaron` and one different name.
- Do not claim a live-agent pass from fixture output.

## Live Hermes Follow-Up

A live-agent test is intentionally separate from this fixture-assisted UI run. The next suitable session may provision a bounded temporary product-facing Hermes Sessions API exercise after confirming the exact setup authority. It must use the normal `/` product path, preserve the user’s selected avatar name, exercise a real existing Hermes/Mr Fluff session, retain truthful event/transcript provenance, and clean up without provider/profile/core mutation unless separately authorized.

## Required Next-Session Sequence

1. Invoke `find handoff` and read this backlog before editing.
2. Implement all seven corrections with focused RED → GREEN regressions.
3. Run independent source/diff review, focused renderer/UI tests, production browser journeys at native and responsive sizes, and the complete pinned aggregate.
4. Commit/push privately and require exact-SHA CI only after the corrected candidate is green.
5. Launch another clean native-browser first-hand retest; use fixtures only with explicit labeling.
6. If separately authorized and available, run the bounded live Hermes Sessions API exercise.
7. Seal Phase 18 only after Aaron explicitly accepts the corrected experience.

Revised Phases 19–20 remain not started and unauthorized.
