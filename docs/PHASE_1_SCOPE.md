# Phase 1 Scope Contract — Monorepo and Engineering Foundations

Date: 2026-07-19
Status: Frozen for implementation
Authority: `AGENTS.md`, then this scope contract, then Phase 1 in `AgentIntersect_WorldDD.md`

## Outcome

Deliver a functioning Node 24 pnpm/Turborepo workspace with:

- a runnable Vite + React web application that visibly identifies AgentIntersect World and can display local-server health;
- a runnable Fastify local server with a typed `GET /health` response;
- strict public package exports and a small shared schema/config/observability/UI foundation used by the apps;
- focused unit/integration tests, one Playwright browser smoke, architecture-boundary tests, builds, lint, typecheck, formatting, and a disposable fresh-clone verification command.

This phase establishes a working development loop. It does not implement Phase 2 authority behavior, spatial rendering, repository indexing, AgentIntersect mutation, public collaboration, or broad security hardening.

## Frozen workspace graph

```text
apps/
  web/                    # functioning Vite/React browser app
  local-server/           # functioning Fastify health server
packages/
  agentintersect-client/  # preserve completed Phase 0 package
  world-schema/           # shared health/result/correlation schemas and types
  world-event-protocol/   # skeletal exported event contract
  repo-indexer/           # skeletal public package
  spatial-code-graph/     # skeletal public package
  renderer-r3f/           # skeletal public package
  sync-yjs/               # skeletal presentation-sync package; no command/filesystem imports
  avatar-system/          # skeletal public package
  persistence/            # skeletal public package
  config/                 # shared app metadata and local configuration
  observability/          # correlation/result helpers
  ui/                     # minimal accessible React status component used by web
examples/
  vertical-slice-repo/    # tiny deterministic fixture/readme only
  large-repo-fixture/     # fixture-size definition only; no generated bulk tree
tooling/
  scripts/                # architecture, smoke, and fresh-clone verification
```

`apps/party-server` and hosted PartyKit infrastructure are not part of Phase 1.

## Frozen dependency versions

Use exact versions in the lockfile and manifests:

- package manager: `pnpm@11.15.0`
- task runner: `turbo@2.10.5`
- TypeScript: `6.0.3` (chosen instead of current TypeScript 7 because `typescript-eslint@8.64.0` supports TypeScript `<6.1.0`)
- Node types: `@types/node@24.13.3`
- React / React DOM: `19.2.7`
- React types: `@types/react@19.2.17`, `@types/react-dom@19.2.3`
- Vite: `8.1.5`
- Vite React plugin: `@vitejs/plugin-react@6.0.3`
- Fastify: `5.10.0`
- Zod: `4.4.3`
- Vitest: `4.1.10`
- Playwright test: `@playwright/test@1.61.1`
- ESLint: `10.7.0`
- ESLint JS config: `@eslint/js@10.0.1`
- TypeScript ESLint: `typescript-eslint@8.64.0`
- React hooks plugin: `eslint-plugin-react-hooks@7.1.1`
- React refresh plugin: `eslint-plugin-react-refresh@0.5.3`
- globals: `17.7.0`
- Prettier: `3.9.5`
- TS runtime/dev launcher: `tsx@4.23.1`
- multi-app dev launcher: `concurrently@10.0.3`

Do not add Three.js/R3F, Yjs, PartyKit, SQLite, tree-sitter, state libraries, authentication packages, SBOM/provenance tooling, or other future-phase dependencies.

## Required behavior

1. `GET /health` returns a typed, schema-validated payload containing service name, status, version, runtime, and correlation ID.
2. The web application renders a usable Phase 1 foundation page and displays health from the local server, including a clear unavailable state.
3. One root command starts both development applications.
4. One root command runs the workspace’s build and tests.
5. Every workspace package has explicit `exports`; cross-package deep imports are prohibited.
6. Browser source cannot import Node built-ins or server-only packages.
7. `sync-yjs` cannot import command, filesystem, process, lifecycle, local-server, or AgentIntersect-client authority.
8. Package dependency cycles and forbidden dependency directions fail closed.
9. Architecture tests include deliberate invalid fixture graphs/imports that prove the checker rejects violations.
10. Existing Phase 0 code/evidence remains present and unmodified unless a mechanical workspace integration change is essential; do not run or require the original-AgentIntersect compatibility suite as a Phase 1 gate.

## Acceptance commands

All commands must be runnable from the repository root under Node 24:

```text
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:e2e
pnpm check:architecture
pnpm smoke
pnpm verify:fresh
pnpm check
```

`pnpm dev` is long-lived. All other acceptance commands must terminate deterministically. `pnpm smoke` must launch built applications on disposable ports, verify the server health payload and web page, and clean up its children. `pnpm verify:fresh` must copy only tracked/project source files to a disposable directory, perform a frozen install, run the decisive build/test checks, and clean up.

## Review cadence

1. Implement and test the working Phase 1 slice.
2. Parent independently verifies the real artifacts and acceptance commands.
3. One fresh bounded review/audit checks functional requirements, regressions, maintainability blockers, and broken package boundaries.
4. Fix confirmed defects once, rerun affected tests plus the main `pnpm check`, and stop.

No recursive broad review or security-hardening cycle is authorized.

## Prohibited side effects

- Do not inspect or modify the original `/home/user/AgentIntersect` repository.
- Do not create a remote, commit, push, tag, release, publish, or change visibility.
- Do not start Phase 2 or later feature implementation.
- Do not add public-internet, unrelated-user, cloud multi-tenant, or hosted-room infrastructure.
