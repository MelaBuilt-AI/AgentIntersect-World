# AgentIntersect World — Release notes draft (first public)

**Tag (proposed):** `v0.1.0` (adjust to match your packaging version when artifacts exist)
**Visibility:** keep repo **private** until Aaron authorizes public + site download flip
**Artifacts:** Windows installer + Linux package/script + checksums (TBD — attach when built)

## Highlights

- Local-first 3D **AgentIntersect World** for one operator
- Repository intake → spatial **repo city**
- Attach **BYO** coding agents (Claude Code, Codex, Hermes, OpenClaw, …)
- Conversation / workstream / world presence loop

## Install

1. Download the asset for your OS from this Release
2. Verify checksum (listed below when attached)
3. Run the app; complete Agent Setup; attach at least one harness
4. Open or intake a repository and confirm World View loads

## Requirements

- Windows or Linux desktop target
- Node not required for packaged builds (if you ship native/desktop artifacts — confirm in packaging)
- At least one supported agent harness installed for full “agent presence” demos

## Known limits (be honest on day one)

- macOS: not a launch target unless explicitly added
- Windows SmartScreen / unsigned installer: document if still unsigned
- Public downloads remain off on agentintersect.com until `release.available` flip
- Cross-environment WSL caveats: see README / Field Guide

## Verify before publishing this Release

- [ ] Clean Windows install on a non-dev machine
- [ ] Clean Linux install on a non-dev machine
- [ ] Checksums match uploaded assets
- [ ] README install links point at this Release
- [ ] Repo still private OR intentional public flip authorized
- [ ] Site CTA / Watch releases ready
- [ ] Demo GIF or MP4 linked from README

## Checksums

```
# fill after build
# SHA256  AgentIntersect-World-Setup-win.exe
# SHA256  AgentIntersect-World-linux.tar.gz  (or install script)
```
