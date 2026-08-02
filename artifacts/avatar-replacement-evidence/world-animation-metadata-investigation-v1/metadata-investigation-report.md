# World animation metadata investigation v1

## Verdict

No authoritative per-clip gesture labels were recovered. The existing 69 direct-review `Idle`/`Walk`/`Run` passes remain locked. All 207 gesture decisions remain ambiguous and runtime-refused to model-local Idle.

## Channels checked

- Frozen source inventory: 69-of-69 records correspond by SHA-256.
- Permitted source tree: 99 entries (92 files, 7 directories), including hidden-file, archive, and sidecar classification. Findings: 0 hidden entries, 0 archives, and 0 ordinary sidecar files.
- Source/repository GLBs: 23/23 are byte-identical, totaling 328671832 bytes on each side.
- Embedded glTF JSON: asset generator/copyright/extras; top-level extras/extensions; and every scene, node, skin, mesh, animation, accessor, and bufferView name/extras/extensions record were parsed and hashed per model.
- NTFS alternate data streams: 92 sanitized `Zone.Identifier` streams were inventoried. They establish browser-download provenance from the recorded Tripo Studio/provider hostnames, but contain no animation-semantic authority. Raw locators, query strings, signatures, tokens, and provider identifiers are excluded.
- Existing repository/Hermes-run text evidence: 1052 text files were scanned; 90 sanitized file-level matches were retained without excerpts or locators.

## Evidence classification

- Authoritative semantic labels: none.
- Transport/tool metadata only: glTF exporter identity, anonymous animation source names, sanitized source aliases and hashes, and sanitized download-zone provenance.
- Forbidden as semantic authority: clip order/index, `NlaTrack*`, duration/timing, motion or pose hashes, channel/skeleton/accessor structure, and cross-model similarity.
- Absent: provider/export label manifest, authoritative labeled API response, source sidecar mapping clip indices to the supported vocabulary, and proof of which model Aaron manually observed.

The machine-readable report contains no private absolute source path and no sensitive download locator. Its per-model records bind every parsed metadata channel to the exact source/repository GLB SHA-256.
