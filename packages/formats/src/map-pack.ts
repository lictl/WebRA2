// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors; OpenRA Developers and Contributors.
// LZO adaptation: Frank Razenberg; Copyright 1996-2011 Markus F. X. J. Oberhumer.
// See ../MAP_PACK_PROVENANCE.md for original notices and pinned references.
export const MAP_PACK_LIMITS = Object.freeze({ inputBytes: 16 * 1024 * 1024, outputBytes: 32 * 1024 * 1024,
  chunks: 4096, blockBytes: 8192, codecBytes: 65536, compressedBlockBytes: 65535 });
export class MapPackError extends Error {
  constructor(readonly code: string, readonly inputOffset: number) { super(`${code} at packed byte ${inputOffset}`); this.name = 'MapPackError'; }
}
function natural(value: number, max: number, code: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new MapPackError(code, 0);
}
function reader(input: Uint8Array, expectedLength: number) {
  natural(expectedLength, MAP_PACK_LIMITS.codecBytes, 'codec-output-limit');
  if (!(input instanceof Uint8Array) || input.byteLength > MAP_PACK_LIMITS.compressedBlockBytes) throw new MapPackError('codec-input-limit', 0);
  const output = new Uint8Array(expectedLength); let ip = 0, op = 0;
  const fail = (code: string): never => { throw new MapPackError(code, ip); };
  function byte(): number { if (ip >= input.length) fail('truncated-codec'); return input[ip++]!; }
  function word(): number { const low = byte(); return low + byte() * 256; }
  function reserve(count: number): void { if (count > output.length - op) fail('codec-output-overrun'); }
  function literal(count: number): void {
    reserve(count); if (count > input.length - ip) fail('truncated-literal');
    output.set(input.subarray(ip, ip + count), op); ip += count; op += count;
  }
  function match(position: number, count: number): void {
    reserve(count); if (position < 0 || position >= op) fail('invalid-back-reference');
    // Forward copies deliberately allow overlap, including distance one.
    for (let i = 0; i < count; i++) output[op++] = output[position++]!;
  }
  function fill(count: number, value: number): void { reserve(count); output.fill(value, op, op + count); op += count; }
  function finish(): Uint8Array {
    if (ip !== input.length) fail('codec-trailing-bytes');
    if (op !== expectedLength) fail('codec-length-mismatch'); return output;
  }
  return { byte, word, literal, match, fill, finish, fail, get ip() { return ip; }, get op() { return op; } };
}

/** LCW/Format80, requiring an explicit terminator and exact input/output lengths. */
export function decodeLcwBlock(input: Uint8Array, expectedLength: number, reverse = false): Uint8Array {
  if (typeof reverse !== 'boolean') throw new MapPackError('invalid-lcw-mode', 0);
  const r = reader(input, expectedLength);
  while (true) {
    const token = r.byte();
    if (token < 128) r.match(r.op - (((token & 15) << 8) + r.byte()), (token >> 4) + 3);
    else if (token < 192) { const count = token & 63; if (!count) return r.finish(); r.literal(count); }
    else if (token === 254) { const count = r.word(); r.fill(count, r.byte()); }
    else {
      const count = token === 255 ? r.word() : (token & 63) + 3;
      const position = r.word(); r.match(reverse ? r.op - position : position, count);
    }
  }
}

