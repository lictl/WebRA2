// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors; OpenRA Developers and Contributors.
// Format adaptation: XCC Utilities and Library, Copyright 2000 Olaf van der Spek.
// See ../SHP_RUNTIME_PROVENANCE.md for pinned references and policy differences.
export const SHP_RUNTIME_POLICY = 'webra2-shp-1' as const;
export const SHP_RUNTIME_LIMITS = Object.freeze({ fileBytes: 16 * 1024 * 1024,
  frames: 4096, dimension: 2048, framePixels: 4 * 1024 * 1024 });
type Limits = { -readonly [K in keyof typeof SHP_RUNTIME_LIMITS]: number };
export class ShpRuntimeError extends Error {
  constructor(readonly code: string, readonly frameOrdinal: number | null = null, readonly inputOffset = 0) {
    super(`${code} at SHP byte ${inputOffset}`); this.name = 'ShpRuntimeError';
  }
}
export interface RuntimeShpFrame {
  readonly ordinal: number;
  readonly headerOffset: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Complete LE32 words; no palette, shadow, remap or auxiliary-flag interpretation. */
  readonly compressionWord: number;
  readonly unknownWord: number;
  readonly reservedWord: number;
  readonly dataOffset: number;
  /** Next distinct nonzero offset, or EOF. Zero for empty frames. */
  readonly dataEnd: number;
  readonly empty: boolean;
  /** Lowest ordinal sharing this nonempty payload; null for an empty record. */
  readonly payloadOwner: number | null;
  readonly sharedFrameCount: number;
}
export interface DecodedShpFrame {
  readonly frame: RuntimeShpFrame;
  readonly pixelCount: number;
  readonly zeroIndexCount: number;
  readonly consumedBytes: number;
  readonly trailingBytes: number;
  readonly clippedTerminalZeroRuns: number;
  readonly clippedZeroIndices: number;
  readonly zeroLengthRuns: number;
  /** Fresh caller-owned indices each call. Internal pixels are never exposed. */
  copyPixels(): Uint8Array;
}
export interface RuntimeShp {
  readonly policy: typeof SHP_RUNTIME_POLICY;
  readonly nativeRenderingVerified: false;
  readonly width: number;
  readonly height: number;
  readonly byteLength: number;
  readonly tableEnd: number;
  readonly frames: readonly RuntimeShpFrame[];
  /** Selected-frame validation only; indexing does not certify other payloads. */
  decodeFrame(ordinal: number): DecodedShpFrame;
}
function fail(code: string, ordinal: number | null = null, offset = 0): never { throw new ShpRuntimeError(code, ordinal, offset); }
function limits(options: Partial<Limits>): Limits {
  if (!options || typeof options !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) fail('shp-limit-options');
  const result: Limits = { ...SHP_RUNTIME_LIMITS };
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string' || !Object.hasOwn(result, key)) fail('shp-limit-options');
    const d = Object.getOwnPropertyDescriptor(options, key)!;
    if (!('value' in d) || !Number.isSafeInteger(d.value) || Object.is(d.value, -0) || d.value < 0 || d.value > result[key as keyof Limits]) fail('shp-limit-options');
    result[key as keyof Limits] = d.value;
  }
  return result;
}
/** Take a fixed native byte snapshot without consulting an imported iterator/getter. */
function snapshot(input: Uint8Array, maximum: number): Uint8Array {
  if (!(input instanceof Uint8Array) || Object.getPrototypeOf(input) !== Uint8Array.prototype) fail('shp-input-type');
  const proto = Object.getPrototypeOf(Uint8Array.prototype);
  const buffer = Object.getOwnPropertyDescriptor(proto, 'buffer')!.get!.call(input) as ArrayBuffer;
  const offset = Object.getOwnPropertyDescriptor(proto, 'byteOffset')!.get!.call(input) as number;
  const size = Object.getOwnPropertyDescriptor(proto, 'byteLength')!.get!.call(input) as number;
  if (Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype || Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')!.get!.call(buffer)) fail('shp-input-buffer');
  if (size < 8 || size > maximum) fail('shp-input-limit');
  return new Uint8Array(new Uint8Array(buffer, offset, size));
}

/** Bounded SHP(TS) reader. Owns one input snapshot; no decoded-frame cache. */
export function createRuntimeShp(input: Uint8Array, options: Partial<Limits> = {}): RuntimeShp {
  const cap = limits(options), bytes = snapshot(input, cap.fileBytes), view = new DataView(bytes.buffer);
  if (view.getUint16(0, true) !== 0) fail('shp-signature');
  const width = view.getUint16(2, true), height = view.getUint16(4, true), count = view.getUint16(6, true), tableEnd = 8 + count * 24;
  if (!width || !height || width > cap.dimension || height > cap.dimension) fail('shp-canvas-limit');
  if (!count || count > cap.frames) fail('shp-frame-limit');
  if (tableEnd > bytes.length) fail('shp-frame-table');
  type Row = Omit<RuntimeShpFrame, 'dataEnd' | 'payloadOwner' | 'sharedFrameCount'>;
  const rows: Row[] = [], groups = new Map<number, Row[]>();
  for (let ordinal = 0; ordinal < count; ordinal++) {
    const at = 8 + ordinal * 24;
    const x = view.getUint16(at, true), y = view.getUint16(at + 2, true), w = view.getUint16(at + 4, true), h = view.getUint16(at + 6, true);
    const compressionWord = view.getUint32(at + 8, true), unknownWord = view.getUint32(at + 12, true), reservedWord = view.getUint32(at + 16, true), dataOffset = view.getUint32(at + 20, true);
    const empty = w === 0 && h === 0 && dataOffset === 0;
    if (!empty && (!w || !h || x + w > width || y + h > height)) fail('shp-frame-rectangle', ordinal, at);
    if (w * h > cap.framePixels) fail('shp-pixel-limit', ordinal, at);
    if (!empty && (dataOffset < tableEnd || dataOffset >= bytes.length)) fail('shp-frame-offset', ordinal, at + 20);
    // Preserve unknown words but do not mask an unsupported compression word down to a known byte.
    const row = { ordinal, headerOffset: at, x, y, width: w, height: h, compressionWord, unknownWord, reservedWord, dataOffset, empty };
    rows.push(row);
    if (!empty) {
      const group = groups.get(dataOffset);
      if (group) {
        const first = group[0]!;
        if (first.width !== w || first.height !== h || first.compressionWord !== compressionWord) fail('shp-shared-layout', ordinal, at);
        group.push(row);
      } else groups.set(dataOffset, [row]);
    }
  }
  const offsets = [...groups.keys()].sort((a, b) => a - b), ends = new Map(offsets.map((at, i) => [at, offsets[i + 1] ?? bytes.length]));
  const frames = Object.freeze(rows.map(row => Object.freeze({ ...row, dataEnd: row.empty ? 0 : ends.get(row.dataOffset)!,
    payloadOwner: row.empty ? null : groups.get(row.dataOffset)![0]!.ordinal,
    sharedFrameCount: row.empty ? 0 : groups.get(row.dataOffset)!.length })));
  function decodeFrame(ordinal: number): DecodedShpFrame {
    if (!Number.isSafeInteger(ordinal) || Object.is(ordinal, -0) || ordinal < 0 || ordinal >= frames.length) fail('shp-frame-ordinal');
    const frame = frames[ordinal]!, format = frame.compressionWord;
    if (format > 3) fail('shp-unsupported-compression', ordinal, frame.headerOffset + 8);
    // Empty records have no encoded pixels; zero-valued indices in a nonempty frame remain distinct.
    const pixels = new Uint8Array(frame.width * frame.height);
    let at = frame.dataOffset, clippedTerminalZeroRuns = 0, clippedZeroIndices = 0, zeroLengthRuns = 0;
    const error = (code: string, offset = at): never => fail(code, ordinal, offset);
    if (!frame.empty && format < 2) {
      if (pixels.length > frame.dataEnd - at) error('shp-truncated-raw');
      pixels.set(bytes.subarray(at, at + pixels.length)); at += pixels.length;
    } else if (!frame.empty) {
      for (let y = 0; y < frame.height; y++) {
        if (frame.dataEnd - at < 2) error('shp-truncated-row-header');
        const length = view.getUint16(at, true), end = at + length;
        if (length < 2) error('shp-row-length');
        if (end > frame.dataEnd) error('shp-truncated-row');
        at += 2;
        if (format === 2) {
          if (length !== frame.width + 2) error('shp-format2-ambiguous', at - 2);
          for (let x = 0; x < frame.width; x++) {
            const value = bytes[at++]!;
            if (value === 0) error('shp-format2-ambiguous', at - 1);
            pixels[y * frame.width + x] = value;
          }
        } else {
          let x = 0;
          while (at < end) {
            const value = bytes[at++]!;
            if (value) {
              if (x >= frame.width) error('shp-row-overrun', at - 1);
              pixels[y * frame.width + x++] = value;
            } else {
              if (at === end) error('shp-truncated-zero-run', at - 1);
              const count = bytes[at++]!;
              if (!count) zeroLengthRuns++;
              const remaining = frame.width - x;
              if (count > remaining) {
                if (at !== end) error('shp-nonterminal-zero-overrun', at - 2);
                clippedTerminalZeroRuns++; clippedZeroIndices += count - remaining;
              }
              x += Math.min(count, remaining);
            }
          }
          if (x !== frame.width) error('shp-row-underfill');
        }
      }
    }
    let zeroIndexCount = 0;
    for (const index of pixels) if (index === 0) zeroIndexCount++;
    return Object.freeze({ frame, pixelCount: pixels.length, zeroIndexCount, consumedBytes: at - frame.dataOffset,
      trailingBytes: frame.empty ? 0 : frame.dataEnd - at, clippedTerminalZeroRuns, clippedZeroIndices, zeroLengthRuns,
      copyPixels: (): Uint8Array => pixels.slice() });
  }
  return Object.freeze({ policy: SHP_RUNTIME_POLICY, nativeRenderingVerified: false, width, height,
    byteLength: bytes.length, tableEnd, frames, decodeFrame });
}
