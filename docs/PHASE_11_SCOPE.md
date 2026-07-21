# AgentIntersect World — Phase 11 Frozen Scope

Frozen: 2026-07-20
Status: **FROZEN / LOCAL ACCEPTANCE GREEN / PRIVATE CI PENDING**
Authorization: the user explicitly authorized complete Phase 11 implementation, true Blender-built 3D avatar production, Mr Fluff’s recommended values for all remaining Phase 11 gates, Codex orchestration, private commit/push, exact-SHA CI, and closeout. Release, tags, publication, deployment, public ingress, visibility changes, original-AgentIntersect edits, and Phase 12 remain unauthorized.
Dependency: completed Phase 10 at private exact-SHA closeout `7e889f3d5b95075884af3e762f77fb31dd639c37`; Phase 11 marker `aeda8978a78e6f58b8f4d270b12779e6982a77ef`; Actions run `29782716484` succeeded.
Runtime baseline: Node `v24.18.0`, pnpm `11.15.0`, Blender `5.2.0 LTS`.
Delivery mode: functionality-first bounded phase; one implementation worker/session, independent parent artifact and operator proof, and user-authorized targeted correction/refinement passes only for observed Phase 11 defects before closeout.
Risk tier: Standard/consequential local UI, persistent preferences, generated binary assets, and status projection under the existing one-human/local-or-trusted-LAN model.

## Objective

Ship privacy-safe, Blender-built, modular 3D avatars whose appearance is selected locally and whose animation never outruns authoritative AgentIntersect status. Every avatar uses the same core body, armature, attachment contract, and primary animation set.

## Frozen decisions

### 1. Observable forms and operator journey

Phase 11 ships the complete requested first avatar kit, not a placeholder:

- Three species families: human, dog, and cat.
- Four selectable heads per family (12 total):
  - human: `round`, `angular`, `soft`, `square`;
  - dog: `labrador`, `shepherd`, `husky`, `beagle`;
  - cat: `shorthair`, `siamese`, `maine-coon`, `bengal`.
- One shared midsection, left/right arm, and left/right leg mesh contract for every form. Species/head choices must not duplicate or fork these core body meshes.
- Selectable hand ends: `hands`, `paws`, `clawed-paws`.
- Selectable foot ends: `feet`, `paws`, `clawed-paws`.
- Selectable fur surface: `none`, `short`, `long`.
- Selectable tail: `none`, `cat-straight`, `cat-curled`, `dog-straight`, `dog-curled`.
- Selectable markings: `solid`, `muzzle`, `mask`, `socks`.
- Twelve labeled body colors covering light/dark human and animal/fantasy palettes; color is never the only semantic distinction.
- Exactly four initial tee shirts, each skinned to the shared armature:
  - `Codex`: blue `#2563EB`, visible `Codex` label;
  - `Claude`: orange `#EA580C`, visible `Claude` label;
  - `Hermes`: yellow `#FACC15`, visible `Hermes` label;
  - `OpenClaw`: red `#DC2626`, visible `OpenClaw` label.
- Agent name is mandatory during avatar selection, normalized to NFC, trimmed, 1–32 visible characters, control-character free, and displayed above the avatar through the shared `ATTACH_NAMEPLATE` anchor. The same name is present in accessible semantic text.
- First-open selection previews the live 3D avatar, requires a valid agent name, saves locally, and enters World. Settings can reopen the editor. The Agents/roster lane renders configured owned-agent avatars with authoritative status text and animation; unconfigured roster records remain truthful text rows and are not silently assigned a fake identity.

### 2. Schema, identity, ownership, validation, and migration

