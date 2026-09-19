# Repository City and Asset Palette Implementation Plan

**Goal:** Replace the box-only repository floor with an event-driven living repository city using Aaron's 26 static GLBs and matching PNG thumbnails, while simplifying the normal World flow around one truthful repository-ready state.

**Architecture:** Keep the source GLBs byte-identical. Define every asset, meaning, category, event mapping, effect, status color, and source hash in one shared manifest. Derive runtime city instances directly from repository/activity events, render effects in React Three Fiber, and expose the same manifest through a collapsible palette and inspector. Prefer one direct state reducer and one renderer path over additional lifecycle or validation layers.

**Tech stack:** React 19, TypeScript, React Three Fiber/Three.js, existing World repository APIs and normalized events, Vitest, Playwright, Blender 5.2 CLI for read-only asset inspection.

## Scope and invariants

- Preserve the accepted user/agent collaboration zone at the center of the existing World room.
- Repository events materialize assets on the surrounding grid; the city is not decorative.
- Source GLBs remain static and byte-identical. Rise, scan ring, light particles, emissive ramp, hover/pulse, and status effects are runtime behavior.
- Status semantics: cyan = active/success, amber = pending, red flicker = failure, violet = merge/deploy. Include non-color semantic labels/markers and reduced-motion behavior.
- Live mode auto-spawns from real supported events. Director mode supports drag/drop placement with a visible pinned marker.
- Clicking an object opens a plain-English inspector with linked repository data and Focus, Pin, Remove, Locate Repo Item, and Ask Agent to Explain actions. “Ask” should prefill/target the existing chat rather than silently sending.
- Preserve no-repository-code-execution, path privacy, deterministic identity where continuity requires it, bounded large-scene behavior, and truthful loading/ready/error states.
- No release, publication, deployment, visibility change, provider activation, protected-service mutation, or original AgentIntersect edit.

## Ordered implementation

### 1. Intake and provenance

- Copy all 26 PNG/GLB pairs from `/mnt/c/Codex/repository-visual-assets` into a World-owned repository asset directory without modifying bytes.
- Add appropriate Git LFS patterns for large binary assets.
- Add the Blender 5.2 inspection receipt and original SHA-256 values.
- Verify exactly 26 deterministic PNG/GLB pairs and zero embedded animations.

### 2. Shared configurable manifest

- Create one exported manifest containing stable ID, label, category, meaning, GLB/thumbnail URL, source hashes, event types, default effect, status palette, default scale/footprint, and inspector copy.
- Map all 26 concepts, including the code-review station as the active review workspace.
- Add focused tests proving filename pairing, uniqueness, event coverage, and status-color semantics.

### 3. Direct event-to-city model

- Add one small reducer/projector that converts repository and activity events into deterministic city instances.
- Repository root, directories, files/snippets, functions, dependencies, branch/commit/task/issue/diff/review/PR/conflict/test/CI/security/docs/config/data/artifact/search/sync/conversation/release/deploy events select the corresponding manifest entry.
- Keep one explicit lifecycle per instance: materializing → idle, with status and pinned state. Avoid parallel readiness state machines.

### 4. Runtime GLB renderer and effects

- Replace the normal World room's primitive repository-instance groups with manifest-backed GLBs.
- Place repository visuals around the central collaboration zone on the existing grid.
- On create/update, rise from below with a soft overshoot, show a ground scan ring and bounded upward particles, ramp opacity/emissive from bright to normal, then retain subtle hover or emissive pulse.
- Apply truthful status treatment and reduced-motion equivalents without baking changes into the GLBs.
- Preserve large-scene fallback/instancing where needed instead of loading unbounded unique GLB copies.

### 5. Repository Asset Palette

- Add a collapsible Assets drawer inside the World surface.
- Render the 26 PNG thumbnails from the same manifest with search and category filtering.
- Provide Live and Director modes. In Director mode, drag an asset card to the grid and create a pinned manual instance at the resolved drop position.
- Keep the drawer contained and keyboard accessible on desktop/mobile.

### 6. Asset Inspector and actions

- Clicking a city object opens the Asset Inspector with meaning, status, linked repository data, and source event.
- Implement Focus, Pin/Unpin, Remove for manual instances, Locate Repo Item, and Ask Agent to Explain.
- Keep unsupported actions visibly disabled rather than fabricating linked data or authority.

### 7. Integrate truthful events

- Connect initial repository-load/index/world data to root/directory/file materialization.
- Connect currently available real activity/event surfaces where their semantics are explicit.
- Keep manifest mappings for later event families configurable but do not synthesize unsupported live events.
- Simplify repository readiness to one observable loading/ready/error seam used by UI and tests.

### 8. Verification and closeout

- Run focused RED/GREEN tests, affected web/renderer tests, typecheck/lint, and a production build.
- Run one production-shaped browser journey for repository materialization, palette filtering, director placement, inspector actions, reduced motion, and mobile containment as time permits.
- Inspect pixels directly; do not claim manual visual acceptance on Aaron's behalf.
- Do not fight inherited GitHub shard failures tied to the superseded floor journey during this bounded implementation lane.

