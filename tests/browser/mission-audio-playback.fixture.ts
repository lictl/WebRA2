// SPDX-License-Identifier: GPL-3.0-or-later
// Original WebRA2 fixtures; no retail audio.
import { createHash } from 'node:crypto';
import { decodeMissionAudio } from '../../packages/formats/src/mission-audio-decode.ts';
import type { BrowserPcmEnvironment } from '../../packages/audio/src/browser-pcm-playback.ts';

export function originalPcm(samples = [-32768, 0, 16384, 32767], channels: 1 | 2 = 1) {
  const bytes = new Uint8Array(samples.length * 2), view = new DataView(bytes.buffer);
  samples.forEach((v, i) => view.setInt16(i * 2, v, true));
  return decodeMissionAudio({ kind: 'indexed', bytes, expectedSha256: createHash('sha256').update(bytes).digest('hex'),
    flags: channels === 1 ? 6 : 7, sampleRate: 22050, chunkSize: 0 });
}
export function registration(pcm = originalPcm(), sessionId = 1, profile: 'ra2' | 'yr' = 'ra2', sampleId = 'tone') {
  return { pcm, sessionId, profile, sampleId, expectedEncodedSha256: pcm.encodedSha256, expectedPcmSha256: pcm.pcmSha256,
    expectedDecodeSha256: pcm.sha256 };
}
export function deferred() {
  let resolve!: () => void, reject!: (error?: unknown) => void;
  const promise = new Promise<void>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
export class FakeBuffer {
  readonly channels: Float32Array[];
  constructor(channels: number, frames: number) { this.channels = Array.from({ length: channels }, () => new Float32Array(frames)); }
  getChannelData(channel: number) { return this.channels[channel]!; }
}
export class FakeSource {
  buffer: FakeBuffer | null = null;
  onended: (() => void) | null = null;
  starts: number[] = [];
  stops = 0;
  disconnected = false;
  constructor(readonly context: FakeContext) {}
  connect() {}
  disconnect() { this.disconnected = true; }
  start(when: number) { if (this.context.failStart) throw new Error('original start failure'); this.starts.push(when); }
  stop() { this.stops++; }
  end() { this.onended?.(); }
}
export class FakeContext {
  state: AudioContextState = 'suspended';
  currentTime = 0;
  readonly destination = {};
  readonly sources: FakeSource[] = [];
  readonly buffers: FakeBuffer[] = [];
  readonly gain = { gain: { value: 1 }, connect() {}, disconnect() {} };
  resumeDeferred: ReturnType<typeof deferred> | null = null;
  suspendDeferred: ReturnType<typeof deferred> | null = null;
  closeDeferred: ReturnType<typeof deferred> | null = null;
  failBuffer = false;
  failStart = false;
  failGain = false;
  resumes = 0; suspends = 0; closes = 0;
  createGain() { if (this.failGain) throw new Error('original gain failure'); return this.gain; }
  createBuffer(channels: number, frames: number) {
    if (this.failBuffer) throw new Error('original allocation failure');
    const buffer = new FakeBuffer(channels, frames); this.buffers.push(buffer); return buffer;
  }
  createBufferSource() { const source = new FakeSource(this); this.sources.push(source); return source; }
  async resume() { this.resumes++; await this.resumeDeferred?.promise; this.state = 'running'; }
  async suspend() { this.suspends++; await this.suspendDeferred?.promise; this.state = 'suspended'; }
  async close() { this.closes++; await this.closeDeferred?.promise; this.state = 'closed'; }
  advance(seconds: number) { if (this.state === 'running') this.currentTime += seconds; }
}
export function fakeEnvironment() {
  const contexts: FakeContext[] = [];
  const control = { activated: true, next: null as FakeContext | null };
  const environment: BrowserPcmEnvironment = {
    hasUserActivation: () => control.activated,
    createContext: () => { const context = control.next ?? new FakeContext(); control.next = null;
      contexts.push(context); return context as unknown as AudioContext; },
  };
  return { contexts, control, environment };
}
