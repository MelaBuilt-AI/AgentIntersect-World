# Hack your World — feature slice and continuation

## Approved scope

Aaron authorized this feature PR and a retained hands-on preview before the extension texture library arrives. No merge, release, installer activation, provider change, or protected-service reset is authorized.

- Original World's existing code floor, layered sky, lighting and sound remain the initial default. No new preset is activated automatically on entry.
- Beneath Escape for Menu: Hack your World with an electrically animated globe. Left-click cycles Original → Sunlit → Mars → Original (plus explicitly saved custom recipes).
- Switch only cosmetic environment layers, lighting and ambience; preserve canvas, avatars, camera, repository layout/collisions, Workstreams and chat.
- Preload before switching; bounded glitch/static transition with a non-flashing Reduced Motion equivalent and recoverable load failure.
- Use supplied eight textures and eleven audio masters, deriving browser-sized encodings while retaining original source files untouched.
- Sunlit: sandy paths/grass, blue sky, mountain horizon, moving clouds, visible sun and outdoor lighting. Mars: red sand/rock, starfield, moons/planets, flowing nebula gas.
- Background sky/starfield drift subtly; foreground cloud/gas currents are stronger, with all motion frozen under Reduced Motion. An owner-requested small cosmetic instanced scatter adds up to 24 grass tufts (on green texture coverage) or 18 low-poly rocks; no physics, per-frame updates, shadow casting or density growth with floor size.
- Right-click hold opens “Tell me what your World looks like…”; keyboard access too. Maximum 500 words, retained draft. Versioned data-only recipes and an asset catalog form the custom-authoring boundary. No arbitrary scripts, shaders, paths or remote URLs.
- Automatic connected-agent generation must not fall back to unrestricted coding/chat. Until a capability-restricted environment turn is integrated, show an explicit unavailable explanation. A local recipe preview/import is not represented as agent generation.
- Manual appearance/audio acceptance remains pending Aaron. Conventional code checks, no automated product-navigation journeys.

## Extension-library checkpoint

The existing floor PNGs are precomposed sand/grass and sand/rock. They are not separate material masks. The forthcoming library supplies independent ground materials and masks, additional horizons, celestial sprites and atmosphere layers. Do not invent placeholder files or pretend baked textures provide independent grass coverage.

Next-session work: ingest and verify the delivered library; add its real asset IDs and mask blending; extend recipe controls and bounded agent discovery/proposal transport; verify selected-agent ownership and tool restriction before enabling automatic creation. Keep source/renderer validation, real agent execution, and user visual acceptance separately labeled.

## Invariants

Original assets and their shader behavior remain unchanged. Audio uses the existing effects mute/unlock lifecycle; no separate autoplay bypass. Reduced Motion stops new decorative movement and flicker. Escape cancels the custom dialog without changing the active environment. No new network credentials, global MCP installation, code-writing permissions or automatic Workstream creation.
