// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature map/TMP/INI fixture; no retail content.
import { createHash } from 'node:crypto';
import { initialFixture } from '../content/combat-initial-fixture.ts';
import { compileScenarioTerrain } from '../../packages/content/src/scenario-terrain.ts';
import { compileTerrainTraversal } from '../../packages/content/src/terrain-traversal.ts';
import { compileTerrainTraversalGround } from '../../packages/content/src/terrain-traversal-ground.ts';
import { createIniSourceView } from '../../packages/content/src/ini-source-view.ts';
import { compileFoundationOccupancy } from '../../packages/content/src/foundation-occupancy.ts';
import { compileWeaponDefinitions } from '../../packages/content/src/weapon-definitions.ts';
import { compileInstantWeaponContexts } from '../../packages/content/src/instant-weapons.ts';
import { compileAnimationEffects } from '../../packages/content/src/animation-effects.ts';
import { compileCombatModifiers } from '../../packages/content/src/combat-modifiers.ts';
import { compileCombatVeterancy } from '../../packages/content/src/combat-veterancy.ts';
import { compileCombatInitialRuntime } from '../../packages/content/src/combat-initial-runtime.ts';
import { compileCombatDeath } from '../../packages/content/src/combat-death.ts';
import { compileOrdinaryDeath } from '../../packages/content/src/combat-death-runtime.ts';
import { compileWorldContent } from '../../packages/sim/src/world-content.ts';
import { createWorldModel, worldPosition } from '../../packages/sim/src/world-model.ts';
import type { OrdinaryInfantryBridge } from '../../packages/sim/src/ordinary-infantry-bridge.ts';
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
function packed(raw: Uint8Array, lzo: boolean): string {
  const blocks: Buffer[] = [], size = lzo ? 200 : 8192;
  for (let at = 0; at < raw.length; at += size) {
    const b = raw.subarray(at, at + size), stream: number[] = [];
    if (lzo) stream.push(17 + b.length, ...b, 17, 0, 0);
    else { for (let i = 0; i < b.length;) { let end = i + 1; while (end < b.length && b[end] === b[i]) end++;
      stream.push(254, (end - i) & 255, (end - i) >>> 8, b[i]!); i = end; } stream.push(128); }
    const head = Buffer.alloc(4); head.writeUInt16LE(stream.length); head.writeUInt16LE(b.length, 2); blocks.push(head, Buffer.from(stream));
  } return Buffer.concat(blocks).toString('base64');
}
export function ordinaryFixtureSource({ profile = 'ra2' as 'ra2' | 'yr', sourceFields = '', targetFields = '', targetPrimary = 'Complex', weaponFields = '', impactFields = '', artFields = '',
  extraRules = '', extraMap = '', sourceTag = 'None', targetTag = 'None', extraInfantryRows = '', damage = 10, rank = '0', targetRank = '0', overlay = false, elevation = false, sharedTarget = false, seed = 1234, difficulty = 1 as 0 | 1 | 2, fireUp = 2, rof = 4, ground = false, ramp = 0, subcells = false } = {}) {
  const cells: { x: number; y: number }[] = [];
  for (let row = 0; row < 12; row++) for (let column = row % 2; column <= 10; column += 2)
    cells.push({ x: (column + row + 2) / 2, y: (row - column + 12) / 2 });
  const raw = new Uint8Array(cells.length * 11 + 4), v = new DataView(raw.buffer);
  cells.forEach((c, index) => { v.setUint16(index * 11, c.x, true); v.setUint16(index * 11 + 2, c.y, true); v.setUint16(index * 11 + 4, 1, true);
    if (elevation && c.x === 7 && c.y === 6) raw[index * 11 + 9] = 1; });
  const overlayBytes = new Uint8Array(262144).fill(255); if (overlay) overlayBytes[6 + 512 * 7] = 1;
  const mapText = `[Basic]\nNewINIFormat=4\nPlayer=Commander\n[Map]\nSize=0,0,6,6\nLocalSize=0,0,6,6\nTheater=URBAN\n[Houses]\n0=Commander\n1=Rival\n[Commander]\nCountry=Blue\n[Rival]\nCountry=Blue\n[Infantry]\n0=Commander,Walker,256,6,6,${subcells ? 2 : 0},Guard,0,${sourceTag},${rank},-1,0,1,1\n1=Rival,Observer,256,7,6,${subcells ? 4 : 0},Guard,0,${targetTag},${targetRank},-1,0,1,1\n${sharedTarget ? '2=Rival,Observer,256,7,6,0,Guard,0,None,0,-1,0,1,1\n' : ''}${extraInfantryRows}[IsoMapPack5]\n1=${packed(raw, true)}\n[OverlayPack]\n1=${packed(overlayBytes, false)}\n[OverlayDataPack]\n1=${packed(new Uint8Array(262144), false)}\n${extraMap}`;
  const rulesText = `[Countries]\n0=Blue\n[InfantryTypes]\n0=Walker\n1=Observer\n[Animations]\n0=Quiet\n[Easy]\nFirePower=1\n[Normal]\nFirePower=1\n[Difficult]\nFirePower=1\n[General]\nVeteranCombat=1.25\nVeteranArmor=1.5\nVeteranROF=.75\n${profile === 'yr' ? 'DeadBodies=Quiet\n' : ''}[AudioVisual]\n${profile === 'ra2' ? 'DeadBodies=Quiet\n' : ''}[Clear]\nFoot=1\n[Walker]\nStrength=100\nSpeed=50\nPrimary=Pulse\nLocomotor={4A582744-9839-11D1-B709-00A024DDAFD1}\n${sourceFields}\n[Observer]\nStrength=100\nSpeed=50\nPrimary=${targetPrimary}\nLocomotor={4A582744-9839-11D1-B709-00A024DDAFD1}\n${targetFields}\n[Pulse]\nDamage=${damage}\nRange=5\nROF=${rof}\nProjectile=Ray\nWarhead=Hit\n${weaponFields}\n[Complex]\nDamage=10\nRange=5\nROF=4\nProjectile=Ray\nWarhead=Special\n[Ray]\nInviso=yes\n[Hit]\nInfDeath=1\nVerses=100%,100%,100%,100%,100%,100%,100%,100%,100%,100%,100%\n${impactFields}\n[Special]\nInfDeath=1\nRadiation=yes\n${extraRules}`;
  const f = initialFixture({ profile, rulesText, mapText, artText: `[Walker]\nFireUp=${fireUp}\n[Quiet]\nRate=500\n${artFields}` });
  const terrain = compileScenarioTerrain({ profile, ...f.mission });
  const tile = new Uint8Array(1872), tv = new DataView(tile.buffer);
  for (const [at, n] of [[0, 1], [4, 1], [8, 60], [12, 30], [16, 20], [32, 952], [56, 2]]) tv.setUint32(at!, n!, true);
  tile[62] = ramp;
  const hash = sha(tile), contentIdentity = { profile, manifestSha256: 'a'.repeat(64), rulesSha256: 'b'.repeat(64), orderedModHashes: [] };
  const flatTraversal = compileTerrainTraversal({ contentIdentity, terrain, mapBytes: f.mission.bytes, rules: createIniSourceView(f.rules),
    assets: [{ id: 'original', path: 'original.urb', sha256: hash, bytes: tile, source: { root: { sourceId: 'root', size: tile.length, sha256: hash }, absoluteOffset: 0, size: tile.length, sha256: hash } }],
    choices: terrain.cells.map(c => ({ sourceRecord: c.sourceRecord, assetId: 'original', subtile: 0 })), movementClasses: [{ id: 'foot', speedType: 0 }] });
  const traversal = ground ? compileTerrainTraversalGround({ base: flatTraversal }) : flatTraversal;
  const world = compileWorldContent({ mapBytes: f.mission.bytes, rules: f.rules, definitions: f.definitions, traversal, footprints: compileFoundationOccupancy({ definitions: f.definitions }) });
  const source = { definitions: f.definitions, rules: f.rules, art: f.art };
  const weapons = compileWeaponDefinitions({ definitions: f.definitions, rules: f.rules }), instant = compileInstantWeaponContexts({ weapons, rules: f.rules }), effects = compileAnimationEffects({ ...source, weapons });
  const modifiers = compileCombatModifiers({ actors: f.actors, rules: f.rules, mission: f.mission, houseDifficultyIndices: f.actors.houses.map(h => ({ houseId: h.houseId, index: difficulty })) });
  const veterancy = compileCombatVeterancy({ actors: f.actors, rules: f.rules }), initial = compileCombatInitialRuntime(f), death = compileCombatDeath({ ...source, actors: f.actors, weapons, effects });
  const ordinaryDeath = compileOrdinaryDeath({ ...source, actors: f.actors, weapons, effects, death, veterancy });
  return { rules: f.rules, mission: f.mission, world, definitions: f.definitions, actors: f.actors, weapons, instant, effects, modifiers, veterancy, initial, death, ordinaryDeath, traversal,
    seed, sequence11Ticks: 3, sequence12Ticks: 4 };
}
export function ordinaryFixture(options: Parameters<typeof ordinaryFixtureSource>[0] = {}) {
  const { rules, mission, ...fixture } = ordinaryFixtureSource(options); return fixture;
}
export function ordinaryWorld(f: ReturnType<typeof ordinaryFixture>, bridge: OrdinaryInfantryBridge) {
  const m = f.world.model;
  return createWorldModel({ contentIdentity: m.contentIdentity, sourceSha256: m.sourceSha256, definitionsSha256: m.definitionsSha256, entities: m.entities,
    navigation: m.navigation, blocked: m.blocked.map(worldPosition), footprints: m.footprints.map(f => ({ entityId: f.entityId, cells: f.cells.map(worldPosition) })),
    ...(bridge.combat ? { combat: bridge.combat } : {}) });
}
