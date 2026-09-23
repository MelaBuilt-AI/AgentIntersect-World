# Source soft-launch checklist — downloads remain off

**Scope:** public source and Watch → Custom → Releases, not a packaged product release. The maintainer authorized the World repository public cutover after website SEO, preparation updates and verification. The website source repository stays private. Live GitHub settings and deployment receipts are authoritative for completion.

## Preparation and owner decisions

- [x] README explains the public pre-release, source-development route and Watch → Custom → Releases subscription. A GitHub account is required; notification delivery follows personal settings.
- [x] Root MIT software license, separate [third-party/asset notices](../../THIRD_PARTY_NOTICES.md), [production dependency inventory](../licenses/production-dependencies.json), [security reporting](../../SECURITY.md), [contribution guidance](../../CONTRIBUTING.md) and sanitized bug-report form are present.
- [x] The maintainer accepts the reviewed historical exposure and explicitly chooses to leave history and existing evidence as-is. This includes the already-public business contact/name, local paths, conversation identifiers, short development/testing excerpts and demo workflow metadata. No sanitization or history rewrite is requested.
- [x] ElevenLabs subscription commercial use and inclusion of the music/sounds in this source publication are owner-approved. Existing Tripo3D public-use/redistribution confirmation is retained. Software MIT licensing does not blanket-relicense supplied media; applicable provider terms and source records remain separate.
- [x] Website search indexing and the exact World source visibility change are authorized after verification. This does not authorize a product release, installer activation, changes to native agent providers or publication of the website source repository.
- [x] The three older hosted CI packages were privately archived and verified before their exact hosted artifact IDs were removed. This does not certify their installability or authorize their release.
- [x] Existing `launch-demos` release assets are demonstration videos, not application installers.

## Bounded exposure review

The deeper read-only review at `4de04df` covered history reachable from remote heads/tags and all then-existing pull-request head/base tips: 248 commits and 3,591 unique blob versions inventoried. Text/commit/tag metadata, six distinct Git ZIP archives, all 33 retained Actions logs, 24 PR records and 19 comments were included in the corresponding text/secret checks. Available LFS-backed text and GLB JSON metadata were included in the parent secret corpus. The 57 previously identified metadata paths were checked across 343 text revisions.

The secret detector's final 114 matches were repeated documentation idempotency UUIDs, test idempotency headers, a browser storage key name and dependency-policy prose. **No publication-content credential was confirmed.** No corroborated personal phone, residential address, DOB, government identifier, payment/banking or medical record was identified in scanned text. This is not a guarantee that no secret or personal information exists.

The additional identifying/content disclosures were ordinary project history: an organization-domain Git contact, first-name/display labels, actual short feedback/test quotations and internal operational narratives. The owner accepts their publication.

Visual review covered 59 current UI captures, seven historical variants, 56 sampled video/GIF frames and 40 of 191 trace screenshot entries, with full-height slices for four tall captures. Unsampled frames, remaining historical/trace images, asset/render imagery, audio and small unreadable text are not exhaustively cleared. The owner's keep-as-is decision does not turn these limits into a complete media certification. `docs/internal` is organizational, not access control.

Raw findings, scan/log archives and verified package backups remain private outside Git. They must not be attached to public documentation.

## Required public-cutover operations

1. Verify the exact intended main commit and its successful CI, existing required `merge-gate`, read-only workflow token and disabled Actions PR-review approval. Check for unexpected new commits, package artifacts or releases since review.
2. Verify deployed main/guide robots, sitemaps, route metadata, canonical URLs, no-JavaScript content, social image, 404 behavior and unchanged disabled installer controls. Search engines decide when to index; do not claim instant indexing or ranking.
3. Change **only AgentIntersect World** to public, then read back visibility.
4. Require Actions approval for **all external contributors** once that setting becomes available for the public repository. Preserve existing branch protections and token restrictions.
5. Enable GitHub private vulnerability reporting and verify its enabled state and the public reporting entry. Do not create a fake vulnerability report as a test.
6. Verify signed-out repository/README/demo access, reciprocal website/guide links and Watch instructions. Watching itself requires a signed-in GitHub user; no visitor is automatically subscribed.
7. Read back artifacts/releases and both repositories' visibility. World source is public; website source remains private; installer downloads stay off. Record actual operation receipts outside this source commit to avoid recursive status-only commits.

## First packaged release — separate later gate

- Verify the actual installers, supported platforms, checksums, applicable notices and signing status.
- Publish the real product Release when ready; no empty product release is needed to collect watchers.
- Enable download controls only after the public artifact URLs and bytes have been verified.
