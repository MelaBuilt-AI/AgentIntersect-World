# Phase 15 STT Provider Pin

**APPROVED 2026-07-22 / PHASE 15 USER ACCEPTED AND SEALED 2026-07-24 / PROVIDER STAGED AND UNACTIVATED**

**Prepared and sources retrieved:** 2026-07-22

This document records the exact approved provider-selection and provenance pin for the frozen Phase 15 Decision 3 boundary. The bounded artifact verification and benchmark are complete in `docs/PHASE_15_STT_ARTIFACT_REPORT.md`; the user accepted that result, authorized exactly one bounded implementation, completed the real physical-microphone journey, and sealed Phase 15 on 2026-07-24. This pin remains no authority to promote/activate the provider, release, publish, deploy, or cross any later gate.

## Observed target environment

The following machine-specific facts were observed on 2026-07-22 and are selection evidence for this machine, not universal compatibility or performance guarantees:

- WSL2 x86_64 with kernel `6.6.114.1-microsoft-standard-WSL2`;
- AMD Ryzen 7 7800X3D with 16 logical CPUs;
- 15 GiB memory, with 8.6 GiB available at inspection;
- SSE4.1, SSE4.2, AVX, AVX2, FMA, and F16C CPU support;
- `nvidia-smi` unavailable, so the initial baseline must not depend on CUDA or a GPU; and
- `cmake` unavailable, favoring an official prebuilt runtime for the first bounded slice rather than source compilation.

## Approved candidate decision

Use `ggml-org/whisper.cpp` v1.9.1 with the unquantized English `base.en` model for the initial CPU-only English baseline.

1. **`ggml-org/whisper.cpp` v1.9.1 — selected.** It has a native CPU path, an official Ubuntu x64 release asset with a GitHub-provided SHA-256 digest, a small runtime surface, an MIT license, and direct `whisper-cli` execution. That shape is suitable for shell-free child execution without a listener.
2. **`SYSTRAN/faster-whisper` v1.2.1 — not selected for the first slice.** It is MIT-licensed and capable, but its PyPI metadata requires Python 3.9 or newer plus `ctranslate2`, `huggingface-hub`, `tokenizers`, `onnxruntime`, `av`, and `tqdm`. That is a materially larger native/package and provisioning surface. Keep it as a future, separately approved option, especially if GPU needs change.
3. **Browser `SpeechRecognition` — rejected as the canonical initial STT baseline.** MDN documents that recognition is server-based by default and sends audio to a web service; on-device recognition depends on browser support and browser-managed language packs. That does not provide deterministic local-first provenance. Browser/system `speechSynthesis` remains separately allowed by approved Decision 5 with truthful disclosure.

## Exact approved runtime pin

- **Upstream:** `https://github.com/ggml-org/whisper.cpp`
- **Release/tag:** `v1.9.1`
- **Tag commit:** `f049fff95a089aa9969deb009cdd4892b3e74916`
- **Commit signature:** GitHub reports the commit signature as verified.
- **Published:** `2026-06-19T05:53:19Z`
- **GitHub release ID:** `341768502`
- **License:** MIT
- **`LICENSE` at the tag:** 1,078 bytes; SHA-256 `94f29bbed6a22c35b992c5c6ebf0e7c92f13b836b90f36f461c9cf2f0f1d010d`
- **Selected official asset:** `whisper-bin-ubuntu-x64.tar.gz`
- **Asset ID:** `451903886`
- **Asset size:** `9,379,235` bytes
- **GitHub-provided asset digest:** `sha256:f3bf3b4369a99b54665b0f19b88483b30de27f25963b0414235dea03198515c5`
- **Exact URL:** `https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.1/whisper-bin-ubuntu-x64.tar.gz`

The release workflow at the pinned tag copies `LICENSE` into `build/bin` and archives the complete `build/bin` directory. The approved download was safely inventoried and every extracted/materialized file is recorded in `artifacts/phase15/stt-provider/runtime-inventory.json`; activation remains blocked even though the artifact result was accepted and the bounded implementation was authorized.

Pinned source evidence:

