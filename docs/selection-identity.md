# Durable world identity across file selections

[Issue #134](https://github.com/lictl/WebRA2/issues/134) fixes a save-portability
failure discovered during actual Chrome world-UI acceptance. The same installed
files yielded identical entities, definitions and navigation grids, but different
world fingerprints. The terrain-traversal hash included `assets[].source.root.sourceId`,
a catalog handle assigned from the current file-selection order. Thus a later
selection could reject a valid save despite identical content.

Policy `webra2-flat-terrain-2` removes only that session handle from the canonical
asset header. The owned audit result still includes it, and same-session conflicting
root identities still fail validation. The fingerprint continues to bind logical
asset IDs and paths, verified root size/SHA-256, member offset/size/SHA-256, source
layers, cells, factor histories and all movement records. Source verification and
navigation behavior are unchanged. Catalog handles remain valid session handles;
they are not repurposed as persistent content identities.

The policy change intentionally changes traversal, adapter and model hashes. Old
development policy-1 saves remain rejected by the existing model identity check.
No migration weakens that guard or guesses whether old immutable content matched.

## Verification

Two additional original traversal tests reverse resource/choice enumeration and
rename session handles while asserting identical hashes and movement classes.
They also retain audit handles and root-conflict rejection, prove that changed
verified bytes, logical paths, physical root hashes/ranges change the fingerprint,
and reject stale byte hashes. All 12 focused tests and the integrated 625-test
check pass; types, documentation, publication/M0 guards and the code-only build pass.

The private probe constructs genuine file-backed catalogs for all 438 selected
installation files, first in normal order, then reversed. Each run performs fresh
verified profile/map/TMP/rules reads and compiles definitions, footprints, traversal
and the world. Complete exported projections of world/definitions/placements,
commands, moving checkpoints, restored terminal state and replay are equal for
both profiles. All 811/570 placements and 1,108/1,478 footprint cells remain
accounted for; checkpoint progress is 7,680/10,240 and terminal tick is 122.

| Policy-2 private identity | RA2 opening | YR opening |
| --- | --- | --- |
| Traversal SHA-256 | `9c7b71856263a771c49034b2c3ed2fc47b659122b73d2ec40ebb29f0c2d1a663` | `7f4df00682377a8c28c0bee574854404cb669a3d3c946bd3c345b72eca02a077` |
| Adapter SHA-256 | `ab12455599ad530bf0c59758302fa0158b57f73cc710f648914158c4abe16a5b` | `b732c8aeadf9abd0651276ee1ce63e76fed214bea7e6be193b2fcc1ef4779e09` |
| World model SHA-256 | `fc6d08a841b9460777ec7f6eb46a924cfb45879e38cf9bcf70e31869a892033e` | `eade1c1a47973815741a3a966947b225b5cc1baed963093b726498b6e844ab92` |
| Replay terminal SHA-256 | `c0fde179891b084aa990e94debd857d7373f9606f87c76b04ac7b30b87e2456e` | `7734158505ac5dc967a8eec70a0b33e9105f277f3e8969ae4286bc37915d16c4` |

Private scripts `local/world-content/identity-{normal,reversed}.mjs` and outputs
`local/selection-identity/` retain the reproduction. No retail source, projections,
saves or recordings are published. This is an actual-content component comparison;
final four-browser save acceptance belongs to
[world UI #127 / PR #128](https://github.com/lictl/WebRA2/pull/128). Pre-fix Chrome
evidence and frozen server4175 are preserved separately. No original campaign
playability or native movement timing is claimed.
