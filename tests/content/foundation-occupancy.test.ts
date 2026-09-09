// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic maps/definitions. No retail fixtures or extracted cell arrays.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileEntityDefinitions } from '../../packages/content/src/entity-definitions.ts';
import { compileRuntimeIni } from '../../packages/content/src/runtime-ini.ts';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
import { compileFoundationOccupancy, isFoundationOccupancy, FOUNDATION_OCCUPANCY_LIMITS } from '../../packages/content/src/foundation-occupancy.ts';
const names = ['1x1', '2x1', '1x2', '2x2', '2x3', '3x2', '3x3', '3x5', '4x2', '3x3Refinery', '1x3', '3x1', '4x3', '1x4', '1x5', '2x6', '2x5', '5x3', '4x4', '3x4', '6x4', '0x0'];
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const bytes = (s: string) => new TextEncoder().encode(s);
function fixture({ profile = 'yr' as 'ra2' | 'yr', kind = 'structure', foundation = '2x3', body = 'Strength=10', artBody = '',
  rulesExtra = '', mapExtra = '', loaded = true } = {}) {
  const registry = kind === 'terrain' ? 'TerrainTypes' : kind === 'unit' ? 'VehicleTypes' : 'BuildingTypes';
  const rules = `[${registry}]\n0=BOX\n${loaded ? `[BOX]\n${body}\n` : ''}${rulesExtra}`;
  const map = `[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,8,8\n${mapExtra}`;
  const art = `[BOX]\n${foundation ? `Foundation=${foundation}\n` : ''}${artBody}`;
  const source = { id: 'original-map', profile, sha256: hash(map) };
  return compileEntityDefinitions({ objects: compileScenarioObjects({ profile, source, bytes: bytes(map) }),
    rules: compileRuntimeIni(profile, [{ id: 'rules', profile, order: 0, kind: 'base', sourceSha256: hash(rules), bytes: bytes(rules) },
      { id: 'map', profile, order: 1, kind: 'map', sourceSha256: source.sha256, bytes: bytes(map) }]),
    art: compileRuntimeIni(profile, [{ id: 'art', profile, order: 0, kind: 'base', sourceSha256: hash(art), bytes: bytes(art) }]) });
}
const compile = (options: Parameters<typeof fixture>[0] = {}) => compileFoundationOccupancy({ definitions: fixture(options) });
const shape = (r: ReturnType<typeof compile>) => r.types.find(t => t.typeId.endsWith(':box'))!;

