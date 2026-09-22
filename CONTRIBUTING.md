# Contributing during pre-release

Thanks for your interest in AgentIntersect World.

The repository is preparing for a public, source-available soft launch. Packaged Windows and Linux downloads remain unavailable. The first packaged release will be announced through GitHub Releases; select **Watch → Custom → Releases** to subscribe. Delivery follows your own GitHub notification settings.

## Start small

Bug reports and focused fixes are welcome. Discuss substantial features, dependency changes, architectural rewrites, or asset replacements with a maintainer before investing in a large pull request. Roadmap suggestions are not a promise of implementation or a release date.

Use a separate branch and keep each pull request focused. Describe the problem, the change and the verification actually performed. Do not claim live-harness or visual acceptance from mocked tests.

## Local checks

Use Node.js 24 or newer, Git, Corepack, and the pinned pnpm version:

```sh
corepack pnpm@11.15.0 install --frozen-lockfile
corepack pnpm@11.15.0 check:core
```

The conventional gate covers formatting, lint, types, architecture, unit/integration/component tests, build and startup/API smoke. Add a focused regression for a reproduced bug. Normal World visual acceptance is hands-on; do not reinstate legacy automated World-navigation journeys as a default requirement.

Use disposable test projects for real agent work. Do not alter another person's native harness profiles, credentials, saved work, running sessions or global provider settings. CI success does not authorize publishing packages, releases, deployments, or changing repository visibility.

## Safe reports and contributions

- Include your OS, Node version, harness and application commit/version.
- Remove tokens, cookies, local usernames/private paths and private code from logs, screenshots and traces before attaching them.
- Never upload `.env` files, authentication stores, full native conversation histories, or unrestricted browser traces.
- Report vulnerabilities through [SECURITY.md](SECURITY.md), not public issues.
- Submit only code and media you have the right to contribute. Preserve third-party notices and explain any new asset's origin and redistribution permission; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Be respectful and constructive. Maintainers may defer requests or decline changes to keep the pre-release scope manageable.
