# Ordinary world death lifecycle provenance

`src/ordinary-death-rules.ts` is original GPL-3.0-or-later WebRA2 code, copyright
2026 WebRA2 contributors. The existing MIT combat/world modules compose this policy
and the GPL native numerical/random modules. Original tests contain invented actors,
weapons, corpse identifiers and terrain; no retail bytes or new external dependency
are adopted. Keep this notice, GPL text and applicable corresponding source with
distributions. The build ships this notice separately from source death preparation.

The reviewed [source death notice](../content/COMBAT_DEATH_PROVENANCE.md) records the
pinned executable identities, human sequence11/12 decision, terminal corpse vectors
and occupancy removal chain. The [native random notice](NATIVE_RANDOM_PROVENANCE.md)
records the licensed implementation used for each word. The runtime takes one
unsigned word modulo a strictly positive complete corpse vector; even count1 draws.
It does not mask the word, use reload jitter or retry corpse selection.

| Pinned profile | Reviewed complete terminal range, SHA-256 | Selected arithmetic observations |
| --- | --- | --- |
| RA2 | `0x5078B0..0x507B55`, `ad1f95523b19845f5358f8046742e4f07d5edbb86fa7c85548fa54fab7da1144` | Type path zeroes EDX at0x507986 before unsigned DIV at0x507997; global path calls Random0x638840 at0x5079D3, clears EDX at0x5079DE and divides at0x5079E7 |
| YR | `0x520AE0..0x520EFC`, `78bf804948710b14c7e8271066f90cb514ea12f0be79a6a01de196a20dedad15` | Type path clears EDX at0x520C1C before DIV0x520C2D; global path calls Random0x65C780 at0x520C6B, clears EDX0x520C76 and divides at0x520C7C |

The source review found no sign conversion or mask between each word and division.
Empty vectors remain unsupported. These are static instruction facts, not measured
original-game animation timing. Private binaries and disassembly remain in `local/`.

[The runtime contract](../../docs/ordinary-death.md) distinguishes native facts from
explicit WebRA2 cadence and ordering. Sequence durations, ground-cell anchoring,
completion before shots, persistent records, attribution events, save validation and
work limits are WebRA2 implementation choices. This engine factory accepts explicit
already-interpreted rules: it does not grant native attack/death permission, prove
animation effect closure, or authorize browser attacks. Those joins remain the
source adapter's responsibility under issues132/147. No new private source census is
claimed; the source165 evidence and reviewed RNG are reused.
