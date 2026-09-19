# Third-party notices and asset terms

## World-owned code

The project owner's source code is Apache-2.0; see LICENSE and NOTICE. Dependency licenses and artwork permissions are separate. Harness names/logos identify compatible third-party products; no endorsement is implied.

## Runtime and libraries

Distribution includes the pinned Node.js runtime with its upstream LICENSE (including Node's bundled-component notices). Installed production dependencies retain their own package metadata and license files. `DEPENDENCIES.json` in each package inventories the actually bundled packages and declared licenses. Source dependency versions and integrity are locked in pnpm-lock.yaml.

Notable dependencies include Fastify and its static/proxy plugins, React, Three.js, Yjs, Zod, and VS Code Tree-sitter WASM. Their respective upstream licenses apply; the Apache-2.0 project license does not replace them. Optional voice binaries/models are not part of the application package: their provenance, licenses, checksums and explicit installation consent remain in the product's voice setup.

## Visual and audio assets

Imported avatar models were generated under the project owner's Tripo3D subscription. The owner confirms unrestricted private/public use and redistribution in AgentIntersect World; the existing avatar manifest records that grant and source hashes. This is an owner-supplied permission record, not a legal determination that Tripo-generated assets are Apache-2.0 or OSI-licensed source.

Project-provided repository-city artwork, backgrounds, interface art and soundtrack are included as project assets, not third-party stock licensed by the code license. Their source/provenance records remain in the repository. Complete asset-by-asset rights confirmation and any required attribution remain a public-release checklist item; do not treat a successful build or an avatar-only grant as legal clearance for every image/audio file.

## Signing status

The Windows release candidate is unsigned unless its exact downloaded file has a verified Authenticode signature and the release explicitly identifies the signer. SignPath Foundation approval has not been obtained. Do not claim SignPath supplies signing until approval and real signed artifacts exist.
