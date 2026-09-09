// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Diagnostic code only, never retail files.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const port = 8766;
const sources = new Map([
  ['/', ['shp-probe.html', 'text/html; charset=utf-8']],
  ['/shp-probe.css', ['shp-probe.css', 'text/css; charset=utf-8']],
  ['/shp-probe.mjs', ['shp-probe.mjs', 'text/javascript; charset=utf-8']],
]);
const source = await readFile(new URL('../../packages/formats/src/shp-ts.ts', import.meta.url), 'utf8');
const decoder = stripTypeScriptTypes(source, { mode: 'transform' });
createServer(async (req, res) => {
  const entry = sources.get(req.url ?? '');
  if (req.headers.host !== `127.0.0.1:${port}` || req.method !== 'GET' || (!entry && req.url !== '/shp-ts.mjs')) { res.writeHead(404).end('Not found'); return; }
  try {
    const body = entry ? await readFile(new URL(entry[0]!, import.meta.url)) : decoder;
    res.writeHead(200, { 'Content-Type': entry?.[1] ?? 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }).end(body);
  } catch { res.writeHead(500).end('Diagnostic source unavailable'); }
}).listen(port, '127.0.0.1', () => console.log(`SHP diagnostic: http://127.0.0.1:${port}/`));
