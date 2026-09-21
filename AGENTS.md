# AgentIntersect World — Project Development Rules

These project-local rules govern Phase 1 and all later phases. They supersede older design or handoff language that requires repeated AgentIntersect checkout verification, security-first implementation, multi-user internet collaboration, or repeated broad reviews.

## CI and readiness override — PR20 and all later work

Aaron explicitly superseded the earlier browser-journey requirement on September 21, 2026 (Discord `1551598468483649678`). Do not run or require automated product-navigation/browser journeys, browser shards, or browser-based measurement journeys for GitHub CI, local readiness, PR acceptance, merge, or release readiness. Do not reinstate them from historical phase reports, skills, handoffs, or optional legacy scripts. A new explicit user request is required to run them again.

Required code verification remains formatting, lint, TypeScript, architecture, unit/integration/component tests, build, startup/API smoke, and applicable static asset/input checks. Existing isolated HTML/CSS component tests are not product-navigation journeys. `pnpm check` uses the conventional core gate; `merge-gate` still fails closed on its required code/documentation checks. Exact-head GitHub success remains required before an authorized merge.

Functional and visual acceptance comes from Aaron's hands-on use after feature changes and scoped Mr Fluff computer-use checks, not scripted journeys. Reuse accepted evidence for unchanged behavior; do not manufacture a new manual-test gate for an unchanged product. Historical browser failures stay recorded as failures, not passed tests; the contract change makes them non-required. Keep release/publication/provider permissions separate. See [CI policy](docs/CI.md).

## 1. Independent-project boundary

- AgentIntersect World is a separate project with its own code, dependencies, history, tests, and releases.
- Do not modify the original `/home/mela_ai/AgentIntersect` repository while developing AgentIntersect World.
- Do not repeatedly inspect, diff, hash, review, or verify the original AgentIntersect checkout during normal World phases.
- Revisit the original AgentIntersect repository only when the user explicitly asks to modify it, refresh the baseline, or diagnose a live integration incompatibility that cannot be resolved from World-owned code and fixtures.
- If AgentIntersect code is needed as a baseline, copy the required code into this repository, record its provenance once, and thereafter treat the copy as AgentIntersect World code. Do not create an ongoing synchronization or verification gate against the original repository.
- The user explicitly authorized one bounded **Phase 5 visual-shell baseline extraction** from the original AgentIntersect dashboard. At that milestone only, read the dashboard identity/avatar/hero/navigation implementation and copy the required graphics/assets into World with a source commit, file manifest, and hashes. Preserve the source graphics byte-for-byte when used. Port the interaction model into World-owned React components; do not copy AgentIntersect's control-plane menus or backend authority. Do not modify the original repository, and after the extraction treat the copied assets/code as World-owned without recurring source checks.
- Phase 5 is frozen as a balanced shell + inherited 2D avatar + one hybrid semantic-DOM/R3F repository-island slice. Do not add Blender, 3D avatar modeling/rigging/animation, broad environment-art production, or later-phase worker/readiness/symbol/multi-view functionality.
- Future embodied avatars use one shared biped core rig and one reusable primary animation set. Humans and animal species vary through modular fur, tails, ears, muzzles, paw-shaped hands/feet, claws, markings, palettes, clothing, and terminal accents; optional secondary tail/ear motion must not fork the primary locomotion animation set.
- Phase 0 compatibility evidence remains historical baseline evidence, not a recurring phase gate.

## 2. Functionality-first delivery

For each phase:

1. Define the smallest observable feature or working vertical slice.
2. Build it until it functions in the supported local environment.
3. Run focused tests while developing, then run the relevant integrated/full test and build commands once the slice works.
4. Have Mr Fluff independently inspect the real diff/artifact and perform functional parent proof rather than accepting a worker report as evidence.
5. Move promptly to first-hand operator testing once parent proof is green.
6. Run an audit only when first-hand testing exposes a concrete issue or the user explicitly requests one. Do not make a routine audit or targeted re-audit an automatic build-stage gate.
7. Fix observed defects with focused regressions, rerun the affected functional proof, and stop when the supported slice works.

Speculative or theoretical hardening belongs in the backlog unless it blocks a supported local/LAN workflow, risks data loss or secret exposure, or the user explicitly expands scope.

Routine development verification stays simple:

