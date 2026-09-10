# Source-bound infantry firing cadence

Issue [#147](https://github.com/lictl/WebRA2/issues/147) supplies a pure, original
standing-primary timing component for the forthcoming ordinary combat adapter.
It does not fire a weapon in the browser yet. Numeric/RNG execution merged under
[#164](https://github.com/lictl/WebRA2/issues/164); the live source bridge remains
under [#132](https://github.com/lictl/WebRA2/issues/132) and #147.

`webra2-standing-fire-logical-1` maps source FireUp to logical windup ticks, then
requires a current admission decision. This is a D03 playability policy. It does
not reproduce the native sequence progress timer, facing delay, animation loops or
rendered frame cadence. At most one successful shot per actor per logical tick is
allowed. Native ROF zero remains stored as zero; a separate next-update rule stops
a same-tick firing loop. Positive ROF uses the exact caller-supplied integer.

The [source compiler](combat-initial-runtime.md) creates a genuine per-placement
program: source and program fingerprints, profile, row/type IDs, source placement
index+1 actor ID, standing-primary pose and FireUp. JSON copies cannot act as
programs. It is not a live actor constructor or weapon selector.

Use `createInfantryFiringState`, then `transitionInfantryFiring` with these commands:

- `advance` moves exactly one logical tick, with no wall clock.
- `begin` owns a bounded target ID and opaque weapon ID and schedules FireUp.
- `cancel` removes pending work without changing successful-shot rearm.
- `resolve` supplies the exact due-state hash, attempt/target/weapon IDs, an explicit
  `admitted` or `blocked` decision, and native ROF only for an admitted shot.

`inspectDueInfantryShot` returns the current due token without executing anything.
The caller must revalidate current ownership, health, target, position, facing,
motion, ammo, selected weapon, dry-ground context and every supported/special-state
gate. A stale tick, target, weapon or attempt cannot resolve another attempt. A
blocked decision produces no shot. Elapsed FireUp alone grants no authority.

The world adapter must stage its RNG draw, numerical calculation, ammo/damage
changes and this transition in one transaction. This module owns no RNG and cannot
undo a caller's premature draw. It receives the numerical ROF only after current
eligibility is established; a transition failure must discard staged external
changes too. Weapon IDs here are bounded opaque handles, not verified loadouts.

State retains tick, next attempt ID, pending start/due ticks, target/weapon IDs,
shot count, last successful shot tick and unmodified native ROF. All results are
frozen and source-bound. `saveInfantryFiring` returns a versioned canonical hash;
`restoreInfantryFiring` validates exact descriptors, scalar bounds, source joins,
pending/rearm consistency and the hash before owning a copy. A save can contain
plausible edited state; its checksum does not authenticate history. Replay starts
from the genuine initial state and includes each explicit admission decision.

Limits are 2,147,483,647 logical ticks, 1,048,576 attempts, 65,536 replay commands,
256 printable ASCII weapon-ID characters and a 65,536-byte state fingerprint
budget. Replay command limits can only be lowered. A transition that would exceed
these bounds fails atomically. Sparse arrays, extra properties, accessors, boxed
scalars and unknown schema versions reject. No DOM, I/O, timers or randomness are
used by the simulation component.

Ten focused original timing tests cover windup and rearm, preserved zero ROF,
blocked/cancelled and stale resolutions, target/weapon joins, every checkpoint's
save/restore, 40 generated 60-tick transcripts, source/shape/boundary attacks and
aggregate replay limits. Descriptor snapshots also cover Proxy-wrapped commands,
replay arrays, nested saves and source inputs without ordinary property double reads. These are synthetic execution checks, not native firing
or campaign validation. The private source corpus also exercises one logical
shot/save/restore/replay for every admitted placed infantry timing program using
original opaque test weapon IDs; this proves composition only.
