import { makeRangeReader, MAX_RANGE_BYTES } from './range-reader.mjs';

const output = document.querySelector('#results');
const run = document.querySelector('#run');
const fileInput = document.querySelector('#file');
const cancel = document.querySelector('#cancel');
let controller;
const pretty = value => {
  output.replaceChildren(...JSON.stringify(value, null, 2).split('\n').map(line => {
    const row = document.createElement('span');
    row.textContent = line;
    return row;
  }));
};
const failure = error => ({ status: 'failed', error: `${error.name}: ${error.message}` });

async function storageCheck() {
  const result = { estimate: null, persisted: null, opfs: 'unavailable', indexedDB: 'unavailable' };
  try { result.estimate = await navigator.storage?.estimate(); } catch (e) { result.estimate = failure(e); }
  try { result.persisted = await navigator.storage?.persisted(); } catch (e) { result.persisted = failure(e); }
  const name = `webra2-diagnostic-${crypto.randomUUID()}`;
  const bytes = Uint8Array.from({ length: 32 }, (_, i) => i);
  if (navigator.storage?.getDirectory) {
    let root;
    try {
      root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle(name, { create: true });
      const writer = await handle.createWritable();
      await writer.write(bytes);
      await writer.close();
      const data = new Uint8Array(await (await handle.getFile()).arrayBuffer());
      if (data.length !== 32 || data.some((v, i) => v !== i)) throw new Error('Storage round-trip mismatch');
      result.opfs = 'passed: wrote/read 32 bytes';
    } catch (e) { result.opfs = failure(e); }
    finally {
      if (root) {
        try { await root.removeEntry(name); } catch (e) { result.opfsCleanup = failure(e); }
      }
    }
  }
  if (globalThis.indexedDB) {
    let db;
    try {
      db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('probe');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction('probe', 'readwrite');
        tx.objectStore('probe').put(bytes, 'bytes');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('Storage transaction aborted'));
      });
      const data = await new Promise((resolve, reject) => {
        const tx = db.transaction('probe');
        const request = tx.objectStore('probe').get('bytes');
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('Storage read transaction aborted'));
      });
      if (data.length !== 32 || data.some((v, i) => v !== i)) throw new Error('Storage round-trip mismatch');
      result.indexedDB = 'passed: wrote/read 32 bytes';
    } catch (e) { result.indexedDB = failure(e); }
    finally {
      db?.close();
      try {
        await new Promise((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = resolve;
          request.onerror = () => reject(request.error);
          request.onblocked = () => reject(new Error('Diagnostic database cleanup blocked'));
        });
      } catch (e) { result.indexedDBCleanup = failure(e); }
    }
  }
  return result;
}

async function readSample(file, sampleBytes, signal, verifyPattern = false) {
  const start = performance.now();
  const read = makeRangeReader(file);
  let total = 0;
  let maximumReturnedBytes = 0;
  let checksum = 0;
  while (total < sampleBytes) {
    const length = Math.min(MAX_RANGE_BYTES, sampleBytes - total);
    const data = new Uint8Array(await read(total, length, signal));
    maximumReturnedBytes = Math.max(maximumReturnedBytes, data.length);
    for (let i = 0; i < data.length; i++) {
      if (verifyPattern && data[i] !== (total + i) % 251) throw new Error(`Byte mismatch at ${total + i}`);
      checksum = (checksum + data[i]) >>> 0;
    }
    total += data.length;
    // Yield so cancellation remains reachable, including very fast disk reads.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return { sourceBytes: file.size, sampledBytes: total, maximumReturnedBytes, checksum,
    elapsedMs: Math.round((performance.now() - start) * 100) / 100,
    scope: 'One range in flight; returned-buffer cap is not total browser memory.' };
}

run.addEventListener('click', async () => {
  run.disabled = fileInput.disabled = true;
  pretty({ status: 'running' });
  const result = { date: new Date().toISOString(), userAgent: navigator.userAgent,
    secureContext: isSecureContext, crossOriginIsolated,
    capabilities: { file: typeof File === 'function', blobSlice: typeof Blob.prototype.slice === 'function',
      directoryPicker: typeof showDirectoryPicker === 'function', webkitDirectory: 'webkitdirectory' in fileInput,
      videoDecoder: typeof VideoDecoder === 'function', webAssembly: typeof WebAssembly === 'object' },
    memory: { totalBrowserPeakBytes: null, reason: 'No portable total browser peak-memory API is measured by this probe.' } };
  try {
    const started = performance.now();
    // A 251 KiB repeated block preserves an offset-dependent byte pattern.
    const block = Uint8Array.from({ length: 251 * 1024 }, (_, i) => i % 251);
    const source = new File(Array.from({ length: 256 }, () => block), 'synthetic-62.75MiB.bin');
    result.syntheticConstructionMs = Math.round((performance.now() - started) * 100) / 100;
    result.syntheticFile = await readSample(source, source.size, undefined, true);
    const read = makeRangeReader(source);
    result.eofBytes = (await read(source.size, 0)).byteLength;
    result.storage = await storageCheck();
    result.cjk = { documentLanguage: document.documentElement.lang, text: document.querySelector('#cjk-sample').textContent,
      saveName: document.querySelector('#save-name').value, visualStatus: 'Requires human/agent visual inspection; text presence is not a glyph or clipping pass.' };
    result.status = 'completed';
  } catch (error) { Object.assign(result, failure(error)); }
  finally { run.disabled = fileInput.disabled = false; pretty(result); }
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  run.disabled = fileInput.disabled = true;
  cancel.disabled = false;
  controller = new AbortController();
  pretty({ status: 'reading local selection', sourceBytes: file.size });
  try {
    pretty({ status: 'completed local read', result: await readSample(file, Math.min(file.size, 8 * 1024 * 1024), controller.signal) });
  } catch (error) { pretty(failure(error)); }
  finally { controller = undefined; cancel.disabled = true; run.disabled = fileInput.disabled = false; fileInput.value = ''; }
});
cancel.addEventListener('click', () => controller?.abort());
