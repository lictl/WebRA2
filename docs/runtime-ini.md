# Runtime INI layers and strict values

Issue [#54](https://github.com/lictl/WebRA2/issues/54), parent
[#18](https://github.com/lictl/WebRA2/issues/18). The browser-compatible
[compiler](../packages/content/src/runtime-ini.ts) composes explicit INI layers and
retains source provenance. It implements a versioned **WebRA2 policy**, not verified
RA2/YR native INI semantics or every game's rule/default. The generic
[occurrence scanner](../packages/content/src/ini.ts) is unchanged.

## API and identity

`compileRuntimeIni(profile, layers, optionalLowerLimits)` accepts `ra2` or `yr` and
at most 64 layers. Each layer has `id`, `profile`, `order`, `kind`, `sourceSha256`
and `bytes: Uint8Array`. `kind` is `base`, `expansion`, `map` or `mod`; it is metadata,
not an implicit priority. Unique nonnegative safe-integer orders establish priority,
independently of caller array/object enumeration. All layer profiles must match the
requested profile, including layers whose keys would be completely overwritten.
Every layer is checked before any is decoded. IDs/orders must be unique; IDs are
bounded ASCII manifest identifiers and hashes are lowercase SHA-256 text.

The compiler validates the supplied hash's shape; **it does not hash the bytes or
authenticate their identity**. The runtime session must verify bytes first and join
each layer ID/hash to its immutable physical source manifest. The private probe uses
the existing verified-source reader for this boundary.

The deeply frozen result has schema version 1, policy `webra2-ini-1`, explicit
profile, `nativeSemanticsVerified: false`, ordered layer metadata, sorted sections,
sorted section/key entries and diagnostics. Source bytes are not retained. Section
occurrences include layer, spelling and line. Each entry includes its selected
origin and every shadowed origin in oldest-to-newest order. Origins contain layer
ID/hash, line, original section/key spellings and scanner occurrence counters.
`rawValue` is the **exact decoded text after the first equals sign**, including
leading/trailing spaces and inline comments, excluding the line terminator.
`value` is separately normalized for this policy. No retail rows belong in public
logs; callers should project only reviewed aggregate metadata from these tables.

`lookupRuntimeIni(table, section, key)` returns the frozen entry or `undefined` in
logarithmic time. It accepts a compiler-produced table, not arbitrary deserialized
JSON. Unknown keys are ordinary retained entries. Prototype-shaped identifiers are
safe because imported identifiers are stored in Maps and sorted arrays.

`readRuntimeIni(table, section, key, spec)` returns `status: 'present'` with value and
entry, `status: 'missing'` with the requested section/key, or `status: 'invalid'`
with entry and diagnostic code. Configuration errors throw `RuntimeIniError`, even
when the requested key is absent. No default, clamping, truthiness or partial number
parse substitutes for a missing or malformed value.

```ts
const table = compileRuntimeIni('ra2', verifiedLayers);
const result = readRuntimeIni(table, 'ExampleType', 'ExampleCount', {
  type: 'integer', syntax: 'decimal', min: 0, max: 1000,
});
// The caller handles each status and applies only a separately evidenced field default.
```

The table, ordered source identities and policy revision must participate in the
coordinator's content fingerprint/save compatibility boundary. A source-selection
fingerprint alone is insufficient. There is no runtime hash algorithm or save-schema
change in this slice; the private composition digest below is a reproduction check.

## Version 1 policy

| Operation | Explicit behavior |
| --- | --- |
| Identity | Trimmed scanner section/key names; ASCII A–Z fold only. Unicode identities retain codepoints, with no locale-dependent or Unicode normalization. Enumeration sorts UTF-16 strings by section then key, not numeric key value |
| Repeated sections | Merge occurrences; emit `repeated-section` within a layer. The scanner's occurrence counters remain unchanged; its existing Unicode lowercase grouping is not the runtime ASCII identity policy |
| Duplicate keys | Later occurrence wins, retaining all prior origins; emit `duplicate-key` within a layer or `layer-override` across layers |
| Empty assignment | Retain an explicit empty value and diagnose it. It can replace a prior value; it is not deletion or absence |
| Comments | Full-line semicolon comments are ignored. For values, first semicolon ends semantic text; quotes do not escape it. Raw RHS is preserved; quoted-prefix cases produce a diagnostic |
| Whitespace/quotes | Semantic values trim ASCII space/tab only. Quotes remain literal characters; no escapes, interpolation, includes or inheritance syntax is executed |
| Section suffix | Runtime adapter accepts a valid bracketed header followed by text, diagnoses and removes that suffix before scanning; original line numbers/RHS remain intact |
| Non-entry line | A nonempty, non-header line without `=` is ignored with a diagnostic. This is not a general `//` comment rule: `//key=value` remains an ordinary key |
| Invalid syntax | Malformed headers, empty/invalid keys, unscoped assignments and semicolons inside identifiers reject with diagnostics; they cannot produce a partially usable table |

The runtime-only line adapter feeds the unchanged scanner. It addresses concrete
syntax present in both selected rules files: non-entry lines and a header with
uncommented trailing text. It does not recognize a filename or special-case a rule.
Invalid headers still fail. Diagnostics are ordered by explicit layer order, line
and code. Empty sections remain enumerable. No packed-map section is decoded here.

| Conversion specification | Accepted grammar/result |
| --- | --- |
| `{type: 'string'}` | Semantic text, including explicit empty text |
| `{type: 'boolean'}` | Whole ASCII-insensitive `yes/no`, `true/false`, or `1/0` only |
| `{type: 'integer', min, max, syntax}` | Whole signed decimal; `decimal-or-hex` additionally allows signed `$FF`, `0xFF` and `FFh`. Caller supplies safe-integer inclusive bounds. Leading zeros are decimal; negative zero becomes integer zero |
| `{type: 'rational', allowPercent}` | Whole signed decimal with optional fractional point; percentage only when explicitly permitted. Returns exact reduced `{numerator, denominator}` safe integers with positive denominator. No floating-point arithmetic, native fixed-point quantization or rounding |
| `{type: 'list', allowEmpty}` | Comma-separated items, ASCII trimmed, original order and duplicates retained. Empty whole value becomes `[]` only when allowed; empty interior/trailing items are otherwise invalid |

Numeric tokens are at most 64 characters. Exponents, fractional integers, NaN,
infinity and trailing junk are invalid. Exact rational reduction uses bounded BigInt
internally, then rejects unsafe numerator/denominator output; BigInt never enters the
result. A native reader's permissive prefix parsing is deliberately not substituted
for this typed foundation. Per-field units, enum schemas, string decoding for legacy
codepages, fixed-point rounding/defaults and list reference resolution follow later.

## Source evidence and unresolved behavior

The new compiler/tests are original **GPL-3.0-or-later**, composing the existing GPL
scanner. No source implementation body was copied and no dependency was added.
Retain [the content provenance](../packages/content/PROVENANCE.md) and
[GPL text](../LICENSES/GPL-3.0-or-later.txt). References were inspected at these exact
commits; their observations are not proof of the supplied executables' behavior.

- EA FinalSun/FinalAlert2 editor, GPL-3.0-or-later, copyright Electronic Arts,
  authored by Matthias Wagner, revision `6abf0f557469baea73079c6bf6550709e2e3584e`:
  [IniFile.cpp:113–172](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/IniFile.cpp#L113-L172)
  removes semicolon suffixes, recognizes a bracketed section despite trailing text,
  ignores lines without assignments and overwrites existing map entries.
  [LoadFile:78–85](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/IniFile.cpp#L78-L85)
  clears before loading, while InsertFile retains other entries. These editor paths
  motivate an explicit overlay seam; they do not establish native rules/map order,
  case folding, duplicate or empty semantics.
- EA C&C Remastered source, GPL-3.0 with its repository's additional terms, revision
  `f1f0d42bc2dcd06d5d1df943c6150ab34bf307ae`:
  [REDALERT/INI.CPP:214–280](https://github.com/electronicarts/CnC_Remastered_Collection/blob/f1f0d42bc2dcd06d5d1df943c6150ab34bf307ae/REDALERT/INI.CPP#L214-L280)
  accepts header suffixes and ignores non-entry/empty assignments in this **older
  Red Alert implementation**. Its [integer reader:808–832](https://github.com/electronicarts/CnC_Remastered_Collection/blob/f1f0d42bc2dcd06d5d1df943c6150ab34bf307ae/REDALERT/INI.CPP#L808-L832)
  and [boolean reader:1075–1096](https://github.com/electronicarts/CnC_Remastered_Collection/blob/f1f0d42bc2dcd06d5d1df943c6150ab34bf307ae/REDALERT/INI.CPP#L1075-L1096)
  are permissive; [Strip_Comments:1278–1288](https://github.com/electronicarts/CnC_Remastered_Collection/blob/f1f0d42bc2dcd06d5d1df943c6150ab34bf307ae/REDALERT/INI.CPP#L1278-L1288)
  uses first semicolon. The empty-value difference from the editor reinforces why
  neither implementation supplies RA2/YR native truth. No RA1 parser was adopted.
- Reviewed [native source-selection evidence](analysis/native-profile-evidence.md)
  establishes selected file candidates for this installation, including patched
  `rulesmd.ini`; it does **not** establish the in-memory INI merge policy. CSF
  duplicate-label evidence concerns another loader and is not reused here.

Under [#18](https://github.com/lictl/WebRA2/issues/18), native duplicate-key/section,
empty-value, case/CRC collision and map-versus-rules application semantics remain
unverified. A future native probe should change one harmless typed field in a
synthetic map, distinguish absent/empty/duplicate/case-alias rows across layers,
then compare actual game observations. That evidence is not essential to merge this
explicitly labeled compiler foundation; it is needed before native compatibility
claims or implicit production defaults.

## Bounds and validation

Hard compiler maxima: 64 layers, 32 MiB total input bytes, 32 Mi UTF-16 decoded-unit
upper bound, 32 MiB total scanner input bytes, 100,000 total entry occurrences,
50,000 section occurrences, 262,144 characters per raw RHS and 100,000 diagnostics.
The optional compiler limits may only lower these values. List conversion separately
caps output at 4,096 items. Overwritten values/entries count before selection.
Arrays must be dense ordinary arrays; accessor metadata, duplicate IDs/orders,
shared/resizable input buffers and unsupported byte-view subclasses are rejected.

Each original and normalized document remains under the scanner's 16 MiB byte cap,
250,000 lines and 262,144 characters per line. The conservative decoded-unit budget
is checked before decoding; normalized UTF-8 length is counted before joining and
encoding the replacement input. Decoding, line arrays, scanner entries and semantic
strings are temporary bounded allocations; this is not a streaming parser or a
claim of 32 MiB total process memory. Repeated-section tracking uses a Set to avoid
quadratic rescanning. Browser worker scheduling/cancellation is a separate integration
boundary; this compiler is synchronous and performs no I/O.

Public commands (Node 24.20.0): `npm ci`, `npm run check`, and focused
`node --import tsx --test tests/content/runtime-ini.test.ts`. Original tests cover
profile/order isolation, all shadowed text, case/prototype identifiers, immutability,
malformed syntax, line-adapter recovery, BOM/CJK preservation, exact conversions and
aggregate/occurrence/encoding amplification bounds.

Private probe on 2026-09-10: four verified members, **1,732,447 bytes**. Source pins
come from [the M0 reference profile](analysis/m0-reference-profile.json): RA2
`rules.ini` + `all01t.map`; YR selected expansion `rulesmd.ini` + `all01umd.map`.
No RA2 base file is implicitly inserted into YR. The probe checks every effective
lookup against a separate simple source-line overlay oracle and checks recognized
boolean/integer/decimal tokens through the strict converters. This does not type
every field or prove native semantics.

| Aggregate result | RA2 | YR |
| --- | ---: | ---: |
| Input bytes | 688,155 | 1,044,292 |
| Entry occurrences / effective entries | 22,059 / 21,919 | 32,364 / 32,226 |
| Effective sections | 1,349 | 1,805 |
| Keys overridden across rule/map layers | 139 | 137 |
| Duplicate-key / repeated-section diagnostics | 1 / 0 | 1 / 1 |
| Explicit empty values / empty values overriding earlier keys | 163 / 0 | 214 / 0 |
| Ignored non-entry lines / section suffixes | 6 / 1 | 5 / 1 |
| Strict boolean / integer / rational token checks | 6,361 / 5,323 / 313 | 9,514 / 8,084 / 378 |

The header adapter recovers six assignments per rules file that the unchanged
research scanner alone left unscoped. No duplicate was silently discarded from
provenance. Table JSON SHA-256 with layer IDs equal to filename, base rule order 0
and map order 1: RA2 `a5d1ab1973948f3853283d62fd5231ad65db54e2a2153b9d21c78b1a11fa18ab`;
YR `1f880be06e0c5ef7b52e4507a9a3d058d99f12e06802c425b555a35476b982c3`.

The preserved private probe is `local/probe-runtime-ini.ts` in the worker checkout,
with metadata-only output `local/runtime-ini-probe.json`. For a fresh checkout,
the following equivalent compilation reproduces the table digests without printing
retail values. Missing retail input skips this private gate; public tests remain
asset-independent.

```sh
node --import tsx --input-type=module <<'JS'
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createVerifiedSourceReader } from './tools/analysis/verified-source.ts';
import { compileRuntimeIni } from './packages/content/src/runtime-ini.ts';
const reference = JSON.parse(await readFile('docs/analysis/m0-reference-profile.json', 'utf8'));
const reader = await createVerifiedSourceReader(process.env.WEBRA2_GAME_DIRECTORY ?? 'game');
try {
  for (const p of reference.profiles) {
    const names = [p.profile === 'ra2' ? 'rules.ini' : 'rulesmd.ini', p.opening];
    const layers = [];
    for (let order = 0; order < names.length; order++) {
      const group = p.requiredDefinitionGroups.find(g => g.filename === names[order]);
      const source = group.equivalentSourceChoices[0];
      layers.push({ id: names[order], profile: p.profile, order,
        kind: order ? 'map' : 'base', sourceSha256: source.sha256,
        bytes: await reader.read(source) });
    }
    const table = compileRuntimeIni(p.profile, layers);
    console.log(JSON.stringify({ profile: p.profile, entries: table.entries.length,
      sha256: createHash('sha256').update(JSON.stringify(table)).digest('hex') }));
  }
} finally { await reader.close(); }
JS
```
