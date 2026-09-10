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

## Replay workload correction

The first frozen Chrome build completed the original default-player RA2 route and
ordinary combat, reaching browser tick 2,380. Full replay verification then exceeded
the pre-existing 30-second operation timeout and terminated that worker. Selected files
remained available for retry; this was recorded as a failed validation, not success.
A private reconstruction using the browser-exported moving checkpoint and the same
admission/final ticks reproduced the exact browser terminal hash. Separate Node
validation of those 2,379 logical ticks took 35.4 seconds, confirming that the ordinary
operation deadline was too short even outside the browser.

Only `world-replay-validate` now has a three-minute upper deadline; ordinary operations
remain at 30 seconds and asset preparation retains its existing separate limit. The
original replay tick/work/input caps still apply. The bilingual busy message offers an
explicit cancellation button. Active validation has its own operation flag, so selection changes,
Space/Stop shortcuts and hidden-page notices cannot hide that button or its explanation.
Cancellation terminates the worker, clears pending reply
handlers and returns to retained Files; saved local checkpoints remain intact. There is
no promise of completion for every supported input or background-tab execution. Synthetic
clock tests cover both deadlines and abort cleanup; delayed-worker and mounted-view tests
cover cancellation, stale completion and restored local checkpoints. On the corrected
Chrome build, full RA2 replay verification succeeds. Pressing Space while it runs keeps
the busy explanation and Cancel button visible. Explicit cancellation returns to the
retained assets; reopening the same world restores its browser-local moving checkpoint.
The independent mounted test also covers Clear selection, Stop and Escape during
verification; those additional combinations are synthetic evidence.

The loader also removes the inherited `no-infantry-subcells` limitation after genuine
passage binding, replacing it with the declared bounded slot scope. This changes reported
limitations only, not model/checkpoint identity.

## Validation

- Original synthetic fixtures cover genuine RA2/YR slot sessions, moving restore,
  Stop/reservation release, shared cells and replay equivalence; hostile metadata and
  unsupported/legacy slot mixtures reject. Independent rational projection expectations
  cover focus and selection anchors. Original decoded SHP fixtures check shifted RGBA,
  depth, picking, overlapping actors, retirement and retained old-frame ownership.
- `npm run check` passed 1,033 public tests, TypeScript, document/publication/evidence
  checks and a 65-file application build. These are public synthetic checks.
- A separate private full 438-file local preparation loaded both source-selected
  factions in both profiles through the actual application loader. All four constructed
  genuine motion-2 worlds and validated initial worker summaries/snapshots. The Allied
  model identities match the independently reviewed core integration proof.
