# Product privacy

AgentIntersect World is a local, single-operator application. The static marketing website and Field Guide are separate from the local application; their hosting notice is at https://agentintersect.com/privacy/ .

## Local data

World stores saved connections, session/workflow metadata, repository indexes, presentation state, diagnostics and recovery information in its per-user state directory. Repository paths, filenames, selected source and conversations may be sensitive. Application state is not included in distribution packages. Uninstall preserves saved state and your repositories/native agent profiles; consult the README before deleting anything manually.

## Connected agents and services

World sends the messages and work requests you explicitly submit to your selected installed harnesses. Those harnesses may use cloud model providers, native session storage, remote Git services or other tools under their own configuration, permissions and privacy terms. Local-first does not mean that every selected harness operates offline. Review each harness/provider's terms before sharing private code or information.

Native login remains in the native harness. Discovery and attachment do not authorize silent provider changes, login, service restarts or plugin installation. Any supported prerequisite change remains an explicit product approval flow.

## Voice and downloads

Microphone use requires browser permission and explicit interaction. Optional transcription setup downloads verified provider/model artifacts only after its installation consent. Local transcription does not make a later agent send offline: the selected harness may transmit the approved text to its provider.

Package downloads are hosted separately and involve the hosting provider's normal request/security processing. Code signing, when available, establishes an artifact's publisher/provenance; it is not a privacy or malware-free guarantee.

## Sharing evidence

Review diagnostics, screenshots, repository paths, source snippets and conversation excerpts before sharing them. Never paste API keys, passwords or native authentication stores into public issues. No Internet-facing multi-user deployment is supported by the release-candidate launcher.
