# Phase 12 — Frozen Scope

**Status:** FROZEN / AUTHORIZED FOR IMPLEMENTATION
**Frozen:** 2026-07-21
**Baseline:** `c60bef65cd3ae7df0829c2a5181ee705f3257352`
**Runtime:** Node `v24.18.0`, pnpm `11.15.0`
**Hermes runtime inspected:** Hermes Agent `v0.18.2` (`2026.7.7.2`, upstream `f7c9feb3`)
**Delivery mode:** Functionality-first bounded phase: one Codex implementation report, independent parent functional/browser/fresh-copy proof, and at most one targeted acceptance-defect correction pass. No routine broad audit.

## Objective

Deliver the smallest truthful vertical slice in which AgentIntersect World can attach to the operator's existing default-profile Discord-backed Hermes session, expose explicit session modes and adapter capabilities, exchange persistent free-form text through supported Hermes APIs, preserve native Hermes approvals, offer a bounded preview-only avatar proposal, recover after browser/World/Hermes restart, and preserve a narrow Guided Build front door without implementing Phase 13 or later behavior.

## Frozen product decisions

1. **Hermes seam:** use a reversible, profile-scoped `agentintersect-world` Hermes plugin/adapter. It may extend the documented loopback API Server Sessions/Runs surface but must not edit or fork Hermes core.
2. **Acceptance identity:** default Hermes profile, attached to the existing Discord session `20260721_011618_330489c8`. A bounded `SOUL.md`-derived avatar proposal is allowed only as preview data requiring explicit accept/edit/decline/revoke. Raw `SOUL.md` content never leaves Hermes.
3. **Permissions:** Hermes native approvals remain unchanged. World may display and forward approval/denial requests through supported Hermes approval APIs but may not pre-answer, weaken, replace, or bypass native approval behavior.
4. **Retention:** Hermes owns transcripts. World stores project-durable session pointers, normalized/redacted metadata, event cursor/checkpoint, consent state, and redacted ledgers until the World project is deleted. Preview logs, where later phases create them, expire after 30 days. Phase 12 creates no Preview Manager.
5. **Magic-slice fixture:** reserve a disposable local/private Vite + TypeScript task-board fixture for the later complete magic slice. The eventual bounded change is a tested status filter followed by a local preview. Phase 12 may create a no-edit fixture for persistence proof but must not implement the Phase 14 edit/test/preview journey.
6. **Guided Build cutline:** discover local design files and show bounded validation previews; importing/submitting a design remains outside World. Existing AgentIntersect-managed design/phase truth remains AgentIntersect-owned.
7. **Profile modification authority:** after exact preview and backup artifacts exist, the parent may install the reversible plugin into the active default profile. No Hermes core edits. Installation and uninstall/restore must be proven.
8. **Strict phase boundary:** implement session modes, Agent Session Gateway, persistent Hermes text, bounded avatar proposal, reconnect/recovery, safe controls, and Guided Build front door only. Navigation, World Actions, tool visualization beyond truthful text/status, preview execution, voice, and multi-agent implementation are prohibited.

## Current Hermes capability matrix

The inspected runtime and authoritative local docs expose the following supported seam:

| Required capability   | Current supported surface                                                                        | Phase 12 rule                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Discover runtime      | `GET /v1/capabilities`, `/v1/models`, `/v1/skills`, `/v1/toolsets`                               | Attest before enabling controls; absent flags remain disabled                                                                                                                  |
| List/read sessions    | `GET /api/sessions`, `GET /api/sessions/{id}`, `GET /api/sessions/{id}/messages`                 | Attach only to an explicitly selected existing session                                                                                                                         |
| Persistent turn       | Sessions chat/stream or Runs API with the exact `session_id`                                     | Use only a path that preserves the existing SessionDB transcript and returns structured completion                                                                             |
| Deltas/tool status    | session chat SSE and Runs SSE                                                                    | Normalize bounded events; do not infer unsupported events                                                                                                                      |
| Approvals             | Runs event stream + `POST /v1/runs/{id}/approval`; plugin approval observer hooks                | Preserve native choices verbatim; if the active path cannot round-trip approvals, advertise approvals unavailable and do not invoke approval-requiring tools through that path |
| Interrupt             | `POST /v1/runs/{id}/stop`                                                                        | Enable only for the exact active World-owned run                                                                                                                               |
| Session continuity    | persisted `state.db`, Sessions API, exact session ID                                             | Re-attest after reload/restart; missing/ended/reset session becomes explicit unavailable/reset-required                                                                        |
| Profile identity      | default-profile API server model/capabilities plus plugin `profile_name`                         | Display `default`; never expose credentials                                                                                                                                    |
| Avatar proposal       | reversible plugin, fixture-tested bounded local derivation                                       | Strict schema, source disclosure, preview/accept/edit/decline/revoke; no raw persona/memory/transcript                                                                         |
| Existing Discord lane | exact SessionDB ID and gateway session key discovered from authenticated local APIs/plugin state | Refuse concurrent World dispatch when same-lane safety cannot be attested; never create a shadow transcript silently                                                           |

