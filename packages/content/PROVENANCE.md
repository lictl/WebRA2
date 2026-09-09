# Content census provenance and boundaries

The research scanners/graphs in `src/`, campaign analysis CLIs, and their
original synthetic tests use **GPL-3.0-or-later**. Copyright 2026 WebRA2 contributors.
They compose the existing GPL MIX reader and conservatively retain GPL terms for
the format references below. See [the GPL text](../../LICENSES/GPL-3.0-or-later.txt)
and [root license mapping](../../docs/licensing.md). No new dependency is installed.

- The byte-range/archive/hash interfaces come from
  [the MIX component](../formats/PROVENANCE.md), which documents its pinned OpenRA
  adaptation and MIT Blowfish primitive. The new CLI uses those interfaces rather
  than extracting or executing the original game.
- EA editor revision `6abf0f557469baea73079c6bf6550709e2e3584e`, GPL-3.0:
  [TriggerEventsDlg.cpp, GetEventParamStart](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/TriggerEventsDlg.cpp#L78-L99)
  supplies the 3/4-token event-framing observation;
  [TriggerActionsDlg.cpp](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/TriggerActionsDlg.cpp#L105-L109)
  supplies the eight-token action-framing observation;
  [ScriptTypes.cpp](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/ScriptTypes.cpp#L375-L392)
  distinguishes numbered step types and parameters. No editor code or opcode table
  is copied; these observations guide the original bounded scanner. They do not
  establish opcode effects or runtime scheduling.
- XCC revision `6f91bf8b00d3acabb1be765118a37c0cb74e85ec`, GPL-3.0-or-later,
  copyright Olaf van der Spek:
  [csf_file.cpp](https://github.com/OlafvdSpek/xcc/blob/6f91bf8b00d3acabb1be765118a37c0cb74e85ec/misc/csf_file.cpp#L67-L107)
  supplies label/encoded-string/extra-string structure and complemented character
  representation. The TypeScript adaptation uses bounds-checked byte views and
  emits counts instead of retaining a translation map. It supports only empty or
  single-value labels; multi-value variants fail explicitly. No XCC source file is
  vendored. Preserve XCC attribution and GPL terms for this adaptation.

The INI scanner is original code. It preserves repeated section/key occurrences
and ASCII-compatible bytes without selecting duplicate, override or locale policy.
Its trimmed-line subset is a research tool, not a production INI compatibility
claim. The CSF scanner emits only counts and raw header fields. Language/script
classification and duplicate-label resolution remain separate evidence tasks.

The structural graph in `src/campaign-graph.ts`, table census in
`src/campaign-tables.ts`, graph CLI and original tests retain GPL-3.0-or-later.
Their field evidence uses the same pinned EA editor revision above, including
`TeamTypes.cpp`, `TaskForce.cpp`, `Houses.cpp`, `functions.cpp`,
`TriggerOptionsDlg.cpp`, `MapData.cpp` and `SingleplayerSettings.cpp`.
[The graph report](../../docs/analysis/campaign-graph.md) records exact source links
and the supported field/token mappings. No editor implementation body was copied.
Country/house binding, opcode effects, native progression and effective INI precedence
remain unimplemented. The pure graph validates hash identity shape; the separate
MIT verified-source adapter verifies private bytes in the Node CLI.

Tests construct original INI text, CSF records and classic nested archives in code.
No original mission, string table, translated game value, save, or extracted
payload is checked in. Public metadata includes source hashes, candidate filenames,
source chains, section/key locators, opcode IDs, structural counts and alternatives.
Do not add retail payloads to fixtures or logs during future decoder work.

Combined distribution must preserve this provenance, copyright/permission notices
and applicable GPL corresponding source/build information. This code license does
not license retail assets. Root license mapping updates are coordinator-owned.
