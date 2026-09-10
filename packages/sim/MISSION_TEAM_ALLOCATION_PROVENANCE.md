# Mission team allocation source provenance

SPDX-License-Identifier: GPL-3.0-or-later

The original TypeScript source and original synthetic tests in
`src/mission-team-allocation-source.ts` and
`../../tests/sim/mission-team-allocation-source.test.ts` are distributed under
GPL-3.0-or-later. They compose the existing GPL team/source adapters and reuse the
original GPL retained-origin view and numeric/hash helpers. This is not a claim
that the proprietary reference programs or the YRpp layout headers are GPL.

[Issue213](https://github.com/lictl/WebRA2/issues/213) adds a separate source proof;
it does not change the previous source policy or run a native AI scheduler.
[The report](../../docs/mission-team-allocation-source.md) describes the public API,
trust boundary and remaining work. Distribute this notice, the applicable GPL
license and corresponding source/build instructions when distributing the module.
The coordinator owns application notice packaging before browser integration.

The [paired native ledger](../../docs/analysis/mission-team-allocation-native.json)
pins both complete supplied executable hashes, PE file offsets, sizes and SHA-256
of 44 ranges (38 complete instruction spans, four pointers and two literals),
12,515 bytes total. No executable, disassembly, extracted source row or game asset
is distributed. These are inspected static source/lookup paths, not original-game
execution or a formal clean-room process.

The evidence covers AbstractType ID/Name initialization and property reads;
per-allocated-entry TeamType ID-then-Name lookup; event and AI reference callers;
team/script/task-force before AI list loading; AI construction, list/enable and
source property reads; initial campaign condition gates; caller-house CreateTeam
priority; and script18/another replacement constructor path. Existing team
property and script dispatch spans are reused from the reviewed
[team data ledger](../../docs/analysis/team-definitions-native.json). The initial
Name is the stored ID; exact Name loads retain current defaults and use a
49-byte input/48-byte terminated value. AI team operands have a 24-byte buffer
with a terminator at byte23, so this component admits at most23 ASCII characters.

Primary layout/address leads were the pinned YRpp interfaces at
`61d0887eb6040cfb36af16d592e9770ceae4dfb2`:
[AbstractTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/AbstractTypeClass.h),
[TeamTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TeamTypeClass.h),
[ScriptTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/ScriptTypeClass.h),
[TaskForceClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TaskForceClass.h),
[AITriggerTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/AITriggerTypeClass.h),
[HouseClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/HouseClass.h)
and [SessionClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/SessionClass.h).
Their labels alone are not behavior proof; paired native instructions and literal
source operands determine the supported subset. No YRpp implementation is copied.

`Name` is not discarded as presentation-only: it is a TeamType lookup alias and
also reaches native checksum/diagnostic paths. No RNG or checksum neutrality is
claimed. Unknown strings, truncation, native comment behavior, repeated exact
sections/keys, later house/AI transitions and incomplete source scripts do not
gain execution authority through this component.
