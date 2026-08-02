# Avatar Replacement — Complete-Avatar Path and Deferred Research

Status: complete-avatar animation manual correction required; agent movement authorized next; modular composition deferred

Frozen: 2026-07-30

Rebaselined: 2026-07-31

## Manual animation failure and next-session authority — 2026-08-01

Aaron's first-hand manual test supersedes the prior technical-green semantic
claim. The tested avatar animates, and Walk and Run are accepted as correct.
The animation slice is nevertheless **manual FAIL** because Jump appeared to
use Angry, `/dance` appeared to use Turn, and `/laugh` appeared to use Dance.
Aaron reasonably expects more mismatches. Structural validity, clip duration,
channel motion, triptych differences, and 276/276 resolver coverage therefore
do not establish semantic correctness. Every one of the 23 x 12 mappings must
receive explicit semantic review; wrong, ambiguous, unsupported, or unreviewed
mappings fail closed rather than substituting a plausible-looking clip.

The next implementation session is authorized to correct these mappings and
add actor-local animation precedence:

- movement immediately cancels that same actor's active one-shot and selects
  model-local Walk/Run;
- a newer valid slash command immediately cancels the prior user one-shot and
  starts the latest command;
- a newer agent cue may replace a prior stationary agent cue, while agent
  movement cancels the cue and remains authoritative;
- stale completion callbacks from cancelled/replaced actions cannot clear or
  restore older state;
- cancelled one-shots never resume when movement stops; the actor returns to
  model-local Idle.

Aaron also authorizes agent movement as next-session product scope. World must
own authoritative agent position and movement state. Agents must be able to
follow explicit user directions about where to go, choose bounded movement
through validated agent-AI World actions, and eventually target stable
repository-object IDs once those objects and authoritative approach points
exist. Explicit user direction outranks autonomous movement. Unsafe,
unreachable, stale, or missing targets fail visibly without renderer-only
position mutation. Repository-object targeting remains a tested future seam
until stable object identity/layout authority exists.

The actionable implementation order, exact paths, tests, and verification are
frozen in
`.hermes/plans/2026-08-01_113554-avatar-semantic-correction-and-agent-movement.md`.
No correction or agent-movement implementation started in this end-session
turn. Phase 18.5 remains paused; Phases 19-20, Git delivery, release, and
publication remain closed.

## Complete-avatar animation-completion addendum — 2026-08-01

Aaron explicitly authorizes completion of the already-specified World animation
surface for complete original avatars before any later product milestone. This
is a functionality-first RED-to-GREEN vertical slice. Modular composition
remains deferred.

Acceptance is frozen as follows:

- All 23 selectable avatars resolve evidence-reviewed, model-local clip indices
  for `Idle`, `Walk`, `Run`, `Jump`, `Dance`, `Clap`, `Cheer`, `Wave`, `Bow`,
  `Agree`, `Angry`, and `Laugh` from their own GLB, skeleton, and root. Runtime
  authority requires deterministic structural checks plus bounded direct
  visual/temporal evidence for every one of the 23 x 12 mappings. Missing or
  ambiguous mappings fail closed as `EVIDENCE_REFUSED`; labels, stable indices,
  durations, or cross-model correspondence alone remain insufficient.
- Every user avatar animates evidence-backed `Idle`, `Walk`, and `Run` from
  authoritative World movement. `StartWalk` and `StopWalk` map into that state,
  Shift selects `Run`, transitions use crossfades bounded to 0.22 seconds, and
  cloned runtime clips remove Hip/root travel only at runtime so World position
  remains authoritative and cached source clips remain immutable.
- Every agent avatar has a verified non-T-pose `Idle`. If the current World
  exposes authoritative agent locomotion, verified model-local `Walk` and `Run`
  are mapped too; this authorization does not add autonomous navigation.
- Space triggers exactly one user `Jump` only while the active World owns
  keyboard input. Repeat and re-entry are suppressed. Space is neither consumed
  nor animated in `input`, `textarea`, `select`, contenteditable, setup, dialog,
  Escape-menu, or inactive modes.
- `/dance`, `/clap`, `/cheer`, `/wave`, `/bow`, `/agree`, `/angry`, and `/laugh`
  are exact local-only commands after outer-whitespace trimming and
  case-insensitive matching. Recognized commands animate locally and never enter
  Hermes, FIFO, or chat transport; unknown slash text remains ordinary chat.
