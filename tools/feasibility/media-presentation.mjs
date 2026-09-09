// SPDX-License-Identifier: MIT
import { PresentationQueue, LIMITS } from './media-presentation-queue.mjs';

const input = document.querySelector('#media');
const start = document.querySelector('#start');
const stop = document.querySelector('#stop');
const output = document.querySelector('#results');
const summary = document.querySelector('#summary');
const canvas = document.querySelector('#video');
const context = canvas.getContext('2d', { alpha: false });
let session;
let starting = false;
input.addEventListener('change', () => { start.disabled = !input.files?.[0]; });

function publish(s, status) {
  const report = { status, date: new Date().toISOString(), userAgent: navigator.userAgent,
    package: '@ffmpeg/core@0.12.10', inputBytes: s.fileBytes, header: s.header, plan: s.plan,
    coreLoadMs: s.coreLoadMs, firstPresentationMs: s.firstPresentationMs, framesDisplayed: s.displayed,
    droppedFrames: s.dropped, maxFrameClockLagMs: s.maxLag, maxFrameIntervalMs: s.maxInterval,
    maxOwnedQueueBytes: s.queue?.maxBytes, wasmHeapHighWaterBytes: s.heapPeak,
    audioContextState: s.audio.state, audioOutputRmsPeak: s.rmsPeak,
    audioScheduledSamples: s.audioSamples, underrunCallbacks: s.underruns,
    jsHeapPointBytes: performance.memory?.usedJSHeapSize ?? null,
    decoderChunks: s.chunks, error: s.error, cleanup: s.cleanup,
    limitation: 'Queue/WASM high water and JS point samples are not total process peak. A/V lag is scheduling evidence, not a native-game or acoustic lip-sync comparison.' };
  output.textContent = JSON.stringify(report, null, 2);
  const lines = [
    `Status ${status}; frames ${s.displayed}/${s.plan?.frames ?? 0}; dropped ${s.dropped}; underrun callbacks ${s.underruns}`,
    `Core ${s.coreLoadMs?.toFixed(2)} ms; first frame ${s.firstPresentationMs?.toFixed(2)} ms; max decode ${Math.max(0, ...s.chunks.map(c => c.decodeMs)).toFixed(2)} ms`,
    `Queue ${s.queue?.maxBytes ?? 0} bytes; WASM ${s.heapPeak} bytes; JS point ${performance.memory?.usedJSHeapSize ?? 'unavailable'}`,
    `Audio ${s.audio.state}; RMS peak ${s.rmsPeak.toFixed(8)}; samples ${s.audioSamples}; lag ${s.maxLag.toFixed(2)} ms; frame interval ${s.maxInterval.toFixed(2)} ms`,
    `Chunks ${s.chunks.length}; input reads ${s.chunks.reduce((n, c) => n + c.io.bytes, 0)} bytes; largest read ${Math.max(0, ...s.chunks.map(c => c.io.maximumRequest))} bytes`,
    `Timestamp ${report.date}; ${navigator.userAgent}`,
  ];
  summary.replaceChildren(...lines.map(line => { const p = document.createElement('p'); p.textContent = line; return p; }));
}
function finish(s, status) {
  if (session !== s) return;
  session = undefined;
  clearTimeout(s.watchdog); cancelAnimationFrame(s.raf);
  s.worker.terminate();
  for (const source of s.audioSources) { try { source.stop(); } catch {} }
  s.cleanup = { workerTerminationRequested: true, audioCloseRequested: true, sourcesStopped: s.audioSources.size };
  s.audio.close(); s.queue?.clear(); s.audioSources.clear();
  s.cleanup.queueItemsAfterClear = s.queue?.items.length ?? 0;
  publish(s, status);
  context.clearRect(0, 0, canvas.width, canvas.height);
  input.disabled = false; input.value = ''; start.disabled = true; stop.disabled = true;
}
function request(s) {
  const index = s.queue.request();
  if (index === null) return;
  s.worker.postMessage({ type: 'decode', index });
  clearTimeout(s.watchdog);
  s.watchdog = setTimeout(() => { s.error = 'Chunk exceeded 15 second watchdog'; finish(s, 'failed'); }, 15000);
}
function schedule(s, item) {
  if (item.scheduled || s.epoch === null) return;
  item.scheduled = true;
  const values = new Float32Array(item.pcm);
  const samples = values.length / 2;
  const buffer = s.audio.createBuffer(2, samples, 44100);
  for (let channel = 0; channel < 2; channel++) {
    const target = buffer.getChannelData(channel);
    for (let index = 0; index < samples; index++) target[index] = values[index * 2 + channel];
  }
  const source = s.audio.createBufferSource();
  source.buffer = buffer; source.connect(s.gain);
  source.start(s.epoch + item.start);
  s.audioSources.add(source); source.onended = () => { source.disconnect(); s.audioSources.delete(source); };
  s.audioSamples += samples;
}
function tick(s, now) {
  if (session !== s) return;
  const time = s.audio.currentTime - s.epoch;
  s.queue.expire(time);
  request(s);
  const frame = s.queue.frame(time);
  if (frame && frame.absoluteFrame !== s.lastFrame) {
    const bytes = new Uint8ClampedArray(frame.item.video, frame.offset * s.plan.frameBytes, s.plan.frameBytes);
    context.putImageData(new ImageData(bytes, s.header.width, s.header.height), 0, 0);
    if (s.firstPresentationMs === null) s.firstPresentationMs = performance.now() - s.started;
    if (s.lastFrame >= 0) s.dropped += Math.max(0, frame.absoluteFrame - s.lastFrame - 1);
    s.lastFrame = frame.absoluteFrame; s.displayed++;
    s.maxLag = Math.max(s.maxLag, (time - frame.timestamp) * 1000);
    if (s.lastDraw !== null) s.maxInterval = Math.max(s.maxInterval, now - s.lastDraw);
    s.lastDraw = now;
  } else if (!frame && time >= 0 && time < s.plan.duration) s.underruns++;
  s.analyser.getFloatTimeDomainData(s.wave);
  let square = 0; for (const value of s.wave) square += value * value;
  s.rmsPeak = Math.max(s.rmsPeak, Math.sqrt(square / s.wave.length));
  if (time >= s.plan.duration) { finish(s, 'completed'); return; }
  if (now - s.lastReport > 500) { publish(s, 'playing'); s.lastReport = now; }
  s.raf = requestAnimationFrame(timestamp => tick(s, timestamp));
}
start.addEventListener('click', async () => {
  const file = input.files?.[0];
  if (!file || session || starting) return;
  starting = true; start.disabled = true;
  let audio;
  try {
    audio = new AudioContext({ sampleRate: 44100 });
  await audio.resume();
  } catch (error) {
    starting = false; start.disabled = false; output.textContent = `Audio initialization failed: ${error.message}`;
    if (audio) await audio.close();
    return;
  }
  starting = false;
  const gain = audio.createGain(); gain.gain.value = 0.15;
  const analyser = audio.createAnalyser(); analyser.fftSize = 2048;
  gain.connect(analyser); analyser.connect(audio.destination);
  const s = { worker: new Worker('/media-presentation-worker.mjs', { type: 'module' }), audio, gain, analyser,
    wave: new Float32Array(2048), fileBytes: file.size, started: performance.now(), queue: null, epoch: null,
    displayed: 0, dropped: 0, lastFrame: -1, maxLag: 0, maxInterval: 0, lastDraw: null, firstPresentationMs: null,
    rmsPeak: 0, audioSamples: 0, audioSources: new Set(), heapPeak: 0, chunks: [], underruns: 0, lastReport: 0 };
  session = s; input.disabled = true; start.disabled = true; stop.disabled = false;
  publish(s, 'loading');
  s.watchdog = setTimeout(() => { s.error = 'Core initialization exceeded 20 seconds'; finish(s, 'failed'); }, 20000);
  s.worker.onerror = event => { s.error = event.message; finish(s, 'failed'); };
  s.worker.onmessage = ({ data }) => {
    if (session !== s) return;
    try {
      if (data.type === 'error') throw new Error(data.error);
      clearTimeout(s.watchdog);
      s.heapPeak = Math.max(s.heapPeak, data.heapBytes ?? 0);
      if (data.type === 'ready') {
        s.header = data.header; s.plan = data.plan; s.coreLoadMs = data.coreLoadMs;
        s.queue = new PresentationQueue(data.plan); canvas.width = data.header.width; canvas.height = data.header.height;
        request(s);
      } else if (data.type === 'chunk') {
        s.queue.receive(data);
        s.chunks.push({ index: data.index, decodeMs: data.decodeMs, heapBytes: data.heapBytes, videoBytes: data.videoSize, pcmBytes: data.pcmSize, io: data.io });
        if (s.epoch === null && (s.queue.items.length === LIMITS.queuedChunks || s.queue.next === s.plan.chunks)) {
          s.epoch = s.audio.currentTime + 0.15;
          s.raf = requestAnimationFrame(timestamp => tick(s, timestamp));
        }
        for (const item of s.queue.items) schedule(s, item);
        request(s);
      } else throw new Error('Unexpected worker response');
    } catch (error) { s.error = error.message; finish(s, 'failed'); }
  };
  s.worker.postMessage({ type: 'start', file, seconds: Number(document.querySelector('#duration').value) });
});
stop.addEventListener('click', () => { if (session) finish(session, 'cancelled'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && session) finish(session, 'cancelled because page hidden'); });
