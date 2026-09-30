# Full-quality performance and Code Wheel delivery — September 30, 2026

## Current boundary

Aaron (`1554876840613773367`) authorized finishing the performance work and Code Wheel Screens shortcuts, commit/push, exact-head PR CI, then a fresh test left running and an end-session handoff. Merge, releases, npm publication and installer/website distribution remain unauthorized. This replaces the earlier session-pause instruction.

Worktree: `/home/mela_ai/AgentIntersect-World-menu`, branch `fix/relay-codex-shells` (PR32). Final SHA, hosted CI and live review ownership belong in the external runtime receipt and latest handoff, avoiding recursive status commits. The next acceptance gate is Aaron's review, not another implementation pass.

## Corrections

- Codex saved-connection upgrades validate the candidate and adopt its installation into the existing adapter while preserving identity/session ownership, busy guards and in-flight process launcher snapshots. Real 0.157.0 → 0.159.2 reply `CODEX_SWITCH_OK` succeeded. Evidence: `~/.hermes/runs/aiw-codex-switch-20260930/RESULTS.md`.
- Reflection preparation compiles queued replacement parts using the mirror's actual target, lighting and nested render context before readiness.
- Weather lighting has a stable owner outside staged scenery. Hidden scenery neither advances weather nor drives the shared light. No graphics quality/settings or asset reductions.
- Code Wheel → Screens now includes **Terminal** and **PowerShell**. A closed shell opens through the existing admin-shell path; an already-open shell toggles HUD/spatial placement without creating another process. Keyboard activation and placement-disabled behavior are covered. Elevation semantics remain unchanged (sudo/UAC), and credentials/approval remain operator-owned.
- Native 1280×577 inspection exposed ordinary HUD panels masking expanded wheel labels. The wheel now renders above ordinary HUD, below dialogs; this does not change shell/HUD layout generally.

## Native performance evidence

Evidence root: `~/.hermes/runs/aiw-performance-20260930/`. Real native Windows Edge/WebGPU, real `/home/mela_ai/projects/Clone test`, connected Diagnostic Codex, user-male-02/robot-agent-02, full quality and all eight graphics effects enabled. The diagnostic window is muted: audio correctness is **not** established.

The retained earlier samples remain valid, with their original limitations:

- Avatar return: `avatar2-default` max350ms/8 gaps>50ms; `candidate-avatar2` max74.9ms/3 gaps>50ms.
- Custom switch: `baseline-custom` max216.8ms/5 gaps>50ms; `final-custom` max41.7ms/0 gaps>50ms.
- Live generation: `baseline-generation` max625ms/4 gaps>50ms; `final-generation` max41.5ms/0 gaps>50ms. Different durations and stochastic live generation are not a controlled benchmark.
- Agent replacement: `final-agent` max91.8ms/2 gaps>50ms, arrival complete.
- Historical `final-city` max650.1ms remains a real preparation-stage pause, not an upward-stream pause and not erased by later samples.

The durable probe had a 25-second RAF collector and a 45-second city wait. The collector was corrected to 60seconds; actual captures each cover over45seconds from the Open project action through complete assembly, upward streams and settled scenery. No build/test workload ran concurrently with these measurements. Both use the same native viewport1848×1844/DPR1, avatars, quality, repository and retained browser profile. First capture restarts the native browser process; repeat reloads in that process. These are not pristine shader-cache A/B samples.

- `resumed-city`: 4,759 samples; maximum309.2ms during preparation; materialization maximum10.5ms; complete/streaming maximum30.0ms. Zero gaps>50ms after preparation.
- `resumed-city-repeat`: 4,804 samples; overall maximum85.2ms before preparation, preparation maximum56.5ms; materialization maximum10.5ms; complete/streaming maximum29.5ms. Zero gaps>50ms after preparation.
- Final1,500-sample settled windows recorded approximately107.35 and107.25 RAF callbacks/second. This is callback cadence, **not GPU-presented FPS**, and does not establish a sustained FPS gain against an unmatched baseline.
- Synchronous render-pipeline probes recorded44/45 creations respectively, none taking>5ms. CPU profiles for the worst historical/resumed cold gap include browser/program/idle, loading and GC time; they do **not** establish a unique GPU/asset/cache cause. Cache/order effects remain a plausible explanation, not a proven repair.

Technical disposition: the original loading/stream concern has now been separated and exercised over the full period. No further speculative renderer edits are justified by these samples. The reflection/weather corrections are ready for first-hand review; first-load preparation pauses remain explicitly disclosed. Do not claim stutter-free performance or Aaron's acceptance.

## Verification and delivery procedure

- Prior full pinned-Node24.18.0 `check:core` passed1,571 tests/276files plus11architecture tests, format/lint/types/build/startup/API smoke. This predates the wheel changes; final full gate must cover the combined tree.
- New wheel regressions were run RED before implementation, then GREEN for both launch actions, existing-shell placement, keyboard activation, disabled state and collapsed submenu; layering regression also RED→GREEN.
- Native diagnostic shortcut exercise sends exactly `{kind:"terminal"}` and `{kind:"powershell"}` through the built UI. Shell creation was deliberately answered503 by the diagnostic observer to avoid triggering sudo/UAC during automated UI checks. Both panels opened and closed with zero product page errors. This proves shortcut wiring/error presentation, not a new elevated-shell end-to-end acceptance; previously user-accepted PowerShell behavior is unchanged.
- An observer cleanup initially called unsupported `setViewportSize(null)` after all UI evidence was saved. Corrected to CDP `Emulation.clearDeviceMetricsOverride`; this was a harness error, not product failure.
- Final combined pinned-Node24.18.0 `check:core` PASS: **1,577tests/277files**, separate11architecture checks, format/lint/types/build/startup/API smoke. Bounded service `aiw-performance-wheel-core`, exit0, peak2G/no swap. Log: `~/.hermes/cache/terminal-output/out-1790782587-71906-69e0.log`. Current imported-avatar inputs and compatibility checks also PASS. Exact hosted run IDs are recorded outside this file after completion. No automated legacy product journey is reinstated as a CI gate.

## Review/runtime and carry-forward

Close only owned DIAG45482 service/browser after verification; preserve its state/profile and TEST45481 saved state. Open a genuinely fresh normal review lane **after exact-head CI green**, with new empty backend state/native browser profile and verified served bytes. Do not import diagnostic identities or drive the review UI. Leave it running for Aaron; old saved projects/worktrees remain on disk and require explicit project selection/Continue, not silent history import. Live ownership/URL are in the latest handoff/runtime README.

- PR32 remains unmerged; current manual review includes these corrections plus outstanding relay/duplicate-seat/Codex-switch/repository-release behavior. Previously accepted PowerShell remains accepted in its own scope.
- PR31 dependency-advisory slice stays **ON HOLD** pending performance/audio disposition. Original83859c1/2645c04/6ba0412 comparison matrix was not completed; no dependency/model blame is established.
- No sound after Diff test1 → Workbench → Clone test remains unresolved and untested in muted diagnostics.
- npmE401, unsigned setup policy block, real Install-AgentCLI installation, shell/HUD overlap at1280×577 and stale rc.2 kit remain separate backlog.
- No GitHub Release, npm publication, installer one-liner, website downloads or merge without explicit authorization.
