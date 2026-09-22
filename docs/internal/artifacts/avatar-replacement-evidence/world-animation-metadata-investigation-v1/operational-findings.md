# AgentIntersect World avatar metadata investigation — operational findings

## Verdict

No authoritative per-clip gesture labels were recovered. The semantic authority was not changed: 69 direct temporal-review locomotion decisions remain `pass`, and all 207 gesture decisions remain `ambiguous` and fail closed to model-local Idle.

## Safety correction

An initial ADS inspection exposed provider download locators in private telemetry. The parent stopped that run, redacted 56 locator occurrences, verified zero remaining locator/secret-field patterns, and wrote `worker-live-redaction-receipt.json`. The resumed investigation did not reuse or reproduce the locators. It retained only sanitized aggregate ADS counts, byte sizes, an aggregate SHA-256, `ZoneId`, and provider hostnames. No raw ADS contents, download locator, query string, signature, token, or provider identifier is present in repository evidence or this report.

## Source inventory and identity

- Frozen inventory: 69/69 hash-corresponding files; file SHA-256 `954ed74425b1bf6b4e2a36968ecae5c85156439e63ad74bcd4c0f3e73154d3c2`.
- Permitted tree: 99 entries—92 files and 7 directories. It contains 23 ready GLBs, 23 stance images, 23 T-pose images, and 23 sibling files represented only by stable aliases.
- Hidden entries: 0. Archives: 0. Ordinary JSON/XML/text/YAML/CSV sidecars: 0. Symlinks: 0.
- Sanitized tree-record aggregate SHA-256: `f948f9dc14471abdc0da97c77a9c78be9577401874606fd927ba3d0c36f8158e`.
- Source and shipped GLBs are byte-identical for 23/23 models, totaling 328,671,832 bytes on each side. No GLB was written or transformed.

The semantic review, manifest, and generated registry retain their preflight SHA-256 values:

- semantic review: `badf3cff42fd8d1c362d56a8ca6863eff0ee388ac2b0ec5728703928b0ca17be`
- manifest: `335d862006a811c44818dbda8607342b2ab27318e9a713ddf2fa83cd3a41adaa`
- generated registry: `a76b7285aaa38b11f6fa4753f212bfa3a3aaf5c1c20081c2f8eff2ae27fdb93e`

## NTFS alternate data streams

The initial complete inventory found 92 `Zone.Identifier` streams, all `ZoneId=3`, totaling 32,706 bytes. The sanitized size histogram is 66×43, 2×1,138, 15×1,146, 8×1,152, and 1×1,186 bytes. Its aggregate SHA-256 is `da5308ca0a7fdabff4bd9c7c88d1ca1a5d0196dc0b9bec90b37167ba39ea41dc`. Sanitized hostnames identify Tripo Studio and its provider data host. These fields prove browser-download transport provenance only; they provide no animation meaning.

Per-stream content hashes were not retained after the safety intervention, and the resumed restricted sandbox denied a fresh PowerShell bridge. This limitation is explicit; no raw stream content or locator was persisted.

## Embedded GLB/glTF metadata

Every source GLB header and JSON chunk was parsed. For every model, the machine artifact records the exact byte/hash identity and all requested channels: asset generator/copyright/extras/extensions, top-level extras/extensions, and the index/name/extras/extensions records for scenes, nodes, skins, meshes, animations, accessors, and bufferViews. Each collection has a canonical records SHA-256.

Findings:

- All 23 declare glTF 2.0 and generator `Tripo`.
- Asset copyright/extras/extensions and top-level extras/extensions are absent on all 23.
- No scene, node, skin, mesh, animation, accessor, or bufferView record contains extras or extensions.
- Every scene source name is `Scene`.
- Twenty models contain 21 animations; three contain 22.
- The only animation source names are the anonymous `NlaTrack` sequence through `.021` where present. None matches the supported semantic vocabulary.

## Existing evidence search

The scanner searched 1,055 repository/Hermes-run text files and retained 94 sanitized file-level keyword matches without excerpts, locators, identifiers, or private absolute paths. It checked original export names, provider/task metadata, source locator records, animation/clip label terminology, anonymous clip names, and archived API-response terminology. No authoritative provider response or sidecar maps raw per-model clip indices to semantic labels.

Evidence is classified as follows:

- Authoritative labels: none.
- Transport/tool metadata: exporter identity, anonymous names, stable aliases/hashes, and sanitized download provenance.
- Forbidden semantic inference: index/order, anonymous names, duration/timing, channel/target/accessor structure, pose/motion hashes, and cross-model similarity.
- Absent: provider/export label manifest, authoritative labeled API response, source sidecar mapping to the vocabulary, and proof of which model Aaron observed.

Aaron's Jump/Angry, Dance/Turn, and Laugh/Dance observation remains contradiction evidence only. No model was guessed or special-cased.

## Durable mechanism

`tooling/avatar/avatar_metadata_investigation.py` is deterministic and read-only for external sources and GLBs. The machine report and concise report in this directory contain stable aliases only and support exact `--check` verification. Phase A recovered no labels, so Phase B proceeds without changing semantic authority.
