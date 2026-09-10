# Initial mission binding provenance

The new `mission-bindings.ts` and `mission-binding-flags.ts` component and original
fixtures are WebRA2 GPL-3.0-or-later code. They compose the existing source/world
factories and interpreter; no retail executable code or source rows are included.

Static study uses the pinned original `game.exe` and `gamemd.exe` images recorded
in the [mission binding report](../../docs/mission-bindings.md). Primary YRpp layout
references are pinned to
[`61d0887eb6040cfb36af16d592e9770ceae4dfb2`](https://github.com/Phobos-developers/YRpp/tree/61d0887eb6040cfb36af16d592e9770ceae4dfb2):
[TagClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TagClass.h),
[TagTypeClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TagTypeClass.h),
[TriggerClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TriggerClass.h),
[TriggerTypeClass.h](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TriggerTypeClass.h).
Those layout interfaces are research references, not a claim of an upstream
license grant or a substitute for paired loader/constructor evidence.

The paired static investigation follows TagClass sharing and constructor chains,
TriggerClass difficulty initialization, initial list registration, country/house
lookup and object/cell attachments. Numeric event/action GetFlags classification
is kept separate from opcode execution support. The [paired native ledger](../../docs/analysis/mission-bindings-native.json) pins94
records/10319 bytes and the report gives private reproduction instructions.
No game executable was run. No binary-exact simulation, generic INI compatibility,
physical event dispatch or campaign playability is claimed.

The native images are RA2 `game.exe` SHA-256
`73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`
and YR `gamemd.exe` SHA-256
`3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.
Numeric masks derive from the paired dispatch code and complete switch data; a
zero mask says nothing about opcode safety. The local-slot loader lead was supplied
by coordinator research for issue189 and independently rehashed and inspected here.
The compiler uses it only to reject RA2 upper-slot source grants; it does not adopt
initial variable values. The shared build/license map remains coordinator-owned
and must include this exact notice before browser distribution.
