# Browser ground traversal and infantry slots

This application slice joins the reviewed [ground traversal](terrain-traversal-ground.md),
[infantry passage](world-infantry-passage.md) and
[source combat](ordinary-infantry-bridge.md) components. It addresses
[issue 180](https://github.com/lictl/WebRA2/issues/180) and
[issue 178](https://github.com/lictl/WebRA2/issues/178), with combat integration
tracked by [issue 132](https://github.com/lictl/WebRA2/issues/132).
It does not implement mission execution, native walking animation, bridge movement,
or unrestricted combat.

## Application contract

The retained campaign worker prepares the selected verified mission using
`compileTerrainTraversalGround` before `compileWorldContent`. It compiles the ordinary
source combat bridge against that same ground model, binds source combat, then applies
a genuine `compileInfantryPassageCatalog` through `bindInfantryPassageWorld`.
No actor is removed to create a route, and UI metadata cannot authorize occupancy or
attacks. Group orders retain the existing atomic core admission and destination planner.

App-private terrain wire version 7 rejects older worker messages. Legacy motion-1
summaries and actor snapshots keep their prior shape. Motion-2 summaries additionally
carry the genuine catalog policy/hash and every actor's initial supported slot (or
explicit null). Current actor rows carry the saved settled and reserved slots, including
retired rows. Validation checks bounded coverage, supported infantry joins, active-edge
reservations, unique occupied slot claims and exact record shape. The core independently
validates all source relationships and restores; wire checks do not confer source authority.

The named presentation policy `webra2-settled-infantry-slot-pixels-1` uses the reviewed
native slot coordinates in a 256-lepton cell, relative to its center. Isometric offsets
are `(x-y)*30/256` and `(x+y)*15/256`, rounded once to final pixels using `Math.round`.
Thus the three supported offsets are `(15,0)`, `(-15,0)` and `(0,8)`; the last vertical
value explicitly rounds 7.5 upward. These are general projection constants, not extracted
mission geometry. The existing still already starts at cell center: no initial-slot
offset is subtracted. The settled slot is retained throughout a logical edge and changes
on arrival. Pixel rounding, depth integration and cadence are WebRA2 presentation choices,
not claims of native continuous walking or anchor equivalence.

SHP location/depth, keyboard focus and selection markers use the same projection.
Picking remains tied to each immutable rendered frame. VXL presentation and completed-death
retirement rules remain intact. The EN/Traditional Chinese panel identifies settled and
reserved slots and describes the current scope. Files remain on-device in the retained
campaign session; this slice introduces no server asset route or dependency.

## Validation checkpoint

- Original synthetic fixtures cover genuine RA2/YR slot sessions, moving restore,
  Stop/reservation release, shared cells and replay equivalence; hostile metadata and
  unsupported/legacy slot mixtures reject. Independent rational projection expectations
  cover focus and selection anchors. Original decoded SHP fixtures check shifted RGBA,
  depth, picking, overlapping actors, retirement and retained old-frame ownership.
- `npm run check` passed 1,031 public tests, TypeScript, document/publication/evidence
  checks and a 65-file application build. These are public synthetic checks.
- A separate private full 438-file local preparation loaded both source-selected
  factions in both profiles through the actual application loader. All four constructed
  genuine motion-2 worlds and validated initial worker summaries/snapshots. The Allied
  model identities match the independently reviewed core integration proof.
- Actual Chrome interaction, default-player route/combat, local checkpoint/export,
  four chooser starts and assets-only import acceptance are **pending** for this draft.
  YR's reviewed core route contains zero actual blocking shared-cell checkpoints;
  its route is a regression case, not proof of allied passage.

Private source geometry, identifiers, saves, images and probe output remain under ignored
`local/infantry-browser/`. Prior immutable browser builds are preserved. Other browser
families remain deferred under the owner's Chrome-first development decision.

## Provenance

The app helper, UI copy and original tests are WebRA2 contributor work under
[the application GPL notice](../apps/web/PROVENANCE.md). Source-derived slot selection and
occupancy evidence belong to the reviewed
[infantry passage notice](../packages/sim/INFANTRY_PASSAGE_PROVENANCE.md); terrain semantics
belong to the [ground traversal notice](../packages/content/TERRAIN_TRAVERSAL_GROUND_PROVENANCE.md).
The existing distribution already copies those notices. No new third-party code or binary
is adopted by this application change.
