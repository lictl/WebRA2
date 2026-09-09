// SPDX-License-Identifier: MIT
import test from 'node:test';import assert from 'node:assert/strict';import {mediaServer} from '../../tools/media/serve.mjs';
test('diagnostic serves exact code routes and no asset/upload/query/traversal routes',async()=>{
  const server=mediaServer(new Map([['/',{body:Buffer.from('original fixture'),mime:'text/plain'}],['/codec/decoder.wasm',{body:Buffer.from([0,97,115,109]),mime:'application/wasm'}]]));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  try{for(const [path,method,status]of[['/','GET',200],['/codec/decoder.wasm','GET',200],['/','POST',404],['/game/ra2.mix','GET',404],['/codec/sample.bik','GET',404],['/?file=sample','GET',404],['/%2e%2e/game','GET',404]]){const r=await fetch(base+path,{method});assert.equal(r.status,status);assert.match(r.headers.get('Content-Security-Policy'),/default-src 'none'/);}}finally{await new Promise(r=>server.close(r));}
});
