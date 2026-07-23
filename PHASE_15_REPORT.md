# Phase 15 — Voice, Expressive Presence, and Consentful Agent Identity

**Status:** IMPLEMENTATION CANDIDATE VERIFIED / PHYSICAL-MICROPHONE USER ACCEPTANCE PENDING / PROVIDER UNACTIVATED

**Verified:** 2026-07-23

## Authority and outcome

The user froze Decisions 1–10 in `docs/PHASE_15_SCOPE.md`, accepted the separately verified `whisper.cpp` artifact result, and authorized exactly one bounded Phase 15 implementation. That implementation candidate is complete and independently parent-verified within the capabilities exposed to this WSL/Windows host.

Phase 15 is **not yet sealed complete**. The frozen exit gate still requires one user-accepted physical-microphone push-to-talk journey. This host exposes only one Windows HDMI output endpoint and no microphone endpoint. WSLg advertises `RDPSource`, but a bounded two-second input probe delivered no samples and blocked; the exact owned `timeout`/`ffmpeg` process pair was terminated and awaited, and no probe WAV remains. Deterministic browser capture, exact local-provider execution, canonical send, captions, TTS, interruption, recovery, visual, and cleanup proof are green, but none is mislabeled as a physical-microphone PASS.

The pinned provider remains staged and unactivated outside the repository. No release, publication, deployment, public ingress, visibility change, Hermes core/profile change, original-AgentIntersect operation, Phase 13 continuity retry, or Phase 16+ work occurred.

## Delivered vertical slice

1. Inspect exact provider/device/privacy disclosure.
2. Explicitly enable one browser-owned push-to-talk activation.
3. Hold Space or touch/pointer to capture one 16-bit PCM, mono, 16 kHz utterance.
4. Stop manually or automatically at 30 seconds / 4 MiB.
5. Show truthful final-only local-provider caption status; no lexical partial claim.
6. Edit the final transcript before send.
7. Send through the existing `AgentSessionGateway.sendText` path or cancel and zero the utterance.
8. Receive canonical Hermes text/captions under the exact session binding.
9. Optionally preview, select, consent to, persist, revoke, and use a browser/system voice.
10. Stop/barge into playback immediately.

The implementation adds:

- strict `@agentintersect-world/voice` capture, provider, attestation, transcript, preference, and redacted-operation contracts;
- a shell-free `whisper-cli` provider with exact realpath/hash/size re-attestation for the CLI/model/inventory and every current runtime-inventory member, one active process plus one bounded waiter, fixed argv, bounded output, timeout/cancellation, process-group termination, and awaited cleanup;
- app-owned temporary WAV/result lifecycle with no raw-audio or provider-payload persistence;
- local-server voice disclosure, state, preference, activity, transcribe, and canonical-send routes;
- bounded checksum-protected preference/activity/operation persistence: 256 KiB aggregate, newest 20 operations, seven-day retention;
- browser capture, capability-detected speech synthesis, opaque actual voice selection, natural-end/stop cleanup, automatic-ceiling handoff, and exact activity/recovery projection;
- one accessible ten-step World lane with numbered controls, persistent current/recovered status/results, keyboard/touch equivalence, reduced-motion/forced-colors/no-WebGL support, and explicit blue-enabled/grey-disabled control truth;
- deterministic stories, fixtures, contract/unit/integration/browser tests, constrained performance evidence, a mobile capture, and exact staged-provider evidence.

## Independent parent corrections

Parent inspection found and corrected only concrete supported-flow defects through focused RED→GREEN regressions:

1. automatic 30-second/4 MiB stops had discarded the completed WAV instead of handing it into transcription;
2. the live UI inherited fixture TTS availability instead of capability-detecting `speechSynthesis`;
3. consent persisted a hard-coded voice identifier without selecting or using the corresponding browser/system voice;
4. persisted capture/playback recovery activity existed in the store but was not wired through the API/client/product flow;
5. output-ceiling failure returned before the native provider process had completed bounded termination;
6. the Playwright recovery fixture lacked the new `/api/voice/state` contract;
7. forced-color enabled labels first became readable but mapped to a non-blue system palette; the final explicit palette is tested and visually inspected as blue enabled / grey disabled.
8. exact provider attestation trusted the pinned inventory-file digest without re-hashing every currently loaded runtime member; a disposable copied-tree mutation regression now fails unavailable;
9. browser cancel changed UI state without aborting the in-flight transcription request; cancel/unmount now propagate `AbortSignal` through the existing request-close provider cancellation path and ignore stale completion;
10. voice revocation left the previous voice selected and speech enabled until asynchronous persistence completed; revocation now clears the visible selection, stops playback, and disables canonical speech before persistence resolves, while persistence failure remains locally fail-closed;
11. the Node control microbenchmark mislabeled synthetic state/WAV operations as real capture/STT/TTS and inferred provider availability from an environment variable; it is now explicit non-acceptance supplemental evidence backed by real provider attestation, while real browser/provider timings remain separate.

