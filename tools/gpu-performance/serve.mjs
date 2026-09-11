// SPDX-License-Identifier: GPL-3.0-or-later
// Immutable localhost code-only performance routes. No source asset server.
import { createServer } from 'node:http';
import { readFile, writeFile, realpath, lstat } from 'node:fs/promises';
import { resolve, sep, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { repositoryRoot } from './build.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const allowedName = /^(?:main\.js|worker\.js|style\.css|index\.html|LICENSE\.txt|NOTICES\.txt|LICENSES\/GPL-3\.0-or-later\.txt|licenses\/[A-Za-z0-9_.-]+\.txt)$/;
async function bounded(path, max) {
  // macOS may preserve LICENSES/ while accepting the existing licenses/ routes.
  // Check actual link components instead of confusing case normalization with a link.
  const absolute = resolve(path); let prefix = parse(absolute).root;
  for (const part of absolute.slice(prefix.length).split(sep)) { prefix = resolve(prefix, part); if ((await lstat(prefix)).isSymbolicLink()) throw Error('Symlink input refused'); }
  const stat = await lstat(path); if (!stat.isFile() || stat.size > max) throw Error('Input size/type'); return readFile(path);
}
export async function serveGpuPerformance(directory, port = 4201, isolated = false, root = repositoryRoot) {
  root = await realpath(root); const base = resolve(root, directory);
  if (!base.startsWith(resolve(root, 'local') + sep)) throw Error('Serve only ignored local builds');
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid port');
  const manifestBytes = await bounded(resolve(base, 'manifest.json'), 256 * 1024), manifest = JSON.parse(manifestBytes);
  if (manifest.schema !== 1 || !Array.isArray(manifest.files) || manifest.files.length > 256) throw Error('Invalid manifest');
  const routes = new Map(); let total = 0;
  for (const file of manifest.files) {
    if (!file || typeof file.name !== 'string' || !allowedName.test(file.name) || routes.has('/' + file.name)
      || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > 8 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw Error('Invalid manifest file');
    const data = await bounded(resolve(base, 'dist', file.name), 8 * 1024 * 1024);
    if (data.length !== file.bytes || hash(data) !== file.sha256 || (total += data.length) > 16 * 1024 * 1024) throw Error('Output identity/size mismatch');
    routes.set('/' + file.name, { data, type: file.name.endsWith('.js') ? 'text/javascript' : file.name.endsWith('.html') ? 'text/html' : file.name.endsWith('.css') ? 'text/css' : 'text/plain' });
  }
  for (const name of ['/main.js', '/style.css', '/index.html', '/LICENSE.txt', '/NOTICES.txt', '/LICENSES/GPL-3.0-or-later.txt']) if (!routes.has(name)) throw Error('Missing required code/license route');
  if(manifest.mode==='full'&&!routes.has('/worker.js'))throw Error('Missing worker route');
  if(!['refresh','full'].includes(manifest.mode))throw Error('Invalid mode');
  routes.set('/manifest.json', { data: manifestBytes, type: 'application/json' });
  const requests = []; let writing = false, dirty = false;
  const flushLog = async () => {
    dirty = true; if (writing) return; writing = true;
    try { do { dirty = false; await writeFile(resolve(base, 'requests.json'), JSON.stringify(requests, null, 2) + '\n'); } while (dirty); }
    catch { /* Request handling must not fail if optional local logging fails. */ }
    finally { writing = false; }
  };
  const server = createServer((req, res) => {
    const host = req.headers.host, origin = req.headers.origin;
    const allowedHost = host === `127.0.0.1:${port}` || host === `localhost:${port}`;
    const allowedOrigin = origin === undefined || origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`;
    const name = req.url === '/' ? '/index.html' : req.url;
    const resource = allowedHost && allowedOrigin && req.method === 'GET' ? routes.get(name) : null;
    const status = !allowedHost || !allowedOrigin ? 403 : req.method === 'GET' ? resource ? 200 : 404 : 405;
    requests.push({ time: new Date().toISOString(), method: req.method, path: String(req.url).slice(0, 256), status });
    if (requests.length > 1000) requests.shift();
    void flushLog();
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; worker-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    if(isolated){res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');}
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.writeHead(status, { 'Content-Type': resource?.type ?? 'text/plain' }); res.end(resource?.data ?? 'Not found');
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, manifest, requests };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length < 3 || process.argv.length > 5) throw Error('Usage: node tools/gpu-performance/serve.mjs local/<build> [port] [isolated]');
  const port = process.argv[3] === undefined ? 4201 : Number(process.argv[3]);
  if(process.argv[4]!==undefined&&process.argv[4]!=='isolated')throw Error('Invalid header mode');
  await serveGpuPerformance(process.argv[2], port, process.argv[4]==='isolated'); console.log(`Immutable GPU diagnostic: http://127.0.0.1:${port}/`);
}
