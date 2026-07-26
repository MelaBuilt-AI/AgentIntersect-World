# AgentIntersect World — World Entry Experience

Status: Normative UI/UX re-baseline, frozen 2026-07-25

Implementation status: Revised Phase 18 prior candidate parent-verified and exact-SHA CI green; first-hand user retest found the correction backlog in `docs/PHASE_18_ACCEPTANCE_BACKLOG.md`

## 1. Authority and product principle

This specification governs the normal AgentIntersect World experience. It supersedes older normal-experience language that begins in or navigates through the inherited dashboard. It does not reopen completed Phases 0–17 or invalidate their code, reports, scopes, artifacts, tests, or evidence.

The normal product journey is:

> identity → embodiment → agent calling/connection → enter a 3D space → direct agents by chat/voice → conversationally load a repository → transform the existing floor into the repository landscape

Diagnostics, evidence, recovery, readiness, connectors, lifecycle, and control-plane capabilities remain supported internal machinery. They are not normal-product chrome.

## 2. Frozen product decisions

1. Each named Multi Agent connection happens immediately. `Enter World` appears only after at least two agents are connected and all connected agents have explicit avatars. The user may add more before entering.
2. First launch is animated logo → `identify_` → `Create Avatar`. Later launches show the personalized logo/name, replay `AgentIntersect_`, and offer session selection without forcing avatar creation.
3. Every first-time newly connected agent must pass through an explicit avatar creator. No invisible default is permitted.
4. Multi Agent repeats connect one agent → immediately create its avatar → return to the constellation.
5. A Hermes/OpenClaw name miss types `agent not found_` and permits immediate retry without technical detail.
6. The only required persistent World HUD is a minimal bottom-center chat field and adjacent push-to-talk control.
7. Unaddressed Multi Agent messages go to all connected agents. Avatar click or `@name` targets one.
8. Repository load transforms the entire existing floor. It never opens a portal or separate repository space.
9. The default camera is third-person behind the user avatar. A first-person toggle is optional later.
10. The inherited admin/developer dashboard exists only behind an explicit local developer flag/internal route and has no link from the normal experience.

## 3. Explicit state machine

The normal entry flow must be implemented as explicit states. UI visibility derives from state; it must not infer readiness from elapsed animation time.

| State                   | Required presentation                                                           | Permitted transition                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `boot`                  | Full-screen existing animated logo and nothing else                             | `first_identify` or `returning_identity` after local profile load                                      |
| `first_identify`        | Type `identify_`, then reveal `Create Avatar`                                   | `user_avatar`                                                                                          |
| `user_avatar`           | Explicit user avatar creator                                                    | `personalized_identity` only after a valid saved avatar                                                |
| `returning_identity`    | Personalized logo with saved user name centered on the X                        | `session_select`                                                                                       |
| `personalized_identity` | User name centered on the X                                                     | `session_select`                                                                                       |
| `session_select`        | Type `AgentIntersect_`; materialize `Single Agent` left and `Multi Agent` right | `constellation_single` or `constellation_multi`                                                        |
| `constellation_single`  | Four harness endpoint labels; Single selected                                   | `agent_prompt`                                                                                         |
| `constellation_multi`   | Four harness labels plus all completed agent identities/avatars                 | `agent_prompt`, `enter_ready`, or remain to add agents                                                 |
| `agent_prompt`          | Terminal newline, type `agent name?`, newline, accept input                     | `agent_resolving`                                                                                      |
| `agent_resolving`       | Truthful translucent `connecting agent` overlay                                 | `agent_not_found`, `agent_connected`, or recoverable unavailable state                                 |
| `agent_not_found`       | Type exactly `agent not found_`; focus immediate retry                          | `agent_prompt`                                                                                         |
| `agent_connected`       | Truthful `agent connected` overlay                                              | `agent_avatar` for a first-time agent; otherwise return to constellation with restored approved avatar |
| `agent_avatar`          | Explicit avatar creator for the exact connected agent                           | `constellation_single` or `constellation_multi` only after save                                        |
| `enter_ready`           | Centered `Enter World`                                                          | `world_entering`                                                                                       |
| `world_entering`        | Bounded transition into the same World scene                                    | `world_blank`                                                                                          |
| `world_blank`           | Small open blank floor room, avatars, third-person camera, chat/PTT HUD         | `repository_loading` after an accepted repository request                                              |
| `repository_loading`    | Truthful transient repository-loading state; current floor remains the scene    | `world_repository`, recoverable unavailable, or return to `world_blank`                                |
| `world_repository`      | The entire existing floor is the repository landscape                           | Remain in World; accepted chat/voice/action flows continue                                             |

