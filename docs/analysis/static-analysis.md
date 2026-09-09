# Initial static analysis of the local installation

Date: 2026-09-09. Scope: read-only installation triage for engine planning.
This is **not** a completed reverse engineering of the executable or an assertion
that the game can already run in a browser.

The owner identifies this as a Steam installation in Traditional Chinese, with
unknown exact versions. That is user-supplied provenance, distinct from the binary
observations below. The owner can provide future original-game comparisons.

## Reproducible evidence

Run `python3 tools/static_inventory.py game` from the repository root. The original
standard-library script is in [tools/static_inventory.py](../../tools/static_inventory.py).
The reviewed metadata snapshot is [installation-inventory.json](installation-inventory.json).
It records hashes for top-level game archives and four executables, PE sections and
imports, version-string candidates, and raw map-section counts. No payload is copied.

Additional observations used `file`, selective printable/UTF-16 string inspection
of `game.exe` and `gamemd.exe`, bundled patch-note headings, and ZIP member names.
The script does not reproduce every exploratory string search. It intentionally
does not print arbitrary strings or keys from game files.

## Confirmed observations

| Evidence | Observation | Implication |
| --- | --- | --- |
| Filesystem inventory | 438 files, 1,961,556,205 bytes (about 1.83 GiB) | Avoid reading/copying the entire installation into browser RAM |
| Top-level archive headers | 69 `.mix`/`.mmx`/`.yro` containers; 66 have the encrypted-index flag | MIX index decoding is on the critical path, including bonus-map containers |
| Unencrypted index bounds | `THEME.MIX`: 16 entries; `thememd.mix`: 10; `langmd.mix`: 10; all declared payload ranges fit | Provides an initial real-file parser check, but filenames remain unresolved |
| `langmd.mix` header and length | Checksum flag set; 20 trailing bytes | Consistent with an archive checksum trailer; checksum has not been verified |
| `ra2.mix`, `ra2md.mix`, `expandmd01.mix`, `langmd.mix`, `mapsmd03.mix`, `gamemd.exe` | Base and expansion files coexist | Keep separate profiles and establish overlay order instead of combining everything |
| PE headers of `game.exe` / `gamemd.exe` | PE32, machine `0x014c` (x86); about 5.08 / 5.29 MB | These are native Windows binaries, not browser/WASM code |
| Their import tables | Windows UI/OS libraries plus `DDRAW`, `DSOUND`, `WINMM`, `WSOCK32`, `binkw32` | Rendering/audio/timing/network/media adapters need independent browser implementations |
| `Ra2.exe` / `RA2MD.exe` | Separate smaller PE32 binaries with different imports and sections | Distinguish launchers from gameplay executables in subsequent analysis |
| Gameplay executable version-string candidates | `game.exe`: `1.08`; `gamemd.exe`: `1.11`; both name `Sun.exe` as original filename | These strings must not be equated with retail gameplay patch versions |
| `launcher.txt` patch headings | RA2 `1.006`; YR `1.001` | Metadata and bundled notes differ; identify the precise build by hashes and provenance |
| Files with `steam_` / installer names, compatibility DLLs, editor bundle | Installation has distribution/tooling additions | Names suggest packaging history; they do not establish that assets are unmodified |
| Editor source ZIP central directory | 405 members, including `MissionEditor`, XCC MIX sources and licenses | Useful format/editor reference, not the proprietary game simulation source |
| Other content | 40 `.mmx`, 13 `.yro`, 90 cached `.mmp`, 35 PDFs, 80 WAVs | Import should distinguish playable required assets from manuals, caches, and tools |

The movie archives alone total 1,055,768,688 bytes. Their sizes support lazy media
access and bounded conversion caches; they do not identify their internal movies yet.

## Mission structure visible without index decryption

MIX payloads contain recognizable plaintext INI section headers. A raw scan found:

| Archive | `[Basic]` | `[Map]` | `[Triggers]` / `[Events]` / `[Actions]` | `[TeamTypes]` | `[AITriggerTypes]` |
| --- | ---: | ---: | ---: | ---: | ---: |
| `MAPS01.MIX` | 17 | 17 | 16 each | 16 | 13 |
| `MAPS02.MIX` | 17 | 17 | 16 each | 16 | 11 |
| `mapsmd03.mix` | 14 | 14 | 14 each | 14 | 12 |
| `expandmd01.mix` | 13 | 13 | See snapshot | See snapshot | See snapshot |

