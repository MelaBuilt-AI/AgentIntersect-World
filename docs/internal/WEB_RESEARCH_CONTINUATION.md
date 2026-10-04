# World web research — separate post-PR32 slice

## Scope and authorization

Aaron requested a separate web/search/fetch PR after accepting relay within the explicit `@name` → `@name` contract. PR32 is merged at `10f4d0b`; both its exact-head PR gate and merged-main CI passed. This slice starts from that main, not the retained review worktree.

Acceptance target: normal direct, relayed and coding turns can use native web search and page retrieval without requiring a repository first. Resume must retain research availability. Verify actual provider results separately from tool permissions. Preserve selected native model/profile/auth and all existing editing, ownership, recovery and relay boundaries.

Implementation starts with the confirmed Claude permission omission and Codex's unspecified web-search mode. Hermes and OpenClaw forward to their selected native runtimes; inspect and test their forwarding paths without silently changing external profiles or installing search providers.

Non-goals: blanket permission bypass, unrestricted shell networking, new search-provider subscriptions, native profile edits, a permissions dashboard, automated product-navigation journeys, merge or release. Missing native provider support is an explicit blocker, not a fabricated success or permission-bypass fallback.

## Preservation

TEST45485 and its populated conversations remain untouched. Do not rebuild its shared output, relaunch, refresh, replay or stop it. Work occurs in a separate worktree. Existing protected services, projects and provider configuration remain unchanged.

## Verification plan

1. Focused adapter RED→GREEN for normal/resumed research and unchanged recovery restrictions.
2. Existing adapter and gateway/service tests; conventional code gate and static inputs.
3. Bounded real search and public-page retrieval through the actual production adapters in disposable World-owned sessions. Retain normalized evidence and close only owned sessions.
4. Separate draft PR and exact-head CI; human browser acceptance and merge remain pending.

## Implemented and verified

- Claude normal discussion/coding invocations expose and preapprove `WebSearch`/`WebFetch`; native-profile discussion keeps its other tool definitions. Updated read-only guidance allows research without granting edits. `dontAsk`, explicit native deny precedence and tool-free recovery remain intact. Corrected stale capability copy that claimed all tools were disabled.
- Codex normal/resumed invocations set `web_search="live"`; `workspace-write`, native profile/model selection and shell networking policy are unchanged.
- Focused regressions were observed RED before the Claude permissions/guidance and Codex mode changes, then GREEN. Hermes/OpenClaw conformance tests establish unchanged forwarding without tool-policy overrides (these are existing-behavior checks, not claimed bug REDs).
- Pinned Node24.18.0 conventional local gate PASS: 1,595 tests/277 files plus 11 architecture checks, format/lint/types/build/startup/API smoke; imported-avatar current inputs and compatibility PASS. No automated product-navigation journeys.

## Native proof and limits

- **Claude:** native `WebSearch` and `WebFetch` completed in direct and coding-context turns, preserving the same session. Search: IANA example domains; page: `https://example.com/`, heading `Example Domain`.
- **Codex:** native search and page-open completed in direct and coding-context turns, preserving the same session. Native transcript independently shows `tools.web__run` search and open calls; normalized tool events and returned page heading agree.
- **Relay:** real Constellation service, Claude→Codex and Codex→Claude, both completed in exactly two hops with native research tools. The scratch verifier initially read `toolName` from the event envelope instead of `payload`; corrected offline reconciliation of the retained gateway events passed without another model run. This was a harness assertion failure, not a failed web request. Sessions are closed; no shell/edit tools appeared.
- **OpenClaw:** native `web_fetch` completed in direct/collaborate contexts, but `web_search` is absent from the selected native tool set. Its installed coding profile includes the web group; a native search provider/configuration prerequisite remains unresolved. No claim that World enables search in this runtime. The first scratch invocation used a WebSocket URL where the adapter requires HTTP; corrected before any session creation. Exact disposable session ended and config hash/gateway PID remained unchanged.
- **Hermes:** adapter forwarding tests PASS. A fresh World-to-Hermes live research probe was not performed; do not promote this to all-four live acceptance. Native tool/provider availability remains the connected runtime's responsibility.
- Claude/Codex settings hashes unchanged; only disposable proof sessions were used. Evidence stays outside the repository under `aiw-web-research-20261004` (direct, relay, OpenClaw and conventional-gate records), avoiding secrets and recursive commit receipts.

## Remaining gates

1. Open the separate draft PR and verify its exact-head CI; no merge authorization.
2. Resolve OpenClaw's native search-provider prerequisite with explicit approval before changing external settings. Verify Hermes research through World before any all-four completion claim.
3. Aaron's hands-on acceptance of a coordinated updated review runtime remains pending. TEST45485 still serves the previous accepted build and is deliberately untouched; it does not contain this change.
