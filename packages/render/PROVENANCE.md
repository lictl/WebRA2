# Terrain scene provenance

`src/terrain-scene.ts`, its original fixtures and the composing browser terrain view
are GPL-3.0-or-later. Copyright 2026 WebRA2 contributors; slot-relative TMP placement
and extra color/depth composition are informed by OpenRA Developers and Contributors.

Primary implementation reference: OpenRA revision
`f3ec7f8e1593b482f85fd101652deb740c33dee6`,
[TmpTSLoader.cs](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Cnc/SpriteLoaders/TmpTSLoader.cs).
[The scene specification](../../docs/terrain-scene.md) lists the additional pinned
OpenRA sprite/depth references and distinguishes their behavior from WebRA2's
integer CPU depth/tie policy. The compositor uses the existing
[TMP decoder](../formats/TMP_PROVENANCE.md) and MIT-licensed
[hash implementation](../vfs/HASH_PROVENANCE.md).

Local changes include explicit verified source snapshots and caller choices,
separate diamond coverage, bounded viewport allocation/work, CPU palette/depth
composition and private visible-owner picking. No retail pixels, palettes or map
geometry are included. Native lighting, remap and rendering fidelity are unverified.

The selected-frame SHP extension has a separate [sprite layer notice](SPRITE_PROVENANCE.md)
covering its pinned references, explicit placement/remap policies and original fixtures.
Both notices accompany the development build.

The [GPLv3 license text](../../LICENSES/GPL-3.0-or-later.txt) and this notice accompany
the development bundle. A distributed combined program must include corresponding
source and preserve its component notices; the repository's MIT license does not
relicense GPL-derived rendering. No new runtime dependency is introduced.
