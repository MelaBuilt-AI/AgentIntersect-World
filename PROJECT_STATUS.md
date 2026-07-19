# AgentIntersect World — Project Status

Updated: 2026-07-19

## Current milestone

**Phase 1 — Monorepo and engineering foundations: COMPLETE**

- Completion state: working and fully verified; changes remain uncommitted
- Evidence: `PHASE_1_REPORT.md`, `docs/PHASE_1_SCOPE.md`, and `docs/PHASE_1_ENGINEERING.md`
- Runtime: Node `v24.18.0`, pnpm `11.15.0`
- Workspace: 15 projects / 14 named app-package graph entries
- Functional apps: Vite/React web plus Fastify local server
- Final typecheck: 18/18 tasks
- Final unit/integration tests: 5 files / 13 tests
- Final architecture regressions: 7/7 tests
- Final production build: 13/13 tasks
- Final Playwright E2E: 1/1 passed, including an independently verified empty browser-cache bootstrap
- Final fresh-copy verification: frozen install and full check passed for 107 project files
- Browser verification: live health visible, zero JavaScript errors, no obvious clipping/overlap
- Review cadence: one bounded audit, one targeted correction pass, no second broad review
- Cleanup: no app listener remained on ports 3770 or 5173; disposable browser cache removed
- Original AgentIntersect: not inspected or modified; Phase 0 remains historical baseline evidence
- Remote/push/release/publication: none

## Completed foundation

### Applications

- `apps/web` — functioning Vite 8 / React 19 foundation page with live local-server health and unavailable states
- `apps/local-server` — functioning Fastify 5 `GET /health` service with shared schema validation and correlation IDs

### Workspace packages

- `agentintersect-client`
- `world-schema`
- `world-event-protocol`
- `repo-indexer`
- `spatial-code-graph`
- `renderer-r3f`
- `sync-yjs`
- `avatar-system`
- `persistence`
- `config`
- `observability`
- `ui`

All packages have explicit exports. Future packages remain skeletal and avoid Phase 2+ dependencies.

### Root acceptance commands

- `pnpm install --frozen-lockfile`
- `pnpm dev`
- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm check:architecture`
- `pnpm smoke`
- `pnpm verify:fresh`
- `pnpm check`

Run them under Node 24 using the wrapper documented in `docs/PHASE_1_ENGINEERING.md` when the ambient shell uses an older Node release.

## Next milestone

**Phase 2 — Functioning local authority server and configuration**

Phase 2 is next but has not started.

### Functionality-first objective

Evolve the Phase 1 Fastify shell into a useful local composition root with observable configuration, readiness, stable error envelopes, correlation, operation lifecycle, graceful shutdown, and explicit loopback/trusted-LAN behavior.

### Initial Phase 2 scope to freeze before implementation

- configuration precedence and validation;
- `GET /health` continuation and new `GET /ready` behavior;
- stable typed error envelopes and correlation propagation;
- cancellable local operation framework and idempotency interface;
- graceful shutdown and port-collision reporting;
- explicit loopback default and trusted-LAN opt-in behavior;
- minimal operator-visible server readiness/configuration in the web app.

### Deferred during functionality build-out

- broad security hardening and internet threat modeling;
- unrelated-user identity, public rooms, cloud multi-tenancy, and public ingress;
- enterprise policy, broad auth/CSRF/rate-limit matrices, or compliance ceremony;
- repository indexing, spatial rendering, Yjs/PartyKit, real AgentIntersect mutation, and Phase 3+ behavior;
- remote creation, push, release, publication, or visibility changes without explicit approval.

### Phase 2 delivery cadence

1. Read `AGENTS.md`, this status file, and Phase 2 in `AgentIntersect_WorldDD.md`.
2. Verify only the AgentIntersect World repository and preserve the completed Phase 1 baseline.
3. Freeze the smallest observable Phase 2 vertical slice, dependency changes, and acceptance commands.
4. Build working functionality first with Codex `gpt-5.6-sol` / high.
5. Run focused tests while building, then the relevant integrated/full checks.
6. Perform one bounded post-build review/audit.
7. Fix confirmed defects once, retest, and stop—no recursive broad review cycle.

## Non-blocking backlog

### Phase 1

- Derive browser package reachability transitively in the architecture checker so browser-consumed `config` and `world-schema` are automatically covered.
- Add SIGINT/SIGTERM cleanup for externally interrupted `verify:fresh` runs.

### Historical Phase 0 surface

- Clear successful MCP response timeout handles.
- Assemble dashboard SSE through complete frame terminators under timeout.
- Broaden generic evidence-pattern coverage.

The Phase 0 items should be revisited only if that historical client/evidence surface is deliberately touched.
