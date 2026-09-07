# Movement and Code Wheel acceptance

## Accepted scope

Aaron passed movement on 2026-09-06: no-selection follow for both agents, `/agent stop`, and separate explicit mentions. He subsequently reported that the Code Wheel worked perfectly for all tested actions (`1546348979577692250`).

This delivery includes:

- Explicit movement recipients override selection; unknown/ambiguous recipients refuse locally.
- Persistent follow/rest/resume, formation, retargeting, stop and expanded-floor movement coordinates.
- Persistent middle-mouse Code Wheel, cursor placement with edge fitting, left-click actions and nested screen groups.
- Live agent names/selection/clear actions, preserved chat and slash commands, and removal of floating agent controls.
- Streaming-texture bezels and solid UI faces.
- Shared UI/scene input isolation and existing-screen state preservation.
- Nearest clear spatial placement, projected panel/HUD obstruction handling and explicit crowded-view refusal.
- Exact discovery hint above chat: `Press Middle Mouse to open the Code Wheel`. It dismisses after the first eligible opening and returns on a fresh World load, without persisted dismissal.

Local production-browser evidence covers the wheel and hint lifecycle, UI input blocking, screen state, placement/refusal and spatial interaction. The full spatial journey passed three consecutive executions with zero retries before the hint addition; the affected built wheel journey passed after it. These are separate evidence runs, not a single full-suite claim. First-hand acceptance is independent of CI.

## Delivery gate

Aaron authorized this PR to be committed, pushed and merged only after CI and scoped readiness are green (`1546354534559916052`). Readiness means the accepted movement/wheel slice, relevant build/type/lint/test checks, current artifact prerequisites and exact-head push/PR CI—not completion of the deferred integration workflow. Merge uses the expected PR head SHA. No release, publication, visibility change or branch/runtime deletion is implied.

## Next PR: explicitly deferred defects

Aaron explicitly accepted deferring all of the following to the next PR:

1. **Stale-agent roster overlap:** rows overlap the connection form when old sessions are stale. Emptying a test profile is not a layout fix.
2. **Repository/execution binding:** loaded project, owned Workstream Git root and native Codex cwd must agree. The observed empty test repository must receive explicit initialization support or clear refusal, not fallback to the product checkout.
3. **World View integration:** provide the supported local recipe/preview path and truthful readiness instead of a conversational detour to cloud Sites.
4. **Turn failure and recovery:** report timeout/failure accurately, reconcile persisted ready/working state with native execution, and make recovery usable.

The operator's homepage test exposed these integration failures; it did not fail the Code Wheel or modify World source. Codex wrote the homepage and hosting configuration inside candidate session storage. Its native trace reports an external Sites project creation but no version save/deployment; remote cleanup is separate. The failed candidate state is retained outside Git for the follow-up. No integration fixes belong in this delivery.

Full normal-World repository iteration acceptance, Hermes readiness, Slice 6 and Phase 20 remain separate. Final exact-SHA CI/merge receipts are recorded in the PR and external delivery record rather than self-referential commits.