- Visible agent text/application events project deterministic one-shot cues by
  the ordered table already frozen below. The UI and observability describe the
  result as a projection, never as inferred emotion or intent.
- One-shots play once, reject re-entry, and crossfade cleanly to current
  locomotion or `Idle`. Reduced-motion completion remains truthful and cannot
  trap one-shot state.
- Bounded DOM/debug observability exposes participant/model, current semantic,
  cue source, resolved model-local clip index and name, action/mixer progression,
  and refusal/error truth without private paths. Loading, WebGL, and
  missing-mapping failures stay explicit; a static T-pose is never reported as
  completed animation. Normal World UI remains the minimal chat/push-to-talk
  surface rather than gaining an admin panel.

The evidence deliverable is a new bounded tree under
`artifacts/avatar-replacement-evidence/world-animation-completion-v1/`. It must
identify all 276 model/action mappings, expose duration/channel/motion evidence,
and provide reviewable representative temporal samples or production-browser
motion/contact-sheet evidence without creating an unbounded frame corpus.

Source and usage authority is also corrected by Aaron in this addendum. The
models were generated by Aaron under his Tripo3D subscription and provided
locally. Aaron explicitly confirms unrestricted use for AgentIntersect World,
including private use, public use, and redistribution. Intake classification
remains `user-provided-local`; the canonical machine value for the supplied
usage status is
`tripo3d-subscription-user-confirmed-unrestricted-use`. This records the
operator's generation source and grant without asserting an independent
third-party legal opinion. Model bytes must not change.

Non-goals remain: cross-model clip reuse, retargeting, rebinding, donor
composition, GLB or mesh/source mutation, autonomous agent navigation, modular
composition, broad asset production, Phase 18.5 resumption or evidence rebind,
Phases 19-20, voice/live-coding expansion, provider/profile/Hermes changes,
protected-service changes, dependency changes, original-AgentIntersect or
sibling-worktree changes, and every Git/external delivery action.

## Operator-correction addendum — 2026-07-31

Aaron authorized a bounded complete-avatar closeout correction after first-hand
testing exposed two authoritative product defects. This addendum freezes that
correction without rewriting the historical evidence below.

- On first entry, a role-valid builder visually preloads the deterministic first
  role-valid complete avatar's actual GLB. A legacy migration with no accepted
  replacement does the same while remaining unsaved. An unsaved complete-model
  draft restores its own visual selection, and an accepted exact-session model
  restores the accepted model. Removed, unknown, and role-invalid IDs retain the
  existing explicit re-selection boundary.
- Preview state is not accepted or persisted state. Preloading or restoring a
  visual draft never writes profile/session data, auto-saves, silently migrates,
  invokes `Use Complete Avatar`, or bypasses exact-session consent. Stance images
  remain catalog-card material and never replace the selected 3D panel. Text-only
  and no-WebGL fallbacks remain truthful and load zero GLBs.
- Desktop and narrow layouts must contain the model, name badge, copy, controls,
  status, and focus treatment without contradiction, overlap, clipping, or
  horizontal overflow. Enabled actions remain blue and unavailable actions grey.
- World animation is enabled only through evidence-backed, model-local mappings.
  Each selected model uses its own root, scene clone, skeleton, source clips,
  mixer, and actions. Runtime-only clips are cloned before Hip/root travel removal;
  cached source clips and source GLBs remain immutable. The user transitions
  `Idle` -> `Walk` -> `Run` -> `Idle` from authoritative movement with bounded
  0.22-second crossfades. A stationary agent may use only its own verified
  non-T-pose `Idle`.
- Anonymous names, indices, durations, shared hierarchy, another model's evidence,
  or apparent catalog correspondence are never semantic proof. Every evaluated
  model/action ends as evidence-backed `PASS` or honest `EVIDENCE_REFUSED`, with an
  observable static/refusal fallback for unresolved mappings. Technical GREEN
  requires at least one complete user model with its own `Idle`/`Walk`/`Run` when
  supported and one complete agent model with its own non-T-pose `Idle`, plus
  temporal browser evidence that both independent mixers/actions advance and
  relevant bones change without doubled root travel.
