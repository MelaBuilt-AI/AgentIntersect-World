# Local voice setup and saved-project library

## Authorized scope — September 17, 2026

Aaron1550163615531794464 authorizes one new private PR and direct implementation. Base: main80a992c. No merge, release, publication, gateway changes or modification of retained operator tests is authorized. Development uses a separate normal Git worktree because the original checkout supplies live retained runtimes.

### Voice

- Correct the quick-click/no-recording case with exact text: `Nothing recorded. Left click and hold while talking.` Do not misclassify unrelated provider errors as silence or disclose internal file paths.
- Preserve left-button hold/release recording and keyboard accessibility.
- Right-click once starts hands-free recording. The caption surface exposes Send and Cancel. Send finishes capture/transcription and sends that explicitly accepted utterance once; it exits hands-free mode. Cancel discards capture/transcription and exits. The next hands-free session requires a new right-click. Preserve bounded audio duration/size, cancellation and no stale sends; no automatic re-arming. The local provider remains final-caption-only, not claimed streaming partials.
- Optional first-run Local voice setup plus an accessible later setup action: explicit install consent, immutable official runtime/model pins, safe private installation, exact-byte verification, durable activation, reusable readiness and honest unsupported/offline/failure states. No hidden package-manager postinstall, cloud transcription fallback, microphone permission or recording without user action.
- Support and test Linux x64 and native Windows x64 providers separately; browser on Windows + backend on WSL is not native Windows World acceptance. macOS/other architectures remain explicitly unsupported until verified artifacts exist. Native Windows integration failures must remain reported, not be papered over by WSL results.

### Saved projects

- Load Repo is a durable library of projects opened/worked on through World, not a filesystem-wide repository scanner or short recent-only cache.
- Show project identity/location, availability, latest saved work and meaningful work/Git milestones. Preserve unfinished and uncommitted work and conversation references, not only completed work.
- Explicit project selection/Resume reuses repository, saved Workstream, owned worktree, session/history and approved-preview recovery through existing authorities. Loading alone never dispatches coding. New Workstream remains separate.
- Prefer explicit project resumption over forced repository loading on World entry. Restore agent identity independently; optional failure must not destroy accepted sessions.
- Record completed-work and explicit Git checkpoints/commits as milestones. They describe saved truth; no automatic commits, destructive checkout, reset or historical-file rollback. Existing worktree/files remain authoritative.

### Verification and delivery

Focused RED→GREEN tests per behavior, affected type/lint/build gates, built-browser proofs and real provider installation/readiness/transcription. Run a native Windows backend/provider smoke independently of WSL and prepare manual Windows acceptance when available; no inferred full native-harness acceptance. Preserve all source residuals and TEST45365/45363/45353/45351 state and served builds. Open draft PR first; commit/push verified implementation and report exact CI state. Human microphone/visual acceptance remains separate.

## Implementation sequence

1. Voice short-input regression, hands-free capture/send/cancel UI and tests.
2. Pinned platform-aware provider provisioning, runtime default resolution, setup API/UI, tests and real installation smoke.
3. Durable project catalog/milestones and explicit Resume UI using existing Workstream continuation.
4. Integrated/browser/native Windows checks; docs/status; final PR update and exact-head CI.

## Status

Implementation complete in the PR worktree; private draft PR #15 remains unmerged. Local verification passed; remote CI is reported on the exact PR head rather than inferred from these local results. Human microphone and full native Windows harness acceptance are still separate.

## Delivered behavior