### Derived guards

- Single Agent `enter_ready` requires exactly the selected agent to be truthfully connected and its explicit avatar complete.
- Multi Agent `enter_ready` requires at least two truthfully connected agents and an explicit completed avatar for every connected agent.
- A connected agent with an incomplete avatar blocks entry, including when two other agents are complete.
- Restored avatar completion is valid only when it belongs to the exact restored agent/session identity and is presented as current or previous/recovered truth.
- Animation completion never changes connection, avatar, repository, or authority state.

## 4. Layout and composition

### 4.1 Opening

- Use the existing `/assets/dashboard/agentintersect_animated.svg`.
- The opening is full-screen and initially contains only one large centered logo.
- No header, navigation, status pill, dashboard card, explanation, button, or developer affordance appears during `boot`.
- The composition must remain contained on supported desktop and mobile viewports.

### 4.2 Typography and typed labels

- All World text uses Consolas, with a metric-compatible monospace fallback only when Consolas is unavailable.
- Typed labels appear character-by-character.
- A completed typed label ends with a blinking underscore cursor.
- Reduced motion may reveal the final text immediately, but the final underscore and state meaning remain.
- Screen readers receive the final phrase once through a polite live region; they do not receive every character as a separate announcement.

### 4.3 Personalized identity and session choice

- After user-avatar creation or restore, place the user’s name over the center of the X in the animated logo.
- Type `AgentIntersect_` centered below the logo.
- Materialize `Single Agent` below-left and `Multi Agent` below-right.
- The choices are keyboard reachable and expose selected/unavailable state without color alone.

### 4.4 Harness constellation

The four terminal labels are clickable and positioned at the colored logo endpoints:

| Harness label | Position    | Color     |
| ------------- | ----------- | --------- |
| `openclaw_`   | Upper-left  | Red       |
| `hermes_`     | Upper-right | Yellow    |
| `claude_`     | Lower-left  | Orange    |
| `codex_`      | Lower-right | Blue-cyan |

Their labels, focus rings, and unavailable state must remain legible over the animated mark.

## 5. Terminal behavior

Selecting a harness:

1. Advances the active cursor as a terminal newline.
2. Types `agent name?`.
3. Advances again.
4. Focuses a single-line name input in the terminal composition.
5. Submits through Enter and an accessible explicit action.

Hermes and OpenClaw resolve an existing local harness identity. They must not create, rename, configure, or activate an external identity.

Codex and Claude use the entered name as the World agent identity. Capability truth still determines whether connection is available.

A Hermes/OpenClaw miss:

- types exactly `agent not found_`;
- exposes no path, profile, transport, stack, readiness, or connector detail;
- immediately returns focus to retry;
- preserves prior successful agents and avatars.

## 6. First and later launches

### 6.1 First launch

1. Show logo only.
2. Type `identify_`.
3. Reveal `Create Avatar`.
4. Open the explicit user avatar creator.
5. Save the avatar.
6. Overlay the user’s name on the X.
7. Type `AgentIntersect_`.
8. Reveal Single/Multi session choice.

### 6.2 Later launch

1. Show the animated logo personalized with the saved user name.
2. Replay `AgentIntersect_`.
3. Reveal Single/Multi session choice and truthful recoverable session state.
4. Do not force user-avatar creation.

If stored user-avatar state is corrupt or absent, return truthfully to the first-launch avatar step. Do not silently invent a replacement.

## 7. Single Agent flow

1. Choose `Single Agent`.
2. Choose one available harness.
3. Complete the terminal name prompt.
4. Resolve and connect truthfully.
5. Pulse `connecting agent`, then `agent connected`.
6. If this exact agent has no approved avatar, open its explicit avatar creator.
7. Return to the constellation after avatar save.
8. Materialize centered `Enter World` only when connection and avatar guards pass.
9. Enter the blank World in third-person.

Revised Phase 18 implements only the Hermes/Mr Fluff path. Other harness labels must remain truthful and unavailable rather than simulating breadth.

## 8. Multi Agent flow and avatar sequence