- Autonomous agent locomotion, one-shots, gestures, Space Jump, slash commands,
  expression cues, modular composition, retargeting, rebinding, mesh/source edits,
  broad asset production, Phase 18.5, Phases 19-20, voice, live coding, protected
  runtime/profile changes, external delivery, and Git delivery actions remain out
  of scope.

## Product decision — 2026-07-31

Users and agents choose complete imported avatars. The normal builder exposes no
modular mode or donor-region controls. `Use Complete Avatar` selects the full
original GLB, and only complete original selections may be saved through the
normal builder.

Cross-model modular composition remains a **possible later feature**, not an
active deliverable or pending acceptance requirement. Its versioned data shape,
fail-closed World refusal, deterministic evidence tooling, and the rejected
`dog-agent-01`/`dog-agent-02` study remain dormant compatibility/research
material. A dormant modular draft cannot be saved until the operator explicitly
converts it to the complete base avatar. No roadmap date or implementation
commitment is implied.

The sections beginning with “Deferred modular research contract” preserve the
safety requirements that would govern any separately authorized revisit. They
do not describe current product behavior.

## Timeboxed implementation truth — 2026-07-30

This document records both the active complete-avatar product path and the
evidence boundary that caused modular composition to be deferred. The bounded
worker slice implemented the following:

- deterministic inspection and copied-byte verification for all 23 GLBs and 23
  stance thumbnails; all 23 GLBs total 328,671,832 bytes and all 69 supplied
  source files matched the external intake hashes when present;
- deletion of the three replaced GLBs/thumbnails, an exact 23-ID product
  registry, repository-relative runtime URLs, and an offline-capable
  deterministic `--check`;
- version-2 original/modular allowlisted persistence retained for compatibility,
  role-valid original selection, agent consent transport, stale removed-ID
  re-selection without a hydration write, and explicit unsupported-region
  refusal;
- six user and seventeen agent stance-card buttons, a card-activated separate
  GLB preview, explicit `Use Complete Avatar`, text/no-WebGL zero-GLB behavior,
  no modular controls in the normal builder, and
  complete-original World rendering;
- a representative raw 21-clip pose sheet and full deterministic
  motion/channel evidence. The proposed semantic labels remain
  `parent-visual-verification-pending`.

The following contract portions are deliberately **not implemented** in this
timeboxed slice:

- Modular composition is deferred and absent from the normal builder. The data
  contract and per-slot evidence/refusal records remain dormant, but the layered
  multi-root renderer is not implemented. A modular profile entering World is
  shown a truthful semantic refusal and loads no donor or custom substitute.
- Candidate semantic labels are retained only in the full inspection manifest
  for visual review. The runtime resolver refuses them, and World renders an
  original in an observable `unverified-static-pose`; it does not claim an
  anonymous source clip as Idle, Walk, Run, or an expression.
- Consequently Space Jump, the eight local slash gestures, synchronized
  semantic actions/crossfades, and automatic agent expression cues are not
  implemented.
- Browser proof covers user original selection/persistence, agent original
  consent and World rendering, stale-ID re-selection, separate preview, and
  no-3D lazy loading, replacement-aware Escape-menu Change Avatar, reset,
  logout, focus ownership, and reload. Mixed modular journeys are removed from
  current acceptance because modular composition is deferred.

Parent inspection completed for the complete-avatar path and the modular refusal
evidence. Semantic labels remain unverified and unavailable. The operator then
selected complete-avatar choice as the active product direction and deferred
modular composition for possible later research.

This document supersedes `docs/IMPORTED_AVATAR_BUILDER_SCOPE.md` for the
replacement-avatar experiment on `experiment/imported-avatar-models`. It
authorizes only the bounded vertical slice described here. It does not waive or
resume Phase 18.5, authorize Phase 19 or 20, or authorize external delivery,
provider changes, protected-service changes, or work in the original
AgentIntersect repository.

## Replacement authority, families, roles, and stable IDs

The repository-owned replacement registry is the only authority for imported
avatar selection, preview, persistence, session transport, and World rendering.
It contains exactly 23 replacement assets:

- User originals, available as complete models only to the `user` role:
  `user-male-01`, `user-male-02`, `user-male-03`,
  `user-female-01`, `user-female-02`, and `user-female-03`.
- Agent originals, available as complete models only to the `agent` role:
  `cat-agent-01` through `cat-agent-07`, `dog-agent-01` through
  `dog-agent-05`, and `robot-agent-01` through `robot-agent-05`.
