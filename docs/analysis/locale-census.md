# CSF structure and locale evidence

Issue [#16](https://github.com/lictl/WebRA2/issues/16); date 2026-09-09.
The owner identifies the supplied Steam installation as Traditional Chinese. That
installation-specific provenance belongs here, not in the generic census function.
The scan below independently establishes byte structure and character-class counts.

| Candidate | Physical source | Version / raw language field | Labels / strings | Han code units | Case-folded duplicate labels |
| --- | --- | --- | --- | ---: | ---: |
| `ra2.csf` | `language.mix/#5:7f6fbcdf` | 3 / 9 | 4,479 / 4,479 | 43,321 | 3 |
| `ra2md.csf` | `langmd.mix/#2:bd835079` | 3 / 9 | 5,211 / 5,211 | 52,219 | 0 |

The authoritative source paths, root/archive/member SHA-256 values, lengths,
offsets and counts are in [the metadata snapshot](campaign-census.json) under
`locales`. Both candidates contain 1,204 records with an extra byte string and
no malformed surrogate sequences under the scanner. No translated value, label
name or extra-string payload is published. The original RA2 table's duplicate
label occurrences are retained as a count; no replacement winner is chosen.

The [bounded CSF census](../../packages/content/src/csf.ts) checks the version-3
header, counted label records, complemented little-endian 16-bit strings, optional
extra byte strings, exact declared counts and final length. It supports empty or
single-value labels and rejects multiple-value labels rather than guessing their
semantics. Maximums: 16 MiB input, 100,000 labels/strings, 512 bytes per label,
4,000,000 decoded code units and 4,096 bytes per extra string. Synthetic tests
cover all truncation boundaries of an original fixture, count/length errors,
duplicate labels, CJK counts and explicit unsupported variants. Source adaptation
and license details are in [PROVENANCE.md](../../packages/content/PROVENANCE.md).

Han counts cover the BMP unified ideograph, Extension A and compatibility ranges.
They do not distinguish Traditional from Simplified Chinese; many characters are
shared. The raw header field at byte offset 20 is recorded as `languageId` without
assuming that it selects runtime language behavior. No other CSF signature was
identified by this bounded scan, but it is not proof that no undiscovered package
or alternative string format exists.

Two tables are not two languages. `verifiedPlayableLocale` remains `null` for both:
fonts, voices, cinematics/subtitles, fallback, profile/language mount order and
actual in-game rendering still need evidence. Duplicate-label behavior and full
playable-language requirements continue in
[#18](https://github.com/lictl/WebRA2/issues/18). No owner observation is required
to complete this metadata slice.
