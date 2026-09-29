# AgentIntersect World terminal installer (Linux x64)

**Release candidate preparation only:** This package and its referenced GitHub Release asset are not published yet. The following commands will work only after the matching release archive is approved, uploaded, and verified, and this npm package version is published.

```sh
npx @agentintersect-world/installer@0.15.0-rc.2 install
# or
pnpm dlx @agentintersect-world/installer@0.15.0-rc.2 install
```

The small npm package downloads the official, matching Linux x64 **glibc** portable archive, checks its built-in SHA-256 pin, and extracts it to `${XDG_DATA_HOME:-~/.local/share}/agentintersect-world/versions/0.15.0-rc.2`. It creates a launcher in `${XDG_BIN_HOME:-~/.local/bin}/agentintersect-world`; add that directory to `PATH` if needed. Then run `agentintersect-world`. No `sudo`, source checkout, global Node/pnpm install, provider login, service, or system configuration is performed by the installer. npm/pnpm and Node are only required for the bootstrap command; the app bundles its own runtime.

The package requires Linux x64 with glibc, plus `tar`. ARM and musl/Alpine are unsupported. The application needs Git and a separately configured agent harness for full workflows. The app stores state separately in `${XDG_STATE_HOME:-~/.local/state}/agentintersect-world`; removing installed program files does not delete user state. For headless sessions, run `agentintersect-world --no-open` and use the printed loopback URL. Close with `quit` + Enter or Ctrl+C.

Local candidate verification without publication:

```sh
AIW_TEST_ARCHIVE=/path/to/AgentIntersect-World-0.15.0-rc.2-linux-x64.tar.gz node --test tooling/release/npm-installer/test/install.test.mjs
```

The test uses `--archive` solely to supply the **same exact pinned archive** locally; it still checks the checksum. Before publication, confirm the hosted asset bytes equal the embedded digest and run a clean npm tarball install smoke. A changed archive needs a new package version/digest. The npm package is a bootstrapper, not the application payload.