- `examples/cli/cli.cpp`: SHA-256 `bd7be1edc6ca295df3f638eb67e41c3422e4728dcc0ee70e0c197705f0976e36`
- `.github/workflows/release.yml`: SHA-256 `007d14f3212f1ec99d7608a5ed08ea8d013d346dc120475702d83f7c94823eed`
- `README.md`: SHA-256 `e0eeb79e3e9feea2623111082a1a3e6260e71894eab0132ef394c1f7ae225ce9`

## Exact approved model pin

- **Repository:** `https://huggingface.co/ggerganov/whisper.cpp`
- **Immutable revision:** `5359861c739e955e79d9a303bcbc70fb988958b1`
- **Model-card license:** MIT
- **Model-card `README.md` at that revision:** 3,196 bytes; SHA-256 `21fd967098804f33fc84e803fb0e5ab7666d71801f4027cf28a65e7af09c1758`
- **File:** `ggml-base.en.bin`
- **Exact revision URL:** `https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base.en.bin`
- **File size:** `147,964,211` bytes
- **Hugging Face API LFS SHA-256:** `a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002`

This is an English-only initial baseline. If non-English speech is requested, the capability must be shown as unavailable; it must not be silently auto-detected, downloaded, or sent elsewhere. The pinned upstream v1.9.1 README describes `base` as 142 MiB on disk and approximately 388 MB in memory. Those figures are upstream guidance, not local benchmark evidence.

Use the unquantized `base.en` model to keep the first quality baseline straightforward. Any smaller quantized fallback requires separate evidence and approval.

## Approved provisioning and download policy

This policy governed the completed bounded artifact verification. The later bounded implementation authorization does not authorize future automatic downloads, provider promotion/activation, release, publication, or deployment.

- No automatic, implicit, browser-triggered, startup-triggered, CI-triggered, or runtime download.
- No Hugging Face token or login, package manager, model-hub SDK, Git LFS clone, arbitrary URL, latest tag, mutable branch, redirect-derived revision, or silent fallback.
- The completed bounded verification fetched only the two exact HTTPS asset/model URLs recorded above. Any future refetch requires the same immutable URLs, sizes, and hashes; there is no runtime network fallback.
- Download into restrictive `.partial` temporary files under `${XDG_DATA_HOME:-$HOME/.local/share}/agentintersect-world/providers/whisper.cpp/v1.9.1/.staging/`, outside the repository. Keep the model under a revision-named child directory.
- Require the runtime archive to be exactly `9,379,235` bytes and the model to be exactly `147,964,211` bytes before activation. Compute SHA-256 locally and require exact equality before extraction or use.
- Before extracting the runtime archive, reject absolute paths, `..` traversal, hard links, devices, FIFOs, duplicate normalized paths, paths longer than 240 characters, more than 128 final regular files, more than 128 MiB of final expanded regular-file content, and unexpected root placement. Reject every symlink except the eight exact relative same-directory shared-library aliases recorded in `docs/PHASE_15_STT_ARTIFACT_REPORT.md`; materialize those aliases as verified private regular-file copies and retain zero symlinks on disk.
- Extract only into a new versioned directory. Never overlay an existing provider.
- Inventory and hash every extracted or materialized regular file. The accepted extraction shape is 35 archive regular files plus eight materialized aliases, 43 final regular files, 27,751,742 bytes, zero symlinks, and inventory SHA-256 `cec21291ef72fc23ddfe92ad8bd8ea211eb2bc403356943eb50433b4f529b15d`. Before every use, application attestation must re-hash and re-check the current path, size, mode, and content of every inventory member; trusting only the inventory-file digest is insufficient. Keep activation blocked until the artifact result and later implementation are separately accepted.
- Use atomic rename only after every check passes and activation is separately authorized. On any failure, delete partial and staging material, report the capability as unavailable, and do not touch a previous accepted provider. The verified artifacts remain in `.staging`; no activation rename occurred.
- Store a provenance manifest containing upstream URLs, immutable revisions, byte sizes, hashes, license hash, retrieval timestamp, and verification result. Store no credentials or raw audio.
- Runtime operation must be offline, with no network fallback. Network egress must be unnecessary after provisioning.
- Uninstall may remove only the owned versioned provider/model directory after explicit approval; it must never delete an arbitrary path.