## Likely files

- `assets/repository-city/` or `apps/web/public/assets/repository-city/`
- `.gitattributes`
- `packages/renderer-r3f/src/repository-asset-manifest.ts`
- `packages/renderer-r3f/src/repository-city-state.ts`
- `packages/renderer-r3f/src/repository-city-canvas.tsx`
- `packages/renderer-r3f/src/world-room-imported-canvas.tsx`
- `packages/renderer-r3f/src/index.ts`
- `apps/web/src/world-entry/WorldEntryExperience.tsx`
- `apps/web/src/world-entry/RepositoryAssetPalette.tsx`
- `apps/web/src/world-entry/world-entry.css`
- focused renderer/web unit tests and one browser journey

## Timeboxed stopping rule

Complete coherent vertical slices in the listed order. At the soft deadline, stop starting new slices, finish the current safe boundary, preserve exact worktree/test truth, and produce a durable report. A missing UX/permission decision is a safe-pause trigger, not permission to guess.

## Safe-pause continuation boundary — 2026-08-05 09:25 EDT

- The bounded worker completed all eight slices and wrote `/home/user/.hermes/runs/aiw-repository-city-20260805T113254Z/final-report.md` with inner exit `0`. Its pre-parent verification era reported focused 99/99, typecheck 38/38 tasks, lint, build 20/20 tasks, one production WebGL journey, and one reduced-motion Director journey green.
- Parent inspection then found that the Inspector `Focus` action did not move the camera. Parent added direct `cityFocusPosition` camera targeting to both normal World canvas implementations. The immediate renderer/web build and typecheck exited `0`; the focused renderer/palette/World UI slice passed 3 files / 25 tests. However, the package runner warned that these post-Focus checks used Node 22 despite the requested PATH, so they are useful focused evidence but not final Node-24 acceptance.
- The only persisted Playwright result remains the intentional RED run from **08:23:49 EDT**, before the Focus implementation: repository semantic state was ready while the canvas still identified itself as `world-room`, so the new `repository-city` assertion failed. Do not mislabel this stale result as a post-Focus failure.
- Two attempts to run the corrected production journey directly under Node 24 in a foreground Hermes tool call produced no newer Playwright artifact and wedged the conversation until Aaron restarted the Hermes gateway. Do not repeat that execution shape or add timeout. Run future browser proof as a tracked background job with durable stdout/stderr and `notify_on_complete=true`.
- No browser/test/server/worker remains. The repository-city completion fallback cron and script were removed. The worktree is unstaged, uncommitted, has no upstream, and is **not commit-ready** until the corrected post-Focus production journey produces a real result and parent verification completes.

## Manual operator verdict — 2026-08-05

- Parent closeout is now technically green under explicit Node 24: renderer build,
  web typecheck, the focused 3-file/25-test slice, fresh production build, and the
  corrected production Playwright journey all passed.
- Aaron's normal-product loopback run is an overall **mixed manual FAIL** while
  preserving partial acceptance. Repository load itself passed, as did Director
  placement and Inspector Focus/Remove.
- The repository-load command produced contradictory messaging: the city loaded,
  but the assistant said repository loading was unavailable. The local command
  result and assistant-visible authority/result must be reconciled.
- Operator pixels show every visible repository-city structure using the same
  bright cyan material while idle. Expected: normal source textures/materials by
  default, with cyan reserved for selected, active/worked-on, or focused state.
- Agent movement is a confirmed candidate regression on two paths. Aaron asked Mr
  Fluff to follow him in chat; Mr Fluff acknowledged the request but did not move.
  The direct `/agent move left 5` command also produced no displacement. Preserve
  the earlier accepted movement milestone as historical truth, but reproduce both
  exact transitions before inferring a cause.
- Durable screenshot:
  `/home/user/.hermes/runs/aiw-repository-city-manual-20260805T140129Z/operator-evidence/repository-city-uniform-cyan-operator.png`
  (`a8af2686caacfde0566c9fd2460f74fd18c8da2a9dcbb5ecc959d72a7e69e982`).
- No remediation or delivery authority is inferred. A later authorized correction
  should begin with focused REDs for idle material preservation and command-result
  truth, plus bounded reproductions of conversational `follow me` and direct
  `/agent move left 5` movement.
- The receipt-bound stopper closed candidate ports `43773/45187` and removed the
  candidate tmux session while retaining the unchanged 11-entry failed state at
  `/tmp/aiw-repository-city-manual-20260805T140129Z`. Protected services retained
  their recorded identities; `manual-fail-closeout.json` records the final proof.

## Safe correction-session launch contract — 2026-08-05 15:26 EDT

- Two attempted recovery turns later wedged before Codex launched. The final exact
  failure was isolated to Hermes terminal pre-execution scanning, not to the shell,
  Git, Node, or Codex: the gateway lifecycle guard classified the absolute
  `/home/user/.nvm/versions/node/v24.18.0/bin/node` executable as a referenced
  script and its remote fallback attempted to `cat` the 123,655,872-byte binary
  through Hermes Relay. No terminal start/completion event was recorded, inner and
  outer timeouts never became active, and gateway RSS jumped from roughly 397 MiB
  to 1.88 GiB.
