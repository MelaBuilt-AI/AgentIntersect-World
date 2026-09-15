# Agent Setup Menu — scope and acceptance

Status: completion implementation is present; exact-head GitHub CI and human browser acceptance remain separate gates. Merge stays held for Aaron.

## Completion delivery — manual acceptance follows green CI

Aaron (`1548386442294726697`, September 12) authorized completion, commit/push and exact-head GitHub CI, then preparation of a running manual-acceptance candidate and end-session handoff. No merge before his manual verdict. Implemented scope and honest environment/action limitations are below; native service changes still require separate permission.

Actionable plan: `../.hermes/plans/2026-09-12_131536-agent-setup-completion-before-manual.md`. Continue private draft PR #12; do not merge, publish, restart protected harnesses, or treat the prior feature authorization as approval of individual external changes.

## Authorization

Aaron requested one new private PR on 2026-09-12 (Discord message `1548326185266708510`). It includes persistent agent discovery/setup for Hermes, OpenClaw, Codex, and Claude Code, first-run and Escape-menu integration, and a real native saved-session application-restart test. Opening/pushing the draft PR is authorized. Merge, release, publication, visibility changes, and unrelated runtime cleanup are not authorized.

Confirmed choices:

- Discovery is read-only. When prerequisites require an external plugin/configuration/service change, present its exact scope first and require a separate operator confirmation. Login stays in the harness's own login flow. No blanket authorization to change the operator's current Hermes/OpenClaw/Codex/Claude profiles or restart services is granted by this feature request.
- Save the selected native agent/profile and preserve its configured provider, personality, memory, and skills. New Worlds use separate conversations; saved-work Continue resumes the exact existing native conversation. Hermes existing-session attachment remains an explicit choice.

## Product contract

1. Preserve the normal opening AgentIntersect logo. On first launch without completed agent setup, show Agent Setup Menu immediately afterward, before agent selection. Preserve required user identity/avatar creation before World entry.
2. Returning users with completed setup skip the automatic menu and follow normal agent selection. Saving setup is not selecting the current World's roster and does not automatically dispatch a coding turn.
3. Escape works throughout opening setup, identity/avatar screens, agent selection, and the World. A top-right hint reads exactly `Escape for Menu`. The Escape menu includes `Agent Setup Menu`. Actions unavailable before entry remain disabled or omitted rather than mutating incomplete state.
4. One `Discover Agents` action searches supported installation locations/PATH in the backend's local environment and Windows/WSL environments accessible from that host. Show host/distro, harness, installed location, native identities/profiles where supported, and separate found/configured/ready states. Do not conflate Windows and WSL installations. Report inaccessible/stopped environments; do not silently start a distro/service while claiming discovery is read-only.
5. Each harness offers a user-entered agent display name plus actual native agent/profile/session selection when needed. A name alone is not proof of native identity. Support the exact button label `Attach to Agent Intersect World`.
6. Attachment verifies the selected connection and saves a durable World-owned registration usable after backend restart. Persist connection metadata and credential references, not secrets in browser storage, repository files, or logs. Setup completion is server-owned and survives browser refresh/new client views.
7. Missing executable, authentication, incompatible version, missing model/API/plugin, or an inaccessible execution environment must have actionable copy and a Recheck action. Provide an explicit locator fallback when automatic discovery cannot resolve an installation.
8. Remove the mandatory Hermes-key dependency for users connecting only other harnesses. Do not retain machine-specific Codex/Claude model/provider overrides as the general setup path. Preserve legacy explicitly configured integration paths during migration.
9. Windows/WSL discovery must be paired with real execution and workspace access. Found-but-not-connectable must not become attached/ready. Use exact environment-bound launch arguments and supported native credential handling, not arbitrary browser-supplied shell commands.
10. Harness versions are diagnostic metadata, never exact-version allowlists or installation pins. Aaron explicitly requires normal user-managed harness updates outside World to remain supported. Negotiate/probe required commands, API methods, schemas and native resume behavior instead; check actual protocol compatibility where necessary. Do not downgrade, block updates, or claim arbitrary future breaking versions are compatible. A demonstrated missing/incompatible contract produces actionable setup diagnostics and Recheck. Remove current Codex/Claude/OpenClaw exact-product-version gates and regress compatible version changes.
11. Preserve profile behavior without copying unrelated conversation history into new World sessions. Ending/removing a World connection must not erase native identity, memories, skills, credentials, or unrelated sessions.
12. Multiple saved registrations are distinct from the existing maximum four simultaneous roster members. Duplicate harnesses require distinct native session roots.

## Verification

