// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic VXL records, coordinates and palette; no retail geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeVxl, RUNTIME_VXL_LIMITS, RuntimeVxlError } from '../../packages/formats/src/runtime-vxl.ts';
interface Section { x: number; y: number; z: number; columns: (number[] | null)[]; name?: string; normal?: number }
const specs: Section[] = [
  { x: 2, y: 2, z: 4, name: 'body', normal: 4, columns: [[0, 1, 0, 255, 1, 2, 1, 2, 3, 1], null, [1, 2, 4, 5, 6, 7, 2, 1, 0, 0], [4, 0, 0]] },
  { x: 1, y: 1, z: 255, name: 'rotor', normal: 2, columns: [[254, 1, 8, 9, 1]] },
];
function fixture(sections: Section[] = specs, gap = 0) {
  const parts: Uint8Array[] = [], footers: number[][] = []; let bodySize = 0;
  for (const section of sections) {
    const n = section.x * section.y; assert.equal(section.columns.length, n);
    const size = 8 * n + gap * 2 + section.columns.reduce((v, c) => v + (c?.length ?? 0), 0), part = new Uint8Array(size), v = new DataView(part.buffer);
    const end = n * 4 + gap, data = end + n * 4 + gap; let at = data;
    section.columns.forEach((column, i) => {
      v.setInt32(i * 4, column ? at - data : -1, true);
      if (column) { part.set(column, at); at += column.length; }
      v.setInt32(end + i * 4, column ? at - data - 1 : -1, true);
    });
    parts.push(part); footers.push([bodySize, bodySize + end, bodySize + data]); bodySize += size;
  }
  const body = 802 + sections.length * 28, footer = body + bodySize, bytes = new Uint8Array(footer + sections.length * 92), v = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('Voxel Animation\0')); v.setUint32(16, 1, true); v.setUint32(20, sections.length, true); v.setUint32(24, sections.length, true); v.setUint32(28, bodySize, true); v.setUint16(32, 0x1f10, true);
  for (let i = 34; i < 802; i++) bytes[i] = (i - 34) % 256;
  let at = body; for (const part of parts) { bytes.set(part, at); at += part.length; }
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]!, h = 802 + i * 28, f = footer + i * 92;
    bytes.set(new TextEncoder().encode(s.name ?? 'part'), h); v.setInt32(h + 16, i, true); v.setUint32(h + 20, 1, true);
    footers[i]!.forEach((n, j) => v.setInt32(f + j * 4, n, true)); v.setFloat32(f + 12, 0.5, true);
    for (let j = 0; j < 12; j++) v.setFloat32(f + 16 + j * 4, j % 5 === 0 ? 1 : 0, true);
    v.setUint32(f + 20, 0x80000000, true);
    [-1, -2, -3, 1, 2, 3].forEach((n, j) => v.setFloat32(f + 64 + j * 4, n, true)); bytes.set([s.x, s.y, s.z, s.normal ?? 4], f + 88);
  }
  return { bytes, view: v, body, footer, bodySize, footers };
}
test('multisection columns decode exact coordinate/color/normal records, zero colors and maximum Z', () => {
  const f = fixture(), file = createRuntimeVxl(f.bytes);
  assert.equal(file.sections.length, 2); assert.equal(file.columnCount, 5); assert.equal(file.voxelCount, 5); assert.equal(file.runCount, 6);
  assert.deepEqual([...file.decodeSection(0).voxels], [0, 0, 0, 0, 255, 0, 0, 3, 2, 3, 0, 1, 1, 4, 5, 0, 1, 2, 6, 7]);
  assert.deepEqual([...file.decodeSection(1).voxels], [0, 0, 254, 8, 9]);
  assert.equal(file.sections[0]!.normalTable, 'ra2-4'); assert.equal(file.sections[1]!.normalTable, 'ts-2');
  assert.equal(file.span(0, 1).range, null); assert.equal(file.sections[0]!.emptyColumns, 1);
  assert.deepEqual([file.span(0, 3).start, file.span(0, 3).endInclusive, file.span(0, 3).range!.size], [20, 22, 3]);
  assert.equal(file.allocations.allGeometryBytes, 25); assert.equal(file.sourceIdentity, 'not-hashed');
});
test('explicit offsets support nonadjacent tables and preserve uninterpreted header, palette, name and float bits', () => {
  const f = fixture(specs, 3); f.view.setUint16(32, 0x1234, true); f.view.setInt32(818, 77, true); f.bytes[802] = 255; f.bytes[f.footer + 91] = 7;
  const file = createRuntimeVxl(f.bytes), s = file.sections[0]!;
  assert.equal(file.unclaimedBodyBytes, 12); assert.equal(file.unclaimedBodyRanges, 4); assert.equal(file.paletteWord, 0x1234);
  assert.equal(s.name.ascii, null); assert.equal(s.name.bytes[0], 255); assert.equal(s.sectionId, 77);
  assert.equal(s.transform.bits[1], 0x80000000); assert.ok(Object.is(s.transform.values[1], -0));
  assert.deepEqual(s.bounds.values, [-1, -2, -3, 1, 2, 3]); assert.equal(s.scale.values[0], 0.5);
  assert.equal(s.normalTable, 'unsupported'); assert.ok(file.diagnostics.some(d => d.code === 'unsupported-normal-table'));
  assert.deepEqual([...file.copyPalette().slice(0, 4)], [0, 1, 2, 3]);
  assert.deepEqual(file.decodeSection(0).voxels, createRuntimeVxl(fixture().bytes).decodeSection(0).voxels);
});
test('fixed snapshots and independently owned geometry/palette resist mutation and stale index substitution', () => {
  const f = fixture(), backing = new Uint8Array(f.bytes.length + 8); backing.set(f.bytes, 3);
  const file = createRuntimeVxl(backing.subarray(3, f.bytes.length + 3)), first = file.decodeSection(0), expected = new Uint8Array(first.voxels);
  backing.fill(0); first.voxels.fill(99); file.copyPalette().fill(99);
  assert.deepEqual(file.decodeSection(0).voxels, expected); assert.equal(file.copyPalette()[0], 0);
  for (const item of [file, file.sections, file.sections[0], file.sections[0]!.name.bytes, file.sections[0]!.transform.bits, file.span(0, 0).range]) assert.ok(Object.isFrozen(item));
  assert.throws(() => { (file.sections[0] as { voxelCount: number }).voxelCount = 0; }, TypeError);
  for (const n of [-1, NaN, 0.5, 2]) assert.throws(() => file.decodeSection(n), /vxl-section-index/);
  assert.throws(() => file.span(0, 4), /vxl-column-index/);
});
test('empty sentinel columns and boundary dimensions have no fabricated occupied cells', () => {
  const columns: (number[] | null)[] = Array(255).fill(null); columns[254] = [0, 1, 0, 0, 1];
  const file = createRuntimeVxl(fixture([{ x: 255, y: 1, z: 1, columns }]).bytes);
  assert.equal(file.sections[0]!.emptyColumns, 254); assert.deepEqual([...file.decodeSection(0).voxels], [254, 0, 0, 0, 0]);
  const empty = createRuntimeVxl(fixture([{ x: 1, y: 1, z: 1, columns: [null] }]).bytes);
  assert.equal(empty.decodeSection(0).voxels.length, 0); assert.equal(empty.voxelCount, 0);
});
test('header/count/size/nonfinite variants and truncation fail before coordinate allocation', () => {
  const f = fixture();
  for (const length of [0, 801, 802, f.body - 1, f.footer, f.bytes.length - 1]) assert.throws(() => createRuntimeVxl(f.bytes.slice(0, length)), RuntimeVxlError);
  for (const [offset, value, code] of [[0, 0, 'signature'], [16, 2, 'unsupported-header'], [20, 0, 'section-limit'], [20, 257, 'section-limit'], [24, 1, 'section-counts'], [28, 0xffffffff, 'file-size'],
    [f.footer + 12, 0x7f800000, 'nonfinite-float'], [f.footer + 16, 0x7fc00001, 'nonfinite-float'], [f.footer + 64, 0xff800000, 'nonfinite-float']] as const) {
    const b = new Uint8Array(f.bytes); new DataView(b.buffer).setUint32(offset, value, true); assert.throws(() => createRuntimeVxl(b), new RegExp(code));
  }
  const empty = new Uint8Array(f.bytes); empty[f.footer + 88] = 0; assert.throws(() => createRuntimeVxl(empty), /empty-dimensions/);
});
test('table/span offsets, inclusive-end bounds, aliases and cross-section overlaps fail closed', () => {
  const f = fixture();
  for (const mutate of [
    (v: DataView) => v.setInt32(f.footer, -1, true),
    (v: DataView) => v.setInt32(f.footer + 4, f.bodySize, true),
    (v: DataView) => v.setInt32(f.footer + 8, f.bodySize + 1, true),
    (v: DataView) => v.setInt32(f.body, -2, true),
    (v: DataView) => v.setInt32(f.body + 16, f.bodySize, true),
    (v: DataView) => v.setInt32(f.body + 20, 0, true), // Empty start with nonempty end.
    (v: DataView) => { v.setInt32(f.body + 4, 0, true); v.setInt32(f.body + 20, 9, true); }, // Alias first span.
    (v: DataView) => v.setInt32(f.footer + 4, 0, true), // Start/end tables overlap.
    (v: DataView) => v.setInt32(f.footer + 92, 0, true), // Cross-section table overlap.
  ]) { const b = new Uint8Array(f.bytes); mutate(new DataView(b.buffer)); assert.throws(() => createRuntimeVxl(b), RuntimeVxlError); }
});
test('span run state machine rejects zero progress, overflow, mismatched count, truncation and trailing data', () => {
  const cases = [[[0, 0, 0], 'zero-progress'], [[4, 1, 1, 2, 1], 'z-overflow'], [[5, 0, 0], 'z-overflow'], [[0, 4, 1, 2, 4], 'truncated-run'],
    [[3, 1, 1, 2, 0], 'repeat-count'], [[4, 0, 0, 77], 'span-trailing-bytes'], [[0, 1, 1, 2, 1], 'truncated-run']] as const;
  for (const [column, code] of cases) assert.throws(() => createRuntimeVxl(fixture([{ x: 1, y: 1, z: 4, columns: [[...column]] }]).bytes), new RegExp(code));
});
test('aggregate column/voxel/run/input budgets and native typed-array checks cannot be bypassed', () => {
  const f = fixture();
  for (const options of [{ fileBytes: f.bytes.length - 1 }, { sections: 1 }, { columns: 4 }, { voxels: 4 }, { runs: 5 }, { columns: RUNTIME_VXL_LIMITS.columns + 1 }, { runs: NaN }, { other: 1 }]) assert.throws(() => createRuntimeVxl(f.bytes, options));
  const exact = createRuntimeVxl(f.bytes, { fileBytes: f.bytes.length, sections: 2, columns: 5, voxels: 5, runs: 6 }); assert.equal(exact.voxelCount, 5);
  const accessor = Object.defineProperty({}, 'voxels', { get() { throw Error('must not read'); } }); assert.throws(() => createRuntimeVxl(f.bytes, accessor), /vxl-limits/);
  const shadow = new Uint8Array(RUNTIME_VXL_LIMITS.fileBytes + 1); Object.defineProperty(shadow, 'byteLength', { value: 802 }); assert.throws(() => createRuntimeVxl(shadow), /vxl-input-size/);
  assert.throws(() => createRuntimeVxl(new Uint8Array(new SharedArrayBuffer(802))), /vxl-input-size/);
  assert.throws(() => createRuntimeVxl(Buffer.from(f.bytes)), /vxl-input/);
  const resizing = Reflect.construct(ArrayBuffer, [802, { maxByteLength: 1604 }]) as ArrayBuffer; assert.throws(() => createRuntimeVxl(new Uint8Array(resizing)), /vxl-input-size/);
});
