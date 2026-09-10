# Team runtime provenance

The new team runtime and original fixtures are GPL-3.0-or-later. Existing world
simulation helpers retain their separate MIT notices. This component interprets
numeric mission scripts from user-supplied sources; it contains no retail rows,
assets or native listings. No bundled native program was executed.

Primary interface reference:
[YRpp at 61d0887](https://github.com/Phobos-developers/YRpp/tree/61d0887eb6040cfb36af16d592e9770ceae4dfb2),
particularly [TeamClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TeamClass.h),
[ScriptClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/ScriptClass.h),
[TeamTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TeamTypeClass.h)
and [RulesClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/RulesClass.h).
Headers locate fields and entry points; inspected native paths establish the scoped
control observations. The prior [typed-team evidence](../content/TEAM_DEFINITIONS_PROVENANCE.md)
separately covers source loading, declarations, references and operand decoding.

Native images are RA2 game.exe SHA-256
`73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`
and YR gamemd.exe SHA-256
`3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.
The local probe rehashes the complete image before reading mapped PE ranges. Raw
listings and exploratory facts stay in ignored `local/native152/` in the team-runtime
worktree. A final complete-instruction range ledger accompanies implementation.

The dispatch tables at RA2 `6B8768` / YR `6E9F74` select opcode 3's waypoint handler,
5's timer/guard branch and 6's cursor assignment. The move handlers at RA2 `6BAE60`
and YR `6EC7D0` resolve a scenario waypoint on entry, update team focus, consider a
candidate replacement cell, and run common member movement. Completion is set by
RA2 `6BA1A0` / YR `6EBAD0` only after member/context checks. It is not simply a
count of actors occupying a waypoint cell. Native Stray/RelaxedStray, regroup,
height, destination and aircraft paths are outside the current world policy.

The guard branch invokes RA2 `6B9F40` / YR `6EB870` before checking elapsed duration.
That member routine issues native mission/destination operations repeatedly; the
runtime must not replace it with an otherwise inert wait. Guard remains unsupported
until its acquisition dependencies are implemented. Jump stores argument minus two
and marks the step complete; the next enabled update increments the cursor before
reading the next action. The controller's one-update cadence is a WebRA2 scheduling
choice, not a claim about native global phase order.

Explicit existing-actor bindings bypass neither unsupported script instructions
nor source/reference checks. They do not claim native recruitment, assembly,
member-removal side effects or full mission admission. RNG neutrality, native
locomotor timing and campaign behavior remain unverified. [Focused report](../../docs/team-runtime.md).
