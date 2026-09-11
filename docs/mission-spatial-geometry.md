# Initial-map spatial audio coordinates

This is a bounded static specification for [issue #236](https://github.com/lictl/WebRA2/issues/236),
following the [spatial audio source checkpoint](mission-spatial-audio.md). It adds
no executable module, mission admission, playback, actor selection or world state.
The coordinator owns the eventual runtime adapter. Both supplied images were read
as files; neither was executed. Raw native listings and map/TMP data stay private.

## Initial packed cells and flat coordinates

The paired Cell virtual slot at byte offset 0x48 resolves to RA2 `0x47ba50` and
YR `0x486840`. It reads signed 16-bit cell coordinates from offsets 0x24/0x26,
computes `x * 256 + 128` and `y * 256 + 128`, and calls the floor-height helper.
The selected [native ledger](analysis/mission-spatial-geometry-native.json) pins
these functions, vtable slots, loaders, arithmetic controls and supporting constants.

The initial `IsoMapPack5` readers are RA2 `0x54e1e0` and YR `0x56bac0`. Their INI
callers select the packed-map section, construct the decompression stream and call
these readers. Each 11-byte cell record contains signed-word x/y, a 32-bit tile
identity, then one-byte subtile, level and ice fields. The reader writes the
subtile directly to Cell+0x11a and the level directly to Cell+0x11b. It does not
add the selected TMP header's height byte. The ordinary post-load cell loop invokes
RecalcAttributes with −1; that function's explicit level store retains Cell+0x11b
when its argument is −1. The selected TMP slope accessor reads header+0x2a into the
cell's slope field at 0x11c. Invalid tile, overlay and terrain-transform branches
remain separate from this ordinary explicit-record interpretation.

For a cell with slope byte 0, the floor-height helper's tail reads Cell+0x11b as a
**signed byte**, multiplies it by the initialized level scale, adds 0.5, and converts
with the pinned truncating control word. The resulting bounded formula is:

```text
level = sourceLevel < 128 ? sourceLevel : sourceLevel - 256
flatZ = truncateTowardZero(level * 104 + 0.5)
```

For nonnegative levels this is `104 * level`. For negative levels it is
`104 * level + 1`; −1 produces −103, not −104. This distinction must not be lost
by importing the byte as an unsigned level or replacing the conversion with floor.
The source adapter still needs explicit bounds for the source profile and map.

## Why the scale is 104

The scale is a runtime-initialized scalar at RA2 `0x850c40` / YR `0x89e7c0`, not a
literal 104 store. The CRT initializer tables preserve the order of its dependencies,
and the pinned initializer walker calls non-null entries in ascending table-entry order.
Static reconstruction of those selected functions gives:

1. The positive-power path computes 256 squared. Twice that value is 131,072.
   The existing quantized-square-root helper selects table index 8,192, whose paired
   mantissa is 0x3504f3, producing 362.0386657714844.
2. The angle constants compute `(90 − 60) * radiansPerDegree`. The native selector
   truncates its scaled index to 341 and reads the paired stored float
   0.5766686797142029. The selected bytes are pinned; no host trigonometric function
   substitutes for this lookup.
3. That value times the quantized diagonal times 0.5 is approximately
   104.38817969796673. The conversion helper uses control word 0x0e7f and truncates
   it to 104. Both complete images give the same selected table values and result.

This is a static arithmetic reconstruction, not retail execution or a general
emulator for every CRT power/trigonometric path. The square-root algorithm and
source tables were also independently reviewed in the earlier
[weapon definitions work](weapon-definitions.md). The new evidence pins the actual
cell initializer and the selected table entries rather than importing a visual
height convention. No native lookup table is distributed.

## Initial records are distinct from dynamic placement

Selected dynamic tile-placement instructions at RA2 `0x55d850` / YR `0x57b650`
**do** add TMP header+0x28 to a supplied base level before storing Cell+0x11b.
This does not change the initial packed-reader interpretation; it shows why a runtime cannot
reuse an initial-source formula after unmodeled terrain mutation. This checkpoint
does not model destruction/deformation, tile replacement, map editing, bridges,
ramps or their update order.

For a position-only spatial sound request or exact-coordinate stop, an eventual
adapter may derive this flat center only when it proves an existing genuine initial
cell record, supported selected tile, slope 0, no bridge/overlay elevation path and
no intervening terrain mutation. It must preserve the exact emitted coordinates
for stop identity. A selected building/terrain object follows its own current
coordinate/controller path; the cell formula alone does not authenticate it.

## Object-enumeration gate

RA2 `0xa40958` / YR `0xa8e9a0` guards the cell building/terrain enumeration helpers.
When false they return no object; when true they walk the chosen cell list. The
pinned interface reference uses the opaque name `WTFMode`; this name is not a
semantic explanation or a safe default. The paired startup/session prefix writes 1,
and a paired dialog function saves the flag, clears it, and restores its prior
value afterward. Other lifecycle writes exist and are not fully interpreted here.

Therefore neither always-enabled enumeration nor always-positional audio follows
from a decoded map. Runtime integration needs an explicit supported phase policy,
current object-list membership/order and controller lifecycle. This source report
does not grant that state or treat unrelated gameplay defaults as proof.

## Evidence and remaining gates

The native ledger contains 72 selected records / 9,340 bytes: 48 code spans and 24
constant/pointer records. Whole-image SHA256 and PE virtual-to-file mappings are
verified. Every selected code span decodes to a complete instruction boundary;
entry/branch/call context was inspected separately. Decoding alone cannot prove a
correct start or a complete behavior, as the prior spatial cleanup correction showed.

The [private-source census metadata](analysis/mission-spatial-geometry-census.json)
compares raw packed map records, overlay planes and the declared selected TMP members
with the retained source projection. It verifies four full archive roots plus
individual members and makes 1,859 scalar comparisons without WebRA2 imports.
The scanner/decompression primitives are reused from the prior private ground
oracle; the #236 joins are new. The upstream theater asset choice is retained rather
than independently recompiled by this comparison.

All 27 RA2 opening spatial occurrences (26 sound 99, one stop 116) have slope 0,
overlay 255/data 0 and nonnegative source levels. Eight have level 2 and 19 have level 6,
giving the flat base Z values 208 and 624. Two selected TMPs have nonzero height;
that height is not added again by the initial packed-reader/flat-helper path.
The YR opening has 116 occurrences, including eight nonzero ramps and two nonempty
overlay contexts. Its level-term counts are not a claim that all those final
coordinates are supported. No new whole-mission or audio authority is produced.

Private reproduction is preserved under `local/reviews/spatial-geometry-236`:
`pe.py`, `ledger236.py`, `source-geometry236.py`, complete selected/exploratory
listings and the generated ledger/source facts. The ledger script accepts an output
path so a reviewer can regenerate metadata into ignored local storage. Run it with
the existing Capstone interpreter, and run the raw source oracle with Python3 and
the installed private LZO library. No executable is launched and no retail output
belongs in CI or distribution.

Before runtime adoption, independently review the exact metadata head, source joins,
initialization assumptions and selected native spans. The coordinator must bind
current source/world identity, gate unsupported geometry and enumeration states,
and verify ordering, rollback, saves/replay and sound-stop identity with original
fixtures. Audible browser output and complete campaign playability remain later gates.
