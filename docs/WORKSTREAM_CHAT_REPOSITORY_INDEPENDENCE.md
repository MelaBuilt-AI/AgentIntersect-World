# Workstream discussion is independent of the displayed repository

## Scope

Aaron reported chat becoming unavailable after continuing Claude Testing 921,
refreshing World, and loading Clone test. The retained Workstream still belonged
to the first project. The gateway resolved its directory through the repository
currently displayed and failed before native dispatch. This affected the shared
path, not only Claude.

Aaron authorized a new PR covering Hermes, OpenClaw, Codex and Claude Code, then a
separate fresh operator test. Existing failed TEST45411 and its saved work remain
untouched. No merge, provider changes or native-session replay are authorized.

## Correction

- Carry discussion/work intent through the shared directory resolver.
- For discussion, remeasure the already-attested owned binding against its own
  repository, registered worktree and branch, rather than the floor selection.
  Preserve its directory, native identity, task, files and report state.
- When no in-memory owned binding exists, use the existing selected-repository
  restore path. This does not grant arbitrary attachment or broaden restart
  recovery: first restoration still needs the correct project/explicit saved-work
  continuation.
- Coding retains the selected-repository restore guard. Switching the displayed
  repository never silently transfers work or permits cross-project coding.
- Failures while resolving Workstream directory/context return a recoverable
  conflict before dispatch or work lifecycle callbacks. They do not mark a
  healthy native session failed or emit a false native-turn error. Real adapter
  failures retain the existing error handling and busy-guard cleanup.

No renderer/frontend, provider-specific permission, protocol-schema, filesystem
boundary or persisted-store format changes are needed.

## Verification

- All four harness IDs reproduced the original repository-mismatch failure.
- Shared real gateway/store/Workstream/Git-authority regressions cover discussion
  while viewing another project, no selected project and switching back; retained
  native/work identities, exact uncommitted bytes and unchanged Workstream
  records; rejected cross-project coding followed by successful discussion;
  wrong-branch refusal and recovery.
- Real loopback HTTP route tests exercise the same conflict/discussion sequence
  for every harness ID. Native adapters are explicit test doubles here, not claims
  of four live provider conversations.
- A separate real-Git saved-work test continues a worktree from an older World
  state root, switches repositories, and preserves the original discussion cwd.
- Existing gateway/Hermes, Claude, Codex, OpenClaw, saved-work and production
  startup suites pass alongside the focused regressions. Exact final full-gate
  and CI receipts are recorded in the PR/external test kit.

The first attempted extension of the older production-startup fixture assumed a
successful native turn, but that fixture intentionally lacks the Hermes arbiter
and expects blocked work. That harness timeout was not product evidence; the
extension was removed, leaving the original startup contract intact. The focused
real-listener tests above provide the intended HTTP proof without altering that
fixture or weakening production authorization.

## Operator focus

Continue existing saved work with a connected agent, chat, refresh World, then
load a different repository and chat again. Discussion should still reach that
same agent without moving or rewriting the original work. Coding requires the
correct selected project/Workstream. Prior Claude/prop/Git acceptance remains
scoped; the fresh operator verdict is separate from automated contract coverage.
