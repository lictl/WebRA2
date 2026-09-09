# Runtime CSF string decoding

The bounded [decoder](../packages/content/src/csf-decode.ts) implements version-3
standard and extra-string CSF records using the existing XCC-derived framing policy
in [content provenance](../packages/content/PROVENANCE.md). It snapshots at most
16 MiB input before the established census validator checks tags/counts/ranges.
Decoding consumes only those validated private bytes; maximum decoded content remains
four million UTF-16 code units. No new dependency or source reference is introduced.

`decodeCsf(bytes)` returns frozen records with original ordinals, ASCII labels,
Unicode text and optional byte-preserving extra strings. It rejects unpaired UTF-16
surrogates. The extra value is preserved without guessing an encoding or filename
meaning. An empty label record has null text; a present zero-length string is distinct.
The census API/output remains unchanged and never includes translated values.

Case-insensitive ASCII `resolve(label)` returns missing, empty, resolved or ambiguous.
Equivalent duplicates retain every ordinal; differing text or extras produce ambiguity
and no selected value. This is an explicit WebRA2 diagnostic policy. Native sorting
and midpoint lookup can select among differing duplicates, but its exact winner has
not been established for the observed installation; see [locale evidence](analysis/locale-dependencies.md).
A runtime consumer must handle the diagnostic, not silently replace it with first/last
record selection or claim full native localization compatibility.

Public tests use only original synthetic strings and cover Unicode/extra records,
duplicate/empty lookup, mutation isolation and malformed/oversized/truncated input.
Retail strings stay within on-device runtime memory or ignored private evidence;
never serialize the catalog into a published research report, fixture or app bundle.
Font layout, CSF-source selection, subtitle/voice behavior and original comparisons
remain separate implementation gates in [#18](https://github.com/lictl/WebRA2/issues/18).

Private supplied-install check: both pinned CSF members were read through the verified
source reader. YR produced 5,211 records / 5,211 unique resolved labels. RA2 produced
4,479 records / 4,476 unique labels: 4,473 resolved and three explicitly ambiguous.
This agrees with the earlier duplicate census. Only counts and source hashes were
recorded; decoded labels/values were not emitted. This is parsing evidence, not a
native-rendered text or playable-locale comparison.
