# Compatibility and verification matrix

M0 status: **evidence and feasibility complete; gameplay is not implemented**.
The [M0 exit record](analysis/m0-exit.md) maps each accepted gate to its reviewed
artifact and limits. Research tooling and diagnostic samples are not a game renderer.
This table is a requirements seed, not an exhaustive specification or a claim that
every listed format/behavior has been confirmed in use.

Use these statuses per feature: NOT_STARTED, OBSERVED (data only), SPECIFIED,
IMPLEMENTED, VERIFIED, BLOCKED, DEFERRED. For a VERIFIED row, attach behavior/format
spec, implementation, test, profile/build and reference evidence. Add separate RA2
and YR rows where they differ. Required R1 rows cannot be silently deferred.

| Area / requirement | Current status | Earliest gate | Evidence needed for verification |
| --- | --- | --- | --- |
| Classic/flagged/encrypted/nested MIX; checksums; hashed names | IMPLEMENTED bounded reader/census and explicit tolerant/strict policy; names incomplete, two checksum causes unresolved | M0–M1 | Synthetic bounds/collision/truncation tests pass; private 117-archive census decodes structurally; [integrity policy](analysis/checksum-policy.md) tested; native mismatch cause/handling remains in [#11](https://github.com/lictl/WebRA2/issues/11); importer UI and remaining names still required |
| RA2/YR patch/loose/mod/language/theater precedence | IMPLEMENTED explicit ranked profile resolver; OBSERVED bounded native expansion/loose/first-match paths | M0–M1 | [Resolver](analysis/profile-resolution.md), [native evidence](analysis/native-profile-evidence.md) and [selected profiles](analysis/m0-reference-profile.json); universal dynamic/mod/theater/language order and full runtime manifests remain [#18](https://github.com/lictl/WebRA2/issues/18) |
| Folder/files/ZIP import and assets-only manifests | NOT_STARTED | M1 | Full/minimal/missing/corrupt files, progress/cancel, no server asset bytes |
| Browser storage and localhost offline flow | OBSERVED diagnostic File/OPFS/IndexedDB/CJK probes on Chrome/Edge/Firefox/Safari; product flow NOT_STARTED | M1/R1 | [Initial probe](analysis/browser-feasibility.md) and [Edge/Firefox follow-up](analysis/media-presentation.md); quota/eviction, full import, permission loss and offline recovery remain |
| INI, CSF, map rule overrides and locale handling | IMPLEMENTED bounded research scanners and glyph coverage; production compiler/locale selection NOT_STARTED | M0–M2 | [Campaign](analysis/campaign-census.md), [font/CSF evidence](analysis/locale-dependencies.md) and native locators cover one observed Traditional Chinese candidate; duplicate lookup, layout, encoding and playable locale behavior remain |
| Packed map terrain, overlays and object placement | OBSERVED packed sections; IMPLEMENTED structural object-reference graph only | M2 | [Opening graphs](analysis/campaign-graph.md) trace owner/type/tag references; decompression/dimensions/coordinates and real mission layout remain |
| PAL/SHP/TMP rendering | IMPLEMENTED bounded SHP format-2 nonzero literal subset and paired PAL conversion; OBSERVED real Chrome sample; other rendering NOT_STARTED | M0 proof/M2 | [800×600 proof](analysis/shp-sample.md) has native palette pairing and independently reproduced pixel hashes; remaining SHP codecs, transparency/remaps, TMP, depth and native output equivalence remain |
| VXL/HVA rendering | NOT_STARTED | M2 | Body/turret/barrel, normals/lighting, transforms/shadows, orientation evidence |
| Sound, music, cinematics, subtitles | OBSERVED real Bink/PCM presentation in four browser families; IMPLEMENTED bounded sound dependency indexing; campaign audio NOT_STARTED | M0 spike/M2/R1 | [Presentation](analysis/media-presentation.md) and [sound candidates](analysis/dependency-candidates.md); persistent decoding, long-clip rereads/underruns, A/V correctness, controls, subtitles, distribution and attributable peak memory remain [#12](https://github.com/lictl/WebRA2/issues/12) |
| Fixed ticks, commands, ordering, RNG, state hashes | IMPLEMENTED command JSON validation and batch ordering only; deterministic behavior SPECIFIED | M1 | Tick loop, RNG and canonical state hashes still required; repeatable headless and cross-browser command→state traces |
| Save/replay/export/import and migration | NOT_STARTED runtime; envelope types and behavior SPECIFIED | M1/R1 | Mid-event/AI/combat save equivalence, corruption/version/content mismatch, atomic writes |
| World coordinates, elevation, occupancy and terrain changes | NOT_STARTED | M2–M5 | Correct placement/movement/interactions on slopes, cliffs, bridges and destroyed terrain |
| Pathfinding and locomotion families | IMPLEMENTED bounded WebRA2 routing substrate; native terrain/locomotion integration NOT_STARTED | M3–M5 | Deterministic ties/replanning, blocked goals, multiple unit types and transports |
| Selection/camera/orders/groups/hotkeys/sidebar/minimap | NOT_STARTED | M2–M3 | Mouse/keyboard actions produce correct commands and visible state |
| Economy/harvest/production/prerequisites/build/deploy | NOT_STARTED | M3–M5 | Queue/resource transitions, footprints, cancel/refund, deployment and power behavior |
| Combat/projectiles/armor/warheads/death/veterancy | NOT_STARTED | M3–M5 | Isolated damage/timing probes, interactions, death ordering and real mission use |
| Visibility/shroud/fog/cloak/detection | NOT_STARTED | M3–M5 | Simulation and rendered player view agree; hidden data not presented |
| Capture/repair/garrison/passengers/diplomacy | NOT_STARTED | M3–M5 | Ownership, entry/exit/destruction cases, AI reactions and saved state |
| Special units, status effects and superweapons | NOT_STARTED | M5 | Per-rule inventory including effect lifecycle/counters/interactions and saved state |
| YR-specific mechanics and profile differences | NOT_STARTED | M4–M5 | Per-capability semantics and tests that keep RA2 behavior intact |
| Trigger event/action interpreter, tags, variables, timers | IMPLEMENTED bounded source-bound VM, flags/timers, force/delete, initial cell/object callbacks and team/cue requests; complete mission closure remains | M3–M5 | [Team dispatch](mission-team-dispatch.md) retains whole-source gates; dynamic actor contexts, further events/actions and original-game execution comparisons remain |
| ScriptTypes/TaskForces/TeamTypes and campaign AI | IMPLEMENTED complete declaration graph and bounded shared recruitment/reinforcement, Move/Jump/Sleep/Flash controllers, release and save/replay; general campaign AI remains | M3–M5 | [Source closure](mission-team-action-source.md) and [common runtime](mission-team-runtime.md); automatic allocation, further scripts, production/base/attack behavior and dynamic combat integration remain |
| Campaign objectives/outcomes/progression/difficulty | OBSERVED native MAPSEL continuation and EndOfGame controls; runtime NOT_STARTED | M3–M6 | [38-mission ledger](analysis/m0-campaign-ledger.md) and [native evidence](analysis/native-profile-evidence.md) pin normal targets; actual win/loss/branch/difficulty, saved outcomes and media sequencing remain |
| Original-format maps/INI/asset mods | NOT_STARTED | R1 | Representative independent mods, override/conflict/dependency diagnostics and saves |
| App shell localization/accessibility/settings | NOT_STARTED | M2/R1 | All actual installed playable locales, CJK, persistence, keyboard and shell labels |
| Resource limits/performance/long sessions | OBSERVED import/media/sprite diagnostic baseline; SPECIFIED initial numeric gates; game workloads NOT_STARTED | M0 baseline/R1 | [ADR 0002](adr/0002-reference-profiles-and-initial-budgets.md) pins measured hardware and initial budgets; persistent decoder currently fails future long-clip I/O gate; attributable peaks and large-mission tick/frame measurements remain |
| Original Windows save import | DEFERRED best effort | M4 investigation | Identified native format/build and reference-save scenario equivalence |
| Remaining vanilla rules/units/modes/skirmish AI | NOT_STARTED | M7 | Full data census minus campaign-covered features; closure through independent cases |
| Ares/Phobos/other extension semantics | DEFERRED | After R1 | Named mod/extension versions and capability/API coverage |
| Multiplayer | DEFERRED | M8 | Determinism/content negotiation plus actual transport/authority/reconnect/desync tests |

## Campaign ledger and verification expansion

The [M0 ledger](analysis/m0-campaign-ledger.md) now records 38 selected faction
mission identities, native normal transitions/ending controls and opcode counts.
All remain INVENTORIED. The source reports retain per-mission opcode IDs, dependency
candidates and locale/media unknowns. Extend these rows as implementation proceeds
with difficulty, render/behavior and reference evidence, using fields such as:

```text
game/profile, campaign, mission ID, source archive/member/hash, prerequisite/next,
theater, locale/media dependencies, difficulty, required event/action/script IDs,
mechanics and AI capabilities, unknowns, decode/render/sim status,
win/loss/optional-path evidence, save/replay evidence, original comparison,
browser coverage, deviations, release status
```

Use stage values such as INVENTORIED → DECODES → RENDERS → PLAYABLE → VERIFIED,
with a separate BLOCKED reason. A successful mission load or a trigger stub cannot
advance a mission to PLAYABLE/VERIFIED. Metadata-only manifests may be public;
mission payloads and original-game screenshots/recordings/saves remain local.
