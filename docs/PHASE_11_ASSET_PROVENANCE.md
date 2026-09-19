# Phase 11 avatar asset provenance

The Phase 11 kit is entirely project-owned and self-authored from low-poly Blender primitives. No downloaded meshes, textures, fonts, rigs, motion capture, marketplace assets, generative meshes, or proprietary inputs are used. Shirt labels use Blender's bundled Bfont before conversion to mesh.

- Authoring runtime: Blender 5.2.0 LTS (`/usr/local/bin/blender`)
- Generator: `tooling/avatar/build_avatar_kit.py`
- Source: `assets/avatar/aiw-avatar-kit.blend`
- Runtime export: `apps/web/public/assets/avatar/aiw-avatar-kit.glb`
- Appearance evidence: `apps/web/public/assets/avatar/aiw-avatar-contact-sheet.png`
- Motion evidence: `apps/web/public/assets/avatar/aiw-avatar-motion-sheet.png`
- Contract manifest: `assets/avatar/aiw-avatar-kit.manifest.json`
- Independent source inspection: `assets/avatar/aiw-avatar-blend-inspection.json`
- Independent GLB inspection: `assets/avatar/aiw-avatar-runtime-inspection.json`

Regenerate and verify:

```sh
PATH=/home/user/.nvm/versions/node/v24.18.0/bin:$PATH corepack pnpm@11.15.0 avatar:build
PATH=/home/user/.nvm/versions/node/v24.18.0/bin:$PATH corepack pnpm@11.15.0 avatar:inspect
PATH=/home/user/.nvm/versions/node/v24.18.0/bin:$PATH corepack pnpm@11.15.0 avatar:verify
```

The canonical command fixes Blender's embedded Python hash seed, triangulates and canonically orders mesh data directly before export, omits unused/nondeterministic UV attributes, canonicalizes equivalent glTF triangle ordering, writes opaque RGB evidence, and removes Blender's volatile PNG date/render-time metadata. Geometry, names, materials, rig, actions, GLB content, and rendered pixels are therefore deterministic. Blender container metadata may still alter the compressed `.blend` hash between Blender builds or hosts; the independent structural contract is authoritative for source regeneration equivalence.

Refinement-era measured inventory: 71 objects, 62 meshes, 24 source materials (23 exported runtime materials), one armature, 21 bones, seven actions, one GLB skin, and seven GLB animations. Every one of the 12 head meshes contains project-owned eye, nose, and mouth geometry with named facial-feature vertex groups and three preserved facial materials. Variant-specific joined silhouette geometry differentiates four human, four dog, and four cat heads without textures or external inputs. The source inspection additionally records vertex hashes/bounds for every module family, zero-gap standing-body connections, curved-tail spans, fitted shirt-label bounds, skeleton bindings, multi-bone tracks, distinct action signatures, facial inventory, and action evidence frame/label metadata.

The generated manifest is the authoritative current size/hash table. `aiw-avatar-runtime-inspection.json` independently repeats the current artifact hashes after parsing the GLB; this prose intentionally embeds no artifact hash that can become stale on a valid `.blend` regeneration. The appearance board is a square, fully labeled inventory board; the motion board is a separate wide, fully labeled seven-pose board. Their combined size is enforced below 4 MiB. In the refinement pass, two consecutive clean processes produced byte-identical GLB, appearance PNG, motion PNG, and structural inspection JSON outputs. Direct triangulation emitted none of the former modifier-order warnings.
