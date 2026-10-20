# Bundled Git for Windows

Windows candidates include the complete official Portable Git for Windows 2.56.0.windows.2 distribution, separate from World-owned MIT code. Its own licenses apply. No Git source code was modified by World.

- Binary source: https://github.com/git-for-windows/git/releases/tag/v2.56.0.windows.2
- Archive: PortableGit-2.56.0.2-64-bit.7z.exe
- SHA256: 075e158ef8e1f0ab80b347e245405d3eca735c2dc88fd8e032e137d0ca61f61b
- Git source: https://github.com/git-for-windows/git/tree/v2.56.0.windows.2
- Distribution/build recipes: https://github.com/git-for-windows/build-extra
- Supporting package recipes/sources: https://github.com/git-for-windows/MSYS2-packages and https://github.com/git-for-windows/MINGW-packages

Retained inside runtime/git: LICENSE.txt, etc/package-versions.txt, usr/share/licenses, ucrt64/share/licenses, upstream README.portable and all supplied license files. WORLD-PROVENANCE.json identifies the exact downloaded distribution. Upstream post-install runs in the private application Git directory on first launch; it is not run on the build machine and does not install Git globally.

For the public 0.15.0-rc.2 release, the [corresponding-source companion](https://github.com/MelaBuilt-AI/AgentIntersect-World/releases/download/v0.15.0-rc.2/Git-for-Windows-2.56.0.windows.2-corresponding-sources.zip) supplies 147 source-package archives covering the 171 unique package/version entries in the shipped inventory, plus build-extra assembly scripts, recipes, patches and source/hash mappings. Consult its README for the exact xpdf-tools recipe reconstruction and architecture-neutral LFS/GCM packaging details. The release SHA256SUMS covers this companion. The accepted installers remain byte-identical; this companion supplements the older private-candidate wording inside them. Upstream licenses remain applicable.
