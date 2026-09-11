// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../PROVENANCE.md.
import { copyMissionAudioPcm, isMissionAudioPcm, type MissionAudioPcm } from '../../formats/src/mission-audio-decode.ts';

export const BROWSER_PCM_PLAYBACK_POLICY = 'webra2-browser-pcm-playback-1' as const;
export const BROWSER_PCM_PLAYBACK_LIMITS = Object.freeze({ samples: 32, pcmBytes: 32 * 1024 * 1024,
  voices: 8, voiceBytes: 32 * 1024 * 1024 });
export type BrowserPcmLimits = { readonly [K in keyof typeof BROWSER_PCM_PLAYBACK_LIMITS]: number };
export interface BrowserPcmSession { readonly sessionId: number; readonly profile: 'ra2' | 'yr' }
export interface BrowserPcmRegistration extends BrowserPcmSession {
  readonly sampleId: string; readonly pcm: MissionAudioPcm;
  readonly expectedEncodedSha256: string; readonly expectedPcmSha256: string; readonly expectedDecodeSha256: string;
}
export interface BrowserPcmRequest { readonly sessionId: number; readonly requestId: number; readonly sampleId: string }
/** Trusted host capability, injectable for controlled original tests. Never imported content. */
export interface BrowserPcmEnvironment {
  readonly hasUserActivation: () => boolean;
  readonly createContext: () => AudioContext;
}
export class BrowserPcmPlaybackError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'BrowserPcmPlaybackError'; }
}
function fail(code: string): never { throw new BrowserPcmPlaybackError(code); }
function row(value: unknown, keys: readonly string[], required = keys): Record<string, unknown> {
  try {
    if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('input-shape');
    const out: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string' || !keys.includes(key)) fail('input-shape');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) fail('input-shape');
      out[key] = descriptor.value;
    }
    for (const key of required) if (!Object.hasOwn(out, key)) fail('input-shape');
    return out;
  } catch (error) { if (error instanceof BrowserPcmPlaybackError) throw error; return fail('input-shape'); }
}
function integer(value: unknown, max = Number.MAX_SAFE_INTEGER, min = 1): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || Object.is(value, -0) || value < min || value > max) fail('input-integer');
  return value;
}
function sampleId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value)) fail('sample-id');
  return value;
}
function session(value: BrowserPcmSession): BrowserPcmSession {
  const s = row(value, ['sessionId', 'profile']);
  if (s.profile !== 'ra2' && s.profile !== 'yr') fail('profile');
  return Object.freeze({ sessionId: integer(s.sessionId), profile: s.profile });
}
function limits(value: Partial<BrowserPcmLimits>): BrowserPcmLimits {
  const out: { -readonly [K in keyof BrowserPcmLimits]: number } = { ...BROWSER_PCM_PLAYBACK_LIMITS };
  const r = row(value, Object.keys(out), []);
  for (const key of Object.keys(r) as (keyof BrowserPcmLimits)[]) out[key] = integer(r[key], out[key], 0);
  return Object.freeze(out);
}
type Sample = { readonly metadata: Readonly<Pick<MissionAudioPcm, 'channels' | 'frames' | 'sampleRate' | 'scalarSamples' | 'pcmBytes'>>;
  readonly data: Int16Array };
type Voice = { readonly requestId: number; readonly sampleId: string; readonly bytes: number;
  readonly node: AudioBufferSourceNode; readonly startTime: number; readonly duration: number };
type Operation = { readonly kind: 'activate' | 'pause'; readonly cancel: () => void };
type Resource = { readonly context: AudioContext; readonly gain: GainNode; readonly generation: number;
  readonly voices: Map<number, Voice>; operation: Operation | null; paused: boolean };
type Retirement = { readonly resource: Resource; promise: Promise<void>; failed: boolean };
const nativeEnvironment: BrowserPcmEnvironment = {
  hasUserActivation: () => typeof navigator !== 'undefined' && navigator.userActivation?.isActive === true
    && typeof document !== 'undefined' && document.visibilityState === 'visible',
  createContext: () => new AudioContext(),
};

