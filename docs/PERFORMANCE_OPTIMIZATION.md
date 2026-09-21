# All-effects render optimization and Change Agent correction

## Scope

Aaron requested a performance pass with every effect enabled, preserving the accepted look, plus correction of Escape → Change Agent refusing Claude/Codex. This branch is based on main, separate from the unmerged private release-preparation PR19. No release, tag, visibility change, provider configuration change or retained operator-state mutation is included.

## Changes

- Share exactly one full-resolution fog depth/coverage capture per R3F presentation frame. Three's render counter advances during nested reflections/postprocessing; using it as the cache key caused a second whole-scene fog capture in the same frame. Reset the existing lazy cache in its owning frame callback instead. Shaders, textures, effect settings, target resolutions, geometry and animation timing are unchanged.
- Honor harness selections while the agent-name/retry prompt is open. Change Agent previously opened a Hermes-defaulted prompt; Claude/Codex controls looked enabled but the reducer rejected their selection, so connecting could target the wrong adapter. In-flight connections remain non-switchable.
- Changing appearance alone remains Escape → Change Avatar → connected agent. That existing path preserves the active session; Change Agent remains a different connection flow. No native history is deleted by either selection correction.

## Verification

- Both regressions observed RED, then GREEN. Fog regression simulates a nested reflection counter increment and proves one capture, then a new presentation frame proves a fresh capture. State restoration and target disposal remain covered.
- Full `check:core` passes: 1,342 tests in 222 files, plus 11 architecture tests; formatting, lint, typecheck, package/application builds and disposable-server smoke pass.
- Native Windows Edge WebGL renderer attested as NVIDIA GeForce RTX 5070 Ti / ANGLE D3D11. Isolated 25-object real Repository City/WorldEnvironment probe, 1440×900, DPR 1, all seven graphics switches ON:
  - Fog captures per frame: 2 → 1.
  - Draw calls: 226 → 199 (11.95% less).
  - Submitted triangles: 599,298 → 480,906 (19.76% less); no model simplification.
  - Texture/geometry population unchanged: 49 / 132.
  - Base Fog off: 47 textures / 107 geometries; restored: 49 / 132. Capture targets are still released and recreated correctly.
  - Baseline synchronized render-work median/p95 1.7/2.0 ms. Candidate runs 1.7/2.1 and 1.5/2.0 ms. Work reduction is reliable; these short timing samples overlap. **No full-application FPS uplift is claimed.** This fixture does not include the complete UI/avatars/workstream state.
  - Final isolated probe: zero page/console errors; all 25 arrivals complete; oblique, low and overhead captures retained.
- A potential single-pass rain optimization was discarded: pinned Three r185 already enables it for ShaderMaterial. No no-op flag or altered rain appearance is shipped.

Local evidence: `/home/mela_ai/.hermes/runs/aiw-performance-20260919/`. The first probe's single error was the standalone fixture's missing favicon, corrected before the final zero-error run. The first full-gate launcher failed before execution due to an unquoted PATH with Windows spaces; `core-corrected.log` is the actual green gate.

Focused production-browser verification and exact-head CI are recorded on the PR rather than claimed complete by this document. Human all-effects appearance/smoothness and real Claude/Codex reconnection retests remain pending; deterministic selection proof is not a native provider acceptance claim.
