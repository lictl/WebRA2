# Infantry passage provenance

The original TypeScript catalog, occupancy helper and `src/world-infantry-passage.ts`
binding are licensed
`GPL-3.0-or-later`. They compose the reviewed entity, actor/alliance and world
compilers. No retail code, source row, image or extracted asset is distributed.

The [native metadata ledger](../../docs/analysis/infantry-passage-native.json)
pins both installed executable hashes and 44 code/data spans (11,239 bytes).
Every code span ends at a complete decoded instruction. This is static analysis,
not execution of either game or proof of its complete locomotor behavior.
The following primary layout references are pinned to YRpp revision
`61d0887eb6040cfb36af16d592e9770ceae4dfb2`:

- [InfantryClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/InfantryClass.h),
  [CellClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/CellClass.h)
  and [HouseClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/HouseClass.h).
- [Interfaces](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/Interfaces.h),
  [LocomotionClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/LocomotionClass.h)
  and [GeneralDefinitions](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/GeneralDefinitions.h).

Headers are layout references, not copied implementation or a claim about their
license. The two installed images supply the paired dispatch evidence:

| Fact | RA2 | YR |
| --- | --- | --- |
| Infantry occupied-cell method | `503190..503A3D` | `51BF90..51C883` |
| House-directed alliance helpers | `4E5500..4E55D1` | `4F9A10..4F9AE2` |
| Ordinary subposition allocation | `4764B0..476746` | `481180..48149B` |
| Slot-coordinate initialization | `483390..483404` | `48E480..48E4F4` |
| Mark slot and owning house | `508410..50849F` | `5217C0..52184F` |
| Clear slot, then empty-house marker | `5084A0..508529` | `521850..5218D9` |
| Walk head change | `71F590..71F8FC` | `75C240..75C63B` |
| Walk Stop | `71E110..71E16F` | `75ADA0..75ADFF` |
| Walk release head occupation | `71FCE0..71FD26` | `75CA30..75CA76` |

The ledger also pins Infantry constructor virtual assignments, relevant virtual
entries, Walk constructor/interface/class GUID and the shared fallback-priority
table. The ordinary allied RTTI branch identifies Infantry as15 and counts
stationary occupants. Full ordinary slot mask `0x1c` prevents admission. The
ordinary allocator skips indices0 and1, choosing2/3/4. Coordinates of those slots
are `(192,64)`, `(64,192)` and `(192,192)` within a256-unit cell. Coordinate mapping
and source raw slot provenance are distinct from the world grid axes.

The mover's house tests its own directed relationship toward an occupant; this
is not inherently mutual. Native head changes clear the old marked coordinate
and mark the selected destination before physical arrival. Native selection of
a center fallback calls Scenario RNG. Stop clears the long destination but can
retain a nonempty current head. No claim of global RNG neutrality follows.

WebRA2 explicitly chooses a stable current-slot/2/3/4 preference and conservatively
retains both the source anchor and the in-flight destination. Its whole-cell
motion, route ties, exact source eligibility and saved reservations are D03
policies, not native timing or continuous collision equivalence. Transport,
bridge layers, unsupported source slots/locomotors and unverified current state
remain whole-cell blockers. Tag metadata is retained; this component does not
execute tag triggers. See the [component report](../../docs/infantry-passage.md)
for the core integration and acceptance boundaries.

The coordinator's world model/save adapter is an original extension of the existing
MIT world implementation. The combined distribution retains both component notices.
Version7 uses the catalog only after a complete unbound model identity join, and
saves chosen subcells and active reservations. See the [core integration report](../../docs/world-infantry-passage.md)
for death/Stop, work accounting and prior-save boundaries; these are D03 policies.
