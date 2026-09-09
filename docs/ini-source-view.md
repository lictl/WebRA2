# Retained INI source view

[Issue #103](https://github.com/lictl/WebRA2/issues/103) tracks exact-case native
INI consumers. The [source view](../packages/content/src/ini-source-view.ts)
provides ordered, immutable source occurrences without changing
[webra2-ini-1](runtime-ini.md) or selecting an effective native property table.
It is the first shared step in that migration. The component and original fixtures
are GPL-3.0-or-later; see [provenance](../packages/content/INI_SOURCE_PROVENANCE.md).

## API and scope

`createIniSourceView(table: RuntimeIni, lowerLimits?)` consumes a frozen table and
returns `IniSourceView` with these explicit boundaries:

| Field | Meaning |
| --- | --- |
| `policy` / `schemaVersion` | `webra2-ini-source-view-1` / 1 |
| `profile` | Same RA2 or YR profile as every input layer |
| `inputPolicy` / `valuePolicy` | Both remain `webra2-ini-1` |
| `sourceScope` | `retained-runtime-ini-origins` |
| `nativeParserVerified` | Always false |
| `stages` | Explicit layer order, full layer pin and source-line ordered section occurrences |
| `diagnostics` | Unchanged frozen input normalization/duplicate diagnostics |

A stage contains `layer` and `sections`. Every section has its retained exact
`name`, one-based `line`, inherited `occurrence` counter and source-line ordered
`entries`. Every entry has retained exact `key`, semantic `value` and full
`IniOrigin`, including the exact decoded `rawValue` RHS. All selected and shadowed
origins appear exactly once in their original section occurrence. Empty sections
and entries, same-case repeats and differently cased names remain distinct.
No default, merge, case alias, native duplicate winner or inheritance is applied.

“Exact” means exact **retained spelling**. The upstream compiler already normalizes
header/key whitespace, ignores some lines/suffixes and strips comments for semantic
values. It does not retain the full original header/line bytes. Those lost bytes
cannot be recovered by this view. Occurrence counters also retain the scanner's
case-folded counting policy; they are not native section indices or per-exact-name
ordinals. Use the layer pin and line to identify source locations. Original byte
verification and physical-source joins belong to the caller.

The view is not a JSON loader, a native parser or an authentication boundary.
Construction validates immutable plain records, layer/source joins and source-line
ownership, but cannot verify a claimed hash without the caller's original bytes.

## Lookup and ambiguity

`findIniSourceSections(view, layerId, exactName)` returns every matching section
occurrence in that layer. `findIniSourceEntries(section, exactKey)` returns every
matching entry in one exact section occurrence. Both return frozen indexed arrays;
repeated calls reuse those arrays. Empty matches are frozen empty arrays. An
unknown layer is an identity error, rather than a missing section.

`uniqueIniSourceSection` and `uniqueIniSourceEntry` expose three explicit states:

- `{ status: 'missing' }`
- `{ status: 'unique', value }`
- `{ status: 'ambiguous', values }`

Consumers must handle ambiguity. These helpers never pick first/last entries and
never combine repeated section bodies. No API infers cross-stage effective values;
a caller must choose the exact source stage and implement its own evidenced native
loading policy. Type-ID case folding belongs to type construction, independently
of exact section/key lookup.

Private WeakMap indices brand factory-produced views and sections in the current
realm/module instance. No mutable Map or callback is exposed in the frozen result.
Structured clones, JSON copies and lookalike objects cannot call indexed helpers;
rebuild a view from the owned, validated frozen RuntimeIni table in the receiving
worker. Serialized view data can be inspected, but is not a serialized lookup
handle. This brand is a lifecycle/bounds check, not proof of source authenticity.

## Resource and integrity checks

Limits may only decrease. Defaults: 64 stages, 262,144 combined section/entry
occurrences, 2,000,000 visited graph values/properties, 64 Mi UTF-16 units of
keys/text, depth 32 and 4,194,304 charged construction work units. Occurrence counts
include every shadowed entry before output expansion. Each occurrence receives at
most one section- or key-index array reference; lookup does not expand candidate
cross-products or allocate copies of matching arrays. Layer/name/key query lengths
are bounded at 256/255/512 units.

Input graph inspection precedes source indexing. It rejects mutable records,
accessors without invoking them, exotic/sparse arrays, symbols, cycles, invalid
numbers and excess graph/text depth or size. Semantic checks require exact record
shapes, one profile, strictly increasing unique layer orders/IDs, valid hashes,
unique source lines, valid inherited counters and chronological shadow history.
Every entry must belong to the **last preceding header across all names**, with
matching retained spelling and occurrence. An entry cannot claim an earlier
same-name section after another header has begun. Same exact section/key repeats
remain valid source observations; only their ambiguous selection is withheld.

Failed construction publishes no view or partial lookup handle. Errors are
`IniSourceViewError` with stable `ini-source-*` codes. Native CRC collisions,
fresh-file versus populated-INI duplicate winners, byte encodings beyond the
upstream decoder and pre-normalization text remain outside this policy.

## Consumer migration inventory

This inventory distinguishes a source-view adoption from a gameplay semantics
change. #103 stays open until deliberate consumer migrations and native parser
limitations have been addressed.

| Consumer | Current role and migration |
| --- | --- |
| [scenario-construction.ts](../packages/content/src/scenario-construction.ts) | **Adopted.** Shared view replaces private reconstruction only. Stage allocation, exact native names, ambiguity rejection and output schema/policy remain unchanged. Header-ownership validation now rejects malformed frozen metadata. |
| `object-art.ts`, [#100](https://github.com/lictl/WebRA2/issues/100) | Coordinator-owned work. Adopt first-allocated type spelling and staged construction fields, then exact art section/key lookup. Do not retain final folded-rule lookup as a native property model. |
| [scenario-objects.ts](../packages/content/src/scenario-objects.ts) | Planned. Exact Basic/Map/placement declarations and named house/team references need a focused migration, source-backed spellings and policy/version changes. Construction currently guards its placement boundary independently. |
| [scenario-logic.ts](../packages/content/src/scenario-logic.ts) | Planned. Trigger/event/action/tag/team/task-force/script section and field lookup must distinguish exact native source names from canonical runtime IDs. Numeric ordering/opcode framing remain separate policies. |
| [scenario-terrain.ts](../packages/content/src/scenario-terrain.ts) | Planned. Exact Basic/Map/pack section/key selection and repeat handling; pack decoding/geometry are independent. |
| [theater-tiles.ts](../packages/content/src/theater-tiles.ts) | Planned. Exact General/TileSet field lookup before native tile-range mapping; preserve its separately reviewed numeric/sentinel rules. |
| [profile-content.ts](../packages/content/src/profile-content.ts) | Planned with coordinator ownership. Expose views beside current rules/mission/art/AI/battle/mapsel/briefing/sound tables; include adopted view/consumer policies in content/save identities. Existing tables are not silently replaced. |
| [scenario-bindings.ts](../packages/content/src/scenario-bindings.ts) | Retained as explicitly structural preview. Native stats should use constructed identities/source stages rather than reinterpret this preview as native allocation. |
| [native-profile.ts](../packages/content/src/native-profile.ts), M0 graph/census tools | Research claim audit remains; historical candidate metadata must not be silently reclassified by a bulk runtime-policy replacement. |

No artwork, profile-content, shared identity, opcode, terrain or original-runtime
behavior migration is bundled with the view extraction. Those changes need focused
synthetic cases, updated policy/fingerprint provenance and independent review.

## Verification

Original view fixtures exercise both profiles, stage/line order, mixed-case names,
repeated and empty sections/entries, all shadowed origins, Unicode retained text,
lookup ambiguity/brands, hostile property names, source-header ownership, malformed
pins/history/counters, non-invoked getters and lower resource limits. Existing
construction tests continue unchanged; an additional regression covers an origin
moved below a different source header.

```sh
npm ci
node --import tsx --test tests/content/ini-source-view.test.ts tests/content/scenario-construction.test.ts
npm run check
git diff --check
```

Private scripts remain ignored in `local/worktrees/ini-source-view/local/`:

```sh
node --import tsx local/probe.ts > local/probe.log
python3 local/view-oracle.py
python3 local/oracle.py
```

The independent Python view oracle rereads and hashes the pinned original roots
and members, parses raw INI source order and compares **every** stage pin, section
occurrence, field value and complete origin against the TypeScript view. It also
checks that diagnostics are preserved from the existing compiler; it does not
independently certify that compiler's normalization policy. Neither oracle executes
the game. Public CI uses original fixtures only.

| Opening rules + map | Section occurrences | Entry occurrences | Canonical stage-projection SHA-256 |
| --- | ---: | ---: | --- |
| RA2 | 1,400 | 22,059 | `2854cf0e9d91c1773ad2f5e1d49b2945918c782bc005aa05c84ff327657c106c` |
| YR | 1,848 | 32,364 | `7296228024cd27f8d68cf4d9f041ec1a1ac7b0f61d590e7ed2dd2f3c7130b2dd` |

Stage projection uses Python JSON with sorted object keys, compact separators and
ASCII escaping. Both complete comparisons pass. Independently checked construction
projections retain their reviewed hashes:
RA2 `60dbc4dffda5cadc0563565b26db73a516aa249efb68f849c4016bd4ffa2ebf9`;
YR `352e653780ae1d26926255948bdd9ba721db7d227cff5871965d12629b1056d0`.
This validates the extraction's bounded output, not original campaign playability.
