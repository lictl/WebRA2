# M0-02 bounded campaign and opcode census

Issue [#16](https://github.com/lictl/WebRA2/issues/16); date 2026-09-09.
This is a physical content census, not a campaign implementation or a selected
effective content profile. Follow-up [#18](https://github.com/lictl/WebRA2/issues/18)
owns precedence, progression, required manifests and playable-locale evidence.

## Observed result

[The reproducible metadata snapshot](campaign-census.json) verifies source hashes
and re-parses MIX indexes against [the physical manifest](mix-census.json) before
reading bounded members. It finds 384 physical map records with `[Basic]` and
`[Map]`, which deduplicate to **368 exact byte hashes**. The detailed ledger keeps
45 faction/training/campaign-container candidates; 323 other map hashes are counted
without publishing their full census. No map/rule/string payload is emitted.

The battle definition tables reference 24 RA2 faction mission filenames and 14 YR
faction mission filenames. Every referenced Scenario filename, including training
and demo candidates, matches a decoded map candidate in this corpus. Definition
presence, `Battles` membership and `DebugOnly` tokens are recorded separately; these
are not proof of which choices the original UI exposes or how progression works.

| Definition profile candidate | Faction filenames | Distinct hashes including variants | Event IDs | Action IDs | Script IDs |
| --- | ---: | ---: | ---: | ---: | ---: |
| RA2 | 24 (12 Allied, 12 Soviet) | 24 | 40 | 67 | 33 |
| YR | 14 (7 Allied, 7 Soviet) | 15 | 37 | 78 | 33 |

IDs are unions of structurally framed occurrences, with all candidate variants
retained. They have **no recovered runtime meanings** in this slice. Missing
referenced filenames and empty profiles force `framingComplete` false; separate
`parsedCandidatesFramingComplete` describes only the parsed members. True here
means framing/reference coverage of these candidate tables, not campaign readiness.

There are no INI or opcode-framing diagnostics in the detailed retail candidates,
no decode failures and no uninspected named text candidates after name resolution.
The scanner examined 13,744 member/loose-file prefixes and parsed 527 candidates
(78,001,784 bytes). It deliberately skipped 25 oversized non-text candidates and
13,217 prefixes that did not match the discovery heuristic. Unknown names can still
hide text outside the bounded prefix or size policy. No ambiguous distinct-name
hash match was found in the candidate set used for this run; collisions remain
possible with additional names.

## Opening mission evidence

These identities are suitable inputs for the next dependency investigation. They
are not a promise that all required graphics/media/rules are resolved or playable.
The snapshot contains complete root/archive/member hashes and absolute offsets.

| Filename candidate | Physical identity | Trigger rows | Distinct event/action/script IDs |
| --- | --- | ---: | --- |
| `all01t.map` | `MAPS01.MIX/#9:d937f5b1`; identical copy in `MAPS02.MIX/#8:d937f5b1` | 130 | 14 / 32 / 14 |
| `sov01t.map` | `MAPS01.MIX/#2:907af1f2`; identical copy in `MAPS02.MIX/#1:907af1f2` | 132 | 14 / 31 / 14 |
| `all01umd.map` | `mapsmd03.mix/#11:3a6f0ac2` | 334 | 19 / 52 / 19 |
| `sov01umd.map` | `mapsmd03.mix/#12:73220e81` | 302 | 17 / 49 / 16 |

`all01t.map` hashes to
`ad64c9293a8bccb85c38f5871a974ed9c09b8b5da11bb346e990423bf625c79c`;
`all01umd.map` hashes to
`dee38769f2247a85908705486c175ef14a4cf90437899defe7c8b4c0d1c51fb0`.
Both contain `Basic/NextScenario` references to `gdi2a.map` and `AltNextScenario`
references to `gdi9c.map`. These observed values cannot be assumed to describe the
RA2/YR campaign progression path. The actual controlling mechanism needs evidence.

## Variants, rule overlap and unresolved identities

- `all02umd.map` has two distinct hashes in `mapsmd03.mix` and `expandmd01.mix`.
  The latter is 465,788 bytes; the former is 465,825. Both are retained with
  `effectiveWinner: null`. A filename match and a later-looking archive name do
  not prove patch precedence or the significance of the difference.
- `rulesmd.ini` differs between `ra2md.mix/#14:fbe0d09d/#4:8218f9f4` and
  `expandmd01.mix/#0:8218f9f4`. The definitions ledger records both SHA-256 values;
  no merged ruleset or exact Steam patch version is selected.
- Map sections overlap candidate rules sections and contain different same-key
  literal values. For example, `all01t.map` has differing values under `AMRADR`,
  `ATESLA` and other rules sections. `ruleComparisons` publishes only section names
  and counts, including every duplicate occurrence. These are differences against
  candidate rule files, not proof of effective override semantics or gameplay effect.
- `sov09t.map` is a named faction-map candidate absent from the observed battle
  Scenario references. Keep it distinct from `sov09u.map`; do not add it to the
  ordinary Soviet progression merely to account for a map count.
- `MAPS02.MIX/#6:b7ce3f39` is a decoded map with 45 trigger rows and unresolved
  filename. It remains a separate hash in the detailed ledger. Demo/training
  candidates `e31.map`, `e32.map`, `trn01t.map`, and `trn02t.map` are identified
  separately from the 38 faction filenames.

All these interpretation gaps continue in [#18](https://github.com/lictl/WebRA2/issues/18).
Original opcode behavior, AI scheduling, native saves and required asset dependency
closure remain outside this slice. [Locale observations](locale-census.md) are
similarly distinct from a verified playable language pack.

## Scanner boundaries and reproduction

The [INI scanner](../../packages/content/src/ini.ts) uses a byte-preserving
ASCII-compatible representation unless a UTF-8/UTF-16LE BOM selects an explicit
decoder. It retains repeated sections/keys and source line/occurrence identity;
it does not choose duplicate-key or mount precedence. Full-line semicolon comments
are ignored. Raw values retain inline comments; numeric/reference consumers remove
semicolon suffixes under a documented census subset. This is not a production INI
parser, legacy text decoder or rule compiler.

[Opcode framing](../../packages/content/src/mission-census.ts) follows the pinned
editor observations: counted Events records use three tokens, or four when their
discriminator is 2; Actions records use eight; numbered script steps use a type and
parameter. Malformed counted rows contribute no partial opcode list. Missing,
duplicate or gapped script steps receive explicit diagnostics. Parameter meanings,
sentinels and original evaluation order are not interpreted.

Limits: 16 MiB per candidate, 128 MiB total candidate bytes, 2,048 text candidates,
4 KiB discovery prefixes, 512 archives and 250,000 member records. INI limits are
250,000 lines, 200,000 entries and 262,144 characters per line; opcode rows allow
at most 4,096 records/32,769 tokens. Unnamed UTF-16 or late-prefix text may be missed;
newly resolved but uninspected names are reported, not silently counted as covered.
Known CSF/map candidates with incompatible magic/structure are diagnosed, while
retaining the caveat that hash candidates can be wrong. Loose files are scanned as
physical candidates without granting them automatic override priority.

After using Node 24.20.0 and the locked dependencies, from repository root:

```sh
node tools/run-tests.mjs tests/content
node --import tsx tools/analysis/campaign-census.ts game docs/analysis/mix-census.json > local/campaign-census.json
npm run check
git diff --check
```

Create ignored `local/` before redirecting output. Compare parsed JSON with the
committed metadata snapshot; source changes deliberately reject a stale physical
manifest. The CLI exits unsuccessfully for decode failures or reached named-text
limits; a successful metadata scan is not an engine/campaign acceptance result.

Thirteen original tests cover occurrence preservation, BOM/byte handling, resource
caps, variable event/action/script framing, CSF truncations/counts/CJK/duplicates,
nested source identities, deterministic dedup/variants, stale sources/path escapes,
late filename recognition, missing scenarios, wrong known formats and payload
omission. Strict types pass. The private corpus scan and a separate rerun match the
snapshot; no original executable, mission simulation or browser game was run.
GPL composition and exact source references are in
[content provenance](../../packages/content/PROVENANCE.md).
