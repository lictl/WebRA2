# Initial object-event source provenance

The original WebRA2 adapter and synthetic fixtures use GPL-3.0-or-later and compose
the existing [mission binding catalog](MISSION_BINDINGS_PROVENANCE.md). They accept
its genuine immutable source context, not copied metadata or caller observations.

The bounded policy is described in [the component report](../../docs/mission-object-events-source.md).
Paired static examination of the pinned local RA2 and YR executables establishes
event6/7/44/48 matching and ordinary damage/destruction callback ordering. The
separate native metadata ledger and private raw-source comparison are in progress
for the draft integration; this checkpoint does not claim completed validation.

Primary layout references are the pinned
[YRpp ObjectClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/ObjectClass.h),
[TechnoClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TechnoClass.h),
and [TriggerTypeClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TriggerTypeClass.h).
No YRpp code is copied or licensed by this notice. These layouts supplied search
leads; the paired executable call paths provide the static interpretations.