- Focused tests: no-config startup; missing/duplicate installations; Windows paths with spaces; WSL identity separation; bounded discovery partial failures; discovery performs no setup writes; attach/recheck and restart persistence; profile/provider preservation; per-action confirmation; secret-free projections.
- Frontend tests: first-run logo -> setup; completed setup -> selection; Escape during each opening/setup/selection screen; Escape hint and menu action; no unsolicited attach/dispatch; actionable error states; selection/avatar flow preserved.
- Production build, impacted types/lint, and browser proof use isolated state and do not replace retained operator builds or reset existing Worlds.
- Human visual/operator acceptance remains distinct from automated proof.
- Real saved-session test: disposable native coding session -> actual tracked/untracked work and approved preview -> stop/restart the test application -> Continue -> same files, branch, task, worktree, native conversation and reachable preview without replacement coding dispatch. A retained preview process alone is not preview-process relaunch proof. Record missing support as a demonstrated gap before implementing a focused fix; machine reboot is not claimed from application restart.
- Record exact-SHA CI on the draft PR. Do not merge automatically.

## Implementation map

- Server configuration: `packages/config/src/node.ts`, `packages/config/src/index.ts`.
- Registration/discovery/routes: new focused modules under `apps/local-server/src/`; wire through `server.ts` and `index.ts`.
- Runtime binding: `agent-sessions.ts`, `codex-session-adapter.ts`, `claude-code-session-adapter.ts`, `openclaw-session-adapter.ts` and corresponding focused tests.
- UI: new Agent Setup component/client under `apps/web/src/world-entry/`; `WorldEntryExperience.tsx`, `WorldEscapeMenu.tsx`, entry state/reducer, styles, and affected tests.
- Continuation: existing Workstream/native-session/preview lifecycle, changed only for gaps demonstrated by the real restart test.
- Fresh clone: root README with supported runtime/bootstrap and setup flow.

## Implementation checkpoint

Implemented: persisted registrations; metadata-only Windows/WSL discovery; native configuration routing; environment-bound Codex/Claude process launch with exact argv/stdin, shared-workspace proof and owned-tree cancellation; native-environment Hermes/OpenClaw config reads and profile routing; extra-installation-directory search; readiness/Recheck; first-run setup, saved selection and Escape access.

Hermes setup now explicitly lists the selected profile's recent conversations and saves an optional native conversation ID independently of the display label and registration ID. The default remains a separate new conversation. Selecting an existing conversation does not create, rename, copy or delete native history. Ownership survives runtime recreation; stale/foreign selection is rejected. Native same-session arbitration remains required for dispatch.

Prerequisites use server-owned, expiring, single-use Preview → Confirm → Apply → Recheck plans with exact target/path/effect, configuration/plugin drift checks, cancellation and native config backup. The supported automatic action enables an **already installed** World plugin in the selected **backend-local Hermes profile**, through Hermes' native CLI without built-in tool override. Native login, plugin installation, API provisioning, gateway start/restart and stopped-WSL startup have explicit manual guidance and Recheck; they are not claimed as automatic installers or service controls. No live operator service was changed to test the feature. The real enable action passed against a disposable Hermes home, preserving unrelated configuration and backup bytes.

Windows/WSL execution requires native Python 3 for the target-side process supervisor and a shared drive for repository/workspace access. Native Windows Codex `.exe` from a WSL backend passed real model file creation, fresh-process exact-session continuation, file preservation, and owned Windows child/descendant termination. Windows Codex UNC/WSL-home workspaces are refused with drive-backed guidance after a real native sandbox failure; no sandbox bypass is used. Windows→WSL and other compatible adapter directions have contract/fixture coverage, not separate live-native acceptance. Shell `.cmd`/`.bat` wrappers across the boundary remain unsupported; select the native `.exe`. API-backed transports still require a reachable authenticated loopback gateway and attested native plugin where applicable.

Native binding persistence is covered for all four harnesses. The full Vitest suite passed 1,254 tests after the shared-schema import correction. The subsequent preview-relaunch correction passed its affected nine tests and backend build.

A real Codex production-backend restart first proved native-session/file/Git continuity. The expanded production Workstream/preview API test then reproduced a missing preview relaunch. After the focused correction, Continue on the same preserved native work retained the exact native session, Workstream, task, owned worktree, branch, Git HEAD, tracked/untracked file hashes and message history; a new preview process served the original generated page. No replacement coding or message was sent. Both test-owned backend generations and preview processes were stopped. This is native API proof, not a human browser verdict. The retained private evidence root is `/home/mela_ai/.hermes/runs/aiw-pr12-workstream-_b6vbhjw`; the normal entry documentation is in the root README.

**Still gated:** human browser/visual acceptance of setup, selection, prerequisites and normal-UI Continue; and final exact-SHA delivery checks recorded externally. Native API proof, fixture coverage and browser automation do not replace Aaron's verdict. Missing native prerequisites remain found-but-not-ready, not fabricated support.

## Protected baseline

Based on merged PR11 (`87139ff99e88fbfa92256552ffe6177b22f3b132`). Six inherited residuals are excluded: the modified pointer-lock PNG; two September 6 plan files; movement-QA PNG/request text; `tsconfig.tsbuildinfo`. No broad reset/clean/stash. Retained operator lanes and original AgentIntersect remain untouched.
