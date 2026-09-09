// Diagnostic-only allowlisted loopback server: never serves game/ or accepts uploads.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

const port = 8765;
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/probe.css', ['probe.css', 'text/css; charset=utf-8']],
  ['/probe.mjs', ['probe.mjs', 'text/javascript; charset=utf-8']],
  ['/range-reader.mjs', ['range-reader.mjs', 'text/javascript; charset=utf-8']],
]);
const args = process.argv.slice(2);
if (args.length) {
  if (args.length !== 2 || args[0] !== '--media-core' || !isAbsolute(args[1])) {
    throw new Error('Usage: node tools/feasibility/serve.mjs [--media-core /absolute/core/dist/esm]');
  }
  for (const name of ['media-probe.html', 'media-probe.mjs', 'media-worker.mjs', 'bink-header.mjs',
    'media-presentation.html', 'media-presentation.mjs', 'media-presentation-worker.mjs', 'media-presentation-queue.mjs']) {
    files.set(`/${name}`, [new URL(name, import.meta.url), name.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8']);
  }
  files.set('/media-core/ffmpeg-core.js', [join(args[1], 'ffmpeg-core.js'), 'text/javascript; charset=utf-8']);
  files.set('/media-core/ffmpeg-core.wasm', [join(args[1], 'ffmpeg-core.wasm'), 'application/wasm']);
}
const server = createServer(async (req, res) => {
  const entry = files.get(req.url);
  if (req.headers.host !== `127.0.0.1:${port}` || req.method !== 'GET' || !entry) {
    res.writeHead(404).end('Not found');
    return;
  }
  try {
    const source = entry[0] instanceof URL || isAbsolute(entry[0]) ? entry[0] : new URL(entry[0], import.meta.url);
    const body = await readFile(source);
    res.writeHead(200, {
      'Content-Type': entry[1], 'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    }).end(body);
  } catch {
    res.writeHead(500).end('Unable to read diagnostic source');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Diagnostic: http://127.0.0.1:${port}/ (Ctrl-C to stop)`));
