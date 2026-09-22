# Phase 11 implementation report

Status: **COMPLETE / PRIVATE EXACT-SHA CI GREEN**

Phase 11 adds the strict `aiw.avatar/0.11` local profile, current/previous recovery, Phase 5 migration, explicit roster opt-in/revocation, deterministic authoritative animation mapping, the numbered semantic editor, truthful roster, lazy Blender-backed preview, text/reduced-motion/WebGL equivalents, and the complete project-owned avatar asset kit.

## Delivered avatar kit

- One shared `AIW_Biped_Rig`, 21 bones, six shared core body objects, eight attachment anchors, and seven shared multi-bone actions: `Idle`, `Walk`, `Run`, `Work`, `Celebrate`, `Error`, and `Offline`.
- Twelve labeled head variants: four human, four dog, and four cat silhouettes, each with project-owned neutral facial geometry.
- Distinct hands, rounded paws, clawed paws, human/paw/clawed feet, none/short/long fur, straight/curled cat and dog tails, and solid/muzzle/mask/socks markings.
- Twelve body colors and four fitted tees: blue Codex, orange Claude, yellow Hermes, and red OpenClaw.
- Required NFC-normalized agent name displayed above the rendered head and repeated in authoritative semantic text.
- Skeleton-safe Three.js cloning, shared GLB geometry/material loading, deterministic status-to-animation projection, and a 12-avatar visible cap with 64 semantic roster rows. On browsers reporting two or fewer CPUs, avatar WebGL cosmetics are disabled in the World hero, roster, and performance fixture while every identity/action row remains semantic and the static appearance evidence remains available.

## Privacy and accessibility

Manual selections remain browser-local. Automatic profile mapping is off by default and limited to an explicitly approved public display label plus opaque owned-agent reference. Prompts, memory, transcripts, source content, paths, secrets, inferred traits, and biometrics are rejected. Local current/previous recovery, export preview, consent revocation, and delete/reset are available.

The canvas is supplementary. The complete workflow remains available through semantic DOM, keyboard input, visible focus, forced colors, reduced motion, text-only mode without a GLB request, and WebGL fallback. Status and lifecycle meaning never depend on color or animation.

## Blender and deterministic evidence

- Authoring runtime: Blender `5.2.0 LTS`.
- Source: `assets/avatar/aiw-avatar-kit.blend`.
- Runtime export: `apps/web/public/assets/avatar/aiw-avatar-kit.glb` — 1,727,424 bytes.
- Appearance board: `apps/web/public/assets/avatar/aiw-avatar-contact-sheet.png` — 2,036,272 bytes.
- Motion board: `apps/web/public/assets/avatar/aiw-avatar-motion-sheet.png` — 1,094,533 bytes.
- Combined board size: 3,130,805 bytes, below the 4 MiB budget.
- Independent source/runtime inspection: 71 objects, 62 meshes, 24 source materials, one armature, 21 bones, seven actions, one runtime skin, zero core-body connection gaps, distinct modular geometry signatures, fitted shirt-label bounds, complete facial inventory, and distinct multi-bone action signatures.

Mr Fluff regenerated the kit twice in separate clean Blender processes. The GLB, appearance board, motion board, and structural inspection JSON were byte-identical across both runs. Blender container metadata is intentionally treated as volatile; the structural inspection is authoritative for `.blend` equivalence. The former modifier-order warning is absent.

## Independent parent verification

All verification used Node `v24.18.0`, pnpm `11.15.0`, and Blender `5.2.0 LTS`.

- Focused avatar/startup/acceptance tests: **22/22 passed**.
- Full `pnpm check`: formatting, lint, typecheck, architecture, **311/311 Vitest**, production build, smoke, and **28/28 Playwright** passed.
- Phase 11 measurement: 12 visible avatars, 64 semantic rows, 120 frames, **16.8 ms p95**, **0 ms longest observed task**.
- Forced two-CPU proof (`CPUQuota=200%` plus browser `hardwareConcurrency=2`): zero WebGL avatar cosmetics, no GLB fetch, all 12 fixture summaries and 64 roster rows retained, 120 frames at **16.7 ms p95**, **0 ms longest observed task**.
- Phase 10 measurement remained within its frozen cold/warm/RSS ceilings.
- Storybook production build: passed with Phase 11 states.
- Production dependency audit: **no known vulnerabilities**.
- Disposable `verify:fresh`: passed for **320 project source files**, including Blender regeneration/inspection, complete tests/build/smoke, and all browser journeys.
- First-hand Chromium walkthrough: configured `Scout` as Dog/Husky with paws, clawed paw feet, long fur, curled dog tail, muzzle marking, warm-light body, and red OpenClaw tee; semantic summary matched, the live avatar/nameplate rendered cleanly, save entered World, and captured console/page errors were empty.
- Visual inspection accepted the final appearance and motion boards: all 12 heads, all modular families, four tees, and seven labeled poses are readable and unclipped.

## Exact-SHA CI closeout

The implementation was privately committed as `caaf79021b9611c7a632462ee48e0e464fc98394`. Exact-SHA CI then exposed a real two-CPU performance failure, corrected in `94ded384d4a5d265b8b47699d7c254e6fc374f5c` by disabling optional avatar WebGL cosmetics on browsers reporting two or fewer CPUs while retaining every semantic identity/action row and the static appearance evidence.

That correction made the dedicated performance stage green but exposed two downstream browser-contract mismatches: the true-3D visual journey exhausted its default 30-second timeout while waiting through fixed screenshot sleeps, and the inherited Phase 5 full-cosmetic screenshot silently followed ambient runner CPU count. Final correction `933fdd0725bc2631821ad0a5e5c3dd7506f34d0e` replaced fixed sleeps with selected-model first-frame readiness, kept the only true WebGL human/dog/cat journey under a bounded 60-second timeout, and explicitly selects full or constrained cosmetics before navigation. No snapshot baseline, 0.04 cross-run pixel allowance, 33.3 ms frame ceiling, or 100 ms Long Task ceiling changed.

Exact-SHA Actions run `29795954168` and job `88527213458` succeeded in 4m26s. The two-CPU runner passed Phase 10 measurement, `avatar:verify`, Phase 11 measurement at 16.7 ms p95 with zero WebGL cosmetics, 64 semantic rows, 120 frames, and 0 ms longest task, plus the complete `pnpm check` with 311/311 Vitest and 28/28 Playwright.

The generic Vite warning for the pre-existing shared Three/R3F vendor chunk remains non-blocking: it is lazy, outside the capped initial entry, shared with earlier renderer phases, and covered by independent startup-boundary tests.

## Closeout boundary

No original-AgentIntersect access or modification, release, tag, package publication, deployment, public ingress, visibility change, or Phase 12 work occurred. Phase 11 is complete at the private exact-SHA CI gate; Phase 12 remains a separate explicit authorization and fresh-scope decision.
