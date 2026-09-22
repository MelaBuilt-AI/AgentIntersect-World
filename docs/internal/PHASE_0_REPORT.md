# Phase 0 — Contract and protocol proof

Status: **COMPLETE** — implementation proof GREEN; independent High-risk exit gate SIGNED.

## Baseline and compatibility matrix

The World repository began clean at `2f4af7b84bda8c6fdf7f756abb8f6ac55faaa185`. The unchanged private dependency began clean on `main`; local HEAD and `origin/main` were both `14c620271cd02e455d3244241de951e00ef77a4d`. Node 24 reported `v24.18.0`.

| Contract           | Frozen value                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Package            | private ESM `@contextloop/manager@0.1.0`                                                                                   |
| Runtime            | Node `>=24`; tested major exactly 24                                                                                       |
| Dependency commit  | `14c620271cd02e455d3244241de951e00ef77a4d`, clean `main`, matching `origin/main`                                           |
| Daemon             | loopback default `3761`; 256 KiB request ceiling; 11 catalog entries                                                       |
| Dashboard          | loopback-only default `3762`; 34 handler entries including current dynamic candidates                                      |
| Health             | service `agentintersect-daemon/v1`; protocol `1`; six exact fields; process/start and SHA-256 canonical-workspace identity |
| MCP                | protocol `2024-11-05`; server `agentintersect-clm@0.1.0`; tools capability only; exactly five frozen tools; no resources   |
| Source attestation | SHA-256 hashes for six consequential source files in versioned compatibility metadata                                      |

Compatibility fails closed on any commit, origin, branch, cleanliness, package, runtime, health, route/source hash, MCP protocol/tool/capability, process identity, or workspace identity mismatch.

## Targeted correction round 1

Two confirmed blockers were corrected without broadening Phase 0:

- Every public capture now begins with a non-cyclic, read-only checkout preflight that validates the exact Git, package, Node runtime, and six-file source-hash contract before workspace creation, private-module import, or checkout-code execution. The aggregate validator uses the same compatibility values and preserves its source-grounded mismatch labels.
- Capture and attestation workspaces now use an attested fixed Linux root, canonical `/tmp`, independent of `TMPDIR`, `TMP`, and `TEMP`. The root and checkout are canonicalized and rejected if either contains the other; child processes receive all three temp variables fixed to the attested root.

The focused drift regression clones without hard links, injects CLI/module sentinels, calls all four public captures, and always removes the disposable clone. The temp-root regression poisons all three environment variables with a disposable protected Git checkout and restores them in `finally` cleanup.

## Independent review and targeted re-review

The fresh read-only High-risk review initially blocked the fixture set on the two issues corrected above. After independent parent verification, a targeted read-only re-review inspected only those frozen blockers and found both fixed with no newly introduced critical blocker.

- Initial review: `evidence/phase0-independent-review.md`
- Targeted re-review: `evidence/phase0-targeted-rereview.md`
- Final verdict: **APPROVED**
- Phase 0 High-risk exit gate: **SIGNED**

## Evidence and exact commands

Focused and complete Phase 0 test commands under Node 24:

```text
npx --yes node@24 --test packages/agentintersect-client/test/preflight-temp-root.test.mts
npm run test:phase0
```

Additional verification commands:

```text
npx --yes node@24 ./node_modules/typescript/bin/tsc --noEmit
npx --yes node@24 ./node_modules/prettier/bin/prettier.cjs --check .
npx --yes node@24 /usr/lib/node_modules/npm/bin/npm-cli.js audit --audit-level=high
npx --yes node@24 scripts/capture-phase0.mts --agentintersect-checkout <AGENTINTERSECT_CHECKOUT>
git diff --cached --check
git diff --check
```

Final results:

- Focused blocker regressions: 2 tests, 2 passed, 0 failed; `duration_ms 5975.93234`.
- Full suite: 12 tests, 12 passed, 0 failed; `duration_ms 6010.855602`.
- Typecheck: exit 0.
- Format check: exit 0, all matched files formatted.
- Dependency audit: exit 0, 0 vulnerabilities.
- Aggregate capture/compatibility gate: exit 0; all four live sections (`httpSse`, `mcp`, `lifecycle`, and `emergencyStop`) exactly matched the committed fixture.
- Exact AgentIntersect proof after verification: clean `main`; HEAD and `origin/main` both `14c620271cd02e455d3244241de951e00ef77a4d`; empty diff; no leftover CLI service, harmless test child, capture workspace, or disposable clone.

Focused real observations are frozen in `packages/agentintersect-client/fixtures/v1/phase0-contract.json`; the compact actual TDD history is in `evidence/phase0-red-green.md`.

The harness accepts a checkout path, validates it read-only before any capture side effect, creates fresh workspaces only below canonical `/tmp`, launches only loopback services on ephemeral ports with a fixed safe temp environment, and removes every workspace. The emergency proof registers and signals only its own harmless child, proves its separately spawned unowned child stays alive, then deterministically cleans up both test children.

## Supported and unsupported claims

Supported only on WSL/Linux with Node 24 and the exact unchanged private checkout/commit above:

- exact daemon health, route, worker create/claim/result, wrong-owner conflict, clean-duplicate conflict plus state reconciliation, failed result, and durable-event behavior;
- dashboard snapshot/event shapes, SSE framing, fresh-feed reconnect candidate, safe pause requested versus explicit reached state, and emergency response;
- live-process MCP initialization, exact five tools, request-ID preservation, and absence of resource capability;
- validated SHA-256 handoff and managed evidence mapping candidates.

Unsupported:

- a public AgentIntersect SDK/API commitment, MCP resources, remote/LAN trust, cross-platform process identity outside Linux, cursor replay guarantees, blind mutation retries, or World ownership of lifecycle/process/handoff/evidence/audit authority.

Direct import of owned-process registration is labeled a **current private implementation candidate**. It is used only to register the exact harmless child that the emergency test owns; the emergency action itself is observed through the real dashboard HTTP boundary.

## Sanitized fixture policy

Committed evidence retains booleans, statuses, schema keys, route names, counts, stable protocol/package values, relative managed evidence paths, and source hashes. It removes or omits credentials, authorization-header values, usernames, home paths, temporary paths, process paths, live process identifiers, timestamps, generated IDs, and raw bodies that can carry secrets. A suite test scans every committed fixture, report, and transcript and fails on these markers.

## Residual risks and exit gate

- Dashboard SSE currently has no `id` frames and ignores `Last-Event-ID`; World must reconcile snapshots/events after reconnect and must not claim cursor replay.
- Safe pause reaches `paused_safe` only at the explicit phase boundary; worker completion alone leaves the request state visible.
- Owned-process registration remains a pinned private implementation candidate rather than a stable external API.
- Process-start attestation depends on Linux process metadata.
- Non-blocking backlog: clear successful MCP response timeout handles, assemble SSE through complete frame terminators under timeout, and broaden generic evidence-pattern coverage. These do not violate the frozen Phase 0 acceptance criteria.

All Phase 0 acceptance evidence is present. The fresh independent High-risk review and bounded targeted re-review approved the fixture set and unchanged-dependency proof. No Phase 1 work, push, release, publish, or remote change is included.

Acceptance evidence items 1–10 are GREEN. **Phase 0 is complete and its High-risk exit gate is signed.** Phase 1 remains a separate user approval gate.