- Left hold/release and keyboard PTT remain supported. A too-short recording shows the exact no-recording message above. Right-click starts one hands-free capture; Send finishes and dispatches once, Cancel discards, neither rearms.
- **Local voice setup (optional)** appears in first-run Agent Setup and remains reachable through the later Agent Setup menu. Opening setup only reads readiness. Installation requires its own checked consent. It does not request microphone permission, enable voice, or change the agent/harness setup.
- The managed provider defaults to a private versioned directory under `$XDG_DATA_HOME/AgentIntersect-World/voice` (fallback `~/.local/share`) or `%LOCALAPPDATA%\AgentIntersect-World\voice`. `AIW_LOCAL_VOICE_DIR` overrides this directory for isolated tests. Existing `AIW_PHASE15_STT_PROVIDER_ROOT` remains an explicit legacy-provider override; remove that override to use the managed install.
- Official whisper.cpp **v1.9.1** Linux/Windows x64 CPU artifacts and English `base.en` model revision **5359861c739e955e79d9a303bcbc70fb988958b1** are pinned by size and SHA-256. Exact runtime member/license inventories are in `packages/voice/src/runtime-pins.ts`; model pins are in the declared Node-only voice entrypoint. Only the CLI and its allowlisted runtime/license files are materialized. Approved Linux shared-library aliases become regular files. No bundled server, PATH change, package postinstall, cloud fallback, or automatic version update.
- Downloads stage privately, verify before activation, and are cleaned on failure. New provider instances discover the verified versioned installation. Existing damaged installations are not overwritten in place; setup reports that explicit repair is required. macOS/non-x64 show unsupported and leave typed chat available.
- The saved project catalog no longer evicts the oldest unpinned entries after 50 opens. It reports missing/unavailable directories without removing them, shows saved Workstreams including dirty work and native conversation references, and combines retained Workstream milestones with durable explicit Git checkpoint/commit milestones.
- **Open project** loads only the selected repository. **Resume saved work** requires confirmation, verifies the saved agent/native root, reuses existing continuation/worktree/preview authority, restores the conversation, and never sends a coding turn. An unavailable saved session is not silently replaced. In multi-agent World, reconnect the saved agent to the constellation first. New Workstream is separate.
- Normal refresh restores accepted agent identity/history into a blank World; repository selection is explicit through Load Repo. No automatic commit, reset, checkout, or historical rollback was added.

## Verified locally

- Full unit/integration suite: **215 files, 1,319 tests passed**.
- Repository-wide formatting, lint, typecheck, architecture, build, and smoke passed. The architecture gate caught the installer in browser-reachable source; it now lives in the existing declared Node-only entrypoint rather than weakening the gate.
- Built-browser checks: optional setup consent/no microphone, existing grouped PTT, hands-free Send/Cancel/no rearm, project intake, saved-work/preview/library Resume with zero coding requests, and identity-only refresh passed. Library screenshots were inspected at desktop and portrait sizes; human acceptance remains pending.
- Fresh Linux x64 and **native Windows x64 Node 24.18.0** Fastify setup/provider smokes both went from not-installed to ready, rejected missing consent, remained ready from a new installer instance, transcribed the public sample, and left zero volatile audio files. Sanitized measurements: `artifacts/pr15/local-voice-smoke.json`.
- Windows proof used an isolated portable official Node executable and bundled the tracked smoke with its actual route/provider dependencies. It did **not** run a Windows browser against WSL as a substitute for native backend proof. It is not full Windows World/harness acceptance and makes no Windows peak-RSS claim.
- No changes to the original live checkout, retained TEST45365/45363/45353/45351 sessions/builds, gateway configuration, repo visibility, or release state.

## Human acceptance checklist (not yet performed)

Use a fresh disposable app-state directory and unused ports; do not repoint retained operator lanes. Build this PR, start the backend with native Node on the target OS, and confirm its setup response reports that OS before testing.

1. Open optional Local voice setup. Decline/leave consent unchecked: no download and no microphone prompt. Consent and install, then restart the backend and confirm ready.
2. Enable voice separately. Quick-click PTT: exact no-recording message. Hold and speak: final caption. Right-click and speak: Send transcribes/sends once and stops; Cancel sends nothing and stops. No streaming-caption claim.
3. Load a disposable project, start work, and leave uncommitted changes. Refresh: identity/history return but the floor starts blank. Load Repo shows the saved project, path, availability, dirty work and conversation.
4. Confirm Resume: same Workstream/worktree/native conversation, unfinished file bytes preserved, approved preview recovery attempted, no coding turn. Explicit checkpoint/commit adds a milestone. A missing project or disconnected saved session fails visibly without deletion/replacement.
5. Run that complete browser/harness path separately on native Windows before claiming full Windows product acceptance. Backend/provider smoke alone does not close this gate.

The bounded provider smoke is `apps/local-server/scripts/exercise-local-voice.ts`, taking a private install directory and a plain 16-kHz mono PCM16 English test WAV. It uses an ephemeral loopback port and always closes its server.
