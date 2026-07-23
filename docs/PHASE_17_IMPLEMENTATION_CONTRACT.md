# Phase 17 Implementation Contract

Status: **PARENT/FRESH VERIFIED / USER ACCEPTANCE PENDING**

This contract implements only the user-authorized Phase 17 recovery slice
frozen in `docs/PHASE_17_SCOPE.md`. Phase 18 is unauthorized and not started.

## Architecture

- `@agentintersect-world/observability` owns the
  `aiw.observability/0.17` schemas, exact capability order, bounded records,
  deterministic readiness derivation, canonical checksums, and diagnostic
  privacy guards.
- `Phase17Service` owns one explicit local state root. It uses checksummed
  `current` and `previous` snapshot envelopes, atomic same-directory writes,
  a bounded JSONL event ledger, corrupt-current preservation, managed local
  JSON/Markdown exports, and World-owned child tracking.
- Fastify routes expose inspection, bounded drill operation lifecycle,
  recovery preview/apply, and diagnostic preview/export/delete using the
  service directly.
- The recovery CLI constructs the same `Phase17Service`; it contains no
  independent recovery rules.
- The lazy React Diagnostics & Recovery panel uses only production API
  responses. Its unavailable state is explicit and does not claim readiness.
- The measurement fixture creates a disposable exactly-two-agent Git
  repository/worktree topology, drives production Fastify boundaries, and
  writes the bounded tracked verdict artifact.

## Authority and invariants

- Inspection and recovery preview perform no authoritative state mutation.
- Apply requires exact repository/session/revision/operation correlation and
  explicit operator approval. Reconciled replay is accepted only for the
  persisted original approved request revision.
- Production operation termination additionally requires exact matching
  route-path/body operation identity. The current revision and recorded
  World-owned child PID are validated before the child is signaled.
- A missing completion stays missing. Interruption/orphan classification never
  becomes success.
- Recovery can change only Phase 17 derived records and owned-process
  bookkeeping. It never runs Git merge/reset/clean/checkout, deletes a
  worktree, edits repository content, or kills an unowned/protected process.
- Repeated apply/export/delete returns explicit idempotent truth only for the
  persisted original request binding.
- The staged Phase 15 voice provider remains `unavailable`; it is not
  activated and does not block the seven non-voice rows.

## Persistence and privacy

- Event, incident, export, and bundle ceilings are respectively 512, 32, 3,
  and 1 MiB.
- One contained-target rule validates all managed paths, including current,
  previous, ledger, and persisted-preview files, before read/write/delete.
  Fixed-file target symlinks return `unsafe-path`; previous-state rotation uses
  validated same-directory atomic content replacement.
- Diagnostic payloads contain allowlisted summary fields only. Raw prompts,
  transcripts, persona/memory content, environment values, secrets, raw
  diffs/source, and absolute paths are forbidden.
- Export requires a matching checksummed safe-preview receipt in the managed
  state root. Its persisted record binds the original preview/request revision.
  Replay revalidates both local files, total bytes, combined checksum, JSON
  structure, and diagnostic safety.
- Deletion requires exact identity, export ID, expected revision, and approval
  before mutation. Recorded deletion persists its original request revision;
  replay removes a reappeared exact file if present and re-proves both absent.
  Unrecorded IDs are revision-validated before their exact contained pair is
  inspected or removed.
- Caller-provided summaries redact bounded POSIX absolute paths, Windows drive
  paths, UNC paths, secret assignments, and secret/persona/memory canaries
  while preserving safe repository-relative labels.
- Corrupt current bytes are copied into the managed evidence directory before
  prior verified truth is projected as `previous-recovered`.

## Closeout boundary

Independent parent verification and disposable fresh-copy proof are green.
The implementation commit's exact-SHA CI is an external GitHub status/final
closeout record because a tracked file cannot self-reference its own future
commit. Explicit user acceptance remains the final seal gate. No tag, release,
publication, deployment, visibility change, provider activation,
profile/sibling-repository change, or Phase 18 work is authorized here.
