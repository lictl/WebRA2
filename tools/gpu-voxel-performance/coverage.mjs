// SPDX-License-Identifier: GPL-3.0-or-later
// Independent interval census: every declared box must appear once in every intersected tile.
export function checkBinCoverage(frame,packet){
 const {boxes,offsets,candidates,tilesX}=packet,expected=Array.from({length:offsets.length-1},()=>[]);
 let joins=0;
 for(let box=0;box<boxes.length/8;box++){const at=box*8,[x0,y0,x1,y1]=boxes.subarray(at,at+4);if(x0<0||y0<0||x1>frame.width||y1>frame.height||x0>=x1||y0>=y1)throw Error('Coverage box bounds');for(let y=0;y<Math.ceil(frame.height/16);y++)for(let x=0;x<tilesX;x++){if(x*16<x1&&(x+1)*16>x0&&y*16<y1&&(y+1)*16>y0){expected[y*tilesX+x].push(box);joins++;}}}
 if(offsets[0]!==0||offsets.at(-1)!==candidates.length)throw Error('Coverage offsets');
 for(let tile=0;tile<expected.length;tile++){const values=expected[tile];if(offsets[tile+1]-offsets[tile]!==values.length)throw Error('Coverage count');for(let i=0;i<values.length;i++)if(candidates[offsets[tile]+i]!==values[i])throw Error('Coverage entry/order');}
 return {boxes:boxes.length/8,tiles:expected.length,joins};
}