- Use the normal Git worktree and, when separately authorized, ordinary local branches or checkpoint commits. Do not create frozen candidate directories, byte manifests, private backup trees, or receipt-owned launchers for routine changes.
- Treat retained screenshots, measurements, and source fingerprints as historical milestone records. They do not become current-build gates merely because later source bytes differ.
- Run native hardware checks when the changed behavior materially depends on native hardware, when first-hand visual acceptance needs them, or at an explicitly approved release/readiness milestone—not after every shared-file edit.
- `verify:fresh`, complete browser matrices, immutable receipts, and exact artifact/source attestation are optional milestone or release tools. They are not routine phase-closure requirements unless Aaron explicitly requests them or a concrete supported-risk boundary makes them necessary.
- Close ordinary work from focused regression tests, the impacted type/build gate, and existing first-hand browser evidence. Reuse green evidence for unchanged behavior.

## 3. Security posture during the build

- Do not make broad security hardening, enterprise controls, internet threat models, supply-chain ceremony, or speculative abuse cases phase-completion gates while the product is being built.
- Prioritize working code, usable features, integration correctness, recoverable local state, and testable behavior.
- Keep only inexpensive baseline safeguards that prevent accidental data loss, destructive repository mutation, secret leakage, or unintended exposure beyond the configured local/LAN boundary.
- Record nonessential hardening ideas in a backlog for a dedicated hardening milestone after the product’s main functional path works.
- A security issue blocks current development only when it causes a concrete functional failure, data loss/corruption, secret exposure, unsafe destructive action, or unintended access outside the stated local/LAN scope.

## 4. Local single-human, multi-agent scope

In this project, “multiplayer” means:

- one human/operator;
- one or more AI agents owned and selected by that same human;
- processes and browser views running on the same computer or on that human’s trusted LAN.

It does **not** mean:

- unrelated human users;
- agents belonging to outside users;
- public rooms, internet discovery, cloud multi-tenancy, hosted social collaboration, or adversarial remote peers;
- infrastructure for arbitrary off-LAN connections.

Prefer the terms **multi-agent**, **multi-view**, or **local/LAN session** in new code and documentation. Multiple browser windows or LAN clients represent the same trusted operator unless the user later expands the product scope.

## 5. Networking boundary

- Default to loopback for single-machine development.
- Allow explicit trusted-LAN binding when a feature requires another machine owned by the same operator.
- Do not design or deploy public-internet ingress, multi-tenant identity, external account systems, public room services, or cloud relay infrastructure unless the user explicitly changes scope.
- Test actual same-machine and trusted-LAN functionality rather than building protections for unsupported internet actors.

## 6. Review and approval boundaries

- One implementation worker/report followed by parent verification and first-hand testing is the default phase cadence.
- A prior audit may supply concrete correction work, but its existence does not create a routine re-audit requirement after the correction. Audit again only for an observed issue or explicit user request.
- Fix confirmed defects once, retest the affected behavior, and move forward when acceptance criteria pass.
- Commit/push may proceed when the user has authorized it and the working feature plus tests/build are green.
- Remote creation, publication, release, tags, public visibility, and changes to the original AgentIntersect repository remain explicit user approval gates.

## 7. Normal World experience and internal surface

- The normal product is identity → embodiment → agent connection → enter a 3D space → direct agents through chat/voice → conversationally load a repository, transforming the entire current floor into the repository landscape.
- Do not present the inherited dashboard, diagnostics, evidence, recovery, readiness, connectors, lifecycle, or control-plane panels as normal-product navigation.
- Retain that accepted machinery only behind an explicit local developer flag/internal route. The normal experience must not link to it.
- Inside World, the only required persistent HUD is a minimal bottom-center chat field and adjacent push-to-talk control. Phase 19 may evolve that composition to show truthful recipient selection, roster-ordered grouped results, and voice-input state; it must not add admin or Workbench chrome. Default camera is third-person behind the user; first-person is optional later.
- An unaddressed Multi Agent message goes to all connected agents. Avatar click or `@name` targets one.

## 8. Frozen entry and visual invariants

