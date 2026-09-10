# Initial object-event source provenance

The original WebRA2 adapter and synthetic fixtures use GPL-3.0-or-later and compose
the existing [mission binding catalog](MISSION_BINDINGS_PROVENANCE.md). They accept
its genuine immutable source context, not copied metadata or caller observations.

The bounded policy is described in [the component report](../../docs/mission-object-events-source.md).
Paired static examination of the pinned local RA2 and YR executables establishes
event6/7/44/48 matching and ordinary damage/destruction callback ordering. The
[native ledger](../../docs/analysis/mission-object-events-native.json) contains
65 selected ranges, 50 instruction-complete code spans and 15 data ranges totaling
10,811 bytes. It records full executable SHA-256, physical offsets, exact half-open
VA ranges and individual hashes. Its file SHA-256 is
`662e4d238573b361ba358b4363f8c195ccee468825d5f5d4c03145e9cc27803b`.

| Evidence | RA2 | Yuri's Revenge | Interpretation |
| --- | --- | --- | --- |
| Numeric event load | `6E6900..6E696B` | `71F4E0..71F5B0` | Numeric operand mode and retained Number field |
| Event44 predicate | `6E640B..6E6436` | `71EE57..71EE82` | Requires the matching delivered kind and a source actor; compares source owner `House.ArrayIndex`, not country index |
| Generic final dispatch | `6E6619..6E6647` | `71F069..71F099` | For 6/7/44/48, the later country lookup does not constrain the successful predicate; selected table entries lead to the true return |
| Event state predicates | `6E6CF0..6E6D10`, `6E6D50..6E6D66` | `71F950..71F970`, `71F9C0..71F9E0` | StateA true for all four; StateB false for 6/44 and true for 7/48 |
| RegisterEvent | `6ED740..6ED822` | `7264C0..7265BB` | Persistent input plus StateA/StateB gates occurrence latching |
| Tag RaiseEvent | `6B3DF0..6B3F82` | `6E53A0..6E5559` | Shared chain, mode2 persistence input, mode1 reference-count gate and mode0/1 physical detachment |
| ResetTimers | `6ED680..6ED73E` | `726400..7264BE` | Clears timed13/51 bits, not destruction7/48 bits |
| Object ReceiveDamage | `5D3D20..5D4157` | `5F5390..5F584D` | Zero/healing exits, positive health reduction, immediate virtual destruction callback at zero and nonfatal6/44 tail |
| Techno destruction callbacks | `6CED90..6CEE82` | `702D40..702E44` | Base6/7/48 subsequence; 7 and 6 require a destroyer; Unit class skips the base7/48 block |
| Unit override | `707ED0..707F4A` | `744720..74479A` | Unit7/48 precede the base call; hijacker and transfer state can suppress the override block |
| Initial hijacker state | `6C0CD0..6C0F88` | `6F2B40..6F2ECE` | Constructor establishes the unassigned index `-1` |

The ledger also pins constructor-installed infantry/unit/structure vtables and
their actual destruction slots. Infantry and structure dispatch to the base
function; Unit dispatches to its override. Paired Infantry→Foot→Techno→Object
call segments establish that Object destruction callbacks precede the derived
infantry fatal-state branch. These are selected proof segments, not every possible
caller or special damage path.

Native callbacks can change object/tag state between calls. The source adapter
preserves the covered ordering and shared binding identity; it does not implement
native recursive side effects or give a copied observation execution authority.
The source policy excludes hijacking, changed owner/tag state and YR's differing
explicit attacking-house credit branch. Native mode1 needs the real reference
count and remains a whole-program runtime gate. The bounded source row policy
requires complete original 14-field infantry/unit or 17-field structure framing;
it does not expand this into full native placement parsing.

Primary layout references are the pinned
[YRpp ObjectClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/ObjectClass.h),
[TechnoClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TechnoClass.h),
and [TriggerTypeClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TriggerTypeClass.h).
No YRpp code is copied or licensed by this notice. These layouts supplied search
leads; the paired executable call paths provide the static interpretations.
