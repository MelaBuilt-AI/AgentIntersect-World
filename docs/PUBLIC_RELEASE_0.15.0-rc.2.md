# Public preview 0.15.0-rc.2

[Downloads](https://agentintersect.com/download/) · [GitHub prerelease](https://github.com/MelaBuilt-AI/AgentIntersect-World/releases/tag/v0.15.0-rc.2) · [Field Guide](https://guide.agentintersect.com/getting-started/)

The application archives are the exact accepted October 17 build, not a release-day rebuild. Payload source is `c54b0b49b2c03d9d43c648db51e6b6002ea3ee9c`; npm bootstrap and release tag source is `c87b563824d3c7ac8100b6376809971f1fe27df5`. The latter adds the matching Linux archive pin. Subsequent documentation and website commits do not change those binaries.

## Platforms and limitations

- Windows x64: per-user installer or portable ZIP, bundled Node and private Git for Windows. **Unsigned**, with potential security warnings or device-policy blocks; do not disable protections.
- Linux x64/glibc: Debian/Ubuntu package, portable tar, or version-pinned npm bootstrap. Git is required. npm bootstrap requires Node 20+; the application bundles its runtime.
- Configure a supported agent harness and its account separately. No model subscription or optional local-voice install is implied.
- Owner hands-on Windows workflow accepted; Linux/WSL focused scrolling/elevated-shell/restart retests passed. An earlier intermittent WSL Windows-shell startup failure remains unexplained. Manual reconnect/project reload is not automatic restoration.
- Keep project/application-data backups. Same-version private prototypes are not equivalent to the public files; match hashes, preserve existing roots and use isolation for comparisons.

## Integrity

Download the selected asset and `SHA256SUMS` from the same release. On Linux, compare `sha256sum FILE` with its manifest entry. On Windows, compare `(Get-FileHash .\FILE -Algorithm SHA256).Hash`. Checksums detect changed bytes; they are not an Authenticode signature.

- `AgentIntersect-World-0.15.0-rc.2-linux-x64.tar.gz`
  - SHA-256: `75a25a55f2fac11910bba77085b67092fc7b40c407b57cd6755380fbf08eb224`
- `AgentIntersect-World-0.15.0-rc.2-linux-x64.deb`
  - SHA-256: `4a5d33106b0f5021f326bd6e1fcc64c790477a1f259c8c1a8c488c0fb8377bcf`
- `AgentIntersect-World-0.15.0-rc.2-windows-x64.zip`
  - SHA-256: `efbce1992cdbe21fe45e58ca6e13c4d883b0444d7330f476c8eb835417208e8a`
- `AgentIntersect-World-0.15.0-rc.2-windows.3-windows-x64-setup.exe`
  - SHA-256: `bbbef04367ba9ca404a9399e68625401445f181b10ed3d8e47a3cdcf9287f588`
- `agentintersect-world-installer-0.15.0-rc.2.tgz`
  - SHA-256: `f2d871a83039402082291dcacdaf3579a278b7429f27a7e7d9f13e15112a7e2a`
- `Git-for-Windows-2.56.0.windows.2-corresponding-sources.zip`
  - SHA-256: `4a5dffbd704a444febc906078a2439ed883598f1bfae70e68e7b08833c4270bf`

## Bundled source and licenses

The Git source companion covers every unique package/version entry in the bundled Git inventory with source packages and build recipes, plus assembly scripts, patch files and source mapping. It includes a README documenting the xpdf-tools source assembly and LFS/GCM architecture-neutral recipes. No Git code was modified by World. Existing license texts are preserved inside the runtime and source packages. See [Git source details](../tooling/release/GIT-SOURCES.md) and [third-party notices](../THIRD_PARTY_NOTICES.md). World-owned MIT licensing does not relicense bundled components or supplied media.

The binaries retain historical private-candidate README wording because they are intentionally unchanged. This public release page and companion source materials supersede that distribution-status wording, not the embedded provenance or component licenses.
