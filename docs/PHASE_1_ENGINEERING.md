# Phase 1 engineering foundation

## Node 24 command wrapper

The ambient development shell may provide an older Node release. Run acceptance commands through this reproducible wrapper so both pnpm and every package script inherit Node 24:

```sh
npx --yes --package=node@24 --call 'node --version && corepack pnpm@11.15.0 <command>'
```

For example, replace `<command>` with `install --frozen-lockfile`, `dev`, or `check`. The repository keeps the `engines.node >=24` contract; it does not silently fall back to the ambient runtime.

## Reference environment

Phase 1 defines a measurement class without making performance claims:

- 8 or more logical CPU cores;
- 16 GiB or more RAM;
- SSD-backed local workspace;
- 64-bit Linux, macOS, or Windows/WSL environment;
- Node 24 and pnpm 11.15.0.

Any later benchmark must record the concrete CPU, memory, storage, operating system, Node version, cold/warm state, command, and fixture profile. The design targets use the committed `examples/large-repo-fixture/fixture-size.json` profile; Phase 1 does not generate that 100,000-file tree.

## Development endpoints

- Vite web application: `http://127.0.0.1:5173`
- Fastify local server: `http://127.0.0.1:3770`
- Health contract: `GET /health`

The web application requests `/api/health`; Vite proxies that local path to the configured Fastify server. Set `AIW_LOCAL_SERVER_URL` only when a trusted local/LAN development setup needs a different target.

## RED evidence

On 2026-07-19, the first focused `pnpm test` run under Node 24 failed with four suites and zero collected tests because the new `world-schema`, `health-client`, UI component, and architecture checker implementations did not yet exist. This was the intentional RED checkpoint before the Phase 1 vertical slice implementation.
