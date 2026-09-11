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
The original campaign launch planner and source reader are GPL-3.0-or-later.
[Campaign launch provenance](../packages/content/CAMPAIGN_LAUNCH_PROVENANCE.md)
records the inspected entry-selection and theater consumers; its notice accompanies
the development bundle. Localized source strings remain on the selecting device.
The staged typed entity-definition compiler and original fixtures also use GPL-3.0-or-later.
[Entity-definition provenance](../packages/content/ENTITY_DEFINITIONS_PROVENANCE.md)
records the pinned static field/load evidence and deliberate numeric/runtime boundaries;
its notice accompanies the development bundle. No retail rule or placement rows are shipped.
The terrain traversal compiler and original fixtures retain the content GPL terms,
with native land-table evidence and explicit ground-subset limits in
[traversal provenance](../packages/content/TERRAIN_TRAVERSAL_PROVENANCE.md).
The static base-foundation compiler and original fixtures are GPL-3.0-or-later;
[foundation provenance](../packages/content/FOUNDATION_OCCUPANCY_PROVENANCE.md)
records the inspected geometry and accompanies the development bundle. No retail
cell arrays or native bytes are distributed.
The typed weapon compiler, numeric helper and original fixtures are GPL-3.0-or-later;
[weapon-definition provenance](../packages/content/WEAPON_DEFINITIONS_PROVENANCE.md)
records their native/reference scope and accompanies the development bundle.
Quantized square-root mantissas are generated mathematically; no retail lookup
tables are shipped.
The voxel plan and verified resource preparation compiler and original fixtures
are GPL-3.0-or-later. [Voxel resource provenance](../packages/content/VOXEL_RESOURCES_PROVENANCE.md)
records native naming/mount evidence and the explicit unlit still limits; its notice
accompanies the development bundle. No retail models, matrices, palettes or pixels
are distributed.

The typed team/task-force/script compiler, helpers and original fixtures are
GPL-3.0-or-later. [Team-definition provenance](../packages/content/TEAM_DEFINITIONS_PROVENANCE.md)
records staged native allocation/load evidence and unsupported execution boundaries;
its notice accompanies the development bundle. No retail AI or mission rows are shipped.

The CPU terrain scene and composing browser viewport are GPL-3.0-or-later;
[render provenance](../packages/render/PROVENANCE.md) records pinned OpenRA placement
and composition references. The selected-frame SHP compositor uses the same license;
[sprite layer provenance](../packages/render/SPRITE_PROVENANCE.md) records its
OpenRA references and explicit WebRA2 anchor, depth and remap policies. These
notices accompany the development bundle. The unlit VXL/HVA rasterizer also uses
GPL-3.0-or-later, with its pinned OpenRA transform policy, composed decoder
attributions and original CPU rasterization described in
[voxel render provenance](../packages/render/VOXEL_PROVENANCE.md). Its notice is
included in the code-only development bundle.

The original [performance harness](performance-baseline.md) in tools/performance/
uses GPL-3.0-or-later when composing those engine/browser components; its separable
notice-source list is MIT. Generated benchmarks stay under ignored local/ and carry
the existing app's broader license/provenance set, exact dependency license texts
and corresponding-source/build location. Workload maps, tiles, sprites and commands
are generated original fixtures. No retail assets or new dependency are included.

The original WebGL2 experiment and its composing diagnostic are GPL-3.0-or-later.
[GPU provenance](../packages/render/GPU_PROVENANCE.md) distinguishes original GPU
code from the existing CPU/decoder references. Retain that notice and composed
notices in diagnostic distributions. No retail textures or new dependency are added.

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
presentation diagnostics are original MIT code. Their earlier privately evaluated FFmpeg
core remains a historical GPL research reference;
[the media report](analysis/media-presentation.md) records that boundary. The new
[persistent media component](persistent-media.md) uses an exact narrow LGPL-2.1-or-later
FFmpeg build with GPL/nonfree/version3 features disabled. Its independently
rebuildable source recipe, runtime libraries and diagnostic corresponding-source
distribution are recorded in [media provenance](../packages/media/PROVENANCE.md).
Generated codec artifacts remain private and are not yet part of the main app build.

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
and its tests use MIT with no added runtime dependency. The original
[navigation component](navigation.md) and its fixtures also use MIT; grid/query
identity hashing uses the already pinned @noble/hashes primitive. The original
[world model/movement/save/replay core](world-movement.md) also uses MIT and that
same existing hash primitive; future native-content adapters retain their own
component attribution. That separable license does
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

