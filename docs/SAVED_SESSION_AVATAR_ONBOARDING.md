# Saved-session restoration and avatar onboarding

## Scope approved 2026-09-11

One private PR, based on main `7cbb4477cbf4509d16cd63bc51ae2a4a0bd41a1d`.

- Prove saved Workstream restoration preserves files, branch, task, owned worktree and preview without dispatching a replacement coding turn. Fix only demonstrated gaps in this path.
- Simplify the two normal onboarding avatar screens (user and agent) to a name input, image-only avatar choices, selected 3D preview on the right and one confirmation button.
- Exact confirmation labels: `Accept user Avatar` and `Accept Agent Avatar`.
- Use the same animated code-rain artwork as the spatial screens and Code Wheel on both selection panels' surrounding trim/bezel, preserving Reduced Motion and unobstructed controls/preview (Aaron's same-turn addition).
- Every onboarding preview uses its model's accepted semantic Idle mapping, never arbitrary source clip zero.
- Remove other visible descriptions, headings, status prose, buttons, checkboxes and animation selectors from these screens. Preserve invisible accessible names, keyboard selection, validation and explicit persistence.
- Keep actual failures accessible and do not silently accept a failed save. Retain reduced-motion/no-WebGL behavior; do not change avatar assets or World animation mappings.

## Boundaries

Local single-user application; existing native session/worktree authority remains authoritative. No real coding dispatch is needed to prove a read-only continuation. Disposable test repositories/state only; do not use retained operator sessions as test fixtures.

The six inherited residual files, all operator lanes and their served builds, original AgentIntersect, providers/profiles and native history remain untouched. Builds must not overwrite the retained `apps/web/dist` frontend. Internal developer avatar tooling is not part of the requested onboarding cleanup.

Commit/push and opening this PR are authorized. Merge, release/publication, later phases, operator-lane cleanup/restarts and broad redesign are not authorized. Manual visual acceptance belongs to Aaron; automated checks are technical evidence only.

## Evidence

### Implemented

- Normal first-run user and connected-agent onboarding now has only the requested visible controls. Avatar image buttons retain accessible names without printed captions. The separate internal developer editor and in-World Change Avatar flow retain their existing controls.
- Idle comes from each imported model's accepted `semanticClips.Idle.clipIndex`. No clip catalog or animation selector is shown. Reduced Motion freezes the preview and bezel.
- Both choice and preview panels use `02_terminal_rain.webp`, also used by the World screens/Code Wheel. The global music controls are hidden, not unmounted, while onboarding is shown.
- Save remains explicit; preview selection alone does not persist. Required-name validation and disabled/busy save boundaries remain in place.

### Technical verification (2026-09-11)

- **82/82 focused tests passed** across minimal onboarding, imported-avatar UI, World entry UI, Workstream feature loop and production Workstream startup. The model matrix covers all 23 accepted Idle mappings.
- Restart/rebind test uses a real disposable Git worktree and persisted Workstream store: tracked edits, an untracked file, branch/HEAD, task, worktree identity and prior events survive a new service instance and agent-session rebind. Dispatch count stays at the original one; no replacement worktree appears.
- Production HTTP/Git/preview integration extends the existing live-preview continuation test: actual dirty files, task, branch, native-session status, prior events and the same reachable preview survive Continue. Test-owned changes are committed only afterward to retain the pre-existing clean-cancel proof.
- **2/2 production-browser journeys passed**: minimal user/agent onboarding and the normal Workbench saved-work continuation journey. Browser API responses are deterministic fixtures; the HTTP/Git/preview integration above is the real local composition proof. These are not claims that a real external model turn or full-machine restart was exercised.
- Browser checks cover explicit save, invalid-name disablement, exact buttons, rendered selection identity, visible changing preview pixels, matching rain asset, Reduced Motion CSS stop, desktop right-hand preview, 390px portrait containment, visible contained thumbnails, and zero captured page errors.
- The first visual capture exposed inherited mobile card-grid sizing; the corrected production artifact passed the thumbnail geometry regression and direct screenshot inspection. A separate browser RED caught the unwanted music-player controls before the scoped hide rule.
- Web/local-server typechecks, changed TypeScript/TSX lint, production web build and diff whitespace checks passed. Root Turbo typecheck was not counted: its package-manager launcher failed with OS `ENOEXEC`; the impacted package scripts were then invoked directly and passed.
- Full repository CI is separate and must be read from this PR's exact head commit; no full local browser matrix or native hardware/model run is claimed.

Local proof artifacts: `/tmp/aiw-onboarding-proof3/` (JSON result plus desktop/portrait captures); focused test log: `/tmp/aiw-onboarding-final-focused.log`; production build log: `/tmp/aiw-onboarding-build2.log`. Earlier attempts remain separate.

### Aaron's manual acceptance — pending

1. Fresh user onboarding: select avatars, type a name, check Idle and rain trim, then **Accept user Avatar**.
2. Connect an agent: check the same minimal layout, selection and Idle, then **Accept Agent Avatar**. Confirm World entry still unlocks normally.
3. Inspect desktop and narrow-window layout. Check Reduced Motion if used.
4. In disposable/manual work, continue a saved Workstream after leaving/rejoining: inspect actual code, branch, task and World View; confirm no unsolicited coding turn. A full application/machine restart's preview-process relaunch is not established by the retained-live-preview test above.

PR remains unmerged. This technical evidence does not substitute for Aaron's visual or native-session acceptance.