/** Output only. Session/profile labels are caller-owned joins, never native selection authority. */
export class BrowserPcmPlayback {
  readonly #limits: BrowserPcmLimits;
  get limits(): BrowserPcmLimits { return this.#limits; }
  #session: BrowserPcmSession;
  #environment: BrowserPcmEnvironment;
  #samples = new Map<string, Sample>();
  #pcmBytes = 0;
  #lastRequest = 0;
  #generation = 1;
  #resource: Resource | null = null;
  #retiring: Retirement | null = null;
  #disposed = false;
  #gain = 1;
  #muted = false;

  constructor(initial: BrowserPcmSession, lowerLimits: Partial<BrowserPcmLimits> = {}, environment: BrowserPcmEnvironment = nativeEnvironment) {
    this.#session = session(initial); this.#limits = limits(lowerLimits); this.#environment = environment;
  }
  #live(id: unknown): void {
    if (this.#disposed) fail('disposed');
    if (integer(id) !== this.#session.sessionId) fail('stale-session');
  }
  #current(resource: Resource): boolean { return this.#resource === resource && resource.generation === this.#generation && !this.#disposed; }
  #level(resource: Resource): void { resource.gain.gain.value = resource.paused || resource.operation || this.#muted ? 0 : this.#gain; }
  #release(resource: Resource, voice: Voice, stop: boolean): void {
    if (resource.voices.get(voice.requestId) !== voice) return;
    resource.voices.delete(voice.requestId); voice.node.onended = null;
    if (stop) { try { voice.node.stop(); } catch { /* Already ended/closed. */ } }
    try { voice.node.disconnect(); } catch { /* Disconnection is idempotent cleanup. */ }
    voice.node.buffer = null;
  }
  #stopAll(resource: Resource): void { for (const voice of resource.voices.values()) this.#release(resource, voice, true); }

  register(input: BrowserPcmRegistration): Readonly<{ sampleId: string; pcmSha256: string; pcmBytes: number }> {
    const r = row(input, ['sessionId', 'profile', 'sampleId', 'pcm', 'expectedEncodedSha256', 'expectedPcmSha256', 'expectedDecodeSha256']);
    this.#live(r.sessionId);
    if (r.profile !== this.#session.profile) fail('profile-mismatch');
    const id = sampleId(r.sampleId), pcm = r.pcm;
    if (!isMissionAudioPcm(pcm)) fail('pcm-brand');
    if (r.expectedEncodedSha256 !== pcm.encodedSha256 || r.expectedPcmSha256 !== pcm.pcmSha256 || r.expectedDecodeSha256 !== pcm.sha256) fail('source-mismatch');
    if (this.#samples.has(id)) fail('sample-exists');
    if (this.#samples.size >= this.limits.samples || pcm.pcmBytes > this.limits.pcmBytes - this.#pcmBytes) fail('cache-limit');
    // Decoder metadata is branded/frozen. Reserve capacity before its one owned copy.
    const data = copyMissionAudioPcm(pcm);
    const metadata = Object.freeze({ channels: pcm.channels, frames: pcm.frames, sampleRate: pcm.sampleRate,
      scalarSamples: pcm.scalarSamples, pcmBytes: pcm.pcmBytes });
    // Do not retain the branded decoder result: its WeakMap owns another PCM buffer.
    this.#samples.set(id, { metadata, data }); this.#pcmBytes += pcm.pcmBytes;
    return Object.freeze({ sampleId: id, pcmSha256: pcm.pcmSha256, pcmBytes: pcm.pcmBytes });
  }
  unregister(input: { readonly sessionId: number; readonly sampleId: string }): boolean {
    const r = row(input, ['sessionId', 'sampleId']); this.#live(r.sessionId);
    const id = sampleId(r.sampleId), sample = this.#samples.get(id);
    if (!sample) return false;
    this.#samples.delete(id); this.#pcmBytes -= sample.metadata.pcmBytes; return true;
  }

  /** Must be invoked during a real user gesture, including resuming paused audio. */
  activate(sessionId: number): Promise<void> {
    this.#live(sessionId);
    if (!this.#environment.hasUserActivation()) fail('user-activation-required');
    if (this.#retiring) fail(this.#retiring.failed ? 'context-close-failed' : 'context-closing');
    let resource = this.#resource;
    if (resource?.operation) fail('lifecycle-busy');
    if (!resource) {
      const context = this.#environment.createContext();
      // Keep even a partially initialized context counted until close completes.
      let gain: GainNode;
      try { gain = context.createGain(); gain.gain.value = 0; gain.connect(context.destination); }
      catch (error) {
        const receipt = { context, gain: null as unknown as GainNode, generation: this.#generation,
          voices: new Map<number, Voice>(), operation: null, paused: true };
        this.#beginClose(receipt); throw error;
      }
      resource = { context, gain, generation: this.#generation, voices: new Map(), operation: null, paused: true };
      this.#resource = resource;
    }
    if (!resource.paused && resource.context.state === 'running') return Promise.resolve();
    return this.#operate(resource, 'activate');
  }
  pause(sessionId: number): Promise<void> {
    this.#live(sessionId);
    const resource = this.#resource;
    if (!resource) return Promise.resolve();
    if (resource.operation) fail('lifecycle-busy');
    if (resource.paused && resource.context.state === 'suspended') return Promise.resolve();
    return this.#operate(resource, 'pause');
  }
  #operate(resource: Resource, kind: Operation['kind']): Promise<void> {
    let cancel!: () => void;
    const cancelled = new Promise<never>((_, reject) => { cancel = () => reject(new BrowserPcmPlaybackError('operation-cancelled')); });
    const operation: Operation = { kind, cancel }; resource.operation = operation;
    // No sound while a lifecycle transition is unresolved. No command waits behind it.
    resource.gain.gain.value = 0;
    let native: Promise<void>;
    try { native = kind === 'activate' ? resource.context.resume() : resource.context.suspend(); }
    catch (error) { native = Promise.reject(error); }
    return Promise.race([native, cancelled]).then(() => {
      if (!this.#current(resource) || resource.operation !== operation) fail('operation-cancelled');
      if (resource.context.state !== (kind === 'activate' ? 'running' : 'suspended')) fail('context-state');
      resource.paused = kind === 'pause';
    }).catch((error: unknown) => {
      if (this.#current(resource) && resource.operation === operation) resource.paused = true;
      if (error instanceof BrowserPcmPlaybackError) throw error;
      throw new BrowserPcmPlaybackError(kind === 'activate' ? 'resume-failed' : 'suspend-failed');
    }).finally(() => {
      if (this.#current(resource) && resource.operation === operation) { resource.operation = null; this.#level(resource); }
    });
  }

  /** Synchronous preflight/admission: only a successfully started voice consumes requestId. */
  play(input: BrowserPcmRequest): Readonly<{ requestId: number; startTime: number; duration: number }> {
    const r = row(input, ['sessionId', 'requestId', 'sampleId']); this.#live(r.sessionId);
    const requestId = integer(r.requestId), id = sampleId(r.sampleId);
    if (requestId <= this.#lastRequest) fail('obsolete-request');
    const sample = this.#samples.get(id); if (!sample) fail('unknown-sample');
    const resource = this.#resource;
    if (!resource || resource.paused || resource.operation || resource.context.state !== 'running') fail('playback-unavailable');
    const bytes = sample.metadata.scalarSamples * Float32Array.BYTES_PER_ELEMENT;
    const used = [...resource.voices.values()].reduce((n, v) => n + v.bytes, 0);
    if (resource.voices.size >= this.limits.voices || bytes > this.limits.voiceBytes - used) fail('voice-limit');
    const { channels, frames, sampleRate } = sample.metadata;
    let node: AudioBufferSourceNode | null = null;
    let voice: Voice | null = null;
    try {
      const buffer = resource.context.createBuffer(channels, frames, sampleRate);
      for (let channel = 0; channel < channels; channel++) {
        const output = buffer.getChannelData(channel);
        for (let frame = 0; frame < frames; frame++) output[frame] = sample.data[frame * channels + channel]! / 32768;
      }
      node = resource.context.createBufferSource(); node.buffer = buffer; node.connect(resource.gain);
      voice = { requestId, sampleId: id, bytes, node, startTime: resource.context.currentTime, duration: frames / sampleRate };
      const owned = voice;
      node.onended = () => this.#release(resource, owned, false);
      resource.voices.set(requestId, voice);
      node.start(0);
      this.#lastRequest = requestId;
      return Object.freeze({ requestId, startTime: voice.startTime, duration: voice.duration });
    } catch {
      if (voice) this.#release(resource, voice, true);
      else if (node) { try { node.disconnect(); } catch { /* Failed allocation cleanup. */ } node.buffer = null; }
      return fail('voice-start-failed');
    }
  }
  stop(input: { readonly sessionId: number; readonly requestId: number }): boolean {
    const r = row(input, ['sessionId', 'requestId']); this.#live(r.sessionId);
    const id = integer(r.requestId), resource = this.#resource, voice = resource?.voices.get(id);
    if (!resource || !voice) return false;
    this.#release(resource, voice, true); return true;
  }
  stopAll(sessionId: number): void { this.#live(sessionId); if (this.#resource) this.#stopAll(this.#resource); }
  setOutput(input: { readonly sessionId: number; readonly gain: number; readonly muted: boolean }): void {
    const r = row(input, ['sessionId', 'gain', 'muted']); this.#live(r.sessionId);
    if (typeof r.gain !== 'number' || !Number.isFinite(r.gain) || r.gain < 0 || r.gain > 1 || Object.is(r.gain, -0)
      || typeof r.muted !== 'boolean') fail('output-level');
    this.#gain = r.gain; this.#muted = r.muted;
    if (this.#resource) this.#level(this.#resource);
  }
  /** Synchronous invalidation/cleanup; returned promise reports native close completion. */
  replaceSession(next: BrowserPcmSession): Promise<void> {
    if (this.#disposed) fail('disposed');
    const replacement = session(next);
    if (replacement.sessionId <= this.#session.sessionId) fail('obsolete-session');
    this.#generation++; this.#session = replacement; this.#lastRequest = 0;
    this.#samples.clear(); this.#pcmBytes = 0;
    return this.#retire();
  }
  dispose(): Promise<void> {
    if (!this.#disposed) { this.#disposed = true; this.#generation++; this.#samples.clear(); this.#pcmBytes = 0; }
    return this.#retire();
  }
  #retire(): Promise<void> {
    const resource = this.#resource; this.#resource = null;
    if (resource) {
      resource.operation?.cancel(); resource.operation = null;
      resource.gain.gain.value = 0; this.#stopAll(resource);
      return this.#beginClose(resource);
    }
    return this.#retiring?.promise ?? Promise.resolve();
  }
  #beginClose(resource: Resource): Promise<void> {
    try { resource.gain?.disconnect(); } catch { /* Muted resource is still counted. */ }
    const receipt: Retirement = { resource, promise: Promise.resolve(), failed: false };
    this.#retiring = receipt;
    return this.#close(receipt);
  }
  #close(receipt: Retirement): Promise<void> {
    receipt.failed = false;
    let native: Promise<void>;
    try { native = receipt.resource.context.close(); } catch (error) { native = Promise.reject(error); }
    receipt.promise = native.then(() => {
      if (receipt.resource.context.state !== 'closed') fail('context-close-failed');
      if (this.#retiring === receipt) this.#retiring = null;
    }).catch(() => { receipt.failed = true; throw new BrowserPcmPlaybackError('context-close-failed'); });
    // Constructor failure can start cleanup without returning its promise. Retain rejection in receipt.
    void receipt.promise.catch(() => {});
    return receipt.promise;
  }
  /** Failed close remains counted. Explicit retry can reclaim it, even after disposal. */
  retryClose(): Promise<void> {
    const receipt = this.#retiring;
    if (!receipt) return Promise.resolve();
    return receipt.failed ? this.#close(receipt) : receipt.promise;
  }
  snapshot() {
    const resource = this.#resource;
    const voices = Object.freeze([...(resource?.voices.values() ?? [])].map(v => Object.freeze({
      requestId: v.requestId, sampleId: v.sampleId, startTime: v.startTime, duration: v.duration, sampleBytes: v.bytes,
    })));
    return Object.freeze({ policy: BROWSER_PCM_PLAYBACK_POLICY, ...this.#session, disposed: this.#disposed,
      contextState: resource?.context.state ?? null, lifecycle: resource?.operation?.kind ?? null,
      paused: resource?.context.state === 'suspended',
      activated: !!resource && !resource.paused && !resource.operation && resource.context.state === 'running',
      cachedSamples: this.#samples.size, cachedPcmBytes: this.#pcmBytes, activeVoices: voices.length,
      activeSampleBytes: voices.reduce((n, v) => n + v.sampleBytes, 0),
      retiringContexts: this.#retiring ? 1 : 0, closeFailed: this.#retiring?.failed ?? false,
      lastAcceptedRequestId: this.#lastRequest, gain: this.#gain, muted: this.#muted, voices });
  }
}