- Dormant modular research metadata spans all 23 assets. It is not exposed as a
  product choice and does not imply donor-region compatibility; the evidence
  and refusal rules below remain authoritative.

The replaced IDs `cat-agent`, `futuristic-robot`, and `user-male`, their GLBs,
their thumbnails, and their URLs are removed from normal product assets and the
registry. They are never requested or retained as fallback models.

## Source preservation, provenance, copying, and hashes

- The five supplied source folders are read-only input. Intake never modifies,
  renames, rewrites, deletes, or emits generated sidecars into them.
- Intake provenance remains `user-provided-local`. Aaron generated the models
  under his Tripo3D subscription and explicitly confirms unrestricted use for
  AgentIntersect World, including private/public use and redistribution. The
  stable supplied-usage value is
  `tripo3d-subscription-user-confirmed-unrestricted-use`; this records Aaron's
  grant without inventing an independent third-party legal opinion.
- Every supplied GLB and matching stance image is copied byte-for-byte into the
  product under its stable sanitized ID. The stance image is the card thumbnail.
  T-pose images remain source/evidence references and are not runtime payload.
- Deterministic repository records bind each copied file to its SHA-256 and byte
  size and record the corresponding source SHA-256. Copy validation requires
  exact byte/hash equality when private sources are present.
- Runtime/browser manifests contain product-relative URLs and public inspection
  metadata only. They never disclose drive letters, mount paths, usernames, or
  private source paths.
- Source-present checks compare all supplied source files with the external
  intake inventory. Repository-owned `--check` remains deterministic and
  complete when the private source folders and external inventory are absent.
- The frozen Phase 18.5 fingerprint validator is neither weakened nor rebound
  to replacement assets.

## Intake and deterministic inspection

For every asset, repository-owned inspection records:

- stable ID, family, number, original role, provenance, and license status;
- copied GLB/thumbnail URLs, SHA-256 values, and byte sizes;
- GLB validity and declared asset version;
- nodes, meshes, primitives, skins, joints, materials, images, and animations;
- source clip index, anonymous source name, duration, tracks/channels, animated
  targets/properties, motion/pose evidence, and the semantic mapping described
  below;
- skeleton name/hierarchy, rest-pose, inverse-bind, and compatibility
  fingerprints;
- mesh/part inventory, transforms, bounding box, and normalization;
- stable semantic region membership and positive isolation/refusal evidence.

Generation is deterministic. `--check` compares generated repository metadata
with checked-in metadata and fails on drift, missing assets, unexpected assets,
hash mismatch, invalid GLB structure, incomplete mappings, ambiguous stable
parts, or private path disclosure.

## Removed IDs and stale-profile behavior

- Persisted replacement state is allowlisted and versioned. A saved profile
  referencing a removed, unknown, role-invalid, or malformed imported ID is
  invalid replacement state.
- Invalid replacement state never fabricates a fallback and never fetches the
  removed URL. The entry/setup and Escape-menu Change Avatar journeys enter an
  explicit “avatar re-selection required” state and prevent World entry for the
  affected participant until the operator saves a valid choice.
- Hydration may report migration need but does not silently rewrite profile
  storage, consent/session data, or native Hermes history. Only the operator’s
  explicit save writes the replacement selection.
- Existing generated/custom profiles outside the removed imported IDs retain
  their previously accepted preservation boundary.

## Builder and selection flow

- User setup presents six stance-image cards. Agent setup presents seventeen.
  Cards are native buttons or equivalent keyboard-operable controls and expose
  the family and ordinal in their accessible names.
- Before activation, stance imagery is the preview. Activating a card selects it
  and opens that asset’s actual GLB in a distinct, labeled 3D preview panel,
  separate from the card grid and card image.
- The preview truthfully exposes loading, ready, static/no-3D, and error states.
  It never substitutes another model after an error.
- `Use Complete Avatar` selects the complete source model with no part hiding or
  donor loading. Normal builder UX exposes no mode switch, donor palette, slot
  control, or “verification pending” modular option.
- A dormant modular profile is preserved fail-closed for compatibility, but its
  save action is disabled until the operator explicitly converts it to the
  complete base avatar.
- Modular slot metadata (`head`, `torso`, `left-arm`, `right-arm`, `left-leg`,
  `right-leg`, and `auxiliary`) is research-only. Unsupported donor/slot
  combinations never trigger a complete-donor substitution.