- First launch: full-screen existing animated logo only → typed `identify_` → `Create Avatar`. Later launches: personalized logo/name → replay `AgentIntersect_` → session selection; never force user-avatar creation again.
- After user-avatar creation, center the user’s name on the logo X. Place `AgentIntersect_` below it, then `Single Agent` left and `Multi Agent` right.
- Use Consolas for all World text. Typed labels animate character-by-character and finish with a blinking underscore cursor.
- Place `openclaw_` upper-left/red, `hermes_` upper-right/yellow, `claude_` lower-left/orange, and `codex_` lower-right/blue-cyan at the logo endpoints.
- Harness selection advances like a terminal newline, types `agent name?`, advances again, and accepts input. Hermes/OpenClaw resolve existing local identities; a miss types `agent not found_` and retries without technical detail. Codex/Claude use the entered name as World identity.
- Every newly connected agent requires an explicit avatar creator; no invisible default. Multi Agent repeats connect one → create its avatar → return to constellation. Reveal `Enter World` only after at least two agents are connected and all required avatars are complete; allow more agents before entry.
- Use a subtle translucent Consolas `connecting agent(s)` then `agent(s) connected` overlay. Reveal `Enter World` only from truthful readiness.
- Begin in a small open blank floor room with free user/agent navigation and capacity for later walls/skybox. A repository transforms the entire floor in place; never use a portal or separate repository space.
- Same-PC harness connection is invisible. LAN/different-PC setup UI and custom Mr Fluff voice remain deferred.
- Enabled actions are blue and unavailable actions grey. Preserve keyboard access, captions, reduced-motion equivalents, responsive containment, and truthful current/previous state without adding admin chrome.

## 9. Documentation versus implementation authority

- The 2026-07-26 product direction is normative in `AgentIntersect_WorldDD.md` and `docs/WORLD_ENTRY_EXPERIENCE.md`.
- Revised Phase 18 is **World Entry Experience — Single-Agent Hermes magic slice**; Phase 18.5 is **Avatar and World Visual Production**; revised Phase 19 is **Multi-Agent Constellation and Harness Breadth**; revised Phase 20 is **Embodied Product Acceptance and Bounded Hardening**.
- Documentation or planning approval does not authorize unrelated implementation, tests, manifests, assets, evidence generation, package installation, services, provider activation, commits/pushes, external configuration, Phase 13 retry, original-AgentIntersect work, release, publication, tags, deployment, public ingress, or visibility changes.
- The user-ordered sequence is **Phase 19 Task 16 closure → Animation Confirmations for all 23 models, including model-local Dig → Phase 20**. Task 16/Phase 19 are complete, and Animation Confirmations are user-accepted as of 2026-09-02 under `ANIMATION_CONFIRMATIONS_REPORT.md`: Aaron first-hand passed exact-object movement, Dig after arrival/coding, visible grounded motion, completion/Idle, selected Codex naming, and removal of the false passive movement warning. Phase 20 is next but remains not started and not authorized. Older pre-voice/animation ordering remains historical context and must not override this sequence.

## 10. Phase 19 authorized scope

