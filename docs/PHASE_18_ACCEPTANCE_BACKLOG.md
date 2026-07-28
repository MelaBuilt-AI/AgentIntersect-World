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

## Live Hermes Same-Session Conversation Acceptance — FIFO / LONG-RUN / REFRESH / FORMAT / ACTIVITY PASS

On 2026-07-28 Aaron manually completed the separate live-agent test through the normal `/` product path. A loopback-only authenticated Hermes Sessions API exposed exactly one pinned native root under the independent AgentIntersect display identity `Mr Fluff` while preserving the native session title. World accepted `hi fluff are you live?`, streamed real tool-status events, and returned later ordinary assistant responses to the persistent conversation box. Aaron directly observed and celebrated those replies. This was the true active Discord lineage—not a fixture or copied snapshot—and it passes the bounded ordinary Single Agent Hermes same-session text round trip.

The earlier `prep end session` attempt remains historical failure evidence because it ended in `chat unavailable_` after backend side effects. Aaron has now first-hand accepted the bounded retest: the long/tool-heavy final response appeared inside World, and his screenshot shows the final delivered handoff message. The complete browser → World → Hermes → World long-run delivery path therefore passes for this candidate.

The conversation-immediacy correction uses a single-flight FIFO queue rather than disabling the composer while Hermes works, and hydrates authoritative user/assistant history from the exact session. Aaron accepted the queue first-hand: while the first health/time prompt was still running, he typed and submitted a second prompt, saw `1 queued`, and received the second prompt exactly once after the first. Browser refresh also preserved the visible chat history.

Aaron's first refresh still returned through agent connection selection, agent-avatar creation, and `Enter World`. Parent live-shape diagnosis subsequently proved that the rebuilt candidate restores a valid exact-session pointer directly into World against the real persisted session, including the 409 live avatar-proposal path and accepted authoritative-history fallback. Aaron has now manually refreshed the rebuilt live preview and confirmed that the chat remained present with the `prep end session` response visible. Direct refresh restoration therefore passes first-hand. The path remains fail-closed: no silent native-root switch and no ambiguous in-flight resend.

The formatting/activity correction is now implemented without a new dependency. Assistant messages use bounded React-only structure for paragraphs, headings, lists, blockquotes, fenced/inline code, and strong emphasis; raw HTML remains escaped. Activity remains `working` after tool completion/failure and assistant final events, with bounded `terminal`, `reading`, or `tool` detail, and becomes `done` only after the outer send plus awaited repository-floor work completes.

Parent verification passed focused Vitest **51/51**, impacted web/renderer Vitest **189/189**, focused Playwright queue/refresh **2/2**, monorepo typecheck **38/38**, production build **20/20**, explicit Vite build, and diff hygiene under Node 24. The rebuilt preview is serving the new bundle. A no-click exact-session proof restored directly into World through the real status 200 / proposal 409 / history 200 path, hydrated 42 transcript items, and structurally rendered 19 assistant messages with no executable script elements. Aaron then manually confirmed that refresh preserved the chat and visible `prep end session` response, the formatting was clean, and the real tool-chain activity bubble worked perfectly without an intermediate `done`. Refresh, formatting, and truthful activity therefore pass first-hand; this bounded UX slice is accepted.

Checkpoint caveat: a subsequent complete `check:core` run reached **665/666 tests passing** and failed only at the fail-closed Phase 18.5 native-hardware evidence validator because the accepted activity-bubble change altered `world-room-canvas.tsx`. The previous native metrics remain bound to the previous source fingerprint and were not rewritten. Phase 18.5 requires a fresh native hardware capture when resumed; the recovery checkpoint is not a Phase 18.5 performance seal.

The adapter still advertises no voice input/output capability and push-to-talk remains unavailable. Voice remains after refresh and chat/activity acceptance and should reuse the already accepted Phase 15 consent/privacy/local-STT/optional-TTS contracts. The bounded live coding gate remains open.

## Required Next-Session Sequence

1. Preserve the accepted exact-session FIFO queue, authoritative transcript hydration, long/tool-heavy delivery, direct refresh, structured formatting, and truthful activity behavior.
2. Preserve exact-session fail-closed behavior, single-flight FIFO delivery, and no ambiguous in-flight resend.
3. Wire the accepted Phase 15 consent/privacy/local-STT/optional-TTS contracts into the normal same-session World path when that next slice is authorized.
4. Preserve the bounded live coding gate as open until one disposable feature journey is proven through World.
5. Commit/push privately and require exact-SHA CI only after the consolidated candidate and cleanup/rollback plan are green and Aaron authorizes delivery.
6. Seal Phase 18 only after Aaron explicitly accepts the remaining voice and coding experience.

Revised Phases 19–20 remain not started and unauthorized.
