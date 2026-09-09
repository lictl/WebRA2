// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Entirely original miniature scenarios.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioObjects, SCENARIO_OBJECT_LIMITS, type ScenarioObjectsInput } from '../../packages/content/src/scenario-objects.ts';
const text = `[Basic]
NewINIFormat=4
Player=HouseA
[Map]
Size=0,0,3,2
[Houses]
2=HouseB
0=HouseA
[HouseA]
Country=CountryA
Allies=HouseA,HouseB
UnimplementedHouseValue= original , tokens
[HouseB]
Country=CountryB
[Waypoints]
26=2002
0=1003
[Tags]
TAG=0,Original label,TRIGGER
[TeamTypes]
0=TEAM
[TEAM]
Waypoint=A
TransportWaypoint=AA
UseTransportOrigin=no
UnimplementedTeamValue=retained in input, outside this slice
[Infantry]
8= HouseA , INF ,128,3,1,2,Guard,64,TAG,100,-1,0,1,0 ; untouched comment, tail
[Units]
3=HouseA,TANK,256,2,2,255,Move,None,0,-1,0,-1,1,0
[Aircraft]
1=HouseA,PLANE,64,1,3,0,Guard,None,0,-1,0,1
[Structures]
5=HouseA,HQ,0,3,2,128,TAG,1,0,1,0,0,None,None,None,0,0
[Terrain]
1003=TREE
[Smudge]
7=MARK,1,3,0
`;
function input(body = text, profile: 'ra2' | 'yr' = 'ra2'): ScenarioObjectsInput {
  return { profile, source: { id: 'original-fixture.map', profile, sha256: 'a'.repeat(64) }, bytes: new TextEncoder().encode(body) };
}
const compile = (body = text) => compileScenarioObjects(input(body));
test('all six placement prefixes preserve raw fields and share the terrain storage axes', () => {
  const result = compile();
  assert.deepEqual(result.placements.map(p => [p.kind, p.x, p.y, p.strengthRaw, p.facingRaw, p.subcellRaw]), [
    ['infantry', 3, 1, 128, 64, 2], ['unit', 2, 2, 256, 255, null], ['aircraft', 1, 3, 64, 0, null],
    ['structure', 3, 2, 0, 128, null], ['terrain', 3, 1, null, null, null], ['smudge', 1, 3, null, null, null],
  ]);
  const first = result.placements[0]!;
  assert.equal(first.projectedColumn, 4); assert.equal(first.projectedRow, 0); assert.ok(first.insideDiamond);
  assert.deepEqual(first.row.tokens.slice(0, 3), [' HouseA ', ' INF ', '128']);
  assert.deepEqual(first.row.values.slice(0, 3), ['HouseA', 'INF', '128']);
  assert.equal(first.row.origin.rawValue, ' HouseA , INF ,128,3,1,2,Guard,64,TAG,100,-1,0,1,0 ; untouched comment, tail');
  assert.equal(first.row.origin.line, text.split('\n').findIndex(line => line.startsWith('8=')) + 1);
  assert.equal(first.row.origin.keySpelling, '8'); assert.equal(first.row.origin.sectionSpelling, 'Infantry');
  assert.deepEqual(first.unsupportedFields, [9, 10, 11, 12, 13]);
  assert.deepEqual(result.placements[5]!.unsupportedFields, [3]);
  assert.equal(result.placementsComplete, true); assert.equal(result.nativeBehaviorVerified, false); assert.equal(result.runtimeTypeResolution, 'unresolved');
  assert.equal(result.policy, 'webra2-objects-1'); assert.equal(result.iniPolicy, 'webra2-ini-1');
});
test('literal house, tag and encoded waypoint declarations join without assigning country selectors or activating teams', () => {
  const result = compile();
  assert.deepEqual(result.houses.map(h => [h.row.key, h.name, h.definitionPresent]), [['0', 'HouseA', true], ['2', 'HouseB', true]]);
  assert.deepEqual(result.waypoints.map(w => [w.number, w.x, w.y]), [[0, 3, 1], [26, 2, 2]]);
  assert.ok(result.references.filter(r => r.targetKind === 'country').every(r => r.status === 'external' && r.targetId === null));
  assert.deepEqual(result.references.filter(r => r.targetKind === 'waypoint').map(r => [r.raw, r.targetId, r.condition]), [['A', 'waypoints:0', null], ['AA', 'waypoints:26', 'use-transport-origin']]);
  assert.equal(result.references.find(r => r.field === 'player')!.targetId, 'houses:0');
  assert.equal(result.references.find(r => r.rowId === 'infantry:8' && r.field === 'owner')!.targetId, 'houses:0');
  assert.equal(result.references.find(r => r.rowId === 'units:3' && r.field === 'tag')!.status, 'none');
  assert.ok(result.referenceRows.some(r => r.key === 'UseTransportOrigin' && r.values[0] === 'no'));
  assert.ok(result.uncompiledSections.some(s => s.section === 'team' && s.rows === 1));
  assert.ok(result.houses[0]!.fields.some(r => r.key === 'UnimplementedHouseValue' && r.tokens[0] === ' original '));
});
test('out-of-diamond objects/waypoints and unknown tails or subcells remain present with explicit diagnostics', () => {
  const result = compile(text.replace('128,3,1,2,Guard', '128,0,0,200,Guard').replace('26=2002', '26=511511').replace('7=MARK,1,3,0', '7=MARK,1,3,0,extension'));
  assert.equal(result.placements.length, 6); assert.equal(result.placements[0]!.subcellRaw, 200); assert.equal(result.placements[0]!.insideDiamond, false);
  assert.equal(result.waypoints[1]!.insideDiamond, false);
  assert.equal(result.placements[5]!.row.values[4], 'extension');
  for (const code of ['outside-diamond-placement', 'outside-diamond-waypoint', 'unsupported-infantry-subcell', 'nonstandard-placement-field-count']) assert.ok(result.diagnostics.some(d => d.code === code));
});
test('malformed mandatory typed fields fail atomically rather than skipping a placement', () => {
  for (const [before, after] of [
    ['HouseA,TANK,256', 'HouseA,TANK,257'], ['HouseA,TANK,256', 'HouseA,TANK,-1'], ['128,3,1,2', '128,512,1,2'],
    ['128,3,1,2', '128,3.5,1,2'], ['128,3,1,2', '128,3px,1,2'], ['128,3,1,2', '128,1e2,1,2'],
    ['128,3,1,2', '128,-0,1,2'], ['128,3,1,2', '128,3,1,256'], ['Guard,64,TAG', 'Guard,256,TAG'],
    ['26=2002', '26=512000'], ['26=2002', '26=1999'], ['1003=TREE', '1999=TREE'], ['1003=TREE', '9007199254740993=TREE'],
    ['7=MARK,1,3,0', '7=MARK,1'], ['HouseA,TANK', 'HouseA,'], ['NewINIFormat=4', 'NewINIFormat=3'], ['Size=0,0,3,2', 'Size=1,0,3,2'],
  ]) assert.throws(() => compile(text.replace(before!, after!)), /objects-/, `${before} -> ${after}`);
});
test('duplicate and numeric-alias row identities or repeated declarations cannot silently overwrite content', () => {
  for (const suffix of ['[Infantry]\n8=HouseA,OTHER,256,3,1,2,Guard,64,None', '[Units]\n03=HouseA,OTHER,256,2,2,0,Guard,None',
    '[Houses]\n1=housea', '[Houses]\n0=Other', '[Waypoints]\n00=1003', '[Tags]\ntag=0,Other,T',
    '[HouseA]\nCountry=Other', '[TeamTypes]\n1=team', '[TEAM]\nWaypoint=B', '[Map]\nSize=0,0,3,2']) {
    assert.throws(() => compile(text + suffix), /objects-(duplicate|aliased)/);
  }
  // Duplicate coordinates are not duplicate identities; occupation belongs downstream.
  assert.equal(compile(text + '[Waypoints]\n99=1003').waypoints.length, 3);
});
test('dangling declarations and unsupported waypoint encodings are retained, not interpreted as zero or success', () => {
  const result = compile(text.replace('Player=HouseA', 'Player=MissingHouse').replace('Country=CountryB', '').replace('[HouseB]', '[Other]')
    .replace('TransportWaypoint=AA', 'TransportWaypoint=AAA').replace('Waypoint=A\n', 'Waypoint=ZZ\n').replace('Guard,64,TAG', 'Guard,64,MissingTag'));
  assert.ok(result.diagnostics.some(d => d.code === 'missing-house-definition'));
  assert.equal(result.references.find(r => r.field === 'player')!.status, 'missing');
  assert.equal(result.references.find(r => r.field === 'waypoint')!.status, 'missing');
  assert.equal(result.references.find(r => r.field === 'transportwaypoint')!.status, 'unsupported');
  assert.equal(result.placements[0]!.tag, 'MissingTag');
  assert.equal(result.references.find(r => r.rowId === 'infantry:8' && r.field === 'tag')!.status, 'missing');
  const conflict = compile(text + '[Tags]\nNone=0,Original,TRIGGER');
  assert.equal(conflict.references.find(r => r.rowId === 'units:3' && r.field === 'tag')!.status, 'unsupported');
});
test('hostile section names are ordinary symbols and every result is detached, frozen and deterministic', () => {
  const body = text.replaceAll('HouseA', '__proto__').replaceAll('HouseB', 'constructor').replaceAll('CountryA', 'toString');
  const data = input(body), table = compileScenarioObjects(data), expected = JSON.stringify(table); data.bytes.fill(0);
  assert.equal(JSON.stringify(table), expected); assert.equal(JSON.stringify(compileScenarioObjects(input(body))), expected);
  assert.deepEqual(table.houses.map(h => h.name), ['__proto__', 'constructor']);
  assert.equal(table.references.find(r => r.field === 'player')!.status, 'resolved');
  for (const value of [table, table.source, table.placements, table.placements[0], table.placements[0]!.row.tokens, table.houses[0]!.fields, table.references[0], table.diagnostics]) assert.ok(Object.isFrozen(value));
  assert.throws(() => (table.placements as unknown[]).pop(), TypeError);
});
test('wrong profiles, accessors, shared buffers and unsafe cap overrides fail before decoding', () => {
  assert.throws(() => compileScenarioObjects({ ...input(), profile: 'yr', bytes: new Uint8Array(0) }), /objects-profile/);
  assert.equal(compileScenarioObjects(input(text, 'yr')).profile, 'yr');
  let calls = 0; const data = input(); Object.defineProperty(data, 'bytes', { get() { calls++; return new Uint8Array(0); } });
  assert.throws(() => compileScenarioObjects(data), /objects-input/); assert.equal(calls, 0);
  assert.throws(() => compileScenarioObjects({ ...input(), bytes: new Uint8Array(new SharedArrayBuffer(4)) }), /ini-byte-source/);
  for (const options of [{ objects: SCENARIO_OBJECT_LIMITS.objects + 1 }, { fields: Infinity }, { rows: -0 }, { unexpected: 1 }]) assert.throws(() => compileScenarioObjects(input(), options), /objects-limits/);
});
test('input, rows, field counts/lengths, retained text, object/reference and diagnostic caps are enforced', () => {
  for (const options of [{ inputBytes: 8 }, { rows: 4 }, { objects: 5 }, { houses: 1 }, { waypoints: 1 }, { tags: 0 }, { teams: 0 },
    { fieldsPerRow: 13 }, { fields: 8 }, { fieldCharacters: 3 }, { retainedCharacters: 100 }, { references: 1 }, { diagnostics: 0 }]) assert.throws(() => compileScenarioObjects(input(), options));
  assert.throws(() => compile(text.replace('7=MARK,1,3,0', '7=MARK,1,3,' + ','.repeat(1000))), /objects-field-limit/);
  assert.throws(() => compile(text.replace('7=MARK,1,3,0', '7=MARK,1,3,' + 'x'.repeat(4097))), /objects-field-length/);
});
test('missing placement sections are empty, while numeric identifiers may have gaps and retain spelling', () => {
  const base = '[Map]\nSize=0,0,3,2\n[Basic]\nNewINIFormat=4\n';
  assert.equal(compile(base).placements.length, 0);
  const result = compile(base + '[Smudge]\n100=MARK,3,1,0\n0002=MARK,2,2,0');
  assert.deepEqual(result.placements.map(p => p.row.key), ['0002', '100']);
  assert.equal(result.placements[0]!.row.origin.keySpelling, '0002');
  assert.deepEqual(compile(base + '[Other]\nValue=first\nValue=second').uncompiledSections, [{ section: 'other', rows: 2 }]);
});
