// SPDX-License-Identifier: MIT
import { sha256 } from '@noble/hashes/sha2.js';
export const MEDIA_LIMITS = Object.freeze({ input: 128 * 1024 * 1024, range: 32768, width: 1024, height: 768, seconds: 600, fps: 60, tracks: 8, output: 1024 * 768 * 4, heap: 128 * 1024 * 1024, queueBytes: 12 * 1024 * 1024, queueItems: 64 });
export type Header = Readonly<{ width: number; height: number; frames: number; fpsNum: number; fpsDen: number; duration: number; tracks: number }>;
export function binkHeader(bytes: Uint8Array, size: number): Header {
  if (!Number.isSafeInteger(size) || size < 44 || size > MEDIA_LIMITS.input || bytes.byteLength < 44) throw new RangeError('input-limit');
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (String.fromCharCode(...bytes.subarray(0, 3)) !== 'BIK' || !'bfghik'.includes(String.fromCharCode(bytes[3]!))) throw new Error('unsupported-signature');
  if (d.getUint32(4, true) + 8 !== size || d.getUint32(12, true) > size) throw new Error('input-size');
  const frames = d.getUint32(8, true), width = d.getUint32(20, true), height = d.getUint32(24, true), fpsNum = d.getUint32(28, true), fpsDen = d.getUint32(32, true), tracks = d.getUint32(40, true);
  const duration = frames * fpsDen / fpsNum;
  if (!frames || !width || !height || width > MEDIA_LIMITS.width || height > MEDIA_LIMITS.height || !fpsNum || !fpsDen || fpsNum / fpsDen > MEDIA_LIMITS.fps || duration > MEDIA_LIMITS.seconds || tracks > MEDIA_LIMITS.tracks) throw new RangeError('header-limit');
  let a = fpsNum, b = fpsDen; while (b) {const next = a % b; a = b; b = next;}
  const normalizedNum = fpsNum / a, normalizedDen = fpsDen / a;
  return { width, height, frames, fpsNum: normalizedNum, fpsDen: normalizedDen, duration: frames * normalizedDen / normalizedNum, tracks };
}
export type RangeStats = { reads: number; bytes: number; maximumRequest: number; seeks: number };
/** Every read remains inside the authorized immutable Blob subrange. Hash reads are separate telemetry. */
export class BoundedSource {
  readonly stats: RangeStats = { reads: 0, bytes: 0, maximumRequest: 0, seeks: 0 };
  #position = 0;
  constructor(readonly size: number, readonly readRange: (offset: number, length: number) => Uint8Array, readonly budget = size * 8 + 1024 * 1024) {
    if (!Number.isSafeInteger(size) || size < 44 || size > MEDIA_LIMITS.input || !Number.isSafeInteger(budget) || budget < size) throw new RangeError('source-limit');
  }
  read(offset: number, length: number): Uint8Array {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || length > MEDIA_LIMITS.range || offset + length > this.size || this.stats.bytes + length > this.budget) throw new RangeError('read-limit');
    this.stats.bytes += length; this.stats.reads++; this.stats.maximumRequest = Math.max(length, this.stats.maximumRequest);
    if (offset < this.#position) this.stats.seeks++;
    this.#position = offset + length;
    const result = this.readRange(offset, length);
    if (!(result instanceof Uint8Array) || result.byteLength !== length) throw new Error('short-read');
    return result;
  }
}
export function authenticate(size: number, readRange: (offset: number, length: number) => Uint8Array, expected: string | null): string {
  if (!Number.isSafeInteger(size) || size < 44 || size > MEDIA_LIMITS.input || (expected !== null && !/^[a-f0-9]{64}$/.test(expected))) throw new RangeError('identity-limit');
  const hash = sha256.create();
  try {
    for (let offset = 0; offset < size; offset += 1024 * 1024) {
      const length = Math.min(1024 * 1024, size - offset), bytes = readRange(offset, length);
      if (!(bytes instanceof Uint8Array) || bytes.byteLength !== length) throw new Error('short-read');
      hash.update(bytes);
    }
    const actual = Array.from(hash.digest(), n => n.toString(16).padStart(2, '0')).join('');
    if (expected !== null && actual !== expected) throw new Error('identity-mismatch');
    return actual;
  } finally { hash.destroy(); }
}
export type MediaEvent = Readonly<{ kind: 'video' | 'audio'; ticks: number; num: number; den: number; pts: number; duration: number; samples: number; width: number; height: number; rate: number; channels: number; buffer: ArrayBuffer }>;
export function validateEvent(event: MediaEvent, header: Header): void {
  if (!event || Object.getPrototypeOf(event) !== Object.prototype || Object.keys(event).sort().join(',') !== 'buffer,channels,den,duration,height,kind,num,pts,rate,samples,ticks,width' || ![event.width, event.height, event.rate, event.channels, event.samples].every(Number.isSafeInteger) || event.width !== header.width || event.height !== header.height || event.channels < 0 || event.channels > 2 || event.rate < 0 || event.rate > 96000 || !(event.buffer instanceof ArrayBuffer) || event.buffer.byteLength > MEDIA_LIMITS.output || !Number.isSafeInteger(event.ticks) || event.ticks < 0 || !Number.isSafeInteger(event.num) || event.num < 1 || !Number.isSafeInteger(event.den) || event.den < 1 || !Number.isFinite(event.pts) || event.pts !== event.ticks * event.num / event.den || event.pts > header.duration + 1 || !Number.isFinite(event.duration) || event.duration <= 0 || event.duration > 1) throw new Error('event-time');
  if (event.kind === 'video') {
    if (event.width !== header.width || event.height !== header.height || event.buffer.byteLength !== header.width * header.height * 4 || event.samples !== 0 || event.num !== header.fpsDen || event.den !== header.fpsNum || event.duration !== header.fpsDen / header.fpsNum) throw new Error('video-shape');
  } else if (event.kind === 'audio') {
    if (!Number.isSafeInteger(event.rate) || event.rate < 8000 || event.rate > 96000 || ![1, 2].includes(event.channels) || !Number.isSafeInteger(event.samples) || event.samples < 1 || event.samples > 65536 || event.buffer.byteLength !== event.samples * event.channels * 4 || event.num !== 1 || event.den !== event.rate || event.duration !== event.samples / event.rate) throw new Error('audio-shape');
    for (const sample of new Float32Array(event.buffer)) if (!Number.isFinite(sample)) throw new Error('audio-finite');
  } else throw new Error('event-kind');
}
export class MediaQueue {
  #items: MediaEvent[] = [];
  bytes = 0; peakBytes = 0; peakItems = 0;
  get length(): number { return this.#items.length; }
  get first(): MediaEvent | undefined { return this.#items[0]; }
  get available(): boolean { return this.bytes <= MEDIA_LIMITS.queueBytes - MEDIA_LIMITS.output && this.length < MEDIA_LIMITS.queueItems; }
  push(event: MediaEvent): void {
    if (this.bytes + event.buffer.byteLength > MEDIA_LIMITS.queueBytes || this.length >= MEDIA_LIMITS.queueItems) throw new RangeError('queue-limit');
    this.#items.push(event); this.bytes += event.buffer.byteLength;
    this.peakBytes = Math.max(this.peakBytes, this.bytes); this.peakItems = Math.max(this.peakItems, this.length);
  }
  shift(): MediaEvent | undefined { const event = this.#items.shift(); if (event) this.bytes -= event.buffer.byteLength; return event; }
  takeWhere(predicate: (event: MediaEvent) => boolean): MediaEvent[] {
    const taken: MediaEvent[] = [], retained: MediaEvent[] = [];
    for (const event of this.#items) { if (predicate(event)) { taken.push(event); this.bytes -= event.buffer.byteLength; } else retained.push(event); }
    this.#items = retained; return taken;
  }
  clear(): void { this.#items = []; this.bytes = 0; }
}
/** Sample-aligned trimming keeps late audio on the same content clock as video. */
export function audioWindow(pts: number, samples: number, rate: number, playhead: number): { trim: number; count: number; start: number } {
  if (![pts, playhead].every(Number.isFinite) || pts < 0 || playhead < 0 || !Number.isSafeInteger(samples) || samples < 0 || !Number.isSafeInteger(rate) || rate < 8000 || rate > 96000) throw new RangeError('audio-clock');
  const trim = Math.min(samples, Math.max(0, Math.ceil((playhead - pts) * rate)));
  return { trim, count: samples - trim, start: pts + trim / rate };
}