These are **section occurrences, not unique campaign mission counts**. There are
no verified archive-member boundaries, deduplicated filenames, or precedence rules
in this scan. Duplicate/variant/bonus maps and patch overrides must be resolved.

The same files expose `[ScriptTypes]`, `[TaskForces]`, `[Tags]`, `[CellTags]`,
`[VariableNames]`, `[Houses]`, `[Waypoints]`, object-placement sections, lighting,
`[IsoMapPack5]`, `[OverlayPack]`, and `[OverlayDataPack]`. Unit/weapon/building-named
sections also occur inside map payloads. This is direct evidence that mission data
contains behavior and rule overrides, and should drive the engine's data model.

Executable string searches independently found base/expansion pairs such as
`AI.INI` / `AIMD.INI`, `ART.INI` / `ARTMD.INI`, `BATTLE.INI` / `BATTLEMD.INI`, archive
patterns, SHP references, VXL/HVA references, and BIK names. These are candidate
inputs to filename resolution, not a complete dependency manifest or proof of order.

## What has not been established

- Encrypted indexes, nested archive boundaries, checksums, filename-hash resolution,
  collision handling, exact mount precedence, all asset formats, or complete mission lists.
- Decompression correctness for map packs and graphics, theater tile mapping,
  voxel transforms/normals, palette remapping, or media decode correctness.
- Trigger opcode semantics, parameter encoding, evaluation order, repeat behavior,
  script scheduling, team recruitment, AI conditions, or mission completion behavior.
- Simulation tick rate, numerical rules, RNG algorithm/call order, pathfinding tie
  breaks, combat edge cases, visibility rules, and RA2/YR differences.
- Native save layout, reference save compatibility, multiplayer protocol, or any
  runtime effect of the installed compatibility wrappers.
- Independent verification of the reported Steam/Traditional Chinese provenance,
  exact builds and complete playable locale set, or formal legal clearance.
  Original-game comparison evidence has not yet been collected. No game executable
  or installer was run.

## Follow-up static work, in order

1. Identify installation/build/locale and hash baselines; keep launchers, compatibility
   wrappers, tools, and reference executables distinct.
2. Select a maintained/licensed MIX implementation or implement a bounded reader;
   validate classic/flagged/encrypted indexes, checksums, member bounds, hashed names,
   nested containers, missing names, and collision diagnostics.
3. Resolve base/patch/language/theater/loose-file precedence separately for RA2/YR.
   Enumerate every mission, rule input, theater and required/optional media file.
4. Generate a metadata-only mission dependency graph and event/action/script opcode
   census. Map each opcode to actual missions and required engine capabilities.
5. Write small factual behavior specifications with evidence and uncertainty. If
   executable disassembly is needed, perform it in ignored local research output
   for the identified build; recover only the behavior needed for an assigned slice.
   Do not commit wholesale disassembly or inferred proprietary source.
6. Pair uncertain semantics with synthetic tests and, when available, original-game
   observations. Static analysis alone cannot close those behavior gates.

## External primary references checked on 2026-09-09

- [EA's FinalSun/FinalAlert2 source repository](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor)
  identifies this as the **editor** source and includes XCC packaging/loading code.
  [Its license](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/main/LICENSE.md)
  must be considered independently of retail assets. No editor code was copied here.
- [OpenRA MIX reader](https://github.com/OpenRA/OpenRA/blob/bleed/OpenRA.Mods.Cnc/FileSystem/MixFile.cs)
  documents classic versus flagged/encrypted indexes and hash-based lookup in code.
  Used to corroborate format interpretation; not vendored. Pin a revision if adopted.
- [OpenRA's RA2 project](https://github.com/OpenRA/ra2) is a GPL-3.0 RA2 mod for OpenRA.
  It is a candidate for targeted reuse/evaluation; its existence does not prove
  original campaign compatibility or a suitable browser port.
- [Chrono Divide](https://chronodivide.com/) demonstrates a browser RA2 client.
  [Its mod SDK](https://github.com/chronodivide/mod-sdk) documents asset/rule integration.
  These establish feasibility/reference value, not permission to reuse its engine
  or proof that it satisfies our campaign requirements.
- [Phobos documentation](https://phobos.readthedocs.io/en/latest/) describes an engine
  extension project. Treat its semantics as a separate future mod tier.

Keep source URLs and exact adopted revisions in future dependency records. Public
source, editor descriptions, and community implementations are evidence sources;
none should silently become the authority for original runtime behavior.
