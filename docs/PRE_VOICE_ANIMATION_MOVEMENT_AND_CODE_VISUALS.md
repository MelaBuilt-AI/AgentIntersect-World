# Pre-Voice Animation, Autonomous Movement, and Code-Visual Assets

Updated: 2026-08-03

## Status

**USER-ORDERED NEXT WORK / IMPLEMENTATION NOT STARTED**

Aaron explicitly moved three milestones ahead of normal-World voice and the later roadmap. They must be completed in this order:

1. avatar animation semantics and controls;
2. autonomous agent movement with correct animation;
3. ingestion and World integration of 26 user-labeled code/repository/action visual assets.

This sequencing record authorizes these items as the next work to scope and implement. It does not mark any item complete, seal Phase 18 or Phase 18.5, begin Phase 19 or Phase 20, activate a provider, alter protected services, or authorize release/publication/deployment.

## Milestone 1 — Correct avatar animations

### Current user-authoritative truth

- User avatar `Idle`, `Walk`, and `Run` are correct.
- Space/`Jump` does not play the correct animation.
- The local slash-command animations do not yet trigger correctly:
  - `/dance`
  - `/clap`
  - `/cheer`
  - `/wave`
  - `/bow`
  - `/agree`
  - `/angry`
  - `/laugh`
- Structural clip resolution and the current 69-pass/207-ambiguous review record do not supersede first-hand semantic acceptance.

### Tasks

- [ ] Re-attest the active user and agent avatar models, source GLBs, animation registries, runtime clip selection, and current fail-closed semantic records before editing.
- [ ] Inventory each model-local clip needed for `Jump` and the eight exact slash-command semantics without inferring labels from clip order, duration, or anonymous source names.
- [ ] Build or reuse a direct playback/review lane that lets Aaron identify the correct model-local clip for each required action.
- [ ] Correct Space/`Jump` so World-owned keyboard input triggers exactly the accepted jump animation and never steals input from chat, forms, menus, or inactive surfaces.
- [ ] Correct the eight exact local-only slash commands so each triggers its accepted animation, remains outside Hermes/FIFO transport, and returns cleanly to `Idle`.
- [ ] Preserve actor-local precedence: movement cancels that actor's one-shot; the newest valid one-shot replaces the previous one; stale completion callbacks cannot restore cancelled state.
- [ ] Apply the accepted semantic mappings to both user and agent avatars where the model actually supports them; unsupported actions remain visibly refused rather than substituted.
- [ ] Add focused RED-to-GREEN unit/browser coverage and temporal evidence for the actual runtime mixers, actions, and affected bones.
- [ ] Obtain Aaron's first-hand PASS for user and agent `Idle`, `Walk`, `Run`, `Jump`, and all eight slash-command actions.

### Exit gate

Aaron confirms that every required animation plays the correct visible action for the tested user and agent avatars, with clean cancellation, replacement, and return-to-idle behavior.

## Milestone 2 — Autonomous agent movement

### Product intent

Focus solely on agent-owned autonomous movement after the animation mappings are correct. An agent must be able to decide that it wants to move, issue a validated World-owned movement intent, navigate truthfully, and play the correct animation for its current motion or stationary action.

### Tasks

- [ ] Freeze the smallest autonomous-movement contract using the existing validated World Action/movement authority rather than parsing arbitrary assistant prose directly into transforms.
- [ ] Let the agent choose a valid bounded destination or supported target and expose truthful intent, moving, arrived, refused, cancelled, and interrupted states.
- [ ] Couple motion state to correct model-local animation: `Idle` while stationary, `Walk`/`Run` while traversing, and `Jump` only when a validated movement/action requires it.
- [ ] Let the stationary agent intentionally use accepted actions such as cheer, clap, wave, bow, agree, angry, laugh, or dance when supported.
- [ ] Ensure movement cancels stationary one-shots, newer validated intent supersedes older intent, and cancelled autonomy cannot resume browser-locally under the same request ID.
- [ ] Preserve user-directed movement priority over autonomy and keep stop/interruption scoped to the intended agent and request.
- [ ] Validate arrival against the resolved target/approach point rather than only elapsed motion or a stale destination.
- [ ] Preserve bounded coordinates, collision/floor truth, heading, speed, no teleporting, restart/current-previous state, and explicit refusal when a repository target cannot be resolved.
- [ ] Add focused RED-to-GREEN movement/animation tests and one real temporal browser journey.
- [ ] Obtain Aaron's first-hand PASS showing the agent independently choosing to move, walking/running/jumping correctly, stopping at a truthful destination, and selecting correct supported stationary actions.

### Exit gate

An agent autonomously decides and completes bounded movement in the normal World with truthful state and visibly correct locomotion/gesture animation, without overriding the operator or fabricating arrival.

## Milestone 3 — Twenty-six code-visual assets

### Product intent

Aaron already has 26 labeled assets representing aspects of code, repositories, and actions performed while an agent codes in World. These assets become the next visual-production input after animation and autonomous movement are accepted.

### Tasks

- [ ] Locate the operator-provided source directory at milestone start and verify the inventory contains exactly 26 intended assets.
- [ ] Preserve every original byte and record file name, user label, format, size, SHA-256, provenance/use authorization, coordinate system, scale, orientation, materials/textures, and runtime suitability.
- [ ] Freeze a versioned manifest mapping each user label to one truthful code/repository/action semantic; do not invent semantics from appearance or file names.
- [ ] Define deterministic intake/conversion rules for source preservation, optimized runtime copies, naming, pivots, scale, materials, LODs, collision/selection bounds, and fallback representation.
- [ ] Add structural and visual intake validation before runtime registration.
- [ ] Integrate the accepted assets into the repository-floor visual grammar so supported repositories, code structures, evidence states, and coding actions use the correct representations.
- [ ] Connect live agent coding events to visuals only through existing validated tool/repository/evidence authority; decorative animation must never imply an unproven edit, test, build, or completion.
- [ ] Preserve instancing/culling/performance budgets plus reduced-motion, forced-colors/semantic DOM, no-WebGL, and low-spec truth.
- [ ] Produce representative World scenes for repository structure and an in-progress coding journey, with exact asset-to-semantic traceability.
- [ ] Obtain Aaron's first-hand visual and interaction acceptance of all 26 assets in their intended World roles.

### Exit gate

All 26 assets are provenance-bound, deterministic pipeline inputs and appear in World as truthful, readable representations of their labeled code/repository/action semantics during normal repository exploration and agent coding activity.

## Ordered roadmap after these milestones

1. Complete and accept avatar animation semantics.
2. Complete and accept autonomous agent movement.
3. Complete and accept the 26-asset code-visual pipeline and World integration.
4. Resume normal-World push-to-talk voice using the accepted Phase 15 contracts.
5. Complete bounded live coding acceptance.
6. Explicitly seal Phase 18 and reconcile remaining Phase 18.5 acceptance/evidence.
7. Begin Phase 19 only after separate user authorization.
8. Leave Phase 20 integrated acceptance and bounded hardening until the preceding product slices are accepted.

## Explicit deferrals

Until the three pre-voice milestones pass, do not prioritize custom Mr Fluff voice, broad CI-flake cleanup, LAN setup UI, gesture guessing, Phase 19, Phase 20, release, publication, deployment, provider activation, or unrelated hardening.
