# Security policy

## Pre-release support

AgentIntersect World is in development. No packaged public version is currently supported. Security fixes target the current default branch until a supported release policy is announced.

World is designed for one operator and that operator's agents on a local machine or explicitly trusted LAN. Do not expose its local server directly to the public internet. Connected harnesses keep their own authentication, provider terms and security boundaries.

## Report a vulnerability privately

Do **not** post credentials, native-agent transcripts, exploit details, private repository contents, or unredacted diagnostic archives in a public issue or Discord channel.

- Use **Security → Report a vulnerability**, or [open a private GitHub security report](https://github.com/MelaBuilt-AI/AgentIntersect-World/security/advisories/new). A GitHub account is required.
- Otherwise, join the [MelaBuilt-AI community](https://discord.gg/8GfKXaJsyY) and request a **private conversation with a maintainer**, without including vulnerability details in the public channel. Share the report only after the maintainer establishes a private channel. Never send passwords or provider tokens.

The GitHub reporting control is the preferred private channel. If it is unavailable, use the private-maintainer-contact fallback above rather than posting details publicly.

Include the affected commit/version, operating system, harness type, minimal reproduction, expected and observed behavior, and a sanitized impact description. If a credential has been exposed, revoke or rotate it immediately; removing a file is not sufficient.

We will coordinate investigation and disclosure privately. No response-time SLA or bug bounty is promised during pre-release.
