// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
import { inspectCombatPlacement } from '../../packages/sim/src/combat-placement.ts';
function row(kind: 'infantry' | 'unit', tail: string, profile: 'ra2' | 'yr' = 'ra2') {
  const s = '[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,3,2\n[Houses]\n0=Blue\n[Blue]\nCountry=Country\n' +
    (kind === 'infantry' ? '[Infantry]\n0=Blue,Walker,256,2,2,2,Guard,0,None,' : '[Units]\n0=Blue,Rover,256,2,2,0,Guard,None,') + tail + '\n';
  return compileScenarioObjects({ profile, source: { id: 'map', profile, sha256: createHash('sha256').update(s).digest('hex') },
    bytes: new TextEncoder().encode(s) }).placements[0]!;
}
test('both profiles retain ordinary rank, group and independent recruitment flags without executing AI', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const a = inspectCombatPlacement(row('infantry', '0,-1,0,1,0', profile));
    const b = inspectCombatPlacement(row('unit', '0,4,0,-1,0,1', profile));
    assert.equal(a.status, 'ordinary-ground'); assert.equal(a.rankPercent, 0); assert.equal(a.group, -1);
    assert.equal(a.recruitableA, true); assert.equal(a.recruitableB, false);
    assert.equal(b.status, 'ordinary-ground'); assert.equal(b.group, 4); assert.equal(b.followerIndex, -1);
    assert.equal(b.recruitableA, false); assert.equal(b.recruitableB, true);
    assert(Object.isFrozen(a.reasons)); assert(Object.isFrozen(b));
  }
});
test('veterancy, bridge and follower state cannot silently enter ordinary combat', () => {
  assert(inspectCombatPlacement(row('infantry', '100,-1,0,1,1')).reasons.includes('initial-veterancy'));
  assert(inspectCombatPlacement(row('infantry', '0,-1,1,1,1')).reasons.includes('initial-bridge-layer'));
  assert(inspectCombatPlacement(row('unit', '0,-1,0,3,1,1')).reasons.includes('initial-follower-link'));
  assert(inspectCombatPlacement(row('unit', '0,-1,0,$FFFFFFFF,1,1')).reasons.includes('unsupported-native-row-integer'));
});
test('missing/empty/oversized tail input preserves unsupported native framing', () => {
  for (const tail of ['0,-1,0', '0,,0,1,1', '0,-1,0,1,1,0', '0,-1,0,1,' + '1'.repeat(128)]) {
    const p = inspectCombatPlacement(row('infantry', tail)); assert.equal(p.status, 'unsupported'); assert(p.reasons.length);
  }
  const p = inspectCombatPlacement(row('infantry', '0,-1,0,1,1 ; ignored comment'));
  assert.equal(p.status, 'ordinary-ground');
});