- Do not invoke binaries by absolute path in gateway terminal commands or nested
  worker scripts. Pin the exact runtime with
  `PATH=/home/user/.nvm/versions/node/v24.18.0/bin:$PATH`, then invoke bare
  `node`, `python3`, `codex`, `tmux`, and `systemd-run`. The live safe-path probe
  returned Node `v24.18.0` and `safe-path-probe=pass`.
- Keep terminal calls serialized and small. Perform baseline/manifests with direct
  file tools or `execute_code` where practical. Launch the single bounded Codex
  worker only as a tracked background job with durable logs/report/inner-exit and
  completion markers, `notify_on_complete=true`, and its own hard deadline. Do not
  poll it and do not increase the gateway inactivity timeout.
- Current Hermes source checkout is clean at `1be70d63548845eb8918c08ed698cda0674cf9a7`.
  A non-destructive fetch found `origin/main` 72 commits ahead at
  `6564f319a647b47de391cab2f608660323804a2b`; upstream includes partial binary-NUL
  handling but still allows a large local binary to fall through to unbounded
  remote `cat`, so merely updating Hermes is not a proven fix. A core correction
  remains separate from this repository-city lane and would require its own tests
  plus gateway restart approval.
- No repository correction worker launched and no source correction began. The
  current repository remains 82 dirty paths (18 tracked, 64 untracked), zero staged,
  no upstream, with `git diff --check` green.
- The previously retained `/tmp/aiw-repository-city-manual-20260805T140129Z` root
  is now absent after the gateway/WSL resets. Do not claim it remains available.
  Persistent operator evidence remains under `~/.hermes/runs/`, including the
  screenshot, criterion-level verdict, movement clarification, and cleanup receipt.
  Begin the new correction session by freezing the current repository bytes into a
  fresh durable run directory; do not attempt to reconstruct or fabricate the lost
  ephemeral candidate state.

## Corrected operator retest and authorized final correction lane — 2026-08-05 17:47 EDT

- Aaron's first-hand retest accepted repository loading, normal idle source
  materials with bounded selected cyan, and Director placement.
- Before repository load, direct movement controls worked while conversational
  follow/self-directed movement did not produce displacement.
- After repository load, both conversational and direct movement failed. The live
  candidate's backend and same-origin World-action reads both returned
  `404 {"error":"World session is unavailable"}` for the current session.
- The successful repository load produced no truthful acknowledgement.
- Screenshot pixels show the Live Collaboration Relay intersecting/nested inside a
  larger repository gate asset.
- Ask Agent to Explain returned generic visual-family detail but could not resolve
  the selected opaque object to its real repository path or code meaning.
- Exact text, screenshot, criterion ledger, direct probes, and retained candidate
  state are frozen under
  `/home/user/.hermes/runs/aiw-repository-city-manual-corrections-20260805T204944Z/`.
- One Codex-orchestrated two-hour diagnosis/correction lane is authorized. Use
  exact RED reproductions, direct pragmatic fixes, and independent parent proof.
  Safely pause and prepare the end-session handoff at the deadline or a genuine
  product-decision gate. Do not stage, commit, push, release, publish, deploy,
  mutate protected services, or expand into unrelated phases.

## Final correction closeout and protected activation boundary — 2026-08-05 18:30 EDT

- The sole Codex worker exited `0` and persisted its final report under
  `/home/user/.hermes/runs/aiw-repository-city-final-corrections-20260805T215306Z/`.
- All five frozen slices are implemented in source: dynamic `current` World-action
  authority after repository selection; stale actor/helper-sequence conversational
  movement repair with queue-only truth; result-timed local repository acknowledgement;
  measured-footprint non-overlapping placement; and bounded path/relationship-aware
  Ask Agent prompts.
- Independent parent proof passed the production authority regression 3/3, correction
  aggregate 76/76, additional slice 14/14, plugin conformance 3/3, renderer/local-server/
  web build and type gates, lint/format/diff hygiene, 52/52 asset byte identity, and a
  fixture-backed production Chromium scenario 1/1. Browser proof remains technical
  evidence, not Aaron's manual acceptance.
- No replacement manual candidate was launched because the corrected Hermes plugin
  source is not installed/loaded in the protected active Hermes profile. Using the old
  loaded plugin would not truthfully validate the conversational movement slice.
- Activating the source plugin requires separate authority to install it into the
  protected default profile and restart/reload the Hermes gateway. That authority was
  explicitly absent. This is the genuine decision gate named in the stopping rule.
- Per Aaron's instruction, stop here without asking during the run and prepare the
  detailed end-session handoff. The next session must begin with an activation decision;
  if approved, use reversible plugin activation with hash/rollback receipts, then launch
  a fresh receipt-owned manual candidate and rerun the full criterion matrix.
- The worktree remains unstaged, uncommitted, unpushed, and not delivery-ready pending
  protected-plugin activation plus Aaron's first-hand manual PASS. Broad monorepo/full
  CI remains separate.
