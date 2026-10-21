# AgentIntersect World terminal installer (Linux x64)

This bootstrapper installs World **0.15.0-rc.4**, including first-run agent fixes and the installed update command. It remains a prerelease.

## Install or upgrade an older installation

Requirements: **Linux x64 with glibc, Node.js 20 or newer, npm and `tar`**. World bundles Node 24; Git and a separately configured agent harness are needed for full workflows. ARM and musl/Alpine are unsupported.

After this version is published:

```sh
npx -y @agentintersect-world/installer@0.15.0-rc.4 install
~/.local/bin/agentintersect-world
```

The installer can replace its own verified older launcher, retaining the older program directory and saved state. It refuses unrelated commands. An existing same-version installation is reused, not overwritten; this is not a repair command.

For headless sessions, add `--no-open` and use the printed loopback URL. Close with `quit` + Enter or Ctrl+C. Do not expose the backend publicly. Windows users should use the Windows setup installer instead; it remains unsigned.

## Future updates

Close World, then use:

```sh
~/.local/bin/agentintersect-world update --check
~/.local/bin/agentintersect-world update
```

The command checks published releases, verifies the download and asks before applying it. Portable/npm installations retain a previous program directory for rollback. Saved application state and native harness profiles remain separate and are preserved. A merged PR alone is not an update; maintainers must publish new versioned packages. Older versions need the one-time bootstrap upgrade above to gain this command.

## Installation locations

Program files initially go to `${XDG_DATA_HOME:-~/.local/share}/agentintersect-world/versions/0.15.0-rc.4`; the launcher goes to `${XDG_BIN_HOME:-~/.local/bin}/agentintersect-world`. The built-in updater replaces the program files at that same path, so after an update the directory name can differ from `--version`. Application state lives in `${XDG_STATE_HOME:-~/.local/state}/agentintersect-world`.

The bootstrapper does not use `sudo`, change global PATH, install a global runtime/package manager, check out source, configure providers, or install a service. Add the launcher directory to your own PATH if desired. Use separate XDG roots for isolated installation tests.

## Verification and provenance

Application source: `3a022b0b9e2e0727dfe61dec08998d0235d11025`.

Pinned archive: `AgentIntersect-World-0.15.0-rc.4-linux-x64.tar.gz`.

SHA-256:

```text
222bac4c594853d153b42ee4c26a41a56c54f61cdb94173e4be8a39ddf7afdf9
```

The application artifact passed Linux archive/Debian and Windows native installer CI. A local update smoke applied the exact Linux artifact over an explicit minimal old-install fixture, verified retained state/backup and exercised the resulting real UI/API. This is distinct from remote-host model acceptance and public-registry delivery.

Maintainers can exercise the exact pinned archive:

```sh
AIW_TEST_ARCHIVE=/absolute/path/AgentIntersect-World-0.15.0-rc.4-linux-x64.tar.gz node --test tooling/release/npm-installer/test/install.test.mjs
```

The test-only `--archive` path still enforces the checksum. This npm package is a bootstrapper, not the application payload. Never replace published archive bytes under the same version.

## License

MIT for the installer code. Application dependencies retain their respective license terms; see the release's third-party notices.
