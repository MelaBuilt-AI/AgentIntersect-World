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

The test uses `--archive` solely to supply the **same exact pinned archive** locally; it still checks the checksum. This unpublished candidate pairs with the clean application source `7b97db1fb2c4490cabc0d606a0cf55585390c4bb` archive, SHA-256 `aab167c13ab20ca98dd721b56a8f5d34f394913969512f1fcbca84bff7b3b9d7`. Application and bootstrap source commits are recorded separately in the private kit. Do not mix older rc.2 archive or npm tarball bytes with this pair.

For private transfer, use the exact local npm tarball and app archive from the same checksum-verified kit:

```sh
npx --yes --package=/absolute/path/agentintersect-world-installer-0.15.0-rc.2.tgz agentintersect-world-install install --archive /absolute/path/AgentIntersect-World-0.15.0-rc.2-linux-x64.tar.gz
# or
pnpm dlx /absolute/path/agentintersect-world-installer-0.15.0-rc.2.tgz install --archive /absolute/path/AgentIntersect-World-0.15.0-rc.2-linux-x64.tar.gz
```

This installer does not replace an already-installed `0.15.0-rc.2` directory. Test in a fresh home or separate `XDG_DATA_HOME` and `XDG_BIN_HOME`; an "already installed" message is not an upgrade to new candidate bytes. Keep application state separate and preserve existing projects/state. A repeat-install test only proves idempotence for the same installed candidate.

Before publication, confirm the hosted asset bytes equal the embedded digest and run a clean public-registry install smoke. After publication, a changed archive requires a new immutable package version/digest; this candidate remains unpublished. Local tarball tests do not prove the registry or hosted-download path. The npm package is a bootstrapper, not the application payload.
