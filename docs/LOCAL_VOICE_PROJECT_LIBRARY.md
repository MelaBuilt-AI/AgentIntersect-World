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

Scope frozen; implementation in progress. This document is not a completion or acceptance claim.
