# Component licensing and distribution

The original repository material remains available under the [MIT license](../LICENSE).
Do not interpret that file as relicensing third-party or GPL-derived components.
The owner explicitly accepts GPL reuse when it materially accelerates development.

The M0 MIX reader is being developed under GPL-3.0-or-later because its implementation
uses the OpenRA format implementation as a reference. Code and provenance in that
component must carry the corresponding license. A combined distribution incorporating
that GPL component must satisfy GPL-3.0-or-later, including applicable source and notice
requirements; MIT permissions for separable original components remain available.
The full [GPLv3 text](../LICENSES/GPL-3.0-or-later.txt) is included (copied from OpenRA
revision `f3ec7f8e1593b482f85fd101652deb740c33dee6`, `COPYING`). Per-component notices
must accompany future browser/WASM bundles. No retail game assets are licensed here.

## Initial pinned dependencies

| Component | Version | License / scope |
| --- | --- | --- |
| egoroof-blowfish | 4.0.3 | MIT; browser-capable cipher primitive, planned MIX reader dependency |
| TypeScript | 7.0.2 | Apache-2.0; development compiler |
| tsx | 4.23.13 | MIT; development test loader |
| @types/node | 24.13.3 | MIT; development types |

Registry versions/licenses and integrity values were checked on 2026-09-09; the lockfile
records exact dependency trees. Review transitive notices at packaging time. No browser
engine/WASM binary or final distribution is produced by this foundation PR.

Before adding a decoder or vendored source, record upstream URL, exact revision/version,
files reused or translated, SPDX license, local changes, and a source/distribution plan.
Do not describe a GPL-derived implementation as an MIT clean-room implementation.
Native codec builds need their own configuration-specific audit; none is adopted here.
