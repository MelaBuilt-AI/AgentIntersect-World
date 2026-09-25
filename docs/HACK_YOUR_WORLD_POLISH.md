# Hack your World — additive polish and custom slots

Authorized by Aaron, 2026-09-24, Discord 1552678230748565536.

Aaron tested TEST45425 and reports it is much better. Preserve the accepted visual direction; this is additive polish, not blanket acceptance of unreported checks.

## Acceptance scope

- Keep current environment interference and add irregular localized texture flicker and brief streaming-code patches on floor/sky materials only. Actors, UI and camera remain untouched. Reduced Motion disables decorative motion/interference.
- Globe sparks orbit continuously, accelerating during generation/loading/switching. Click feedback is visible. Right-button holding displays a filling progress bar and clear custom-create instructions, cancelled by release/cancel/blur; keyboard alternative remains.
- After generated/manual preview readiness, ask whether to save. Eight numbered custom slots live in the configured install's backend data directory, survive backend/browser restarts, and join left-click cycling in slot order. No silent eviction or name-based replacement. Replacing/removing occupied slots needs explicit confirmation. Unsaved previews may be used temporarily or reverted.
- Preserve existing browser-saved recipes as explicitly importable legacy items; do not silently delete them or overwrite PC slots.
- Asset/audio recommendations only; no asset acquisition, provider activation, native generation reruns, publication, commits, pushes, merge, installers or Phase20.

## Verification / runtime boundaries

Focused RED→GREEN, affected tests, conventional code/type/lint/architecture/build/startup checks. No scripted product-navigation journeys. Isolated component/shader proof is distinct from Aaron's appearance/comfort verdict.

At initial read, retained TEST45425 unit is inactive (MainPID0); 45425/44025/45419 have no listeners. No service was stopped or user state reset by this pass. Saved review roots remain protected.
