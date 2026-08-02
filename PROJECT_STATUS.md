# AgentIntersect World — Project Status

Updated: 2026-08-02

## Current milestone

### 2026-08-02 imported-avatar acceptance corrections — TECHNICALLY VERIFIED; OPERATOR RETEST PENDING

Aaron first-hand tested private candidate
`b8e787b49813d939f998cccec6a19ede1a57501c` and reported two authoritative
manual acceptance failures. Typing each character of the user-avatar name reset
the active 3D preview to its T-pose, repeatedly interrupting its animation. After
attaching Hermes / Mr Fluff, the product reported `agent connected` but exposed no
Enter World control; refreshing still did not expose one. No screenshot or video
accompanied the report. The failed disposable state was hash-frozen and retained,
only the two owner-validated candidate services were stopped, and protected
services remained untouched.

The animation reset was caused by fresh empty `importedParts` and `hiddenPartIds`
arrays being created on every `AvatarPreview` render. Name input therefore changed
renderer dependency identity, rebuilding the imported scene/mixer and restarting
its clip. Module-stable empty defaults now preserve renderer identity when only the
name changes. The World-entry dead end retained explicit avatar consent but made it
invisible: pre-consent Enter World was absent, and refresh rejected a healthy exact
session solely because consent was pending. The avatar gate now shows a prominent
disabled Enter World control with the exact `Use Complete Avatar` then `Accept and
save avatar` unlock steps. Refresh resumes pending avatar creation only when the
proposal, session, authoritative history, transcript authority, and continuity all
bind exactly; mismatches continue to fail closed.

Focused regressions failed RED for changing renderer dependencies, the absent
entry gate, pending-session refresh, and continuity mismatch before passing GREEN.
Impacted Vitest passed 56/56 before the final fail-closed hardening. Final
`check:core` passed Prettier, ESLint, TypeScript 38/38, architecture 11/11,
functional Vitest 127 files / 752 tests, builds 20/20, and smoke. The rebuilt
non-evidence Playwright journey passed 1/1 in 10.6 seconds, including disabled gate,
refresh-before-consent, explicit complete-avatar selection, enabled Enter World,
and full fixture-backed World entry. Historical evidence was not run, rewritten,
or rebound.

No operator PASS is claimed yet. A fresh disposable matching candidate must be
relaunched for first-hand retest of both reported failures. No PR, merge, tag,
release, publication, deployment, visibility change, gesture inference, Phase
18.5 evidence recapture, or Phase 19–20 work is authorized by this correction.

### 2026-08-01 Phase 18.5 Option 2 split — SELECTED; CURRENT IMPORTED ACCEPTANCE INPUT CONTRACT AUTHORIZED

Aaron selected the bounded Option 2 architecture on 2026-08-01 local / 2026-08-02
UTC. Durable repository visual grammar, semantic DOM/no-WebGL/reduced-motion/
context-loss truth, and the shared measurement methodology with unchanged
thresholds remain Phase 18.5. Generated modular-avatar product acceptance and
the July 26 native results remain historical for their exact inputs; the old kit,
base/migrated profiles, and mixed imported/custom sessions remain supported
compatibility paths. Current imported-avatar acceptance is a separately versioned
track governed by `docs/PHASE_18_5_OPTION_2_SCOPE.md`.

The current automatic policy for this bounded track is deterministic functional
and input-contract proof only. Native evidence remains explicit/manual and absent
until separately approved. No historical evidence rewrite or rebind, compatibility
sunset, gesture inference, deferred movement/intake/browser repair, Phase 19/20
work, dependency change, or external delivery is authorized.

### 2026-08-01 complete-avatar semantic closeout and agent movement — TECHNICALLY VERIFIED; HUMAN GESTURE REVIEW OPEN

Aaron's first-hand animation run remains the authoritative trigger: Walk and Run
were correct, while Jump, `/dance`, and `/laugh` exposed semantic contradictions.
The closeout therefore does not preserve the old structural 276/276 claim as
semantic acceptance. Deterministic investigation found no authoritative source,
provider metadata, glTF field, export record, or retained evidence that maps the
anonymous gesture clips to their intended meanings. The semantic authority now
records 69 reviewed locomotion passes and 207 ambiguous gesture decisions across
23 models; every unresolved gesture fails closed at runtime rather than using a
plausible substitute.

Actor-local animation arbitration and bounded World-owned agent movement are
implemented. Locomotion cancels that actor's one-shot, a newer valid slash or
stationary cue supersedes the older generation, stale completion callbacks cannot
clear newer state, and a cancelled action does not resume. Validated movement
supports bounded coordinates, relative directions, follow/approach, interruption,
user-directed priority over autonomy, truthful arrival/refusal/cancellation, and
a stable repository-object seam that fails closed when identity or layout
resolution is stale or unavailable. The normal product projects exact local
`/agent move`, `/agent follow`, and `/agent stop` commands through the existing
validated proposal/interrupt authority instead of parsing arbitrary assistant
prose into transforms.

Independent Node 24 parent proof passed Python 15/15, the real loopback Chromium
annotation viewer 1/1, required Vitest 4 files / 30 tests, functional Vitest
125/125 files / 738/738 tests excluding only the separately paused Phase 18.5
fingerprint validator, TypeScript 38/38, architecture 11/11, build 20/20,
ESLint, targeted Prettier, deterministic 23/23 GLB inspection, Git LFS `fsck`,
diff hygiene, and durable-text safety. One initial 10-second Vitest timeout was
classified as ambient I/O pressure: the underlying inspector passed five direct
runs, the exact isolated test passed three consecutive runs under the original
timeout, and the unchanged required four-file command then passed 30/30.

The generated human-review package remains at 0/207 and contains 23 deterministic
one-model batches covering all 417 raw non-locomotion clips exactly once. It
supports full-document checkpoints and resume without embedding reviewer answers,
semantic hints, or fabricated progress. Strict validation and proposal generation
remain impossible until all 207 decisions are complete and independently reviewed.
No semantic annotation was performed during the technical closeout.

The private checkpoint candidate intentionally excludes the same 199 inherited
partial/superseded evidence and operational-plan paths from the prior accepted
checkpoint boundary. The current checkpoint is technically ready for private Git
delivery, but it is not a release candidate or a semantic-acceptance seal. The
existing GitHub Actions workflow consumes the frozen Phase 18.5 hardware evidence in
three fail-closed jobs: `core` runs the unfiltered validator, `measurements` runs
`avatar:verify`, and `e2e-phase18-5` validates the same evidence on software-renderer
runners. Those jobs are expected to remain red after push until Phase 18.5 is
separately resumed and remeasured or a separately approved CI-policy change preserves
it as an explicit manual lane. The unaffected functional and browser lanes remain the
checkpoint readiness signal. Exact-SHA workflow results belong in the external
delivery receipt rather than a self-referential status commit.

The prior failed disposable candidate was owner-checked and cleaned. Candidate
ports `45181/43771` remain closed, protected `3770/5173/8642/18789` retain their
preserved identities, and no mutating worker or temporary annotation server
remains. Fresh first-hand testing of the unresolved gestures and the new agent
movement experience is still pending. No PR, merge, tag, release, publication,
deployment, Phase 18.5 evidence rebind, or Phase 19–20 work is authorized by this
checkpoint.

### 2026-08-01 complete-avatar blank-screen correction — reported blockers OPERATOR ACCEPTED

Aaron authorized one bounded remediation after the 2026-07-31 manual operator
failure. The proven root cause was an invalid transition between two intentional
validation levels: the Builder permits an empty required name while the operator is
still choosing an avatar, but `selectImportedAvatarModel()` parsed that in-progress
draft with the stricter persistable-profile parser. Clicking `Use Complete Avatar`
before entering a name therefore threw `TypeError: Invalid replacement avatar draft`
inside React's state updater and unmounted the root.

The production correction is one line: complete-avatar selection now uses the existing
in-progress Builder parser. Final profile/Save validation remains strict. Focused unit
and browser regressions first failed RED with the exact exception/page error, then
passed GREEN. Independent parent proof passed the corrected direct causal probe while
keeping the empty-name draft non-persistable, impacted Vitest 29/29, TypeScript 38/38,
serial functional Vitest 709/709 excluding only the deliberately stale Phase 18.5
hardware-evidence validator, the isolated 23-asset intake 4/4, production build 20/20,
targeted ESLint/Prettier/diff hygiene, and the built-browser blank-screen regression
1/1. The unfiltered suite honestly passed 715/716; its sole failure was the expected
fail-closed Phase 18.5 production-input fingerprint, which was not rebound while that
phase remains paused.

A fresh matching disposable candidate was served at `http://127.0.0.1:45181/` with
backend `127.0.0.1:43771`. Owner receipts bound the listeners to candidate PIDs 495073
and 495023 respectively; direct/frontend/proxied health was 200/200/200. The candidate
used a byte-verified clone of exactly the two previously accepted World-session files
and a fixture-assisted proposal projection; the seed and protected services remained
unchanged. Read-only proof found one Hermes capability, exactly one native `Mr Fluff`,
ready/current status, 50 bounded message projections, 2,790 events without body
inspection, a valid `aiw.avatar-proposal/0.12`, and unchanged fixture hashes.

Aaron then first-hand confirmed both reported blockers are fixed: clicking `Use
Complete Avatar` with no name entered no longer blanks the page, and refresh correctly
shows the preloaded 3D avatar instead of the old modular avatar sheet before any card is
clicked. This is an operator **PASS** for those exact two correction targets. Save,
consent persistence, and World animation were not separately retested in this verdict
and are not newly re-claimed. After verdict capture, owner-checked cleanup stopped both
candidate processes, removed the exact disposable state root, proved `43771/45181`
closed, and preserved protected `3770/5173/8642/18789` under their original identities.

The accepted feature snapshot is locally checkpointed on the dedicated
`checkpoint/imported-avatar-models-accepted-2026-08-01` branch. Git LFS/CI plumbing
is isolated in parent commit `f87ef398b2a7962a54ffd512fd210bf7b19e4d00`; the
feature commit deliberately does not embed its own SHA, which is bound by the external
checkpoint receipt. The final feature boundary contains exactly 413 reviewed paths,
including 23 GLBs represented by verified LFS pointers and 308 canonical evidence
files, while 199 exact partial/superseded evidence and plan paths remain untracked with
zero unstaged tracked changes. Final parent proof passed candidate-source formatting,
lint, TypeScript 38/38, architecture 11/11, deterministic 23-asset inspection, intake
5/5, functional Vitest 710/710 excluding only the separately recorded paused hardware
validator, production build 20/20, relevant Playwright 9/9, `git diff --check`, LFS
`fsck`, normalization of 46 inherited runtime-data executable bits to `0644`, staged
added-line secret/private-path scanning, and visual review of all 311 staged images
through ten contact sheets. A machine-specific source-inventory default found during staged review was removed with RED→GREEN coverage, and stale browser tests
were aligned with the accepted preview → `Use Complete Avatar` → save contract.

