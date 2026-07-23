# Phase 15 STT Artifact Verification Report

**PASS FOR ARTIFACT PROVENANCE, OFFLINE SMOKE, SYNTHETIC QUALITY, AND PERFORMANCE / RESULT ACCEPTED / IMPLEMENTATION CANDIDATE VERIFIED / PHYSICAL-MICROPHONE USER ACCEPTANCE PENDING / PROVIDER UNACTIVATED**

**Verified:** 2026-07-22

## Authority and conclusion

The user approved the immutable `whisper.cpp` v1.9.1 plus English `base.en` pin and originally authorized only bounded artifact download, safe inventory, exact hash verification, offline smoke/quality/performance benchmarking, and this report. That bounded gate passed on the observed WSL2 host. The user later accepted this result and explicitly authorized exactly one bounded Phase 15 implementation candidate, now verified in `PHASE_15_REPORT.md` except for the separately required physical-microphone user-acceptance journey.

This historical artifact report is not Phase 15 completion or provider activation authority. The bounded implementation authorization permits only the frozen Phase 15 slice; physical-microphone user acceptance, release, publication, deployment, provider promotion/activation, Phase 16+, original-AgentIntersect operations, and Hermes-profile changes remain closed. The verified runtime and model remain under private `.staging` storage outside the repository.

Authoritative sanitized evidence is retained under `artifacts/phase15/stt-provider/`. No runtime binary, model, WAV, raw provider payload, credential, or absolute home path is committed.

## Exact retained artifacts

| Item              | Exact pin                                                                                                         |       Bytes | SHA-256                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- | ----------: | ------------------------------------------------------------------ |
| Runtime archive   | `ggml-org/whisper.cpp` v1.9.1, commit `f049fff95a089aa9969deb009cdd4892b3e74916`, `whisper-bin-ubuntu-x64.tar.gz` |   9,379,235 | `f3bf3b4369a99b54665b0f19b88483b30de27f25963b0414235dea03198515c5` |
| Model             | `ggerganov/whisper.cpp` revision `5359861c739e955e79d9a303bcbc70fb988958b1`, `ggml-base.en.bin`                   | 147,964,211 | `a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002` |
| `whisper-cli`     | Extracted from the verified runtime archive                                                                       |     976,312 | `427dfb509f2c04d0f01c101978b5666102c6f7e3abf2a236452db5939f5b533a` |
| Runtime `LICENSE` | MIT license from the verified runtime archive                                                                     |       1,078 | `94f29bbed6a22c35b992c5c6ebf0e7c92f13b836b90f36f461c9cf2f0f1d010d` |

Independent post-benchmark rehashing matched both pinned artifact sizes and SHA-256 values. The retained private staging tree totals 185,119,961 bytes and contains no `.partial` file, raw audio, or symlink.

## Fail-closed extraction and approved alias revision

### First attempt

The original approved policy rejected every symbolic link. The official archive contained eight shared-library aliases, so verification stopped at `libwhisper.so`, deleted the entire new staging tree, and left no runtime or model installed. This was the intended fail-closed behavior.

Metadata-only inspection then proved the archive contains exactly one directory, 35 regular files, and these eight relative same-directory aliases:

