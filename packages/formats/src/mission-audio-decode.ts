// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors.
// IMA arithmetic/tables and block layout adapted from XCC Utilities and Library,
// Copyright (C) 2000 Olaf van der Spek. See ../MISSION_AUDIO_DECODE_PROVENANCE.md.
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export const MISSION_AUDIO_DECODE_POLICY = 'webra2-mission-audio-pcm-1' as const;
export const MISSION_AUDIO_DECODE_LIMITS = Object.freeze({ inputBytes: 16 * 1024 * 1024,
  pcmBytes: 64 * 1024 * 1024, blocks: 65_536, riffChunks: 65_536, workUnits: 64 * 1024 * 1024 });
export type MissionAudioDecodeLimits = { readonly [K in keyof typeof MISSION_AUDIO_DECODE_LIMITS]: number };
export type MissionAudioDecodeInput = {
  readonly bytes: Uint8Array; readonly expectedSha256: string;
} & ({ readonly kind: 'riff-wave' } | { readonly kind: 'indexed'; readonly flags: number;
  readonly sampleRate: number; readonly chunkSize: number });
export interface MissionAudioPcm {
  readonly policy: typeof MISSION_AUDIO_DECODE_POLICY;
  readonly kind: 'indexed' | 'riff-wave';
  readonly codec: 'pcm-u8' | 'pcm-s16le' | 'ima-wav-4';
  readonly encodedSha256: string;
  /** SHA256 of interleaved signed PCM16 serialized little endian, independent of host endian. */
  readonly pcmSha256: string;
  /** Content identity includes interpretation metadata; never a playback or import authority. */
  readonly sha256: string;
  readonly encodedBytes: number; readonly dataOffset: number; readonly dataBytes: number;
  readonly channels: 1 | 2; readonly sampleRate: number; readonly frames: number;
  readonly scalarSamples: number; readonly pcmBytes: number;
  readonly blockAlign: number; readonly blocks: number; readonly partialFinalBlockBytes: number;
  readonly indexedFlags: number | null;
  readonly riff: null | Readonly<{ chunks: number; unknownChunks: number; formatTag: 1 | 17;
    formatBytes: number; extensionBytes: number | null; averageBytesPerSecond: number;
    samplesPerBlock: number | null; factFrames: number | null;
    /** Native reader skips fact. This policy retains every structurally complete decoded frame. */
    ignoredFactPaddingFrames: number | null }>;
}
export class MissionAudioDecodeError extends Error {
  constructor(readonly code: string, readonly inputOffset = 0) { super(`${code} at audio byte ${inputOffset}`); this.name = 'MissionAudioDecodeError'; }
}
const ownedPcm = new WeakMap<object, Int16Array>();
function fail(code: string, at = 0): never { throw new MissionAudioDecodeError(code, at); }
const integer = (v: unknown, min: number, max: number, code: string): number => {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || Object.is(v, -0) || v < min || v > max) fail(code);
  return v as number;
};
function record(value: unknown, allowed: readonly string[], required: readonly string[], code: string): Record<string, unknown> {
  try {
    if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(code);
    const result: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(value as object)) {
      if (typeof key !== 'string' || !allowed.includes(key)) fail(code);
      const d = Object.getOwnPropertyDescriptor(value, key);
      if (!d || !('value' in d)) fail(code);
      result[key] = d.value;
    }
    for (const key of required) if (!Object.hasOwn(result, key)) fail(code);
    return result;
  } catch (error) { if (error instanceof MissionAudioDecodeError) throw error; return fail(code); }
}
function caps(value: Partial<MissionAudioDecodeLimits>): MissionAudioDecodeLimits {
  const row = record(value, Object.keys(MISSION_AUDIO_DECODE_LIMITS), [], 'audio-limits');
  const result: { -readonly [K in keyof MissionAudioDecodeLimits]: number } = { ...MISSION_AUDIO_DECODE_LIMITS };
  for (const key of Object.keys(row) as (keyof MissionAudioDecodeLimits)[]) result[key] = integer(row[key], 0, result[key], 'audio-limits');
  return result;
}
function snapshot(value: unknown, maximum: number): Uint8Array {
  try {
    if (Object.getPrototypeOf(value) !== Uint8Array.prototype) fail('audio-input-type');
    const proto = Object.getPrototypeOf(Uint8Array.prototype);
    const buffer = Object.getOwnPropertyDescriptor(proto, 'buffer')!.get!.call(value) as ArrayBuffer;
    const at = Object.getOwnPropertyDescriptor(proto, 'byteOffset')!.get!.call(value) as number;
    const n = Object.getOwnPropertyDescriptor(proto, 'byteLength')!.get!.call(value) as number;
    if (Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype || Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')!.get!.call(buffer)) fail('audio-input-buffer');
    if (!n || n > maximum) fail('audio-input-limit');
    return new Uint8Array(new Uint8Array(buffer, at, n));
  } catch (error) { if (error instanceof MissionAudioDecodeError) throw error; return fail('audio-input-type'); }
}
const digest = (bytes: Uint8Array): string => bytesToHex(sha256(bytes));
const STEPS = Object.freeze([7,8,9,10,11,12,13,14,16,17,19,21,23,25,28,31,34,37,41,45,50,55,60,66,73,80,88,
  97,107,118,130,143,157,173,190,209,230,253,279,307,337,371,408,449,494,544,598,658,724,796,876,963,1060,1166,
  1282,1411,1552,1707,1878,2066,2272,2499,2749,3024,3327,3660,4026,4428,4871,5358,5894,6484,7132,7845,8630,
  9493,10442,11487,12635,13899,15289,16818,18500,20350,22385,24623,27086,29794,32767]);
const ADJUST = Object.freeze([-1,-1,-1,-1,2,4,6,8]);
type Format = { codec: MissionAudioPcm['codec']; channels: 1 | 2; sampleRate: number; blockAlign: number;
  dataOffset: number; dataBytes: number; indexedFlags: number | null; riff: MissionAudioPcm['riff'] };
function wave(bytes: Uint8Array, cap: MissionAudioDecodeLimits): Format {
  const v = new DataView(bytes.buffer), n = bytes.length;
  if (n < 12 || v.getUint32(0, true) !== 0x46464952 || v.getUint32(8, true) !== 0x45564157 || v.getUint32(4, true) !== n - 8) fail('audio-riff-header');
  let at = 12, chunks = 0, unknownChunks = 0, fmt = -1, formatBytes = 0, dataOffset = -1, dataBytes = 0, factFrames: number | null = null;
  while (at < n) {
    if (++chunks > cap.riffChunks) fail('audio-riff-chunk-limit', at);
    if (n - at < 8) fail('audio-riff-chunk-header', at);
    const tag = v.getUint32(at, true), size = v.getUint32(at + 4, true), start = at + 8, end = start + size;
    if (end + size % 2 > n) fail('audio-riff-chunk-range', at);
    if (tag === 0x20746d66) {
      if (fmt >= 0 || size < 16) fail('audio-riff-format', at);
      fmt = start; formatBytes = size;
    } else if (tag === 0x61746164) {
      if (fmt < 0 || dataOffset >= 0 || !size) fail('audio-riff-data', at);
      dataOffset = start; dataBytes = size;
    } else if (tag === 0x74636166) {
      if (factFrames !== null || size !== 4) fail('audio-riff-fact', at);
      factFrames = v.getUint32(start, true);
    } else unknownChunks++;
    at = end + size % 2;
  }
  if (fmt < 0 || dataOffset < 0) fail('audio-riff-required-chunk');
  const tag = v.getUint16(fmt, true), channels = v.getUint16(fmt + 2, true), rate = v.getUint32(fmt + 4, true), average = v.getUint32(fmt + 8, true), align = v.getUint16(fmt + 12, true), bits = v.getUint16(fmt + 14, true);
  if (channels !== 1 && channels !== 2) fail('audio-channels', fmt + 2);
  integer(rate, 1, 192_000, 'audio-sample-rate');
  let codec: Format['codec'], samplesPerBlock: number | null = null, extensionBytes: number | null = null;
  if (formatBytes !== 16) {
    if (formatBytes < 18) fail('audio-riff-format-extension', fmt);
    extensionBytes = v.getUint16(fmt + 16, true);
    if (formatBytes !== 18 + extensionBytes) fail('audio-riff-format-extension', fmt);
  }
  if (tag === 1) {
    if ((bits !== 8 && bits !== 16) || align !== channels * bits / 8 || (extensionBytes !== null && extensionBytes !== 0) || average !== rate * align) fail('audio-pcm-format', fmt);
    codec = bits === 8 ? 'pcm-u8' : 'pcm-s16le';
  } else if (tag === 17) {
    if (bits !== 4 || formatBytes !== 20 || extensionBytes !== 2) fail('audio-ima-format', fmt);
    imaAlign(align, channels);
    samplesPerBlock = v.getUint16(fmt + 18, true);
    if (samplesPerBlock !== 1 + (align - 4 * channels) * 2 / channels || !average) fail('audio-ima-samples-per-block', fmt + 18);
    codec = 'ima-wav-4';
  } else fail('audio-unsupported-format', fmt);
  return { codec, channels, sampleRate: rate, blockAlign: align, dataOffset, dataBytes, indexedFlags: null,
    riff: { chunks, unknownChunks, formatTag: tag as 1 | 17, formatBytes, extensionBytes, averageBytesPerSecond: average, samplesPerBlock, factFrames, ignoredFactPaddingFrames: null } };
}
function imaAlign(align: number, channels: number): void {
  if (align < 4 * channels || align > 65_536 || align % (4 * channels)) fail('audio-ima-block-align');
}
/** Pure bounded decode. Hash equality authenticates these bytes only, not their registry/import origin. */
export function decodeMissionAudio(input: MissionAudioDecodeInput, options: Partial<MissionAudioDecodeLimits> = {}): MissionAudioPcm {
  const cap = caps(options), row = record(input, ['kind','bytes','expectedSha256','flags','sampleRate','chunkSize'], ['kind','bytes','expectedSha256'], 'audio-input');
  const kind = row.kind;
  if (kind !== 'indexed' && kind !== 'riff-wave') fail('audio-input-kind');
  if (kind === 'riff-wave' && ['flags','sampleRate','chunkSize'].some(k => Object.hasOwn(row, k))) fail('audio-input');
  const expected = row.expectedSha256;
  if (typeof expected !== 'string' || !/^[0-9a-f]{64}$/.test(expected)) fail('audio-source-hash');
  const bytes = snapshot(row.bytes, cap.inputBytes);
  if (bytes.length > cap.workUnits) fail('audio-work-limit');
  if (digest(bytes) !== expected) fail('audio-source-mismatch');
  let f: Format;
  if (kind === 'riff-wave') f = wave(bytes, cap);
  else {
    const flags = integer(row.flags, 0, 15, 'audio-index-flags'), channels = ((flags & 1) + 1) as 1 | 2;
    // Only the observed/proven format families: uncompressed unsigned8/signed16 or IMA16.
    if (![2,3,6,7,12,13].includes(flags)) fail('audio-index-flags');
    const rate = integer(row.sampleRate, 1, 192_000, 'audio-sample-rate'), chunk = integer(row.chunkSize, 0, 65_536, 'audio-index-chunk-size');
    const codec = flags & 8 ? 'ima-wav-4' : flags & 4 ? 'pcm-s16le' : 'pcm-u8';
    if (codec === 'ima-wav-4') imaAlign(chunk, channels);
    else if (chunk !== 0) fail('audio-index-pcm-chunk-size');
    f = { codec, channels, sampleRate: rate, blockAlign: codec === 'ima-wav-4' ? chunk : channels * (codec === 'pcm-u8' ? 1 : 2), dataOffset: 0, dataBytes: bytes.length, indexedFlags: flags, riff: null };
  }
  const v = new DataView(bytes.buffer), end = f.dataOffset + f.dataBytes;
  let frames = 0, blocks = 0, partialFinalBlockBytes = 0, lastBlockFrames = 0;
  if (f.codec === 'ima-wav-4') {
    blocks = Math.ceil(f.dataBytes / f.blockAlign);
    if (blocks > cap.blocks) fail('audio-block-limit');
    partialFinalBlockBytes = f.dataBytes % f.blockAlign;
    // Complete preflight: no PCM allocation or paint before every header/range/count is checked.
    for (let at = f.dataOffset; at < end; at += f.blockAlign) {
      const size = Math.min(end - at, f.blockAlign), header = 4 * f.channels;
      if (size < header || (size - header) % (4 * f.channels)) fail('audio-ima-partial-group', at);
      for (let c = 0; c < f.channels; c++) if (bytes[at + 4 * c + 2]! > 88 || bytes[at + 4 * c + 3] !== 0) fail('audio-ima-header', at + 4 * c);
      lastBlockFrames = 1 + (size - header) * 2 / f.channels;
      frames += lastBlockFrames;
    }
  } else {
    if (f.dataBytes % f.blockAlign) fail('audio-pcm-partial-frame', f.dataOffset);
    frames = f.dataBytes / f.blockAlign;
  }
  const scalarSamples = frames * f.channels, pcmBytes = scalarSamples * 2;
  if (pcmBytes > cap.pcmBytes) fail('audio-pcm-limit');
  if (bytes.length + scalarSamples > cap.workUnits) fail('audio-work-limit');
  if (f.riff?.factFrames !== null && f.riff?.factFrames !== undefined) {
    const fact = f.riff.factFrames;
    if (!fact || fact > frames || (f.codec !== 'ima-wav-4' ? fact !== frames : fact <= frames - lastBlockFrames)) fail('audio-riff-fact-count');
    f.riff = { ...f.riff, ignoredFactPaddingFrames: frames - fact };
  }
  const pcm = new Int16Array(scalarSamples);
  if (f.codec !== 'ima-wav-4') {
    for (let i = 0; i < scalarSamples; i++) pcm[i] = f.codec === 'pcm-u8' ? (bytes[f.dataOffset + i]! - 128) * 256 : v.getInt16(f.dataOffset + i * 2, true);
  } else {
    let frame = 0;
    for (let at = f.dataOffset; at < end; at += f.blockAlign) {
      const size = Math.min(end - at, f.blockAlign), predictors = [0,0], indexes = [0,0];
      for (let c = 0; c < f.channels; c++) { predictors[c] = v.getInt16(at + c * 4, true); indexes[c] = bytes[at + c * 4 + 2]!; pcm[frame * f.channels + c] = predictors[c]!; }
      frame++;
      for (let group = at + 4 * f.channels; group < at + size; group += 4 * f.channels) {
        for (let c = 0; c < f.channels; c++) for (let i = 0; i < 8; i++) {
          const packed = bytes[group + c * 4 + (i >> 1)]!, code = i & 1 ? packed >> 4 : packed & 15, step = STEPS[indexes[c]!]!;
          let delta = step >> 3;
          if (code & 1) delta += step >> 2;
          if (code & 2) delta += step >> 1;
          if (code & 4) delta += step;
          const next = predictors[c]! + (code & 8 ? -delta : delta);
          predictors[c] = Math.max(-32768, Math.min(32767, next));
          indexes[c] = Math.max(0, Math.min(88, indexes[c]! + ADJUST[code & 7]!));
          pcm[(frame + i) * f.channels + c] = predictors[c]!;
        }
        frame += 8;
      }
    }
  }
  // Hash bounded chunks in canonical LE16 order without allocating a second full PCM buffer.
  const hasher = sha256.create(), chunk = new Uint8Array(8192), cv = new DataView(chunk.buffer);
  for (let at = 0; at < scalarSamples; at += 4096) {
    const count = Math.min(4096, scalarSamples - at);
    for (let i = 0; i < count; i++) cv.setInt16(i * 2, pcm[at + i]!, true);
    hasher.update(chunk.subarray(0, count * 2));
  }
  const metadata: Omit<MissionAudioPcm, 'sha256'> = { policy: MISSION_AUDIO_DECODE_POLICY, kind, codec: f.codec, encodedSha256: expected as string,
    pcmSha256: bytesToHex(hasher.digest()), encodedBytes: bytes.length, dataOffset: f.dataOffset, dataBytes: f.dataBytes,
    channels: f.channels, sampleRate: f.sampleRate, frames, scalarSamples, pcmBytes, blockAlign: f.blockAlign, blocks,
    partialFinalBlockBytes, indexedFlags: f.indexedFlags, riff: f.riff ? Object.freeze(f.riff) : null };
  const result: MissionAudioPcm = Object.freeze({ ...metadata, sha256: digest(new TextEncoder().encode(JSON.stringify(metadata))) });
  ownedPcm.set(result, pcm);
  return result;
}
export function isMissionAudioPcm(value: unknown): value is MissionAudioPcm { return !!value && typeof value === 'object' && ownedPcm.has(value); }
export function copyMissionAudioPcm(value: MissionAudioPcm): Int16Array {
  if (!isMissionAudioPcm(value)) fail('audio-pcm-brand');
  return ownedPcm.get(value)!.slice();
}
