# Phase 0 independent High-risk review

Date: 2026-07-19
Reviewer: fresh read-only Codex `gpt-5.6-sol` / high
Scope: staged Phase 0 diff against design baseline `2f4af7b84bda8c6fdf7f756abb8f6ac55faaa185`

## Initial verdict

**BLOCKED**

The unchanged-AgentIntersect proof was substantiated, but two High-risk blockers prevented signing the fixture set:

1. **Compatibility preflight occurred too late.** Public capture functions could create disposable state, execute a drifted checkout CLI, or import a drifted private module before another test eventually reported compatibility failure. Required correction: a non-cyclic pinned-checkout preflight at the start of every capture, plus sentinel regressions proving no checkout code or workspace side effect occurs after drift.
2. **The temporary root trusted environment variables.** `os.tmpdir()` could resolve to a protected checkout when `TMPDIR` was poisoned. Required correction: canonical fixed `/tmp`, bidirectional overlap rejection, a fixed child temp environment, and regression evidence that a protected checkout remains unchanged.

## Evidence inspected

- Complete staged Phase 0 delta
- AgentIntersect worker, MCP, SSE, owned-process, and Emergency Stop source
- Six pinned source hashes
- AgentIntersect HEAD, origin/main, branch, and clean status
- Staged diff check and sensitive-marker scan
- Direct proof that `TMPDIR` controls `os.tmpdir()`

## Non-blocking backlog retained

- Clear successful MCP response timeout handles.
- Assemble SSE frames through the complete frame terminator under a timeout.
- Broaden generic evidence scanning for standalone usernames and additional credential formats.

## Gate status at this review

**NOT SIGNED** pending correction and targeted re-review of the two frozen blockers.