/** LZO1X safe subset decoder. All standard match/literal commands are supported. */
export function decodeLzoBlock(input: Uint8Array, expectedLength: number): Uint8Array {
  const r = reader(input, expectedLength);
  // Extended lengths are bounded by remaining input and the capped output.
  function extended(base: number): number {
    let count = base, byte: number;
    do { byte = r.byte(); count += byte === 0 ? 255 : byte; if (count > MAP_PACK_LIMITS.codecBytes) r.fail('codec-run-limit'); } while (byte === 0);
    return count;
  }
  let mode: 'literal' | 'first' | 'match' | 'done' = 'literal', token = 0;
  if (input[0]! > 17) {
    const count = r.byte() - 17; r.literal(count);
    if (count < 4) { token = r.byte(); mode = 'match'; } else mode = 'first';
  }
  while (true) {
    if (mode === 'literal') {
      token = r.byte();
      if (token < 16) { r.literal((token === 0 ? extended(15) : token) + 3); mode = 'first'; continue; }
      mode = 'match';
    }
    if (mode === 'first') {
      token = r.byte();
      if (token < 16) { r.match(r.op - 2049 - (token >> 2) - (r.byte() << 2), 3); mode = 'done'; }
      else mode = 'match';
    }
    if (mode === 'match') {
      if (token >= 64) r.match(r.op - 1 - ((token >> 2) & 7) - (r.byte() << 3), (token >> 5) + 1);
      else if (token >= 32) {
        const count = (token & 31) || extended(31); const distance = (r.word() >> 2) + 1;
        r.match(r.op - distance, count + 2);
      } else if (token >= 16) {
        const highDistance = (token & 8) << 11, count = (token & 7) || extended(7);
        const distance = highDistance + (r.word() >> 2);
        if (distance === 0) { if (count !== 1) r.fail('invalid-lzo-terminator'); return r.finish(); }
        r.match(r.op - distance - 16384, count + 2);
      } else r.match(r.op - 1 - (token >> 2) - (r.byte() << 2), 2);
      mode = 'done';
    }
    if (mode === 'done') {
      const trailing = input[r.ip - 2]! & 3;
      if (!trailing) mode = 'literal';
      else { r.literal(trailing); token = r.byte(); mode = 'match'; }
    }
  }
}

export interface MapPackOptions { readonly outputLimit?: number; readonly expectedLength?: number; readonly chunkLimit?: number }
/** Decode u16-LE compressed/output lengths followed by independently coded blocks. */
export function decodeMapPack(input: Uint8Array, codec: 'lcw' | 'lzo', options: MapPackOptions = {}): Uint8Array {
  const outputLimit = options.outputLimit ?? MAP_PACK_LIMITS.outputBytes, chunkLimit = options.chunkLimit ?? MAP_PACK_LIMITS.chunks;
  natural(outputLimit, MAP_PACK_LIMITS.outputBytes, 'pack-output-limit'); natural(chunkLimit, MAP_PACK_LIMITS.chunks, 'pack-chunk-limit');
  if (options.expectedLength !== undefined) natural(options.expectedLength, outputLimit, 'pack-expected-limit');
  if (codec !== 'lcw' && codec !== 'lzo') throw new MapPackError('invalid-pack-codec', 0);
  if (!(input instanceof Uint8Array) || input.length > MAP_PACK_LIMITS.inputBytes) throw new MapPackError('pack-input-limit', 0);
  const chunks: { start: number; compressed: number; output: number }[] = []; let at = 0, total = 0;
  while (at < input.length) {
    if (input.length - at < 4) throw new MapPackError('truncated-pack-header', at);
    const compressed = input[at]! + input[at + 1]! * 256, output = input[at + 2]! + input[at + 3]! * 256; at += 4;
    if (!compressed || !output || output > MAP_PACK_LIMITS.blockBytes) throw new MapPackError('invalid-pack-block', at - 4);
    if (compressed > input.length - at) throw new MapPackError('truncated-pack-block', at);
    if (chunks.length >= chunkLimit) throw new MapPackError('pack-chunk-limit', at);
    if (output > outputLimit - total) throw new MapPackError('pack-output-limit', at);
    chunks.push({ start: at, compressed, output }); total += output; at += compressed;
  }
  if (options.expectedLength !== undefined && total !== options.expectedLength) throw new MapPackError('pack-length-mismatch', at);
  const result = new Uint8Array(total); at = 0;
  for (const chunk of chunks) {
    const bytes = input.subarray(chunk.start, chunk.start + chunk.compressed);
    try { result.set(codec === 'lzo' ? decodeLzoBlock(bytes, chunk.output) : decodeLcwBlock(bytes, chunk.output), at); }
    catch (error) { if (error instanceof MapPackError) throw new MapPackError(error.code, chunk.start + error.inputOffset); throw error; }
    at += chunk.output;
  }
  return result;
}
