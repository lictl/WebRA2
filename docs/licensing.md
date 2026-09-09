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

The bounded SHP format-2 decoder, analysis CLI and original tests retain
GPL-3.0-or-later with pinned OpenRA and EA/XCC notices in
[the sprite provenance](../packages/formats/shp-PROVENANCE.md). The composing browser
probe and loopback server also use GPL-3.0-or-later; no retail sprite/palette is shipped.

The map-pack LZO/LCW codecs retain their pinned OpenRA/minilzo attribution in
[map-pack provenance](../packages/formats/MAP_PACK_PROVENANCE.md). The TMP decoder
adapts pinned OpenRA and EA/XCC definitions and unpacking under GPL-3.0-or-later;
[TMP provenance](../packages/formats/TMP_PROVENANCE.md) preserves their notices.
The selected-frame SHP runtime separately preserves its OpenRA/EA/XCC references in
[runtime sprite provenance](../packages/formats/SHP_RUNTIME_PROVENANCE.md). Its
notice also accompanies the development bundle. VXL/HVA decoding preserves the
OpenRA/EA-XCC attribution under GPL-3.0-or-later in
[voxel provenance](../packages/formats/VOXEL_PROVENANCE.md); no model, animation
transform or normal-vector table is distributed.
Original runtime INI, terrain/object/mission-logic tables, structural object bindings, theater mappings, terrain preview and verified catalog
profile composition use the content component's GPL-3.0-or-later license. No decoded retail map or tile is shipped. The original object-art planner and
verified still-resource adapter use the same GPL terms, with pinned editor
references and explicit preview limitations in
[object-art provenance](../packages/content/OBJECT_ART_PROVENANCE.md). Native
scenario construction retains its static evidence in
[construction provenance](../packages/content/CONSTRUCTION_PROVENANCE.md); both
notices accompany the development bundle. The exact retained-source view uses
the same GPL terms and includes [its provenance](../packages/content/INI_SOURCE_PROVENANCE.md)
in the bundle.

The CPU terrain scene and composing browser viewport are GPL-3.0-or-later;
[render provenance](../packages/render/PROVENANCE.md) records pinned OpenRA placement
and composition references. The selected-frame SHP compositor uses the same license;
[sprite layer provenance](../packages/render/SPRITE_PROVENANCE.md) records its
OpenRA references and explicit WebRA2 anchor, depth and remap policies. These
notices accompany the development bundle.

The original bounded mission trigger interpreter and fixtures are GPL-3.0-or-later;
[mission runtime provenance](../packages/sim/MISSION_LOGIC_PROVENANCE.md) separates
factual native analysis from source reuse and preserves the existing compiler
attribution. It adds no dependency. Its notice accompanies the development bundle.

The locale/font coverage scanner and verified analysis CLI retain GPL-3.0-or-later.
The `fonT` adaptation preserves the MIT copyright and permission notice for Belonit's
ra2fnt revision `56da5b30fb53eebfaf35e98b2e1c6b3e150f58af` in
[locale provenance](../packages/content/LOCALE_PROVENANCE.md). No Go implementation,
retail font, glyph image or translated string is shipped; no dependency was added.

The transitive dependency and native-profile research modules/CLIs/tests are also
GPL-3.0-or-later; pinned YRpp/EA/XCC references and the audio-index framing attribution
are recorded in [content provenance](../packages/content/PROVENANCE.md). The browser
presentation diagnostics are original MIT code. Their privately evaluated FFmpeg
core remains a separately pinned GPL research reference, not a shipped dependency;
[the media report](analysis/media-presentation.md) records the build/notice boundary.

The MIX integrity policy, its tests and checksum-domain CLI use GPL-3.0-or-later
consistently with the format component they compose. The historical EA cache source
observations in [the integrity report](analysis/checksum-policy.md) establish a
reference boundary; no new upstream implementation was copied in that slice.

The [VFS profile resolver](../packages/vfs/PROVENANCE.md), its metadata projection and
original tests use MIT. Its explicit rank policy does not implement the inspected EA
editor loader. The Node [verified source reader](analysis/verified-source-reader.md)
and its original tests also use MIT. These separable components do not relicense the
GPL components with which a future application may combine them.

The browser source/inspection and incremental hashing adapters use GPL-3.0-or-later
consistently with the content pipeline they compose. Hashing uses the MIT-licensed
@noble/hashes primitive; its exact package identity and full notice are in
[hash provenance](../packages/vfs/HASH_PROVENANCE.md). Complete-root verification
is a byte identity check, not a game content license or publisher authenticity claim.
The runtime CSF lookup also retains the content component's GPL license and source
attribution; decoded catalogs remain local to the player.

The original [synthetic simulation and save/replay foundation](simulation-foundation.md)
and its tests use MIT with no added runtime dependency. That separable license does
not change GPL obligations for an application combining it with GPL components.

The [application shell](../apps/web/PROVENANCE.md), its original interface text and
tests are GPL-3.0-or-later. The combined browser bundle retains GPL obligations;
the build includes the app/component notices, GPL text and adopted runtime dependency
licenses. System fonts and original HTML/CSS shapes provide the interface; no retail
artwork, text, font or media is distributed.

## Initial pinned dependencies

| Component | Version | License / scope |
| --- | --- | --- |
| @noble/hashes | 2.4.0 | MIT; incremental SHA-256/SHA-1 for bounded source verification |
| egoroof-blowfish | 4.0.3 | MIT; browser-capable cipher primitive used by the MIX reader |
| TypeScript | 7.0.2 | Apache-2.0; development compiler |
| tsx | 4.23.13 | MIT; development test loader |
| esbuild | 0.28.2 | MIT; direct development bundler, already pinned transitively before M1 |
| @types/node | 24.13.3 | MIT; development types |

Registry versions/licenses and integrity values were checked on 2026-09-09; the lockfile
records exact dependency trees. Review transitive notices at packaging time. The M1 build emits local development browser code and component notices from
explicit source entrypoints; no retail assets or WASM codec binary are included.
Final release distribution/source packaging remains a separate gate.

Before adding a decoder or vendored source, record upstream URL, exact revision/version,
files reused or translated, SPDX license, local changes, and a source/distribution plan.
Do not describe a GPL-derived implementation as an MIT clean-room implementation.
Native codec builds need their own configuration-specific audit; none is adopted here.