| Alias               | Immediate target         | Terminal regular file    | Terminal SHA-256                                                   |
| ------------------- | ------------------------ | ------------------------ | ------------------------------------------------------------------ |
| `libwhisper.so`     | `libwhisper.so.1`        | `libwhisper.so.1.9.1`    | `b7d624111b72c70a7351d07d403efae15990aa1112b950557457a12cb90cebee` |
| `libwhisper.so.1`   | `libwhisper.so.1.9.1`    | `libwhisper.so.1.9.1`    | `b7d624111b72c70a7351d07d403efae15990aa1112b950557457a12cb90cebee` |
| `libparakeet.so`    | `libparakeet.so.1`       | `libparakeet.so.1.9.1`   | `67b2620386d68635b6a3f9f1705407f5aff465144be5ec8c775dcfa3e97e8640` |
| `libparakeet.so.1`  | `libparakeet.so.1.9.1`   | `libparakeet.so.1.9.1`   | `67b2620386d68635b6a3f9f1705407f5aff465144be5ec8c775dcfa3e97e8640` |
| `libggml-base.so`   | `libggml-base.so.0`      | `libggml-base.so.0.15.1` | `8924f4eef14b7b2f4d5f44d5744ace615601257fee2d7e1e2f02d21188824c26` |
| `libggml-base.so.0` | `libggml-base.so.0.15.1` | `libggml-base.so.0.15.1` | `8924f4eef14b7b2f4d5f44d5744ace615601257fee2d7e1e2f02d21188824c26` |
| `libggml.so`        | `libggml.so.0`           | `libggml.so.0.15.1`      | `1c2d4b9d4a46a481c3c153fabad00dbba6342b107255667d60727b05c3935a00` |
| `libggml.so.0`      | `libggml.so.0.15.1`      | `libggml.so.0.15.1`      | `1c2d4b9d4a46a481c3c153fabad00dbba6342b107255667d60727b05c3935a00` |

The user explicitly approved one narrow policy revision: only those exact eight aliases may be accepted, and each must be materialized as a private regular-file copy of its verified terminal library. No symlink is created or retained. Every other symlink, hardlink, device, FIFO, unsafe path, unexpected alias, or changed target remains rejected.

### Verifier correction and final result

A local verifier bookkeeping defect on the first revised full attempt referenced extraction-local counters while writing the provenance manifest. It failed after verification/extraction and again deleted the entire staging tree. The defect did not modify product code or change artifact evidence. The return contract was corrected, syntax-checked, and exercised through a manifest-level extraction test before the final attempt.

Final safe extraction produced:

- 35 archive regular files;
- eight approved aliases materialized as regular files;
- 43 final regular files;
- 27,751,742 expanded bytes against the unchanged 134,217,728-byte ceiling;
- zero retained symlinks;
- no hardlink, device, FIFO, absolute path, traversal, duplicate normalized path, overlong path, unexpected root, cycle, cross-directory target, or unexpected alias;
- runtime inventory SHA-256 `cec21291ef72fc23ddfe92ad8bd8ea211eb2bc403356943eb50433b4f529b15d`.

`whisper-cli` declares `$ORIGIN` as its runpath and needs `libwhisper.so.1` and `libggml.so.0`, confirming why the two materialized aliases are operationally required. The archive also contains `whisper-server`; it was inventoried but never selected, started, or authorized.

## Offline CLI smoke proof

`whisper-cli --help` succeeded inside a new user/network namespace and loaded the verified Zen 4 CPU backend from the extracted runtime. The CLI evidence confirmed the pinned fixed-argument surface: English, one input file, eight threads, CPU-only mode, JSON-full output, no timestamp printing, no temperature fallback, and explicit model/output paths.

Every transcription ran as one short-lived `whisper-cli` process under:

- eight threads and one processor;
- CPU-only mode;
- English-only `base.en`;
- disabled temperature fallback;
- 10-second hard timeout with one-second kill grace;
- 1 MiB ceiling for each captured stdout, stderr, JSON, and timing output;
- a fresh user/network namespace exposing only loopback `lo` with zero traffic;
- no provider listener.

No `whisper-cli` process remained after the runs.

## Synthetic quality and performance evidence

Fixtures were synthesized with two already-installed Windows desktop voices, converted locally to 16-bit 16 kHz mono PCM WAV, hashed, and removed after scoring. No third artifact or speech service was downloaded. Windows-side source WAV files and the temporary PowerShell generator were removed immediately after conversion.

