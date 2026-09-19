# AgentIntersect World — Phase 5 Asset Provenance

Manifest frozen: 2026-07-19
Extraction state: COPY VERIFIED
Source repository: `/home/user/AgentIntersect`
Source commit: `14c620271cd02e455d3244241de951e00ef77a4d`
Source status at inspection: clean `main`, synchronized with `origin/main`
Destination repository baseline: `82ff9af0ceec4734e9b8be54e44b49697acaccc0`

## Boundary and method

This is the one authorized Phase 5 read of the original AgentIntersect visual-shell baseline. The source repository was read but not modified. The inspection was limited to:

| Inspected source                        |                Bytes | SHA-256                                                            | Purpose                                                                                                                                                |
| --------------------------------------- | -------------------: | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/dashboard-ui.mjs`                  |               165862 | `3578b640224cb6aa1c56df58a0a438aefb705bdd127690faa8235302d8418650` | Identify accepted `identify_`, shell, hero, avatar compositor, harness/typewriter, panel-toggle, output/status, responsive, and accessibility behavior |
| `test/dashboard-visual-assets.test.mjs` |                24309 | `718459639f1c8eb55441426b8184ef057e002486d7ff06c8fd3d285c270a9108` | Identify directly relevant accepted visual-asset and interaction invariants                                                                            |
| `src/dashboard-assets/`                 | 45 files inventoried | Per selected row below                                             | Select the minimal rendered Phase 5 asset subset                                                                                                       |

No original route, API, mutation, connector, worker, onboarding, design-doc, lifecycle, or records business logic is copied. Interaction behavior is reimplemented in World-owned typed React components.

## Selected minimal copy manifest

All destination paths are under `apps/web/public/assets/dashboard/`. The **expected destination SHA-256** was frozen equal to the source SHA-256 before copying. The implementation worker measured each destination SHA-256 and verified byte equality with `cmp` after copying.

| Source path                                                           | Destination path                                                                  |  Bytes | Source SHA-256                                                     | Expected destination SHA-256                                       | Actual destination SHA-256                                         | `cmp` |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -----: | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ----- |
| `src/dashboard-assets/agentintersect_animated.svg`                    | `apps/web/public/assets/dashboard/agentintersect_animated.svg`                    |  15604 | `780645cf6b8796d810da4a586154a478ba77898db2b6a7ae0625bd41e0133e52` | `780645cf6b8796d810da4a586154a478ba77898db2b6a7ae0625bd41e0133e52` | `780645cf6b8796d810da4a586154a478ba77898db2b6a7ae0625bd41e0133e52` | PASS  |
| `src/dashboard-assets/agentintersect_header_static_dark_square.svg`   | `apps/web/public/assets/dashboard/agentintersect_header_static_dark_square.svg`   |  12805 | `06f68c6696586f76b679a06a030515a7df2c5fb01e52cd6c9b5eacb4885fe039` | `06f68c6696586f76b679a06a030515a7df2c5fb01e52cd6c9b5eacb4885fe039` | `06f68c6696586f76b679a06a030515a7df2c5fb01e52cd6c9b5eacb4885fe039` | PASS  |
| `src/dashboard-assets/avatar-sheet-female-front.png`                  | `apps/web/public/assets/dashboard/avatar-sheet-female-front.png`                  | 904941 | `42d25dfe820eefa4b9067a40435ed956a734519ebd32712cdce740d1f88b78d5` | `42d25dfe820eefa4b9067a40435ed956a734519ebd32712cdce740d1f88b78d5` | `42d25dfe820eefa4b9067a40435ed956a734519ebd32712cdce740d1f88b78d5` | PASS  |
| `src/dashboard-assets/avatar-sheet-male-front.png`                    | `apps/web/public/assets/dashboard/avatar-sheet-male-front.png`                    | 912821 | `014fb01e452e7d52ed84bbad42bfce3cc44dfcebe4fd22a740c5af18e2d58088` | `014fb01e452e7d52ed84bbad42bfce3cc44dfcebe4fd22a740c5af18e2d58088` | `014fb01e452e7d52ed84bbad42bfce3cc44dfcebe4fd22a740c5af18e2d58088` | PASS  |
| `src/dashboard-assets/avatar-puppet-female-background-halo-rings.png` | `apps/web/public/assets/dashboard/avatar-puppet-female-background-halo-rings.png` | 108811 | `ed4b8fab2c4eaea6755ecc90032908468758dbaa6d3b31919474791d5f49ab2a` | `ed4b8fab2c4eaea6755ecc90032908468758dbaa6d3b31919474791d5f49ab2a` | `ed4b8fab2c4eaea6755ecc90032908468758dbaa6d3b31919474791d5f49ab2a` | PASS  |
| `src/dashboard-assets/avatar-puppet-female-shoulders-torso.png`       | `apps/web/public/assets/dashboard/avatar-puppet-female-shoulders-torso.png`       | 957989 | `1736bf2eda9eba00c626cac2e46864acd26a0d991600f927b2186b6e852cd025` | `1736bf2eda9eba00c626cac2e46864acd26a0d991600f927b2186b6e852cd025` | `1736bf2eda9eba00c626cac2e46864acd26a0d991600f927b2186b6e852cd025` | PASS  |
| `src/dashboard-assets/avatar-puppet-female-head.png`                  | `apps/web/public/assets/dashboard/avatar-puppet-female-head.png`                  | 980370 | `4deb05ad8c52f53ddedb5ce7b0de45ea593f62f7a007c11ce02b5bbf8e5dfaa3` | `4deb05ad8c52f53ddedb5ce7b0de45ea593f62f7a007c11ce02b5bbf8e5dfaa3` | `4deb05ad8c52f53ddedb5ce7b0de45ea593f62f7a007c11ce02b5bbf8e5dfaa3` | PASS  |
| `src/dashboard-assets/avatar-puppet-female-hair-helmet.png`           | `apps/web/public/assets/dashboard/avatar-puppet-female-hair-helmet.png`           | 986601 | `c21852e4f93e84d0cfab5e305073b45e82ee03d1660262d4dec751789965e9c4` | `c21852e4f93e84d0cfab5e305073b45e82ee03d1660262d4dec751789965e9c4` | `c21852e4f93e84d0cfab5e305073b45e82ee03d1660262d4dec751789965e9c4` | PASS  |
| `src/dashboard-assets/avatar-puppet-female-face.png`                  | `apps/web/public/assets/dashboard/avatar-puppet-female-face.png`                  | 938601 | `3bb5562fd4a0d0c3a1ecf463a7eb8a6bc818d0e556734e741c409d28dafa160a` | `3bb5562fd4a0d0c3a1ecf463a7eb8a6bc818d0e556734e741c409d28dafa160a` | `3bb5562fd4a0d0c3a1ecf463a7eb8a6bc818d0e556734e741c409d28dafa160a` | PASS  |
| `src/dashboard-assets/avatar-puppet-female-eyes.png`                  | `apps/web/public/assets/dashboard/avatar-puppet-female-eyes.png`                  | 923720 | `4c0982e514599a40a89cd9f1674a83d2ea68b53e8d3ae94ddd3727975210a632` | `4c0982e514599a40a89cd9f1674a83d2ea68b53e8d3ae94ddd3727975210a632` | `4c0982e514599a40a89cd9f1674a83d2ea68b53e8d3ae94ddd3727975210a632` | PASS  |
| `src/dashboard-assets/avatar-puppet-female-foreground-glow.png`       | `apps/web/public/assets/dashboard/avatar-puppet-female-foreground-glow.png`       |  83056 | `e5b6643aa8b0c586b5c1f34c7c272dd4942c96cedb35278b69ce57adddfe980f` | `e5b6643aa8b0c586b5c1f34c7c272dd4942c96cedb35278b69ce57adddfe980f` | `e5b6643aa8b0c586b5c1f34c7c272dd4942c96cedb35278b69ce57adddfe980f` | PASS  |
| `src/dashboard-assets/avatar-puppet-male-background-halo-rings.png`   | `apps/web/public/assets/dashboard/avatar-puppet-male-background-halo-rings.png`   | 108811 | `ed4b8fab2c4eaea6755ecc90032908468758dbaa6d3b31919474791d5f49ab2a` | `ed4b8fab2c4eaea6755ecc90032908468758dbaa6d3b31919474791d5f49ab2a` | `ed4b8fab2c4eaea6755ecc90032908468758dbaa6d3b31919474791d5f49ab2a` | PASS  |
| `src/dashboard-assets/avatar-puppet-male-shoulders-torso.png`         | `apps/web/public/assets/dashboard/avatar-puppet-male-shoulders-torso.png`         | 965975 | `057faefbdbd1f8ed38eb43d049018f27f0a022cb1dae7b795b0d7af7527aa525` | `057faefbdbd1f8ed38eb43d049018f27f0a022cb1dae7b795b0d7af7527aa525` | `057faefbdbd1f8ed38eb43d049018f27f0a022cb1dae7b795b0d7af7527aa525` | PASS  |
| `src/dashboard-assets/avatar-puppet-male-head.png`                    | `apps/web/public/assets/dashboard/avatar-puppet-male-head.png`                    | 990724 | `475d085b31be1fdabbbe4e53467b707e43eb3569084b6605b27eb7bbaff5d244` | `475d085b31be1fdabbbe4e53467b707e43eb3569084b6605b27eb7bbaff5d244` | `475d085b31be1fdabbbe4e53467b707e43eb3569084b6605b27eb7bbaff5d244` | PASS  |
| `src/dashboard-assets/avatar-puppet-male-hair-helmet.png`             | `apps/web/public/assets/dashboard/avatar-puppet-male-hair-helmet.png`             | 996778 | `15a02586d8054c7321fbb71e2f00981e6b987decc13a34212272d0a70cde08b7` | `15a02586d8054c7321fbb71e2f00981e6b987decc13a34212272d0a70cde08b7` | `15a02586d8054c7321fbb71e2f00981e6b987decc13a34212272d0a70cde08b7` | PASS  |
| `src/dashboard-assets/avatar-puppet-male-face.png`                    | `apps/web/public/assets/dashboard/avatar-puppet-male-face.png`                    | 948891 | `7d1ba72de52cbe6232ce0e13cac27d2b7a12681219847e26baff93d77a9f3748` | `7d1ba72de52cbe6232ce0e13cac27d2b7a12681219847e26baff93d77a9f3748` | `7d1ba72de52cbe6232ce0e13cac27d2b7a12681219847e26baff93d77a9f3748` | PASS  |
| `src/dashboard-assets/avatar-puppet-male-eyes.png`                    | `apps/web/public/assets/dashboard/avatar-puppet-male-eyes.png`                    | 932560 | `cb337dc6f33e72a1d864b923dce7abe8f91da5055da0490a67dace69e6500225` | `cb337dc6f33e72a1d864b923dce7abe8f91da5055da0490a67dace69e6500225` | `cb337dc6f33e72a1d864b923dce7abe8f91da5055da0490a67dace69e6500225` | PASS  |
| `src/dashboard-assets/avatar-puppet-male-foreground-glow.png`         | `apps/web/public/assets/dashboard/avatar-puppet-male-foreground-glow.png`         |  83056 | `e5b6643aa8b0c586b5c1f34c7c272dd4942c96cedb35278b69ce57adddfe980f` | `e5b6643aa8b0c586b5c1f34c7c272dd4942c96cedb35278b69ce57adddfe980f` | `e5b6643aa8b0c586b5c1f34c7c272dd4942c96cedb35278b69ce57adddfe980f` | PASS  |

## Selection rationale

- The two SVGs preserve the accepted static header mark and animated hero mark.
- Female and male front sheets provide resilient semantic/fallback previews.
- The seven female and seven male transparent puppet layers preserve the approved inherited 2D compositor surface while allowing World-owned local appearance selection and preview behavior.
- The male and female background/glow layers are byte-identical to each other in the source and remain separate named files because the compositor resolves avatar-specific layer paths.

## Explicitly not copied

- `dashboard-avatar-3d.bundle.js`, `dashboard-avatar-3d.mjs`, `three.core.min.js`, and `three.module.min.js`: source-specific 2.5D/Three runtime; Phase 5 implements its own typed React/R3F renderer and must not import the old runtime.
- Full/reference/loop/state-frame avatar PNGs: not required by the frozen first-open, preview, compositor, hero, or fallback path.
- `agentintersect_icon_dark_square.svg`: unused by the frozen World shell.
- Original menu markup, API calls, connectors, worker controls, and business logic: outside Phase 5 and not assets.

## Completion procedure

The implementation worker must:

1. copy only the 18 selected files to the listed destination paths;
2. preserve bytes exactly, without SVG or PNG rewriting;
3. measure every destination size and SHA-256;
4. run `cmp` for every source/destination pair;
5. replace every `PENDING` cell with the measured destination hash and `PASS`;
6. leave the original AgentIntersect worktree unchanged;
7. treat the copied destination assets as World-owned thereafter.