- Browser/profile/session input persists only stable allowlisted model IDs,
  stable slot IDs, stable part IDs resolved by the manifest, and the versioned
  selection below. Raw URLs and scene node names are never profile input.

## Versioned persistence contract — modular branch dormant

`avatarSource` version 2 is a tagged union:

```ts
type ImportedAvatarSourceV2 =
  | {
      readonly kind: "imported";
      readonly version: 2;
      readonly mode: "original";
      readonly modelId: ReplacementAvatarModelId;
    }
  | {
      readonly kind: "imported";
      readonly version: 2;
      readonly mode: "modular";
      readonly baseModelId: ReplacementAvatarModelId;
      readonly slots: Readonly<
        Partial<
          Record<
            ReplacementAvatarSlotId,
            {
              readonly donorModelId: ReplacementAvatarModelId;
              readonly regionId: ReplacementAvatarRegionId;
            }
          >
        >
      >;
    };
```

The modular branch remains parseable for compatibility and evidence tests, but
normal builder save and World rendering remain fail-closed. It is not a current
user or agent choice. Complete original selections continue to survive browser
save/reload, agent consent/session transport, World entry, and Escape-menu
Change Avatar without relaxing native-session preservation.

## Deferred modular research contract — safe layered-skeleton composition and compatibility

- A selected region always retains its source scene, root, skinned meshes,
  skeleton, inverse bind matrices, and source-local animation action.
- Each unique donor is loaded once and cloned with `SkeletonUtils.clone`. A
  skinned mesh is never rebound, reparented onto another model’s skeleton, or
  driven by another model’s clip.
- Donor roots are siblings under a normalized stage wrapper. Stable selected
  region parts are visible; all unselected parts are hidden. Loading and cleanup
  are bounded per unique donor.
- Every model has distinct rest-pose and inverse-bind evidence. The 22 models
  sharing the 41-joint name/hierarchy shape are therefore in a structural
  inspection class, not a bind-compatible class. Safe cross-model composition
  remains layered only.
- `cat-agent-01`, with its distinct 42-joint hierarchy, is the separate
  `cat-agent-01-42-joint` compatibility class unless later derived evidence
  proves a narrower fact. It still participates only through layered
  composition.
- Region support requires deterministic mesh/primitive membership evidence that
  isolates the semantic region without overlapping required core geometry,
  unacceptable gaps, or a part needed by another selected slot. If evidence is
  missing, mixed, overlapping, or seam-invalid, the manifest marks the
  donor/slot unsupported with a stable reason and the UI refuses it.
- No name/hierarchy similarity, shared index, thumbnail appearance, or duration
  coincidence is bind-compatibility evidence.

## Units, origin, axes, scale, and grounding

- The renderer’s normalized stage is right-handed, `+Y` up, with one rendered
  unit treated as one World meter. World forward follows the existing World
  renderer convention and is recorded as an explicit per-asset yaw rather than
  assumed from filenames.
- Inspection records the unmodified source scene transform and bounds. Runtime
  normalization is a wrapper transform only: finite source transforms are
  preserved; a uniform `scale` converts measured source height to the registry’s
  target avatar height; `yawRadians` aligns forward; `offsetX` and `offsetZ`
  center the grounded footprint; and `groundOffsetY` places the lowest supported
  foot/geometry bound at stage `Y=0`.
- Modular roots use the same target height, stage origin, forward axis, and
  grounding plane. Per-donor manifest transforms are applied before the shared
  stage transform. Non-uniform scaling, geometry mutation, bone translation,
  and source-file edits are prohibited.
- Invalid/degenerate bounds, non-finite transforms, or evidence that cannot
  produce stable grounding causes a truthful refusal/error, not guessed scale.

## Semantic clips, motion evidence, and immutability

Every asset has an explicit model-local candidate map and semantic-review
decision for:

`Idle`, `Walk`, `Run`, `Jump`, `Dance`, `Clap`, `Cheer`, `Wave`, `Bow`,
`Agree`, `Angry`, and `Laugh`.

- Anonymous clip labels are never semantically accepted from index or duration
  alone. The v2 review records exactly 23 × 12 decisions with expected clip
  index, rationale, and evidence references. Direct bounded temporal review
  supports only `Idle`, `Walk`, and `Run` for all 23 models (69 `pass`). The
  remaining 207 gesture decisions are `ambiguous`; none is treated as accepted.