The original opening-world content adapter composes the existing content compilers
under GPL-3.0-or-later; [its notice](../packages/sim/WORLD_CONTENT_PROVENANCE.md)
accompanies the development bundle. The pure world model/movement/replay code
remains separable original MIT material. No source assets or original saves are
included in these adapters or their synthetic tests.

Source-bound combat composition is original GPL-3.0-or-later code over the typed
weapon graph. Its [notice](../packages/sim/COMBAT_CONTENT_PROVENANCE.md) accompanies
the development bundle. The separable original combat execution core remains MIT.

The native combat-actor initialization compiler and original fixtures are
GPL-3.0-or-later. Its [provenance notice](../packages/content/COMBAT_ACTORS_PROVENANCE.md)
accompanies the development bundle and distinguishes initial source state from
complete combat or live diplomacy. No native payload or retail rows are shipped.

The scoped invisible-weapon context compiler and its original synthetic tests use
GPL-3.0-or-later. Its [provenance notice](../packages/content/INSTANT_WEAPONS_PROVENANCE.md)
records the native observations and conservative caller-context requirements, and
is included in the development distribution. No native payload or retail fixture
is included; context eligibility does not authorize combat execution.

The source-bound animation-effect compiler and original synthetic tests use
GPL-3.0-or-later. Its [provenance notice](../packages/content/ANIMATION_EFFECTS_PROVENANCE.md)
is included in the development distribution. The notice distinguishes covered
gameplay-effect classifications from excluded native instance/death/splash contexts;
no animation assets, retail rows or native listings are distributed.

The standalone native random primitive in `packages/sim/src/native-random.ts` adapts
Electronic Arts Random2/Random3 under GPL-3.0-or-later. Its
[provenance notice](../packages/sim/NATIVE_RANDOM_PROVENANCE.md) pins the source,
copyright and modifications. Distributions containing it must retain those notices,
the GPL license and applicable corresponding source. The development build includes it through the optional ordinary numerical world
policy. Source combat admission in the browser remains a separate integration.

The original native combat numerical stages and `ordinary-combat-rules.ts`
transaction composition are GPL-3.0-or-later WebRA2 code.
Their [provenance notice](../packages/sim/NATIVE_COMBAT_NUMBERS_PROVENANCE.md)
records selected native observations and synthetic arithmetic evidence. Preserve
that notice, GPL text and applicable corresponding source when distributing them.
No additional third-party implementation is adopted.

The shared group destination planner is original GPL-3.0-or-later WebRA2 code.
Its [provenance notice](../packages/sim/TEAM_DESTINATIONS_PROVENANCE.md), GPL text
and applicable corresponding source accompany distributions containing it. It
composes existing MIT navigation/world modules and adopts no new dependency.

The country/campaign house modifier compiler is original GPL-3.0-or-later WebRA2
code. Its [provenance notice](../packages/content/COMBAT_MODIFIERS_PROVENANCE.md)
identifies composed upstream modules, selected native observations and the source
verification boundary. Distributions retain the notice, GPL text and applicable
corresponding source; no new external implementation or dependency is adopted.

The source-bound existing-member team runtime is original GPL-3.0-or-later code.
Its [provenance notice](../packages/sim/TEAM_RUNTIME_PROVENANCE.md), GPL text and
corresponding source accompany distribution; the web build includes the notice.
The move/jump controller and compound world transactions retain their own notice
separately from the shared destination planner and MIT world simulation.

The original actor death prerequisite compiler and `combat-death-runtime.ts`
conditional ordinary-human decision helper are GPL-3.0-or-later. Their
[provenance notice](../packages/content/COMBAT_DEATH_PROVENANCE.md), GPL text
and corresponding source accompany distribution. The build includes this notice
separately from animation effects and combat actor initialization. The compiler
retains conditional effects and source references; the decision helper preserves
source/current-weapon/veterancy requirements and requests terminal corpse/removal
work. Neither module applies world damage, samples RNG or schedules a death.

The original source combat veterancy compiler and four-consumer selector are
GPL-3.0-or-later. The [component notice](../packages/content/COMBAT_VETERANCY_PROVENANCE.md),
GPL text and corresponding source accompany distribution. The browser build includes
this notice separately from actor initialization and country/difficulty modifiers.

