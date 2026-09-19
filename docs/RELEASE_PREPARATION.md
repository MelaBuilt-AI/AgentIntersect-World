# Private release-candidate preparation

Authorized by the project owner: prepare packages, private GitHub release/docs, public static website and Cloudflare downloads; keep repository PRIVATE pending hands-on package testing and bug fixes.

## Candidate contract

- Candidate version: `0.15.0-rc.1` (prerelease; not a stable compatibility promise).
- Platforms: Linux x64 and Windows x64. Package the existing browser-based application and local backend with Node24.18.0; do not add an Electron shell or change agent/provider setup.
- Launch one local application process, serving the built normal UI and existing backend on loopback only. Preserve HTTP/SSE/WebSocket proxy semantics and local origin checks. Print/open the browser URL; `--no-open` supports test/headless use.
- Use OS-appropriate per-user state, preserve it on uninstall, and never bundle developer state, credentials, logs, tests, evidence or native harness profiles. Git and a user-installed/configured supported harness remain prerequisites; optional local voice remains consentful, not bundled/auto-installed.
- Linux: extractable tarball with launcher and explicit uninstall instructions. Windows: per-user installer and uninstall entry; unsigned until an external signing service approves/signs exact bytes. Do not label unsigned installers safe from SmartScreen/antivirus warnings.
- Explicit dependency/file allowlists, upstream runtime checksum verification, application source commit and artifact checksums, separate third-party notices.
- Verify launcher/static/API/range response and shutdown with disposable state, then native Windows installed startup/uninstall. This is technical smoke, not full human package acceptance or all-harness native coverage.
- Apache-2.0 for World-owned source, as selected by owner. Third-party code/artwork retains separate applicable terms; do not infer an OSI license for generated/subscription artwork from permission to redistribute.
- Private release/tag after exact-source verification. No public repository visibility change, no history force-push, no retained-review cleanup, no provider/profile changes.

## External blockers

- Cloudflare R2 access: existing Pages/DNS credential gets403 for R2. Large binary hosting requires owner enablement/authorized R2 access; no guessed download URLs or enabled buttons until uploaded bytes verify.
- SignPath Foundation: application requires released OSS/verifiable source, reputation, maintainer name/email and explicit terms/data-processing consent. Repository is intentionally private. Prepare truthful application material; do not submit invented eligibility or claim signing approval.
- Historical privacy: current-tree scrub does not sanitize prior commits. Preserve private history and surface the remaining public-history decision before visibility changes.

## Status

Local package prototypes and native Windows install/uninstall smoke are complete; full local core gate is green. Exact committed-source CI artifacts and private tag/release remain pending. R2/SignPath and the protected instruction-file scrub remain external gates. Static websites are deployed at https://agentintersect.com/ and https://guide.agentintersect.com/ . Owner confirmed the mobile poster crash correction on an iPhone16 Pro.