## Approved execution contract

This contract records the bounded execution shape proven by the artifact benchmark. It is not application implementation or future process-start authority.

- Use only `whisper-cli`. Do not start `whisper-server` or any provider listener.
- Spawn shell-free with a fixed argument allowlist grounded in the pinned v1.9.1 CLI: model path, one input file, English language, bounded thread count, JSON-full output, no uncontrolled command construction.
- Pinned source evidence confirms `--threads`, `--output-json-full`, `--no-prints`, `--no-timestamps`, `--language`, and `--file` options.
- Accept exactly one app-owned 16-bit PCM WAV input at 16 kHz mono within the approved 30-second and 4 MiB capture ceilings. The pinned upstream README states that `whisper-cli` requires 16-bit WAV input.
- Permit one active transcription and at most one queued transcription, an eight-thread ceiling on this host, a hard timeout aligned with the approved 10-second STT ceiling, at most 1 MiB of combined captured stdout/stderr/JSON output, process-tree termination, and truthful unavailable, timeout, queue-full, and cancelled states.
- Use a restrictive app-owned temporary directory and file. Accept no user-supplied paths, arbitrary flags, or shell. Retain no raw audio, and guarantee cleanup after success, failure, cancellation, or restart.
- Persist only approved redacted operation summaries. A transcript may persist only through the existing accepted Hermes text-send path.
- The separately authorized benchmark proved three CPU-only process-per-utterance runs in 0.71–0.82 seconds with peak RSS 295,792 KiB, all below the frozen 2-second target and 10-second hard ceiling. Aggregate synthetic-fixture WER was `0.024390243902439025` with one substitution across 41 reference words. No WER threshold was predeclared, so the exact error is reported without retroactive gating. Never weaken thresholds to make a later implementation pass.

## Separate approval gates

1. **Provider pin:** approved on 2026-07-22.
2. **Artifact gate:** bounded download, safe inventory, exact hash verification, offline smoke/quality/performance benchmarking, cleanup, and report completed. Provider activation remains blocked.
3. **Phase closeout:** bounded implementation, exact-provider proof, real physical-microphone journey, optional browser/system TTS, cleanup, and explicit user acceptance passed; Phase 15 sealed on 2026-07-24. Provider promotion/activation remains a separate closed gate.

## Primary sources

All sources below were retrieved on 2026-07-22.

- [`whisper.cpp` v1.9.1 release](https://github.com/ggml-org/whisper.cpp/releases/tag/v1.9.1)
- [Pinned GitHub tag commit](https://github.com/ggml-org/whisper.cpp/commit/f049fff95a089aa9969deb009cdd4892b3e74916)
- [MIT `LICENSE` at v1.9.1](https://github.com/ggml-org/whisper.cpp/blob/v1.9.1/LICENSE)
- [Release workflow at v1.9.1](https://github.com/ggml-org/whisper.cpp/blob/v1.9.1/.github/workflows/release.yml)
- [`whisper-cli` source at v1.9.1](https://github.com/ggml-org/whisper.cpp/blob/v1.9.1/examples/cli/cli.cpp)
- [`whisper.cpp` README at v1.9.1](https://github.com/ggml-org/whisper.cpp/blob/v1.9.1/README.md)
- [Hugging Face model card at the immutable revision](https://huggingface.co/ggerganov/whisper.cpp/blob/5359861c739e955e79d9a303bcbc70fb988958b1/README.md)
- [`ggml-base.en.bin` at the immutable revision](https://huggingface.co/ggerganov/whisper.cpp/blob/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base.en.bin)
- [Exact model-resolution URL](https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base.en.bin)
- [`faster-whisper` 1.2.1 PyPI metadata](https://pypi.org/project/faster-whisper/1.2.1/)
- [`faster-whisper` v1.2.1 GitHub release](https://github.com/SYSTRAN/faster-whisper/releases/tag/v1.2.1)
- [MDN: Using the Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API)
