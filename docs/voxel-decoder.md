# Runtime VXL geometry and HVA transforms

[Issue #90](https://github.com/lictl/WebRA2/issues/90) adds bounded runtime readers
for voxel geometry and animation matrices. They decode the player's supplied
bytes locally; they do not render voxels, choose a palette/normal table, match VXL
and HVA sections, animate objects or establish native campaign behavior.
Both implementations and tests are GPL-3.0-or-later; exact sources and differences
are recorded in [VOXEL_PROVENANCE.md](../packages/formats/VOXEL_PROVENANCE.md).

## Runtime API and ownership

```ts
import { createRuntimeVxl } from '../packages/formats/src/runtime-vxl.ts';
import { createRuntimeHva } from '../packages/formats/src/runtime-hva.ts';

const model = createRuntimeVxl(vxlBytes);
const part = model.decodeSection(0);
// part.voxels: owned Uint8Array records [x,y,z,colorIndex,normalIndex], stride 5.
const paletteBytes = model.copyPalette(); // 768 unmodified RGB bytes.
const column = model.span(0, 0); // start/end-inclusive/range or explicit empty.

const animation = createRuntimeHva(hvaBytes, { layout: 'frame-major' });
const transform = animation.transform(0, 0);
// transform.values: owned Float32Array, 12 row-major entries (3 rows × 4 columns).
// transform.bits: owned Uint32Array, exact original IEEE-754 words.
```

The two constructors capture fixed ordinary `Uint8Array` snapshots, including
subarray offsets, before reading file metadata. Native byte length/buffer getters
prevent shadowed properties from bypassing limits. Shared/resizable backing memory
and typed-array subclasses are unsupported. No parsed caller index authorizes a
later source. These readers do not hash inputs and explicitly report
`sourceIdentity: 'not-hashed'`; expected-hash verification belongs to the caller's
[verified source session](browser-verified.md).

Metadata and small numeric/name arrays are frozen. Every geometry, palette or
transform call returns new owned typed arrays, so modifying one cannot affect a
later call. The caller owns object/output lifetime; repeated calls or retained
copies are outside the per-instance/per-output allocation caps. No dense voxel
volume or whole-animation float array is allocated. VXL retains its source plus
bounded section metadata; the temporary range-sort buffer can be collected after
construction. HVA retains its source and at most 256 section names.

The output includes game payload and is **not publication-safe**. Tests/reports
must explicitly project numeric counts, source ranges and hashes; voxel records,
palettes, section-name bytes and matrix values stay on-device or under ignored
`local/` for private analysis.

## VXL format and bounded interpretation

The accepted signature is the exact 16 bytes `Voxel Animation` followed by NUL.
The global header is 802 bytes; each physical section header is 28 bytes and its
footer is 92 bytes. Header word 1 must equal 1, section header/footer counts must
match, and declared body plus headers/footers must exactly fill the input.
Nonstandard section IDs/header words and the raw two-byte palette word remain
metadata with diagnostics; they do not reorder sections or authorize pointers.

The footer's three offsets address start, end and data regions relative to the
global body. Start/end tables contain `sizeX * sizeY` signed 32-bit offsets.
`(-1,-1)` is an empty column. Other spans require nonnegative start and inclusive
end, wholly within the body. All start/end tables and occupied span ranges must
be disjoint, including across sections. Aliased spans/tables are unsupported.
Nonadjacent tables are supported; gaps are counted as unclaimed body bytes/ranges.

For each column, a run contains one skip byte, one count byte, `count` pairs of
color/normal bytes, and the same count byte again. Each run must advance Z. Skips
and voxels must stay within the section height, repeated counts must agree, and
finishing the height must exactly consume the inclusive span range. A terminal
skip with zero count is valid. Truncation, overlap, zero progress, Z overflow,
inconsistent empty markers and trailing span bytes fail with explicit errors.
Construction preflights **all** spans before any geometry output allocation.

Records are emitted in section-local `y`, then `x`, then increasing `z` order.
All color and normal bytes, including color zero, are retained. Axis dimensions
are bytes from 1 to 255, so occupied coordinates are 0–254. This is sparse geometry;
it does not assert that color zero should be opaque or transparent when rendered.

Section names retain all 16 bytes plus a nullable printable-ASCII interpretation.
Scale, footer transform and six bounds floats retain both values and raw 32-bit
words, including negative zero. Nonfinite float variants are unsupported. No
normalization, inverse, axis flip, scale, translation or bound repair is applied.
Normal type 2/4 is labeled using the OpenRA enum (`ts-2`/`ra2-4`); other values are
explicitly `unsupported`, while raw geometry/normal indices remain available.
Normal-vector expansion, index validity against a chosen table and lighting are
subsequent renderer policy, not part of this decoder.

## HVA ordering and transforms

The 24-byte header is followed by 16 bytes per section name and 48 bytes per
frame/section matrix. Counts must be nonzero, within caps, and exactly account for
the file size. The identifier is retained rather than treated as a magic string.
Names are never used to select a VXL section; duplicate raw names and non-ASCII
names are diagnosed without changing their order.

The input has no layout tag, and the primary implementations disagree:

| Caller interpretation | Physical matrix index | Evidence |
| --- | --- | --- |
| `frame-major` | `frame * sectionCount + section` | Pinned OpenRA and Voxel Section Editor |
| `section-major` | `section * frameCount + frame` | Pinned XCC accessor/writer |

The interpretation is required and copied at construction; there is no automatic
layout detection. Both expose the same raw row-major 3×4 float records under the
selected index formula. `nativeLayoutVerified: false` stays visible. This API
does not claim that both represent supported native encodings. A native comparison
or other direct evidence is still needed before assigning a universal policy to
multiframe, multisection mods. The observed supplied cases below have one frame and
one section, where both formulas are identical.

Each result includes its physical record index/byte offset, twelve exact raw words
and twelve float32 values. Nonfinite entries fail at construction. Singular finite
matrices, including all-zero matrices, remain decodable; this component neither
inverts them nor applies them to geometry. It makes no claim about native animation
timing, body/turret/barrel matching, world-space transforms or interpolation.

## Limits and validation

Limits can be lowered but not raised. Unknown/accessor option fields fail.

| Resource | VXL | HVA |
| --- | --- | --- |
| Input bytes | 16 MiB | 16 MiB |
| Sections | 256 | 256 |
| Aggregate columns | 1,048,576 | Not applicable |
| Aggregate occupied voxels / runs | 4,194,304 each | Not applicable |
| Frames / matrices | Not applicable | 4,096 / 65,536 |
| Coordinate output | Five bytes per voxel; all sections total at most 20 MiB | Not applicable |
| Per transform output | Not applicable | 48 bytes raw words + 48 bytes float32 values |

Before span traversal, VXL checks section/column counts and all physical ranges.
Its numeric interval-sort work buffer is eight bytes per possible column plus two
table intervals per section, at most 8,392,704 bytes. This is temporary work memory;
reported allocation counts are not process RSS measurements or promises about JS
object overhead. Aggregate run/voxel caps prevent repeated small spans from
expanding without bound. Geometry calls rewalk only a preflighted section in a
private immutable source, with an exactly sized output. HVA counts/file length are
checked before per-matrix inspection. These synchronous CPU readers are intended
for worker integration; they do not introduce browser permissions or I/O.

Public checks with the repository's Node 24 toolchain:

```sh
node --import tsx --test tests/formats/runtime-vxl.test.ts tests/formats/runtime-hva.test.ts
npm run check
git diff --check
```

Thirteen original synthetic tests cover multiple sections/frames, distinct matrix
ordering, zero/maximum coordinates, empty and terminal spans, exact float bits,
malformed counts/offsets/runs, snapshot ownership, unknown metadata and aggregate
budgets. No retail geometry or transforms are fixtures.

## Private supplied-file comparison

A separate Python oracle independently rehashes the two source roots, seeks each
pinned member range, decodes until each inclusive span end, then checks Z and sorts
the resulting coordinate records. It reads transform words directly with Python
`struct`. A TypeScript comparison asserts every decoded byte/word, palette byte
and raw section name against that oracle. All **128,600 voxel records** and
**403 scale/transform/bounds words** match across **13 VXL and 13 HVA members**.
The metadata-only private report SHA-256 is
`9e95a02611bcf9908ea5880aee3e3d5f1c0dca37b35e02dbf8cc0a554c248f32`.

A further bounded header survey used all 234 VXL/HVA request names already in
[dependency candidates](analysis/dependency-candidates.json). It found 108 physical
members; all VXL sections and HVA frame/section counts were one. No extra layout
evidence was obtained. The multisection/multiframe gate is therefore synthetic,
not a claimed private native-animation pass. No game program was executed.

Private replay files in the author/reviewer worktree's ignored `local/` are
`extract-voxel.ts`, `oracle.py`, `verify.ts`, `candidates.json`, `oracle.json` and
`verified-metadata.json`; `survey-closure.ts` records the bounded follow-up. Run
`python3 local/oracle.py` then `node --import tsx local/verify.ts` only when those
private inputs and authorized local roots exist. Missing private inputs are a
skipped private gate, not a passing test. Full source/member identities follow;
no decoded geometry, matrices, palettes or section-name payload is published.

Root **R** is `ra2.mix`, SHA-256
`896a8b64f9f1bb8ad5e0bc64fc0b8ea8c84112494761ea1a43478d10c5ef9914`.
Root **M** is `ra2md.mix`, SHA-256
`69d886defad9114dd440a013b364c8c004e369b5221d1889957b49d00058559d`.

| VXL candidate | Root | Absolute offset | Bytes | Voxels | Member SHA-256 |
| --- | --- | --- | --- | --- | --- |
| `mtnk.vxl` | R | 124091584 | 41073 | 6354 | `fe82e553014591635d708e30d1b5088aad4c621ec820fe7c330c052bb188cf77` |
| `mtnktur.vxl` | R | 124137856 | 12119 | 1360 | `1f16b4ba31c910e791d7db894c33a1554afe0918fd51df8d814000c4af672a4c` |
| `mtnkbarl.vxl` | R | 124132672 | 5177 | 443 | `fba8930030b65873227b4e1bab29af286f0ab588ddac6ae2a4e6e73f53050822` |
| `htnk.vxl` | R | 124149984 | 34550 | 4816 | `0ca8517c29f8bed26c3a3f0138bb36bae01fbb751fc9eaa30bfa1fba352923a2` |
| `htnktur.vxl` | R | 124186464 | 11694 | 1501 | `4fc6ca0efb803621ae4dc99357f81eb4bc524cc70a90e386831fa0e63a416451` |
| `harv.vxl` | R | 124983840 | 50469 | 10726 | `b51aa74470b8495d9484a8085c88624ce53116dac20ba886b89bbe251913503a` |
| `cmin.vxl` | R | 125139392 | 55059 | 11942 | `f9ab81a01eb3019e62f0eb2aa68d19b4cb25290b5886b491d020aa9bd2784e9c` |
| `dred.vxl` | R | 122479344 | 116773 | 20494 | `857eff8b607610bd4600466554839d36e4407940c247b9d08aee4c14ac546a1a` |
| `zep.vxl` | R | 122096896 | 177637 | 35841 | `29d1b0812553fb09889f41481b8315c65740b09b11d6c799e03562f6a91de1ba` |
| `orca.vxl` | R | 125823360 | 16420 | 1918 | `e8cdad73fc1cca4db1229ae4a9423ae47cfe85e8cf5ad761c3eab98392f8a579` |
| `bfrt.vxl` | M | 9000480 | 112098 | 21958 | `8fccb3c58c4c4e391dc438d8c75e97e5fc4dc0d16b92582bbc14ba9eaa37493b` |
| `sref.vxl` | R | 124451280 | 50277 | 9716 | `fa3e79d7e457d9368a77998f5de743e9559bbeb11b917a805aa8f4ee76cad979` |
| `robo.vxl` | M | 9112592 | 14605 | 1531 | `1bb13bf3223c4765b1d66b2898a9a28485b8e656c4fcd2fdd0fa954285e6b4b5` |

| HVA candidate (one frame/section) | Root | Absolute offset | Bytes | Member SHA-256 |
| --- | --- | --- | --- | --- |
| `mtnk.hva` | R | 127159840 | 88 | `bbc8b8d4cdadc47627fdc955fcc6d30e6844bb736f3b81bfd2f0298b06c39396` |
| `mtnktur.hva` | R | 127160032 | 88 | `7b89493e80659f917c4785849ad14e0e550283323b8f0149a4b571db76b528fa` |
| `mtnkbarl.hva` | R | 127159936 | 88 | `7b89493e80659f917c4785849ad14e0e550283323b8f0149a4b571db76b528fa` |
| `htnk.hva` | R | 127160128 | 88 | `16f3cd28642a66b1a0dc3f6cb4b063889c9f4721e46f12054fd60ed88cdc32ca` |
| `htnktur.hva` | R | 127160320 | 88 | `16f3cd28642a66b1a0dc3f6cb4b063889c9f4721e46f12054fd60ed88cdc32ca` |
| `harv.hva` | R | 127164448 | 88 | `6de96bd28d717ad4c4f51e36692a7f32f8f5e10836347fe7c4964e57f9da6581` |
| `cmin.hva` | R | 127164832 | 88 | `83acad38f7755df0a5197992df05b810e274704917279039e0f681d0aa900498` |
| `dred.hva` | R | 127156208 | 88 | `810dae94db5ae67cef0866897da63f20d3b8d36ff2b73769abc0f5664ff4a2fe` |
| `zep.hva` | R | 127155344 | 88 | `4d9feb87009d48a3bdd2b143fe410e785be149d93c1d0b6765d3edbc9dac82fa` |
| `orca.hva` | R | 127177792 | 88 | `fa1d8650f04d98c8438748d73e54edcaed781bec7739844c58f949ef2cd32103` |
| `bfrt.hva` | M | 10230096 | 88 | `5ce5108e541e25fa34f2d447f7ff3fd5351f8ebb0802dd45ccadb35ac159ab0f` |
| `sref.hva` | R | 127161568 | 88 | `bbc8b8d4cdadc47627fdc955fcc6d30e6844bb736f3b81bfd2f0298b06c39396` |
| `robo.hva` | M | 10230192 | 88 | `5cdbd478ec4396c99bfe470785dea9a7cfe9ecf61fa93249045ddb5d273bd221` |
