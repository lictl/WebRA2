// SPDX-License-Identifier: MIT
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
const root = fileURLToPath(new URL('../..', import.meta.url));
export async function mediaFiles(codecDirectory) {
  const files = new Map();
  for (const [route, path, mime] of [['/', 'tools/media/index.html', 'text/html; charset=utf-8'], ['/style.css', 'tools/media/style.css', 'text/css']]) files.set(route, { body: await readFile(resolve(root,path)), mime });
  const base=dirname(resolve(codecDirectory)), manifestPath=resolve(base,'distribution-manifest.json');
  const stat=await lstat(manifestPath); if(!stat.isFile() || stat.isSymbolicLink() || stat.size>16384) throw new Error('distribution manifest bounds');
  const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  for(const [name,cap,mime] of [['decoder.js',256*1024,'text/javascript'],['decoder.wasm',8*1024*1024,'application/wasm'],['FFMPEG-LICENSE.txt',128*1024,'text/plain'],['RUNTIME-NOTICES.txt',128*1024,'text/plain'],['corresponding-source.tar.gz',64*1024*1024,'application/gzip']]) {
    const path=resolve(name.endsWith('.gz')?base:codecDirectory,name), info=await lstat(path), expected=manifest[name];
    if(!info.isFile() || info.isSymbolicLink() || info.size<8 || info.size>cap || expected?.size!==info.size || !/^[a-f0-9]{64}$/.test(expected?.sha256)) throw new Error('codec artifact bounds');
    const body=await readFile(path);
    if(createHash('sha256').update(body).digest('hex')!==expected.sha256) throw new Error('codec artifact identity');
    if(name.endsWith('.wasm') && !body.subarray(0,8).equals(Buffer.from([0,97,115,109,1,0,0,0]))) throw new Error('WASM type');
    if(name.endsWith('.gz') && (body[0]!==31 || body[1]!==139 || body[2]!==8)) throw new Error('source archive type');
    files.set('/codec/'+name,{body,mime});
  }
  for (const name of ['main', 'worker']) {
    const output = await build({ entryPoints: [resolve(root, `tools/media/${name}.ts`)], bundle: true, format: 'esm', platform: 'browser', target: 'es2023', write: false, legalComments: 'inline' });
    files.set(`/${name}.js`, { body: Buffer.from(output.outputFiles[0].contents), mime: 'text/javascript' });
  }
  return files;
}
export function mediaServer(files, requestLog = []) {
  return createServer((request, response) => {
    const path = request.url, item = files.get(path);
    const okay = request.method === 'GET' && item;
    requestLog.push({ at: new Date().toISOString(), method: request.method, path, status: okay ? 200 : 404 });
    if (requestLog.length > 1000) requestLog.shift();
    response.writeHead(okay ? 200 : 404, { 'Content-Type': okay ? item.mime : 'text/plain', 'Content-Length': okay ? item.body.length : 0,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; connect-src 'self'; worker-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" });
    response.end(okay ? item.body : '');
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const codec = process.argv[2], evidence = process.argv[3];
  if (!codec || !evidence) throw new Error('Usage: node tools/media/serve.mjs PRIVATE_CODEC_DIRECTORY PRIVATE_EVIDENCE_DIRECTORY');
  const files = await mediaFiles(codec), requests = [];
  await mkdir(evidence, { recursive: true });
  await writeFile(resolve(evidence, 'served-manifest.json'), JSON.stringify([...files].map(([path, { body }]) => ({ path, size: body.length, sha256: createHash('sha256').update(body).digest('hex') })), null, 2));
  const server = mediaServer(files, requests);
  setInterval(() => { void writeFile(resolve(evidence, 'requests.json'), JSON.stringify(requests, null, 2)); }, 1000).unref();
  server.listen(8767, '127.0.0.1', () => console.log('Immutable local media diagnostic: http://127.0.0.1:8767'));
}