The frozen Phase 18.5 validator remains truthfully RED only for its two known production
input fingerprint mismatches; evidence was not rebound and the phase remains paused.
Aaron's later 2026-08-01 clarification supersedes the narrower private-storage
statement: the repository manifest records
`tripo3d-subscription-user-confirmed-unrestricted-use`. Protected
`3770/5173/8642/18789` remain under their preserved identities and candidate
`43771/45181` remain closed. No push, merge, tag, release, deployment, publication,
public ingress, provider/profile activation, protected-service mutation,
original-AgentIntersect edit, Phase 18.5 resumption, or Phase 19–20 work occurred or is
authorized.

### 2026-07-31 complete-avatar closeout — manual operator acceptance FAILED

Aaron first-hand tested the matching disposable current-repository candidate at
`http://127.0.0.1:45181/`. Selecting an avatar and activating `Use Complete Avatar`
caused the product to transition to a blank screen. Refresh did not recover the
flow: selecting an avatar and trying `Use Complete Avatar` again produced the same
blank-screen result. This is an authoritative manual **FAIL** at the explicit
complete-avatar selection transition; accepted/Save/consent restoration and World
animation could not be reached from this path. No screenshot or video accompanied
the report. The failure is frozen as evidence. At that moment no remediation or
source-code change had started; Aaron subsequently authorized the bounded correction.
At verdict capture, the owner-checked candidate
pair matched its recorded process identities. The validated cleanup subsequently
stopped candidate backend `43771` and frontend `45181`, removed both candidate tmux
sessions, and removed only the exact disposable state root. Protected
`3770/5173/8642/18789` remained unchanged under their recorded PIDs.

The bounded closeout corrected both authoritative operator REDs without enabling
cross-model modular composition or performing delivery:

1. First-load and refresh now show an actual role-valid GLB in a separate preview.
   The preload is explicitly not selected, saved, or accepted; stance artwork never
   replaces the 3D panel. Card activation changes preview only. `Use Complete
Avatar` performs the draft selection, and Save remains disabled until that
   explicit confirmation. Preserved custom/legacy, dormant modular, removed, and
   role-invalid persisted states remain fail-closed without rewriting stored bytes.
2. `user-male-02` now uses only its own verified `Idle`, `Walk`, and `Run` clips;
   `robot-agent-05` uses only its own verified non-T-pose `Idle`. Each rendered root
   retains its own scene clone, skeleton, source-local clip, mixer, and action.
   Runtime clips are cloned before root/Hip travel normalization, transitions use
   bounded 0.22-second crossfades, and unresolved model/actions remain explicit
   `EVIDENCE_REFUSED` static fallbacks.
3. The heavy avatar builder now loads behind a dedicated lazy boundary. The exact
   production entry is 404.18 kB decimal, below the enforced 409,600-byte ceiling;
   the renderer remains nested behind Builder -> AvatarPreview -> AvatarScene.

Independent parent verification after one bounded review correction passed source
immutability 69/69, focused blocker regressions 56/56, lint, typecheck 38/38,
architecture 11/11, build 20/20, broad Vitest 708/708, isolated Playwright 3/3,
Prettier, and `git diff --check`. A fresh broad read-only Codex review found three
consent/hydration blockers; the focused correction fixed them, and a fresh targeted
re-review returned `PASS` with no remaining frozen blocker.

Manual operator acceptance has **not** yet been claimed. The exact built artifact was
briefly served loopback-only at `http://127.0.0.1:4183/`; read-only checks through
Vite's preview proxy reached the protected local API at `3770`, found one Hermes
capability, and found exactly one native `Mr Fluff` session (`AgentIntersect Handoff
Status #5`). No clicks or consent actions were automated. Historical protocol
evidence says protected `3770` may reject the newer imported-avatar consent schema,
so this was not treated as a safe write-capable acceptance pair. The `4183` preview
and temporary HTTP probe were stopped at handoff. The next session must use a
matching disposable candidate backend/state pair before any consent mutation; do not
POST imported-avatar consent to protected `3770`.

The branch remains intentionally dirty, unstaged, uncommitted, and not commit-ready:
611 porcelain paths (30 tracked modifications, 581 untracked), zero staged, porcelain
SHA-256 `e5f1ca4963c3c32ab738d62ad7e7c5310511cedccef440902d1900bb57af8b35` before
this status-only update. Protected `3770/5173/8642/18789` retained their original
PIDs. No commit, push, merge, tag, release, deployment, publication, public ingress,
provider/profile activation, protected-service mutation, original-AgentIntersect
edit, Phase 18.5 resumption, or Phase 19–20 work occurred or is authorized.

### 2026-07-29 imported-avatar migration and Escape menu — user accepted

Aaron first-hand accepted the corrected normal-product candidate at `http://127.0.0.1:5181/`:

1. Saving an imported Mr Fluff avatar succeeded.
2. Refresh restored the saved imported avatar, proving persistence in the candidate World-session store.
3. The normal-World Escape menu and its bounded actions worked well first-hand.
4. Unknown native agent names remain unavailable rather than being fabricated; the live Hermes authority currently exposes only `Mr Fluff`.

The final live blocker was client/backend protocol skew, not the imported-avatar model or builder. The candidate frontend had initially proxied to the protected older `3770` backend, whose strict compiled `aiw.avatar-proposal/0.12` schema predates `avatarSource`. The paired candidate backend on disposable port `3771`, using an isolated validated copy of the accepted World-session store and the real Hermes Sessions API on `8642`, accepted imported consent and returned the selected asset from authoritative history. The disposable `5181` preview was repointed to that matching candidate backend; protected `3770/5173` remained untouched.

Independent parent verification for the corrected slice passed focused unit/UI tests **75/75**, formatting, ESLint, typecheck **38/38 tasks**, architecture **11/11**, production build **20/20 tasks**, imported-avatar plus Escape-menu Playwright **8/8**, and `git diff --check`. The broader implementation worker also passed **703/703** functional tests excluding the deliberately frozen Phase 18.5 validator. No commit, push, merge, release, deployment, publication, protected-service restart, or sibling-worktree mutation occurred.

### 2026-07-30 23-model continuation — functionally green, visual acceptance still red

Aaron authorized a second bounded Codex continuation through original-avatar presentation, semantic evidence, animation, and evidence-gated modularity, with a two-hour hard limit and immediate safe pause instead of questions at any blocker. The continuation preserved the exact inherited 168-path baseline, protected services, branch, HEAD, and zero staged paths.

Completed continuation work:

- the user and agent builders now state their truthful six/17 stance-card counts, name a distinct `Selected 3D preview` panel, expose actual-GLB readiness/loading/fallback truth, and retain explicit `Use Original`;
- the imported-World camera distance changed only from 10.1 m to 7.2 m, increasing deterministic projected 1.435 m avatar height from 148.629 px to 203.785 px without changing source GLBs, skeletons, binds, or normalization;
- a deterministic all-23 dense-evidence plan now requires seven samples per anonymous clip, names the three 22-clip variants, links each strip to manifest motion traces, and keeps runtime classification refused;
- `user-male-02` has a complete 21-clip × seven-sample set (147 PNGs), JSON, an offline viewer, and a full-page evidence capture; the first slow cat render was stopped safely after three frames and does not claim completion;
- no semantic mapping, Space Jump, slash gesture, agent cue, modular donor, slot, or cross-model combination was enabled. Own-skeleton and seam-evidence gates remain unchanged.

Worker verification passed 121 files / 694 functional tests excluding only the frozen Phase 18.5 validator, 4 files / 37 impacted tests, imported-avatar Playwright 3/3, typecheck 38/38, architecture 11/11, build 20/20, intake, formatting/lint, Python compilation, and diff hygiene. Independent parent proof reran the exact impacted 4 files / 37 tests and matching isolated Playwright 3/3, plus Python compilation and `git diff --check`.

Parent pixel inspection remains authoritative **RED**:

- the user capture proves all six cards, selected User Female 3, and a separate actual-GLB preview, but the result panel visibly covers explanatory copy;
- the agent capture states 17 cards and shows Robot Agent 5 in the preview, but the selected card is offscreen and the result panel obscures the catalog, so selected-card-plus-preview is not proven together;
- the World capture shows both models larger but still small, static T-poses with unconvincing grounding;
- the dense sheet is a substantial evidence improvement, but clips 03 and 20 are visibly cropped and static samples alone do not justify semantic labels.

The dirty worktree is therefore **PARTIAL-SAFE-PAUSE**, unstaged, uncommitted, not commit-ready, and not user accepted. It now has 327 porcelain paths: the same 28 tracked modifications plus 299 untracked paths. All 168 inherited paths remain; 159 continuation paths were added (158 evidence files and `tooling/avatar/render_replacement_pose_catalog.py`). The next coherent work is to correct the visible builder overlap/selection composition, World scale/grounding/static presentation, and evidence-camera clipping; then bound the slow-family renderer and finish one convincing slow-family seven-sample model before any semantic or modular activation.

### Historical next-session model and modular-rig preparation — direction completed by the 23-model intake

Aaron will gather the remaining desired avatar models before the next session and intends to put them into a consistent **T-pose/rest-pose baseline** so their rigs are more comparable and better suited to future modular-part work. The next session should begin with intake and compatibility evaluation, not immediate cross-model part swapping:

- preserve every source model unchanged and record provenance/license/role before conversion;
- normalize candidate copies to a documented T-pose/rest pose, coordinate system, scale, orientation, bone naming, and export contract;
- compare skeleton hierarchy, rest transforms, inverse-bind matrices, skin weights, scale, sockets, and animation semantics before assigning compatibility classes;
- permit modular-part interchange only where complete compatibility evidence exists; otherwise retain explicit refusal or require an authored retarget/remesh path;
- update the deterministic manifest/intake pipeline and add RED-to-GREEN structural/runtime tests before normal World integration.

This next-session direction does not resume the separate Phase 18.5 evidence lane, authorize revised Phases 19–20, or authorize commit/push/release/deployment. No remaining-model intake, T-pose conversion, rig edit, or modular-part implementation was started in this session.