- Schema: `aiw.avatar/0.11`; workspace/package version: `0.11.0-phase11`.
- A profile is owned by one local operator and keyed by an opaque avatar/profile ID plus an opaque authoritative roster/agent reference when assigned. Raw source IDs are not copied into shareable profile payloads.
- Strict allowlisted fields only: schema, opaque IDs/refs, agent name, species, head, hands, feet, fur, tail, markings, body color, shirt, consent/source disclosure, and timestamps needed for local current/previous recovery.
- Unknown keys, invalid combinations, overlong names, control characters, unsafe URLs, and arbitrary asset paths fail validation.
- Existing Phase 5 `version: 1` appearance records migrate once to a neutral human `round` profile with mapped accent color, `Codex` shirt, no fur/tail, hands/feet, and the user-required name step before the migrated avatar may be treated as configured. Invalid/corrupt storage falls back to an unconfigured neutral draft without overwriting the bad record until the user saves or deletes it.
- Save is atomic at the browser storage boundary; the latest valid profile and one previous valid profile are retained for truthful current/previous recovery.

### 3. Consent and safe profile mapping

- Manual avatar creation and the manually entered agent name are explicit local operator input and do not imply automatic private-profile ingestion.
- Automatic AgentIntersect/profile-derived mapping is **off by default** and requires a separate explicit opt-in checkbox plus source disclosure.
- The only allowed imported values are an already-public/explicit display label and opaque owned-agent reference from the bounded Phase 6 roster projection. No prompts, transcripts, memory, source bodies, arbitrary profile fields, inferred traits, biometrics, secrets, filesystem paths, or personality labels are accepted.
- Consent revocation/delete removes imported fields and local profile records, clears allowed presentation references, and restores an unconfigured neutral draft. Consent-off creates no profile-derived persistence, API payload, awareness state, log entry, render prop, or exported data.
- Tests use hostile raw-memory, prompt, transcript, secret, absolute-path, HTML/script, and unknown-field canaries and prove absence from storage, APIs, awareness, logs, DOM, canvas labels, GLB lookups, and exports.

### 4. Embodiment medium and source artifacts

- True 3D is authorized and required.
- Blender `5.2.0 LTS` is the authoring/source-of-truth environment.
- The repository contains a deterministic Blender Python build script, the resulting `.blend` source, a runtime `.glb`, a manifest, and rendered PNG contact-sheet evidence. Running the documented headless Blender command must regenerate the project-owned source/export/evidence deterministically apart from explicitly documented Blender container metadata.
- Runtime format is glTF 2.0 binary (`.glb`) using project-owned geometry/materials and Blender’s bundled `Bfont` only. No external mesh, texture, font, rig, motion-capture, marketplace, AI-generated mesh, or proprietary asset is allowed in this phase.
- The runtime loader uses repository-relative allowlisted assets only and lazy-loads the avatar renderer/GLB after semantic UI truth is available. Phase 10 repository/R3F startup boundaries must remain split.

### 5. Shared rig, attachment, and animation contract

- Exactly one armature named `AIW_Biped_Rig` serves all forms.
- Required shared primary bones: root, pelvis, spine, chest, neck, head, upper/lower arms, hands, upper/lower legs, feet. Modular heads and end-effectors bind to this armature/its named attachment bones; tails and ears use optional secondary bones without replacing the shared primary chain.
- Required attachment anchors: `ATTACH_HEAD`, `ATTACH_HAND_L`, `ATTACH_HAND_R`, `ATTACH_FOOT_L`, `ATTACH_FOOT_R`, `ATTACH_TAIL`, `ATTACH_SHIRT`, and `ATTACH_NAMEPLATE`.
- One reusable action set serves every human/dog/cat combination: `Idle`, `Walk`, `Run`, `Work`, `Celebrate`, `Error`, and `Offline`. There are no per-species primary action duplicates. Tail/ear secondary motion may layer on these actions but may not fork them.
- Blender and runtime verification must prove all 12 heads, every end-effector, every tail, all fur/marking modes, all colors, and all four shirts attach without changing core body object identities or the primary action list.

### 6. Authoritative lifecycle/status mapping

- Phase 6 roster/status text is authoritative; animation is a projection only.
- Deterministic mapping:
  - queued/idle/unknown → `Idle` with explicit text qualifier;
  - claimed → `Walk`;
  - running → `Work`;
  - complete/succeeded → `Celebrate` for one bounded cycle, then `Idle` while text remains complete;
  - failed/error → `Error` for one bounded cycle, then `Idle` while text remains failed;
  - stale/offline/disabled/mismatch → `Offline` or a static offline pose.