- The [independent technical review](https://github.com/lictl/WebRA2/pull/190#pullrequestreview-5165659125)
  at `c41642341fa35395816d1f3cade01ccfd85b19b9` reports no remaining finding after
  1,033 public checks and 5,414 extra assertions across 1,104 logical ticks. Its scope
  excludes the separate browser results below.

### Actual Chrome acceptance

Two immutable local bundles have distinct evidence. Each contains 65 code/license files
from 142 approved inputs. The intermediate replay correction was superseded before
native acceptance and has no claimed browser gate.

| Tested source | Manifest SHA-256 | Native scope |
| --- | --- | --- |
| `971ba1e4be4d29bc563732a5a84d514f1b3913a8` | `200a6ed92799643dd25d3876178b20c7ece736e346f299252f27b2b76c8843a8` | Full 438-file installation; all four faction openings launched and stepped; RA2 default-player route, moving export/Stop/restore, ordinary combat and the recorded replay timeout |
| `c41642341fa35395816d1f3cade01ccfd85b19b9` | `fa0239497b1b0054d1ef9043a081455778db07bbe2bfd254ec7610557e6ed42e` | Sixteen asset-only MIX files; both Allied worlds; imported RA2 moving save, long replay completion/cancellation/recovery, saved slot art/picking, Traditional Chinese, and YR route/combat/save/replay |

The four full-installation starts produced 811, 1,045, 570 and 704 actors, respectively
for RA2 Allied/Soviet and YR Allied/Soviet. Their source-bound slot counts are 40, 60, 34
and 23. Returning to the chooser retained all selected Files and did not duplicate the
world panel. The asset-only Allied worlds reproduced the same model and initial-state
identities as their full-installation counterparts.

The RA2 run uses the original source-selected player. It keeps all actors and stationary
footprints, traverses the route that crosses actual allied blocking infantry, and reaches
an eligible ordinary target. A native moving checkpoint exported at tick 1 restores
exactly after Stop. The observed moving state at tick 686 has the same hash as a separate
private source replay; saved settled/reserved slots remain valid through that route.
At tick 1,626, focus and frame picking identify the selected still at its shifted slot.
The corrected build also imports the matching reconstructed tick-686 checkpoint and
checks focus/picking, EN/Traditional Chinese slot labels, Stop at 687 and exact restore
to 686. This imported checkpoint is explicitly separate from the original native
movement observation.

RA2 arrived and paused at browser tick 2,166; an admitted shot entered windup at 2,167,
and the browser was paused after completed target death at 2,380. These are observed
browser pause points, not native cadence claims or the shorter headless proof's terminal
tick. The corrected build verifies the full replay reconstructed from the native moving
export and exact observed admission/final ticks. Verification preserves the currently
loaded moving state. The transcript reconstruction and browser verification are distinct
steps; no native export of that full transcript is claimed. Tool-observation intervals
span other work and are not reported as replay execution benchmarks.

YR uses its original source-selected player and reaches its destination at the observed
pause tick 477. Moving Stop/restore reproduces the saved tick-1 state. The shot at 478
is saved, cancelled by Stop at 479 and restored to exactly the same pending state before
continuing to completed target death at observed tick 739. Chrome verifies its current
replay to the same terminal hash and exports both checkpoint and replay through the
native save dialog. This replay begins at the restored pending checkpoint, so it proves
that continuation rather than the entire earlier route. YR's reviewed route has **zero
actual blocking shared-cell checkpoints**; this is a route regression, not independent
evidence of allied passage. Its arrived still, focus and frame pick agree. A separate
private Node run reloads the same sixteen asset files, validates the native exported
replay and reproduces its terminal hash by stepping from the exported pending checkpoint.

| Observed state | SHA-256 |
| --- | --- |
| RA2 native moving export, tick 1 | `f818874a9a405656dcb6fc0330847ae446ea33cfa327874005bcd94c26da72c4` |
| RA2 observed/reconstructed moving state, tick 686 | `4bf5b71ac1eb459e75cd80e488a59b46b000a41b482de19b1747334297fd6ae4` |
| RA2 completed state and corrected replay terminal, tick 2,380 | `b3004c0f7f2689d81875f4b583b2bd44156c12ccc247e10f563ff5fc9eb2bb1d` |
| YR restored moving state, tick 1 | `c2eec24d377e4cdb87aced6edbf46fecbb6096f983d0cf22f70e7870fbf1a792` |
| YR pending save/restore, tick 478 | `bbe2715f94d1193ce2fb18bbaefc17adfe3cb77e9dec5b0d93a3412f8f8cd5c8` |
| YR completed state/export/verified replay, tick 739 | `53f7f95991b156969228cabe18c0de0088a36568b6bdfe21b19dfee1db479288` |

Each frozen build's browser-only request snapshot contains 23 total GETs: 22 successful
code/style requests and one favicon 404. Neither snapshot contains a non-GET request,
declared request body or unlisted asset endpoint. A subsequent separate HTTP audit
matches every one of the 65 served files to its frozen manifest and verifies
`connect-src 'none'`. These server-side observations are bounded to the recorded sessions;
they are not a packet capture of the computer. The audit requests are excluded from the
browser request counts. No retail content is served by these launchers.

Private source geometry, identifiers, saves, images and probe output remain under ignored
`local/infantry-browser/`; source probes remain in the worker's ignored local directory.
Prior immutable browser builds are preserved. Other browser families remain deferred
under the owner's Chrome-first development decision. Full mission objectives, triggers,
campaign progression, cinematics, native walk/fire/death animation, corpse artwork,
bridge movement and unrestricted combat remain outside this acceptance.

## Provenance

The app helper, UI copy and original tests are WebRA2 contributor work under
[the application GPL notice](../apps/web/PROVENANCE.md). Source-derived slot selection and
occupancy evidence belong to the reviewed
[infantry passage notice](../packages/sim/INFANTRY_PASSAGE_PROVENANCE.md); terrain semantics
belong to the [ground traversal notice](../packages/content/TERRAIN_TRAVERSAL_GROUND_PROVENANCE.md).
The existing distribution already copies those notices. No new third-party code or binary
is adopted by this application change.