### Historical 2026-07-28 imported-model implementation baseline

Aaron first-hand accepted the isolated `experiment/imported-avatar-models` preview and chose the three imported GLB avatars as the new embodiment baseline. The verified semantic animation correction now drives model-specific Idle/Walk/Run clips from authoritative World movement, cross-fades transitions, maps Shift+movement to Run, and removes cumulative Hip travel from cloned World-runtime clips so gameplay position remains authoritative.

The bounded imported-model avatar-builder implementation candidate was independently parent verified in the isolated dirty worktree and was later user accepted after the live protocol-pairing correction recorded above:

1. `docs/IMPORTED_AVATAR_BUILDER_SCOPE.md` freezes the registry, role, legacy migration, intake, compatibility, persistence, animation, and non-goal decisions.
2. One validated imported-model registry drives normal selection and runtime routing. `user-male` is the sole normal user choice; `cat-agent` and `futuristic-robot` are the agent choices. New user and agent drafts default deterministically to `user-male` and `cat-agent`.
3. Generated/custom avatars are preserved as legacy runtime/profile state but absent from normal new-avatar controls. A saved legacy profile previews unchanged, is labeled clearly, and migrates only after explicit role-valid imported selection and save.
4. The repository-owned manifest records role/lifecycle visibility, per-model semantic clips, preview/World transforms, stable segments, hierarchy/rest/inverse-bind fingerprints, compatibility class, provenance, the later-corrected `tripo3d-subscription-user-confirmed-unrestricted-use` operator-grant value, fallback policy, and GLB/thumbnail hashes. The deterministic `--check` path does not depend on the unavailable original Pictures sources.
5. Same-model stable-part isolation remains available. All current cross-model pairs are explicitly refused because no complete skeleton/rest/bind/scale/socket/skin-weight proof exists.
6. Legacy and imported profiles survive local hydration and exact-session transport; imported models route through normal World rendering after reload. Same-model hidden-part state is resolved from the repository manifest and applied in normal World rendering rather than being lost after the builder. Creator-preview clips remain separate from World semantic actions, and the accepted Idle/Walk/Run, Shift-Run, 0.22-second crossfade, runtime-only Hip normalization, source immutability, and safe Idle fallback remain intact.
7. Independent parent inspection found and corrected two bounded defects through RED-to-GREEN tests: saved segmentation state had not reached normal World rendering, and manifest-load failure could retrigger the segmentation inventory effect. The historical implementation baseline passed focused impacted Vitest **101/101 across 9 files**, functional Vitest **696/696 across 120 files** with only the deliberately excluded frozen Phase 18.5 validator, typecheck **38/38 tasks**, architecture **11/11**, production build **20/20**, full Prettier and ESLint, deterministic intake, imported-avatar Playwright **3/3**, and `git diff --check`. The later avatar-routing/Escape correction and user acceptance supersede this baseline's pending-review state.
8. The final automated World screenshot showed the full user model plus the intentionally isolated robot segment, readable HUD/composer, and no clipping or overlap. Aaron later accepted save, refresh persistence, and the Escape menu first-hand. No commit, push, merge, tag, release, deployment, publication, public ingress, sibling-worktree change, or original-AgentIntersect change is authorized or claimed.

**PHASE 18.5 VISUAL/HARDWARE PARENT ACCEPTED — COMPLETE LOCAL AND FRESH VERIFICATION GREEN — PRIVATE DELIVERY PENDING — PHASE 18 REMAINS OPEN**

On 2026-07-26 Aaron explicitly chose **Phase 18.5 — Avatar and World Visual Production** as the next-session implementation priority even though revised Phase 18 remains open. This sequencing decision does not accept, seal, waive, or delete any Phase 18 gate. At that checkpoint the physical-mouse held-right camera test plus real in-World Hermes/other-enabled-single-agent chat, voice, and bounded coding acceptance were still pending. The camera and bounded live-Hermes text gates later passed as recorded below; voice and bounded live coding remain mandatory before Phase 18 can be sealed.

The Phase 18 interaction correction is privately delivered on clean `main` at `b1f488c23f53b5ba6b75ea84c44a44924c7b0a2b`; exact-SHA GitHub Actions run `30187070037`, job `89753560868`, passed under Node 24. Aaron visually accepted the corrected harness-button placement and subsequently completed the physical-mouse held-right camera test. The fixture-assisted browser remains explicitly non-live and cannot satisfy the live-agent, voice, or coding gates; the separate first-hand live-Hermes text acceptance below supplies the text evidence only.

### 2026-07-28 live same-session conversation acceptance — FIFO / long-run / refresh / formatting / activity pass

Aaron paused Phase 18.5 rendering closeout and manually completed a fresh normal `/` journey through a loopback-only authenticated Hermes Sessions API connected to the true active Discord lineage. World accepted `hi fluff are you live?`; the exact Mr Fluff run streamed truthful tool activity, and later ordinary assistant responses returned to the persistent World conversation box. Aaron directly observed those responses and confirmed the result. This proves the bounded ordinary Hermes same-session **text** round trip, but it does not by itself seal Phase 18.

The earlier `prep end session` run remains useful historical failure evidence because it ended in `chat unavailable_` despite successful backend writes. Aaron has now first-hand accepted the bounded retest: the complete long/tool-heavy `prep end session` final response appeared inside World, and his screenshot shows the final delivered message. Long/tool-heavy World delivery therefore passes for this live exact-session candidate and must no longer be described as pending or failed.

The bounded live correction removes the completed Single/Multi choice labels from the later agent-name prompt, separates AgentIntersect display identity from the immutable native Hermes session title, pins/fetches one exact native root fail-closed, returns authoritative history through the typed client, and adds a ref-backed single-flight FIFO follow-up queue. Aaron manually proved that he can type and submit while Mr Fluff is working, sees `1 queued`, and receives each queued turn exactly once after the active turn. Conversation immediacy therefore passes first-hand without introducing concurrent Hermes turns.

Aaron's first refresh crossed back to agent selection/avatar/`Enter World`, while authoritative transcript history remained intact. Parent diagnosis against the exact live session proved that the rebuilt candidate restores a valid persisted pointer directly into World even when the live avatar-proposal endpoint returns 409, using the accepted authoritative-history proposal without changing native roots. Aaron has now manually refreshed the rebuilt live preview and confirmed that the chat remained present and the visible `prep end session` response restored in place. Direct exact-session refresh restoration therefore passes first-hand. Exact-session fail-closed behavior and no ambiguous auto-resend remain mandatory.

The bounded UX correction now preserves the accepted FIFO/session behavior while adding safe React-only structured assistant-message formatting and truthful turn-level activity. It renders paragraphs, bounded headings, unordered/ordered lists, blockquotes, fenced/inline code, and strong emphasis without raw HTML execution or a new package. Short no-tool turns show `thinking`; after any tool starts the bubble remains `working` until the outer turn completes, with a bounded secondary `tool`, `terminal`, or `reading` indicator. Neither `tool.completed` nor `message.assistant-final` presents the whole turn as `done`; only terminal send completion does so, after any awaited repository-floor load.

Parent verification for the formatting/activity candidate passed focused Vitest **51/51 across 4 files**, impacted web/renderer Vitest **189/189 across 42 files**, focused Playwright FIFO/refresh regressions **2/2**, monorepo typecheck **38/38 tasks**, production build **20/20 tasks**, an explicit Vite production build, and `git diff --check` under Node 24 and bounded memory. The rebuilt live preview serves the new bundle. A no-click exact-session proof restored directly into World through live status 200 / avatar proposal 409 / authoritative history 200, hydrated 42 transcript items, structurally rendered 19 assistant messages, and produced no executable script elements. Aaron manually confirmed that refresh preserved the chat, the `prep end session` response remained visible with clean formatting, and the real tool-chain bubble behaved perfectly: `thinking` progressed to continuous `working` with bounded activity detail and did not show `done` until the full turn completed. The complete refresh/formatting/activity UX slice therefore passes first-hand. Voice and bounded live coding remain open; Phase 18 remains unsealed; Phase 18.5 rendering remains paused; revised Phases 19–20 remain closed.

Checkpoint verification note: the complete `check:core` command reached **665/666 tests passing** and failed closed only because the accepted activity-bubble edit changed `packages/renderer-r3f/src/world-room-canvas.tsx`, invalidating the checked-in Phase 18.5 native-hardware production-input fingerprint. The old metrics were not silently rebound. A fresh native hardware capture is required when Phase 18.5 resumes. This accepted live-Hermes checkpoint may be committed and tagged as a recovery point, but it is not a Phase 18.5 performance seal or release candidate.

Evidence integrity was reconciled against the accepted candidate: `artifacts/phase18/world-entry-trace.zip` is the refreshed Phase 18 UI-regression trace, its ZIP structure and embedded network/snapshot resources passed bounded privacy and integrity inspection, and `artifacts/phase18/world-entry-trace.zip.sha256` now binds its SHA-256 `8014447d0b5097d5a33b4c6bf6177b155e841d048cff9363cab34edea89a9782`. The archive contains no credential-bearing headers or cookies, request bodies, query parameters, private absolute paths, or unsafe member paths. It is fixture-assisted UI evidence, not a substitute for the separate first-hand live-Hermes acceptance above.

### Current Phase 18.5 candidate

