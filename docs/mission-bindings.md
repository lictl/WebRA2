# Initial mission tag bindings

This component authenticates initial binding candidates from genuine world and entity
factories and a fresh hash-checked mission read. It does not start a mission or
supply global/local flag defaults. Both original openings still fail the existing
whole-program interpreter preflight.

`compileMissionBindings({world, definitions, rules, mission, difficulty})` retains
all source trigger, tag, object and cell identities. A runtime tag is shared by
its object/cell attachments and initial map, scenario-poll and house list
memberships. Its `initialReferenceCount` counts object and cell references only;
`dispatchAttachmentIds` are separate VM membership identifiers. List membership
does not add native `InstanceCount`. Candidate counts are not proof that every
native object constructor or placement succeeds.

`prepareMissionBindings(catalog)` requires the same-realm genuine catalog and
preflights the complete mission through the existing interpreter. Unknown records,
flags, references, repeated consumed sections, unsupported encodings or interpreter
operations leave `authority` null. Disabled and difficulty-excluded rows remain in
that closure. One admitted binding represents one allocated source tag; shared
attachments do not create independent trigger latches. Trigger instances reverse
the source head-to-tail attached chain. Unattached triggers do not invent a global
binding.

The native startup lists and source references are factual classifications, not a
new physical event dispatcher. The existing VM uses its explicit WebRA2 tick and
poll order. Initial flag state, compound world/VM lifecycle, physical event
observations, team/effect transactions and dynamic attachment changes remain
coordinator integration work. Catalog `initialHouseListId` is specifically the
startup country-to-house list lookup; it does not certify later native owner
operands, ParentCountry routing or victory bookkeeping.

The source policy supports fresh NewINIFormat4 maps, ASCII identifiers up to24
bytes, names up to48 bytes and exact consumed section spelling. Source ID/name
lookup uses the first declaration whose ID or name matches without ASCII case;
cell references use IDs only. It retains source origins and rows rather than
silently truncating them. Empty comma tokens and per-token whitespace changes
are conservatively gated because native comma tokenization does not preserve them. Repeated exact sections, invalid coordinates and implicit
undeclared types retain unsupported diagnostics. Construction and exact-source
view limitations still apply; physical rules authentication is upstream of the
genuine world factory.

Limits bound mission bytes, source parsing, retained actors/cells/declarations,
references, chain expansion, diagnostics, additional join work and canonical output.
Factory inputs and mission bytes are owned before asynchronous preflight. Fresh
source joins, difficulty and policy are fingerprinted. Existing source compilers
also retain their own independent hard caps.

Validation uses original miniature maps in `tests/sim/mission-bindings-fixture.ts`.
The focused test covers shared references, chain order, allocation versus enablement,
country selectors, ID/name differences, source copies/mutations, limits and
once/repeat execution with every-tick restore. Private source/native results are recorded below. No original campaign acceptance
is claimed by these synthetic fixtures.

## Paired native evidence

The [range ledger](analysis/mission-bindings-native.json) contains94 bounded code,
switch/pointer and format-literal records totaling10319 bytes. The50 code spans
end on complete decoded instructions. The ledger SHA-256 is
`73e7cde4a0180b6a5e1bc69e2733b603881b163a6c6de212747aa7442ded4178`.
Private disassembly uses Capstone5.0.6 on the two full hash-verified PE images;
listings are excluded from Git.

| Evidence | RA2 entry/range | Yuri's Revenge entry/range | Interpretation |
| --- | --- | --- | --- |
| Tag sharing | `6B3D30` | `6E52A0` | First runtime instance with the requested TagType pointer is reused |
| Tag constructor | `6B3870` | `6E4DE0` | New trigger instances are prepended while following the type chain |
| Trigger constructor | `6ED220` | `725FA0` | Disabled/difficulty controls enablement without suppressing allocation |
| Tag source list/load | `6B48E0` / `6B4A90` | `6E5ED0` / `6E6080` | Source entry order, case-insensitive ID allocation, fixed row/name buffers |
| Initial lists | `65CEE7`–`65D050` | `684D47`–`684EB0` | Flags4/16/8 add the shared tag to map/scenario/first-country-house lists |
| Object tag attachment | `5D4430` | `5F5B50` | Assignment increments one reference; four placed-family callers are paired |
| Cell load/attachment | `49D2E5` / `47A460` | `4AD1B3` / `485250` | ID-only tag lookup, packed coordinate, reference count and last default cell |
| Local source capacity | `661770`–`6618AB` | `689B20`–`689C5B` | RA2 loads50 local variable slots; YR loads100 |

Source country lookup uses Name/ID in native allocation order, then the first house
with that country index. The `"<none>"` trigger owner selector chooses the first
country explicitly. This is separate from literal placed-actor owner lookup.
Unresolved countries/houses, implicit missing definitions, cycles and source
case/truncation ambiguities cannot grant executable authority.

The generic VM retains100 local slots. Source authority additionally rejects RA2
events36/37 and actions56/57 addressing slots50 or above, based on the paired local
source loader. Global/local values and campaign carryover remain outside this
component. The coordinator owns the [flag/state integration](https://github.com/lictl/WebRA2/issues/189).

## Private source comparison

The [metadata census](analysis/mission-bindings-census.json) records difficulty1
initial candidates for the selected first Allied maps. Counts below are source
binding evidence; they do not imply executed constructors or a playable mission.

| Profile | Triggers / tags | Allocated tags | Object / cell references | Scenario / map / house lists | VM diagnostics |
| --- | --- | --- | --- | --- | --- |
| RA2 | 130 / 128 | 115 | 50 / 180 | 86 / 0 / 12 | 367 |
| YR | 334 / 132 | 132 | 130 / 278 | 127 / 0 / 17 | 531 |

All811 RA2 and570 YR placed rows and all458 cell-tag rows remain represented.
The independent Python reader reconstructs source country aliases/houses, every
trigger field, native binary dispatch-table masks, source tags/chains, literal
object/cell joins, membership/reference counts and both complete catalog hashes.
It passes38034 comparisons, including complete archive-root hashes and raw member
bytes reread at their physical offsets. Both catalogs have zero identity diagnostics;
both full interpreter preflights remain closed. The census includes unsupported
opcode counts and diagnostic categories for subsequent work, without retail rows.

Private reproduction in the preserved issue187 worktree:

```sh
node --import tsx local/probe187.mjs
/Users/lucus/Projects/WebRA2/local/worktrees/theater-tiles/local/venv/bin/python local/native187/ledger.py
/Users/lucus/Projects/WebRA2/local/worktrees/theater-tiles/local/venv/bin/python local/native187/oracle.py
```

`probe187.mjs` imports the current worktree modules and reads the installation using
on-device verified source selection. Outputs stay in `local/bindings187/`; the
separate Python oracle imports no WebRA2 code. Its native dispatch tables come from
the full pinned executable images, which are read, never run. Reproduction on another
checkout requires copying the ignored scripts and keeping their relative imports
pointed at that checkout. Missing private sources are a skipped gate, never a pass.

The next integration is genuine initial flag authority plus an atomic compound
world/VM boundary. Initial physical event delivery, dynamic attachment lifetime,
spawn/recruitment effect dispatch and remaining required source operations need
separate reviewed work; this factory does not manufacture a partially executable
opening mission.

The source checkpoint passes1010 public tests and type checking, including14 new
focused source/binding tests;155 Markdown files/783 local links,537 publication
paths, the M0 metadata gate and the existing62-output/131-input browser build also
pass. This component is not yet in the browser bundle; coordinator notice and
adapter integration follow independent source review.
