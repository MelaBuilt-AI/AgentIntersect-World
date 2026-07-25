# Phase 15 — Frozen Decision Scope

**Status:** USER ACCEPTED / SEALED / COMPLETE / PROVIDER STAGED AND UNACTIVATED

**Prepared:** 2026-07-22

**Planning baseline:** clean private `main` at `bbc2ea32cc40bac609ad20d0c8e85b9870888589` before this planning/provenance-only update. The preceding CI maintenance at `dba11b88f92d90df718d2068d98110d35201d296` remains green under exact-SHA GitHub Actions run `29966798446`, job `89079968383`, with zero annotations.

**Authority:** On 2026-07-22 the user accepted the artifact result and explicitly authorized exactly one bounded Phase 15 implementation under frozen Decisions 1–10. The implementation candidate and independent parent proof were green before the final gate. On 2026-07-24 the operator completed and explicitly accepted the real Microsoft Edge physical-microphone journey recorded in `artifacts/phase15/physical-microphone-acceptance.json`, then selected **“Seal Phase 15 now.”** Phase 15 is user accepted, sealed, and complete. The verified provider remains staged and unactivated outside the repository; this acceptance used only explicit bounded staging-root configuration after exact re-attestation and did not promote or activate it. The historical 2026-07-23 choice to carry the gate as pending is now superseded only by this acceptance. Phase 13 remains failed/deferred under its waiver; provider promotion or activation, release, publication, deployment, visibility change, original-AgentIntersect operation, and Phase 18+ remain closed pending separate authorization.

## Inherited baseline and authority boundary

- Phase 14 remains the complete, accepted baseline with its existing retained evidence, independent parent proof, private push, and exact-SHA CI closeout.
- The Phase 13 live Discord → World continuity gate remains separately failed/deferred under waiver. It is excluded from Phase 15 and must not be retried, simulated, or described as green here.
- Structured session, text, provider, and device state is authoritative. Voice and avatar motion are presentation only and cannot approve tools, mutate repositories, or bypass typed-message permissions.
- AgentIntersect World remains a local/same-operator or trusted-LAN product. The initial voice slice is narrower and uses local/loopback-only STT.
- Text remains independently usable when capture, transcription, synthesis, playback, animation, or WebGL is unavailable.

## 1. Canonical vertical slice and authority

**Decision: APPROVED AND FROZEN — 2026-07-22**

**Recommendation:** Freeze exactly one existing Phase 12 Hermes-backed session and one numbered journey:

1. inspect provider/device disclosure;
2. explicitly enable the microphone;
3. push and hold to talk;
4. stop capture;
5. see bounded partial and final captions;
6. edit the final transcript;
7. send or cancel;
8. receive canonical text and captions;
9. optionally play the spoken reply;
10. interrupt or stop playback.

The accepted transcript is sent through the same `AgentSessionGateway.sendText` path and the same session, mode, and permission checks as typed text. The Hermes text transcript remains canonical. Voice, captions, avatar motion, provider output, and presentation state have no tool, edit, approval, or permission-bypass authority.

## 2. Capture consent, device, format, and hard bounds

**Decision: APPROVED AND FROZEN — 2026-07-22**

**Recommendation:** Require an explicit user gesture for every activation and valid browser permission, while truthfully disclosing whether the browser retained that permission. Support push-to-talk only: no always-on microphone, wake word, or background capture.

Allow one active capture. Each utterance stops locally at 30 seconds or a 4 MiB encoded-payload ceiling, whichever occurs first, with truthful status and no silent retry. Device choice is explicit and owned by the local browser. Raw device labels are never presentation-synchronized.

The implementation freeze must pin the accepted browser capture formats and truthful unsupported-format behavior without weakening either hard ceiling.

## 3. STT provider boundary and initial baseline

**Decision: APPROVED AND FROZEN — 2026-07-22**

**Recommendation:** Define a strict versioned STT provider interface and deterministic fake provider/audio fixtures for tests. The first real provider baseline is local/loopback-only STT; cloud STT is excluded from the initial slice.

Before implementation, separately pin and approve the exact local runtime, model, version, license, files, hashes, and download policy. If the runtime or model is unavailable or mismatched, report the capability as unavailable and keep text usable. Do not depend on browser or operating-system `SpeechRecognition` privacy assumptions.

The approved exact runtime/model pin and provisioning policy are recorded in `docs/PHASE_15_STT_PROVIDER_PIN.md`. The bounded artifact download, safe inventory, exact hash verification, offline synthetic quality/performance benchmark, cleanup, and limitations are recorded in `docs/PHASE_15_STT_ARTIFACT_REPORT.md` and structured evidence under `artifacts/phase15/stt-provider/`. The user accepted that artifact result and authorized the bounded implementation candidate now verified in `PHASE_15_REPORT.md`. The provider remains staged and unactivated; the physical-microphone user-acceptance journey, promotion, and every later gate remain closed.

## 4. Transcript lifecycle and session binding

**Decision: APPROVED AND FROZEN — 2026-07-22**

**Recommendation:** Treat partial captions as volatile and visibly non-final. Make the final transcript editable before send. Cancel discards the utterance. Send binds the exact session, mode, permission revision, and capability hash, then re-attests those bindings immediately before the normal text-send path.

