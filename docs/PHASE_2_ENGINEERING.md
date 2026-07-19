# Phase 2 engineering guide

Phase 2 is an implementation candidate pending parent proof and the bounded independent audit. This document does not mark the phase complete.

## Supported runtime and commands

Run from the repository root under Node 24 and pnpm 11.15.0:

```sh
npx --yes --package=node@24 --call 'corepack pnpm@11.15.0 install --frozen-lockfile'
npx --yes --package=node@24 --call 'corepack pnpm@11.15.0 check'
npx --yes --package=node@24 --call 'corepack pnpm@11.15.0 verify:fresh'
```

Focused regressions:

```sh
npx --yes --package=node@24 --call 'corepack pnpm@11.15.0 exec vitest run packages/config/test/config.test.ts'
npx --yes --package=node@24 --call 'corepack pnpm@11.15.0 exec vitest run apps/local-server/test/health.test.ts apps/local-server/test/api.test.ts apps/local-server/test/operations.test.ts apps/local-server/test/process-lifecycle.test.ts'
npx --yes --package=node@24 --call 'corepack pnpm@11.15.0 exec vitest run apps/web/test/health-client.test.ts apps/web/test/operator-client.test.ts'
npx --yes --package=node@24 --call 'corepack pnpm@11.15.0 exec vitest run tooling/scripts/architecture.test.ts'
npx --yes --package=node@24 --call 'corepack pnpm@11.15.0 exec playwright test apps/web/e2e/operator-flow.spec.ts'
```

## Configuration

- `AIW_NETWORK_SCOPE=loopback|lan` defaults to `loopback`.
- `AIW_HOST` defaults to `127.0.0.1`, or `0.0.0.0` after explicit LAN selection.
- `AIW_PORT` defaults to `3770` and accepts integers from 1 through 65535.
- `AIW_INSTANCE_NAME` defaults to `AgentIntersect World Local` and accepts 1 through 80 trimmed characters.
- `AIW_DEMO_OPERATION_MAX_MS` defaults to `5000` and accepts 50 through 60000 milliseconds.

The browser-safe `@agentintersect-world/config` root contains constants and types. Environment loading is available only from the separate `@agentintersect-world/config/node` export. API configuration responses contain only phase/version, instance name, scope, host, port, and operation limit.

## Endpoints

- `GET /health` preserves the Phase 1 health shape.
- `GET /ready`, `/config`, and `/doctor` return correlated `ApiResult` envelopes.
- `GET /openapi.json` returns generated OpenAPI 3.0.3 JSON.
- `POST /operations` creates the sole `demo-delay` operation kind and requires `idempotency-key`.
- `GET /operations` lists at most 100 recent records, newest first.
- `GET /operations/:id` reads one record.
- `POST /operations/:id/cancel` idempotently cancels a running record.

Valid UUID `x-correlation-id` values are mirrored in the response header/body; invalid or absent values are replaced. Failures use stable `validation`, `not_found`, `conflict`, or `internal` codes without exception details.

## RED evidence captured before implementation

- Config: 1 file / 7 tests failed because the separate Node loader did not exist; GREEN was 1 file / 7 tests.
- Inspection API: 1 file / 7 tests failed with missing 404 routes, absent envelopes/OpenAPI, and non-propagated correlation; GREEN with preserved health was 2 files / 8 tests.
- Operations: 1 file / 5 tests failed because the placeholder service returned 503; GREEN with API regressions was 2 files / 12 tests.
- Process lifecycle: 1 file / 3 tests failed because startup omitted network scope and collisions emitted no actionable message; GREEN was 1/3 with real loopback/LAN listeners and SIGINT/SIGTERM.
- Web client: 1 file / 3 tests failed assertions because authority/operation client exports were absent; GREEN with preserved health-client coverage was 2 files / 5 tests.
- Operator flow: Playwright 1/1 failed because Phase 2 and the numbered controls were absent; GREEN was 1/1 after implementation.
- Architecture: the transitive fixture produced no violation and two assertions failed; GREEN was 1 file / 9 tests after browser dependency reachability and declared-subpath handling were implemented.

The operation service is intentionally in-memory and bounded. It executes no agent, repository, command, shell, PTY, worker, job, or arbitrary user code. Fastify close clears all operation timers and terminally cancels pending demo records.

## Current worker verification

- Frozen install passed across all 15 workspace projects.
- `pnpm check` passed: formatting and lint; 18/18 typecheck tasks; 9/9 architecture regressions; 10 test files / 40 tests; 13/13 production build tasks; disposable-port API/web smoke; and 2/2 Playwright tests.
- `pnpm verify:fresh` passed for 123 copied source files with the same complete check. Its first clean run exposed a process-test dependency on pre-existing `dist`; the regression now launches the source entry with Node's pinned `tsx` import while production smoke still launches compiled output.
- Live loopback proof returned health/ready/config/doctor/OpenAPI 200 responses, mirrored correlation, 8 documented paths, idempotent 202→200 replay, 409 conflict, cancellation, completion, and a two-record newest-first list.
- Live LAN proof bound `0.0.0.0` only after `AIW_NETWORK_SCOPE=lan`, advertised Fastify's same-machine reachable URL, returned the safe LAN config, and stopped cleanly.
- Playwright exercised Steps 1–3, verified blue actionable and grey disabled buttons, retained a cancelled previous record beside a succeeded current record, found no browser errors or horizontal overflow, and captured `test-results/phase2-operator-flow.png`.
