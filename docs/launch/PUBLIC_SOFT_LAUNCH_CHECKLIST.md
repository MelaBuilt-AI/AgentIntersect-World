# Public soft-launch checklist — downloads remain off

**Status: preparation only; repository remains PRIVATE.** This checklist is not permission to change visibility, publish a packaged release, or enable downloads.

## Prepared

- [x] Public-facing README explains the pre-release status, source-development route, and Watch → Custom → Releases subscription.
- [x] Subscription wording requires a GitHub account and respects the subscriber's notification settings; it does not promise email delivery.
- [x] Root MIT license retained; [third-party/asset notices](../../THIRD_PARTY_NOTICES.md) distinguish software licenses, recorded model provenance and unresolved media rights.
- [x] Production dependency license inventory contains 92 installed package entries with MIT, Apache-2.0, BSD-3-Clause or ISC declarations. No private installation paths are published in it.
- [x] [Security reporting](../../SECURITY.md), [contribution guidance](../../CONTRIBUTING.md), and a sanitized bug-report form are present.
- [x] Required `merge-gate`, read-only default workflow token, and disabled workflow PR approvals were verified. Existing CI gates remain intact.
- [x] The three older CI packages were archived outside Git, checked against GitHub ZIP digests and inner checksums, then removed from hosted Actions artifacts. Portable packages identify the expected historical source commit. No installer was executed by this check; no distribution-readiness claim is implied.
- [x] Existing demo release assets are videos only, not a packaged application release. Demo media may remain available after the separate publication/content approval.

## Exposure check and its limits

A bounded read-only check at source baseline `73421fd` covered:

- 23 remote head/tag refs and 229 reachable commits using official checksum-verified Gitleaks 8.30.1;
- 889 current tracked text/trace files, with no files omitted by that corpus's 20 MiB text/trace selection limit;
- all 28 then-retained Actions log archives;
- up to two nested archive levels, with redacted scanner output stored privately;
- targeted visual inspection of eight historical UI screenshots and nine time samples across the three launch videos.

The five history matches and five corresponding current-corpus matches were reviewed at their actual source locations. They were non-secret test/documentation idempotency values, a browser storage key and prose. **No credential was confirmed by this bounded check. This is not a guarantee that no secret exists.** Binary/media history, unsampled frames/audio and every pixel of all retained media were not exhaustively reviewed.

The inventory also identified 57 text files containing personal local paths or conversation references, and 454 tracked image/video/archive files. Sampled media contains display names and demo chats/workstream details. This material is not hidden by the name `docs/internal`.

## Decisions required before visibility changes

- [ ] **Owner approves historical exposure**, including local usernames/paths, conversation references, displayed names, demo chats and repository metadata, or explicitly authorizes a separately planned sanitization/history rewrite or clean public export. No history was rewritten, branches/tags deleted, or immutable evidence altered by this prep.
- [ ] **Owner confirms media rights** for ElevenLabs-generated music/effects and other supplied artwork/effects under the actual generating account agreement, including public source redistribution and the intended reuse license. Existing Tripo3D owner confirmation is retained separately.
- [ ] **Approve the exact visibility change.** Public MIT-licensed source can be cloned, forked and built even while installer buttons are disabled. Existing branches, tags, non-draft releases and Actions logs are also publication surfaces.

## Execute only at the authorized public cutover

- [ ] Require workflow approval for **all external contributors** in repository Actions settings. GitHub's fork-PR approval API rejected the setting's availability while this repository was private (HTTP 422); do not change visibility merely to bypass that constraint.
- [ ] Enable and test GitHub private vulnerability reporting once available. Its current private-repository read returned HTTP 404, not proof that reporting is enabled. Until verified, use the private-maintainer-contact route in SECURITY.md.
- [ ] Recheck public access while signed out: README, demo media, website/guide → GitHub links, Watch instructions and disabled installer buttons. Watching itself requires a signed-in GitHub user; never claim a visitor was automatically subscribed.
- [ ] Keep the website's review `noindex` policy unless search-indexing cutover is separately approved.
- [ ] Recheck artifacts and new commits since this audit before making public. New CI output can change the exposure surface.

## First packaged release — separate later gate

- [ ] Verify the actual installers, supported platforms, checksums, applicable notices and signing status.
- [ ] Publish the real product Release when ready; do not create an empty product release just to collect watchers.
- [ ] Enable download controls only after the actual public artifact URLs and bytes have been verified.

Raw scan output, log archives, private package backups and detailed findings remain outside this repository. They are not public documentation attachments.