A final blocker-only independent re-review verified PH15-001 through PH15-004 resolved on the exact staged candidate and reported no introduced critical finding.

## Verification — final post-correction era

### Repository gates

- Node `v24.18.0`; pnpm `11.15.0`.
- literal `pnpm check`: PASS.
- formatting: PASS.
- ESLint: PASS.
- TypeScript: PASS across all workspaces.
- architecture guardrails: 11/11 PASS.
- Phase 15 conformance: 39/39 PASS.
- complete Vitest: 93 files, 512/512 tests PASS.
- production build and smoke: PASS.
- complete Playwright: 41/41 PASS.
- Storybook: 17/17 tasks and static build PASS.
- production advisory audit: no known vulnerabilities.
- fresh-copy verification: PASS for 452 project source files, including 512/512 tests and 41/41 browser tests.
- static added-line scan: no credential, dangerous eval/deserialization, shell-execution, debug-log, or personal-absolute-path finding; the sole raw regex hit was benign `RegExp.exec()` used to parse `/proc` RSS.

### Exact staged provider

`exercise:phase15:provider` ran the exact staged `whisper.cpp` v1.9.1 English `base.en` provider through the production adapter:

- exact expected transcript match: “Voice input remains editable before sending.”;
- elapsed: `662.074746 ms` against a 2,000 ms target and 10,000 ms hard ceiling;
- peak RSS: `299,655,168 bytes`;
- result output: `3,689 bytes` against a 1 MiB ceiling;
- staged inventory: 53 regular files / 185,119,961 bytes / zero symlinks;
- exact runtime, model, model-size, and inventory-file hashes matched, and all current runtime members matched their pinned path/hash/size/mode entries;
- shell disabled; fixed argv; CPU-only; English-only; no listener;
- source WAV and app-owned temp root removed;
- zero residual `whisper-cli`, `whisper-server`, provider listener, or raw-audio file.

Structured evidence: `artifacts/phase15/phase15-live-provider.json`.

### Performance

Supplemental Node control evidence (`artifacts/phase15/phase15-core-performance.json`) is explicitly marked `acceptanceEvidence: false`. It measures deterministic in-process control primitives only—not microphone capture, native STT, or browser speech synthesis:

- synthetic capture-state transition p95 `0.001082 ms`, max `0.009908 ms`;
- synthetic WAV encode/binding/zeroing p95 `0.17588 ms`, max `1.895381 ms`;
- synthetic TTS state transition p95 `0.001402 ms`, max `0.027351 ms`;
- synthetic stop-playback state transition p95 `0.000722 ms`, max `0.045355 ms`;
- incremental control-path heap `0.760223 MiB`;
- retention projection 20 operations / 2,293 bytes ≤ 20 / 262,144 bytes.
- provider capability was obtained from successful exact attestation, not inferred from environment-variable presence.

Browser mobile/two-CPU/reduced-motion/forced-colors/no-WebGL evidence (`artifacts/phase15/phase15-browser-performance.json`):

- browser-reported hardware concurrency: exactly `2`;
- capture visible response `16 ms` ≤ 250 ms;
- request-to-speaking `81 ms` ≤ 1,000 ms;
- stop visible response `45.4 ms` ≤ 100 ms.

Only the browser fixture and exact real-provider exercise support their labeled acceptance timings. The supplemental Node control microbenchmark is retained for regression diagnostics and does not claim real-provider percentile latency.

### First-hand browser and visual proof

Parent directly exercised the complete production-built Playwright journey and inspected `artifacts/phase15/phase15-voice-mobile.png` after the final CSS build. The final capture has:

- all ten numbered steps and the voice selector readable, including the explicit post-revocation “No voice selected” state;
- persistent current/recovered and `voice_result_` status reachable;
- active primary controls blue with visible white labels;
- disabled controls grey with visible labels, including post-revocation speech;
- no horizontal overflow, clipping, unreachable status/results, or remaining concrete visual defect;
- zero serious/critical axe violations.

This is deterministic browser/operator proof, not a physical-microphone claim.

## Retained evidence

- `artifacts/phase15/phase15-core-performance.json`
- `artifacts/phase15/phase15-browser-performance.json`
- `artifacts/phase15/phase15-live-provider.json`
- `artifacts/phase15/phase15-voice-mobile.png`
- `artifacts/phase15/stt-provider/` sanitized provenance evidence
- `docs/PHASE_15_STT_PROVIDER_PIN.md`
- `docs/PHASE_15_STT_ARTIFACT_REPORT.md`

No runtime/model binary, raw WAV/audio, raw provider payload, credential, absolute home path, provider process, listener, or activation marker is retained in the repository.

## Remaining gate

1. On a host with a real browser-visible microphone, inspect the disclosure and complete one physical push-to-talk utterance through edit/send/canonical reply/optional TTS/stop.
2. The user explicitly accepts that journey and provider/privacy disclosure.
3. Record the acceptance in project status and seal Phase 15; Phase 16 remains separately gated.

Private commit/push and exact-SHA CI may verify this implementation candidate before that user acceptance, but they do not substitute for it or authorize provider activation.
