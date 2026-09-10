// SPDX-License-Identifier: GPL-3.0-or-later
// Original tiny source fixture shared by source and timing tests; no retail content.
import { createHash } from 'node:crypto';
import { compileRuntimeIni, type RuntimeIniLayer } from '../../packages/content/src/runtime-ini.ts';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
import { compileEntityDefinitions } from '../../packages/content/src/entity-definitions.ts';
import { compileCombatActors } from '../../packages/content/src/combat-actors.ts';
export const initialRules = '[Countries]\n0=Blue\n[InfantryTypes]\n0=Walker\n[VehicleTypes]\n0=Cart\n[Walker]\nStrength=20\nSpeed=3\nLocomotor={4A582744-9839-11d1-B709-00A024DDAFD1}\n[Cart]\nStrength=40\n';
export const initialMap = '[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,3,3\n[Houses]\n0=Commander\n[Commander]\nCountry=Blue\n[Infantry]\n0=Commander,Walker,256,2,2,0,Guard,0,None,0,-1,0,1,1\n[Units]\n0=Commander,Cart,256,2,1,0,Guard,None,0,-1,0,-1,1,1\n';
export const initialBytes = (s: string): Uint8Array => new TextEncoder().encode(s);
export const initialSha = (s: string): string => createHash('sha256').update(s).digest('hex');
export function initialFixture({profile='ra2' as 'ra2'|'yr', rulesText=initialRules, mapText=initialMap,
  artText='[Walker]\nFireUp=2\nFireProne=3\nSecondaryFire=4\nSecondaryProne=5\n', mods=[] as string[], artMods=[] as string[]}={}) {
  const layer = (text: string, id: string, order: number, kind: RuntimeIniLayer['kind']): RuntimeIniLayer =>
    ({ id, profile, order, kind, sourceSha256: initialSha(text), bytes: initialBytes(text) });
  const rules = compileRuntimeIni(profile,[layer(rulesText,'base',0,'base'),...mods.map((s,i)=>layer(s,`mod-${i}`,i+1,'mod')),layer(mapText,'map',100,'map')]);
  const art = compileRuntimeIni(profile,[layer(artText,'art',0,'base'),...artMods.map((s,i)=>layer(s,`art-${i}`,i+1,'mod'))]);
  const mission={source:{id:'original-map',profile,sha256:initialSha(mapText)},bytes:initialBytes(mapText)};
  const objects=compileScenarioObjects({profile,...mission}),definitions=compileEntityDefinitions({objects,rules,art});
  const actors=compileCombatActors({definitions,rules,mission});return {actors,definitions,rules,art,mission};
}