- Runtime resolution requires a `pass` decision whose expected clip index still
  matches the generated candidate map. `wrong_clip`, `ambiguous`, `unsupported`,
  missing, and divergent decisions all fail closed without playing a substitute.
- Any cross-model index correspondence is recorded only after the sampled
  evidence proves the same motion class. The three 22-clip variants are mapped
  explicitly; extra clips never shift mappings by assumption.
- Source clip arrays and cached GLTF data remain immutable. Runtime action
  preparation clones clips before root/Hip/Pelvis travel normalization.
- Locomotion preserves semantic `Idle`/`Walk`/`Run`, model-local resolution, and
  bounded crossfades. Original mode resolves one action on one root. Modular mode
  resolves the requested semantic independently through each visible donor’s
  model-local map and starts/crossfades corresponding actions together.
- Valid one-shots use actor-local generations. A newer one-shot replaces an
  older one for that actor, locomotion cancels it immediately, and stale
  completion callbacks are no-ops. Stopping movement returns to model-local
  Idle; a cancelled one-shot never resumes. At this checkpoint all nine gesture
  classes remain review-refused, so the renderer truthfully stays on Idle rather
  than playing an ambiguous clip.

## Global input ownership and local slash commands

- `Space` requests user `Jump` only while the active World room owns keyboard
  input. Until Jump receives a review `pass`, that request is immediately
  refused back to model-local Idle.
- Space is inert in `input`, `textarea`, `select`, and contenteditable targets;
  avatar/identity/session/agent setup; dialogs; the Escape menu; and any other
  inactive mode. `preventDefault()` occurs only when World consumes the key.
  Existing Escape ownership and keyboard journeys remain intact.
- The exact case-insensitive, outer-whitespace-trimmed local-only commands are:
  `/dance`, `/clap`, `/cheer`, `/wave`, `/bow`, `/agree`, `/angry`, and
  `/laugh`.
- A recognized command requests its corresponding local user one-shot, is
  omitted from visible remote chat/FIFO submission, and is never sent to Hermes
  or any agent. Current ambiguous gesture decisions fail closed to Idle.
- An otherwise unknown slash-prefixed string remains ordinary user text.
  Ordinary chat, FIFO/recovery, targeting, and transport remain unchanged.
- The normal World HUD also recognizes only this exact case-insensitive,
  outer-whitespace-trimmed movement grammar: `/agent move <x> <z>`, `/agent
move <forward|backward|left|right> <distance>`, `/agent follow
[stoppingRadius]`, and `/agent stop`.
- Recognized valid movement commands are local-only inputs to the validated
  World action proposal/interrupt routes and never enter chat. Recognized
  malformed or unsafe `/agent` commands are visibly refused locally. Other
  unknown slash strings remain chat.

## Deterministic agent expression cues

Agent expression actions are projections of truthful observable application
events or visible text cues, never unseeded ambience and never represented as
hidden agent intent. The deterministic cue table is ordered and testable:

- greeting visible text (`hello`, `hi`, `welcome`) -> `Wave`;
- explicit agreement (`agree`, `yes`, `correct`, `sounds good`) -> `Agree`;
- completion/celebration (`done`, `complete`, `success`, `great`) -> `Cheer`;
- visible laughter (`haha`, `lol`, `laugh`) -> `Laugh`;
- apology/failure/error text -> `Bow` for apology, otherwise `Angry`;
- explicit applause/congratulation -> `Clap`;
- explicit dance wording -> `Dance`;
- explicit anger wording -> `Angry`.

Boundary-aware matching and the documented precedence resolve collisions.
Application events may invoke the same table directly. Tests prove every action
is reachable. Observability labels the result as a deterministic visible-text
or application-event cue, not a model emotion or model-generated inner state.
After one-shot completion the agent returns to its current truthful activity
locomotion/Idle projection.

## World-owned agent movement

- Versioned browser-safe movement actions accept bounded coordinates, relative
  direction/distance, follow/approach-user targets, and stable repository object
  IDs with layout generations. Validation rejects non-finite values, actor or
  source mismatch, excessive speed/distance/stopping radius, out-of-bounds
  destinations, and stale/hidden/unreachable repository targets.
