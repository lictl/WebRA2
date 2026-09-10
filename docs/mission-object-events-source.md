# Initial object damage and destruction event source

Issue [204](https://github.com/lictl/WebRA2/issues/204) adds a source adapter for
event6,7,44,48 through the genuine [initial binding catalog](mission-bindings.md).
The adapter has eight original synthetic tests, type checking and a separately
reproduced private source comparison. Runtime integration and review are tracked
in [PR207](https://github.com/lictl/WebRA2/pull/207).

`compileMissionObjectEventSource({bindings}, lowerLimits?)` returns an immutable
branded catalog. `missionObjectEventSourceBindings` exposes only its original
genuine binding catalog. Original instruction parameters, every object reference,
the shared tag groups, initial owner/type joins and unsupported actors remain
available. Copying a serialized object does not grant source authority.

Event44 compares the attacker's literal house allocation index. It does not use
event1's country-to-first-house conversion. Events6/7/48 retain the numeric operand
but do not use it as a selector. Exact integer framing remains a bounded import
policy; absent literal houses or unrecognized operand modes remain unsupported.
Events6/44 are transient. Events7/48 can latch only under native repeating tag
mode2; tag lifetime and any runtime latch implementation belong to the compound
controller. This factory cannot grant a VM or complete campaign authority.

Ordinary positive, nonfatal health loss emits6 then44 when a source actor exists.
Fatal infantry/structure callbacks emit6,7,48; Unit callbacks emit7,48,6. Only48
can be delivered without a source actor. These ordered arrays are the covered
subsequence: native threshold events and kinds4/29/38–43 remain outside the subset
and must not be silently marked complete by whole-program preflight.

Destruction callbacks occur when health reaches zero, before the derived death
animation completes. No second callback follows retirement. The consumer must
derive each hit from its authoritative world step, require a positive prior
health and actual positive loss, preserve callback ordering and prevent duplicate
delivery. It must reject unsupported recipient/source context; this factory does
not authorize a caller's claimed hit, force deletion or arbitrary owner change.

Source-created infantry, units and structures retain the ordinary base callback
policy, including stationary rows. Initial units use the constructor's unassigned
hijacker state; hijacking, transferred/dynamic tags, differing YR explicit attacker
house credit and other special damage routes are excluded. Rank, bridge, movement
and recruitment columns remain raw provenance and are not invented damage gates.
Damage capability and current lifecycle are separate consumer obligations.

Bounds can only decrease: 4,096 events, 2,048 actors, 32,768 references, 262,144 work
units, 32,768 diagnostics and 16MiB canonical identity. Failed compilation publishes
no source proof. Inputs and lower limits are read from own data descriptors;
genuine catalog and output identities use private WeakMaps.

Run the focused check with Node24.20.0:

```sh
node --import tsx --test tests/sim/mission-object-event-source.test.ts
npm run typecheck
```

The fresh private scan reads all 438 selected local files and reauthenticates the
rules, mission and art members. It resolves all 6 covered RA2 event records and
all 19 covered YR records. Every one of the 811/570 initial actor rows is retained;
249/263 ordinary infantry/unit/structure rows have supported callback source
contexts. The remaining 562/307 rows are nonordinary scenery families and retain
their unsupported reasons. There are 50/130 tagged initial objects and 5/2 tags
shared by more than one object. These counts describe source routing coverage,
not combat target eligibility or mission readiness.

The [metadata census](analysis/mission-object-events-census.json) records exact
source hashes, full private projection hashes and counts. A separate Python
oracle checks 60,980 assertions across raw source staging, physical member/root
pins, event operands, source owners, shared tags and all new output fields.
Existing world health values are the genuine upstream world projection; the
oracle does not independently reimplement the health compiler. A separate native
verifier checks 273 assertions for 65 range pins, decoded boundaries, switch tables,
actual vtables, constructor defaults and callback opcode immediates.

Private reproduction from the reviewer checkout uses the preserved scripts in
`local/worktrees/object-event-source/local/`: copy `probe204.mjs` to reviewer
`local/` and `native204/{pe.py,ledger.py,verify-native.py,oracle.py}` to reviewer
`local/native204/`. Their project imports are relative to the reviewer checkout;
the game root remains read-only. Run Node24.20.0 `node --import tsx local/probe204.mjs`,
then the private Capstone5.0.6 Python environment on `local/native204/ledger.py`,
`local/native204/verify-native.py` and `local/native204/oracle.py`. The first command
writes only ignored `local/object-events204/` projections and raw input copies;
the ledger generator rewrites only the reviewed factual metadata ledger and
ignored instruction listings. Compare the ledger bytes before accepting a rerun.

The existing baseline VM reports 367/531 unsupported diagnostics when optional cue,
cell and object capabilities are absent. Both original mission authorities remain
null. Combined runtime preflight and source combat recipient eligibility are
separate coordinator integration checks. A scene or a positive source match cannot
bypass a later unsupported instruction in that mission.

The [component provenance](../packages/sim/MISSION_OBJECT_EVENT_PROVENANCE.md)
records the source boundary. Full retail mission authority remains unsupported;
this source adapter is not a campaign-completion claim.
