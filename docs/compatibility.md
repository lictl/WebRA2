# Compatibility and verification matrix

Initial status: **no engine features are implemented**. Installation observations
are in [the static analysis](analysis/static-analysis.md). This table is a requirements
seed, not an assertion that every listed format/behavior has been confirmed in use.
Expand it using the M0 census rather than treating it as an exhaustive specification.

Use these statuses per feature: NOT_STARTED, OBSERVED (data only), SPECIFIED,
IMPLEMENTED, VERIFIED, BLOCKED, DEFERRED. For a VERIFIED row, attach behavior/format
spec, implementation, test, profile/build and reference evidence. Add separate RA2
and YR rows where they differ. Required R1 rows cannot be silently deferred.

| Area / requirement | Current status | Earliest gate | Evidence needed for verification |
| --- | --- | --- | --- |
| Classic/flagged/encrypted/nested MIX; checksums; hashed names | OBSERVED headers only | M0–M1 | Bounded member index, real samples, checksum/collision/truncation cases |
| RA2/YR patch/loose/mod/language/theater precedence | NOT_STARTED | M0–M1 | Source provenance, effective manifests, duplicate/override tests |
| Folder/files/ZIP import and assets-only manifests | NOT_STARTED | M1 | Full/minimal/missing/corrupt files, progress/cancel, no server asset bytes |
| Browser storage and localhost offline flow | NOT_STARTED | M1/R1 | Four browsers, quotas, traversal/escape rejection, reload/reimport/export recovery |
| INI, CSF, map rule overrides and locale handling | OBSERVED section names only | M0–M2 | Parser/encoding behavior, source ordering, Traditional Chinese and actual locale census |
| Packed map terrain, overlays and object placement | OBSERVED section names only | M2 | Correct decompression/dimensions/coordinates and real mission layout |
| PAL/SHP/TMP rendering | NOT_STARTED | M2 | Palettes/remaps/transparency, tile/sprite geometry/depth, malformed inputs |
| VXL/HVA rendering | NOT_STARTED | M2 | Body/turret/barrel, normals/lighting, transforms/shadows, orientation evidence |
| Sound, music, cinematics, subtitles | OBSERVED archive/import evidence only | M0 spike/M2/R1 | Real decode, A/V sync/skip/pause, voice triggers, CJK subtitles, browser measurements |
| Fixed ticks, commands, ordering, RNG, state hashes | NOT_STARTED | M1 | Repeatable headless and cross-browser command→state traces |
| Save/replay/export/import and migration | NOT_STARTED | M1/R1 | Mid-event/AI/combat save equivalence, corruption/version/content mismatch, atomic writes |
| World coordinates, elevation, occupancy and terrain changes | NOT_STARTED | M2–M5 | Correct placement/movement/interactions on slopes, cliffs, bridges and destroyed terrain |
| Pathfinding and locomotion families | NOT_STARTED | M3–M5 | Deterministic ties/replanning, blocked goals, multiple unit types and transports |
| Selection/camera/orders/groups/hotkeys/sidebar/minimap | NOT_STARTED | M2–M3 | Mouse/keyboard actions produce correct commands and visible state |
| Economy/harvest/production/prerequisites/build/deploy | NOT_STARTED | M3–M5 | Queue/resource transitions, footprints, cancel/refund, deployment and power behavior |
| Combat/projectiles/armor/warheads/death/veterancy | NOT_STARTED | M3–M5 | Isolated damage/timing probes, interactions, death ordering and real mission use |
| Visibility/shroud/fog/cloak/detection | NOT_STARTED | M3–M5 | Simulation and rendered player view agree; hidden data not presented |
| Capture/repair/garrison/passengers/diplomacy | NOT_STARTED | M3–M5 | Ownership, entry/exit/destruction cases, AI reactions and saved state |
| Special units, status effects and superweapons | NOT_STARTED | M5 | Per-rule inventory including effect lifecycle/counters/interactions and saved state |
| YR-specific mechanics and profile differences | NOT_STARTED | M4–M5 | Per-capability semantics and tests that keep RA2 behavior intact |
| Trigger event/action interpreter, tags, variables, timers | OBSERVED section names only | M3–M5 | Complete mission opcode census, execution order/repeat/link semantics and traces |
| ScriptTypes/TaskForces/TeamTypes and campaign AI | OBSERVED section names only | M3–M5 | Recruitment, scheduling/interruptions, scripted orders, production/base/attack behavior |
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
