# AgentIntersect World terminal installer (Linux x64)

**Public preview:** npm installer `0.15.0-rc.2.1` installs World `0.15.0-rc.2`. This npm revision updates documentation only; the installer code, application archive and SHA-256 pin are unchanged.

[Downloads](https://agentintersect.com/download/) · [Release and checksums](https://github.com/MelaBuilt-AI/AgentIntersect-World/releases/tag/v0.15.0-rc.2) · [Field Guide](https://guide.agentintersect.com/getting-started/) · [Report an issue](https://github.com/MelaBuilt-AI/AgentIntersect-World/issues)

## Install

Requirements: **Linux x64 with glibc, Node.js 20 or newer, npm and `tar`**. The application bundles Node 24; Git and a separately configured agent harness are needed for full workflows. ARM and musl/Alpine are unsupported.

```sh
npx -y @agentintersect-world/installer@0.15.0-rc.2.1 install
```

Run the launcher path printed by the installer, normally:

```sh
~/.local/bin/agentintersect-world
```

For headless sessions, add `--no-open` and use the printed loopback URL. Close with `quit` + Enter or Ctrl+C. Do not expose the backend publicly.

For Windows, use the setup installer or portable ZIP on the downloads page instead. Windows builds are unsigned; follow your device's security policy.

## What it installs

The bootstrapper downloads the official Linux x64 archive, checks its embedded SHA-256 pin, and extracts application files to `${XDG_DATA_HOME:-~/.local/share}/agentintersect-world/versions/0.15.0-rc.2`. It creates `${XDG_BIN_HOME:-~/.local/bin}/agentintersect-world`; add that directory to your own `PATH` if desired.

It does not use `sudo`, change your global PATH, install a global runtime/package manager, check out source, configure provider accounts, or install a service. Model accounts and subscriptions are separate. Application state lives separately in `${XDG_STATE_HOME:-~/.local/state}/agentintersect-world`; removing program files does not delete that state.

## Existing installations

An existing World `0.15.0-rc.2` directory is not replaced. An “already installed” message is not an upgrade from older private candidate bytes bearing that same version. Preserve projects and state; use separate `XDG_DATA_HOME` and `XDG_BIN_HOME` roots for isolated installation tests.

This documentation-only npm revision does not upgrade the application. Use the explicit version above or the `rc` channel. This remains a prerelease, regardless of any registry `latest` tag.

## Verification and provenance

Application source: `c54b0b49b2c03d9d43c648db51e6b6002ea3ee9c`.

Pinned archive: `AgentIntersect-World-0.15.0-rc.2-linux-x64.tar.gz`.

SHA-256:

```text
75a25a55f2fac11910bba77085b67092fc7b40c407b57cd6755380fbf08eb224
```

The published application archive and original public-registry installation path were verified at launch. This revision retains the same executable installer and archive identity. See the release for checksums and provenance; never substitute a different archive under the same version.

From the source repository, maintainers can run the pinned-archive tests:

```sh
AIW_TEST_ARCHIVE=/absolute/path/AgentIntersect-World-0.15.0-rc.2-linux-x64.tar.gz node --test tooling/release/npm-installer/test/install.test.mjs
```

The test-only `--archive` path still enforces the checksum. Local tests do not substitute for public-registry installation verification. This npm package is a bootstrapper, not the application payload.

## License

MIT for the installer code. The application and bundled dependencies retain their respective license terms; see the release's third-party notices.
