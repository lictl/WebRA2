# Source-bound animation effect closure

`compileAnimationEffects({weapons,definitions,rules,art},lowerLimits?)` compiles the
animation references of a genuine weapon graph into a source-bound eligibility
report. This implements [#146](https://github.com/lictl/WebRA2/issues/146) for the
[combat adapter](https://github.com/lictl/WebRA2/issues/132). It does not execute
animations or make a campaign playable.

The immutable, branded result pins the entity and weapon fingerprints and every
rules/art layer. A copied object or JSON reconstruction cannot impersonate either
input factory. Rules, art, profiles and layer metadata must agree with the entity
and weapon inputs. Source hashes here are declared identities; the caller must
already have authenticated the underlying bytes, as the private probe does with
`createVerifiedSourceReader`.

Each weapon has an `ordinary-firing` Anim root; each warhead has an
`ordinary-impact` AnimList root. `lightning-warhead-impact` separately describes
WeatherConBoltExplosion. Roots retain effective references, all loaded source
histories, reachable IDs, classification and reasons. Animation records retain
allocation phase, first spelling, reference/load history, exact effect fields,
all consumed raw art origins and Next/Spawns/BounceAnim/ExpireAnim/TrailerAnim edges.
`isAnimationEffects` accepts only the same module's frozen compiler output.

## Native source and phase policy

Both pinned native initializers clear the animation list before registering the
first rules file's `[Animations]` entries in source order. Allocation compares IDs
without case and retains the first stored spelling; definition-section lookup is
exact. The initial registry supplies a bounded first-spelling proof. Conflicting
spellings and later or unregistered roots remain unknown: other global/entity
allocation paths and complete native indices are deliberately not reconstructed.

Each rules pass loads already allocated animation types from the **global art INI**
before the weapon/warhead properties. The native count is reread, so a child
allocated while an animation loads can be loaded in that same pass. A root first
allocated by a later weapon property waits for a later pass. The compiler preserves
that distinction. It supports one explicit global art source; multiple art stages
produce unknown closures until their native mutation order is established.

| Selector | RA2 namespace and phase | YR namespace and phase |
| --- | --- | --- |
| LightningWarhead | General, before property dispatch | General, before property dispatch |
| WeatherConBoltExplosion | AudioVisual, after property dispatch | General, before property dispatch |
| DropZoneAnim | AudioVisual, after property dispatch | General, before property dispatch |

The pointer-to-section-name bytes and call ordering were checked separately; the
fields must not be flattened into a shared General namespace. Fresh Rules
constructor zeros establish the three null initial selectors. Reused native Rules
objects and original save pointer state are outside this policy.

Anim/AnimList use a native 128-byte string buffer and comma-only tokenization.
Missing and empty values retain the previous vector; a nonempty list replaces it,
ignoring empty tokens and none selectors. The compiler rejects unsupported names
or strings longer than 127 characters rather than reproducing truncation.
Identifiers must be ASCII and at most 24 characters. Imported duplicate registry
keys/sections fail explicitly. Duplicate art sections/keys retain all origins and
block the affected record; no native duplicate tie policy is invented. The exact
source view still uses the documented `webra2-ini-1` retained normalization policy.

## Meaning of the classification

`presentation-only` means the covered ordinary animation instance has no active
or unresolved **covered gameplay-effect path** under this versioned policy. It is
not proof that the original animation produces no native state changes of any kind,
or that its image/sound is decoded. The presentation runtime must schedule its own
bounded visual/audio state without driving the authoritative simulation.

| State or field | Implemented policy |
| --- | --- |
| Damage | Native constructor 0, current-default float32-widen reader; positive values are gameplay-active. Negative or unsupported values block admission. |
| MakeInfantry | YR default -1; any other typed value enters an effect path. RA2 does not read this key. No infantry runtime is implemented. |
| SpawnsParticle / NumParticles | YR defaults -1 / 0. Named particle allocation is unsupported; nonzero counts block admission. RA2 does not read these keys. |
| Special animation flags | Flamer, Scorch, Crater, Sticky, Bouncer, meteor/vein/tiberium/flaming modes, PsiWarning and related enabled paths remain unknown. Smudge/overlay state and scenario RNG are not discarded. |
| RandomRate / RandomLoopDelay | Only the disabled zero RandomRate pair is typed; native reciprocal-rate conversion remains unsupported. Nonzero delay/rate choices block admission. Equal zero RNG endpoints do not advance the inspected scenario RNG. |
| Next, Spawns, bounce/expiry/trailer | All retained targets are traversed conservatively, including conditionally inactive descendants. Cycles block admission and traversal terminates. |
| DropZoneAnim identity | The animation constructor recognizes this global type and invokes map reveal. This is gameplay-active even with Damage=0. |
| Other fields and references | Unknown art keys, unresolved conversions/definitions, external warhead/tiberium references and unproven allocation phases block admission. Cosmetic loader keys remain raw metadata. |

The constructor/update/start/midpoint paths of both images support these gates;
headers provide layout hypotheses, not behavior proof. The full metadata ledger
and interpretation are in [provenance](../packages/content/ANIMATION_EFFECTS_PROVENANCE.md).

Callers must resolve the correct impact context. An ordinary AnimList proof does
not supersede the LightningWarhead pointer comparison and global override. Water,
height and bridge splash selection, actor DeathAnims and InfDeath sequences,
attached/extra animation instance state, sound-engine RNG, and ambient map or
superweapon effects are explicit excluded contexts. This component does not expose
an overall combat-admission or required-capability-complete flag.

## Bounds and verification

Lower-only limits cover 64 source stages, 262,144 retained occurrences, 8,192
allocated animations, 32,768 roots, 131,072 reference operations, 524,288 history
operations, 4,194,304 work units and 32,768 diagnostics. Source reconstruction has
2,000,000-node/64 MiB character limits per view. Expanded root reason strings share
a separate 64 MiB character budget; canonical serialization is capped at 64 MiB.
Checks run before list/record/history or graph expansion. Failure publishes no
partial result and never mutates a genuine input. The simulation, DOM, files and
wall clock are not dependencies of the compiler.

Original synthetic tests cover both profiles, identity/prototype/accessor attacks,
missing/duplicate/case-variant sources, native phase differences, current-default
list histories, all five descendant edge kinds, cycles, effects, unknown fields,
immutable deterministic results and resource failures. These checks do not use
retail fixtures.

The private probe rereads all six full-root/member hashes from the selected entity
source pins. A separate Python raw-INI oracle reconstructs every animation identity,
allocation/reference/load order, field value/status/origin/history, retained origin,
edge, root and classification. Its weapon seed is checked against the previously
independently verified policy-2 fingerprints; it does not recompute the weapon
compiler. Rule-description strings and the final canonical compiler fingerprint
are not used as substitutes for field comparisons.

| Selected source profile | Animation records / roots | Nonempty presentation-only / unknown roots | Compared scalar leaves | Independent projection SHA256 |
| --- | --- | --- | --- | --- |
| RA2 opening | 501 / 162 | 36 / 34 | 120,951 | `90c736f041222f1f55ecd485012ea8ee704491a9b64c1f4803ec21b8de861249` |
| YR opening | 611 / 229 | 58 / 39 | 149,749 | `cd1a3101f23e798228250c7ea8f8cb50cb6993c749e8c4526f5d6f021376bf81` |

There is also one unsupported reference root per profile. Including empty/default
roots, the state totals are RA2 125 presentation-only, 36 unknown, 1 unsupported;
YR 187 presentation-only, 41 unknown, 1 unsupported. These counts concern the
scoped typed weapon graph, not all native animation callers or playable weapons.
All raw sources, projections, native listings and oracle scripts remain private in
the implementation worktree's ignored `local/`.

Private reproduction from that worktree uses Node 24.20.0:

```sh
node --import tsx local/probe.ts
python3 local/animation-oracle.py
../theater-tiles/local/venv/bin/python local/native146/make-evidence.py
```

The last line uses the private Capstone 5.0.6 Python runtime in the sibling
worktree; it is not a public package/runtime requirement. Public validation is `npm run check` and the focused test is
`node --import tsx --test tests/content/animation-effects.test.ts`.

Remaining runtime work: context-aware combat admission, animation event scheduling,
actual effect execution, particle/death/splash closures, complete external allocation
semantics and original-game behavioral comparisons. None is silently treated as
implemented by a successful source proof.