1. `docs/PHASE_18_5_SCOPE.md` and the executable asset contract were frozen before implementation edits.
2. The parent-rejected abstract first montage has been replaced. The approved Luminous Codecraft direction now has three actual-form direction boards, a multi-panel generated-geometry style bible, a corrected human-plus-cat hero, readable face/speech and five-hand-pose close-ups, a full modular human/dog/cat family, and an actual-geometry 11-family repository board.
3. The avatar production asset now contains 85 runtime meshes and 114,936 full-kit triangles. Its real assembled distance tiers are 33,329 / 30,408 / 4,040 triangles, inside the enforced 25k–65k / 12k–32k / 4k–12k bands, with distinct included-mesh sets and geometry signatures independently recounted from both `.blend` and GLB.
4. The repository renderer uses truthful metadata-driven package, directory, source, test, documentation, config, data, binary, and symbol families, with dependency bridges and evidence/change markers.
5. The final production hardware run in Edge 150 on an NVIDIA GeForce RTX 5070 Ti at 1600×1000 passed with zero browser/page errors, both avatars at LOD2, a continuous loop, 10.2 ms cadence p95, 0.2 ms render-work p95, and zero Long Tasks. Parent visual QA passed full silhouettes, PBR identity, semantic geometry, billboard, and HUD composition.
6. The remaining blocker was isolated to the agent crossing inside the prior 10-unit cutoff after bounded user movement. World now selects LOD0 through 6 units, LOD1 above 6 through 9, and the real 4,040-triangle species-specific LOD2 beyond 9 or for non-finite distance. Builder remains forced LOD0 and roster forced LOD1. Passing composition is unchanged.
7. Runtime clones physically remove unused meshes, memoize by stable selection values plus LOD, cache bone/morph targets, use one mixer per root, and use one full semantic clip at LOD2. World DPR is 1.0; the separate movement rAF runs only while moving; and HUD panels no longer perform live backdrop blurs over WebGL. LOD0/LOD1 retain masked base/upper-body composition.
8. Measurement records the unmasked WebGL renderer and classifies hardware versus software emulation. Hardware must pass live cadence. Software cadence remains explicitly failed/non-authoritative and requires current fingerprinted hardware evidence; thresholds remain 16.7 / 16.8 / 100 ms.
9. The retained WSL software lane is functional and honest: errors `[]`, both LOD2, continuous, render-work p95 0.3 ms, zero Long Tasks, but raw cadence median 33.3 / p95 50.0 ms and `cadencePassed=false`.
10. The final canonical parent comparison exposed seven older-dashboard regressions after visual/hardware acceptance. The correction now explicitly clears repository selection on canvas background misses, projects only 2,000 graph objects to WebGL and 160 to semantic fallback, applies a DPR-1/non-antialiased/basic-material aggregate tier at 1,000+ objects, bounds the 12-avatar roster surface, and defers optional compact LOD0 preview loading for 1,400 ms so panel switching cannot consume the 1,200 ms cancel window. Normal small-world semantic geometry and every Phase 18.5 quality floor remain unchanged.
11. Parent verification is green: TypeScript 38/38, architecture 11/11, Vitest 116/116 files and 642/642 tests, production build 20/20, smoke, Storybook, 55/55 flagged Playwright, 1/1 unflagged fail-closed Playwright, independent asset verification 28/28, and a 596-file disposable `verify:fresh` run. The five hardware-fingerprinted production inputs remain byte-identical to the accepted evidence.
12. The production audit found one high-severity advisory in inherited `find-my-way` 9.6.0 through Fastify. The closeout pins the existing transitive router to patched 9.7.0; the audit now reports no known vulnerabilities, and 206/206 local-server tests plus smoke and the complete fresh-copy gate pass. Unrelated generated churn under historical Phase 13–18 evidence directories was restored before delivery.

The implementation used only project-authored Blender/Python/SVG/HTML/CSS/Three.js sources and the repository's existing dependency families. No cloud image service, ComfyUI/model download, third-party model/texture/concept asset, provider activation, commit, push, release, deployment, or public action occurred. Private delivery is the next authorized action; merge, release, publication, deployment, and visibility changes remain closed.

Revised Phase 19 (**Multi-Agent Constellation and Harness Breadth**) and revised Phase 20 (**Embodied Product Acceptance and Bounded Hardening**) remain not started and not authorized.

## Historical Phase 18 correction baseline

**REVISED PHASE 18 FIRST-HAND RETESTED — CORRECTIONS REQUIRED**

The user authorized complete bounded revised Phase 18 implementation on 2026-07-25, then first-hand testing reopened it after observing nonfunctional ordinary World controls and no durable reply to `hi`. The bounded correction is implemented under `docs/PHASE_18_SCOPE.md`, `PHASE_18_REPORT.md`, and `artifacts/phase18/`. Fresh independent parent verification found and corrected forced-colors semantic overlap, misleading pointer-lock evidence, an oversized activity banner, and a stale headed-project contract. Final local product proof is green: focused World/renderer **16/16**, production World entry **7/7**, aggregate **114/114 files / 606/606 Vitest**, **20/20 builds**, smoke PASS, **52/52 flagged Playwright**, and **1/1 unflagged fail-closed Playwright**. Private commit `2a78ae335651756f1df3c97fe799db51490d5ab4` matched remote `main`, but exact-SHA run `30162706333` failed deterministically because the legacy Phase 11 measurement command built the newly flag-gated internal-dashboard tests without the required explicit developer flag. The RED-to-GREEN command correction, exact local Phase 11 lane, and complete follow-up aggregate are green. Private follow-up commit `b7e4a6706ec783eebfa96188b75ce2d54af11e50` matched remote `main` and passed exact-SHA GitHub Actions run `30163161342`, job `89691659661`, including Phase 10, avatar, corrected Phase 11, and full `pnpm check` gates. Final status-record commit `7162c68a88ff97a0a091ca42fc074b6e6a3eb9e2` matched remote `main` and passed exact-SHA run `30163449519`, job `89692382558`. Aaron then completed a clean native fixture-assisted retest: first launch, avatar creation, chat/transcript/status presentation, and repository-floor transformation worked, but avatar grounding, camera/avatar heading, hold-right-mouse controls, both mouse axes, transcript/composer alignment, constellation button spacing, and dynamic user-name addressing require correction. The authoritative list and screenshots are in `docs/PHASE_18_ACCEPTANCE_BACKLOG.md` and `artifacts/phase18/user-retest/`. Phase 18 is not user accepted, sealed, released, deployed, or published. Phases 0–17 remain accepted historical foundations.

That first-hand retest authorized the seven-family correction backlog in `docs/PHASE_18_ACCEPTANCE_BACKLOG.md`. The corrections were subsequently implemented, reviewed, privately delivered, and exact-SHA-CI-verified. The current authority is the Phase 18.5 milestone and preserved Phase 18 gates recorded above—not this historical backlog.

Phase 18 remains not accepted or sealed. Historical fixture responses remain fixture-backed, but the separate 2026-07-28 same-session Hermes text journey is genuine first-hand live evidence. Voice and bounded live coding remain open. Revised Phase 19 and Phase 20 remain not started and not authorized.

The frozen normal-experience invariants are:

- First launch is animated logo → `identify_` → `Create Avatar`; later launches personalize the logo/name, replay `AgentIntersect_`, and offer session selection without forcing avatar creation.
- Single/Multi choices materialize below the centered title. Harness endpoints are `openclaw_` upper-left/red, `hermes_` upper-right/yellow, `claude_` lower-left/orange, and `codex_` lower-right/blue-cyan.
- Every newly connected agent requires explicit avatar creation. Multi Agent repeats connect one → create its avatar → return; at least two connected/avatar-complete agents are required before `Enter World`.
- Hermes/OpenClaw name misses type `agent not found_` and retry immediately without technical detail; Codex/Claude use the entered name as World identity.
- World defaults to third-person behind the user. Only chat and push-to-talk persist. Unaddressed messages go to all; avatar click or `@name` targets one.
- Opening is full-screen with the existing animated logo and no other content; all text is Consolas; typed labels animate character-by-character and finish with a blinking underscore; connection overlays pulse truthful singular/plural state.
- Historical 2026-07-28 baseline: same-PC Hermes ordinary text was first-hand proven while the first long tool-heavy attempt ended in `chat unavailable_`. The later bounded retest passed long/tool-heavy completion, FIFO follow-up delivery, and conversation immediacy first-hand. LAN/different-PC setup UI remains deferred; normal-World voice integration and bounded live coding are the remaining Phase 18 priorities.
- Enabled actions are blue, unavailable actions grey; keyboard access, reduced motion, captions, responsive containment, and truthful current/previous state remain mandatory without admin chrome.

Normative details: `AgentIntersect_WorldDD.md` and `docs/WORLD_ENTRY_EXPERIENCE.md`. The frozen implementation scope is `docs/PHASE_18_SCOPE.md`; the first-hand correction authority is `docs/PHASE_18_ACCEPTANCE_BACKLOG.md`; the worker handoff is `PHASE_18_REPORT.md`; the originating plan is `.hermes/plans/2026-07-25_000842-world-entry-single-agent-magic-slice.md`.

### Closed gates

- Phase 13's historical Discord → World attempt remains failed evidence. The first 2026-07-28 long tool-heavy `prep end session` turn also remains historical failure evidence, but the later bounded exact-session retest delivered its final response exactly once and passed FIFO/reliability first-hand. Reliable conversation completion is no longer open for this checkpoint.
- Phase 15 remains **USER ACCEPTED / SEALED / COMPLETE / PROVIDER STAGED AND UNACTIVATED**; custom Mr Fluff voice remains deferred.
- Phases 16 and 17 remain **USER ACCEPTED / SEALED / COMPLETE**.
- Revised Phase 18's seven first-hand correction families are privately delivered and exact-SHA CI green; harness geometry and held-right camera behavior are accepted. Bounded ordinary and long/tool-heavy in-World Hermes replies, exact-session refresh, FIFO follow-ups, structured formatting, and truthful activity passed first-hand on 2026-07-28. Voice and bounded live coding remain open, so Phase 18 is not sealed.
- Phase 18.5 has a preserved uncommitted runtime-impostor correction in its separate worktree and is paused by Aaron. The live acceptance worktree has a separate uncommitted correction candidate. The current same-session runtime uses one explicitly approved reversible default-Hermes plugin/API transaction with a verified rollback manifest; additional provider/profile/core changes remain closed. Provider promotion/activation, LAN setup UI, original-AgentIntersect inspection/modification, revised Phase 19/20 work, merge, release, publication, tagging, deployment, public ingress, and visibility changes remain closed unless separately authorized.

**Phase 17 — USER ACCEPTED / SEALED / COMPLETE**

**Phase 15 — USER ACCEPTED / SEALED / COMPLETE / PROVIDER STAGED AND UNACTIVATED**

