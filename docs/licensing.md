# Component licensing and distribution

The original repository material remains available under the [MIT license](../LICENSE).
Do not interpret that file as relicensing third-party or GPL-derived components.
The owner explicitly accepts GPL reuse when it materially accelerates development.

The merged M0 MIX reader is licensed GPL-3.0-or-later because its implementation
uses the OpenRA format implementation as a reference. Code and provenance in that
component must carry the corresponding license. A combined distribution incorporating
that GPL component must satisfy GPL-3.0-or-later, including applicable source and notice
requirements; MIT permissions for separable original components remain available.
The full [GPLv3 text](../LICENSES/GPL-3.0-or-later.txt) is included (copied from OpenRA
revision `f3ec7f8e1593b482f85fd101652deb740c33dee6`, `COPYING`). Per-component notices
must accompany future browser/WASM bundles. No retail game assets are licensed here.

The bounded content scanners and campaign graph modules in `packages/content/`,
their original tests and campaign analysis CLIs also use GPL-3.0-or-later. They compose
the MIX reader and retain the pinned EA editor/XCC reference and adaptation provenance in
[the content component notice](../packages/content/PROVENANCE.md). The CSF adaptation
credits Olaf van der Spek; no translated game strings or mission/rule payloads are
part of the published census. No additional runtime dependency was introduced.

The MIX integrity policy, its tests and checksum-domain CLI use GPL-3.0-or-later
consistently with the format component they compose. The historical EA cache source
observations in [the integrity report](analysis/checksum-policy.md) establish a
reference boundary; no new upstream implementation was copied in that slice.

The [VFS profile resolver](../packages/vfs/PROVENANCE.md), its metadata projection and
original tests use MIT. Its explicit rank policy does not implement the inspected EA
editor loader. The Node [verified source reader](analysis/verified-source-reader.md)
and its original tests also use MIT. These separable components do not relicense the
GPL components with which a future application may combine them.

## Initial pinned dependencies

| Component | Version | License / scope |
| --- | --- | --- |
| egoroof-blowfish | 4.0.3 | MIT; browser-capable cipher primitive used by the MIX reader |
| TypeScript | 7.0.2 | Apache-2.0; development compiler |
| tsx | 4.23.13 | MIT; development test loader |
| @types/node | 24.13.3 | MIT; development types |

Registry versions/licenses and integrity values were checked on 2026-09-09; the lockfile
records exact dependency trees. Review transitive notices at packaging time. No browser
engine/WASM binary or final distribution is produced by the current tooling.

Before adding a decoder or vendored source, record upstream URL, exact revision/version,
files reused or translated, SPDX license, local changes, and a source/distribution plan.
Do not describe a GPL-derived implementation as an MIT clean-room implementation.
Native codec builds need their own configuration-specific audit; none is adopted here.
