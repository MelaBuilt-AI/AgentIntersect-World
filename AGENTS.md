# AgentIntersect World — Project Development Rules

These project-local rules govern Phase 1 and all later phases. They supersede older design or handoff language that requires repeated AgentIntersect checkout verification, security-first implementation, multi-user internet collaboration, or repeated broad reviews.

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