Persist only accepted text as an ordinary bounded World/Hermes message projection. Raw audio, partial captions, rejected or cancelled transcripts, and provider debug payloads remain non-persistent and are never presentation-synchronized.

## 5. TTS baseline, playback, and barge-in

**Decision: APPROVED AND FROZEN — 2026-07-22**

**Recommendation:** Use optional browser/system `speechSynthesis` as the initial TTS baseline, capability-detected and truthfully labeled. Captions and canonical text never depend on synthesis. Do not claim browser/system speech is local unless the platform proves that; disclose implementation and provider uncertainty.

Allow one playback at a time. Keep a stop control always reachable, make a new capture stop playback immediately, and prohibit autoplay. Playback failure leaves canonical captions and text intact.

## 6. Provider/device/privacy disclosure and data boundary

**Decision: APPROVED AND FROZEN — 2026-07-22**

**Recommendation:** Before activation, show the provider, local/external status, selected device, data sent, retention claim and its source, current availability, and whether raw audio leaves the machine.

The initial slice has no external provider, provider account, credential, raw identity/memory/persona export, presentation-synchronized audio, analytics, or cloud retention. A future external provider requires separate explicit configuration and consent and must never be selected silently as a fallback.

## 7. Consentful agent voice/avatar identity

**Decision: APPROVED AND FROZEN — 2026-07-22**

**Recommendation:** Allow an agent to propose a voice/avatar mapping only from a bounded, explicit self-description/proposal record. Never infer it from memory, transcript, biometrics, a private profile, hidden reasoning, or emotion detection.

The user previews and explicitly accepts, changes, declines, or revokes the mapping per agent. Do not support voice cloning. Persist only the approved opaque voice ID, and disable its use immediately on revocation. Reuse the existing shared rig and action vocabulary; Phase 15 adds no rig, model, or art pipeline.

## 8. Semantic operator flow, captions, and truthful expression

**Decision: APPROVED AND FROZEN — 2026-07-22**

**Recommendation:** Use numbered controls with persistent status and results. Enabled primary controls are blue and disabled controls are grey. Label current versus previous state and provider truth explicitly.

Provide keyboard, touch, screen-reader, reduced-motion, forced-colors, mobile, and no-WebGL/text-only equivalence. Derive listening, speaking, typing, and activity states only from authoritative capture, playback, and session events. States are color-independent and never claim emotion or success.

## 9. Persistence, recovery, performance, and resource limits

**Decision: APPROVED AND FROZEN — 2026-07-22**

**Recommendation:** Persist only bounded consent/preferences, opaque provider/voice IDs, and redacted operation summaries. Cap the aggregate voice settings/history projection at 256 KiB and retain the newest 20 operations for at most 7 days.

Raw audio, partial captions, and provider payloads are memory-only and released on stop, cancel, or failure. After restart, mark capture or playback as interrupted and never resume microphone capture or speech automatically.

Inherit the Phase 13 render, cadence, and long-task budgets. Add these recommended targets and limits:

- capture-control response: at most 250 ms;
- local STT stop-to-final: target at most 2 seconds and hard timeout 10 seconds for a 30-second clip;
- TTS request-to-speaking: target at most 1 second and hard timeout 5 seconds;
- stop/barge-in visible response: at most 100 ms;
- incremental heap: at most 32 MiB.

Retain raw samples and capability-aware profiles. Do not weaken thresholds for CI.

## 10. Acceptance evidence, delivery gate, and explicit exclusions

**Decision: APPROVED AND FROZEN — 2026-07-22**

**Recommendation:** Require deterministic RED→GREEN fixtures plus first-hand local microphone/operator proof. Cover permission denied/no device, unavailable or mismatched local provider, size/time ceilings, partial/final/edit/send/cancel, exact-session re-attestation, TTS unavailable/failure, interruption, reload/restart, secret/persona canaries, accessibility/mobile/no-WebGL equivalence, cleanup, latency, and resource evidence.

Closeout requires impacted suites, one full `pnpm check`, Storybook, production advisory audit, fresh-copy verification, inspected visual evidence, a clean worktree, private push, exact-SHA CI, and explicit user acceptance of one complete push-to-talk journey and its disclosure.

Explicitly exclude:

- always-on microphone, wake word, background capture, emotion detection, and biometric detection;
- voice cloning and cloud STT/TTS in the initial slice;
- raw audio persistence or synchronization;
- public ingress, unrelated users, spatial voice, and multiple simultaneous voice agents;
- arbitrary tool, edit, approval, or repository-mutation authority;
- the Phase 13 continuity retry and all Phase 16+ work;
- releases, publication, deployment, and visibility changes;
- Hermes core/profile changes and original-AgentIntersect changes.

## Decision-freeze gate

Decisions 1–10 and the exact STT pin remain frozen. The artifact result, bounded implementation, independent proof, real physical-microphone journey, exact-session canonical reply, optional browser/system TTS, cleanup, and explicit user acceptance are complete. Phase 15 is sealed. The provider remains staged and unactivated; provider promotion/activation and every non-goal remain closed.