Source team activation and deterministic reinforcement spawning are original
GPL-3.0-or-later WebRA2 code. The [activation notice](../packages/content/TEAM_ACTIVATION_PROVENANCE.md)
and [spawn notice](../packages/sim/TEAM_SPAWN_PROVENANCE.md), GPL text and
corresponding source accompany distribution. Both notices are included by the web
build. The compound runtime composes the existing team and world modules without
a new external dependency; native formation and full constructor behavior remain
outside this bounded component.

Fresh placed actor state and standing infantry firing preparation are original
GPL-3.0-or-later WebRA2 code. Distributions include the
[initial-state notice](../packages/content/COMBAT_INITIAL_RUNTIME_PROVENANCE.md),
[firing scheduler notice](../packages/sim/INFANTRY_FIRING_PROVENANCE.md), GPL text
and applicable corresponding source. The web build includes both notices. The
source compiler and pure scheduler adopt no new external dependency; live
attack admission and world resolution are separate integration work.

The optional ordinary world death policy is original GPL-3.0-or-later WebRA2 code.
Its [notice](../packages/sim/ORDINARY_DEATH_PROVENANCE.md), GPL text and applicable
corresponding source accompany distributions. The browser build includes the notice
separately from native source death preparation and random arithmetic. Existing MIT
world modules compose this policy; no new external dependency is adopted.

The optional standing-infantry world integration composes the GPL firing scheduler
inside existing MIT combat/world modules. The retained
[firing notice](../packages/sim/INFANTRY_FIRING_PROVENANCE.md) covers this original
composition and its explicit cadence. Distribution includes that notice, GPL text
and applicable corresponding source; no additional dependency is adopted.

The source-bound standing infantry bridge and world binding helper are
GPL-3.0-or-later. The source combat world policy authenticates immutable content
and current terrain/status before beginning and resolving shots. Its
[notice](../packages/sim/ORDINARY_INFANTRY_BRIDGE_PROVENANCE.md), GPL text and
corresponding source accompany the browser build. Existing separable MIT core
files retain their licenses; the combined application remains GPL.

The persistent source team Sleep policy is original GPL-3.0-or-later WebRA2 code.
Its [notice](../packages/sim/TEAM_SLEEP_PROVENANCE.md), GPL text and corresponding
source accompany the composed runtime. The build includes the notice separately
from team definitions, activation, spawning and destination planning. No new
external dependency or original-game content is adopted.

The source CreateTeam recruitment catalog/controller, its compound save/replay
composition and the shared persistent Flash50 policy are original GPL-3.0-or-later
code. The [recruitment notice](../packages/sim/TEAM_RECRUITMENT_PROVENANCE.md)
records the static native evidence, source references and explicit WebRA2 policy
choices. Distributions retain that notice, the GPL text and corresponding source
alongside the existing team and world notices. No retail payload or native listing
is distributed. Separate MIT kernel code remains identified by its own headers.

The ordinary ground traversal extension and source/world adapters are original
GPL-3.0-or-later code. Its [notice](../packages/content/TERRAIN_TRAVERSAL_GROUND_PROVENANCE.md)
accompanies the existing flat-traversal, source-combat and world notices, GPL text
and corresponding source in code distributions. No native listing, retail graph
or new dependency is included. The separable MIT navigation algorithm retains its
own license; importing a different authenticated graph does not change that.

The source infantry passage catalog, occupancy helper and world binding are original
GPL-3.0-or-later code. [Infantry passage provenance](../packages/sim/INFANTRY_PASSAGE_PROVENANCE.md)
records paired native scope and explicit WebRA2 reservation choices; the bundle
ships that notice. Original world/save changes retain their existing MIT notices.
No retail slot rows, geometry or saves accompany the distribution.

Initial source mission bindings and their original fixtures are GPL-3.0-or-later.
The [binding provenance](../packages/sim/MISSION_BINDINGS_PROVENANCE.md) records paired
static initialization/lookup evidence, source identity boundaries and explicit VM
limits. Its notice accompanies the distribution. This component does not execute
original missions, physical event callbacks or campaign continuation.

Source-local flag initialization and the original compound mission/world transactions
are GPL-3.0-or-later. The [mission/world notice](../packages/sim/MISSION_WORLD_PROVENANCE.md)
records their native initialization evidence, new-campaign policy and runtime limits;
it accompanies the bundle. These adapters do not establish complete mission execution
or original campaign continuation.

