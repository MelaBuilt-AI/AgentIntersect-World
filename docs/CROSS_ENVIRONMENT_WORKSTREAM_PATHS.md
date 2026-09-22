# Cross-environment Workstream paths

## Contract

World and the connected agent may use different filesystem namespaces. Keep the
server-owned worktree/report paths for authority, persistence and previews; render
agent instructions with the selected registration's native paths. Never rewrite
arbitrary task prose, relocate a project, rewrite a linked `.git` file, or bypass a
harness sandbox to make a mapping appear supported.

This correction applies to Hermes, OpenClaw, Codex and Claude Code through the
shared registration/gateway path. Legacy unregistered adapters retain their
existing same-environment contract.

## Supported mappings and limits

- WSL `/mnt/c/...` (and other mounted drive letters) → native Windows `C:\...`.
- Native Windows drive paths → WSL `/mnt/c/...`.
- WSL-private `/home/...` → native Windows
  `\\wsl.localhost\<source distro>\home\...`, subject to actual access and harness
  support.
- Windows WSL UNC paths, including `\\wsl$\...`, → the matching WSL distro.
- Same-environment absolute paths remain unchanged. Shared Windows-drive paths
  work across WSL distributions; another distro's private Linux root is not
  treated as the current distro's identically named path.
- Relative/drive-relative paths, unmounted network shares and unavailable mappings
  fail explicitly. Shared file access must be verified, not inferred from syntax.
- Native Windows Codex retains its drive-backed **owned workspace and report
  directory** requirement. UNC refusal recommends shared Windows storage or WSL
  Codex. This is not a blanket claim that every WSL-hosted source repository is
  unusable when its allocated worktree is on a shared drive.

## Dispatch and reporting

Before accepting a bound native turn or firing work-start callbacks, the gateway
checks target access to its owned directory and, for coding, its evidence
directory. Cross-environment checks compare a disposable challenge in the same
files and verify native write access for coding; challenge files are removed.
Failures preserve the session and return useful environment guidance rather than
poisoning the native session.

The authoritative Workstream context is freshly rendered through the path mapper,
including the exact receipt filename, before JSON quoting. Earlier host-only
context cannot override it. Discussion gets the same native worktree identity but
no permission to resume coding or rewrite reports.

The bridge resolves native `GIT_DIR`, `GIT_COMMON_DIR` and `GIT_WORK_TREE` without
changing Git configuration. CLI processes inherit them. Hermes/OpenClaw transports
have no per-turn process-environment field: the same verified native values are
included in their context for per-command/delegated-worker use. This is tool
instruction, not an OS sandbox or a fabricated HTTP API capability.

Host cwd and target-native cwd stay distinct. OpenClaw's directory instruction
uses the native spelling. Native Windows, Git Bash drive paths, UNC paths and
POSIX tool locations inside the exact owned root become repository-relative
activity paths; outside-root locations are not relabeled as repository files.

Reports prefer native file-writing tools at the exact mapped path, without
assuming `python3`, `node` or a global `/tmp` location. Claude gets only the owned
evidence directory via its supported `--add-dir` option; normal deny rules remain.
This does not install runtimes, modify protected profiles, or guarantee that an
agent will follow every instruction or that arbitrary project dependencies exist.

Claude failures now distinguish malformed JSON, rejected event categories,
nonzero process exits and incomplete completion results. Raw stderr, prompts,
credentials and arbitrary event names are not exposed; strict protocol,
quarantine, cancellation and output limits remain intact.

## Verification and scope

Focused regressions first reproduced the missing all-harness native context,
missing report-access preflight, wrong OpenClaw cwd, missing Claude evidence grant,
relative/drive-root mapping gaps, native file-activity projection and generic
terminal diagnostics. Mapping tests cover drive paths, Unicode/spaces, matching
and mismatched distro identities, UNC aliases, and native Codex refusal.

A disposable native Windows Python / Windows-launched WSL subprocess probe checks
actual file read/write and exact bytes in both Windows-drive and WSL-private
storage. A native Windows Git probe checks the same linked-worktree HEAD through
mapped Git metadata. These prove native filesystem/bridge behavior, not four live
provider conversations or full Windows-backend application acceptance. External
provider transports are doubles in the shared regression tests. No scripted World
navigation or protected-session replay is part of this correction.

The failed TEST45415, its successful homepage edit and quarantined native session
remain untouched. This code is a local follow-up atop PR23 plus the accepted
New Workstream source-state/copy changes. No commit, push, merge, provider change,
installation, or automatic repair of historical session state is implied.
