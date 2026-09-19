# Pre-Voice Animation, Autonomous Movement, and Code-Visual Assets

Updated: 2026-08-11

## Status

**MILESTONES 1–3 OPERATOR ACCEPTED / PHASE 18 SINGLE-AGENT FEATURE LOOP ACCEPTED**

Aaron explicitly moved three milestones ahead of normal-World voice and the later roadmap. They must be completed in this order:

1. avatar animation semantics and controls;
2. autonomous agent movement with correct animation;
3. ingestion and World integration of 26 user-labeled code/repository/action visual assets.

This sequencing record marks all three milestones complete through first-hand operator acceptance. The 26-pair repository-city intake is provenance-bound under `assets/repository-city/`; Aaron accepted the integrated repository-city journey 10/10 on 2026-08-05. Aaron then accepted the real single-agent Workstream feature loop on 2026-08-11. This completion does not begin Phase 19 or Phase 20, activate a provider, alter protected services, or authorize release/publication/deployment.

Aaron's sanitized operator receipts authorize exact model-local Jump and gesture clips for `user-male-01` and `cat-agent-01`. Aaron returned first-hand `animation pass` at 2026-08-03 17:46 EDT, so Milestone 1 is accepted. All other models remain fail-closed for those semantics. The retained developer-only review surface supports every role-valid repository model and defaults to `cat-agent-01`; run `pnpm avatar:review` and open `http://127.0.0.1:45184/internal/avatar-animation-review`. Importing or editing a browser receipt remains review-only and cannot mutate runtime semantics.

Aaron's earlier corrected movement retest remains the authoritative historical mixed FAIL. `/agent follow`, `/agent stop`, and `/agent move left|right|forward|backward <distance>` worked, and distances `5` and `10` visibly scaled travel; forward facing, conversational move/follow authority, and visible Run selection failed. The bounded correction passed independent technical verification and was then reversibly activated in the default Hermes profile at installed SHA-256 `463e40a540759a875228903565ca3de576804d9e9e2ae8f7a38fec22a6483e6e`.

Aaron returned first-hand `movement pass` at 2026-08-04 16:14 EDT. He observed Mr Fluff move autonomously when asked, follow when asked, face the correct forward/back travel direction, transition through Walk/Run/Idle truthfully, and pass `/` chat activation plus ArrowUp/ArrowDown prompt history. His complete-checklist statement also accepts both distance sets, gradual non-teleport displacement, and scoped stop with no resumption. The criterion-level verdict is retained at `/home/user/.hermes/runs/aiw-m2-movement-retest-20260804T134639Z/manual-verdict.json`. No screenshot or video accompanied the report, and Mr Fluff did not automate the browser interaction. **Milestone 2 is accepted.**

Milestone 3 was subsequently authorized, implemented from exactly 26 preserved and hash-bound source pairs, and accepted through the repository-city product journey. Its historical pre-authorization prohibition remains evidence of the earlier boundary, not the current roadmap state. Phase 19 remains not started and requires a separate planning/authorization decision.

## Milestone 1 — Correct avatar animations

### Current user-authoritative truth

- Aaron first-hand accepted `Idle`, `Walk`, `Run`, Space/`Jump`, `/dance`, `/clap`, `/cheer`, `/wave`, `/bow`, `/agree`, `/angry`, and `/laugh` for the reviewed `user-male-01` and `cat-agent-01` models.
- Every unreviewed model remains fail-closed for unsupported or unaccepted semantics.
- Structural clip resolution alone does not supersede first-hand semantic acceptance.

### Tasks

- [x] Re-attest the active user and agent avatar models, source GLBs, animation registries, runtime clip selection, and current fail-closed semantic records before editing.
- [x] Inventory each model-local clip needed for `Jump` and the eight exact slash-command semantics without inferring labels from clip order, duration, or anonymous source names.
- [x] Build or reuse a direct playback/review lane that lets Aaron identify the correct model-local clip for each required action.
- [x] Correct Space/`Jump` so World-owned keyboard input triggers exactly the accepted jump animation and never steals input from chat, forms, menus, or inactive surfaces.
- [x] Correct the eight exact local-only slash commands so each triggers its accepted animation, remains outside Hermes/FIFO transport, and returns cleanly to `Idle`.
- [x] Preserve actor-local precedence: movement cancels that actor's one-shot; the newest valid one-shot replaces the previous one; stale completion callbacks cannot restore cancelled state.
- [x] Apply the accepted semantic mappings to both user and agent avatars where the model actually supports them; unsupported actions remain visibly refused rather than substituted.
- [x] Add focused RED-to-GREEN unit/browser coverage and temporal evidence for the actual runtime mixers, actions, and affected bones.
- [x] Obtain Aaron's first-hand PASS for user and agent `Idle`, `Walk`, `Run`, `Jump`, and all eight slash-command actions.

### Exit gate

