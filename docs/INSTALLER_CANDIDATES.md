# Windows and Linux installer candidates

Aaron reported successful normal use on the merged build (movement, avatar changes, Hack your World and a coding change in an old test repository) and authorized Windows/Linux packaging. Windows is intentionally **unsigned** after the open-source signing application was declined; never claim SmartScreen or antivirus trust. This is packaging implementation and private testing, **not** authorization for a tag, GitHub Release, public download activation, provider installation, or Phase 20.

## Scope

- Build from merged `main` 83859c1 onward, with the existing browser-based local server and normal World frontend, bundled official Node 24 x64. No Electron, harness login, optional voice model or agent installed by the package.
- Windows 10/11 x64: per-user Inno Setup installer with Start Menu shortcut and registered uninstaller. Preserve user data on uninstall; display unsigned warning truthfully.
- Linux glibc x64: `.deb` for Debian/Ubuntu (`sudo apt install ./AgentIntersect-World-*.deb`, then `agentintersect-world`), plus an extract-and-run `.tar.gz` for developers on other glibc distributions. No system Node/pnpm required. Git and a configured agent harness remain prerequisites for full use.
- Loopback-only application URL, opt-out browser opening with `--no-open`, graceful quit/port cleanup. Per-user state remains outside the installed tree. Never overwrite or reset TEST45471 or protected TEST45457.
- Prove a locked production dependency closure, official runtime checksum, payload/privacy and notices, extracted Linux smoke, native Windows installed smoke and uninstall. Signed status is false. Package source/hash and CI evidence are separate from release authority.

## Current status

Implementation in progress on `feat/windows-linux-installers`. Existing private 0.15.0-rc.1 prototype is reference material only; its old product build/license assumptions are not this candidate. Package bytes and human install acceptance are pending verification.
