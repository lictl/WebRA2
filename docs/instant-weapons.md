# Flat instant-weapon context

Issue [#145](https://github.com/lictl/WebRA2/issues/145) adds a source-bound context
component for both RA2 and Yuri's Revenge. It does not enable firing. The ordinary
weapon, actor, animation, death, target-authorization and scheduling gates remain
separate, explicit requirements. No original program was executed.

[compileInstantWeaponContexts](../packages/content/src/instant-weapons.ts) accepts
`{weapons, rules}`: genuine immutable `WeaponDefinitions` and a retained source INI
whose profile and every ordered source identity match those definitions. It returns
branded frozen records, interpreted flag origins, global current-default histories
and a deterministic fingerprint under `webra2-flat-instant-context-1`. That identity
includes source-stage IDs and is a component audit identity; a simulation/save
consumer must derive a selection-independent model identity.

`evaluateInstantWeaponContext(result, weaponId, context)` requires a current caller
snapshot. It returns `eligible-context` or `unsupported`, reasons, and—only when
eligible—zero range bonus, zero impact distance and the source-bound maximum damage.
`canExecute` is always false. The evaluator cannot authenticate a caller's claim
that its snapshot represents the real world. The world adapter must re-enumerate
occupants and recheck actor eligibility at firing/impact, rather than accept a
user-supplied list or cache a successful check.

The context is deliberately limited:

- Source and target are distinct, alive, stationary ground infantry/units. The
  target mode is an entity, and impact coordinates equal the target's damage
  coordinates exactly. Coordinates are native integer world units, not projected
  sprite positions. Binding logical world anchors to them remains a caller policy.
- The impact cell contains exactly the target. The complete list must include
  unknown, unsupported, stationary and other occupants; it must never filter those
  out to manufacture a singleton. Incomplete or extra occupancy rejects the context.
- All cells in the source-to-target rectangle plus a one-cell margin are present,
  dry, flat, at one level/floor height, without overlays or bridges. Both actor Z
  coordinates equal that floor height. Any unknown cell or special barrier rejects
  the context. This rectangle is a conservative WebRA2 sufficient condition; it is
  not a reproduction of the native path traversal or its corner selection.
- Projectile motion is invisible, non-arcing, zero-turn, ground-capable and within
  the named ordinary trajectory subset. Warhead CellSpread and CellInset are zero.
  Other projectile/weapon/warhead effects still require separate admission.

The six flag interpretations are grounded in the pinned native paths recorded in
[the provenance ledger](../packages/content/INSTANT_WEAPONS_PROVENANCE.md):

| Field | Established path and scoped result |
| --- | --- |
| SubjectToElevation | Firing range adds an elevation helper result. Equal levels produce zero with a valid positive ElevationIncrement and nonnegative finite bonus/cap. An absent model leaves native increment zero, so the true flag cannot silently accept that default. |
| SubjectToCliffs / SubjectToWalls | Linear obstruction routines test cliff level changes and wall overlays, including additional corner/ownership conditions. The complete flat rectangle without overlays avoids those tests' obstacles; no general wall/cliff collision claim is made. |
| Wall / Wood | DamageArea can modify wall overlays. They are harmless to that overlay branch only under the explicit no-overlay premise. Ground and force-fire contexts remain unsupported. |
| Conventional | The damage-animation selector can substitute water splash animations. Dry ground avoids that branch; ordinary AnimList, special configured warhead substitutions and animation gameplay closure still apply. |

Zero CellSpread does **not** establish selected-target-only native damage. The
native path visits the impact cell's object list, computes distances, and dispatches
to qualifying objects. Its zero-radius table contains one offset `(0,0)`; normal
non-building distance is a truncated three-dimensional Euclidean distance. Exact
integer-coordinate equality is a sufficient zero-distance condition. Buildings,
air units, bridge layers and multiple objects have additional behavior and are
outside this evaluator.

Native `GetTotalDamage` skips radial interpolation at zero spread, applies the
armor factor and caps its result to `[CombatDamage] MaxDamage`, initialized to
1000 in fresh Rules objects. The helper preserves that source value and rejects
unsupported/nonpositive/over-budget values. The eventual combat core must apply
the cap at the evidenced stage; returning metadata alone is not implementation of
native damage. House/actor multipliers and armor modifiers are separate work under
[#147](https://github.com/lictl/WebRA2/issues/147).

Invisible launch sets a location without a distance-based flight delay and clears
speed; the examined YR Bullet AI still dispatches through Fire and Detonate. This
slice does not establish native insertion order, the exact initial impact tick or
reload jitter. A deterministic WebRA2 scheduling policy must be explicit until the
corresponding native schedule is implemented. YR infantry death can consult
per-type DeathAnims even for ordinary InfDeath values, before sequence fallback.
No death mode is labeled effect-free. Animation-effect closure remains
[#146](https://github.com/lictl/WebRA2/issues/146), with actor death roots explicitly
outside its initial firing/impact-root scope. These are implementation boundaries,
not requests for human observations or a claim that runtime comparison is complete.

## Bounds and verification

Inputs are descriptor-checked; arrays must be dense and plain. Duplicate cells or
occupants, accessors, unknown fields, forged compiler results, stale source IDs,
non-finite/negative-zero coordinates and excess limits reject. Defaults cap all
weapon/projectile/warhead records together at 8,192; INI source analysis uses the
existing 64-stage/262,144-occurrence/4,194,304-work limits. Output hashing streams
under a separate 32 MiB serialization cap. Context checks cap cells and occupants
at 4,096 each, and integer coordinates at 8,388,607. Caller limits may only lower
these caps. No filesystem, DOM, timer, random or network dependency is imported.

The full Node 24.20.0 check passes 695 public tests, type checking, 111 documents /
572 local links, publication/M0 guards and a 43-file build. Ten new original synthetic tests cover both profiles, globals/overrides, ambiguity,
trajectory exclusions, unsupported occupants, rectangle geometry, mode/actor
conditions, source/factory identity, malformed data and lower budgets. Run:

```sh
node --import tsx --test tests/content/instant-weapons.test.ts
npm run check
```

The separately labeled private probe reads verified supplied members, recompiles
entities/weapons from their raw inputs and compares a Python reconstruction of all
context fields and origins. It agrees on 85 RA2 records / 514 compared fields and
117 YR records / 706 fields. Respectively 43 and 63 records are **context-supported**;
none is thereby an executable weapon or a completed campaign. Both installations'
selected rules set MaxDamage to 10000 and the elevation increment/bonus/cap to
4/2/2. These values are observed inputs, never hardcoded runtime defaults.

Private commands in the isolated `local/worktrees/instant-weapons` tree:

```sh
node --import tsx local/probe.ts
python3 local/entity-oracle.py
python3 local/weapon-oracle.py
python3 local/context-oracle.py
../theater-tiles/local/venv/bin/python local/evidence.py
../theater-tiles/local/venv/bin/python local/native145/check-facts.py
```

The last two commands use the existing shared private Capstone 5.0.6 environment.
Only metadata is public; scripts, raw rows, full projections and native listings
remain ignored. The context projection SHA-256 values are
`8be7f85b13df8165ec0095a38dd876ee22c2e8129ad71ceaa2743cb55a5c3e38`
(RA2) and `002389cc039a95db252d3bc5a2ea152c90cd87e894371bc6918bef56086dad58`
(YR). Existing independent entity/weapon raw-source projections also agree; native
byte ranges are separately hash-checked and instruction-bounded.
