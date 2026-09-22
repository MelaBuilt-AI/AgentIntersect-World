# Phase 18 correction parent-verification report

Generated: `2026-07-25T17:54:46Z`

## Scope and verdict

All seven first-hand correction families were implemented and parent-verified:

1. Human and cat avatars use canonical floor grounding.
2. The controlled avatar heading follows camera yaw while other agents remain independent.
3. Camera look is active only while the right mouse button is held over the canvas; release, blur, visibility loss, pointer cancel, and window pointer-up clear it.
4. Horizontal and vertical mouse directions match natural view directions.
5. Transcript and composer use one responsive bottom anchor.
6. All four harness buttons move farther outward while preserving responsive containment and connector pairing.
7. The selected World avatar name propagates through browser, local server, and the real Hermes adapter; no production `Hello Mela`, `Hello Aaron`, or `Hello Riley` greeting is hard-coded.

Parent verdict: **verified candidate awaiting private exact-SHA CI and Aaron's first-hand acceptance**. Phase 18 is not accepted or sealed. Revised Phases 19–20 remain closed.

## Parent corrections to delegated output

The implementation worker completed successfully, but parent inspection found and corrected two delivery blockers:

- `userDisplayName` reached `AdapterTurnContext` but was discarded by the real `HermesSessionAdapter`. A focused RED test proved the upstream `/chat/stream` request lacked the selected name. Production code now validates the name as a bounded identity label and appends it to `system_message` as quoted data, not an instruction.
- The first complete `pnpm check` failed on Prettier for four touched files. Only those files were formatted, then focused and complete gates were rerun.

## Automated verification

Runtime: Node `v24.18.0`, pnpm `11.15.0`, `NODE_OPTIONS=--max-old-space-size=3072`, `TURBO_CONCURRENCY=1`.

- Focused post-format Vitest: **54/54 passed**.
- Production build: **20/20 workspace builds passed**.
- Targeted World-entry Playwright: **8/8 passed**.
- Playwright project listing: **7 normal/headless tests + 1 isolated headed right-drag test**.
- Complete pinned `corepack pnpm@11.15.0 check`: **exit 0**, including format, lint, typecheck, architecture, unit tests, build, smoke, the 53-test browser aggregate, and the unflagged fail-closed browser lane.
- Exact pre-aggregate CI command trio—`measure:phase10`, `avatar:verify`, and `measure:phase11`—completed with **exit 0**. Phase 11 reported **2/2 passed**, frame p95 **16.8 ms**, and longest task **0 ms**.
- Fresh independent read-only review: **passed**, with zero blocking findings, security concerns, or logic errors. Its two optional suggestions were additional adversarial display-name boundary tests and later cleanup of stale pointer-lock labels; neither changes supported runtime behavior.
- `git diff --check`: passed.
- Added-line scans: no hard-coded secrets, dangerous execution/deserialization, debug/test suppression, or production hard-coded user greetings.

## Live Hermes Sessions API proof

A disposable, loopback-only Hermes home was created from a SQLite-consistent snapshot of the current default session store. The AgentIntersect World plugin was installed only in that temporary profile. The active default Discord gateway was not restarted or modified.

- Product path: normal `/`.
- Hermes listener: temporary `127.0.0.1:8642`.
- World local server: temporary `127.0.0.1:3770`.
- Built web origin: temporary `127.0.0.1:5173`.
- Exact native session reference SHA-256: `5ceb932ff8f4727b9c11505fd75d98309fcd2c0a02b327b5b7bc5cd14aceaca1` (raw session identifier intentionally omitted).
- World continuity: `Current`.
- Selected name `Aaron` produced live final text: `Hello, Aaron!`
- Selected name `Riley` produced live final text: `Hello, Riley!`
- The live normal `/` journey displayed Aaron as the user avatar and Mr Fluff as the connected cat/Hermes avatar in the corrected blank room.

Cleanup proof:

- Temporary Hermes home and profile-change transaction directory removed.
- Temporary requests, SSE responses, and local state removed.
- Ports `8642`, `3770`, and `5173` verified free.
- Default Hermes `config.yaml`, `.env`, `auth.json`, and `SOUL.md` matched their pre-run SHA-256 values.
- Default supervised Discord gateway remained healthy on its original PID.

## Visual and artifact audit

Every refreshed Phase 18 PNG was visually read back, including first launch, returning identity, avatar creator, blank room, repository floor at desktop/large/mobile sizes, held-right-drag evidence, no-WebGL fallback, and the two new outward-constellation captures. The four authoritative user-retest screenshots remain untouched.

The retained Playwright trace contains eight expected entries. A binary archive scan found zero occurrences of authorization headers, bearer credentials, API key/token/password markers, developer home paths, or the live session identifier.

Trace SHA-256: `21efed26770378c09e26f3a9ac77188efbf3c801e0213271c75e4368365c650a`.
