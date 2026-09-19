# SignPath application preparation — not submitted

## Ready-to-use project fields

- Project name: AgentIntersect World
- Repository: https://github.com/MelaBuilt-AI/AgentIntersect-World (currently PRIVATE)
- Homepage: https://agentintersect.com/
- Download page: https://agentintersect.com/download/ (enable package links only after verified hosting)
- Tagline: A local 3D development workspace for your own AI agents and repositories.
- Description: AgentIntersect World brings an operator's repositories and installed AI-agent harnesses into a navigable local 3D workspace. It supports agent connection, avatar selection, repository exploration and user-directed development workflows while keeping native agent authentication and provider selection under the operator's control.
- Build system: GitHub Actions; pinned source checkout, locked production dependency deployment, verified Node runtime, Windows Inno Setup compiler, installed-package smoke and checksums. Use the exact successful candidate workflow/artifact URLs after they exist.
- Source license: Apache-2.0 for World-owned source. Third-party and generated artwork terms remain separate; disclose them rather than asserting every asset is OSI-licensed source.

## Required owner-supplied fields/attestations

- Maintainer first name, last name, account email and maintainer organization/type.
- Reputation: truthful public evidence such as actual usage, independent coverage or community links. Do not invent adoption numbers or claim private tests establish public reputation.
- Actual discovery channel/source.
- Confirmation that relevant maintainer accounts use MFA and the named signing approver has authority.
- Agreement to the Foundation Code of Conduct and required personal-data processing. Optional marketing communications should remain unchecked unless separately requested.

## Eligibility blocker

Foundation terms require maintained, released, OSI-licensed open-source software and verifiable build/source provenance. The repository is deliberately private pending hands-on package review. Do not publish it to satisfy the application without the owner's separate approval, and do not claim Foundation approval/signing while applying.

The application form was inspected at https://signpath.org/apply and terms at https://signpath.org/terms . Submission is held until the owner supplies the missing fields/attestations and eligibility can be represented truthfully. Preparing an application is not submitting it; submitting it is not approval; approval is not a signed artifact.

## Proposed code signing policy (inactive)

MelaBuilt-AI maintains the project. A project-owner approval is required for each signing request. Only exact-source CI-built World artifacts are eligible; upstream Node executables retain their upstream signatures and must not be re-signed as World-owned code. Source changes from outside maintainers require review. SignPath attribution will be added to the website/download page only if and when the Foundation approves the project and supplies signing.

No signing workflow stores private keys in the repository. Any future SignPath credentials belong in scoped GitHub/environment secrets. Signed and unsigned artifact hashes must be recorded separately; signatures change bytes. Windows warning suppression is not guaranteed by a signature.
