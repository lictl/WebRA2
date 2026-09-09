# Explicit content profile resolver

`src/profile.ts` is a browser-capable, synchronous TypeScript metadata resolver.
It has no runtime imports, I/O, clocks, random state, DOM or Node dependencies.
It accepts hashes and ranges already verified by an importer; it does not hash,
decode or open game files. This is one bounded part of the future VFS.

```ts
import { createProfileResolver } from './src/profile.ts';

const profile = createProfileResolver('ra2', layers);
const rules = profile.resolve('RULES.INI');
const gate = profile.require(['rules.ini', 'art.ini']);
```

Each layer has an explicit `id`, `profiles`, integer `rank`, descriptive `kind`,
`rankEvidence`, and assets. Each asset independently declares its profile scope,
one or more name-evidence records, and a complete `AssetSource`. Shared assets must
explicitly list both profiles; a layer cannot widen an asset's scope. Profile
identification is the importer's responsibility. Mislabeling YR bytes as RA2 cannot
be detected from a hash alone. There is no auto mode based on installed filenames.

Higher rank overrides lower rank. Layer kind, input order, filename, locale and
archive number never supply an implicit priority. An explicit WebRA2 configuration
could assign base `0`, patch `10`, loose `20`, and ordered mods `100`, `101`.
Those numbers illustrate policy, not original-game precedence. Equal ranks with
different content hashes block selection. Equal hashes and sizes keep every
physical source in `selected`; no single source is declared the native winner.

`resolved` means an unambiguous top candidate has literal filename evidence.
`candidate` means all top names are inferred from hashes. `ambiguous` retains all
contenders without selected bytes; `missing` has no candidate in this profile.
Multiple distinct names on one physical entry represent an unresolved name/hash
collision, not aliases. They block selection even when all bytes match. Collisions
in shadowed layers remain in diagnostics and alternatives. Explicit alias support
is deferred. All evidence and original root filename spelling are preserved.

`require` reports complete only for a nonempty set of resolved identities. This
checks exactly the requested names; it never proves dependency closure, mission
playability, original precedence, checksum acceptance or localization readiness.
Outputs are copied and deeply frozen, with explicit code-unit sorting. Keep
source IDs stable and unique across layers. Duplicate IDs, contradictory byte
identities, invalid hashes/ranges and profile inconsistencies fail construction.

Logical paths use NFC, ASCII case folding and slash normalization, including
Windows backslashes. CJK and well-formed supplementary Unicode are retained.
Empty/dot segments, traversal, absolute/drive/URL syntax, URL-encoded paths,
controls, Windows device names and ambiguous trailing dots/spaces are rejected.
The policy is deliberately stricter than a native filesystem. Do not join a
logical path directly to a host path; a future adapter must bind source IDs to
verified File/Blob handles and enforce symlink/origin boundaries independently.

Hard limits: 512 layers, 250,000 assets, 500,000 name-evidence records, 16 names
per asset, 4,096 required names, 512 path code units and 32 path segments. Limits
may be tightened. Byte hashing, canonical content fingerprints, archive mounting,
storage, import UI and native-order selection remain outside this component.

Run `node tools/run-tests.mjs tests/vfs` from the repository root on Node 24.20.0.
The tests use original synthetic metadata, not retail fixtures. See the
[profile evidence report](../../docs/analysis/profile-resolution.md) and
[provenance notice](PROVENANCE.md).