- A visual transition occurs only after a corresponding accepted authoritative observation. Missing, stale, offline, or unknown evidence never produces running/success animation. Cross-fades are deterministic and bounded; reconnect restores current authoritative truth rather than replaying cosmetic success.
- Current and previous status labels remain visible and non-color-coded icons/text distinguish every lifecycle state.

### 7. Persistence and Phase 9 presentation boundary

- Profiles/preferences persist only in browser-local storage under a versioned key, with current/previous recovery, export preview, and delete/reset controls.
- No `.blend`, GLB internals, raw roster records, profile source payloads, or private fields enter Yjs.
- Phase 9 awareness may carry only an opaque avatar reference, the manually approved agent display name, and authoritative lifecycle token needed to render owned-agent presence. Durable presentation state stores at most the opaque avatar reference; appearance resolves locally from the bounded profile store.
- Unknown/missing avatar refs render a truthful text-only placeholder and never trigger arbitrary asset/network loading.

### 8. Operator UI

- First-open and Settings editors use numbered sections in this order: `1 Name`, `2 Species/head`, `3 Body parts`, `4 Color/markings`, `5 Tee shirt`, `6 Review and save`.
- All selections are keyboard reachable, expose visible labels, update the same persistent draft, and show a live 3D preview plus semantic summary.
- Active controls are consistently blue; disabled controls are grey. Save remains disabled until the agent name and all strict selections validate.
- Persistent status/results state says whether the current draft is unsaved, saved, recovered from previous, deleted, or blocked and why. Current versus previous values are explicit.
- Desktop and mobile keep controls, preview, nameplate, status, and results reachable without horizontal overflow. WebGL failure switches to the semantic text/profile summary and a generated static contact-sheet fallback without losing actions.

### 9. Accessibility

- The 3D canvas is supplementary. A semantic DOM roster/editor is authoritative and supports the entire configure/save/delete/status workflow without WebGL.
- Reduced motion disables continuous locomotion/secondary motion and uses a static pose plus authoritative text/icon. `prefers-reduced-motion` must not merely slow animation.
- Text-only mode avoids loading the GLB and retains equivalent current/previous state, name, species, customization summary, and actions.
- Forced colors, keyboard-only operation, visible focus, no-color-only status, live announcements for save/delete/status transitions, and screen-reader labels are required.
- Dynamic nameplates are escaped/sanitized, visually above the head, readable against all body/shirt colors, and duplicated in semantic text.

### 10. Asset provenance and budgets

- Required provenance record: `docs/PHASE_11_ASSET_PROVENANCE.md`, listing Blender version, build script, self-authored/project-owned license, every source/export/render path, SHA-256 hashes, object/mesh/material/action counts, and regeneration command.
- Runtime `.glb` maximum: 3 MiB. Blender source maximum: 15 MiB. Contact-sheet evidence maximum: 4 MiB total.
- Maximum full 3D roster avatars visible simultaneously: 12. Up to 64 roster entries retain semantic DOM rows; offscreen/over-cap entries use text/static summaries. Rendering is demand/visibility driven and reuses one loaded GLB/geometry/material set.
- Avatar JS must remain a lazy production chunk and must not re-eager-load the Phase 10 World/repository chunk. Initial production entry remains at or below 400 KiB uncompressed; avatar lazy JS remains at or below 500 KiB uncompressed; the GLB is fetched only when 3D preview/visible avatars require it.
- Supported parent/CI performance fixture: 12 visible avatars, 64 semantic rows, one status transition sweep, 120 measured frames after readiness. Frame p95 ≤ 33.3 ms, longest main-thread task ≤ 100 ms, and no whole-repository symbol detail materialization. Two-CPU constrained mode may reduce cosmetics/avatar count but not semantic truth or actions.

### 11. Fixtures and acceptance transcript

Required deterministic fixtures/evidence:

