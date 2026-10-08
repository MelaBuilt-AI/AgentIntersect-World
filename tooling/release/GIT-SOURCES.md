# Bundled Git for Windows

Windows candidates include the complete official Portable Git for Windows 2.56.0.windows.2 distribution, separate from World-owned MIT code. Its own licenses apply. No Git source code was modified by World.

- Binary source: https://github.com/git-for-windows/git/releases/tag/v2.56.0.windows.2
- Archive: PortableGit-2.56.0.2-64-bit.7z.exe
- SHA256: 075e158ef8e1f0ab80b347e245405d3eca735c2dc88fd8e032e137d0ca61f61b
- Git source: https://github.com/git-for-windows/git/tree/v2.56.0.windows.2
- Distribution/build recipes: https://github.com/git-for-windows/build-extra
- Supporting package recipes/sources: https://github.com/git-for-windows/MSYS2-packages and https://github.com/git-for-windows/MINGW-packages

Retained inside runtime/git: LICENSE.txt, etc/package-versions.txt, usr/share/licenses, ucrt64/share/licenses, upstream README.portable and all supplied license files. WORLD-PROVENANCE.json identifies the exact downloaded distribution. Upstream post-install runs in the private application Git directory on first launch; it is not run on the build machine and does not install Git globally.

This is a private operator-testing candidate. Public redistribution remains gated on supplying/hosting the complete corresponding-source material and satisfying every bundled component's redistribution terms; these reference links alone are not a claim that the public redistribution gate is complete.
