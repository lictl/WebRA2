// SPDX-License-Identifier: MIT
import { MediaClient } from '../../packages/media/src/client.ts';
import { audioWindow, MediaQueue, type Header, type MediaEvent } from '../../packages/media/src/session.ts';
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const file = el<HTMLInputElement>('file'), track = el<HTMLInputElement>('track'), identity = el<HTMLInputElement>('identity'), status = el('status'), report = el('report'), canvas = el<HTMLCanvasElement>('video');
const buttons = Object.fromEntries(['play', 'pause', 'resume', 'seek', 'skip', 'cancel'].map(id => [id, el<HTMLButtonElement>(id)]));
const ctx = canvas.getContext('2d', { alpha: false })!;
let client: MediaClient | undefined, audio: AudioContext | undefined, analyser: AnalyserNode | undefined, header: Header | undefined;
let state = 'idle', generation = 0, queue = new MediaQueue(), pumping = false, eof = false;
let epoch: number | undefined, target = 0, started = 0, lastReport = 0, frameId = 0;
const sources = new Set<AudioBufferSourceNode>();
let metrics: Record<string, unknown> = {};
let displayed = 0, dropped = 0, scheduled = 0, trimmed = 0, peakSources = 0, scheduledBytes = 0, peakScheduledBytes = 0, maxLag = 0, rmsPeak = 0;
function controls(): void {
  buttons.play!.disabled = !['idle', 'ended', 'skipped', 'cancelled', 'failed'].includes(state);
  buttons.pause!.disabled = state !== 'playing'; buttons.resume!.disabled = state !== 'paused';
  buttons.seek!.disabled = !['playing', 'paused'].includes(state) || !header || header.duration <= 10;
  buttons.skip!.disabled = buttons.cancel!.disabled = !client;
  file.disabled = track.disabled = identity.disabled = !!client;
}
function playhead(): number { return epoch === undefined || !audio ? target : Math.max(target, audio.currentTime - epoch); }
function update(): void {
  Object.assign(metrics, { state, position: Number(playhead().toFixed(4)), displayed, dropped, scheduledSamplesPerChannel: scheduled, trimmedSamplesPerChannel: trimmed,
    peakOwnedQueueBytes: queue.peakBytes, peakQueueItems: queue.peakItems, retainedQueueBytes: queue.bytes, retainedQueueItems: queue.length, peakScheduledAudioSources: peakSources, activeAudioSources: sources.size,
    peakScheduledAudioBytes: peakScheduledBytes, scheduledAudioBytes: scheduledBytes, maxVideoClockLagMs: maxLag, rmsPeak, audioState: audio?.state ?? 'absent' });
  report.textContent = JSON.stringify(metrics, null, 2); controls();
}
async function cleanup(next: string): Promise<void> {
  generation++; state = next; client?.stop(); client = undefined; pumping = false; cancelAnimationFrame(frameId);
  for (const source of sources) { source.onended = null; try { source.stop(); } catch { /* Already ended. */ } source.disconnect(); }
  sources.clear(); scheduledBytes = 0; queue.clear(); metrics.workerTerminated = true;
  if (audio && audio.state !== 'closed') await audio.close();
  status.textContent = `${next}. Local buffers released.`; update();
}
function fail(error: unknown): void { metrics.error = error instanceof Error ? error.message : 'playback-failure'; void cleanup('failed'); }
function requestPump(): void { const current = generation; if (!pumping) void pump().catch(error => { if (current === generation) fail(error); }); }
async function pump(): Promise<void> {
  if (!client || eof || !['loading', 'playing'].includes(state)) return;
  const current = generation; pumping = true;
  try {
    while (current === generation && client && !eof && ['loading', 'playing'].includes(state) && queue.available && sources.size < 24) {
      const response = await client.request('next');
      if (current !== generation) return;
      metrics.io = response.io; metrics.wasmBytes = response.heap; metrics.maxDecodeMs = Math.max(Number(metrics.maxDecodeMs ?? 0), response.decodeMs ?? 0);
      if (response.type === 'eof') { eof = true; break; }
      const event = response.event!;
      // Explicit seek preroll: demuxer resets once; output before target is discarded.
      if (event.pts + event.duration <= target) continue;
      queue.push(event);
      if (epoch === undefined && event.kind === 'video') {
        epoch = audio!.currentTime + 0.15 - target; state = 'playing'; status.textContent = 'Playing local decoded video and PCM.';
        metrics.firstFrameReadyMs = performance.now() - started; controls();
      }
    }
  } finally { if (current === generation) pumping = false; }
}
function tick(): void {
  if (!client) return;
  if (state === 'playing' && audio && epoch !== undefined) {
    const now = playhead(); let latest: MediaEvent | undefined;
    let audioSlots = 24 - sources.size;
    const ready = queue.takeWhere(event => event.kind === 'video' ? event.pts <= now && audio!.currentTime >= epoch! + target : event.pts <= now + 0.25 && audioSlots-- > 0);
    for (const event of ready) {
      if (event.kind === 'video' && event.pts <= now && audio.currentTime >= epoch + target) {
        if (latest) dropped++; latest = event;
      } else if (event.kind === 'audio' && event.pts <= now + 0.25 && sources.size < 24) {
        const window = audioWindow(event.pts, event.samples, event.rate, Math.max(target, audio.currentTime - epoch + 0.005));
        trimmed += window.trim;
        if (window.count) {
          const buffer = audio.createBuffer(event.channels, window.count, event.rate), pcm = new Float32Array(event.buffer);
          for (let c = 0; c < event.channels; c++) { const plane = buffer.getChannelData(c); for (let i = 0; i < window.count; i++) plane[i] = pcm[(i + window.trim) * event.channels + c]!; }
          const source = audio.createBufferSource(); source.buffer = buffer; source.connect(analyser!); sources.add(source); peakSources = Math.max(peakSources, sources.size);
          const owned = window.count * event.channels * 4; scheduledBytes += owned; peakScheduledBytes = Math.max(peakScheduledBytes, scheduledBytes);
          source.onended = () => { sources.delete(source); scheduledBytes -= owned; source.disconnect(); };
          source.start(epoch + window.start); scheduled += window.count;
        }
      }
    }
    if (latest) { ctx.putImageData(new ImageData(new Uint8ClampedArray(latest.buffer), latest.width, latest.height), 0, 0); displayed++; if (metrics.firstPresentedMs === undefined) metrics.firstPresentedMs = performance.now() - started; maxLag = Math.max(maxLag, (now - latest.pts) * 1000); }
    const waveform = new Float32Array(analyser!.fftSize); analyser!.getFloatTimeDomainData(waveform); let sum = 0; for (const n of waveform) sum += n * n; rmsPeak = Math.max(rmsPeak, Math.sqrt(sum / waveform.length));
    if (eof && !queue.length && !sources.size && now >= header!.duration) { void cleanup('ended'); return; }
  }
  requestPump();
  if (performance.now() - lastReport > 250) { update(); lastReport = performance.now(); }
  frameId = requestAnimationFrame(tick);
}
buttons.play!.onclick = async () => {
  if (!file.files?.[0] || buttons.play!.disabled) return;
  const selected = file.files[0]; generation++; state = 'loading'; target = 0; epoch = undefined; eof = false; queue = new MediaQueue();
  displayed = dropped = scheduled = trimmed = peakSources = scheduledBytes = peakScheduledBytes = maxLag = rmsPeak = 0;
  metrics = { schemaVersion: 1, selectedBytes: selected.size, sourceIdentity: 'pending', hashingReadBytes: selected.size, headerReadBytes: 44, maxDecodeMs: 0 };
  audio = new AudioContext(); analyser = audio.createAnalyser(); analyser.fftSize = 1024;
  const gain = audio.createGain(); gain.gain.value = 0.15; analyser.connect(gain); gain.connect(audio.destination);
  client = new MediaClient(new Worker('/worker.js', { type: 'module' })); const current = generation; started = performance.now();
  status.textContent = 'Authenticating local bytes and loading the narrow decoder…'; update();
  try {
    await audio.resume();
    const result = await client.request('open', { file: selected, track: Number(track.value), expected: identity.value.trim() || null });
    if (generation !== current) return;
    header = result.header!; canvas.width = header.width; canvas.height = header.height;
    Object.assign(metrics, { sourceIdentity: result.identity, identityCheck: identity.value.trim() ? 'expected-match' : 'locally-computed', header, selectedTrack: Number(track.value), loadMs: result.loadMs, io: result.io, wasmBytes: result.heap });
    frameId = requestAnimationFrame(tick); requestPump();
  } catch (error) { if (generation === current) fail(error); }
};
buttons.pause!.onclick = async () => { if (state === 'playing' && audio) { state = 'paused'; await audio.suspend(); status.textContent = 'Paused. Audio clock and presentation are frozen.'; update(); } };
buttons.resume!.onclick = async () => { if (state === 'paused' && audio) { await audio.resume(); state = 'playing'; status.textContent = 'Playing local decoded video and PCM.'; update(); requestPump(); } };
buttons.seek!.onclick = async () => {
  if (!client || buttons.seek!.disabled) return;
  state = 'seeking'; controls(); status.textContent = 'Seeking: resetting decoder and discarding preroll…';
  while (pumping && client) await new Promise(resolve => setTimeout(resolve, 0));
  if (!client) return;
  try {
    for (const source of sources) { source.onended = null; source.stop(); source.disconnect(); } sources.clear();
    queue.clear(); scheduledBytes = 0; target = 10; epoch = undefined; eof = false; started = performance.now();
    await audio!.resume(); await client.request('seek', { seconds: target }); state = 'loading'; requestPump();
  } catch (error) { fail(error); }
};
buttons.skip!.onclick = () => { void cleanup('skipped'); }; buttons.cancel!.onclick = () => { void cleanup('cancelled'); };
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') buttons.pause!.click(); });
window.addEventListener('pagehide', () => { void cleanup('cancelled'); });
controls();
