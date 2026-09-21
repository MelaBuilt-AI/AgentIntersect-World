# Conventional CI and human-led acceptance

## Policy override — PR20 and subsequent work

Aaron explicitly replaced the previous browser-journey requirement on September 21, 2026 (Discord `1551598468483649678`). Automated product-navigation journeys, browser shards and browser-based measurement journeys are **not run or required for GitHub CI or readiness**, including PR20, later PRs and release readiness. Do not silently reintroduce them through aggregate scripts or historical phase instructions.

Functional/visual acceptance uses Aaron's hands-on product use after feature changes and scoped Mr Fluff computer-use checks. Existing acceptance remains valid for unchanged product behavior. This is a deliberate verification-contract change, not a claim that prior browser failures passed or that CI proves subjective visual quality.

## Required checks

- Formatting and lint.
- TypeScript and architecture boundaries.
- Unit, integration and component regressions.
- Production build and startup/API smoke.
- Applicable static imported-avatar input and asset compatibility validation.

`pnpm check` invokes `check:core`. Its test runner does not collect `apps/web/e2e/*.spec.ts`; ordinary component tests include a few isolated Chromium HTML/CSS checks, not navigation through the product/World. Chromium installation in the core job supports those tests only.

Legacy E2E/measurement scripts and their evidence remain available for historical reference, but are not dependencies of normal CI or readiness. Run them only on a new explicit user request. `verify:fresh` no longer launches measurement journeys; it remains an optional separate source-copy/asset verification tool, not a routine gate.

## Routing and merge protection

- **Feature push / draft PR:** conventional core checks, reported by `push-checks`.
- **Ready code/configuration PR:** the same complete core suite, followed by required `merge-gate`.
- **Documentation-only change:** Markdown formatting. Only root Markdown and Markdown under `docs/` qualify; mixed changes, fixtures and both sides of renames retain code verification.
- **Main/tag code push and workflow dispatch:** complete core verification and `merge-gate`. Main runs are not automatically cancelled.

The internal scope name `full` means merge-eligible conventional verification; it no longer means a browser matrix. Scope, core and documentation checks still fail closed when a required job fails, is cancelled, is missing or is unexpectedly skipped. Draft/feature-only checks do not impersonate the required merge-check name.

Main continues to require **`merge-gate`**. No branch-protection bypass or reviewer requirement is introduced. Bind verification to the exact pushed PR SHA; after an authorized merge, verify the distinct main-SHA workflow separately. Release, publication, tags, provider/profile changes and repository visibility remain separate permissions.

## PR20 transition

The previously accepted product behavior and user-operated TEST45399 are unchanged by this CI-policy revision. Earlier browser CI and diagnostic failures remain historical RED evidence. Uncommitted browser-wait experiments, including the temporary 60-second arrival observation, were preserved outside the repository and removed from the delivery candidate; no unverified journey correction is promoted to satisfy the revised gate.

The replacement candidate must pass the new local code checks and its own exact-head GitHub workflows before merge. Do not use old green checks or claim green before those runs finish.

## Local workflow

Run focused regressions and the relevant code gate. Use `pnpm check` when complete conventional readiness is needed; do not append browser journeys. Reuse existing successful evidence for untouched behavior. Preserve retained test environments, their served builds, browser profiles and all saved work. Do not rebuild underneath a retained operator environment.
