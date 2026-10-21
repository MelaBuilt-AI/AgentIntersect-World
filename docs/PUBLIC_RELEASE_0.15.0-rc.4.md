# AgentIntersect World 0.15.0-rc.4 — Public preview

**RC4 is the current recommended public preview**, not a stable/1.0 release. It is marked Latest on GitHub so the repository's Releases sidebar points to the current download. Windows installers remain unsigned.

## Fixes verified in owner testing

- **Hermes prerequisites:** recognize API settings split between `.env` credentials and top-level YAML flags/host. Avoid falsely reporting failure after successful native configuration and unnecessarily offering another key replacement.
- **OpenClaw replies:** recover an empty completed event's exact-run committed internal reply, linked to its final message-tool call and successful delivery receipt. No automatic replay, unrelated-history recovery or external-channel substitution.
- Bundled Hermes integration and the installed update command are included.

The owner confirmed both harnesses work, including coding runs. This is hands-on evidence on the tested installations, not a guarantee of every fresh profile or device.

## Install and update

Use the Windows x64 setup executable, Linux x64/glibc Debian package, or platform portable archive below. Close World before upgrading, keep the same destination and preserve your existing XDG overrides and saved data. Compare downloads against `SHA256SUMS`.

Linux terminal bootstrap (requires Node 20+ and tar; World bundles Node 24):

```sh
npx -y @agentintersect-world/installer@0.15.0-rc.4 install
~/.local/bin/agentintersect-world --version
```

The npm command requires registry publication; if it is not available yet, use the directly attached application archives/installers. Existing updater-equipped installations can run, with World closed:

```sh
agentintersect-world update --check
agentintersect-world update
```

Older installations without `update` need one bootstrap/installer upgrade first. Updates preserve saved state; a merged commit alone is not an installed update.

## Connect your agents

In **Agent Setup**, use **Discover Agents**, select the intended installation and native identity, then **Preview prerequisites** before attaching. Review the exact target and each proposed change; check the approval box and use **Apply approved change** for that specific action. Preview again after changes to obtain the next action.

For Hermes this can install/enable the bundled World plugin and configure an authenticated loopback API. API setup can replace the key used by other clients; do not repeatedly approve it after an error. World never silently restarts your live gateway. Finish active work, identify the exact profile/service, and restart that service separately if new settings/plugin need loading. Do not restart unrelated profiles. Then recheck/attach, test an ordinary greeting and a harmless tool-backed request. Keep credentials in native storage, not browser forms or pasted diagnostics.

## Exact accepted artifacts

- Application payload: `3a022b0b9e2e0727dfe61dec08998d0235d11025`
- Bootstrap: `72965424f73063c2b49cd5bfac3231c0fbc60018`
- Release tag / PR #49 merge: `f5f5d58bc9e541d5650f3ee96f5815ecd3a0b08d`
- Installer workflow: `39605274591` — Linux archive/Debian checks and native Windows install/API/WebSocket/uninstall passed.

Full local code verification passed, including 1,653 tests; final-head and merged-main CI passed. Real-archive bootstrap and installed update/state/rollback/UI/API/shutdown tests passed. The accepted payloads and bootstrap are unchanged—this is publication, not a rebuild.

Bundled dependencies retain their licenses. The unchanged Git for Windows 2.56.0.windows.2 corresponding-source companion remains available in the rc.2 release: https://github.com/MelaBuilt-AI/AgentIntersect-World/releases/download/v0.15.0-rc.2/Git-for-Windows-2.56.0.windows.2-corresponding-sources.zip . See the repository's third-party notices and Git source documentation.
