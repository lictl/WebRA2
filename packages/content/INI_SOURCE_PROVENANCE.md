# INI source-view provenance

[ini-source-view.ts](src/ini-source-view.ts) and
[its fixtures](../../tests/content/ini-source-view.test.ts) are original
GPL-3.0-or-later WebRA2 code. The immutable-input guard and retained-origin checks
are extracted/adapted from the original GPL
[scenario construction component](src/scenario-construction.ts).
No native implementation, proprietary rows or third-party parser body is copied.
There is no new runtime dependency. See [licensing](../../docs/licensing.md).

The scoped native section/key case evidence is unchanged from
[CONSTRUCTION_PROVENANCE.md](CONSTRUCTION_PROVENANCE.md): it identifies both
supplied executable hashes, PE-mapped range fingerprints, the pinned YRpp primary
reference and the inspected source/data-flow paths. In particular, RA2 ReadString
`0x50E9A0` hashes section/key bytes through `0x493FC0`; YR GetSection `0x526810`
and ReadString `0x528A10` use `0x4A1DE0`. Inspected CRC byte loops do not fold case.
YR fresh-file header creation retains spelling and distinct section records. Those
observations motivated exact retained-name lookup, not a general native parser
compatibility claim.

This view deliberately does not choose exact duplicate keys/sections or CRC
collision ties. It preserves the current runtime INI compiler's comment, whitespace,
encoding and occurrence-counter policy. It cannot recover header bytes or ignored
lines that compiler did not retain. [Issue #103](https://github.com/lictl/WebRA2/issues/103)
and the [consumer inventory](../../docs/ini-source-view.md) retain those limitations.
No new native executable inspection or original-game execution is required to
extract this shared view.

Private comparisons use the same four root/member pins documented in
[construction provenance](CONSTRUCTION_PROVENANCE.md#private-source-pins).
An independent Python parser rehashes the original roots/members and compares all
retained stage/header/entry fields and origins. Metadata-only counts and projection
hashes are in [the source-view report](../../docs/ini-source-view.md#verification).
No original INI rows, strings, extracted content or native listings belong in GitHub
or public fixtures.
