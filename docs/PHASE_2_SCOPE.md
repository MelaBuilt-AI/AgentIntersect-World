# Phase 2 Scope Contract — Functioning Local Authority Server and Configuration

Date: 2026-07-19
Status: Frozen for implementation
Risk/delivery mode: Standard functionality-first bounded phase
Authority: `AGENTS.md`, then this contract, then Phase 2 in `AgentIntersect_WorldDD.md`
Baseline commit: `d1d926ce195ea4502bcc03a1d831b45e8bb76cf8`

## Goal

Evolve the Phase 1 Fastify/Vite shell into a useful local composition root. The operator must be able to inspect readiness and safe configuration, start and cancel an idempotent local demo operation, observe current and previous operation results in the web app, and stop the server cleanly.

This is a local/trusted-LAN product slice for one human and that human’s owned agents/views. It is not an internet, unrelated-user, or multi-tenant service.

## Supported environment

- Node `24.x`; parent reference runtime `v24.18.0`.
- pnpm `11.15.0` through Corepack.
- WSL/Linux is the authoritative Phase 2 execution environment.
- Loopback is the default network scope.
- Trusted-LAN binding is an explicit operator opt-in and is tested from the same machine using the LAN bind.

## Frozen dependency change

Add only:

- `@fastify/swagger@9.8.1`

No database, authentication framework, queue, PartyKit/Yjs, state manager, router, logging platform, or repository/command-execution dependency is authorized.

## Version marker

Update root/app metadata and workspace package manifests to `0.2.0-phase2`. Preserve the Phase 1 report and baseline history.

## Configuration contract

Implement a validated Node-only configuration loader without making the browser-consumed `@agentintersect-world/config` root Node-dependent.

Environment contract:

- `AIW_NETWORK_SCOPE=loopback|lan`, default `loopback`.
- `AIW_HOST`, default `127.0.0.1` for loopback and `0.0.0.0` only after explicit `lan` selection.
- `AIW_PORT`, default `3770`, integer `1..65535`.
- `AIW_INSTANCE_NAME`, default `AgentIntersect World Local`, trimmed non-empty string with a practical length cap.
- `AIW_DEMO_OPERATION_MAX_MS`, bounded positive integer with a default that supports the demo flow.

Expose a safe configuration view containing only phase/version, instance name, network scope, host, port, and operation limit. No environment dump or secret values.

## HTTP/API contract

Preserve `GET /health` and add:

- `GET /ready` — typed readiness, runtime, version, safe config, correlation ID.
- `GET /config` — safe configuration response.
- `GET /doctor` — operator-readable checks for runtime, configuration, and operation service readiness.
- `GET /openapi.json` — generated OpenAPI JSON for Phase 2 routes.
- `POST /operations` — create one bounded in-memory `demo-delay` operation.
- `GET /operations` — bounded list, newest first.
- `GET /operations/:id` — current operation record.
- `POST /operations/:id/cancel` — idempotent cancellation.

Use shared Zod schemas/types for externally visible payloads. Success responses use the existing `ApiResult` envelope where practical; all failures use one stable correlated `ApiError` envelope.

## Correlation and error contract

- Accept a valid UUID `x-correlation-id` and mirror it in response header/body.
- Generate a new UUID when the header is absent or invalid.
- Return stable error codes for validation, not found, conflict, and internal failures.
- Do not leak stack traces, raw environment values, or internal exception text to API clients.

## Operation contract

- Kind: `demo-delay` only.
- Request: bounded `durationMs` plus an optional short operator label.
- Require a bounded `idempotency-key` header for creation.
- Repeating the same key and same request returns the same operation.
- Reusing the key with a different request returns a correlated conflict error.
- Lifecycle: `running -> succeeded` or `running -> cancelled`; cancellation is idempotent.
- Record stable IDs, timestamps, request details, status, and a small result message.
- Keep operations in memory and bounded to a practical recent-operation limit.
- Clear operation timers/resources when the Fastify server closes.
- Do not run shells, agents, repositories, child processes, jobs, or arbitrary user code.

## Process lifecycle contract

- `pnpm dev` keeps the existing simultaneous web/server developer loop.
- Startup reports the actual URL, network scope, and clear port-collision errors.
- SIGINT/SIGTERM handlers close Fastify once and exit cleanly.
- Tests prove real ephemeral-port start/close and a real port-collision path.
- No listener or timer remains after smoke/E2E/parent verification.

## Operator UI contract

Extend the existing page without a broad redesign:

1. **Step 1 — Start demo operation:** reachable active button, consistently blue when actionable.
2. **Step 2 — Cancel current operation:** blue when actionable, grey only when disabled.
3. **Step 3 — Review result:** persistent, reachable status/result area.

Also show:

- current readiness and safe network/configuration details;
- explicit **Current operation** and **Previous operation** labels;
- running, succeeded, cancelled, unavailable, and error states;
- bounded polling while an operation is active;
- no clipped, overlapping, or escaping content at the parent browser viewport.

## Architecture contract

- Keep the browser import boundary for `config` and `world-schema` explicit; Node-only config loading lives behind a separate Node export/module.
- Extend the architecture regression so a Node built-in imported through a browser-consumed package fails closed.
- Local-server authority remains outside presentation/sync packages.
- No cycles, forbidden dependency directions, deep imports, or accidental Phase 2 dependencies in future skeletal packages.

## Required TDD slices

Use vertical RED→GREEN evidence for:

1. config defaults, explicit LAN mode, and invalid config;
2. ready/config/doctor/OpenAPI and correlated error behavior;
3. operation create/idempotent replay/conflict;
4. operation completion/cancellation/list/get and server-close cleanup;
5. real start/close and port-collision reporting;
6. web API client and operator flow;
7. transitive browser-boundary regression.

Tests must fail for the expected missing-behavior reason before implementation. Add one happy path and one credible boundary per acceptance behavior rather than exhaustive security matrices.

## Acceptance commands

Run from the repository root under Node 24:

```sh
npx --yes --package=node@24 --call 'corepack pnpm@11.15.0 install --frozen-lockfile'
npx --yes --package=node@24 --call 'corepack pnpm@11.15.0 check'
npx --yes --package=node@24 --call 'corepack pnpm@11.15.0 verify:fresh'
```

Phase 2 parent proof additionally requires:

- focused config/server/operation/web regressions;
- live loopback health/ready/config/doctor/OpenAPI requests;
- live operation start, idempotent replay, conflict, cancel, and completion;
- explicit LAN-mode startup/config proof from the same machine;
- browser interaction through all three numbered steps;
- browser console inspection and screenshot;
- graceful shutdown/port cleanup proof;
- `git diff --check`;
- fresh jCodeMunch index.

## Exit gate

1. One Codex `gpt-5.6-sol` / high implementation worker.
2. Parent inspection plus focused/full/live/browser/fresh-copy proof.
3. One fresh bounded read-only audit against this contract.
4. At most one targeted correction pass for confirmed blockers.
5. Parent blocker regressions plus main-suite retest.
6. Stop—no second broad review.

## Explicit non-goals

- Authentication/session exchange, CSRF, enterprise policies, broad rate/body/Host/CORS matrices, public-internet threat modeling, unrelated users, cloud multi-tenancy, or public rooms.
- Persistent operation ledger, database/migrations, restart recovery, distributed operations, real workers, shell/PTY execution, or repository mutation.
- Repository discovery/indexing, spatial world, rendering, avatar, Yjs/PartyKit, or Phase 3+ product behavior.
- Inspection or modification of `/home/user/AgentIntersect`.
- Remote creation, push, tag, release, publication, or visibility change.
- A second broad audit or recursive hardening loop.
