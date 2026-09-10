// SPDX-License-Identifier: GPL-3.0-or-later
// Original source geometry and hostile inputs; no retail content.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
import { compileInitialWaypointSource as compile, resolveInitialWaypoint as resolve, isInitialWaypointSource } from '../../packages/content/src/initial-waypoints.ts';
const input = (profile: 'ra2' | 'yr', rows: string, header = '[Waypoints]') => {
 const bytes = new TextEncoder().encode(`[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,3,2\nLocalSize=0,0,3,2\nTheater=URBAN\n${header}\n${rows}\n`);
 return { profile, source: { id: 'original-map', profile, sha256: createHash('sha256').update(bytes).digest('hex') }, bytes };
};
test('all 702 decoded numeric keys retain metadata while initial execution follows the profile reader bound', () => {
 for (const profile of ['ra2', 'yr'] as const) {
  const source = input(profile, Array.from({length:702},(_,n)=>`${n}=3003`).join('\n')), catalog = compile(source);
  assert.equal(compileScenarioObjects(source).waypoints.length,702); assert.equal(catalog.rows.length,702); assert(isInitialWaypointSource(catalog));
  for (let n=0;n<=701;n++) {
   const result=resolve(catalog,n), supported=profile==='yr'||n<=100;
   assert.equal(result.status,supported?'supported-source':'unsupported');
   if(result.status==='supported-source'){assert.equal(result.waypoint.row.origin.sourceSha256,source.source.sha256);assert.deepEqual([result.waypoint.number,result.waypoint.x,result.waypoint.y],[n,3,3]);}
   else assert(result.reasons.includes('index-not-initially-loaded'));
  }
  assert.equal(catalog.dynamicWaypoints,false);assert.equal(resolve(catalog,702).status,'unsupported');
 }
});
test('canonical keys, zero sentinel, repeated exact headers, aliases and unsupported geometry fail closed',()=>{
 for (const profile of ['ra2','yr'] as const) {
  for(const [rows,header,reason] of [
   ['0=0','[Waypoints]','zero-invalid-sentinel'],['0=511511','[Waypoints]','outside-supported-map'],
   ['00=3003','[Waypoints]','noncanonical-key'],
   ['0=3003','[waypoints]','exact-section'],['0=3003\n[Waypoints]\n1=3003','[Waypoints]','repeated-exact-section'],
   ['0=3003','[Waypoints] ignored','normalized-section-suffix']]) {
   const source=input(profile,rows!,header!), c=compile(source),r=resolve(c,0);assert.equal(r.status,'unsupported');if(r.status==='unsupported')assert(r.reasons.includes(reason!));
   assert(compileScenarioObjects(source).waypoints.length>0); // These source rows still exist as metadata.
  }
  assert.throws(()=>compile(input(profile,'0=3003\n0=2002')),/duplicate/);
  assert.throws(()=>compile(input(profile,'0=3003\n00=3003')),/aliased/);
  const empty=compile(input(profile,'')),r=resolve(empty,0);assert.equal(r.status,'unsupported');if(r.status==='unsupported')assert(r.reasons.includes('missing-canonical-key'));
 }
});
test('source bytes and identities are owned; forged brands, mismatched hashes and resource expansion reject',()=>{
 const source=input('ra2','0=3003\n1=2002'),c=compile(source),pin=c.sha256;
 source.bytes.fill(0);source.source.sha256='f'.repeat(64);assert.equal(c.sha256,pin);assert.equal(resolve(c,0).status,'supported-source');
 assert(Object.isFrozen(c.rows[0]!.waypoint.row.origin));assert(!isInitialWaypointSource({...c}));assert.throws(()=>resolve({...c},0),/source-brand/);
 assert.throws(()=>compile(source),/source-hash/);
 const valid=input('ra2','0=3003\n1=2002');
 for(const cap of [{bytes:1},{rows:1},{work:0},{serializedBytes:1}])assert.throws(()=>compile(valid,cap));
 assert.throws(()=>compile({...valid,profile:'yr'}),/profile/);
 let getters=0;const hostile={...valid};Object.defineProperty(hostile,'bytes',{get(){getters++;return valid.bytes;},enumerable:true});assert.throws(()=>compile(hostile));assert.equal(getters,0);
 for(const n of [-0,-1,NaN,Infinity,0.5])assert.equal(resolve(c,n).status,'unsupported');
});
