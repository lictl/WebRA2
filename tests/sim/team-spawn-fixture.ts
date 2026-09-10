// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature source corpus; literal compression framing follows the original world-content fixtures.
import { createHash } from 'node:crypto';
import { compileRuntimeIni } from '../../packages/content/src/runtime-ini.ts';
import { createIniSourceView } from '../../packages/content/src/ini-source-view.ts';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
import { compileScenarioTerrain } from '../../packages/content/src/scenario-terrain.ts';
import { compileFoundationOccupancy } from '../../packages/content/src/foundation-occupancy.ts';
import { compileEntityDefinitions } from '../../packages/content/src/entity-definitions.ts';
import { compileTeamDefinitions } from '../../packages/content/src/team-definitions.ts';
import { compileTerrainTraversal } from '../../packages/content/src/terrain-traversal.ts';
import { compileWorldContent } from '../../packages/sim/src/world-content.ts';
import { compileTeamProgram } from '../../packages/sim/src/team-runtime-program.ts';
const encode = (s: string) => new TextEncoder().encode(s);
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
function packed(raw: Uint8Array, literal: boolean): string {
  const blocks: Buffer[] = [];
  for (let at = 0; at < raw.length; at += 8192) {
    const piece = raw.subarray(at, at + 8192), stream: number[] = [];
    if (literal) stream.push(17 + piece.length, ...piece, 17, 0, 0);
    else { for (let i = 0; i < piece.length;) { let end = i + 1; while (end < piece.length && piece[end] === piece[i]) end++;
      stream.push(254, (end - i) & 255, (end - i) >>> 8, piece[i]!); i = end; } stream.push(128); }
    const head = Buffer.alloc(4); head.writeUInt16LE(stream.length); head.writeUInt16LE(piece.length, 2); blocks.push(head, Buffer.from(stream));
  }
  return Buffer.concat(blocks).toString('base64');
}
export function teamSpawnFixture({profile='ra2' as 'ra2'|'yr', script='0=3,0\n1=6,1', count=1,
  extraTeam='Waypoint=A', extraRules='', waypoint='0=3003', extraAI='', extraMap='[Actions]\nSpawn=1,80,1,Squad,0,0,0,0,A', speed=128, infantryRows='0=Commander,Walker,256,2,2,0,Guard,0,None\n1=Commander,Walker,256,2,3,0,Guard,0,None\n2=Rival,Walker,256,4,2,0,Guard,0,None'}={}) {
  const xy = [[1,3],[2,2],[3,1],[2,3],[3,2],[2,4],[3,3],[4,2],[3,4],[4,3]];
  const raw = new Uint8Array(114), view = new DataView(raw.buffer);
  xy.forEach(([x,y], i) => { view.setUint16(i*11,x!,true);view.setUint16(i*11+2,y!,true);view.setUint16(i*11+4,1,true); });
  const bytes = encode(`[Basic]\nNewINIFormat=4\nPlayer=Commander\n[Map]\nSize=0,0,3,2\nLocalSize=0,0,3,2\nTheater=URBAN\n[Houses]\n0=Commander\n1=Rival\n[Commander]\nCountry=Blue\n[Rival]\nCountry=Red\n[Infantry]\n${infantryRows}\n[Waypoints]\n${waypoint}\n[IsoMapPack5]\n1=${packed(raw,true)}\n[OverlayPack]\n1=${packed(new Uint8Array(262144).fill(255),false)}\n[OverlayDataPack]\n1=${packed(new Uint8Array(262144),false)}\n${extraMap}`);
  const base = encode(`[Countries]\n0=Blue\n1=Red\n[Clear]\nFoot=1\n[InfantryTypes]\n0=Walker\n[Walker]\nStrength=100\nSpeed=${speed}\nLocomotor={4A582744-9839-11D1-B709-00A024DDAFD1}\n${extraRules}`);
  const aiBytes = encode(`[TeamTypes]\n0=Squad\n[Squad]\nHouse=Blue\nTaskForce=Troop\nScript=Route\n${extraTeam}\n[TaskForces]\n0=Troop\n[Troop]\n0=${count},Walker\n[ScriptTypes]\n0=Route\n[Route]\n${script}\n${extraAI}`);
  const artBytes = encode('[Original]\nValue=1\n'), source = {id:'map',profile,sha256:hash(bytes)};
  const rules = compileRuntimeIni(profile,[{id:'base',profile,order:0,kind:'base',sourceSha256:hash(base),bytes:base},
    {id:'map',profile,order:1,kind:'map',sourceSha256:source.sha256,bytes}]);
  const art = compileRuntimeIni(profile,[{id:'art',profile,order:0,kind:'base',sourceSha256:hash(artBytes),bytes:artBytes}]);
  const ai = compileRuntimeIni(profile,[{id:'ai',profile,order:0,kind:'base',sourceSha256:hash(aiBytes),bytes:aiBytes}]);
  const objects = compileScenarioObjects({profile,source,bytes}), terrain = compileScenarioTerrain({profile,source,bytes});
  const definitions = compileEntityDefinitions({objects,rules,art});
  const tile = new Uint8Array(1872), tileView = new DataView(tile.buffer);
  for (const [at,n] of [[0,1],[4,1],[8,60],[12,30],[16,20],[32,952],[56,2]]) tileView.setUint32(at!,n!,true);
  const digest = hash(tile), contentIdentity = {profile,manifestSha256:'a'.repeat(64),rulesSha256:'b'.repeat(64),orderedModHashes:[]};
  const traversal = compileTerrainTraversal({contentIdentity,terrain,mapBytes:bytes,rules:createIniSourceView(rules),
    assets:[{id:'tiles',path:'original.urb',sha256:digest,bytes:tile,source:{root:{sourceId:'root',size:tile.length,sha256:digest},absoluteOffset:0,size:tile.length,sha256:digest}}],
    choices:terrain.cells.map(c=>({sourceRecord:c.sourceRecord,assetId:'tiles',subtile:0})),movementClasses:[{id:'foot',speedType:0}]});
  const world = compileWorldContent({mapBytes:bytes,rules,definitions,traversal,footprints:compileFoundationOccupancy({definitions})});
  const mission={source,bytes}, teams=compileTeamDefinitions({definitions,rules,ai,mission});
  const input={teams,world,mission,teamIds:['team:squad']};
  return {...input,rules,ai,definitions,traversal,compilation:compileTeamProgram(input)};
}
