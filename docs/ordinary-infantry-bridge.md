# Ordinary infantry source/world bridge

Issue [132](https://github.com/lictl/WebRA2/issues/132) joins source preparation to
actual combat. The new `webra2-standing-human-source-combat-1` component
authenticates a complete set of genuine world, entity, actor, weapon, instant
context, animation, modifier, veterancy, initial-state, death and terrain factories.
It preserves the original movement world and classifies each placed actor as
armed, target-only or movement-only. A target-only actor has an empty attack list;
an unsupported weapon does not automatically make its owner invulnerable.

The compiler requires an explicit random seed and separate sequence11/12 logical
durations. House difficulty choices come from the genuine modifier factory.
It binds every source fingerprint, profile, map identity, rules/art layer identity,
world placement and current owner index. Forged JSON reports cannot manufacture
these factory identities. Output includes a genuine unbound combat model,
source firing programs, exact exclusions, source pins and a fingerprint.

The unbound model is a preparation artifact. The coordinator's next integration
binds the genuine bridge into the core and calls its current-state evaluator
before starting and resolving a shot. No UI or campaign is enabled by this
component alone. The eight original focused tests currently pass; full private
scene and final integrated core evidence are pending in this working slice.

## Current state and scope

The public `evaluateOrdinaryInfantryAttack` accepts a genuine world model, a full
checkpoint and two actor IDs. It owns and validates the checkpoint through the
world restore path. The separate engine-internal `evaluateOrdinaryInfantryState`
accepts only the core's already validated, owned state. This internal seam is not
a UI authority and does not admit commands, mutate health or consume random words.

Current positions, goals, routes, in-flight reservations, health, complete impact
occupants, static footprints and pending deaths come from the world. Terrain cells,
elevation, overlays and blockers come from the authenticated traversal. It checks
the complete source-to-target rectangle and its one-cell margin. Unknown, wet,
overlaid, elevated, obstructed and shared-impact cases remain excluded.

The named WebRA2 mode uses cell centres, a common relative z=0 plane only when
the verified map elevations agree, and standing Walk infantry with ordinary
primary invisible weapons. It preserves native damage, reload values including
zero, house/rank modifiers and corpse vectors through the reviewed components.
Finite-ammo attackers and active veteran abilities outside the four inspected
consumers remain excluded. Typed inactive veteran lists do not block rookies.

The world mode has no transport, deployment, prone, attachment, mind-control,
temporal, altitude, experience or native animation-sequence transition. Logical
FireUp windup retains the standing pose, including when such an actor is targeted.
This is an explicit D03 timing/presentation choice, not proof of the native death
branch while an infantry firing animation is active. The supplied logical death
durations are not inferred from SHP frame cadence. Structures, vehicles, aircraft,
special trajectories and incomplete effects retain movement/preview behavior.

## Additional static consumer evidence

The source images are unchanged from the reviewed component ledgers:

| Profile | File | SHA256 |
| --- | --- | --- |
| RA2 | game.exe | `73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df` |
| YR | gamemd.exe | `3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600` |

Virtual addresses below are start-inclusive/end-exclusive. The bounded private
ledger has eleven complete instruction ranges/2,632 bytes and five data records;
its SHA256 is `9af6de4a59583ad165463374b0e05f869bfba67ef5ddb52244ed30f505ce5e61`.

| Profile | Range | Observation |
| --- | --- | --- |
| RA2 | `6CB99E–6CBA56` | Ordinary Fire selects its normal Anim vector and constructs that animation |
| RA2 | `7335F0–733638` | Exact AssaultAnim key read stores weapon offset F4 |
| RA2 | `500AA0–500C68` | Occupy/assault dispatch requires target virtual type6, a building, before the separate handler |
| RA2 | `4536D0–453845` | Building occupant-clear path consumes attacker's primary weapon AssaultAnim |
| YR | `517A50–517AE6` | Infantry constructor installs vtable7EB058 |
| YR | `41BFB0–41BFB3` | Its slot400 target returns false |
| YR | `6FF2D1–6FF3C7` | Ordinary Fire switches to OccupantAnim only when virtual400 returns true; OpenToppedAnim has a separate actor-byte82 condition |
| YR | `77255F–772610` | Exact AssaultAnim/OccupantAnim/OpenToppedAnim reads store weapon114/110/118 |
| YR | `519630–51973C` | Building type6 and occupy/assault checks guard the handler call |
| YR | `522910–522A4E` | Infantry assault branch invokes building occupant-clear with the attacker |
| YR | `4585C0–458741` | Separate occupant-clear consumes attacker's primary weapon AssaultAnim |

The YR data pin at7EB458 resolves slot400 to41BFB0; the other four records pin
the exact key strings. This establishes why OccupantAnim and AssaultAnim cannot
affect the declared ordinary infantry/human-target path. It does not establish
that arbitrary fields are presentation-only. OpenToppedAnim remains excluded,
as do active ordinary Anim/AnimList effects and unknown key spellings.

## Bounds and verification

Compilation caps placements at2,048, definitions at16,384, weapons at1,024,
terrain cells at130,816, source work at262,144, retained reason characters at1MiB
and fingerprint encoding at8MiB. Queries cap the rectangle at4,096 cells and
count at most65,536 work units. Callers can lower these limits only. Failed
publication or a failed public query leaves the caller's source/state untouched.

Focused commands use Node24:

```sh
node --import tsx --test tests/sim/ordinary-infantry-bridge.test.ts
npm run typecheck
```

Tests exercise both profiles, target-only damage, source windup/death/replay,
conditional versus ordinary animation effects, complete terrain/occupancy,
authored rank, stale/forged source joins, descriptor snapshots and resource caps.
These are synthetic tests, not original campaign acceptance. Private metadata,
native listings and future retail probes remain in ignored `local/`.
