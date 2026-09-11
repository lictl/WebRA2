// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature source corpus. No retail placements, rules or assets.
import { createHash } from 'node:crypto';
import { teamSpawnFixture } from './team-spawn-fixture.ts';
import { compileRuntimeIni } from '../../packages/content/src/runtime-ini.ts';
import { createIniSourceView } from '../../packages/content/src/ini-source-view.ts';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
import { compileScenarioTerrain } from '../../packages/content/src/scenario-terrain.ts';
import { compileEntityDefinitions } from '../../packages/content/src/entity-definitions.ts';
import { compileCombatActors } from '../../packages/content/src/combat-actors.ts';
import { compileFoundationOccupancy } from '../../packages/content/src/foundation-occupancy.ts';
import { compileTerrainTraversal } from '../../packages/content/src/terrain-traversal.ts';
import { compileWorldContent } from '../../packages/sim/src/world-content.ts';
import { compileInfantryPassageCatalog } from '../../packages/sim/src/infantry-passage-catalog.ts';
import { WorldSimulation } from '../../packages/sim/src/world.ts';
import { initialInfantrySlots, type InfantryOccupancyInput } from '../../packages/sim/src/infantry-passage-occupancy.ts';
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const bytes = (s: string) => new TextEncoder().encode(s);
export const infantryRow = (id: number, x: number, y: number, slot: number, owner = 'Commander', tail = 'Guard,0,None,0,-1,0,1,1') =>
  `${id}=${owner},Walker,256,${x},${y},${slot},${tail}`;
export function infantryPassageFixture({ profile = 'ra2' as 'ra2' | 'yr', rows = [infantryRow(0, 2, 2, 2), infantryRow(1, 2, 3, 4)],
  allies = 'Rival', reverse = '', extraMap = '', extraRules = '', extraArt = '', speed = 128,
  mapTransform = (s:string)=>s, rulesTransform = (s:string)=>s } = {}) {
  const original = teamSpawnFixture({ profile, infantryRows: rows.join('\n'), extraMap, extraRules, extraArt, speed });
  const map = bytes(mapTransform(new TextDecoder().decode(original.mission.bytes).replace('[Commander]\nCountry=Blue', `[Commander]\nCountry=Blue\nAllies=${allies}`)
    .replace('[Rival]\nCountry=Red', `[Rival]\nCountry=Red\nAllies=${reverse}`)));
  const base = bytes(rulesTransform(`[Countries]\n0=Blue\n1=Red\n[Clear]\nFoot=1\n[InfantryTypes]\n0=Walker\n[Walker]\nStrength=100\nSpeed=${speed}\nLocomotor={4A582744-9839-11D1-B709-00A024DDAFD1}\n${extraRules}`));
  const artBytes = bytes('[Original]\nValue=1\n' + extraArt);
  const source = { id: 'map', profile, sha256: hash(map) }, mission = { source, bytes: map };
  const rules = compileRuntimeIni(profile, [{ id: 'base', profile, kind: 'base', order: 0, sourceSha256: hash(base), bytes: base },
    { id: 'map', profile, kind: 'map', order: 1, sourceSha256: source.sha256, bytes: map }]);
  const art = compileRuntimeIni(profile, [{ id: 'art', profile, kind: 'base', order: 0, sourceSha256: hash(artBytes), bytes: artBytes }]);
  const definitions = compileEntityDefinitions({ objects: compileScenarioObjects({ profile, ...mission }), rules, art });
  const actors = compileCombatActors({ definitions, rules, mission }), terrain = compileScenarioTerrain({ profile, ...mission });
  const tile = new Uint8Array(1872), view = new DataView(tile.buffer);
  for (const [at, value] of [[0, 1], [4, 1], [8, 60], [12, 30], [16, 20], [32, 952], [56, 2]]) view.setUint32(at!, value!, true);
  const digest = hash(tile), contentIdentity = { profile, manifestSha256: 'a'.repeat(64), rulesSha256: 'b'.repeat(64), orderedModHashes: [] };
  const traversal = compileTerrainTraversal({ contentIdentity, terrain, mapBytes: map, rules: createIniSourceView(rules),
    assets: [{ id: 'original', path: 'original.urb', sha256: digest, bytes: tile, source: { root: { sourceId: 'root', size: tile.length, sha256: digest }, absoluteOffset: 0, size: tile.length, sha256: digest } }],
    choices: terrain.cells.map(c => ({ sourceRecord: c.sourceRecord, assetId: 'original', subtile: 0 })), movementClasses: [{ id: 'foot', speedType: 0 }] });
  const world = compileWorldContent({ mapBytes: map, rules, definitions, traversal, footprints: compileFoundationOccupancy({ definitions }) });
  const input = { world, definitions, actors, rules, mission }, catalog = compileInfantryPassageCatalog(input);
  const state: InfantryOccupancyInput = { entities: WorldSimulation.create(world.model).save().state.entities,
    infantrySlots: structuredClone(initialInfantrySlots(catalog)), retiredEntityIds: [] };
  return { ...input, input, catalog, state };
}
