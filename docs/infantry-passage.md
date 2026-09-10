# Source-bound allied infantry passage

Status: WORKING under [issue180](https://github.com/lictl/WebRA2/issues/180).
The source catalog and pure occupied-cell helper are implemented. Existing world
model binding, versioned saves, movement/core transactions and Chrome acceptance
remain coordinator integration work. This checkpoint does not enable passage in
the browser or close the original route issue.

`compileInfantryPassageCatalog({world,definitions,actors,rules,mission})` requires
genuine compiler results. It owns and hashes mission bytes, reconstitutes the
actor/alliance table, compares its fingerprint and joins every placement to the
immutable base world. The result pins that world, the entity/actor definitions,
ordered rules sources, profile and mission source. Original rows remain private
runtime input, including source tags and mission names. Rules-file physical byte
authentication belongs to the verified import session; a metadata hash alone is
not an authentication protocol. Forged copies of the factory results fail.

Ordinary supported actors are mobile, living, ground Walk infantry with a
resolved source house, supported raw row and slot2/3/4. Guard, Sleep and Area Guard
are the bounded initial mission contexts; transport/special mission contexts,
bridge rows, unsupported slots and ambiguous source slot collisions remain
whole-cell blockers. Source tags are retained but are not an operand of the
traced ordinary slot admission branch; their future trigger execution is a
separate mission dependency. No source actor is dropped or relocated. All
unsupported rows remain visible with reasons.

The result exposes directed initial alliances only when the reviewed actor
compiler established the complete fresh-map relationship set. Unknown alliance
tokens do not prove hostility or permission. Same-house identity remains known.
Live diplomacy, changes of owner, locomotor transformations, transports and
scripted location changes require a new source-bound runtime extension.

## Saved slots and atomic integration seam

The proposed optional `WorldState.infantrySlots` is sorted by `entityId`, with
one `{entityId,subcell,reservedSubcell}` row per catalog-supported actor. The last
slot remains present after retirement; the reservation becomes null. A published
`progress > 0` requires a route head and reserved slot; zero progress has no
reservation. An immediate full transition may reserve/commit entirely inside an
atomic core tick. Prior-policy saves must retain their prior behavior or fail at
an explicit version boundary.

`initialInfantrySlots(catalog)` constructs source slots.
`createInfantryOccupancy(catalog,{entities,infantrySlots,retiredEntityIds})`
creates a detached immutable index with `choose(entityId,destinationAddress)`.
It returns a discriminated available/blocked result, chosen slot, reason and
examined-claim work. It never modifies actors or admits a command.

The caller is the core adapter after validating the genuine bound world, routes,
health, clocks, combat and retirement lifecycle. The helper is not a save loader.
An arbitrary `retiredEntityIds` array is not an external capability: only the core
may derive it from its authoritative validated lifecycle. Zero health without
explicit retirement remains a whole-cell blocker, including pending death.
Independent building footprints remain blockers when a mobile actor retires.

Admission requires the mover to be allied toward every other claimant. Slots
must differ. The helper conservatively indexes both the current anchor and the
in-flight destination. It first prefers the mover's current slot, then2/3/4.
Queued goals are not reservations. Concurrent orders still require deterministic
core sequencing, and failure must leave the complete world unchanged.

Restoration requires exact sorted slot coverage, valid reservation/motion joins
and no new hard-blocker overlap. Original shared anchors are retained only at
their exact original coordinates and source slots. For a new settled shared
cell of at most three actors, a bounded arrival-order search verifies that one
directed admission order exists. This validates a possible state, not historical
execution. An active incoming reservation must independently satisfy its actual
mover-directed relationships; an inverse hypothetical order cannot authorize it.

## Evidence, bounds and remaining gates

The [native ledger](analysis/infantry-passage-native.json) and
[provenance](../packages/sim/INFANTRY_PASSAGE_PROVENANCE.md) distinguish native
facts from D03 choices. Original tests exercise source/brand/hash rejection,
slot collisions, one-way/unknown relationships, current and reserved slots,
zero-health/pending-retirement blocking, hostile restoration and detached inputs.

Default compilation caps are16MiB mission bytes,2,048 actors,16,384 types,32
houses,1,024 alliance pairs and4,194,304 source-work units. Lower limits may be
supplied. State indexing bounds actors and aggregate route entries before
allocation, reuses the world's bounded blockers/footprints, and adds at most
two claims per blocking actor. A sharing-order search has at most six
permutations. A query scans only its target cell's bounded claims and reports
that work; the core must cap aggregate queries/work across a tick or admission.

Reproduce original tests with:

```sh
node --import tsx --test tests/sim/infantry-passage-catalog.test.ts tests/sim/infantry-passage-occupancy.test.ts
npm run typecheck
```

Private source reproduction uses ignored `local/probe180.mjs` in the
`local/worktrees/infantry-passage` checkout, reading only the original `game/`
folder. Native reproduction uses its `local/native180/ledger.py` with pinned
images and Capstone5.0.6. Raw input, table projections and source coordinates stay
under ignored `local/infantry180/`; public reports contain counts and hashes only.

Pending gates: independent raw-source comparison and final metadata census;
coordinator model/save/navigation/movement integration; every-tick save/replay,
stop/retarget/death and budget rollback tests; actual original route proof composed
with [ground traversal178](https://github.com/lictl/WebRA2/issues/178), followed
by actual Chrome movement. No mission action or victory behavior is established
by passing this occupancy slice.
