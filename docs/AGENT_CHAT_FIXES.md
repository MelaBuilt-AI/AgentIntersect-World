# First-run agent chat fixes

## Scope

Owner authorized diagnosis, implementation, commit/push, exact-head green CI and merge, plus delivery through installers on October 21, 2026.

- Hermes: ship the World plugin with the application; offer explicit profile-scoped installation/enablement and authenticated loopback API setup from prerequisite preview. Never silently restart the gateway or change providers. Never return credentials to the browser. Preserve existing plugin installations and native configuration backups.
- OpenClaw: state the World reply destination on every turn without disabling legitimate tools; handle an empty completed turn truthfully without fabricating an assistant answer or replaying potentially consequential work.
- Updates: inspect and repair the npm install upgrade path, preserving saved state and unrelated commands. Versioned release artifacts remain necessary; merged commits are not automatic releases. Keep published rc.2 bytes immutable.
- No unrelated Safari investigation, global configuration edits, operator-state deletion, or automated browser navigation journeys.

## rc.4 authorized delivery scope

The owner authorized completion, commit/push, exact-head green GitHub CI, merge and new RC installers for hands-on testing. Prepare additive `0.15.0-rc.4` application artifacts and a bootstrap pinned to their verified archive. Keep existing rc.3 bytes immutable. Draft staging is for owner testing only; npm publication/dist-tag changes, release promotion and website download changes remain blocked pending acceptance.

PCDGAI-DEV Hermes is now owner-accepted after the explicit default user-service restart: attachment, chat and a coding run succeeded. This establishes working native configuration, not a corrected fresh-installer flow. The split-layout regression and new candidate are still needed. OpenClaw's new correction still needs the original ordinary greeting and tool-backed reply acceptance on 30B.

## rc.3 acceptance failures — promotion blocked

Owner testing is required before publication. rc.3 failed real-machine acceptance; merged/CI-green packaging does not override that result. Do not promote the draft, npm tags, or live download links, and do not overwrite the existing candidate bytes.

- OpenClaw on 30B: the exact failed native run recorded a successful internal webchat/current-run message-tool reply and a committed delivery-mirror assistant row, while World's final event was empty. The local follow-up recovers only an exact-run final internal reply linked to its successful receipt, without replay. The focused regression failed before the fix; 35 adapter tests, affected lint and backend TypeScript passed. This correction is not in the rc.3 payload.
- Hermes on PCDGAI-DEV: the owner confirmed plugin enablement, a changed 64-character key in `.env`, and `API_SERVER_ENABLED: true` / `API_SERVER_HOST: 127.0.0.1` in top-level `config.yaml`. rc.3 wrongly required those non-secret settings in `.env`, so it rejected successful native writes and continued offering key replacement. The local correction recognizes the split layout with `.env` precedence for these settings and verifies it after the native CLI writes. A fixture matching the observed storage layout reproduced the exact `API setup did not verify` error before the fix; eight tests across first-run, prerequisites, setup API and Hermes recheck then passed, along with affected lint and backend TypeScript. This is fixture verification, not remote gateway loading or chat acceptance.
- Neither follow-up is packaged or installed on the owner's machines yet. The default gateway on PCDGAI-DEV had not restarted since October 2; no gateway/profile changes were made by this diagnosis. The separate `trace` profile remains out of scope.

## Earlier reported evidence (superseded where noted above)

Trader's Linux/npm install attached Hermes and returned a real World reply after installing/enabling the missing plugin, replacing a rejected API key and restarting the identity-checked gateway. This is owner evidence on a remote machine, not a local test.

30B's OpenClaw 2026.9.7 attached, but a greeting returned HTTP 200 with an empty assistant-final and completed terminal. Nearby native logs recorded a message-tool-only outcome. An explicit direct-reply/no-tools instruction returned `Hello from Mitts.` in World; the owner saw no earlier Discord delivery. Exact tool arguments/results are unavailable. Do not claim a proven Discord misdelivery or that the unrelated ACP authentication warnings caused this turn.

## rc.4 local verification

The complete core gate passed: formatting, lint, TypeScript, architecture (11 tests), 1,653 tests across 297 files, production build and disposable startup/API smoke. The optional voice provider was isolated through an empty `AIW_LOCAL_VOICE_DIR`, without changing native profiles. Release-builder tests passed 5/5; launcher/updater/bootstrap/Windows-Git tests passed 11 with one optional real-archive test deferred until the rc.4 CI archive exists. Exact-head GitHub checks, packaged install verification and new-candidate owner acceptance remain separate gates.

## rc.3 packaging verification (historical)

Focused updater/npm tests pass (7 passed, 1 optional archive test skipped); five release-builder tests pass. Formatting, lint, TypeScript, architecture, production build and disposable startup/API smoke pass. The full suite returned 1,645 passes and one environment-sensitive voice failure because this operator host has the optional voice provider installed; rerunning that nine-test file with an empty disposable voice-provider directory passed without changing production code or operator files.

The updater adds `update [--check] [--yes]`, checksum-verified release selection, portable Linux rollback retention, Debian package-manager delivery, Windows installer handoff/Start-menu shortcut, and running-instance markers outside read-only program directories. rc.3 is a new candidate; published rc.2 assets remain untouched.

Application payload source `39ce7448ca5fca7c84c5cbb4009bd283c5bee8cc` passed both normal code CI runs and installer workflow `39550524836`, including real Linux archive, Debian install/remove and native Windows install/API/WebSocket/uninstall checks. Its Linux archive was applied over an explicit minimal old-install fixture; retained backup/state, bundled-runtime version/help, bundled Hermes plugin and real UI/API smoke passed. The npm bootstrap now pins that exact archive; its three tests, including the real archive install/repeat/launcher smoke, passed. Later bootstrap/documentation commits do not rebuild those payload bytes.

Pending: final bootstrap-head CI, owner acceptance of changed live integrations, and public release/registry readback. Unit protocol fixtures establish adapter behavior, not model compliance on the remote hosts.
