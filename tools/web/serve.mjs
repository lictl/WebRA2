// SPDX-License-Identifier: MIT
import { createServer } from 'node:http';
import { readFile, lstat, realpath } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { repositoryRoot } from './build.mjs';
const approved = /^(?:index\.html|app\.(?:js|css)|workers\/(?:import|simulation|terrain)\.js|chunks\/[a-zA-Z0-9_-]+\.js|LICENSE\.txt|NOTICES\.txt|LICENSES\/GPL-3\.0-or-later\.txt|licenses\/[a-zA-Z0-9_.-]+\.txt)$/;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

/** Serve a validated code bundle from memory; no request resolves a filesystem asset. */
export async function startWebServer({ root = repositoryRoot, port = 4173 } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid loopback port');
  const directory = await realpath(resolve(root, 'dist'));
  if (directory !== resolve(await realpath(root), 'dist')) throw new Error('Build directory cannot escape the repository');
  async function load(name, limit) {
    const path = resolve(directory, name), stat = await lstat(path);
    if (!stat.isFile() || stat.size > limit || !(await realpath(path)).startsWith(directory + sep)) throw new Error(`Invalid build file: ${name}`);
    return readFile(path);
  }
  const manifest = JSON.parse(await load('manifest.json', 256 * 1024));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 128) throw new Error('Invalid build manifest');
  const files = new Map(); let total = 0;
  for (const item of manifest.files) {
    if (typeof item.name !== 'string' || !approved.test(item.name) || files.has('/' + item.name) ||
        !Number.isSafeInteger(item.size) || item.size < 0 || item.size > 8 * 1024 * 1024 ||
        typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error('Invalid code route');
    total += item.size; if (total > 16 * 1024 * 1024) throw new Error('Build exceeds total code limit');
    const bytes = await load(item.name, item.size);
    if (bytes.length !== item.size || hash(bytes) !== item.sha256) throw new Error(`Stale or changed build: ${item.name}`);
    files.set('/' + item.name, bytes);
  }
  if (!files.has('/index.html') || !files.has('/app.js') || !files.has('/workers/import.js') || !files.has('/workers/simulation.js') || !files.has('/workers/terrain.js')) throw new Error('Missing app entrypoints');
  let authority;
  const server = createServer((request, response) => {
    const host = request.headers.host;
    const route = request.url === '/' ? '/index.html' : request.url;
    const bytes = files.get(route);
    if (!['GET', 'HEAD'].includes(request.method) || ![authority, authority.replace('127.0.0.1', 'localhost')].includes(host) || !bytes) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Connection': 'close', 'Cache-Control': 'no-store' }); response.end('Not found'); return;
    }
    response.writeHead(200, {
      'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain' }[extname(route)] ?? 'application/octet-stream') + '; charset=utf-8',
      'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; worker-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      'Referrer-Policy': 'no-referrer',
    });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  });
  await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolveListen); });
  authority = `127.0.0.1:${server.address().port}`;
  return { server, url: `http://${authority}`, close: () => new Promise((done, reject) => { server.close(error => error ? reject(error) : done()); server.closeIdleConnections(); }) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).length > 1 || (process.argv[2] && !/^\d{1,5}$/.test(process.argv[2]))) throw new Error('Usage: npm run preview -- [port]');
  const app = await startWebServer({ port: process.argv[2] ? Number(process.argv[2]) : 4173 });
  console.log(`WebRA2: ${app.url} — select game files in the browser; the launcher serves app code only.`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void app.close().then(() => process.exit(0)); });
}
