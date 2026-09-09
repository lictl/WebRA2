// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic multisection/multiframe matrix bits; no retail transforms.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeHva, RUNTIME_HVA_LIMITS, RuntimeHvaError } from '../../packages/formats/src/runtime-hva.ts';
function fixture(frames = 3, sections = 2) {
  const data = 24 + sections * 16, bytes = new Uint8Array(data + frames * sections * 48), view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('synthetic')); view.setUint32(16, frames, true); view.setUint32(20, sections, true);
  for (let s = 0; s < sections; s++) bytes.set(new TextEncoder().encode('part' + s), 24 + s * 16);
  for (let n = 0; n < frames * sections; n++) for (let k = 0; k < 12; k++) view.setFloat32(data + n * 48 + k * 4, n * 16 + k + 0.25, true);
  view.setUint32(data, 0x80000000, true); return { bytes, view, data };
}
test('physical row-major matrices preserve exact float bits and explicit frame/section interpretations', () => {
  const f = fixture(), frame = createRuntimeHva(f.bytes, { layout: 'frame-major' }), section = createRuntimeHva(f.bytes, { layout: 'section-major' });
  assert.equal(frame.frameCount, 3); assert.equal(frame.sectionCount, 2); assert.equal(frame.matrixCount, 6);
  assert.equal(frame.transform(1, 0).record, 2); assert.equal(section.transform(1, 0).record, 1);
  assert.equal(frame.transform(2, 1).record, 5); assert.equal(section.transform(2, 1).record, 5);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) for (const file of [frame, section]) {
    const t = file.transform(j, i); assert.equal(t.offset, f.data + t.record * 48);
    for (let k = 0; k < 12; k++) { assert.equal(t.bits[k], f.view.getUint32(t.offset + k * 4, true)); assert.ok(Object.is(t.values[k], f.view.getFloat32(t.offset + k * 4, true))); }
  }
  assert.equal(frame.transform(0, 0).bits[0], 0x80000000); assert.ok(Object.is(frame.transform(0, 0).values[0], -0));
  assert.equal(frame.sourceIdentity, 'not-hashed'); assert.equal(frame.nativeLayoutVerified, false);
});
test('snapshot, names and per-call transform ownership cannot be changed by source or result mutation', () => {
  const f = fixture(), file = createRuntimeHva(f.bytes, { layout: 'frame-major' }), expected = file.transform(1, 1);
  f.bytes.fill(0); const changed = file.transform(1, 1); changed.bits.fill(0); changed.values.fill(0);
  assert.deepEqual(file.transform(1, 1).bits, expected.bits); assert.deepEqual(file.transform(1, 1).values, expected.values);
  assert.equal(file.identifier.ascii, 'synthetic'); assert.equal(file.sectionNames[1]!.ascii, 'part1');
  for (const item of [file, file.sectionNames, file.sectionNames[0], file.sectionNames[0]!.bytes]) assert.ok(Object.isFrozen(item));
  assert.throws(() => { (file.sectionNames[0] as { ascii: string }).ascii = 'other'; }, TypeError);
});
test('duplicate/non-ASCII names stay raw and singular finite matrices are preserved without inverse/world-space claims', () => {
  const f = fixture(); f.bytes.fill(0, 24, 56); f.bytes[24] = 255; f.bytes[40] = 255; f.bytes.fill(0, f.data);
  const file = createRuntimeHva(f.bytes, { layout: 'frame-major' });
  assert.equal(file.sectionNames[0]!.ascii, null); assert.equal(file.sectionNames[0]!.bytes[0], 255);
  assert.ok(file.diagnostics.some(d => d.code === 'duplicate-raw-section-name' && d.count === 1));
  assert.ok(file.diagnostics.some(d => d.code === 'non-ascii-section-name' && d.count === 2));
  assert.deepEqual([...file.transform(0, 0).values], Array(12).fill(0));
});
test('layout, dimensions, matrix counts, truncation, trailing data and nonfinite transforms fail explicitly', () => {
  const f = fixture();
  for (const length of [0, 23, 24, f.data - 1, f.bytes.length - 1]) assert.throws(() => createRuntimeHva(f.bytes.slice(0, length), { layout: 'frame-major' }), RuntimeHvaError);
  const trailing = new Uint8Array(f.bytes.length + 1); trailing.set(f.bytes); assert.throws(() => createRuntimeHva(trailing, { layout: 'frame-major' }), /hva-file-size/);
  for (const [at, value, code] of [[16, 0, 'frame-limit'], [20, 0, 'section-limit'], [16, 4097, 'frame-limit'], [20, 257, 'section-limit'], [f.data, 0x7f800000, 'nonfinite'], [f.data + 4, 0x7fc00001, 'nonfinite']] as const) {
    const b = new Uint8Array(f.bytes); new DataView(b.buffer).setUint32(at, value, true); assert.throws(() => createRuntimeHva(b, { layout: 'frame-major' }), new RegExp(code));
  }
  for (const interpretation of [{}, { layout: 'guess' }, { layout: new String('frame-major') }, { layout: 'frame-major', extra: 1 }]) assert.throws(() => createRuntimeHva(f.bytes, interpretation as never), /hva-layout/);
  const accessor = Object.defineProperty({}, 'layout', { get() { throw Error('must not read'); } }); assert.throws(() => createRuntimeHva(f.bytes, accessor as never), /hva-layout/);
});
test('input/matrix budgets, view offsets and hostile byte metadata retain the actual snapshot boundary', () => {
  const f = fixture();
  for (const cap of [{ fileBytes: f.bytes.length - 1 }, { sections: 1 }, { frames: 2 }, { matrices: 5 }, { matrices: RUNTIME_HVA_LIMITS.matrices + 1 }, { frames: NaN }, { extra: 1 }]) assert.throws(() => createRuntimeHva(f.bytes, { layout: 'frame-major' }, cap));
  const backing = new Uint8Array(f.bytes.length + 9); backing.set(f.bytes, 4);
  const file = createRuntimeHva(backing.subarray(4, 4 + f.bytes.length), { layout: 'frame-major' }, { fileBytes: f.bytes.length, sections: 2, frames: 3, matrices: 6 });
  assert.equal(file.transform(2, 1).record, 5);
  for (const [frame, section] of [[-1, 0], [NaN, 0], [0.5, 0], [3, 0], [0, 2]]) assert.throws(() => file.transform(frame!, section!), RuntimeHvaError);
  const shadow = new Uint8Array(RUNTIME_HVA_LIMITS.fileBytes + 1); Object.defineProperty(shadow, 'byteLength', { value: 24 }); assert.throws(() => createRuntimeHva(shadow, { layout: 'frame-major' }), /hva-input-size/);
  assert.throws(() => createRuntimeHva(new Uint8Array(new SharedArrayBuffer(24)), { layout: 'frame-major' }), /hva-input-size/);
  assert.throws(() => createRuntimeHva(Buffer.from(f.bytes), { layout: 'frame-major' }), /hva-input/);
  const resizing = Reflect.construct(ArrayBuffer, [24, { maxByteLength: 48 }]) as ArrayBuffer; assert.throws(() => createRuntimeHva(new Uint8Array(resizing), { layout: 'frame-major' }), /hva-input-size/);
});
