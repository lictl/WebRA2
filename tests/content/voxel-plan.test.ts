// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileVoxelPlan, isVoxelPlan, VOXEL_PLAN_LIMITS } from '../../packages/content/src/voxel-plan.ts';
import { voxelInput, voxelPlan } from './voxel.fixture.ts';

test('genuine rule/art stages produce immutable named body and ordinary optional attachments in both profiles', () => {
  for (const profile of ['ra2','yr'] as const) {
    const p = voxelPlan({ profile, rules: 'Turret=yes\n' });
    assert.equal(isVoxelPlan(p), true); assert.equal(isVoxelPlan(structuredClone(p)), false);
    assert.deepEqual(p.types[0]!.requests.map(r => [r.role,r.vxlPath,r.hvaPath,r.required,r.still]), [
      ['body','rover.vxl','rover.hva',true,true], ['turret','rovertur.vxl','rovertur.hva',false,true], ['barrel','roverbarl.vxl','roverbarl.hva',false,true] ]);
    assert.equal(p.types[0]!.status,'ready'); assert.equal(p.hvaLayout,'frame-major'); assert.equal(p.hvaFrame,0);
    assert.equal(p.placements.length,1); assert.ok(Object.isFrozen(p.types[0]!.fields[0]!.history));
    assert.equal(p.canStartCampaign,false); assert.equal(p.nativeBehaviorVerified,false);
  }
});
test('conditional alternatives remain fully named but cannot silently become a first turret or alternate body', () => {
  const p = voxelPlan({ profile:'yr',rules:'Turret=yes\nTurretCount=3\n' });
  assert.equal(p.types[0]!.status,'unsupported'); assert.equal(p.types[0]!.requests.length,7);
  assert.deepEqual(p.types[0]!.requests.filter(r=>r.role==='turret').map(r=>r.vxlPath), ['rovertur.vxl','rovertur1.vxl','rovertur2.vxl']);
  assert.ok(p.types[0]!.requests.filter(r=>r.role!=='body').every(r=>!r.still));
  const q=voxelPlan({rules:'NoSpawnAlt=yes\n'});assert.equal(q.types[0]!.requests[1]!.vxlPath,'roverwo.vxl');assert.equal(q.types[0]!.status,'unsupported');
  assert.equal(voxelPlan({rules:'Turret=yes\nTurretCount=3\nIsGattling=yes\n'}).types[0]!.requests.length,7);
  const g=voxelPlan({profile:'yr',rules:'Turret=yes\nTurretCount=3\nIsGattling=yes\n'});assert.equal(g.types[0]!.requests.length,3);
});
test('exact visited keys retain prior values, record provenance and reject unknown offset/mode semantics', () => {
  const p = voxelPlan({rules:'Turret=yes\n',ruleMods:['[ROVER]\nTurret=no\n'],artMods:['[ROVER]\nTurretOffset=2\n']});
  const turret=p.types[0]!.fields.find(f=>f.key==='Turret')!;
  assert.equal(turret.value,false);assert.deepEqual(turret.history.map(o=>o.layerId),['rules','rule-mod-0']);
  assert.equal(p.types[0]!.requests.length,1);assert.ok(p.types[0]!.reasons.includes('unsupported-attachment-offset'));
  assert.equal(voxelPlan({rules:'turret=yes\n'}).types[0]!.fields[0]!.value,false);
  for(const rules of ['Turret=unknown\n','TurretCount=19\n','AlternateArcticArt=yes\n']) assert.equal(voxelPlan({rules}).types[0]!.status,'unsupported');
});
test('complete source/definition/art joins, brands and limits precede publication', () => {
  const a=voxelInput(), b=voxelInput({rules:'Speed=8\n'});
  assert.throws(()=>compileVoxelPlan({...a,definitions:b.definitions}),/identity/);
  assert.throws(()=>compileVoxelPlan({...a,artPlan:voxelInput({art:'Remapable=yes\n'}).artPlan}),/identity/);
  assert.throws(()=>compileVoxelPlan({...a,definitions:structuredClone(a.definitions)}),/plan-input/);
  for(const cap of [{types:0},{placements:0},{requests:0},{fieldReads:0}])assert.throws(()=>compileVoxelPlan(a,cap),/limit/);
  assert.throws(()=>compileVoxelPlan(a,{types:VOXEL_PLAN_LIMITS.types+1}),/limit/);
  let invoked=false;assert.throws(()=>compileVoxelPlan(Object.defineProperty({...a},'objects',{get(){invoked=true;return a.objects;}})),/metadata/);assert.equal(invoked,false);
});