- Phase 17 is governed by the user-authorized bounded shape in `docs/PHASE_17_SCOPE.md`; its architecture and authority boundaries are recorded in `docs/PHASE_17_IMPLEMENTATION_CONTRACT.md`; independent parent evidence is recorded in `PHASE_17_REPORT.md` and `artifacts/phase17/recovery-drill.json`.
- The corrected candidate adds strict `aiw.observability/0.17` contracts, exactly eight derived readiness rows, checksummed current/previous snapshots, a bounded append-only event ledger, corrupt-current preservation, exact retry receipts for apply/export/delete, proof-based export/delete integrity, production APIs, an equivalent thin local CLI, and a lazy accessible Diagnostics & Recovery shell surface.
- The deterministic production-backed drill is PASS across all 17 checks: one exactly authorized World-owned operation is terminated before completion, then reload classifies it as orphaned/interrupted without fabricating success; current/previous/loss truth is exact; recovery preview is non-mutating; apply/export/delete replay only with their original bindings; both worktrees and repository hashes are unchanged; privacy canaries and absolute paths are absent; and cleanup leaves zero owned processes, listeners, temporary files, or exports.
- The fresh privacy/recovery review found six blocker families; the one authorized correction pass added focused RED-to-GREEN regressions for export integrity, deletion absence proof, termination/apply authority, fixed-file target symlinks, and comprehensive path redaction. Independent parent verification is green: Phase 17 conformance **8 files / 27 tests**; direct recovery/privacy replay challenge PASS; `measure:phase17` production build **20/20**, drill **17/17**, and focused browser **1/1**; complete `pnpm check` with typecheck **38/38**, architecture **11/11**, Vitest **580/580**, build **20/20**, smoke, and Playwright **44/44**; and disposable `verify:fresh` PASS for **502** project source files. First-hand production visual QA found and corrected duplicate list markers through a focused RED-to-GREEN browser regression; the final numbered controls are readable, blue when enabled, grey/focusable when unavailable, and free of clipping or overflow. The technical implementation/evidence tree at `bdfb1c8ae58303e8afad41f6a2411fd8adfeef93` passed private exact-SHA `phase-1-checks` run `30019778458`, job `89249166240`; after that proof, the user explicitly accepted Phase 17 in the new session. Phase 17 is accepted, sealed, and complete.
- Phase 16 remains governed by `docs/PHASE_16_SCOPE.md`; the implementation contract is `docs/PHASE_16_IMPLEMENTATION_CONTRACT.md`; deterministic, parent, live, recovery, browser, and manual-integration evidence is recorded in `PHASE_16_REPORT.md` and `artifacts/phase16/final-live-proof.json`. Phase 15 remains governed by `docs/PHASE_15_SCOPE.md` and `PHASE_15_REPORT.md`.
- The corrected Phase 16 implementation provides strict `aiw.coordination/0.16` contracts, a byte-bounded sanitized presentation projection, checksummed current/previous recovery, serialized authority and Git reconciliation, explicit production repository/worktree roots, exact two-agent ceilings, a lazy semantic Agents panel with monotonic polling, and a real disposable-Git fixture. It never auto-merges or auto-deletes.
- Independent parent verification is green: Phase 16 conformance **9 files / 41 tests**, deterministic measurement PASS, complete `pnpm check` PASS, disposable `verify:fresh` PASS, and separate conformance passes from both final agent branches.
- The final live proof used exactly Mr Fluff/Hermes and Beans/OpenClaw on distinct sessions, tasks, branches, worktrees, tool streams, and evidence streams. It projected same-file interest, one real Git conflict, an inert attributed injection-shaped message, a Beans -> Mr Fluff handoff, exact candidate/test evidence, fail-closed wrong-boundary and third-agent refusals, current restart persistence, previous-snapshot recovery, and preview-only cleanup.
- Built browser proof showed both agents and all numbered controls without clipping, overflow, overlap, or console errors; enabled controls were blue and inactive controls were grey and focusable. Browser approval set `operator-approved` while preserving `mergeRun:false`.
- Manual integration preserved both branch ancestries, surfaced the expected collaboration-file conflict, and resolved it by human-reviewed edit to `resolution: manually-integrated-both`; merge commit `4ff11e45a86041cd7f3549b7f886f408a8a21061`. Private exact-SHA GitHub Actions run `29994988808`, job `89166443996`, succeeded for integrated/evidence SHA `4ae352eb7df755d84994100fbeab279faf05b980`. The final status-record SHA `3cf9e53b2c9e05f232d68d61a7ee029f2ff946f0` then passed exact-SHA `phase-1-checks` run `29995642552`, job `89168556242`. After that technical completion and exact-SHA CI proof, the user authorized acceptance in the new session; Phase 16 is accepted, sealed, and complete.
- The candidate implements one consentful ten-step push-to-talk lane: strict browser capture and PCM bounds, shell-free exact-provider re-attestation/execution/cleanup, editable final transcript, canonical existing-session send, optional capability-detected browser/system TTS with actual opaque voice selection, barge-in, bounded preference/activity recovery, and truthful privacy/provider/device disclosure.
- Independent parent and fresh-review corrections are green for automatic-ceiling handoff, actual voice selection/use and fail-closed revocation before asynchronous persistence resolves, product-wired recovery activity, awaited native-process termination, every current native runtime member's exact re-attestation, in-flight transcription abort/discard, truthful synthetic-versus-real performance evidence, recovery fixture integration, and forced-color blue-enabled/grey-disabled visual truth.
- Final post-correction proof is green: literal `pnpm check`; 11/11 architecture; 39/39 Phase 15 conformance; 512/512 Vitest; 41/41 Playwright; production build/smoke; Storybook; no known production vulnerabilities; and fresh-copy verification for 452 project source files with the same 512/41 tests.
- Exact staged-provider proof matched the expected transcript in `662.074746 ms` at `299,655,168` bytes peak RSS, with exact runtime/model/inventory-file hashes plus every current runtime member's path/hash/size/mode, 53 regular files / 185,119,961 bytes / zero symlinks, and zero residual process, listener, temp root, source WAV, or raw-audio file. A disposable copied-tree shared-library mutation now fails unavailable. The provider remains staged and unactivated outside the repository.
- First-hand production-built browser/visual proof is green for deterministic capture, in-flight cancel/discard, edit/send/canonical reply, TTS/revocation/stop, genuinely pinned mobile/two-CPU/reduced-motion/forced-colors/no-WebGL operation, zero serious/critical axe violations, and zero visual clipping/overflow. Supplemental Node control microbenchmarks are explicitly non-acceptance evidence rather than mislabeled microphone/STT/TTS timings; none of this is mislabeled as physical-microphone proof.
- On 2026-07-24 the operator connected an **HD Pro Webcam C920**, explicitly allowed microphone access in Microsoft Edge, completed physical push-to-talk through the exact staged local provider, accepted the final caption **“Mr. Fluff, please reply with physical microphone gate received.”**, sent it through the existing Explore-mode Hermes/Discord session, received canonical reply **“Physical microphone gate received.”**, and heard the reply through optional browser/system TTS. The exact session/correlation, 666/663/686 ms completed local operations, and cleanup truth are retained in `artifacts/phase15/physical-microphone-acceptance.json`.
- Raw audio and provider payloads were not retained; the volatile audio tree was empty, no residual Whisper/FFmpeg process remained, and voice activity returned to `null`. The user reported TTS **“worked!”** and explicitly selected **“Seal Phase 15 now.”** Phase 15 is user accepted, sealed, and complete. The provider remains staged/unactivated; the gate did not promote or activate it.
- The private Phase 15 closeout commit `46e63d9524e75e451b89ba950acc6d77402a8716` passed exact-SHA GitHub Actions workflow `30139319599`, job `89629399227` (`success`).
- Phase 14 remains complete and sealed with all existing evidence below. The Phase 13 Discord → World continuity path remains FAIL/deferred under waiver, was not retried, and is excluded from Phase 15.

## Accepted Phase 14 baseline

- Frozen contract: `docs/PHASE_14_SCOPE.md`; completion evidence: `PHASE_14_REPORT.md`, `docs/PHASE_14_PERFORMANCE.md`, and `artifacts/phase14/`.
- Baseline: `c49042793e45921501bfd9c3003f857fd25647de`; baseline exact-SHA GitHub Actions run `29956534885` was green.
- Closeout implementation/correction commit: `68a41925fa93fca23c8b2efffd56e8869d6676a0`; exact-SHA GitHub Actions run `29963116363` was green.
- Version: `0.14.0-phase14`; runtime: Node `v24.18.0`, pnpm `11.15.0`.
- Workspace: 19 projects / 18 named app-package graph entries.
- The implementation adds strict `aiw.tool-event/0.14` and `aiw.code-explanation/0.14` contracts, an attested World-owned disposable fixture service, exact single-use approval and atomic edit, real focused-test and loopback-preview adapters, bounded recovery/replay persistence, and one accessible ten-step Activity lane that leaves Phase 12 chat and Phase 13 presentation independently usable.
- Worker and independent parent verification are green: focused Phase 14 conformance 35/35; metadata correction regression 23/23; authoritative `pnpm check` with 34/34 typecheck tasks, 11/11 architecture tests, 473/473 Vitest, 18/18 builds, smoke, and 40/40 Playwright; Storybook; zero-vulnerability production audit; machine-readable performance evidence; inspected desktop/mobile screenshots plus retained trace; and a clean rerun of 412-file fresh-copy verification with the same 473 tests and 40 browser tests green again.
- Actual acceptance used real `node --test` and a real OS-assigned loopback preview port. Each owned process tree was stopped and awaited, each port and disposable copy was proved closed/removed, and all final manifest-pinned tracked fixture hashes remained unchanged.
- The failed Phase 13 Discord → World continuity path remains deferred and was neither invoked nor simulated. The protected `AgentIntersect` sibling checkout and Hermes core/profile were not inspected or modified.
- Parent Mr Fluff independently inspected the implementation and retained captures, found and fixed one Phase 13/14 runtime-metadata mismatch through RED→GREEN TDD, reran real-process/browser/full/fresh-copy proof, verified fixture hashes plus cleanup, and closed private exact-SHA CI. No tag, release, publication, deployment, public ingress, or visibility change occurred.

## Completed Phase 4 surface

### Versioned World schema

- `aiw.world/0.4` snapshots
- `aiw.identity/1` opaque deterministic identity
- `aiw.layout/grid/1` renderer-independent layout
- Strict workspace, repository, directory, package, file, tombstone, tile, and query DTOs
- Opaque `aiw://object/<id>` and `aiw://path/<id>` references
- No selected absolute root or `rootPath` in shareable snapshot/tile DTOs

### Deterministic identity and lifecycle

- Browser-compatible standards-matching SHA-256 over NUL-separated canonical values
- Separator normalization, NFC normalization, and case-sensitive paths
- Stable unchanged-path IDs
- Unique exact-content rename donation with bounded path history
- Explicit case-only and ambiguous-rename behavior
- Typed normalization collision failures
- Bounded tombstones with deterministic resurrection/reintroduction reconciliation
- Repository-root isolation
- Eager successful-generation projection so rename continuity does not require an intermediate World API read
- Prior good snapshot preserved through projection failure for later recovery