1. Choose `Multi Agent`.
2. Select a harness and enter one agent name.
3. Connect that one agent immediately.
4. Immediately create or truthfully restore that exact agent’s avatar.
5. Return to the constellation.
6. Repeat for each additional agent.
7. After two or more agents are connected and every connected agent has an avatar, materialize `Enter World`.
8. Permit more agents before entry without discarding earlier state.

There is no batch connection followed by batch avatar creation. There is no invisible default avatar. Removing or losing readiness for an agent recomputes the entry guard truthfully.

## 9. Connection and error states

Use a large translucent Consolas overlay that subtly pulses:

- `connecting agent` for one;
- `connecting agents` only when truthful concurrent plural work exists;
- `agent connected` for one;
- `agents connected` only when plural readiness is true.

Reduced motion replaces pulsing with a static state change. Captions/live regions announce the final state once.

Enabled actions are blue. Unavailable actions are grey, remain legible, and expose a concise accessible reason. Color is never the only state signal.

Normal UX shows brief errors:

- agent identity miss;
- connection unavailable;
- avatar save unavailable;
- World entry unavailable;
- repository unavailable;
- chat/voice unavailable.

Technical diagnostics belong to the internal developer route. Normal errors must preserve current/previous state, data-safety truth, and a bounded retry or return action.

## 10. World arrival and persistent HUD

The initial environment is one small open blank floor room. It may reserve capability for later walls or a skybox, but revised Phase 18 does not require them.

- Spawn the camera third-person behind the user avatar.
- Spawn connected agent avatars in the same room.
- Permit free user and agent navigation within truthful bounds.
- Do not show a dashboard, top navigation, side panels, minimap, roster, evidence panel, readiness grid, connector wizard, lifecycle controls, or recovery console.
- Persist only a bottom-center chat field and adjacent push-to-talk control.
- Show transient captions, recipient, connection, and repository progress only as needed; they must not become permanent admin chrome.

The push-to-talk control remains visible even when unavailable, styled grey with a concise accessible reason. Revised Phase 18 may rely on canonical text while the Phase 15 provider remains staged/unactivated.

## 11. Message targeting

Single Agent messages target the connected agent.

Multi Agent targeting rules:

- no address: send to all connected agents;
- click an avatar: target that agent for the next message and show the recipient;
- `@name`: target the exact matching connected agent;
- ambiguous or unknown `@name`: do not send; request a corrected target without technical detail;
- explicit broadcast selection clears a prior individual target.

The displayed recipient truth and actual gateway delivery set must match. Message routing never relies on visual focus alone.

## 12. Repository-floor transformation

Repository load begins through normal chat or voice, not through a persistent repository picker or portal.

For the revised Phase 18 slice:

1. The user asks Mr Fluff to load the approved repository.
2. World resolves the request through a bounded, truthful World-owned interaction.
3. Existing repository indexing and World projection report current/previous/loading/unavailable truth.
4. The blank floor remains the same scene and spatial identity while loading.
5. On success, the entire existing floor transforms into the repository landscape.
6. The user and agent remain embodied in that space.

No doorway, portal, teleport, modal dashboard, or separate repository room is permitted. Reduced motion may cross-fade or replace geometry without animated travel, but must preserve the in-place transformation meaning.

## 13. Internal dashboard boundary

The accepted dashboard and all operational panels remain internal:

- require an explicit local developer flag;
- use a dedicated internal route;
- fail closed when the flag is absent;
- have no link, button, menu item, shortcut hint, or automatic redirect from normal UX;
- do not share persistent layout chrome with the World;
- retain truthful diagnostics, evidence, recovery, readiness, connector, lifecycle, Guided Build, and control-plane capability for local development.

The internal route is not a second normal product mode.

## 14. Accessibility, responsive behavior, and reduced motion

Required acceptance coverage:

- full keyboard operation from boot through repository transformation;
- visible focus and logical order across logo choices, harness endpoints, prompt, avatar creator, `Enter World`, chat, push-to-talk, avatars, and repository objects;
- semantic roles/names and polite live regions;
- captions for voice and connection/repository state;
- reduced-motion equivalents for typewriter, pulse, World entry, and floor transformation;
- no canvas focus trap;
- forced-colors/high-contrast support;
- text scaling and responsive containment without clipping or horizontal overflow;
- no required action encoded only by endpoint color, blue/grey state, animation, or 3D position;
- no-WebGL semantic equivalent for the required journey.

## 15. Truthful state and authority

