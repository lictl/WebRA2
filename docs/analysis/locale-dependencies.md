# Installed locale dependencies and font coverage

Issue [#33](https://github.com/lictl/WebRA2/issues/33), under
[#18](https://github.com/lictl/WebRA2/issues/18). The supplied installation has one
observed language-pack candidate spanning RA2 and YR: the owner identifies it as
Steam Traditional Chinese. The two CSFs are game/expansion tables, not two languages.
Their raw language ID is 9, matching the Chinese enum in pinned
[YRpp StringTable.h](https://github.com/Phobos-developers/YRpp/blob/9402d7da0fe14d46703ba871ce3e6b3cde855bfc/StringTable.h).
Han character counts alone do not distinguish Traditional and Simplified Chinese.

The earlier bounded census found only these two CSF signatures among inspected
members. Manuals and FinalAlert editor translations do not establish more playable
language packs. Unknown members and unrecognized formats remain outside that claim.
The launch locale target is this observed Traditional Chinese candidate; actual
voices, subtitles, UI layout and campaign behavior still need release validation.

## Verified string and font sources

[The source manifest](locale-font-sources.json) joins the native `GAME.FNT` filename
literal to CRC32 member candidate `b1d57ac2` in `ra2.mix/#3:a8548fd9` (local.mix),
ordinal 143. The literal occurs at file offset 3,994,944 in pinned `game.exe` and
4,295,576 in pinned `gamemd.exe`; the executable hashes accompany those locators.
This is a filename/hash candidate with a structurally valid `fonT` body, not a
recovered filename database. No loose GAME.FNT or additional same-ID candidate was
found in the supplied installation's prior member census and local-file check.

The verified CLI rechecks each full root hash and member range/hash. It read
**three members / 2,200,536 bytes**. [The resulting snapshot](locale-dependencies.json)
contains exact identities, counts, duplicate ordinals and character-coverage facts;
it publishes no labels, translated values, glyph pixels or extra-string bytes.

| Candidate | Root / absolute offset / size | Member SHA-256 |
| --- | --- | --- |
| GAME.FNT | ra2.mix / 120161760 / 1584195 | ec8d6d85db3eedf5a862cc6ffb87bfad4c77279dd946bc2d30879ad9140c8d3f |
| ra2.csf | language.mix / 37456852 / 283368 | 60e1238de020831e53465b703f19cb984f33eabbc6d3b6773e4c4efbad3c634b |
| ra2md.csf | langmd.mix / 39346 / 332973 | 1b90bb0756137f46ff529af043fe798d7f1f9fa1713a4110f17e1d674de81f1c |

The font has 29,655 glyph records and 34,112 mapped BMP codepoints. Its six header
fields are ideograph width 20, stride 3 bytes, symbol height 16, font height 17,
record count 29,655 and record size 49 bytes. Records contain a width byte followed
by 48 bitmap bytes. The 65,536-entry little-endian map is **one-based**; zero is
unmapped. No map entry exceeds the record count. Maximum stored glyph width is 16.

| Table | Labels | Unique Unicode codepoints | Non-control codepoints mapped | Missing non-controls | Case-folded duplicates |
| --- | ---: | ---: | ---: | ---: | ---: |
| RA2 | 4,479 | 1,877 | 1,876 | 0 | 3 |
| YR | 5,211 | 1,978 | 1,977 | 0 | 0 |

Both requested sets include LF, handled separately as a layout control. ASCII space
and U+3000 have blank bitmap content; U+3000's stored width is zero. Mapping presence
does not prove native advance, wrapping, fallback or readable layout. The parser
therefore exposes blank and zero-width coverage instead of treating all mapped
characters as visible glyphs. RA2's three duplicated labels have differing text;
the report retains first/duplicate ordinals and selects no value. Both tables have
1,204 extra-string records, whose interpretation is not inferred from their count.

A separate private Python probe independently read the font member, checked its
SHA-256 and produced a contact sheet using an original diagnostic phrase with
Traditional Chinese characters, Latin text and full-width punctuation. Visual
inspection showed recognizable glyphs with the expected MSB-first bitmap order.
The image stays in ignored `local/`; its SHA-256 is
`aeff56ac9be6216fedf75bbb7815babc0d677eea3b518dba5f4a3b9fd415182d`.
This probe used explicit diagnostic spacing and is not a native layout comparison
or a browser rendering claim. The separate [browser probe](browser-feasibility.md)
records synthetic CJK text rendered with browser fonts.

## Other locale resources and import consequences

The [physical census](mix-census.json) locates these companion resources. Their
archive/member structure was verified by the earlier census; the three-member
font report does not reread their payloads or establish the language of speech.

| Container | Observed companions | Consequence |
| --- | --- | --- |
| language.mix | nested audio.mix, cameo.mix, GRFXTXT.SHP; two Bink-signature members with IDs c1e6e166 / 33665128 | Keep the language archive for localized audio/UI/media candidates, in addition to ra2.csf. |
| langmd.mix | nested audiomd.mix, cameomd.mix, KEYBOARDMD.INI, GLSLMD.SHP, GLSMD.PAL; Bink-signature members 33665128 / 48113c24 | Keep the expansion language archive for its corresponding candidates. |
| ra2.mix / local.mix | GAME.FNT plus four older FoNt-signature members | The shared Unicode font is needed by the observed string sets. Older font formats remain separate decoder work. |

The private header probe identified the first three listed Bink members as
431-frame, 15-fps, zero-audio-stream resources (472×450 or 632×570), and langmd's
48113c24 as 800×600, 190 frames, 15 fps, one audio stream. These are header facts,
not verified cinematic names, subtitle tracks or speech-language identification.
The [media feasibility report](media-feasibility.md) establishes the decoder path;
campaign voice/media completeness remains a release gate.

For the supplied installation, the locale portion of an import manifest must
preserve `language.mix`, `langmd.mix` and the shared font in `ra2.mix`, or equivalent
user-supplied members with provenance. Do not select locale variants from manual
filenames, system locale or the presence of a CJK system font. Keep RA2 and YR
string namespaces explicit. The observed font/CSF set is sufficient to begin the
Traditional Chinese import UI and missing-character diagnostics. It does not make
all playable-locale compatibility rows VERIFIED.

## Bounds, validation and next comparison

[The scanner](../../packages/content/src/locale-font.ts) composes the validated CSF
grammar and rejects malformed UTF-16. Font limits are 16 MiB, 65,535 symbols,
32-byte row stride, 256-pixel height and 65,536 requested codepoints. It validates
all map entries and widths, exact file length, one-based indexing and bit order.
Older `FoNt`, missing maps and unexplained tails fail explicitly. Glyph-ink results
are cached by symbol so shared mappings cannot amplify a bitmap scan quadratically.

[The CLI](../../tools/analysis/locale-dependencies.ts) accepts up to 32 CSFs and
eight font candidates with a 64 MiB combined member budget. Both input manifests
are capped before allocation by the shared 4 MiB manifest reader. It copies validated
metadata before I/O, retains font alternatives by profile, rejects duplicate physical
identities and verifies roots/members through the bounded reader. Missing font evidence
cannot yield a playable-locale claim. Seven original synthetic tests cover malformed
records, surrogate pairs, one-based coverage, blank/zero-width/control distinctions,
conflicting font variants, source mutation, unsafe input and metadata privacy.

```sh
npm ci
node --import tsx --test tests/content/locale-*.test.ts
node --import tsx tools/analysis/locale-dependencies.ts /absolute/path/to/game docs/analysis/campaign-census.json docs/analysis/locale-font-sources.json > local/locale-dependencies.json
cmp local/locale-dependencies.json docs/analysis/locale-dependencies.json
npm run check
git diff --check
```

Missing retail files skip the private check; they do not pass it. Repeated private
output matched the committed snapshot exactly. An independent byte-level Python
probe verified source hashes, Unicode map coverage and the three differing duplicates.
[Locale provenance](../../packages/content/LOCALE_PROVENANCE.md) pins the MIT font
reference and preserves its notice alongside the existing GPL CSF adaptation.

Later original-game comparison should capture menu/mission text, long-line wrapping,
full-width spacing, missing-label fallback, a duplicated RA2 label and a voiced
briefing on this exact installation. Keep original screenshots, recordings and saves
private. These observations are not needed before the M0 evidence can guide the
first importer; no new product decision is required from the owner.