The API server is currently disabled and has no configured key. Phase 12 may enable it only on `127.0.0.1`, without browser CORS, using a generated high-entropy bearer key that is never committed or rendered in World.

## Profile installation preview and restore contract

Codex may build and test repository-owned plugin sources but must not change the live profile. Parent installation is limited to:

- create `~/.hermes/plugins/agentintersect-world/` from the verified repository plugin artifact;
- add only `agentintersect-world` to `plugins.enabled` in `~/.hermes/config.yaml`;
- add/update only `API_SERVER_ENABLED`, `API_SERVER_HOST`, `API_SERVER_PORT`, and `API_SERVER_KEY` in `~/.hermes/.env`;
- create only purpose-specific runtime/discovery state under `~/.hermes/agentintersect-world/`, with secret-bearing files mode `0600` and directories `0700`.

Before installation, create timestamped byte-for-byte backups of every existing file that will change and a machine-readable preview containing path, operation, mode, and old/new SHA-256 without secret values. After installation, restart the gateway once, verify plugin/API health and this Discord session, then prove uninstall/restore from the backup in an isolated cloned profile before retaining the active installation. The active profile remains installed only when all acceptance checks pass.

## Required World contracts

- `aiw.agent-session/0.12` strict persistent session schema.
- `aiw.agent-event/0.12` strict ordered event envelope.
- Capability-declared adapter registry and Hermes manifest.
- Four mode values: Explore, Collaborate, Autonomous, Guided Build.
- Autonomous is visible but disabled with an explicit later-phase explanation.
- Explore never grants mutation authority; Phase 12 does not test mutation through World.
- Collaborate preserves Hermes-native approval semantics.
- More-permissive mode transitions require explicit confirmation; de-escalation is immediate.
- World session identity binds exact Hermes session ID, profile, workspace/repository, permission revision, and capability snapshot hash.
- Dedupe event IDs, reject sequence gaps until reconciliation, and represent reset-required/offline/missing states explicitly.
- Hermes transcripts remain canonical; World stores only bounded normalized projections and approved final-message display content required for its accessible chat.
- Adapter-native IDs and secrets never enter Yjs/presentation state.

## Observable user surface

A numbered operator flow must provide:

1. Detect Hermes plugin/API health.
2. Confirm the `default` profile.
3. Select the existing Discord session.
4. Inspect supported/unavailable capabilities.
5. Select Explore or Collaborate; show Autonomous disabled and Guided Build separately owned.
6. Review native Hermes permission behavior.
7. Connect or resume.
8. Send a harmless test message into the exact session and render ordered deltas/final status.
9. Preview and explicitly accept/edit/decline the bounded avatar proposal.
10. Enter/reopen the World chat, with exact profile/session/repository identity visible.

The UI must keep active actions blue and disabled actions grey, expose current versus previous/recovered labels, provide reachable status/results, work on desktop/mobile/keyboard/reduced-motion/no-WebGL paths, and emit no horizontal overflow or JavaScript errors.

## Guided Build front door

- Discover design files only within the selected repository and bounded allowlisted design roots/extensions.
- Parse enough metadata for name, validation state, phase headings, and acceptance headings.
- Preview validation only; no import, submission, phase start, approval, advancement, job creation, process control, or AgentIntersect mutation.
- Existing Phase 6/7 AgentIntersect readiness and ownership labels must remain truthful.