- World may display only state backed by accepted local World and adapter authority.
- `Enter World` is derived from connection and avatar completion, never optimistic animation.
- Current, previous/recovered, stale, unavailable, and retrying states remain distinct.
- A repository floor is active only after a successful current or explicitly disclosed recovered projection.
- Same-PC active harness attachment is invisible to the user; the product does not expose setup mechanics.
- World does not modify Hermes/OpenClaw profiles, activate providers, create public ingress, or duplicate AgentIntersect Guided Build authority.
- Structured events, repository/test/evidence truth, and accepted World Actions remain the source of visible results. Hidden reasoning or fabricated progress is never presented.

## 16. Deferred capabilities

The following are explicitly deferred:

- LAN/different-PC setup UI;
- custom Mr Fluff voice;
- first-person camera toggle;
- Multi Agent sequencing, broadcast, and targeting until revised Phase 19;
- unsupported/unconfigured harness claims; each Single Agent harness shown enabled must instead pass Phase 18's live coding gate;
- Phase 13 Discord → World continuity retry;
- broad internal-dashboard redesign;
- public rooms, unrelated users, cloud relay, release, publication, tags, deployment, public ingress, or visibility changes.

## 17. Phase 18.5 sequencing boundary

Aaron explicitly authorized **Phase 18.5 — Avatar and World Visual Production** as the next milestone while leaving revised Phase 18 open. This does not waive the pending physical-mouse camera or real in-World single-agent chat/voice/coding gates. Phase 18.5 may replace avatar and repository rendering foundations first, but those Phase 18 gates must later pass against the integrated candidate. Phase 19 and Phase 20 remain closed.

Phase 18.5 began with `docs/PHASE_18_5_SCOPE.md` and an executable asset contract. The uncommitted implementation candidate now includes the approved Luminous Codecraft direction, a human-plus-cat hero slice, the full modular human/dog/cat family, shared rig/actions/PBR/LODs, truthful metadata-driven repository environment art, runtime composition, and deterministic structural/visual evidence. The managed worker sandbox cannot start a browser or loopback listener, so the prepared integrated Playwright screenshots and frame/Long Task measurement remain blocked and truthfully absent. Parent proof in a browser-capable environment and Aaron's first-hand visual acceptance are still required; Phase 18.5 is not accepted or sealed.

## 18. Revised Phase 18 acceptance journey

The future Single-Agent Hermes magic slice passes only when all steps are observed in one production-boundary journey:

1. Seed or restore an existing valid user avatar.
2. Open World and see the full-screen animated logo personalized with the user’s name on the X.
3. Observe `AgentIntersect_`, then choose `Single Agent`.
4. Select `hermes_`; observe terminal newline behavior and `agent name?`.
5. Enter `Mr Fluff`; prove a failed lookup types `agent not found_` and retries, then prove the exact local identity connects.
6. Observe truthful `connecting agent` then `agent connected`.
7. Complete the explicit Mr Fluff avatar creator and return to the constellation.
8. Verify `Enter World` was absent before connection/avatar completion and is now centered and enabled blue.
9. Enter World and arrive in third-person behind the user avatar in the blank floor room with Mr Fluff present.
10. Verify bottom-center chat and adjacent push-to-talk are the only persistent HUD.
11. Ask Mr Fluff through chat to load the approved repository.
12. Observe truthful loading state and the entire existing floor transform into the repository landscape without a portal or separate space.
13. Verify keyboard, captions, reduced motion, forced colors, no-WebGL equivalence, mobile containment, and current/previous recovery.
14. Verify the normal experience never links to or displays the internal dashboard.
15. Verify no provider activation, external configuration, Phase 13 retry, original-project operation, release, publication, tag, deployment, public ingress, or visibility change occurred.
16. Prove a real Hermes identity/session responds inside the normal World transcript through live chat or a truthfully enabled live voice path; fixture/canned output is insufficient.
17. Have Hermes/Mr Fluff complete one bounded disposable-project feature as the sole connected agent while World truthfully shows progress, tools, chat/queue behavior, changes, tests/build, result, and cleanup.
18. Repeat an equivalent bounded coding journey for every other Single Agent harness truthfully presented as enabled; unsupported harnesses remain grey and are not claimed.

Completion of this journey requires the remaining production-boundary implementation/evidence, independent parent proof, and Aaron's explicit first-hand acceptance. Starting Phase 18.5 does not satisfy or waive any of these Phase 18 gates.