### Layout and bounded LOD

- Deterministic hierarchy ordering and non-overlapping child packing
- Iterative stack-safe measure/place traversal
- Parent containment and reciprocal parent/child references
- Full-detail maximum: 10,000 files
- LOD 0–4 on a fixed 16×16 tile grid
- Maximum tile response: 128
- Bounded 100,000-logical-object aggregate proof with zero full-detail materialization and at most 341 tiles
- Byte-identical golden and fresh-process outputs

### API

- `GET /world/current`
- `GET /world/tiles?lod=&minX=&maxX=&minZ=&maxZ=&limit=`
- Correlated strict runtime envelopes
- Truthful 200/400/404/409 OpenAPI status metadata
- Existing Phase 2 authority and Phase 3 repository-index APIs remain intact

## Verification highlights

- Independent SHA-256 proof matched `aiw://object/ee0c463b51663994a938e656bad37981`.
- Recreated/reintroduced files produced no duplicate live/tombstone IDs or refs.
- A valid maximum 2,048-level hierarchy projected deterministically without stack overflow.
- 10,000-file full-detail and 100,000-object aggregate bounds passed.
- Real loopback HTTP proof indexed a disposable repository and returned a path-private `aiw.world/0.4` snapshot and tiles.
- OpenAPI advertised exactly the statuses exercised by both World endpoints.
- Listener refused requests after clean close.
- Fresh-copy install and complete aggregate verification passed for 144 source files.
- Original AgentIntersect was not inspected or modified; no Blender/graphics work occurred.

## Sole audit disposition

The one bounded audit confirmed five blockers, all fixed in the one permitted correction pass:

1. reconciled same-ID live objects and retained tombstones;
2. corrected trailing-NUL SHA-256 canonical encoding and regenerated goldens;
3. preserved rename continuity across unobserved successful generations;
4. aligned path/name limits, typed projection failures, and made layout iterative;
5. synchronized World runtime/OpenAPI status metadata.

The targeted five-blocker re-review returned PASS for all five and found no correction-introduced critical blocker. Parent focused, aggregate, real-HTTP, Playwright, and fresh-copy retesting is green. No second broad audit ran.

## Phase 5 — COMPLETE

**Inherited identity/dashboard shell and first repository island**

Phase 5 completed the balanced vertical slice recorded in `PHASE_5_REPORT.md`, `docs/PHASE_5_SCOPE.md`, and `docs/PHASE_5_ASSET_PROVENANCE.md`.

- The first-open `identify_` flow now leads through a locally persisted inherited 2D avatar builder and bounded transition into the dashboard.
- The World-owned shell preserves the approved hero/typewriter/cursor language, exact category taxonomy, persistent status/results area, and truthful default/current harness intent selection.
- Existing Phase 2 authority and Phase 3 repository-index flows remain reachable and recover running/recent operations across panel close/reopen.
- The Phase 4 snapshot/tile API powers one hybrid semantic-DOM/R3F repository island with instancing, synchronized selection, search, keyboard focus, inspector, overview/minimap, WebGL fallback, and absolute-path redaction.
- Exactly 18 selected inherited graphics were copied byte-identically from the authorized AgentIntersect commit; the original repository remained clean.
- Storybook states, five visual baselines, axe, reduced-motion, forced-colors, mobile-overflow, unsupported-language, context-loss, and measured 10k-instance evidence are green.
- One bounded audit found four blockers; one targeted correction resolved all four, and the targeted re-review returned PASS with zero residual blockers. No second broad audit ran.
- Workspace/runtime version is `0.5.0-phase5`; the repository remains private with no tag, release, deployment, package publication, or visibility change.

## Phase 6 — COMPLETE

**Read-only AgentIntersect integration and normalized replay**

- A narrow compatibility facade now attests the pinned health/workspace/process contract and reads daemon state, dashboard snapshot/feed, and dashboard SSE without exposing mutation authority.
- `aiw.event/0.6` supplies stable source/fallback event IDs, stable animation IDs, deterministic cross-source order, bounded hostile-data redaction/truncation, identifier mapping, and phase-board/roster/timeline projection.
- Node 24 SQLite owns transactional dedupe, source/checkpoint metadata, and reducer checkpoints; an append-oriented JSONL accepted-event ledger replays byte-identically and fails closed on a corrupt or partial tail while retaining the verified prefix.
- Startup/reconnect reconciliation preserves last-good state across offline, stale, mismatch, SSE gap/reset/overflow, and bounded-backpressure conditions.
- Strict GET-only local-server routes expose integration, phase-board, roster, timeline, replay/reconciliation, and selected-harness readiness projections. No Phase 6 mutation route exists.
- The Phase 5 shell shows ready/offline/stale/mismatch/error truth, current versus previous/replayed labels, bounded diagnostics, disabled grey observation-only execution controls, and desktop/mobile-accessible projection views.
- Local formatting, lint, typecheck, architecture, focused/aggregate tests, production build, smoke, browser, Storybook, advisory, and clean-copy gates are green.
- The sole bounded audit's B1–B6 findings received the one authorized targeted correction: authoritative latest observations are separate from deduplicated timeline identity; replay/checkpoint/crash ordering is fail-closed; nested contracts and streamed caps are pinned; the expanded redaction matrix is enforced through replay/storage/API/display; periodic freshness and SSE recovery have a clean lifecycle; and the stale Phase 5 browser assertion is corrected.
- Local correction verification and independent parent proof are green: focused 64/64, complete Vitest 174/174, typecheck 25/25, architecture 9/9, build 14/14, smoke, Playwright 19/19, Storybook, production advisory audit, 222-file fresh-copy verification, live A→B→A/restart/reconnect/malformed/oversized/redaction/disabled-execution proof, and desktop/mobile first-hand browser checks with zero console errors or horizontal overflow. No routine targeted re-audit was required.

## Phase 7 — COMPLETE

**Local command intent and real worker vertical core**

- A checksum-protected durable command-intent ledger persists immutable intent/request identity before one external mutation and represents explicit confirmed, ambiguous, rejected, and failed outcomes.
- Loopback and explicit trusted-LAN command submission require a dedicated bearer token held only in component memory; wrong authority fails before store mutation.
- World re-attests actual pinned AgentIntersect workspace/process, running phase, design revision, session, selected harness, readiness, and create-contract shape immediately before one `POST /v1/worker/jobs`.
- Identical retries replay one logical intent/job. Because pinned AgentIntersect create has no proven idempotency key, uncertain responses remain ambiguous and are not resent.
- The Phase 6 read path reconciles queued, claimed, running, complete, and failed evidence to the exact job/run while AgentIntersect alone owns claim, execution, and completion.
- The Activity panel restores durable state after reload/restart and shows the fixture-only artifact/verification with current/previous labels and truthful unavailable actions.
- Parent/live corrections made the actual pinned state/snapshot payloads compatible, enforced dual-source phase/revision evidence, bounded raw responses/logs, restored results, and stopped no-op durable churn.
- Full post-fix gates and unchanged-AgentIntersect loopback/LAN/real-job/restart/mobile proof are recorded in `PHASE_7_REPORT.md`.

## Phase 8 — COMPLETE

- Strict `aiw.evidence/0.8` baseline, change, test-truth, record, artifact, lookup, and current/previous schemas.
- Checksum-protected atomic local evidence store with retained restart baselines, last-good recovery, immutable intent identity, exact-once durable finalization, and latest-20 retention.
- Hardened read-only Git-plus-filesystem capture with 256-path, 1 MiB total, 128 KiB/file, binary metadata-only, secret-redaction, explicit truncation, and unique complete-hash rename behavior.
- Phase 7 seal-before-create and exact terminal intent/job/run finalization; one strict identity lookup API plus current/previous UI read.
- Phase 4 object/baseline/tombstone refs feed the Phase 5 repository selection/focus path and persistent DOM/R3F change markers without success-by-animation.
- Authoritative Evidence panel, Storybook states, reduced-motion/WebGL fallback equivalence, and the complete World-owned disposable acceptance fixture are green in worker verification.
- Independent parent proof is green: corrected no-NUL binary handling and authoritative rename refs, 203/203 Vitest, 25/25 typecheck, 9/9 architecture, 14/14 build, smoke, 21/21 Playwright, Storybook, zero-vulnerability production audit, 245-file fresh-copy verification, and first-hand browser selection/marker/console checks.

## Phase 9 — COMPLETE

- One opaque `aiw.presentation/0.9` document is derived from authoritative World workspace/repository identity and contains only bounded presentation state.
- The local server owns a checksum-protected snapshot/update tail, exact-origin single-use join tickets, and strictly separate presentation authority; browser views use Yjs awareness and opaque-ID IndexedDB persistence.
- The Phase 9 shell lane exposes peers, owned-agent focus, presenter/follow, annotation/bookmark/layout/orphan state, reconnect truth, and local export/delete/cache controls without command authority.
- One targeted parent correction fixed fresh-ticket automatic reconnect, graceful shutdown with live presentation peers, and production wiring to real authoritative World objects/Phase 6 roster instead of fake IDs.
- Independent parent proof is green: focused 31/31, built-code abrupt-drop/restart/offline convergence and shutdown probe, 235/235 Vitest, 26/26 typecheck tasks, 10/10 architecture, 14/14 build, smoke, 22/22 Playwright, Storybook, zero-vulnerability production audit, 266-file fresh-copy verification, and first-hand browser state/action/console checks.
- Phase 9 was committed and privately pushed; exact-SHA GitHub Actions run `29760049477` succeeded for the final Phase 9 implementation/test baseline. No release, tag, deployment, package publication, public ingress, or visibility change occurred.

## Phase 10 — COMPLETE

