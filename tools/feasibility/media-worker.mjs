import createFFmpegCore from '/media-core/ffmpeg-core.js';
import { inspectBinkHeader } from './bink-header.mjs';

self.onmessage = async ({ data: file }) => {
  try {
    if (!(file instanceof Blob) || file.size > 64 * 1024 * 1024 || file.size < 44) throw new Error('Expected bounded local File');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const header = inspectBinkHeader(bytes);
    const began = performance.now();
    const core = await createFFmpegCore({ locateFile: () => '/media-core/ffmpeg-core.wasm' });
    const loaded = performance.now();
    const logs = [];
    core.setLogger(({ message }) => { if (logs.length < 80) logs.push(message); });
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
    core.FS.writeFile('sample.bik', bytes);
    const decoded = performance.now();
    const exitCode = core.exec('-hide_banner', '-i', 'sample.bik', '-t', '3', '-f', 'null', '-');
    const finished = performance.now();
    core.FS.unlink('sample.bik');
    self.postMessage({ status: exitCode === 0 ? 'completed decode' : 'failed decode',
      date: new Date().toISOString(), userAgent: navigator.userAgent, sampleBytes: bytes.length, sampleSHA256: hash,
      package: '@ffmpeg/core@0.12.10', exitCode, header,
      coreLoadMs: Math.round(loaded - began), sampleHashAndCodecCopyMs: Math.round(decoded - loaded), decodeMs: Math.round(finished - decoded),
      wasmHeapBytesAfterDecode: core.HEAPU8?.byteLength ?? null,
      limitation: 'Null-sink decode only; heap is a point sample, not total or peak memory; no frame presentation, audio scheduling, A/V sync or large-sample acceptance.', logs });
  } catch (error) {
    self.postMessage({ status: 'failed', error: `${error.name}: ${error.message}` });
  }
};