- World owns each agent's position, heading, velocity, destination, source,
  movement state, and request generation. Integration clamps elapsed time and
  drives model-local Walk/Run from authoritative velocity, cancelling any cue;
  arrival or cancellation selects Idle.
- `user-directed` movement outranks `agent-autonomous`. New same-priority work
  cancels prior work. Explicit movement suspends autonomy, which may resume only
  after the explicit priority releases. Free-form assistant prose never mutates
  transforms.
- Repository targets resolve only through stable object IDs and current
  authoritative approach points. Missing/stale targets return `target-stale`;
  labels, mesh indices, and transient renderer coordinates are never accepted.
- Movement observability reports only requested/accepted/moving/arrived/
  cancelled/refused/target-stale state plus bounded movement fields; it excludes
  transcript and filesystem content.
- The production-static movement journey mounts the normal entry experience,
  injects an accepted autonomous action through the real polling boundary,
  submits a HUD `/agent move` command, validates the proposal body and exact
  actor/source, observes autonomous-to-user preemption and changing DOM position,
  checks locomotion/cue cancellation and lifecycle arrival, refuses an unsafe
  coordinate locally, and submits `/agent stop` to reach Idle without chat
  delivery. Its 2026-08-01 worker execution is pending because the restricted
  worker sandbox denied Chromium launch; parent supported-environment proof is
  still required.

## Accessibility, fallback, loading, and performance

- All cards, complete-avatar controls, preview controls, and save/confirm actions
  are keyboard accessible with visible focus and programmatic names. Deferred
  modular controls are not rendered.
- Reduced motion preserves selection and action state while shortening or
  suppressing visible one-shots/crossfades. It never prevents completion or
  leaves a participant stuck in an action.
- Before card activation, stance thumbnails require no GLB. Text-only/no-WebGL
  paths and static-thumbnail fallback load no GLBs.
- Original preview/World mode lazy-loads exactly one GLB. Modular mode lazy-loads
  only unique donors present in the resolved selection. No hidden donor, refused
  donor, or removed asset is fetched.
- Loading, missing manifest, missing asset, invalid mapping, WebGL unavailability,
  and renderer errors remain distinguishable and recoverable. Retry is explicit
  and bounded; it never loops fetches.
- Bounded DOM/data observability records mode, base/original ID, unique donor
  IDs, resolved slots/regions, current user and agent semantic actions, cue
  source, and per-root resolved clip indices/names without exposing private
  paths.

## Verification and evidence

- New behavior is developed as strict vertical RED -> GREEN. RED output is
  retained in the implementation report for intake/registry, persistence and
  migration, builder UX, safe modular rendering/lazy loading, semantic mapping,
  input/commands/cues, and browser journeys.
- Focused and impacted Vitest runs use Node 24, one worker, and no file
  parallelism.
- Required deterministic checks are replacement intake `--check`,
  source/copy/hash checking when sources are present, Prettier, ESLint,
  typecheck, architecture, production build, and `git diff --check`.
- The broad functional/full suite runs once. The frozen Phase 18.5 fingerprint
  validator may be excluded only when its sole failure remains its pre-existing
  frozen fingerprint contract; that exclusion is reported rather than called a
  full-green run.
- Bounded Playwright journeys cover user complete-avatar selection, agent
  complete-avatar selection, persistence/reload/World render, Escape-menu
  compatibility, no-3D/lazy loading, and stance-card versus
  separate-3D-preview truth. Deferred modular journeys are not a current
  acceptance requirement.
- Screenshots and deterministic labeled pose/contact-sheet evidence are stored
  in a clearly named repository artifact directory. Artifacts contain no private
  paths, credentials, or invented acceptance claims.

## Non-goals and approval gates

- No mesh editing, rebinding, retargeting onto a shared skeleton, source GLB
  mutation, arbitrary node editor, arbitrary URL loading, or silent fallback.
- No modification of native Hermes history, source folders, sibling worktrees,
  protected services, providers, profiles, or original AgentIntersect.
- No dependency installation, protected or long-lived preview, external
  delivery, commit, push, merge, tag, release, publication, deployment, public
  ingress, or visibility change.
- No Phase 18.5 resumption, Phase 19/20 work, voice expansion, broad visual
  production, or unrelated hardening.
- Implementation truth is recorded in `PROJECT_STATUS.md`. Delivery and any
  future modular research remain explicit later authorization gates.
