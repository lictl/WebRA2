// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original benchmark instrumentation.
import { runWorld, runRender, renderFixture, digest } from './workloads.mjs';
let render, lastId = 0;
function request(value) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) throw Error('Invalid request');
  const result = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !d || !('value' in d)) throw Error('Invalid request');
    result[key] = d.value;
  }
  const keys = { world: ['id','type','profile','count'], render: ['id','type','size'], echo: ['id','type','payload','transfer'], 'frame-init': ['id','type'], frame: ['id','type'] };
  const allowed = typeof result.type === 'string' && Object.hasOwn(keys, result.type) ? keys[result.type] : null;
  if (!allowed || Reflect.ownKeys(value).length !== allowed.length || allowed.some(k=>!Object.hasOwn(result,k))
    || !Number.isSafeInteger(result.id) || result.id <= lastId || result.id > 10000) throw Error('Invalid request');
  if (result.type === 'world' && (!['ra2','yr'].includes(result.profile) || ![64,256,1024].includes(result.count))) throw Error('Invalid world workload');
  if (result.type === 'render' && ![32,64].includes(result.size)) throw Error('Invalid scene workload');
  if (result.type === 'echo' && (typeof result.transfer !== 'boolean' || !result.payload || Object.getPrototypeOf(result.payload) !== Uint8Array.prototype
    || Object.getPrototypeOf(result.payload.buffer) !== ArrayBuffer.prototype || result.payload.buffer.resizable
    || result.payload.buffer.byteLength !== result.payload.byteLength
    || ![0,1024*1024,4*1024*1024].includes(result.payload.byteLength))) throw Error('Invalid echo workload');
  if (result.type === 'frame' && !render) throw Error('Frame not initialized');
  lastId = result.id; return result;
}
self.onmessage = e => {
  let id = null;
  try {
    const r=request(e.data);id=r.id;const {type,...p}=r;
    if(type==='world'){const start=performance.now();const result=runWorld(p.profile,p.count,name=>self.postMessage({progress:name}));self.postMessage({id,result,totalMs:performance.now()-start});}
    else if(type==='render'){const result=runRender(p.size,name=>self.postMessage({progress:name}));self.postMessage({id,result});}
    else if(type==='echo'){self.postMessage({id,payload:p.payload},p.transfer?[p.payload.buffer]:[]);}
    else if(type==='frame-init'){render=renderFixture(64);self.postMessage({id});}
    else if(type==='frame'){const start=performance.now();const frame=render.scene.renderSprites({cameraX:1440,cameraY:640,zoom:1,width:960,height:640,backgroundRgba:[17,21,23,255]},render.batch);const elapsed=performance.now()-start;self.postMessage({id,rgba:frame.rgba,renderMs:elapsed},[frame.rgba.buffer]);}
    else self.postMessage({id,error:'unknown-operation'});
  } catch(error){self.postMessage({id,error:String(error),stack:error?.stack});}
};
