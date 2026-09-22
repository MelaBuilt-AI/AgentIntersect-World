# AgentIntersect World

**Your code becomes a place. Your agents become a presence.**

Local-first 3D workspace where your own coding agents (Claude Code, Codex, Hermes, OpenClaw, and friends) work on your repository as a world you can walk — not another hosted chat IDE, and not a replacement for those agents.

> **Status:** Private pre-release. Public downloads and a GitHub Release are coming. Watch this repo (when it opens) or [agentintersect.com](https://agentintersect.com) for the flip.
>
> Field Guide (pre-release): [guide.agentintersect.com](https://guide.agentintersect.com)

## What it is

- **Repository-as-landscape** — intake a repo and explore it as a spatial world (the “repo city”).
- **BYO agents** — attach harnesses you already run locally; World does not log in as you or replace Claude Code / Codex.
- **Conversation → Workstream → World View** — talk, assign work, then see agents as presence in the world.
- **Local loopback** — built for one operator on your machine, not a multi-user internet service.

## Demo

<!-- Replace with GIF / MP4 once Aaron's two clips are cut -->
**Coming soon:** short demos of (1) repo city load and (2) an agent coding task.

Site: [agentintersect.com](https://agentintersect.com)

## Requirements (developer / local)

- **Node.js 24+**, Corepack, Git
- At least one supported harness installed and signed in (Claude Code, Codex, Hermes, OpenClaw, …)
- **Desktop targets for packaged release:** Windows and Linux (macOS not a launch target unless stated later)
- Windows/WSL cross-environment process execution additionally needs native Python 3 in the target environment and a shared drive-backed World data directory

## Install (when Release ships)

<!-- Fill real URLs on first public Release -->
- **Windows:** download the installer from the [latest Release](https://github.com/MelaBuilt-AI/AgentIntersect-World/releases/latest) (link live after publish)
- **Linux:** install script / artifact from the same Release page
- Checksums will be listed in the Release notes

Until then, local development:

```sh
corepack pnpm@11.15.0 install --frozen-lockfile
corepack pnpm@11.15.0 dev
```

Open the Vite URL (normally `http://127.0.0.1:5173`). Backend defaults to loopback port `3770`.

## Connect your agents

1. After the opening logo, a new install opens **Agent Setup Menu**.
2. **Discover Agents** — reads install / native identity metadata. It does not log in, change providers, install plugins, or start WSL distros for you.
3. Pick harness + **native identity**, name the World connection, then **Attach to Agent Intersect World**.
4. **Continue to Agent Select**, choose who joins this World, set avatars when asked.

Later launches skip completed setup. **Escape for Menu** reopens Agent Setup without wiping saved work.

World does **not** collect harness login credentials in the browser. Finish auth in each harness’s own app.

More detail: existing in-repo setup docs (`docs/AGENT_SETUP_MENU.md`) and the sections below in the full developer README.

## What this is not

- Not Cursor / Windsurf (editor replacement)
- Not a hosted agent product (you bring local agents)
- Not Intersect AI / unrelated “Intersect” products — this is **AgentIntersect World** by [MelaBuilt AI](https://melabuilt.ai)

## Links

- Product: https://agentintersect.com
- Field Guide: https://guide.agentintersect.com
- Melabuilt: https://melabuilt.ai
- Discord: *invite when published*
- X: [@melabuiltai](https://x.com/melabuiltai)

## License

<!-- Add LICENSE before public open. Currently unset on the repo. -->

## Development

See the developer sections in this repository (tests, typecheck, lint, architecture checks). Packaged Release / public visibility are separate operator steps from day-to-day `pnpm` development.
