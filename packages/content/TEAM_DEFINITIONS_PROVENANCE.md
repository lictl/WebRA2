# Team definition compiler provenance

`src/team-definitions.ts`, `src/team-values.ts` and their original synthetic tests
are GPL-3.0-or-later. They implement bounded typed data compilation informed by
static analysis of the owner's pinned executables and primary interface references.
No native program was executed. Original INI records and disassembly remain private.

Primary reference: [YRpp at 61d0887](https://github.com/Phobos-developers/YRpp/tree/61d0887eb6040cfb36af16d592e9770ceae4dfb2),
particularly [TeamTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TeamTypeClass.h),
[TaskForceClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TaskForceClass.h),
[ScriptTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/ScriptTypeClass.h)
and [ScriptClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/ScriptClass.h).
These provide interface/layout/address clues, not execution evidence. Native loader,
constructor and dispatch paths in both images are checked independently. The
construction/exact-source components retain their existing separate provenance.

The bounded research uses RA2 game.exe SHA-256
`73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`
and YR gamemd.exe SHA-256
`3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.
An offset/size/range-hash ledger and independent raw-source comparison will accompany
PR readiness. The current committed checkpoint establishes the implementation and
original synthetic tests; it does not represent completed retail validation.

[Report and limits](../../docs/team-definitions.md). Native stage/default evidence
is deliberately separate from the unimplemented runtime behaviors. External allocation
paths, native parser duplicate ties, global AI overlays, inherited country fields,
truncated identifiers, unknown script semantics and malformed native scanf results
remain outside this component's supported execution capability.