The bounded mission cue reference compiler, contracts and caller-driven cursor
are original GPL-3.0-or-later modules. The [cue notice](../packages/content/MISSION_CUES_PROVENANCE.md)
records paired source/native evidence, primary layout leads and unresolved playback
boundaries. Distribution includes that notice and the existing INI/CSF/GPL notices;
no retail media, localized source strings or native listings are embedded.

The authenticated initial waypoint source helper and its team/reinforcement/
recruitment gates are original GPL-3.0-or-later work. Distribution includes the
[initial waypoint notice](../packages/content/INITIAL_WAYPOINTS_PROVENANCE.md) and
existing content/simulation notices. Native range metadata is factual evidence;
no retail rows, coordinates or native listings are included in the build.

The initial source cell-entry adapter and its VM/compound dispatch are original
GPL-3.0-or-later work. Distribution includes the [cell-entry notice](../packages/sim/MISSION_CELL_ENTRY_PROVENANCE.md)
and the updated mission VM/world notices. Native evidence is metadata only; no
retail source rows, cell geometry or native listings are included.

The mission audio source-plan and sample preparation modules are original
GPL-3.0-or-later work, composing the existing indexed-audio and verified-source
components. Distribution includes the [mission audio notice](../packages/content/MISSION_AUDIO_PROVENANCE.md)
and existing GPL/format notices. No new external decoder dependency, retail registry
rows, waveform bytes or native listings are included.

The initial object combat-event source adapter and mission dispatch are original
GPL-3.0-or-later work. Distribution includes the [object event notice](../packages/sim/MISSION_OBJECT_EVENT_PROVENANCE.md)
and the updated mission/world notices. Pure world/combat observation bookkeeping
and its original fixtures retain MIT notices. No retail payload, waveform, geometry
or native executable listing accompanies the distribution.

The bounded mission PCM/IMA decoder adapts the pinned GPL-3.0-or-later XCC
tables, per-bit arithmetic and block layout under the
[decoder notice](../packages/formats/MISSION_AUDIO_DECODE_PROVENANCE.md). The
original ownership, bounds and metadata code uses the same license. Distribution
copies that exact notice, including corresponding-source obligations and the
separate primary/native evidence. FFmpeg remains a private independent comparison
tool; no FFmpeg executable or retail waveform is distributed.


The original complete mission team action source and common team transaction are
GPL-3.0-or-later. Their [source notice](../packages/sim/MISSION_TEAM_ACTION_PROVENANCE.md)
and [runtime notice](../packages/sim/MISSION_TEAM_RUNTIME_PROVENANCE.md) accompany
both the source and the browser distribution, alongside GPL text and applicable
corresponding source. The root VM/world adapter retains its existing GPL notices.
No new external dependency or retail content is introduced by this integration.

The source-bound team-cell context and compound dispatch are original
GPL-3.0-or-later work. The [component notice](../packages/sim/MISSION_TEAM_CELL_PROVENANCE.md)
is copied into the browser distribution. The retained genuine traversal accessor
in world content has that component's existing GPL license. No new dependency,
retail implementation, raw source table or native listing is included.

The separate fresh-campaign team allocation source compiler and original tests are
GPL-3.0-or-later. Its [allocation notice](../packages/sim/MISSION_TEAM_ALLOCATION_PROVENANCE.md)
is included byte-for-byte in the code-only development build. It adds no dependency
and does not grant native AI or campaign execution authority. Native listings,
retail names and rule/mission rows are absent from the distribution.

The mission sound/EVA typed source-policy catalog and original fixtures are
GPL-3.0-or-later WebRA2 code. Distribution includes the
[source-policy notice](../packages/content/MISSION_AUDIO_POLICY_PROVENANCE.md),
GPL text and corresponding source. It composes existing cue/audio and numeric
components, adds no dependency, and includes no retail waveform, native listing
or binary table. Source readiness does not authorize playback or campaign start.


The optional current-house ledger and source-ordered mission/world context are
original GPL-3.0-or-later components. Distribution includes the
[house notice](../packages/sim/MISSION_HOUSE_PROVENANCE.md), existing mission/world
notices, corresponding source and build scripts. The
[dispatch checkpoint](mission-house-dispatch.md) separates native source facts
from WebRA2 transaction policy; no native listings or original mission data ship.
