# Phase 0 sanitized RED/GREEN transcript

All commands used Node 24. Variable values, runtime paths, process identities, and generated IDs are omitted.

| Slice                   | RED observed                                                                                                                             | GREEN observed                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compatibility           | Commit drift returned compatible: `true !== false`.                                                                                      | Focused test passed.                                                                                                                              |
| Aggregate compatibility | MCP protocol drift returned compatible: `true !== false`.                                                                                | Protocol/tool/capability/route/hash/schema aggregate gate passed.                                                                                 |
| Health attestation      | Invalid workspace was accepted: `Missing expected rejection`.                                                                            | Correct, alias, mismatch, dead, reused, protected, fake, status, content-type, and exact-key cases passed.                                        |
| Checkout/catalog        | Unobserved Git/package fields produced eight compatibility mismatches.                                                                   | Pinned checkout, source hashes, 11 daemon routes, and 34 dashboard handler entries passed.                                                        |
| HTTP/SSE                | Scaffold readiness was false: `false !== true`.                                                                                          | Real daemon/dashboard readiness, route status, framing, reconnect, teardown, and disposal passed.                                                 |
| MCP                     | Initialize ID was absent: `null !== 41`.                                                                                                 | Three sequential live JSON-RPC interactions and clean exit passed.                                                                                |
| Lifecycle               | Create status was absent: `0 !== 201`.                                                                                                   | Worker identity, completion, duplicate reconciliation, failed result, handoff, evidence, and safe pause passed.                                   |
| Emergency stop          | Owned child baseline was false: `false !== true`.                                                                                        | One owned child handled; one unowned child remained alive; cleanup passed.                                                                        |
| Capture preflight       | All four captures reported `rejectedByPreflight: false`; CLI/module sentinels ran and all four mutable workspace prefixes were observed. | All four captures rejected through checkout preflight; no sentinel or mutable workspace entry was observed; the disposable clone was removed.     |
| Fixed temp root         | Poisoned temp variables produced an `aiw-mcp-*` workspace entry inside the disposable protected checkout.                                | Capture workspace was observed only below canonical `/tmp`; protected entries, status, HEAD, and diff stayed unchanged; environment was restored. |
| Sanitization            | Raw values differed from placeholders.                                                                                                   | Deterministic path, process, and credential redaction passed.                                                                                     |
| Committed evidence      | No evidence files were discovered.                                                                                                       | Fixture, report, and transcript scan passed.                                                                                                      |

Corrections discovered before final GREEN:

- The first disposable-clone setup attempt failed with `Invalid cross-device link`; it was not counted as blocker RED evidence. Adding `--no-hardlinks` produced the real RED results above and deterministic cleanup.
- Node strip-only syntax was corrected before counting the health RED result.
- Workspace identity is a SHA-256 identity derived from normalized canonical realpath, not a raw path.
- Healthy dashboard event feeds omit the optional warning field.
- Current dashboard SSE has no IDs and does not honor replay cursors; reconnect uses fresh-feed reconciliation.
- Worker completion leaves safe pause requested; the explicit phase-boundary action records paused-safe.