- Worker slots now become usable only after checksummed runtime/grammar verification, WASM initialization, and grammar preload; startup has a separate bounded timeout, while the unchanged 500 ms per-file timer begins only after ready-task dispatch. Startup failure drains once to truthful whole-file unavailability instead of cold replacement thrash.
- Exact `@vscode/tree-sitter-wasm@0.3.1` runtime/grammar hashes gate TypeScript/TSX/JavaScript/JSX worker parsing; unsupported, unavailable, malformed, cancelled, timed-out, and over-budget files contribute no partial symbol truth.
- `aiw.code-graph/0.10`, `aiw.symbol/0.10`, and `aiw.dependency/0.10` preserve opaque authoritative file identity, deterministic duplicates/cycles, exact/ambiguous/unresolved/external confidence, and path-private API responses.
- Static dependency resolution reads indexed metadata only and never executes selected-repository code, package scripts, hooks, package managers, shells, LSPs, compilers, tests, binaries, or native addons.
- Non-null content hashes gate incremental reuse; generation supersession/cancellation cannot commit partial truth; current plus previous checksum-verified graphs recover explicitly after restart/corruption.
- LOD 0–2 aggregates and one-file LOD 3–4 detail feed bounded semantic DOM and R3F symbol/dependency lanes with explicit current/previous/degraded/truncated truth and no whole-repository symbol-detail route.
- The enforcing 10k/100k suite, strict two-CPU browser proof, repository-wide gates, Storybook, supply-chain evidence, fresh-copy verification, and desktop/mobile browser proof are recorded in `PHASE_10_REPORT.md`, `docs/PHASE_10_PERFORMANCE.md`, and `docs/PHASE_10_PARSER_PROVENANCE.md`.
- The startup entry chunk was reduced from 1,383.34 kB to 359.48 kB by independently splitting presentation synchronization and repository/R3F loading; a manifest regression protects both boundaries and constrained hardware reduces cosmetics without changing semantic truth.
- Private exact-SHA Actions run `29780316891` passed both `measure:phase10` and the complete `pnpm check` job on two reported CPUs.

## Closeout status

## Imported-avatar replacement — PARTIAL, SAFE PAUSE AFTER CONTINUATION

The deterministic 23-model original-avatar slice remains functionally green: six user originals and seventeen agent originals, immutable/hash-bound source intake, stance cards, separately activated actual-GLB preview, explicit `Use Original`, v2 persistence/consent, stale-ID re-selection, no-3D zero-load behavior, and complete-original World routing.

The continuation improved truthful builder observability, reduced the imported-World camera distance from 10.1 m to 7.2 m, and added a repeatable dense semantic-evidence pipeline. The pipeline plans seven samples per clip for all 23 models and explicitly identifies all three 22-clip variants. One full representative (`user-male-02`) now has 147 labeled frames, evidence JSON, an offline strip viewer, and a full-page capture. Runtime semantic classification remains refused.

Worker verification passed 121 files / 694 functional tests excluding only the unchanged frozen Phase 18.5 validator, 4 files / 37 impacted tests, imported-avatar Playwright 3/3, typecheck 38/38, architecture 11/11, build 20/20, intake, formatting/lint, Python compilation, and diff hygiene. Independent parent proof reran 4 files / 37 tests and isolated matching Playwright 3/3, plus Python compilation and `git diff --check`.

Parent visual QA is still **RED**. The user builder proves six cards plus a distinct preview but has result-copy overlap. The agent capture does not show the selected Robot Agent 5 card and preview together, and its result panel obscures the catalog. World models remain small static T-poses with unconvincing grounding. The dense representative has visible clipping in clips 03 and 20 and cannot establish semantic names. These are explicit blockers, not accepted visuals.

No semantic mapping, Idle/Walk/Run activation, Space Jump, local gesture command, agent cue, modular donor/slot, layered renderer, or cross-model combination was enabled. Every own-skeleton, rest/inverse-bind, region-isolation, and seam gate remains fail-closed. The current 327-path worktree (28 tracked modifications, 299 untracked, zero staged) is not commit-ready or user accepted. No commit, push, merge, tag, release, deployment, publication, protected-service mutation, Phase 18.5 resumption, or Phase 19–20 work occurred.

**Phase 17 — USER ACCEPTED / SEALED / COMPLETE**

The bounded corrected Phase 17 slice passed independent parent inspection,
direct recovery/privacy challenges, conformance, deterministic recovery
measurement, first-hand production browser/visual proof, complete repository
checks, disposable fresh-copy verification, private push, and exact-SHA CI at
`bdfb1c8ae58303e8afad41f6a2411fd8adfeef93` under run `30019778458`, job
`89249166240`. After that proof, the user explicitly accepted Phase 17 in the
new session. Phase 17 is accepted, sealed, and complete. Phase 16 remains
accepted, sealed, and complete; revised Phase 18’s reopened correction is parent verified, with private exact-SHA CI and a new first-hand full-browser retest next.

`docs/PHASE_15_SCOPE.md` remains frozen. The bounded Phase 15 implementation, independent parent proof, real physical-microphone journey, exact-session canonical reply, optional browser/system TTS, cleanup, and explicit user acceptance are green in `PHASE_15_REPORT.md` and `artifacts/phase15/physical-microphone-acceptance.json`. Phase 15 is user accepted, sealed, and complete; its provider remains staged and unactivated.

Phase 14 remains sealed and accepted: the user froze and explicitly authorized its bounded implementation on 2026-07-22, and `docs/PHASE_14_SCOPE.md` remains its controlling contract. The complete slice, independent parent proof, retained evidence, cleanup, private push, and exact-SHA GitHub Actions run `29963116363` are green.

The Phase 13 exact-root Discord → World continuation remains FAIL/deferred as a separate backlog item and was not retried. Phase 15 must not silently absorb, retry, or claim that live gate; revisit it only under an explicit later-milestone authorization.

Future runtime/model refetch, provider promotion/activation, release, deployment, public ingress, publication, visibility change, Hermes/OpenClaw/core/profile change, original-AgentIntersect operation, revised Phases 19–20 implementation, Phase 18 scope expansion, LAN setup UI, and custom voice implementation remain prohibited without their required separate authorization.

The Phase 13 hybrid performance contract remains inherited: main-thread render-work p95 is capped at 16.7 ms, raw `requestAnimationFrame` cadence p95 at 16.8 ms, and all raw samples remain machine-readable.

## Non-blocking backlog

### Product UI and Mr Fluff voice

- Complete fresh independent parent verification and first-hand user acceptance for the corrected revised Phase 18 World-entry experience before any acceptance/seal or Phase 19 action.
- Add a distinctive, high-quality custom Mr Fluff voice in a separately authorized future milestone. Preserve explicit preview/accept/change/revoke/stop controls and provenance; do not treat the accepted browser/system TTS baseline as a custom voice or silently introduce voice cloning.

### Phase 13 deferred live continuity

- Revisit exact-root Discord → World continuation only in a separately authorized integration milestone. The final Phase 13 attempt proved exact root-to-effective compression resolution and persisted assistant deltas, then rejected `run.completed` because no current-turn assistant message was present. Required future proof remains ordered World assistant finals, exactly one strict `focus → trace → navigate → inspect` tour, truthful movement/arrival, and a final World chat turn. Do not treat the failed attempt or Phase 13 waiver as a green live gate.

### Phase 7

- Coordinate the pinned AgentIntersect Codex output-schema contract with the configured contemporary Codex CLI before claiming a model-backed acceptance fixture; keep the original repository unchanged unless separately authorized.
- Add create idempotency/resend only if a future pinned AgentIntersect contract proves a same-intent key.
- Enforce token/cost ceilings only when the selected harness exposes a trustworthy enforceable contract.

### Phase 6

- Split the large web/Storybook chunks when production delivery becomes active.
- Add ledger segment rotation/checksums only when retention requirements exceed the bounded Phase 6 single-ledger slice.
- Keep mutation authority, worker launch/claim/complete, and external configuration/authentication writes deferred to Phase 7 or later.

### Phase 5

- Distinguish tile loading/unavailable states from a truthful zero-tile result.
- Move WebGL capability probing out of React render and add explicit Three resource disposal before renderer remount/update frequency grows.
- Add optional GPU-frame/readback instrumentation for the 10k browser fixture when renderer performance work begins.
- Split the large web/Storybook chunks when production delivery, rather than local functional proof, becomes the active milestone.

### Phase 4

- Add independent relational refinements to `WorldSnapshotSchema` if snapshots become externally authored.
- Improve generated OpenAPI response-body fidelity where useful.
- Replace or supplement the bounded 100,000-object arithmetic proof with a materialized benchmark when performance work begins.
- Durable World snapshot/history persistence and restart recovery.

### Phase 3

- Complete nested `.gitignore` behavior for non-Git roots.
- Watcher/automatic rescan policy.
- Browser polling retry policy after a surfaced request error.
- Durable repository generation and operation-history persistence.

### Phase 2

- Refresh or downgrade top-level authority readiness if the server disappears after initial load.

### Phase 1 tooling

- Add SIGINT/SIGTERM cleanup for externally interrupted `verify:fresh` runs.

Historical items should be revisited only when their affected surfaces are deliberately touched.

## 2026-07-31 bounded 23-model continuation — partial safe pause

The directly authorized continuation verified the exact inherited baseline and
protected listeners, corrected builder composition, improved static imported
World framing/grounding/refusal truth for user/cat/dog/robot families, and made
the Blender evidence path bounded, cancellable, descendant-safe, and explicit
about partial versus complete output. Focused RED→GREEN checks and isolated
browser pixels cover those changes; this is worker evidence only, not parent or
user acceptance.

`cat-agent-01` now has one complete bounded slow-family artifact: all 21 source
clips, seven samples per clip, 147/147 contained frames, deterministic manifest
traces, an offline viewer, three inspected grouped sheets, and an exact
per-clip classification ledger. All 21 verdicts remain `ambiguous`. The pixels
suggest several actions, but the deterministic trace format does not encode an
independent semantic binding, affected-limb discriminator, or cadence. Runtime
activation therefore stops at `Idle`; no semantic action, jump, gesture, cue,
crossfade, or source clip was enabled or mutated.

The worker safely paused at the first semantic-evidence blocker before the
00:05 no-new-slice cutoff. Item 7 was not started: weight-based region purity is
not seam/gap, attachment, animated sibling-root, or compatibility proof.
Own-skeleton modular rendering remains disabled and no whole donor substitutes
for a slot. Items 1–6 are complete in their evidence/refusal sense; item 7 is
blocked pending a coherent evidence-generation slice. The current verdict is
`PARTIAL_SAFE_PAUSE`; parent verification and user acceptance remain pending.

### Parent correction — catalog cancellation truth

Parent verification found one bounded correctness defect in the evidence
catalog: direct SIGTERM bypassed Blender process-group cleanup and interrupted
progress finalization, while a reused model output could retain stale
`pose-evidence.json` and `evidence-index.html` after a failed rerun.

