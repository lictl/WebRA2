// SPDX-License-Identifier: MIT
import { authenticate, binkHeader, BoundedSource, MEDIA_LIMITS, validateEvent, type Header, type MediaEvent } from './session.ts';
export type Codec = {
  HEAPU8: Uint8Array; readSource?: (address: number, length: number, offset: number) => number;
  _wm_open(size: number, track: number): number; _wm_close(): void; _wm_next(): number; _wm_seek(seconds: number): number;
  _wm_data(): number; _wm_bytes(): number; _wm_samples(): number; _wm_width(): number; _wm_height(): number;
  _wm_rate(): number; _wm_channels(): number; _wm_ticks(): number; _wm_num(): number; _wm_den(): number;
};
export class RetainedDecoder {
  readonly header: Header;
  readonly identity: string;
  readonly source: BoundedSource;
  #closed = false; #eof = false; #seeks = 0; #videoNext = 0; #audioNext = 0;
  constructor(readonly core: Codec, size: number, readRange: (offset: number, length: number) => Uint8Array, track: number, expected: string | null) {
    try {
      this.header = binkHeader(readRange(0, 44), size);
      if (!Number.isSafeInteger(track) || track < -1 || track >= this.header.tracks) throw new RangeError('audio-track');
      this.identity = authenticate(size, readRange, expected);
      this.source = new BoundedSource(size, readRange);
      core.readSource = (address, length, offset) => {
        if (this.#closed || !Number.isSafeInteger(address) || address < 0 || address + length > core.HEAPU8.length) return -1;
        try { core.HEAPU8.set(this.source.read(offset, length), address); return length; } catch { return -1; }
      };
      if (core._wm_open(size, track) < 0) throw new Error('codec-open');
      if (core._wm_width() !== this.header.width || core._wm_height() !== this.header.height) throw new Error('codec-header');
    } catch (error) { this.#closed = true; core._wm_close(); delete core.readSource; throw error; }
  }
  next(): MediaEvent | null {
    if (this.#closed) throw new Error('closed-session');
    if (this.#eof) return null;
    try {
      const kind = this.core._wm_next();
      if (kind < 0) throw new Error('codec-decode');
      if (kind === 0) { if (this.#videoNext !== this.header.frames) throw new Error('video-truncated'); this.#eof = true; return null; }
      if (kind !== 1 && kind !== 2) throw new Error('codec-kind');
      const address = this.core._wm_data(), size = this.core._wm_bytes(), ticks = this.core._wm_ticks(), num = this.core._wm_num(), den = this.core._wm_den();
      if (![address, size].every(Number.isSafeInteger) || address < 0 || size < 1 || size > MEDIA_LIMITS.output || address + size > this.core.HEAPU8.length || this.core.HEAPU8.length > MEDIA_LIMITS.heap) throw new RangeError('codec-output');
      const samples = this.core._wm_samples(), rate = this.core._wm_rate();
      const event: MediaEvent = { kind: kind === 1 ? 'video' : 'audio', ticks, num, den, pts: ticks * num / den,
        duration: kind === 1 ? this.header.fpsDen / this.header.fpsNum : samples / rate, samples,
        width: this.core._wm_width(), height: this.core._wm_height(), rate, channels: this.core._wm_channels(),
        buffer: this.core.HEAPU8.slice(address, address + size).buffer };
      validateEvent(event, this.header);
      if (event.kind === 'video') { if (event.ticks !== this.#videoNext++) throw new Error('video-timestamp'); }
      else { if (event.ticks !== this.#audioNext) throw new Error('audio-timestamp'); this.#audioNext += event.samples; }
      return event;
    } catch (error) { this.close(); throw error; }
  }
  seek(seconds: number): void {
    if (this.#closed || !Number.isFinite(seconds) || seconds < 0 || seconds >= this.header.duration || this.#seeks >= 4) throw new RangeError('seek-limit');
    this.#seeks++;
    // FFmpeg's Bink demuxer deliberately resets to frame zero. Decode/drop up to target preserves references/audio overlap.
    if (this.core._wm_seek(seconds) < 0) { this.close(); throw new Error('codec-seek'); }
    this.#eof = false; this.#videoNext = 0; this.#audioNext = 0;
  }
  close(): void { if (!this.#closed) { this.#closed = true; this.core._wm_close(); delete this.core.readSource; } }
}
export function blobRange(blob: Blob, offset: number, length: number, readBlob: (blob: Blob) => ArrayBuffer): (position: number, size: number) => Uint8Array {
  if (!(blob instanceof Blob) || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length < 44 || length > MEDIA_LIMITS.input || offset + length > blob.size) throw new RangeError('clip-range');
  return (position, size) => {
    if (!Number.isSafeInteger(position) || position < 0 || !Number.isSafeInteger(size) || size < 0 || size > 1024 * 1024 || position + size > length) throw new RangeError('clip-read');
    return new Uint8Array(readBlob(blob.slice(offset + position, offset + position + size)));
  };
}