- all 12 heads and every modular part option on the shared body/rig;
- all 12 colors, four markings, and four exact tee shirts with readable labels;
- required-name empty/valid/boundary/hostile cases and visible above-head nameplate;
- consent off/on/revoke/delete plus raw-memory/secret/path/script canaries;
- every authoritative lifecycle mapping, stale/offline/unknown/reconnect, and proof animation never leads status;
- local current/previous persistence, corrupt-record recovery, export preview, delete/reset;
- human/dog/cat, text-only, reduced-motion, forced-colors, keyboard, mobile, WebGL-failure, and 12-avatar performance states;
- headless Blender regeneration, `.blend` inspection, glTF validation/manifest/hash verification, contact-sheet render, fresh-copy rebuild, Storybook, browser screenshots, and zero-console-error operator journey.

### 12. Versioning and closeout artifacts

Required artifacts:

- frozen `docs/PHASE_11_SCOPE.md`;
- `PHASE_11_REPORT.md`;
- `docs/PHASE_11_ASSET_PROVENANCE.md`;
- `docs/PHASE_11_PERFORMANCE.md`;
- deterministic Blender build/verification scripts;
- project-owned `.blend`, `.glb`, manifest, and PNG evidence;
- versioned schema/animation/attachment contracts and focused tests;
- editor/roster/status/presentation integration and Storybook/browser fixtures;
- canonical design, `PROJECT_STATUS.md`, package versions, acceptance commands, and second-brain mirrors updated only after parent proof;
- private commit/push and successful exact-SHA CI.

## Required acceptance criteria

- The requested customizable Blender-built human/dog/cat avatar kit exists as inspectable `.blend` source and verified runtime `.glb`, not a placeholder or generated screenshot-only mock.
- Every avatar uses the same midsection, arm, leg, armature, attachment, and primary animation contracts.
- Twelve head options, modular fur/hands/paws/claws/feet/tails/markings, twelve body colors, and all four exact branded shirts work in the live editor.
- A valid agent name is required and appears above the rendered head and in equivalent semantic text.
- No raw private profile data is exposed or persisted; automatic mapping is off by default and allowlisted when opted in.
- Animation never outruns authoritative status and all lifecycle states remain distinguishable without color or animation.
- Text-only, reduced-motion, forced-color, keyboard, mobile, and WebGL-fallback modes retain equivalent meaning and actions.
- Frozen asset, startup, renderer, main-thread, frame, and visible-avatar budgets pass on the supported parent/CI environment.
- Phase 10 startup/repository boundaries do not regress.
- The repository remains private/local-first; original AgentIntersect remains unchanged; no release/public/Phase 12 action occurs.

## Verification commands and evidence policy

Use Node `v24.18.0` from `/home/mela_ai/.nvm/versions/node/v24.18.0/bin` and pnpm `11.15.0`. Blender runs headless for deterministic asset generation and inspection. Focused RED→GREEN checks precede one full `pnpm check`, Storybook, Phase 11 measurement, fresh-copy verification, real browser/operator proof, and exact-SHA CI. Worker reports are context only; Mr Fluff independently inspects the `.blend`/GLB/manifest/diff, renders evidence, runs decisive checks, and verifies the live UI.

## Non-goals and prohibited side effects

- No second armature, alternate midsection/arm/leg meshes, quadruped locomotion, or species-specific primary animation set.
- No raw-memory/profile ingestion, inferred personality/biometrics, autonomous social behavior, generative meshes, external asset downloads, cloud avatar service, public multiplayer, accounts, or internet discovery.
- No command authority, worker lifecycle controls, repository mutation based on avatar state, or status inferred from animation.
- No original-AgentIntersect inspection/modification, release, tag, deployment, package publication, public ingress, visibility change, or Phase 12 implementation.

## Exit gate

Phase 11 is complete only when the frozen surface functions in the supported local environment; Blender source/export/provenance and focused/full/browser/accessibility/visual/performance/fresh-copy evidence are independently green; observed defects receive only targeted user-authorized correction/retest passes; the private repository is committed/pushed; exact-SHA CI succeeds; and repository/vault continuity is aligned. Stop at Phase 11. Do not release or begin Phase 12 automatically.
