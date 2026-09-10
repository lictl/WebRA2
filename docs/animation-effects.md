# Animation gameplay-effect closure

State: **WORKING** under [#146](https://github.com/lictl/WebRA2/issues/146), supporting
the [combat adapter](https://github.com/lictl/WebRA2/issues/132). This checkpoint
records the accepted API and initial static investigation. No compiler or
presentation-only proof is implemented yet.

The proposed `compileAnimationEffects({weapons,definitions,rules,art},limits?)`
requires genuine weapon and entity definitions. It joins the weapon's entity
fingerprint and the entity's rules/art source pins to exact retained source views.
Its immutable, versioned result will retain animation root histories, exact loaded
fields and raw origins, bounded reference edges, and per-root classification as
presentation-only, gameplay-active, unknown or unsupported. Field absence is not
proof of harmlessness. A declared source hash is not authentication of source
bytes; the caller must retain the verified local source session boundary.

The bounded work covers reachable weapon/warhead animation references and their
next/spawn/bounce/expiry/trailer descendants. Cycles, missing or case-ambiguous
definitions, unknown fields, incomplete allocation/load phases and unsupported
effects must remain explicit. It does not execute damage, create infantry, mutate
terrain, schedule animations or claim original campaign playability.

Initial pinned-image observations, still awaiting the final evidence ledger and
independent review:

- Both profiles register `[Animations]` before General and property loading.
  YR enumeration starts at `0x6728B0`; RA2 at `0x64C080`. Case-folded allocation
  preserves the first stored name; exact definition lookup remains separate.
- Animation property dispatch passes the global art INI, not the current rules
  file: YR `0x679A5D–0x679A84`, RA2 `0x6522BD–0x6522E4`. The dynamic list count
  is read again while loading, so references allocated during that pass can be
  visited. Weapon/projectile/warhead property passes occur afterward; later roots
  must not be retrospectively assigned an earlier art load.
- YR animation construction and loading are located at `0x427530` and `0x427D00`;
  RA2 counterparts are `0x424E30` and `0x425690`. Damage, spawning and conditional
  effect fields require native constructor/read/update evidence before a safe
  closure can be declared. `MakeInfantry` and particle fields are not assumed to
  share semantics across the two profiles.
- Dry impact animation selection also has a global override: YR compares the
  warhead pointer with `General.LightningWarhead` and can choose
  `General.WeatherConBoltExplosion`. Water/bridge/height conditions can select
  other global animations. These selection contexts must remain distinct from
  the eventual proof about a particular animation's effects.

Private research is retained in this worktree's ignored `local/native146/`.
The current exploratory ranges may include partial function boundaries; they are
not a published final ledger. See [provenance](../packages/content/ANIMATION_EFFECTS_PROVENANCE.md).

Next: finish both-profile source/load/default and update-path evidence, define the
narrow safe field policy, implement the bounded compiler and original tests, then
independently compare both selected opening source projections. Public metadata,
full checks and independent exact-head review are required before merge.
