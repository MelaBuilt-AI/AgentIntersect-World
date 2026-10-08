# Windows installer: bundled Git and proportional icon

Authorized by Aaron (Discord 1557792944902373429): rebuild private Windows setup, install over the prior candidate, preserve state, include private Portable Git so project creation works without system Git, and derive the installer/shortcut icon from the supplied agentintersect_appicon.svg without distortion.

Base: merged main 3c4b358. Scope: Windows packaging/launcher, icon generation, focused package tests and native isolated proof. Keep AppId/default directory/state paths unchanged. No machine/user PATH or global Git config writes; do not invent commit identity. Provider changes, public uploads/releases and TEST45495 mutation remain excluded.

Aaron subsequently authorized the shared Workbench commit-author dialog and source-first delivery (Discord 1557827846553210985): commit/push a scoped PR, verify exact-head CI, merge, verify merged-main CI, then build a clean merged-commit Windows candidate. No binary publication or packaging-workflow dispatch is authorized. The previous dirty candidate remains historical testing evidence, not the next release source.

Workbench now asks for explicit name/email in a separate native modal only when a checkpoint or selected-file commit needs identity. Save and continue writes repository-local settings and resumes the selected action; cancel makes no write. Existing identity bypasses the dialog. Real-Git, component, type/build and API smoke checks passed locally; native rebuilt-package and operator acceptance remain separate.

Next Windows setup identity: 0.15.0-rc.2-windows.2, numeric resource 0.15.0.4. The shared dialog also applies to Linux: DEB/tar payloads need rebuilding to include it, with the existing system-Git prerequisite unchanged. The npm bootstrap must be repinned and retested against any rebuilt Linux archive before use; no publication is authorized.

Pin: official PortableGit-2.56.0.2-64-bit.7z.exe, release v2.56.0.windows.2, 60027568 bytes, SHA256 075e158ef8e1f0ab80b347e245405d3eca735c2dc88fd8e032e137d0ca61f61b. Preserve full licenses/package inventory. Run upstream post-install on the target, not the build machine (it copies host networking files). Git PATH applies only to World and inherited children; preserve user configuration.

Icon: preserve the exact source SVG. Rasterize its intrinsic 1024px composition once, then uniformly downsample it into ICO sizes so non-scaling-stroke does not inflate strokes at 16–256px. Use a new installed icon filename to avoid reusing the old shortcut icon cache key.

Acceptance: native launch with external Git unavailable, API project creation and .git existence, real bundled Git commit/worktree operation with disposable local test identity, inherited Bash/Git availability, state continuity on relaunch, source-state-preserving upgrade recipe, icon visual review at shipped sizes. Unsigned installer remains blocked on this managed source PC; do not bypass policy or call portable proof installer acceptance. Aaron will install over the old copy on his test PC.
