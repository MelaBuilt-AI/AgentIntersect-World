# Code World projections — new PR scope

Authorized by Aaron, 2026-09-05, Discord `1545840949538857072` and supplied `AIW_screens_change.txt`. Implement directly in `feat/code-world-projections` from accepted main `ebba77c8442318acd5ca65994cddcd139d16bcbc`. One private draft PR; merge remains held for manual acceptance.

## Observable contract

- All movable spatial panels: bottom on-screen strip reads `Hold here to move`. Left-hold that strip is the only pointer drag origin; neither screen contents nor geometry/floor glow starts dragging. Preserve keyboard accessibility, real DOM controls, iframe identity, HUD round trips, input isolation and Escape release.
- While holding a panel, wheel rotates its yaw; pointer movement translates; release retains both. Held wheel cannot zoom World or scroll panels. Ctrl-wheel remains browser-owned.
- Remove physical stands/bases from every spatial screen. General screens have floor-up translucent projection beams and subtle floor light; backs/sides use supplied terminal rain texture. No decorative geometry carries movement authority.
- Repo selection opens a base-free code projection from the selected object, progressively revealing upward. Snapshot camera-view orientation at the click; retain orientation for that opening without following the avatar/camera or snapping the camera on selection. Preserve read-only source, explicit focus, Alt+4, scrolling and close/restore behavior. Reduced motion reveals immediately.
- Default floor doubles from 34 to 68 units per side. Grow at repository load from repository size and actual object footprints; grow in-session for object/screen/user extents. Never shrink during a mounted World session. Keep semantic renderer capacity bounded; floor growth is not authorization to render unlimited GLBs.
- Repository load and Director drops must not hide the floor/avatars/existing city or replay settled object materialization. Isolate new-asset loading and preserve scene identities.
- Use exact supplied seamless-4k `02_terminal_rain.png`, `12_repository_map_floor.png`, and `16_constellation_graph_sky.png` as source assets. Runtime lossless WebP conversion is allowed for transfer efficiency; record hashes/dimensions. Shared sRGB mipmapped textures; stable tiled density; inward sky surface (source is not an HDR or cubemap). Consistent lighting and actual shadow casting/receiving. Selected delegated art direction: dark code-built world, restrained cyan/violet accents, readable foreground UI, no unrelated new heavy assets or models.

## Boundaries

Standard local/trusted-human frontend work. Preserve original AgentIntersect, protected services/profiles/providers, and both retained acceptance generations (45270/43870 and 45271/43871), their external served builds and state. No cleanup of those generations, Phase 20, full Slice 6 acceptance, release/tag/publication/deployment/public ingress/visibility change. Decorative code textures never represent executable or live repository evidence.

## Proof / delivery

Focused regressions for input/pose/reveal/floor/scene continuity; relevant renderer/web type/lint/build/startup checks; production-shaped impacted browser journeys with delayed new GLB loading and real pointer/wheel input. Inspect final visual/temporal artifacts; preserve earlier evidence. Commit/push the new draft PR, verify exact-tip CI; prepare a fresh matching disposable normal-World candidate with owned launch/stop helpers and an ordered manual checklist. Leave it running with manual verdict PENDING; prep end session. Automated fixture scenes do not count as Aaron's acceptance or the full real-project Slice 6 loop.