- Aaron authorized Phase 19 on 2026-08-11. Tasks 1–12 are parent-accepted, Tasks 13–15 are **USER-ACCEPTED** and privately delivered on sole exact-green `main` at `b0b58bd18e4c3fd784b39e8c8a344125c9e2e6a0`, and Task 16/Phase 19 are complete under the 2026-08-30 functionality-first closeout. Task 15 passed first-hand four-agent refresh, exact targeting/reset, durable visible grouped replies, Repository City persistence, real Codex/Claude exact-object Walk/Run → arrival, correct final headings, voice carry-forward, and a focused post-arrival no-T-pose retest. Imported `Work` used each exact model's approved animated Idle clip as accepted Phase 19 Work/static truth. The later accepted Animation Confirmations milestone now adds Aaron's exact model-local Dig mapping for active coding. Mr Fluff codes directly; do not use Codex/delegated coding unless Aaron explicitly requests it. Phase 20, PR/merge, provider/profile changes, and all release/public actions retain separate gates.
- The stable roster contains at most four agents. Duplicate harness types are allowed only with distinct native root sessions; reject an exact duplicate `{adapterId, nativeRootSessionRef}` binding.
- Hermes, OpenClaw, Codex, and Claude Code must all be production-bound and pass first-hand local attach/create, text, result, status, recovery, and lifecycle testing. CLI presence/version is not acceptance. Never automatically install or log in, change provider/model settings, edit protected profiles, mutate external configuration, or retain secrets.
- Broadcast turns execute concurrently across agents while each native session stays internally serialized. Render one stable roster-ordered group with independent terminal states. Avatar selection or an exact `@name` targets one agent.
- Stale restored roster entries remain visible and block World entry until explicit reconnect or removal. Removal detaches only the World roster entry; never silently delete unrelated native history, profiles, or files.
- Hermes/Mr Fluff keeps its exceptional operator-persistent native identity and existing Discord-to-World path. OpenClaw, Codex, and Claude Code never use Discord; World creates their World-owned sessions through the AgentIntersect harness boundary. They may survive refresh/reconnect to the same active World, close on explicit World end, and are never silently reused by a later World. Do not stop or rewrite underlying harness services/configuration. Claude Code uses the existing local Ollama setup; Codex uses the existing WSL GPT-5.6 setup.
- Only real structured tool/work evidence may resolve an agent's current code target to the most specific live Repository City object and drive the existing generation-bound repository-object movement contract to its safe approach point. Phase 19 historically used accepted animated Idle as Work/static; accepted Animation Confirmations now resolve active imported-avatar coding to the exact model-local Dig clip only after truthful arrival. Never infer work from assistant prose. Keep unresolved, stale, or blocked targets visible/recoverable; clear Dig deterministically on completion, failure, cancellation, stale authority, or retargeting; keep agents independent; and preserve reduced-motion semantic truth.
- Begin voice only after all four text/session integrations are green. Phase 19 completes push-to-talk input only by reusing Phase 15's local microphone/WAV/Whisper/editable-final-caption pipeline. Accepted text enters exactly typed-chat routing, and broadcast audio is transcribed once before fan-out. Add no normal-World agent TTS/synthetic speech during Phase 19; typed chat always remains available.
- Preserve Phase 16's retained exactly-two-agent/two-worktree execution and evidence authority. Phase 19 remains one human operator on a local/private same-PC topology. LAN/different-PC UI, unrelated users, public rooms, generic command execution, admin redesign, Phase 13 retry, and Phase 20 hardening remain out of scope.
- Normal browser output must not expose adapter secrets, executable arguments, raw prompts, private reasoning, unrestricted tool payloads, or credentials. Commit, push, PR, merge, release, publication, deployment, tags, and visibility changes remain separate parent/user gates.

## 11. Task 16 closure and post-closure sequence

- Task 16 and Phase 19 are complete as of 2026-08-30 under Aaron's explicit functionality-first reset. The criterion report, retained Tasks 1–15 evidence, exact-SHA CI, first-hand Edge/RTX and duplicate-Codex acceptance, focused scheduler correction, and post-fix browser measurements provide sufficient development-stage closure.
- The constrained scheduler correction changed only the standard/imported cooperative interval from 42 ms to 120 ms plus its owning tests. Focused renderer tests, format, typecheck, build, and the affected three browser cases are green; the post-fix Phase 18.5 run recorded render-work p95 1.0 ms and longest task 85 ms with full functional truth.
- The retained native Edge/RTX measurement remains useful historical milestone evidence. Its old source fingerprints no longer bind current development or require another native recapture solely because a shared source file changed.
- The prior 76/77 fresh-copy result is non-blocking diagnostic history: its only failure was a software-rendered outer-budget boundary after the affected functional/performance behavior had passed. Do not rerun `verify:fresh` or rebuild candidate/receipt machinery merely to convert that historical count to 77/77.
- Animation Confirmations completed the 23-model offline authority at 230/230 explicit decisions while preserving all 417 raw clips and 69 locked locomotion decisions. Runtime generation now contains 299 pass mappings, including 23 model-local Dig mappings.
- `ANIMATION_CONFIRMATIONS_REPORT.md` records deterministic integration, real Codex locator/chat corrections, exact-object movement, first-hand Dig/Idle acceptance, selected-agent naming, and truthful movement-status presentation. The milestone is user-accepted, and Aaron has authorized private commit/push with exact-SHA CI; the final SHA and CI receipt remain external to avoid recursive status commits.
- Phase 20's dependency is satisfied, but Phase 20 remains not started and not authorized. Commit/push, provider/profile mutation, and public/release actions remain separate gates.
