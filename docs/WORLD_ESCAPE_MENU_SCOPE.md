# Normal-World Escape Menu — Frozen Correction Contract

Status: bounded implementation candidate

Frozen: 2026-07-28

This document authorizes only the normal-product Escape menu correction in the
current imported-avatar worktree. It does not authorize Phase 18.5 resumption,
Phase 19/20 work, internal-dashboard exposure, native Hermes mutation, external
delivery, or protected service changes.

## Activation and keyboard ownership

- Escape toggles this menu only while the normal World room is active.
- No Escape listener from this feature is mounted during identity, session
  selection, agent connection, or avatar setup.
- An editable control, another modal, or active mouse-look retains Escape
  ownership. This feature neither prevents nor stops an event when it is idle.
- When this menu opens or closes, it prevents and stops that Escape event.
- Opening moves focus into the dialog. Tab and Shift+Tab remain contained.
  Closing restores the opener when it still exists, otherwise the World room.
- The menu is keyboard-only operable, responsive, reduced-motion compatible,
  and uses the normal Consolas blue-enabled/grey-unavailable action language.

## Product-facing settings

- Settings remains inside the normal-product modal; it never links or routes to
  `/internal/dashboard`.
- This slice may expose only innocuous World display preferences: whether
  control hints are shown and whether the Escape surface uses larger text.
- These preferences are browser-local and may persist independently. They do
  not change services, providers, profiles, repositories, or native sessions.

## Logout

- Logout removes only this browser's World attachment pointer and volatile
  World presentation state, then returns to the saved operator's session-entry
  surface.
- It preserves the saved user identity/avatar, saved display preferences,
  unrelated browser data, the native Hermes root, native history, and all
  server-owned native-session state.
- It performs no gateway termination, native logout, consent revocation, or
  server delete/reset request.

## Reset Session

- Reset Session requires an explicit confirmation inside this modal.
- Confirmation clears only this browser's World attachment pointer, queued
  presentation/chat state, current repository-floor presentation, and current
  journey selection needed to begin a new World session.
- It preserves the saved user identity/avatar, saved display preferences,
  unrelated saved profiles/data, immutable native Hermes root/history, and
  server-owned native session.
- It never invokes a native or World destructive session-delete/reset endpoint.

## Change Avatar

- When both operator and connected agent are present, Change Avatar first shows
  an explicit target selector.
- User opens `role="user"` setup and normally offers only `user-male`. Saving
  uses the existing browser profile store and returns to the same World.
- Agent opens `role="agent"` setup and offers only `cat-agent` and
  `futuristic-robot`. Saving uses the existing exact-session avatar-consent path,
  preserves the connected agent and native root, and returns to the same World.
- Opening or canceling either builder does not persist or rewrite an avatar.

## Change Agent

- Change Agent removes only the browser's current World attachment pointer and
  volatile presentation state, then returns to the Hermes agent-name prompt.
- It preserves the operator identity/avatar and exact native Hermes
  session/history. It does not attach a replacement or invent an identity.

## Non-goals and server boundary

- No internal dashboard, diagnostics, evidence, recovery, provider, profile,
  gateway, service, or admin navigation.
- No native message, consent revocation, native logout, session deletion,
  session reset, gateway termination, or history mutation.
- No service restart/reconfiguration, public/LAN ingress change, dependency
  change, original-AgentIntersect edit, commit, push, release, or deployment.