test('both profiles expose every ordinary building shape, native order, the refinery gap and empty foundation', () => {
  for (const profile of ['ra2', 'yr'] as const) for (const foundation of names) {
    const r = compile({ profile, foundation }), t = shape(r);
    assert.equal(t.status, 'ready'); assert.equal(t.foundationIndex, names.indexOf(foundation));
    const rows = foundation === '3x3Refinery' ? ['###', '##.', '###'] : Array.from({ length: Number(foundation[2]) }, () => '#'.repeat(Number(foundation[0])));
    assert.deepEqual(t.cells, rows.flatMap((row, y) => [...row].flatMap((v, x) => v === '#' ? [{ x, y }] : [])));
    assert.equal(r.runtimeBlockingVerified, false); assert.equal(r.includesBib, false);
  }
});
test('terrain has its own index7 geometry and rejects all unterminated later rows without rectangle fallback', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const t = shape(compile({ profile, kind: 'terrain', foundation: '3x5' }));
    assert.equal(t.status, 'ready'); assert.equal(t.cells.length, 8);
    assert.deepEqual(t.cells.at(-1), { x: 3, y: 1 });
    for (const foundation of names.slice(8)) {
      const t = shape(compile({ profile, kind: 'terrain', foundation }));
      assert.equal(t.status, 'unsupported'); assert.deepEqual(t.cells, []); assert.deepEqual(t.reasons, ['unterminated-native-terrain-row']);
    }
  }
});
test('typed property history and terrain fallback prove loads; constructor-only enum does not prove a pointer', () => {
  const loaded = shape(compile({ foundation: '' }));
  assert.equal(loaded.status, 'ready'); assert.equal(loaded.loadEvidence, 'retained-field-history');
  const terrain = shape(compile({ kind: 'terrain', foundation: '', body: 'Name=Synthetic' }));
  assert.equal(terrain.status, 'ready'); assert.equal(terrain.loadEvidence, 'terrain-strength-load');
  const unproven = shape(compile({ foundation: '', body: 'Name=Synthetic' }));
  assert.equal(unproven.status, 'unsupported'); assert.deepEqual(unproven.cells, [{ x: 0, y: 0 }]);
  assert.deepEqual(unproven.reasons, ['foundation-pointer-initialization-unproven']);
  assert.equal(shape(compile({ loaded: false })).status, 'unsupported');
});
test('unsupported typed Foundation is preserved and mobile types are not given arbitrary single-cell masks', () => {
  const t = shape(compile({ foundation: 'Custom' })); assert.equal(t.status, 'unsupported'); assert.equal(t.foundationIndex, null);
  assert.deepEqual(t.cells, []); assert.ok(t.reasons.includes('unsupported-foundation-definition'));
  const m = shape(compile({ kind: 'unit' })); assert.equal(m.status, 'not-applicable'); assert.equal(m.loadEvidence, 'not-applicable'); assert.deepEqual(m.cells, []);
});
test('the native Image then nonzero type-ID foundation choice is inherited from genuine typed definitions', () => {
  const d = fixture({ body: 'Image=VISUAL\nStrength=10', foundation: '1x1', artBody: '[VISUAL]\nFoundation=3x3Refinery\n' });
  const r = compileFoundationOccupancy({ definitions: d }); assert.equal(shape(r).foundationIndex, 9); assert.equal(shape(r).cells.length, 8);
});
test('base masks keep asymmetric map-axis offsets across different placements/facing and retain overlaps', () => {
  const make = (face: number) => compile({ foundation: '1x3', mapExtra: `[Structures]\n0=Neutral,BOX,256,6,7,${face},None\n1=Neutral,BOX,256,6,8,0,None\n` });
  const a = make(0), b = make(128); assert.deepEqual(shape(a).cells, shape(b).cells);
  assert.equal(a.orientation, 'anchor-addition-without-facing-rotation');
  const mask = shape(a).cells;
  const translated = [7, 8].map(y => mask.map(c => [6 + c.x, y + c.y]));
  assert.deepEqual(translated, [[[6, 7], [6, 8], [6, 9]], [[6, 8], [6, 9], [6, 10]]]);
  assert.equal(a.types.length, b.types.length); assert.notEqual(a.sha256, b.sha256);
});
test('gates, bibs, walls and counter fields do not silently become a claim of full runtime blocking', () => {
  const r = compile({ body: 'Strength=10\nGate=yes\nWall=yes\nToTile=4', artBody: 'Bib=yes\nAddOccupy1=1,1\nRemoveOccupy1=0,0' });
  assert.equal(shape(r).status, 'ready'); assert.equal(shape(r).cells.length, 6);
  assert.equal(r.runtimeBlockingVerified, false); assert.ok(r.requiredRuntimeWork.includes('gate-state-and-wall-to-overlay-or-tile-conversion'));
  assert.ok(r.requiredRuntimeWork.includes('occupy-height-and-add-remove-occupy-counters'));
});
test('only genuine frozen typed-definition identities cross the input boundary; result masks and source are immutable', () => {
  const definitions = fixture(), r = compileFoundationOccupancy({ definitions });
  assert.equal(r.definitionsSha256, definitions.fingerprint); assert.deepEqual(r.source, definitions.source);
  assert.ok(isFoundationOccupancy(r)); assert.equal(isFoundationOccupancy(structuredClone(r)), false);
  assert.throws(() => compileFoundationOccupancy({ definitions: structuredClone(definitions) }), /definitions/);
  let calls = 0; assert.throws(() => compileFoundationOccupancy({ get definitions() { calls++; return definitions; } }), /definitions/); assert.equal(calls, 0);
  assert.throws(() => compileFoundationOccupancy({ definitions, extra: true } as never), /definitions/);
  assert.throws(() => { (shape(r).cells[0] as { x: number }).x = 99; }, TypeError);
  assert.throws(() => { (r.source as { id: string }).id = 'changed'; }, TypeError);
});
test('lower type/cell/serialization caps fail before returning any branded partial result', () => {
  const definitions = fixture();
  assert.throws(() => compileFoundationOccupancy({ definitions }, { types: 0 }), /type-limit/);
  assert.throws(() => compileFoundationOccupancy({ definitions }, { cells: 5 }), /cell-limit/);
  assert.throws(() => compileFoundationOccupancy({ definitions }, { serializedBytes: 1 }), /serialization-limit/);
  for (const options of [{ cells: -0 }, { types: 0.5 }, { cells: FOUNDATION_OCCUPANCY_LIMITS.cells + 1 }, { surprise: 1 }])
    assert.throws(() => compileFoundationOccupancy({ definitions }, options), /limit/);
  assert.equal(compileFoundationOccupancy({ definitions }, { cells: 6 }).sha256, compileFoundationOccupancy({ definitions }).sha256);
});
test('canonical digest uses an independently serialized owned projection and binds profile/source identity', () => {
  const r = compile(), { sha256, ...body } = r;
  const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ?
    Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical((v as Record<string, unknown>)[k])])) : v;
  assert.equal(sha256, hash(JSON.stringify(canonical(body))));
  assert.notEqual(sha256, compile({ profile: 'ra2' }).sha256);
  assert.equal(sha256, compile().sha256);
});
