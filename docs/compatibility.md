# Compatibility and verification matrix

M0 status: **archive tooling and command boundaries are implemented; gameplay is
not implemented**. See the [MIX census](analysis/mix-reader.md),
[behavior specifications](specs/README.md), and browser/media reports linked below.
This table is a requirements seed, not an exhaustive specification or a claim that
every listed format/behavior has been confirmed in use.

Use these statuses per feature: NOT_STARTED, OBSERVED (data only), SPECIFIED,
IMPLEMENTED, VERIFIED, BLOCKED, DEFERRED. For a VERIFIED row, attach behavior/format
spec, implementation, test, profile/build and reference evidence. Add separate RA2
and YR rows where they differ. Required R1 rows cannot be silently deferred.

| Area / requirement | Current status | Earliest gate | Evidence needed for verification |
| --- | --- | --- | --- |
| Classic/flagged/encrypted/nested MIX; checksums; hashed names | IMPLEMENTED bounded reader/census; names incomplete, two checksum mismatches unresolved | M0–M1 | Synthetic bounds/collision/truncation tests pass; private 117-archive census decodes structurally; resolve [checksum policy #11](https://github.com/lictl/WebRA2/issues/11) and remaining names |
| RA2/YR patch/loose/mod/language/theater precedence | OBSERVED physical variants and rule overlaps; effective resolver NOT_STARTED | M0–M1 | [Campaign census](analysis/campaign-census.md), effective manifests and duplicate/override tests; [#18](https://github.com/lictl/WebRA2/issues/18) |
| Folder/files/ZIP import and assets-only manifests | NOT_STARTED | M1 | Full/minimal/missing/corrupt files, progress/cancel, no server asset bytes |
| Browser storage and localhost offline flow | OBSERVED diagnostic File/OPFS/IndexedDB probes on Chrome/Firefox/Safari; product flow NOT_STARTED | M1/R1 | [Browser measurements](analysis/browser-feasibility.md); Edge, quotas/eviction, full import and offline recovery remain |
| INI, CSF, map rule overrides and locale handling | IMPLEMENTED bounded research scanners; production compiler/locale selection NOT_STARTED | M0–M2 | [Campaign](analysis/campaign-census.md) and [CSF metadata](analysis/locale-census.md); production parsing/encoding, source ordering, duplicate policy and playable-locale evidence remain |
| Packed map terrain, overlays and object placement | OBSERVED section names only | M2 | Correct decompression/dimensions/coordinates and real mission layout |
| PAL/SHP/TMP rendering | NOT_STARTED | M2 | Palettes/remaps/transparency, tile/sprite geometry/depth, malformed inputs |
| VXL/HVA rendering | NOT_STARTED | M2 | Body/turret/barrel, normals/lighting, transforms/shadows, orientation evidence |
| Sound, music, cinematics, subtitles | OBSERVED one real Bink sample decoded to null in Chrome/Safari WASM; presentation NOT_STARTED | M0 spike/M2/R1 | [Media measurements](analysis/media-feasibility.md); A/V sync/seek/skip/pause, voice/subtitle integration, Firefox/Edge and large-input peak memory remain in [#12](https://github.com/lictl/WebRA2/issues/12) |
| Fixed ticks, commands, ordering, RNG, state hashes | IMPLEMENTED command JSON validation and batch ordering only; deterministic behavior SPECIFIED | M1 | Tick loop, RNG and canonical state hashes still required; repeatable headless and cross-browser command→state traces |
| Save/replay/export/import and migration | NOT_STARTED runtime; envelope types and behavior SPECIFIED | M1/R1 | Mid-event/AI/combat save equivalence, corruption/version/content mismatch, atomic writes |
| World coordinates, elevation, occupancy and terrain changes | NOT_STARTED | M2–M5 | Correct placement/movement/interactions on slopes, cliffs, bridges and destroyed terrain |
| Pathfinding and locomotion families | NOT_STARTED | M3–M5 | Deterministic ties/replanning, blocked goals, multiple unit types and transports |
| Selection/camera/orders/groups/hotkeys/sidebar/minimap | NOT_STARTED | M2–M3 | Mouse/keyboard actions produce correct commands and visible state |
| Economy/harvest/production/prerequisites/build/deploy | NOT_STARTED | M3–M5 | Queue/resource transitions, footprints, cancel/refund, deployment and power behavior |
| Combat/projectiles/armor/warheads/death/veterancy | NOT_STARTED | M3–M5 | Isolated damage/timing probes, interactions, death ordering and real mission use |
| Visibility/shroud/fog/cloak/detection | NOT_STARTED | M3–M5 | Simulation and rendered player view agree; hidden data not presented |
| Capture/repair/garrison/passengers/diplomacy | NOT_STARTED | M3–M5 | Ownership, entry/exit/destruction cases, AI reactions and saved state |
| Special units, status effects and superweapons | NOT_STARTED | M5 | Per-rule inventory including effect lifecycle/counters/interactions and saved state |
| YR-specific mechanics and profile differences | NOT_STARTED | M4–M5 | Per-capability semantics and tests that keep RA2 behavior intact |
| Trigger event/action interpreter, tags, variables, timers | OBSERVED candidate mission opcode census; evidence model SPECIFIED; interpreter NOT_STARTED | M3–M5 | Resolve effective mission closure, execution order/repeat/link semantics and original-game traces |
| ScriptTypes/TaskForces/TeamTypes and campaign AI | OBSERVED candidate script/section census; probe format SPECIFIED; AI NOT_STARTED | M3–M5 | Recruitment, scheduling/interruptions, scripted orders, production/base/attack behavior |
| Campaign objectives/outcomes/progression/difficulty | NOT_STARTED | M3–M6 | Every original mission/difficulty, win/loss and optional/alternate paths |
| Original-format maps/INI/asset mods | NOT_STARTED | R1 | Representative independent mods, override/conflict/dependency diagnostics and saves |
| App shell localization/accessibility/settings | NOT_STARTED | M2/R1 | All actual installed playable locales, CJK, persistence, keyboard and shell labels |
| Resource limits/performance/long sessions | NOT_STARTED | M0 baseline/R1 | Agreed hardware budgets, bounded import/decode memory, large-mission tick/frame data |
| Original Windows save import | DEFERRED best effort | M4 investigation | Identified native format/build and reference-save scenario equivalence |
| Remaining vanilla rules/units/modes/skirmish AI | NOT_STARTED | M7 | Full data census minus campaign-covered features; closure through independent cases |
| Ares/Phobos/other extension semantics | DEFERRED | After R1 | Named mod/extension versions and capability/API coverage |
| Multiplayer | DEFERRED | M8 | Determinism/content negotiation plus actual transport/authority/reconnect/desync tests |

## Campaign ledger to generate in M0

Create one row for every unique playable original mission after archive/patch
resolution, not one row per raw `[Basic]` occurrence. Suggested fields:

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