Aaron confirms that every required animation plays the correct visible action for the tested user and agent avatars, with clean cancellation, replacement, and return-to-idle behavior.

## Milestone 2 — Autonomous agent movement

### Product intent

Focus solely on agent-owned autonomous movement after the animation mappings are correct. An agent must be able to decide that it wants to move, issue a validated World-owned movement intent, navigate truthfully, and play the correct animation for its current motion or stationary action.

### Tasks

- [x] Freeze the smallest autonomous-movement contract using the existing validated World Action/movement authority rather than parsing arbitrary assistant prose directly into transforms.
- [x] Let the agent choose a valid bounded destination or supported target and expose truthful intent, moving, arrived, refused, cancelled, and interrupted states.
- [x] Couple motion state to correct model-local animation: `Idle` while stationary, `Walk`/`Run` while traversing, and `Jump` only when a validated movement/action requires it.
- [x] Let validated application authority trigger only its supported stationary semantics; arbitrary assistant prose is not a gesture authority.
- [x] Ensure movement cancels stationary one-shots, newer validated intent supersedes older intent, and cancelled autonomy cannot resume browser-locally under the same request ID.
- [x] Preserve user-directed movement priority over autonomy and keep stop/interruption scoped to the intended agent and request.
- [x] Validate arrival against the resolved target/approach point rather than only elapsed motion or a stale destination.
- [x] Preserve bounded coordinates, collision/floor truth, heading, speed, no teleporting, restart/current-previous state, and explicit refusal when a repository target cannot be resolved.
- [x] Add focused RED-to-GREEN movement/animation tests and one real temporal browser journey.
- [x] Obtain Aaron's first-hand PASS showing the agent independently choosing to move, walking/running/jumping correctly, stopping at a truthful destination, and selecting correct supported stationary actions.

### Exit gate

An agent autonomously decides and completes bounded movement in the normal World with truthful state and visibly correct locomotion/gesture animation, without overriding the operator or fabricating arrival.

## Milestone 3 — Twenty-six code-visual assets

### Product intent

Aaron already has 26 labeled assets representing aspects of code, repositories, and actions performed while an agent codes in World. Their deferred source location is `C:\Codex\repository-visual-assets`. This path is recorded only: do not inspect, hash, convert, or integrate its image/GLB pairs until animation and autonomous movement are accepted and Milestone 3 begins.

### Tasks

- [x] At milestone start, inspect `C:\Codex\repository-visual-assets` and verify the inventory contains exactly 26 intended labeled image/GLB asset pairs.
- [x] Preserve every original byte and record file name, user label, format, size, SHA-256, provenance/use authorization, coordinate system, scale, orientation, materials/textures, and runtime suitability.
- [x] Freeze a versioned manifest mapping each user label to one truthful code/repository/action semantic; do not invent semantics from appearance or file names.
- [x] Define deterministic intake/conversion rules for source preservation, optimized runtime copies, naming, pivots, scale, materials, LODs, collision/selection bounds, and fallback representation.
- [x] Add structural and visual intake validation before runtime registration.
- [x] Integrate the accepted assets into the repository-floor visual grammar so supported repositories, code structures, evidence states, and coding actions use the correct representations.
- [x] Connect live agent coding events to visuals only through existing validated tool/repository/evidence authority; decorative animation never implies an unproven edit, test, build, or completion.
- [x] Preserve instancing/culling/performance budgets plus reduced-motion, forced-colors/semantic DOM, no-WebGL, and low-spec truth.
- [x] Produce representative World scenes for repository structure and an in-progress coding journey, with exact asset-to-semantic traceability.
- [x] Obtain Aaron's first-hand visual and interaction acceptance of the integrated repository-city roles.

### Exit gate

All 26 assets are provenance-bound deterministic pipeline inputs and appear in World as truthful, readable representations of their labeled code/repository/action semantics during normal repository exploration and agent coding activity. Aaron's 10/10 repository-city acceptance completed this gate.

## Ordered roadmap after these milestones

1. **Accepted:** avatar animation semantics.
2. **Accepted:** autonomous agent movement.
3. **Accepted:** 26-asset code-visual pipeline and repository-city World integration.
4. **Accepted foundation:** normal-World push-to-talk voice under the Phase 15 contract.
5. **Accepted:** bounded single-agent Workstream feature loop.
6. Retain exact private-delivery parity and hosted-CI receipts in the external handoff; do not turn this product roadmap into a recursive delivery-status commit.
7. Decide whether to plan and authorize Phase 19; do not begin implementation from this record alone.
8. Leave Phase 20 integrated acceptance and bounded hardening until the preceding product slices are accepted.

## Explicit deferrals

Phase 19 implementation, Phase 20, custom Mr Fluff voice, broad CI-flake cleanup, LAN setup UI, gesture guessing, release, publication, deployment, provider activation, and unrelated hardening remain separately gated.