## Acceptance evidence

1. Schema and adapter contract tests, including malformed/oversized events, duplicate IDs, gaps, reset, offline, missing session, wrong workspace, and capability degradation.
2. TDD evidence for every new behavior: focused RED before production implementation, then GREEN.
3. Fixture plugin/API conformance in an isolated temporary `HERMES_HOME` without reading or writing the active profile.
4. Actual default-profile attach to `20260721_011618_330489c8` after the exact profile-change preview/backup.
5. At least two World-originated harmless turns in that exact Hermes session, one being `find handoff` or an equivalent skill-backed continuity request, with transcript continuity verified through Hermes' Sessions API and this Discord lane.
6. Browser reload and World-server restart resume the exact session or show explicit reset/unavailable truth.
7. Hermes gateway restart reloads the reversible plugin and reconnects without duplicate messages/events.
8. Native approval behavior is either round-tripped unchanged on a supported harmless approval fixture or truthfully disabled for the selected transport; no simulated approval success.
9. Interrupt/stop targets only the exact World-owned active run and reports final state truthfully.
10. Persona/secret canary fixtures prove raw `SOUL.md`, memory, transcripts, API key, unrestricted tool args/output, and private reasoning never enter World persistence, APIs, logs, HTML, or Yjs.
11. Guided Build discovery/validation preview cannot mutate AgentIntersect or submit/import a design.
12. Existing Phase 11 functionality and Phase 6/7 Guided Build authority tests remain green.
13. Independent parent runs focused tests, complete `pnpm check`, Storybook, production audit, final fresh-copy verification, browser desktop/mobile/accessibility proof, and process/listener cleanup.
14. Live plugin install health, isolated uninstall/restore proof, and no unrelated profile/config drift.

## Non-goals and prohibited side effects

- No Phase 13 navigation, FPS controls, pathfinding, or World Actions.
- No Phase 14 edit/test visualization, Autonomous execution envelope, or Preview Manager.
- No Phase 15 voice/audio.
- No Phase 16 multi-agent/worktree implementation.
- No raw PTY scraping as the acceptance adapter.
- No Hermes core or original AgentIntersect source edits.
- No public ingress, CORS wildcard, cloud relay, tunnel, deployment, package publication, tag, release, repository visibility change, or public/private-alpha distribution.
- Codex may not commit, push, install into the active Hermes profile, restart the live gateway, or begin Phase 13.

## Stop conditions

Stop rather than reinterpret scope when:

- the current Hermes API/plugin runtime cannot safely attach to the exact existing session;
- same-session cross-surface serialization cannot be proven and cannot fail closed;
- native approvals would be weakened or simulated;
- a profile change would exceed the listed paths;
- raw persona/transcript/secret data would need to leave Hermes;
- acceptance requires Phase 13+ behavior.

## Acceptance outcome

Parent live acceptance passed on 2026-07-21. Hermes context compaction retired earlier native session IDs during the long closeout, so each attempt failed closed rather than silently rebinding; the final gate froze the then-current discoverable Discord-backed session and proved two World-originated turns, ordered tool/final streaming, duplicate-free Sessions API continuity, World and Hermes restart recovery, bounded avatar accept/revoke, truthful unsupported controls, isolated restore, and actual default-profile rollback. The parent selected the safer post-proof state: no active plugin/runtime installation retained, original profile hashes restored, gateway healthy, and service unit unchanged.

All unrestricted local/fresh/browser gates are green. Private implementation `a1ffdc36715d35c78693a49e797fa984ec5c3086` passed exact-SHA Actions run `29858950696` and job `88730418114`; the Phase 12 exit gate is complete. Phase 13 remains not started and unauthorized.

## Exit gate

Phase 12 is complete only after the repository implementation, real existing-session conversation, restart continuity, avatar consent flow, Guided Build preview boundary, profile install/restore proof, complete local/fresh/browser gates, private commit/push, and exact-SHA CI are green. Stop at the Phase 12 gate; Phase 13 remains not started and unauthorized.
