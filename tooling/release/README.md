# AgentIntersect World — installer candidate

This is an **unreleased candidate** of the local-first browser-based application. The bundled Node.js runtime means you do not need to install Node, pnpm, or clone the source. Git and at least one separately installed/configured agent harness are needed for full coding workflows. No provider login, model, optional voice engine, firewall rule or system service is installed automatically.

## Linux x64 (glibc)

- Debian/Ubuntu: `sudo apt install ./AgentIntersect-World-0.15.0-rc.2-linux-x64.deb`, then launch `agentintersect-world` from a terminal or the application menu. Remove program files with `sudo apt remove agentintersect-world`.
- Other glibc distributions: extract `AgentIntersect-World-0.15.0-rc.2-linux-x64.tar.gz`, enter its folder and run `./agentintersect-world`. Remove the extracted folder to uninstall.

Linux packages are not for musl/Alpine or ARM. For headless/remote sessions use `--no-open` and open the printed `127.0.0.1` URL locally on the same machine. Close with `quit` + Enter or Ctrl+C.

## Windows x64

Run `AgentIntersect-World-0.15.0-rc.2-windows-x64-setup.exe`. This is a per-user installer: a Start Menu shortcut and registered uninstaller are created. The installer is **unsigned**, so Windows SmartScreen or antivirus may warn. Verify its published SHA-256 checksum and source before running; do not assume a warning means the file was signed or vetted. No administrator access or PATH change is requested. Close the console with `quit` + Enter or Ctrl+C.

## State and integrations

Application state is separate from program files: `%LOCALAPPDATA%\AgentIntersect-World` on Windows or `${XDG_STATE_HOME:-~/.local/state}/agentintersect-world` on Linux. Uninstalling or deleting program files does **not** erase your projects, saved state, or native harness profiles. Optional cleanup of this application state should be your explicit choice after backing it up. World listens only on loopback by default; the browser and agent services you choose may have separate networking/authentication and costs.

Software is MIT licensed; third-party and supplied media terms are separate. See `LICENSE`, `THIRD_PARTY_NOTICES.md`, `DEPENDENCIES.json` and `runtime/LICENSE` in the package. `BUILD.json` records the source commit and runtime pin. This candidate is not yet a public product release or full human install acceptance.
