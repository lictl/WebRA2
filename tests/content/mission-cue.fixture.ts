// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature map and CSF fixtures only.
import { createHash } from 'node:crypto';
import type { MissionCueInput } from '../../packages/content/src/mission-cues.ts';
export const hashCueFixture = (bytes:Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const u32=(n:number)=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
export function cueCsf(rows:readonly {label:string;text?:string}[]):Uint8Array {
  return new Uint8Array(Buffer.concat([Buffer.from(' FSC'),u32(3),u32(rows.length),u32(rows.filter(r=>r.text!==undefined).length),u32(0),u32(9),...rows.flatMap(r=>{
    const head=[Buffer.from(' LBL'),u32(r.text===undefined?0:1),u32(r.label.length),Buffer.from(r.label,'ascii')];
    if(r.text===undefined)return head;const encoded=Buffer.from(r.text,'utf16le');for(let i=0;i<encoded.length;i++)encoded[i]=encoded[i]!^255;
    return [...head,Buffer.from(' RTS'),u32(r.text.length),encoded];
  })]));
}
export function cueInput(profile:'ra2'|'yr'='ra2', actions=['11,4,MSG,0,0,0,0,A','48,0,2,0,0,0,0,A','55,0,0,0,0,0,0,A'],waypoints='0=6005',strings=cueCsf([{label:'MSG',text:'Original 測試 message'}])):MissionCueInput {
  const bytes=new TextEncoder().encode(`[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,10,10\n[Waypoints]\n${waypoints}\n[Triggers]\nTRG=0,<none>,Original,0,1,1,1,0\n[Events]\nTRG=1,8,0,0\n[Actions]\nTRG=${actions.length},${actions.join(',')}\n`);
  return {profile,mission:{path:'fixture.map',source:{id:'fixture',profile,sha256:hashCueFixture(bytes)},bytes},strings:{path:profile==='ra2'?'ra2.csf':'ra2md.csf',sha256:hashCueFixture(strings),bytes:strings}};
}
