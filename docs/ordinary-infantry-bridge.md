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
component alone. Eleven original focused tests pass. The private source/runtime
probe below now exercises both openings; browser attacks and campaign acceptance
remain separate integration gates.

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
Elite current-weapon selection is unproven because the prepared graph covers only
normal slots, so elite actors are excluded as attackers and ordinary-death targets.
This also prevents checking a victim's Suicide branch against the wrong weapon.
An unsupported Primary link is distinct from an explicitly empty Primary link.

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
native listings and retail probe outputs remain in ignored `local/`.


## Private opening evidence

The full 438-file installation was read through the genuine on-device catalog and
verified terrain/content factories. Explicit probe choices are seed 0, Normal
index 1 for every house, and 15 logical ticks for both ordinary death sequences.
The scripts issue actual move and attack commands; they do not edit actor positions,
source rules or mission cells. Both cases restore during movement and firing windup,
then complete an ordinary corpse and reproduce the terminal state from replay.

| Profile | Armed / target-only / movement-only | Selected owner | Source → target | At-range / final tick | Random words |
| --- | --- | --- | --- | --- | --- |
| RA2 | 25 / 0 / 786 | 5, explicitly different from default 0 | 23 → 32 | 386 / 675 | 18 |
| YR | 15 / 33 / 522 | 0, the default | 45 → 15 | 386 / 611 | 11 |

RA2's default Tanya actor did not have a reachable eligible firing goal in the
24 bounded path queries attempted. The generic probe then selected a reachable
pair controlled by owner 5. This demonstrates the source/runtime subset, not the
playability of Tanya's mission route. No initial admitted hostile pair was in range.
The YR target is target-only; damage permission does not grant its unsupported attack.

| Profile | Bridge fingerprint at source revision `0f1e27c` | Unbound world5 terminal checkpoint SHA256 |
| --- | --- | --- |
| RA2 | `7680e3c8ebb9d77db0f9e2254b724fd723b58c7deb650e968db2c279aa0d6f1c` | `a5ded1634d60d7268874489e3812d7765a1dfc1c43da86388271fd93690c0a16` |
| YR | `60fbb22223da516e774b7aeba56a167b83ea6f4e58a31136100d79511cca5c7f` | `3af0d938e8baa834f1b9fe51dd1cdc0973ceff3c305e3f205ca8f0e37b6e0c4c` |

The source preparation correction in `4a44877` assigns firing actor IDs from the
verified scenario's numeric placement order. The earlier initial-state component
assigned IDs from its lexically sorted report, which mismatched rows after 9.
A reversed-text 14-infantry-row plus unit fixture covers both profiles; the private
probe checks all 811 RA2 and 570 YR row-to-world IDs. Source/program fingerprints
change with that correction; none of the source rank, Armor, Firepower or FireUp
values change.

A separate Python oracle reparses six verified raw INIs, rehashes two source roots
and all six member ranges, and compares them with this catalog's selected source
identities. Its 1,311 comparisons cover 73 admitted actors, 40 firing programs and
four weapons: owner/rank/current-primary joins, eight IEEE754 factor values,
source FireUp and basic weapon scalars. Previously reviewed construction visit
order is an input to this oracle; it is not independently reconstructed here.
Native conditional-consumer evidence is the separate ledger above.

Four independent catalog sessions compare the same 438 files in sorted and reversed
order for each profile. Ten selected root audit handles change per profile, while
all 14 source pins, the bridge fingerprint, the combat model and every firing
program fingerprint remain identical. Full byte hashes and source joins stay
required; session handles are not substituted for durable identity.

Private reproduction, from this worktree with Node24:

```sh
node --import tsx local/bridge/probe.mjs
python3 local/bridge/raw-oracle.py
node --import tsx local/bridge/identity.mjs
```

These ignored helpers require the owner's installation and retained private source
inputs. `facts.json`, `raw-oracle-facts.json` and `identity.json` retain metadata;
full local source/checkpoint inputs are not published. Public validation uses
`npm run check`, including the 11 new bridge tests and existing initial-state
regression. These results do not establish native frame cadence, browser attack
controls, or any completed original campaign.

A separate coordinator integration probe used source-bound world6 at
`741d5eeb87a1f91bd2365e787dd4a8ebdf3da723` plus the unchanged Primary correction
`0f1e27c6e9b50f9c25996fc8230534a17f5f2063`. It reproduces the same movement,
shot/death ticks and random counts through `bindOrdinaryInfantryWorld`, with full
moving/windup restore and terminal replay. Its distinct final checkpoint hashes
are `ad969f783ff99071d3749c7023466018d55ea3a183dc3b3ad094582952738e9c`
(RA2) and `957e1605a85c52e266a43490a4ab66087bd17edb1d060580dce2979ddcccd982`
(YR). Issuing an actual target move during each saved windup cancels the pending
shot: checkpoint 388 retains target health and zero random draws, and restores
with identical continuation. These results are retained separately under
`local/reviews/ordinary-infantry-bound/local/bridge/`; review of the coordinator's
binding and browser implementation is separate from this source component.