| Fixture      |   Duration | Expected                                                                            | Transcript                                                                      |      Errors / words |                   WER | Elapsed |     Max RSS |
| ------------ | ---------: | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------: | --------------------: | ------: | ----------: |
| David clean  |   6.2435 s | “The quick brown fox jumps over the lazy dog. Local speech stays on this computer.” | Exact match                                                                     |              0 / 15 |                 `0.0` |  0.82 s | 291,960 KiB |
| Zira clean   | 5.933563 s | “Typed text remains authoritative. Voice input must be reviewed before sending.”    | “Type text remains authoritative. Voice input must be reviewed before sending.” | 1 substitution / 11 | `0.09090909090909091` |  0.71 s | 292,016 KiB |
| David padded |     30.0 s | Same David phrase plus silence                                                      | Exact match                                                                     |              0 / 15 |                 `0.0` |  0.71 s | 295,792 KiB |

Aggregate results:

- three successful runs;
- 41 reference words;
- one substitution, zero deletions, zero insertions;
- aggregate WER `0.024390243902439025`;
- maximum elapsed time 0.82 seconds;
- 30-second stop-to-final proxy 0.71 seconds;
- maximum RSS 295,792 KiB (288.859375 MiB);
- every run met the frozen 2-second target and 10-second hard ceiling;
- every captured output remained below 1 MiB.

No WER threshold was predeclared. The exact one-word error is therefore reported without retroactively inventing or weakening a quality gate.

## Cleanup and retained evidence

After summary generation:

- no WAV, MP3, FLAC, OGG, WebM, partial download, raw CLI JSON, raw stdout/stderr, or raw timing payload remains;
- no Windows raw fixture or generator remains;
- no runtime process or provider listener remains;
- the provider remains unactivated in private `.staging` storage;
- typed/Hermes text behavior is unchanged.

Authoritative sanitized evidence:

The retained private staging summary remains byte-exact at SHA-256 `ae207d3068e6a149a4b0016abd0083d03aef8ec1f832ac44168e75986d747b07`. The repository copy was formatting-normalized after exact-SHA CI correctly enforced the project-wide Prettier gate; parsed JSON equality with the retained staging source was verified before the correction commit.

| Evidence                                                            | SHA-256                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `artifacts/phase15/stt-provider/benchmark-summary.json`             | `066665b18cf08f789e481160ef8ee65b167b336bb936ed94cce858ab96a001e7` |
| `artifacts/phase15/stt-provider/provenance-manifest.json`           | `d12d1bdc867c455da47d06e44c302e8b00b99c6ed8682b3f74dd78c203b6dc68` |
| `artifacts/phase15/stt-provider/runtime-inventory.json`             | `cec21291ef72fc23ddfe92ad8bd8ea211eb2bc403356943eb50433b4f529b15d` |
| `artifacts/phase15/stt-provider/benchmark-fixtures.json`            | `08c9f45ad2c1ab63410b40c41eabbf52ab6d999c9c9ffc43f6c79fcfeade51d5` |
| `artifacts/phase15/stt-provider/network-namespace-proc-net-dev.txt` | `dcee31fcbec3e6c05cc28dd7f68c6ce4dd33ec6c92104c80ecac9d1aac3f79c0` |
| `artifacts/phase15/stt-provider/post-run-process-check.txt`         | `fcf33dfbe13c2354bf0e1b063f9fb422747a46cee00b7420bceff2b81457b345` |

## Limitations and next gate

This gate used deterministic synthetic installed voices. It does not replace first-hand microphone/operator acceptance. Three runs are insufficient for percentile claims. The 30-second fixture is one spoken phrase padded with silence, not 30 seconds of continuous speech.

Browser permission states, partial/final caption behavior, final edit/send/cancel, exact-session re-attestation, TTS, barge-in, accessibility/mobile/no-WebGL operation, and persistence/recovery belong to the later implementation report rather than this historical artifact report. Deterministic and exact-provider parent proof is green in `PHASE_15_REPORT.md`. This host exposes no usable physical microphone, so the distinct physical-microphone user-acceptance journey remains outstanding.

The artifact result was accepted and the bounded Phase 15 implementation candidate is verified. The next gate is one user-accepted physical-microphone journey; provider promotion/activation remains blocked.
