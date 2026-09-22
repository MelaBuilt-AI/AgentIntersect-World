# Security policy

## Pre-release support

AgentIntersect World is in development. No packaged public version is currently supported. Security fixes target the current default branch until a supported release policy is announced.

World is designed for one operator and that operator's agents on a local machine or explicitly trusted LAN. Do not expose its local server directly to the public internet. Connected harnesses keep their own authentication, provider terms and security boundaries.

## Report a vulnerability privately

Do **not** post credentials, native-agent transcripts, exploit details, private repository contents, or unredacted diagnostic archives in a public issue or Discord channel.

- If GitHub's **Security → Report a vulnerability** control is available, use it for a private report.
- Otherwise, join the [MelaBuilt-AI community](https://discord.gg/8GfKXaJsyY) and request a **private conversation with a maintainer**, without including vulnerability details in the public channel. Share the report only after the maintainer establishes a private channel. Never send passwords or provider tokens.

GitHub private vulnerability reporting has not yet been confirmed available for this private repository. Enabling and testing it is a public-cutover checklist item; the link above is not a claim that the GitHub control is already enabled.

Include the affected commit/version, operating system, harness type, minimal reproduction, expected and observed behavior, and a sanitized impact description. If a credential has been exposed, revoke or rotate it immediately; removing a file is not sufficient.

We will coordinate investigation and disclosure privately. No response-time SLA or bug bounty is promised during pre-release.
