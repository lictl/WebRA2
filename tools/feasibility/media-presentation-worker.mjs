// SPDX-License-Identifier: MIT
import createFFmpegCore from '/media-core/ffmpeg-core.js';
import { presentationHeader, presentationPlan, chunkPlan, LIMITS } from './media-presentation-queue.mjs';

let core, header, plan, busy = false;
let expectedIndex = 0;
let io = { reads: 0, bytes: 0, maximumRequest: 0, minimumOffset: null, maximumOffset: 0 };
self.onmessage = async ({ data }) => {
  try {
    if (busy) throw new Error('Concurrent decoder command');
    busy = true;
    if (data.type === 'start') {
      if (core || !(data.file instanceof Blob)) throw new Error('Expected fresh local File/Blob');
      header = presentationHeader(new Uint8Array(await data.file.slice(0, 44).arrayBuffer()), data.file.size);
      plan = presentationPlan(header, data.seconds);
      const started = performance.now();
      core = await createFFmpegCore({ locateFile: () => '/media-core/ffmpeg-core.wasm' });
      core.setLogger(() => {}); // Codec diagnostics may contain original metadata; never publish its logs.
      const fs = core.FS.filesystems.WORKERFS;
      const read = fs.stream_ops.read;
      fs.stream_ops.read = function(stream, buffer, offset, length, position) {
        const result = read.call(this, stream, buffer, offset, length, position);
        io.reads++; io.bytes += result; io.maximumRequest = Math.max(io.maximumRequest, length);
        io.minimumOffset = Math.min(io.minimumOffset ?? position, position);
        io.maximumOffset = Math.max(io.maximumOffset, position + result);
        return result;
      };
      core.FS.mkdir('/input');
      core.FS.mount(fs, { blobs: [{ name: 'local.bik', data: data.file }] }, '/input');
      self.postMessage({ type: 'ready', header, plan, coreLoadMs: performance.now() - started, heapBytes: core.HEAPU8.byteLength });
    } else if (data.type === 'decode') {
      if (!core || data.index !== expectedIndex++) throw new Error('Invalid decoder sequence');
      const chunk = chunkPlan(plan, data.index);
      io = { reads: 0, bytes: 0, maximumRequest: 0, minimumOffset: null, maximumOffset: 0 };
      const started = performance.now();
      core.reset();
      core.setTimeout(10000);
      const code = core.exec('-hide_banner', '-loglevel', 'error', '-nostdin', '-ss', String(chunk.start), '-i', '/input/local.bik',
        '-t', String(chunk.duration), '-map', '0:v:0', '-an', '-pix_fmt', 'rgba', '-f', 'rawvideo', '-y', '/video.raw',
        '-t', String(chunk.duration), '-map', '0:a:0', '-vn', '-ac', '2', '-ar', '44100', '-c:a', 'pcm_f32le', '-f', 'f32le', '-y', '/audio.raw');
      if (code !== 0) throw new Error(`Decoder exit ${code}`);
      const videoSize = core.FS.stat('/video.raw').size;
      const pcmSize = core.FS.stat('/audio.raw').size;
      if (videoSize !== chunk.videoBytes || pcmSize > 1024 * 1024 || videoSize + pcmSize > LIMITS.chunkBytes) throw new RangeError('Decoded output exceeds exact chunk bounds');
      const video = core.FS.readFile('/video.raw');
      const pcm = core.FS.readFile('/audio.raw');
      core.FS.unlink('/video.raw'); core.FS.unlink('/audio.raw');
      self.postMessage({ type: 'chunk', index: chunk.index, video: video.buffer, pcm: pcm.buffer,
        decodeMs: performance.now() - started, heapBytes: core.HEAPU8.byteLength, io: { ...io }, videoSize, pcmSize }, [video.buffer, pcm.buffer]);
    } else throw new Error('Unknown worker request');
  } catch (error) {
    self.postMessage({ type: 'error', error: `${error.name}: ${error.message}` });
  } finally { busy = false; }
};
