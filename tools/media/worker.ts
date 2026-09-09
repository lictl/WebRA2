// SPDX-License-Identifier: MIT
import { blobRange, RetainedDecoder, type Codec } from '../../packages/media/src/decoder.ts';
let session: RetainedDecoder | undefined, busy = false, expected = 1;
const host = globalThis as unknown as { onmessage: (event: MessageEvent) => void; postMessage: (message: unknown, transfer?: Transferable[]) => void; FileReaderSync: new () => { readAsArrayBuffer(blob: Blob): ArrayBuffer } };
host.onmessage = async ({ data: r }: MessageEvent) => {
  const id = r?.id;
  try {
    if (busy || !r || Object.getPrototypeOf(r) !== Object.prototype || r.version !== 1 || id !== expected++ || !Number.isSafeInteger(id)) throw new Error('protocol');
    const keys = r.type === 'open' ? ['version','id','type','file','track','expected'] : r.type === 'seek' ? ['version','id','type','seconds'] : ['version','id','type'];
    if (Object.keys(r).sort().join(',') !== keys.sort().join(',')) throw new Error('protocol-shape');
    busy = true;
    if (r.type === 'open') {
      if (session || !(r.file instanceof Blob) || !Number.isSafeInteger(r.track) || (r.expected !== null && typeof r.expected !== 'string')) throw new Error('open-request');
      const start = performance.now();
      const response = await fetch('/codec/decoder.wasm');
      if (!response.ok || Number(response.headers.get('Content-Length')) > 8 * 1024 * 1024) throw new Error('codec-load');
      const wasmBinary = new Uint8Array(await response.arrayBuffer());
      if (wasmBinary.length < 8 || wasmBinary.length > 8 * 1024 * 1024) throw new Error('codec-size');
      const { default: create } = await import(String('/codec/decoder.js'));
      const core: Codec = await create({ wasmBinary, print: () => {}, printErr: () => {} });
      const reader = new host.FileReaderSync();
      session = new RetainedDecoder(core, r.file.size, blobRange(r.file, 0, r.file.size, b => reader.readAsArrayBuffer(b)), r.track, r.expected);
      host.postMessage({ version: 1, id, type: 'ready', header: session.header, identity: session.identity, loadMs: performance.now() - start, heap: core.HEAPU8.length, io: session.source.stats });
    } else if (r.type === 'next' && session) {
      const start = performance.now(), event = session.next();
      host.postMessage({ version: 1, id, type: event ? 'event' : 'eof', event, decodeMs: performance.now() - start, heap: session.core.HEAPU8.length, io: session.source.stats }, event ? [event.buffer] : []);
    } else if (r.type === 'seek' && session) {
      session.seek(r.seconds); host.postMessage({ version: 1, id, type: 'seeked' });
    } else if (r.type === 'close') {
      session?.close(); session = undefined; host.postMessage({ version: 1, id, type: 'closed' });
    } else throw new Error('state-request');
  } catch (error) {
    session?.close(); session = undefined;
    host.postMessage({ version: 1, id, type: 'error', code: error instanceof Error ? error.message.slice(0, 80) : 'codec-failure' });
  } finally { busy = false; }
};
