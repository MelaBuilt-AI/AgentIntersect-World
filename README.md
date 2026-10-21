# AgentIntersect World

**Your code becomes a place. Your agents become a presence.**

A local-first 3D workspace for your repositories and your own AI coding agents. Explore a repository as a city, discuss ideas with **Claude Code, Codex, Hermes or OpenClaw**, give work its own branch, and inspect the changes and previews—all in one World.

[Download World](https://agentintersect.com/download/) · [Field Guide](https://guide.agentintersect.com/getting-started/) · [Release notes](https://github.com/MelaBuilt-AI/AgentIntersect-World/releases/tag/v0.15.0-rc.2) · [Discord](https://discord.gg/8GfKXaJsyY)

> **Public preview · 0.15.0-rc.2** — Windows x64 and Linux x64/glibc. Windows builds are unsigned. Bring an installed, authenticated agent harness; model accounts and subscriptions are separate.

![AgentIntersect World — repository city load through ready](docs/launch/media/repo-city.gif)

_Development capture: World load → repository city ready. [More demos below](#demos)._

## What you can do

- **Explore your code spatially.** Load or create a repository and navigate its code city.
- **Bring your own agents.** Choose saved native connections and a constellation of up to four agents, each with its own identity and avatar.
- **Turn conversation into work.** Create a Workstream, inspect source and diffs, read validation results, and open an approved World View preview.
- **Keep tools within reach.** Use the Code Wheel, HUD or spatial screens, with explicit Terminal and PowerShell controls.
- **Make the environment yours.** Describe a custom World, tune weather and scenery, and save it for later.

World is built for one operator working locally—not a public multiplayer service, a hosted model subscription, or a replacement for your native agent harness. Local-first does not mean model-offline: your chosen harness may use cloud services. Do not expose the backend to the internet.

## Install World

**Windows x64:** download the [setup installer](https://github.com/MelaBuilt-AI/AgentIntersect-World/releases/download/v0.15.0-rc.2/AgentIntersect-World-0.15.0-rc.2-windows.3-windows-x64-setup.exe), compare its SHA-256 with [SHA256SUMS](https://github.com/MelaBuilt-AI/AgentIntersect-World/releases/download/v0.15.0-rc.2/SHA256SUMS), run setup, then launch **AgentIntersect World**. A private Node runtime and Git are included. **This installer is unsigned**; follow your device’s security policy rather than disabling protections. Prefer no setup wizard? Use the [portable Windows ZIP](https://github.com/MelaBuilt-AI/AgentIntersect-World/releases/download/v0.15.0-rc.2/AgentIntersect-World-0.15.0-rc.2-windows-x64.zip).

**Debian / Ubuntu x64:** download the `.deb` from the [release](https://github.com/MelaBuilt-AI/AgentIntersect-World/releases/tag/v0.15.0-rc.2), then:

```sh
sudo apt install ./AgentIntersect-World-0.15.0-rc.2-linux-x64.deb
agentintersect-world
```

**Other glibc-based Linux x64:** use the [portable Linux archive](https://github.com/MelaBuilt-AI/AgentIntersect-World/releases/download/v0.15.0-rc.2/AgentIntersect-World-0.15.0-rc.2-linux-x64.tar.gz) and run its `agentintersect-world` launcher. Git is required; the application bundles Node.

**Optional Linux terminal installer** (requires Node 20+ for the bootstrap):

```sh
npx -y @agentintersect-world/installer@0.15.0-rc.2 install
```

The installer downloads the exact release archive and checks its SHA-256 before installation. Run the launcher path it prints (normally `~/.local/bin/agentintersect-world`; custom XDG roots may change it). Use the pinned command above or the **rc** tag. npm also assigned **latest** on first publication; that tag does not make this preview a stable release.

At least one supported harness must be installed and authenticated separately. Model accounts, subscriptions and optional voice setup are not included. This release is a public preview: back up projects and application data. Earlier private kits reused this version label; check exact hashes and preserve existing state rather than assuming same-version installation upgrades older private bytes.

See [public release details](docs/PUBLIC_RELEASE_0.15.0-rc.2.md) for source provenance, checksums, source material and known limitations. Windows/WSL cross-environment execution additionally needs native Python 3 in the target environment and a shared drive-backed World data directory.

## Connect your agents

1. After the opening logo, a new install opens **Agent Setup Menu**.
2. **Discover Agents** — reads install / native identity metadata. It does not log in, change providers, install plugins, or start WSL distros for you.
3. Pick harness + **native identity**, name the World connection, then **Attach to Agent Intersect World**.
4. **Continue to Agent Select**, choose who joins this World, set avatars when asked.

Later launches skip completed setup. **Escape for Menu** reopens Agent Setup without wiping saved work.

World does **not** collect harness login credentials in the browser. Finish auth in each harness’s own app.

Deep dive: [docs/AGENT_SETUP_MENU.md](docs/AGENT_SETUP_MENU.md) · full developer README preserved at [docs/launch/README.developer.md](docs/launch/README.developer.md)

## Hack your World

**Describe the place you want to work in.** Hack your World changes the cosmetic environment around your agents and repository: ground, layered skies, distant scenery, weather, lightning and ambience. Your code, repository authority and movement rules stay unchanged.

1. **Try a preset:** left-click the sparking globe beneath **Escape for Menu** to cycle Original World → Sunlit Trails → Martian Expanse → saved custom Worlds. Original is the initial default.
2. **Describe your own:** hold right-click on the globe, or focus it and press **Shift+F10**. Enter 1–500 words; in a multi-agent World, choose the **World designer**. Only **Create with connected agent** sends the request, in a separate restricted recipe turn—not your coding conversation. Your harness's existing model/usage plan still applies.
3. **Tune the atmosphere:** expand **Weather and expanded scenery** to choose weather particles, ground, horizon, decorative cutouts, ambience and upper/local lightning. **Distant horizon lightning** adds a separate band of small flashes near the mountain ridges. Leave controls **From description** for the agent to choose, or pin your choices. **Preview these settings** needs no agent call.
4. **Keep or revert:** after preview, choose **Save to Custom**, **Use without saving**, or **Revert**. Eight numbered custom slots belong to this World install, survive refresh, and join globe cycling. Replacing or removing an occupied slot requires confirmation; temporary previews are not saved slots.

**Retrieve your original prompt:** in the custom dialog, expand **View description — Current World**, or open **Custom slots on this PC → View description — Custom N**, then **Copy description**. Newly created saved Worlds retain the exact submitted description; older slots without it show an unavailable message rather than inventing a prompt. All transient Hack notifications clear after five seconds; active progress and save/revert choices remain until resolved.

Try: “A rocky storm world with large branching lightning overhead and small, frequent distant bolts just above the mountain ridges, with soft surrounding flashes.”

Cancellation or failed generation/loading keeps the previous usable World. Effects mute controls weather audio separately from music; Reduced Motion skips animated weather and interference. The optional advanced recipe editor accepts validated visual JSON, not executable code or arbitrary asset URLs. Supplied scenery is bounded; decorative cutouts are 2D artwork, not physical terrain or weather simulation.

**Walkthrough:** [Hack your World Field Guide](https://guide.agentintersect.com/hack-your-world/) · [Feature details and supported generation limits](docs/HACK_YOUR_WORLD.md) · [Asset notices](THIRD_PARTY_NOTICES.md)

## Demos

Development captures; these demonstrate the product, not every control in the current release.

Inline GIF above shows the repo-city load. Full MP4s are on the [launch-demos](https://github.com/MelaBuilt-AI/AgentIntersect-World/releases/tag/launch-demos) prerelease (GitHub’s file viewer often won’t play repo videos — use the download links):

| Demo                                   | Watch / download                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Launch reel** (city + coding, ~100s) | [launch-reel.mp4](https://github.com/MelaBuilt-AI/AgentIntersect-World/releases/download/launch-demos/launch-reel.mp4)   |
| Repo city / `/repo load`               | [repo-city.mp4](https://github.com/MelaBuilt-AI/AgentIntersect-World/releases/download/launch-demos/repo-city.mp4)       |
| Agent coding / embodiment              | [agent-coding.mp4](https://github.com/MelaBuilt-AI/AgentIntersect-World/releases/download/launch-demos/agent-coding.mp4) |

## Develop from source

Requires **Node.js 24.x**, Corepack and Git. Use an HTTPS clone for public access:

```sh
git clone https://github.com/MelaBuilt-AI/AgentIntersect-World.git
cd AgentIntersect-World
corepack pnpm@11.15.0 install --frozen-lockfile
corepack pnpm@11.15.0 dev
```

Open the Vite URL (normally `http://127.0.0.1:5173`). Backend defaults to loopback port `3770`.

### Run checks

```sh
corepack pnpm@11.15.0 test
corepack pnpm@11.15.0 typecheck
corepack pnpm@11.15.0 lint
```

See [docs/launch/README.developer.md](docs/launch/README.developer.md) for the longer agent-setup and acceptance notes.

Historical engineering phase notes and proof kits live under [docs/internal/](docs/internal/) (not required for using or building World).

## Follow releases

To follow future releases, select **Watch → Custom → Releases** on this repository. A GitHub account is required; delivery follows your notification settings. No mailing-list signup is needed.

## Community and support

- [Website and downloads](https://agentintersect.com/download/) · [Field Guide](https://guide.agentintersect.com/getting-started/)
- [Report an issue](https://github.com/MelaBuilt-AI/AgentIntersect-World/issues) · [Private security reporting](SECURITY.md)
- [Contributing](CONTRIBUTING.md) · [Third-party and asset notices](THIRD_PARTY_NOTICES.md)
- [MelaBuilt AI](https://melabuilt.ai) · [X / @melabuiltai](https://x.com/melabuiltai) · [Discord](https://discord.gg/8GfKXaJsyY)

When reporting a problem, include the release, operating system, failed action and exact error. Remove credentials, private conversations and sensitive paths.

## License

World-owned code is [MIT licensed](LICENSE) © MelaBuilt AI. Bundled dependencies and supplied artwork retain their own terms; see [third-party notices](THIRD_PARTY_NOTICES.md) and the [release’s corresponding-source material](docs/PUBLIC_RELEASE_0.15.0-rc.2.md#bundled-source-and-licenses).
