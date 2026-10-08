# AgentIntersect World — installer candidate

This is an **unreleased candidate** of the local-first browser-based application. The bundled Node.js runtime means you do not need to install Node, pnpm, or clone the source. Windows includes a private Portable Git (Git Bash included); Linux still needs Git. At least one separately installed/configured agent harness is needed for full coding workflows. No provider login, model, optional voice engine, firewall rule or system service is installed automatically.

## Linux x64 (glibc)

- **Terminal one-liner (after separate npm and release approval):** `npx @agentintersect-world/installer@0.15.0-rc.2 install` or `pnpm dlx @agentintersect-world/installer@0.15.0-rc.2 install`. This small bootstrapper downloads the exact portable archive, verifies its pinned SHA-256, and creates a per-user `~/.local/bin/agentintersect-world` launcher. See `tooling/release/npm-installer/README.md`. **Not usable yet:** neither the npm package nor hosted app artifact is published.
- Debian/Ubuntu: `sudo apt install ./AgentIntersect-World-0.15.0-rc.2-linux-x64.deb`, then launch `agentintersect-world` from a terminal or the application menu. Remove program files with `sudo apt remove agentintersect-world`.
- Other glibc distributions: extract `AgentIntersect-World-0.15.0-rc.2-linux-x64.tar.gz`, enter its folder and run `./agentintersect-world`. Remove the extracted folder to uninstall.

Linux packages are not for musl/Alpine or ARM. For headless/remote sessions use `--no-open` and open the printed `127.0.0.1` URL locally on the same machine. Close with `quit` + Enter or Ctrl+C.

## Windows x64

Run `AgentIntersect-World-0.15.0-rc.2-windows.3-windows-x64-setup.exe`. Close World’s console before installing over the earlier copy; keep the same destination. The installer keeps its original AppId and state location. It bundles private Git for World and child processes without changing Windows PATH or your Git identity/configuration. First launch initializes this private Git tree. This is a per-user installer: a Start Menu shortcut and registered uninstaller are created. The installer is **unsigned**, so Windows SmartScreen or antivirus may warn. Verify its published SHA-256 checksum and source before running; do not assume a warning means the file was signed or vetted. No administrator access or PATH change is requested. Close the console with `quit` + Enter or Ctrl+C.

## State and integrations

When a checkpoint or commit needs Git identity, Workbench opens a separate **Set up your commit author** dialog. Enter your name and commit email, then choose **Save and continue**. These settings apply only to that repository and its worktrees; no global Git setting is changed. Cancel leaves it unchanged. This is local attribution, not GitHub sign-in or publication; the name/email become visible to others if you later publish the commits. The dialog is shared by Windows and Linux builds.

Application state is separate from program files: `%LOCALAPPDATA%\AgentIntersect-World` on Windows or `${XDG_STATE_HOME:-~/.local/state}/agentintersect-world` on Linux. Uninstalling or deleting program files does **not** erase your projects, saved state, or native harness profiles. Optional cleanup of this application state should be your explicit choice after backing it up. World listens only on loopback by default; the browser and agent services you choose may have separate networking/authentication and costs.

Software is MIT licensed; third-party and supplied media terms are separate. See `LICENSE`, `THIRD_PARTY_NOTICES.md`, `DEPENDENCIES.json` and `runtime/LICENSE` in the package. `BUILD.json` records the source commit and runtime pin. This candidate is not yet a public product release or full human install acceptance.
