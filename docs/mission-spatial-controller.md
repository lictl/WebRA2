# Spatial sound controller behavior

This static assessment supports [issue236](https://github.com/lictl/WebRA2/issues/236).
The [range ledger](analysis/mission-spatial-controller-native.json) contains52
records/50 complete instruction spans/7,980 summed bytes. Both complete images
were rehashed before decoding; an independent coordinator rerun exactly reproduced
the private ledger digest `3701de0fed2eaf5ced7c1571edc668b1b377b133a082f6904ef5fbbfa2933577`.
The published ledger changes only its status wording. No executable was run and
no instruction listing, native code or retail sample is published. These are
inspected selected spans, not a complete native audio-engine implementation.

## Assignment, instance and audible state

The object desired custom sound is a registry index at offset0x64. It is separate
from the ambient controller at0x3c and custom controller at0x50. A controller holds
an instance pointer, generation, resolved definition and engine identity. A native
pointer is not a portable saved sound ID. Its validator checks engine/bank,
definition and generation; a stale pointer does not establish an active sound.

Setting a nonnegative desired index only stores intent. The ordinary object update,
when outside limbo, services ambient audio before custom audio at the object's
current stored XYZ location. The inspected prefix does not itself test health.
For a valid instance of the same definition, reconciliation updates gain/pan and
reuses the instance. A different definition retires the old instance before trying
to allocate its replacement. Zero gain or device/sample/capacity conditions can
prevent admission; the desired object index remains available for a later retry.

The minus-one setter clears desired intent and requests a custom-controller stop.
The normal stop path marks instance flags0x60 and detaches the binding. Later
instance processing can stop the channel and choose a decay tail when the sound
Control bit0x40 permits it. A stop request therefore does not prove immediate
silence. Object destruction instead runs hard cleanup for ambient and custom
controllers and then their destructors. Health-zero is not universal proof that
this destruction callback has run.

| Consumer | RA2 entry | YR entry |
| --- | --- | --- |
| Custom desired setter | 0x5d5520 | 0x5f6cb0 |
| Ordinary object audio update | 0x5d27f0 | 0x5f3e70 |
| Positional instance reconciliation | 0x713e60 | 0x7509e0 |
| Controller validation | 0x406140 | 0x406130 |
| Controller soft-stop request | 0x405fe0 | 0x405fd0 |
| Positioned node creation | 0x714290 | 0x750e20 |
| Positioned node maintenance | 0x714330 | 0x750ec0 |
| Positioned stop by flags/XYZ | 0x7143b0 | 0x750f40 |
| Audio-pump phase | 0x406ea0 | 0x406f70 |

## Position-only controllers

A valid positioned99 request obtains a new pool node, initializes its controller,
copies XYZ/flags, attempts reconciliation and appends the node. It does not search
for another node with the same sound or position. Repeated requests may therefore
create distinct nodes, subject to allocation/admission conditions.

Positioned116 visits all nodes and requests stop when flags intersect and all
three coordinates match exactly. It does not filter by sound index or immediately
unlink matching nodes. The action's retained numeric field remains ignored.

Maintenance treats a live instance differently from a retained looping definition.
An inactive positional definition can be retained/restarted only when Control
bit0x1 is set and Loop is zero; object custom updates resubmit their desired index
without that positional-node predicate. Suspended nodes skip spatial adjustment.
The paired YR entry also checks VoicesEnabled; the inspected RA2 counterpart does
not have that entry-byte check. These source distinctions remain explicit.

## Phase and proposed browser consumer

Instance allocation initializes state0 and links the instance. Actual sample
startup belongs to the separate audio pump. Its inspected clock/device/reentrancy
gate runs the instance engine before positional-node maintenance. Precise clock
units, every caller and relative ordering of every mission action versus object
update remain unproved. Multiple desired assignments before one native object
update may coalesce to the last value.

The proposed D03 consumer preserves ordered action receipts, saves object desired
sound intent and distinct positional intent IDs, then reconciles object intent
once at a published boundary. This explicitly chosen phase can coalesce requests
differently from native traversal; it must not be described as exact native timing.
Listener gain, engine admission, RNG/sample/queue state, natural completion, decay
and audio-device clocks remain presentation state and cannot affect simulation.

The [current dispatch](mission-spatial-world.md) has authenticated targets and a
saved request cursor. It has no desired-controller store or browser voice consumer
yet. Future tests must cover repeated/replaced/stopped object desires, positional
duplicates, changed target routing, stale instance generations, failed admission,
retirement, decay tails, restore and atomic work-bound rejection. The static
assessment does not turn those proposed tests into completed playback evidence.
