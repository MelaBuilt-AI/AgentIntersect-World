# First-run agent chat fixes

## Scope

Owner authorized diagnosis, implementation, commit/push, exact-head green CI and merge, plus delivery through installers on October 21, 2026.

- Hermes: ship the World plugin with the application; offer explicit profile-scoped installation/enablement and authenticated loopback API setup from prerequisite preview. Never silently restart the gateway or change providers. Never return credentials to the browser. Preserve existing plugin installations and native configuration backups.
- OpenClaw: state the World reply destination on every turn without disabling legitimate tools; handle an empty completed turn truthfully without fabricating an assistant answer or replaying potentially consequential work.
- Updates: inspect and repair the npm install upgrade path, preserving saved state and unrelated commands. Versioned release artifacts remain necessary; merged commits are not automatic releases. Keep published rc.2 bytes immutable.
- No unrelated Safari investigation, global configuration edits, operator-state deletion, or automated browser navigation journeys.

## Reported evidence

Trader's Linux/npm install attached Hermes and returned a real World reply after installing/enabling the missing plugin, replacing a rejected API key and restarting the identity-checked gateway. This is owner evidence on a remote machine, not a local test.

30B's OpenClaw 2026.9.7 attached, but a greeting returned HTTP 200 with an empty assistant-final and completed terminal. Nearby native logs recorded a message-tool-only outcome. An explicit direct-reply/no-tools instruction returned `Hello from Mitts.` in World; the owner saw no earlier Discord delivery. Exact tool arguments/results are unavailable. Do not claim a proven Discord misdelivery or that the unrelated ACP authentication warnings caused this turn.

## Verification

Focused updater/npm tests pass (7 passed, 1 optional archive test skipped); five release-builder tests pass. Formatting, lint, TypeScript, architecture, production build and disposable startup/API smoke pass. The full suite returned 1,645 passes and one environment-sensitive voice failure because this operator host has the optional voice provider installed; rerunning that nine-test file with an empty disposable voice-provider directory passed without changing production code or operator files.

The updater adds `update [--check] [--yes]`, checksum-verified release selection, portable Linux rollback retention, Debian package-manager delivery, Windows installer handoff/Start-menu shortcut, and running-instance markers outside read-only program directories. rc.3 is a new candidate; published rc.2 assets remain untouched. The npm bootstrap's new artifact pin must be set only after the candidate archive exists.

Pending: exact-head CI, packaged install/update proof, owner acceptance of changed live integrations, and release readback. Unit protocol fixtures establish adapter behavior, not model compliance on the remote hosts.
