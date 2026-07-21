# Phase 12 acceptance-defect correction report

## Outcome

The single authorized post-implementation correction now uses the installed Hermes `v0.18.2` (`f7c9feb3`) session-stream contract truthfully. Hermes SSE is parsed incrementally from `Response.body`; `assistant.completed.content` is authoritative; `run.completed.messages` and usage are validated without inventing an `output` field; and only bounded assistant text plus tool type/name/redaction metadata can enter World.

`POST /agent-sessions/:sessionId/stream` is now a genuine same-origin SSE response. It emits ordered `aiw.agent-event/0.12` envelopes as the adapter produces them, then bounded `world.final` and `world.done` terminal events. Exact binding, capability re-attestation, one-turn serialization, disconnect cancellation, durable projection, and error truth remain enforced. Approvals and interrupt remain unavailable for this exact-session transport.

The web client now consumes that SSE path for sends. The UI progressively updates one assistant message, renders bounded tool-name-only status in an accessible live region, reconciles the authoritative final without duplication, and clears busy state on completion, stream error, or disconnect.

The installed Hermes API server and turn finalizer were inspected read-only. The active Hermes profile, gateway, original AgentIntersect repository, Git history/remotes, releases, and Phase 13+ were not touched.

## Correction-owned files

- `apps/local-server/src/agent-sessions.ts`
- `apps/local-server/src/agent-session-routes.ts`
- `apps/local-server/test/phase12-agent-sessions.test.ts`
- `apps/local-server/test/phase12-agent-session-api.test.ts`
- `apps/web/src/sessions/session-client.ts`
- `apps/web/src/sessions/agent-stream-state.ts`
- `apps/web/src/sessions/AgentSessionPanel.tsx`
- `apps/web/src/sessions/session-fixtures.ts`
- `apps/web/test/phase12-session-client.test.ts`
- `apps/web/test/phase12-agent-session-ui.test.tsx`
- `apps/web/e2e/phase12-session-journey.spec.ts`
- `integrations/hermes/agentintersect-world/__init__.py`
- `integrations/hermes/test_plugin_conformance.py`
- `tooling/scripts/hermes-profile-change.ts`
- `tooling/scripts/hermes-profile-change.test.ts`
- `PHASE_12_CORRECTION_REPORT.md`

All pre-existing parent scope, status, design, configuration, and Phase 12 implementation edits were preserved.

## Parent-live corrections

The real default-profile acceptance path exposed four concrete integration defects, each corrected with focused regression evidence before the full gates were rerun:

1. Offline avatar identity/consent controls remained visually active; they now disable neutrally while ready/recovered actions retain active styling.
2. Fail-closed profile restore correctly rejected drift but did not recognize Python's generated import cache; restore now allowlists and removes only regular non-symlink `__pycache__/__init__.cpython-<digits>.pyc` files and still rejects every unknown entry.
3. The Hermes adapter's connection timeout remained attached to a valid long-running SSE body and aborted tool-using turns after headers; the timer now protects connection establishment only, while caller cancellation remains active for the stream lifetime.
4. The Python plugin emitted `createdAt` with a `+00:00` offset while the strict World proposal schema required canonical UTC `Z`; plugin output and conformance coverage now use `Z`.

## RED → GREEN evidence

Authoritative runtime: Node `v24.18.0`, pnpm `11.15.0`, `TURBO_CONCURRENCY=1`, low/one-worker focused runs.

RED command:

```text
corepack pnpm@11.15.0 exec vitest run apps/local-server/test/phase12-agent-sessions.test.ts apps/local-server/test/phase12-agent-session-api.test.ts apps/web/test/phase12-session-client.test.ts apps/web/test/phase12-agent-session-ui.test.tsx --maxWorkers=1
```

RED result: `4` files failed; `8` intended regressions failed and `13` existing tests passed. The failures proved the buffered JSON route, absent live callbacks, rejection of no-delta `assistant.completed.content`, acceptance of malformed/mismatched/oversized streams, absent browser stream client, and duplicate-final UI behavior.

Focused GREEN result after correction: the same four focused files passed (`23/23` tests), including fragmented SSE, no-delta final content, bounded/malformed/session mismatch checks, `tool.started`/`tool.completed`/`tool.failed`, actual local streaming before turn completion, disconnect cleanup, browser parsing, progressive UI state, and final deduplication.

Plugin conformance:

```text
python3 integrations/hermes/test_plugin_conformance.py -v
```

Result: `1` test passed. Both interrupted (`interrupted=True`) and failed (`completed=False`, `interrupted=False`) `on_session_end` paths released the exact-session lock and allowed immediate reacquisition without changing the hook surface.

## Verification results

- `corepack pnpm@11.15.0 conformance:phase12` — passed: plugin conformance plus `3` Vitest files / `21` tests.
- Focused protocol/client/UI/story run — passed: `4` files / `13` tests.
- `corepack pnpm@11.15.0 typecheck` — passed across all workspaces.
- `corepack pnpm@11.15.0 lint` — passed.
- `corepack pnpm@11.15.0 build` — passed across all `15` workspace packages.
- `corepack pnpm@11.15.0 exec playwright test apps/web/e2e/phase12-session-journey.spec.ts --workers=1` — passed: `3/3` desktop, mobile, stream/error, deduplication, accessibility, and reload tests.
- `corepack pnpm@11.15.0 check` — passed once: formatting, lint, typecheck, architecture (`11` tests), Vitest (`64` files / `346` tests), build, smoke, and Playwright (`31/31`).
- `git diff --check` — passed.

The production build retained the pre-existing Vite advisory for a chunk larger than 500 kB; it did not fail the frozen build gate and this correction did not expand scope into bundle redesign.

## Parent-owned acceptance proof

Parent acceptance is green:

- secret-free four-operation profile preview and byte-for-byte backups were inspected before installation;
- the default-profile plugin/API became healthy on loopback-only `127.0.0.1:8642` with CORS disabled;
- the final discoverable Discord-backed Hermes session completed two World-originated turns with ordered unique deltas/tool/final events and duplicate-free Sessions API continuity;
- World restart and Hermes restart both recovered the exact World/session pointer without transcript or projection duplication;
- bounded avatar proposal accept/revoke passed, while unsupported approval and interrupt requests failed closed with `409`;
- isolated restore and actual default-profile uninstall/restore both passed; original config/environment hashes and the systemd unit hash remained identical, plugin/runtime paths were removed, and the gateway returned healthy;
- final unrestricted gates passed: plugin conformance, formatting, lint, architecture, 28/28 typecheck tasks, 357/357 Vitest, 15/15 builds, smoke, 32/32 Playwright, Storybook, zero-vulnerability production audit, and 344-file fresh-copy verification with the same 357 tests and 32 browser tests green again.

Phase 12 private implementation `a1ffdc36715d35c78693a49e797fa984ec5c3086` passed exact-SHA Actions run `29858950696` and job `88730418114`; the exit gate is complete. Phase 13 remains not started and unauthorized.
