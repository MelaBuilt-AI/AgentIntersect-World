# Session reset agent release

## Scope — October 6, 2026

Aaron requested a separate PR after TEST45492 reproduced a four-agent reset lockout. Reset must release the old World-owned sessions and roster, retain discovery registrations/user identity/avatars/native history, and allow another single-agent or multi-agent setup, including the same agent choices. Do not stop underlying harness services or operator-persistent sessions. Keep the existing review lane unchanged; manual acceptance and merge remain pending. No performance work, provider changes, releases, or scripted product-navigation journeys.

## Observed evidence

Read-only TEST45492 health/owner/served-build verification passed. After Aaron used Escape → Reset Session and reached agent selection, GET /api/constellation/current still returned lifecycle active, revision 8, four connected agents, entryReady true, and no terminal outcomes. The UI leaveWorld handler only resets local presentation and leaves the constellation state intact; the selector's rosterFull guard therefore disables all harness choices. Discovery recheck cannot release roster seats.

The existing end endpoint closes owned roster sessions but leaves a terminal constellation; no new-world rollover exists. The fix must perform both teardown and a fresh empty World generation, not only clear the local roster or call end.

## Prior performance verdict

Aaron reports four agents with Clone test loaded, all graphics settings enabled, sitting for at least an hour; GPU RAM did not exceed reported 5.9. Provisional sustained-memory stability PASS for that scenario, not a complete leak-elimination or FPS claim. Prior effects-on slowdown/city-view pause remain separate.

## Acceptance

- Reset a full roster, preserve operator-persistent identity, and start with zero occupied seats and a fresh World identity.
- Reuse the same discovered agents in a new multi-agent session or select a single agent.
- Repeated reset requests do not terminate a replacement session; failed teardown keeps the previous state retryable and does not pretend success.
- Clear stale UI selection, avatars, targeting, and movement state only after successful reset.
- Single World-owned attachments are released as well; discovery registrations and native history are not deleted.

## Verification

- Focused RED: reset endpoint returned 404 before implementation; the client had no reset method; the Escape-menu binding still selected presentation-only leave. An initial add-agent fixture expected 200 instead of the existing 201 contract and was corrected before counting the endpoint RED.
- Focused GREEN: 60 tests across seven lifecycle, client, component-callback, entry-state and multi-agent UI files passed.
- Full conventional `check:core` passed: formatting, lint, TypeScript, architecture, **1,620 tests / 286 files**, production build and disposable-port startup/API smoke. One initial formatting failure was corrected before the successful run. Existing Three CommonJS deprecation and bundle-size warnings remain non-fatal.
- Callback tests execute the actual component callback with closure ports; they establish await-before-leave, double-click coalescing, failure/retry identity and local cleanup. They are not React scheduling, native-harness or hands-on product acceptance.
- API tests use the real server/service and disposable durable storage with a lifecycle fixture. They prove fresh identity, full-roster reselection, idempotent replay, persistence and failed-end retry; they do not end Aaron's live agents.
- Exact-head CI and Aaron's hands-on acceptance remain pending. No scripted product-navigation journeys were run. TEST45492 was only read, not changed.

## Manual acceptance after authorized test-lane switch

1. Start four agents, load Clone test, use Escape → Reset Session, and confirm selection is usable after reset completes.
2. Choose the same four agent connections for a new multi-agent session and enter World.
3. Reset again, choose Single Agent, connect any discovered agent, and enter World.
4. Reset the single-agent session and choose a different single agent or another multi-agent group. Saved discovery registrations and user/avatar choices should remain available.
5. If a native agent cannot end, the UI must remain on the current World with a retry message rather than claiming successful reset.