The narrow correction is GREEN through an executable fake-Blender integration
suite. Before each model attempt, full-completion manifest/index truth is
invalidated without touching partial evidence. SIGTERM is converted to a
catchable catalog cancellation, the active model process group receives bounded
TERM→KILL escalation even when its leader exits before a TERM-resistant
descendant, and `catalog-progress.json` is atomically finalized as
`interrupted` with reason `signal-cancelled-SIGTERM` while retaining the active
model. Timeout, Ctrl+C, renderer-failure, partial-only, and fresh-success paths
remain fail-closed.

The focused executable suite passes 4/4, complete imported-avatar intake passes
4/4, Python compilation passes for both render scripts and the integration
test, and `git diff --check` passes. No Blender evidence was rerun; no semantic,
modular, protected-service, Git delivery, or other continuation work occurred.
This correction passed independent parent verification in the frozen 553-path
baseline.

## 2026-07-31 avatar replacement items 1–7 — item 7 evidence REFUSED

The freshly authorized continuation preserved the parent-verified items 1–6
and completed item 7 at its frozen evidence boundary. The sole evaluated pair
was `dog-agent-01` as base plus `dog-agent-02` as donor: both are in the same
dog-agent family, share the 41-joint hierarchy class and 1.75 m target height,
and have near-identical wrapper scales, while their distinct rest-pose and
inverse-bind hashes require two unchanged sibling roots. No second pair was
tried and no threshold was weakened.

The bounded evidence procedure retained one rest assembly and three animated
samples for each of head, torso, left arm, right arm, left leg, right leg, and
auxiliary. Blue pixels are the complementary base meshes; orange pixels are
only the selected donor-region meshes. Both models retain their own root,
skinned meshes, armature, inverse binds, and anonymous source-local clip 00.
The manifest records exact source membership, uniform normalization, complete
frame bounds, conservative world-AABB collision pairs, attachment gaps, seam
variation, pose-trace hashes, per-pixel hashes, partial/completion state, and
per-region `PASS`/`REFUSED` truth.

No region passed every gate. At rest, head/torso/right arm/left leg/right leg
measure 17/6/1/10/6 conservative collision pairs. Left arm is collision-free
at rest with a 0.017122 m attachment gap, but its own-skeleton animated samples
separate by as much as 4.539550 m and fail seam stability. Auxiliary has no
isolated donor part. The diagonal animated pixels visibly preserve rather than
hide that divergence. Item 7 is therefore complete as evidence-backed
`REFUSED`: `passingRegions` is empty, modular World rendering remains disabled,
and no donor GLB, whole-donor fallback, foreign skeleton, rebind, semantic clip
mapping, or modular runtime path was activated.

Retained authority is
`artifacts/avatar-replacement-evidence/modular-dog-01-dog-02-v1/`.
`modular-pair-evidence.json` SHA-256 is
`f8da8aed7fc51434ed39e3a62e54937709496182241d42ed1ebc8699c94bf2f3`;
the offline viewer SHA-256 is
`65a385f5dff2c128d2dae096a9ed8bd6edd31bb9b66b1c4437bde40eb6ef0c0b`;
the inspected full-page contact sheet SHA-256 is
`ec93c70d328b8360669db064a75aa07d99d3f03d173683031f59d06356cf881f`.

Worker proof passed 8/8 Python evidence/catalog cancellation integration tests,
26/26 imported-avatar Vitest tests, deterministic intake/source checking with
69 files and zero copy mismatches, root typecheck 38/38, architecture 11/11,
production build 20/20, and isolated imported-avatar Playwright 3/3. Python
compilation, lint, and `git diff --check` also passed.

Independent parent verification reran the same 8/8 Python tests, 4 files / 26
Vitest tests, deterministic source intake, root lint, typecheck 38/38,
architecture 11/11, build 20/20, and isolated Playwright 3/3. Parent pixel
inspection confirmed all seven region rows, complete rest assemblies, distinct
blue base/orange donor pixels, and the animated multi-meter separations that
support refusal. Parent found one closeout-only defect: `PROJECT_STATUS.md`
failed Prettier. The same Codex thread formatted only this file; parent retest
then passed Prettier and `git diff --check` without changing the path set.

The post-slice worktree is 589 porcelain paths: the inherited 553 plus exactly
36 new item-7 paths, with 28 tracked modifications, 561 untracked, and zero
staged. Verification refreshed eight inherited browser screenshots and touched
the inherited untracked `apps/web/test/imported-avatar-ui.test.tsx`; no inherited
path was removed, no status code changed, and deterministic intake reconfirmed
that source assets were unchanged. Parent verification is complete; user
first-hand acceptance remains pending. No Git delivery, service mutation,
semantic/modular activation, later-phase work, or original-AgentIntersect work
occurred.

## 2026-07-31 product rebaseline — complete avatars active, modular deferred

The operator selected complete imported avatars as the active product path for
both users and agents. Cross-model modular composition is retained only as a
possible later feature with no roadmap commitment. The rejected
`dog-agent-01`/`dog-agent-02` evidence, versioned modular data shape, and
fail-closed World refusal remain dormant compatibility/research material; they
are not current acceptance requirements.

The normal builder now exposes one `Use Complete Avatar` action and no mode
switch, donor palette, slot controls, disabled modular button, or “verification
pending” modular copy. User-facing summaries say `Complete`. A dormant modular
profile remains parseable but cannot be saved until the operator explicitly
converts it to the complete base avatar. No modular runtime renderer, rebinding,
foreign-skeleton animation, or silent complete-donor substitution was enabled.

The behavior was developed RED → GREEN. Final verification passed the four-file
imported-avatar suite at 27/27 tests, root lint, typecheck 38/38, architecture
11/11, production build 20/20, and the isolated imported-avatar browser suite at
3/3 journeys. Refreshed desktop and mobile evidence shows the complete-avatar
CTA, full user/agent GLB previews, no modular controls, and no horizontal
clipping. The canonical avatar scope was rebaselined and the older builder scope
marked historical. No commit, staging, push, release, deployment, later-phase
work, protected-service mutation, or original-AgentIntersect edit was performed.

## 2026-08-01 semantic correction and agent movement — technical partial safe pause

The retained browser/profile records did not identify the manually tested model;
no model ID was guessed or special-cased. A deterministic semantic review v2 now
contains all 276 model/semantic decisions. Direct temporal review supports 69
locomotion mappings (`Idle`, `Walk`, `Run` for 23 models); the other 207 gesture
mappings are `ambiguous`. Runtime accepts only `pass` with the reviewed expected
clip index and refuses every missing, divergent, `wrong_clip`, `ambiguous`, or
`unsupported` decision. Consequently the reported Jump/Dance/Laugh mismatch
class cannot play a wrong substitute, but no gesture is ready for visual
acceptance without stronger semantic evidence.

Actor-local animation generations now make movement cancel one-shots, make the
latest valid slash or stationary agent cue win, ignore stale completions, return
stopped actors to model-local Idle, and prevent cancelled actions from resuming.
Recognized slash commands remain local-only; unknown slash text remains ordinary
chat.

World-owned agent movement now validates versioned coordinate, relative,
follow/approach-user, and stable repository-object requests. It owns position,
heading, velocity, destination, source, and state; integrates bounded elapsed
time; drives model-local Walk/Run; cancels cues; returns Idle on arrival or
cancellation; and emits truthful lifecycle states. Explicit user direction
preempts/suspends autonomy, same-priority requests replace older work, and
autonomy resumes only after explicit priority releases. Repository targets fail
closed on missing/stale authoritative IDs or approach points, and free-form
assistant prose cannot mutate transforms.

Technical verification passed deterministic avatar checks (23 models / 276
decisions), focused behavior (9 files / 106 tests), architecture (11/11), lint,
typecheck (38/38 tasks), the serial functional suite excluding only the paused
Phase 18.5 validator (124 files / 734 tests), production build (20/20 tasks),
and production-static Playwright (4/4). The browser proof found and then fixed an HTTP-origin
`crypto.randomUUID` incompatibility with a tested `getRandomValues` fallback.

Verdict is `PARTIAL_SAFE_PAUSE`: directed/autonomous movement is technically
ready for parent verification, while 207 gesture semantics remain safely
refused. Parent owns fresh candidate proof; Aaron has not visually accepted this
work. No commit, push, merge, tag, release, publication, deployment, protected
listener mutation, Phase 18.5 resumption, or Phase 19–20 work occurred.

### 2026-08-01 parent correction — normal-World movement command path

Parent inspection found that the movement authority was not reachable from the
normal HUD and that the prior production-static journey did not prove movement.
The correction adds an exact, case-insensitive, outer-whitespace-trimmed local
grammar: `/agent move <x> <z>`, `/agent move
<forward|backward|left|right> <distance>`, `/agent follow [stoppingRadius]`,
and `/agent stop`. Bounds remain the protocol bounds: coordinates `-15..15`,
distance `>0..30`, and stopping radius `0.25..5` (default `1.5`). Recognized
malformed or unsafe `/agent` commands remain local and visibly refused. Unknown
slash strings and ordinary text remain chat.

Valid movement commands build a schema-validated `aiw.world-action/0.13`
proposal containing `aiw.agent-movement/1`, the selected session ID as actor,
source `user-directed`, speed `4`, and the parsed target, then POST through the
existing proposal route. Stop POSTs `{reason:"cancel"}` through the existing
interrupt route and cancels renderer movement only after server success. No
command mutates transforms or reaches Hermes/chat directly. Minimal HUD status
now reports requested, accepted, moving, arrived, cancelled/Idle, refused, and
target-stale truth.

RED captured 2/10 parser tests failing on the absent parser and a transport
suite failing to load the absent module. Focused GREEN is 6 files / 57 tests;
deterministic avatar checks remain 23 models / 276 decisions; typecheck is
38/38, lint is clean, production build is 20/20, and architecture passes its
checker plus 11/11 tests when invoked without the sandbox-blocked `tsx` IPC
wrapper. The full serial suite reached 116 passing files / 705 passing tests,
but 33 tests in 9 files failed only where this restricted worker sandbox denied
loopback listeners or child processes (`EPERM`). The rebuilt production-static
suite lists 4 journeys including the mounted movement journey, but Chromium
could not launch: `sandbox_host_linux.cc:41 ... Operation not permitted`; all
4 journeys therefore remain unexecuted in this worker environment.

Movement correction verdict is `PARTIAL_SAFE_PAUSE` until the parent reruns the
full suite and the mounted production-static movement journey in the supported
environment. Semantic gesture verdict remains the separate
`PARTIAL_SAFE_PAUSE`: 69 locomotion passes and 207 ambiguous gestures fail
closed. Aaron has not accepted either item.
