# Release privacy/security review

## Completed checks and bounded findings

- Scanned all locally fetched Git refs with checksum-verified Gitleaks8.30.1:204 commits and five generic-api-key findings. Historical source inspection classified these as test/documentation idempotency identifiers, a browser storage key, and prose; no live credential was identified among those findings. This is not a guarantee that every possible secret pattern is absent.
- Replaced developer-specific home/Windows-user paths in40 current documentation/planning files with generic example paths. Original private Git history is preserved.
- `AGENTS.md` remains unchanged because its protected-file approval timed out. Its private-path content remains a visibility blocker until the owner authorizes that edit or chooses a public export excluding internal instructions.
- Git author addresses observed in the inspected history are GitHub noreply or deliberately invalid fixture identities. No personal-address rewrite was made.
- Added ignore rules for environment files, private-key formats and local release output. Example environment documentation may be tracked only through the explicit `.env.example` exception.
- Distribution uses the built UI, compiled backend/workspace packages and locked production dependencies—not the repository root. Developer profiles, raw captures, run histories, project documentation/evidence, credentials and tests are not application payloads.
- pnpm's generated deployment metadata includes absolute source/store paths. The package builder removes manager-only lock/state metadata and replaces workspace file aliases with the installed dependency versions. An explicit regression covers this cleanup and proves that pnpm hard links cannot mutate source manifests: sanitized files are atomically replaced, and every source manifest plus the workspace lockfile is checked byte-for-byte after deployment. The original in-place write failed the frozen-lockfile gate before tests; four affected workspace specifiers were restored. The corrected full packaging attempt passed its source-preservation assertion.
- An upstream `@fastify/reply-from` test directory contains a dummy TLS private-key fixture. It is excluded from packages; the build refuses unexpected credential-like files instead of silently publishing them.
- Screenshots reused from the inspected Field Guide show genuine product UI. Paths are masked; repository-entry capture uses disclosed opaque backing. No raw chat/capture directory is included.

## Before any public repository visibility change

Current-tree cleanup does not erase prior commits, tags, LFS objects, historical screenshots or GitHub artifacts. Keep this repository PRIVATE. Review the complete history and binary/document evidence before choosing either a separately preserved sanitized public export or an explicitly approved history rewrite. Do not force-push, delete old refs, or discard accepted evidence automatically.

Confirm asset-by-asset redistribution/attribution terms, finish package hands-on tests, resolve any discovered bugs, verify the final artifact checksums, and obtain explicit visibility approval. Retain actual signature status; do not imply a package is signed or antivirus-approved.

## Release-source verification

The source package manager remains pnpm11.15.0; pruning uses pinned pnpm12.4.2 to derive a dedicated deploy graph from the workspace lock. Existing locked versions were initially preserved while adding the20 static/proxy dependency packages. The subsequent production audit reported12 high and3 moderate advisory entries; bounded updates to Fastify5.12.5, fflate0.8.3, fast-uri3.1.6/4.1.3 and brace-expansion5.0.12 produced an empty production advisory report. This registry audit does not prove the absence of all vulnerabilities. Source/build/API version markers were migrated together to0.15.0-rc.1.

Technical installed-package smoke checks real UI/health, foreign-origin refusal, hidden-file refusal, disposable repository indexing, a real presentation WebSocket payload, graceful quit and listener closure. Native Windows exposed a POSIX-only disposable-root startup error; the platform-specific canonical root correction preserves Linux's existing path and ignores attacker-controlled temporary-directory variables for that internal service.

Human package acceptance and full native four-harness workflows remain separate and pending.
