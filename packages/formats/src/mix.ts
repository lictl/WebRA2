// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) The OpenRA Developers and Contributors
// Copyright 2026 WebRA2 contributors
// MIX format/crypto adaptation: OpenRA contributors; see ../PROVENANCE.md.
import { Blowfish } from 'egoroof-blowfish';

/** A stable, immutable byte source. Implementations must return exactly length bytes. */
export interface ByteSource {
  readonly size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
}
export interface MixLimits {
  maxEntries: number;
  maxIndexBytes: number;
  maxArchiveBytes: number;
}
export const DEFAULT_MIX_LIMITS: Readonly<MixLimits> = Object.freeze({
  maxEntries: 65_535, maxIndexBytes: 786_432, maxArchiveBytes: 4_296_000_000,
});
export class MixError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'MixError'; }
}
export interface MixEntry { readonly ordinal: number; readonly id: number; readonly offset: number; readonly size: number }
export interface MixArchive {
  readonly format: 'classic' | 'flagged' | 'encrypted';
  readonly flags: number;
  readonly dataOffset: number;
  readonly dataSize: number;
  readonly entries: readonly MixEntry[];
  readonly checksum: { readonly status: 'absent' | 'unverified'; readonly offset?: number; readonly expectedSha1?: string };
  readonly trailingBytes: number;
  readonly diagnostics: readonly { code: 'duplicate-id' | 'overlapping-members'; ordinals: readonly number[] }[];
}
export function assertRange(size: number, offset: number, length: number): void {
  if (![size, offset, length].every(Number.isSafeInteger) || size < 0 || offset < 0 || length < 0 || offset > size || length > size - offset)
    throw new MixError('range', `Invalid byte range ${offset}+${length} within ${size}`);
}
export async function readExact(source: ByteSource, offset: number, length: number): Promise<Uint8Array> {
  assertRange(source.size, offset, length);
  const bytes = await source.read(offset, length);
  if (bytes.length !== length) throw new MixError('short-read', `Requested ${length} bytes; received ${bytes.length}`);
  return bytes;
}
export function memorySource(bytes: Uint8Array): ByteSource {
  return { size: bytes.length, async read(offset, length) { assertRange(bytes.length, offset, length); return bytes.slice(offset, offset + length); } };
}
export function sliceSource(source: ByteSource, offset: number, size: number): ByteSource {
  assertRange(source.size, offset, size);
  return { size, async read(start, length) { assertRange(size, start, length); return readExact(source, offset + start, length); } };
}
function view(bytes: Uint8Array): DataView { return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
function hex(bytes: Uint8Array): string { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''); }

// ASN.1 INTEGER payload of the Westwood archive public key. This is a format
// constant, not a secret. Two 40-byte little-endian RSA blocks yield 39 bytes each.
const MODULUS = 0x51bcda086d39fce4565160d651713fa2e8aa54fa6682b04aabdd0e6af8b0c1e6d1fb4f3daa437f15n;
export function deriveMixKey(block: Uint8Array): Uint8Array {
  if (block.length !== 80) throw new MixError('key-length', 'MIX key block must contain 80 bytes');
  const output = new Uint8Array(78);
  for (let part = 0; part < 2; part++) {
    let input = 0n;
    for (let i = 39; i >= 0; i--) input = (input << 8n) | BigInt(block[part * 40 + i]!);
    // Fixed public exponent 65537. Generic square-and-multiply has bounded work.
    let exponent = 65_537n, value = 1n, base = input % MODULUS;
    while (exponent > 0n) {
      if (exponent & 1n) value = value * base % MODULUS;
      base = base * base % MODULUS;
      exponent >>= 1n;
    }
    for (let i = 0; i < 39; i++) { output[part * 39 + i] = Number(value & 255n); value >>= 8n; }
  }
  return output.slice(0, 56);
}
function decrypt(cipher: Blowfish, bytes: Uint8Array): Uint8Array {
  // The primitive's NULL mode removes trailing zero padding. MIX has fixed block
  // length, so restore those zero bytes before interpreting the binary header.
  const result = new Uint8Array(bytes.length);
  result.set(cipher.decode(bytes, Blowfish.TYPE.UINT8_ARRAY));
  return result;
}
export async function readMix(source: ByteSource, options: Partial<MixLimits> = {}): Promise<MixArchive> {
  const limits = { ...DEFAULT_MIX_LIMITS, ...options };
  for (const [name, value] of Object.entries(limits))
    if (!Number.isSafeInteger(value) || value < 0) throw new MixError('limits', `${name} must be a nonnegative safe integer`);
  assertRange(source.size, 0, 0);
  if (source.size > limits.maxArchiveBytes) throw new MixError('archive-limit', 'Archive exceeds configured size cap');
  const first = view(await readExact(source, 0, 6));
  const classic = first.getUint16(0, true) !== 0;
  const flags = classic ? 0 : first.getUint32(0, true);
  if ((flags & ~0x30000) !== 0) throw new MixError('flags', `Unsupported MIX flags 0x${flags.toString(16)}`);
  const encrypted = (flags & 0x20000) !== 0;
  let header: Uint8Array, cipher: Blowfish | undefined;
  const headerOffset = classic ? 0 : encrypted ? 84 : 4;
  if (encrypted) {
    cipher = new Blowfish(deriveMixKey(await readExact(source, 4, 80)), Blowfish.MODE.ECB, Blowfish.PADDING.NULL);
    header = decrypt(cipher, await readExact(source, 84, 8));
  } else header = await readExact(source, headerOffset, 6);
  const count = view(header).getUint16(0, true);
  const dataSize = view(header).getUint32(2, true);
  const plainLength = 6 + count * 12;
  const indexLength = encrypted ? Math.ceil(plainLength / 8) * 8 : plainLength;
  if (count > limits.maxEntries) throw new MixError('entry-limit', `Entry count ${count} exceeds cap`);
  if (indexLength > limits.maxIndexBytes) throw new MixError('index-limit', 'Index exceeds byte cap');
  const dataOffset = headerOffset + indexLength;
  assertRange(source.size, dataOffset, dataSize);
  const checksumOffset = dataOffset + dataSize;
  const hasChecksum = (flags & 0x10000) !== 0;
  assertRange(source.size, checksumOffset, hasChecksum ? 20 : 0);
  const encoded = await readExact(source, headerOffset, indexLength);
  header = cipher ? decrypt(cipher, encoded) : encoded;
  const index = view(header);
  const entries: MixEntry[] = [];
  const diagnostics: { code: 'duplicate-id' | 'overlapping-members'; ordinals: number[] }[] = [];
  const ids = new Map<number, number>();
  for (let ordinal = 0; ordinal < count; ordinal++) {
    const at = 6 + ordinal * 12;
    const id = index.getUint32(at, true), offset = index.getUint32(at + 4, true), size = index.getUint32(at + 8, true);
    assertRange(dataSize, offset, size);
    const previous = ids.get(id);
    if (previous !== undefined) diagnostics.push({ code: 'duplicate-id', ordinals: [previous, ordinal] });
    else ids.set(id, ordinal);
    entries.push(Object.freeze({ ordinal, id, offset, size }));
  }
  let furthest: MixEntry | undefined;
  for (const entry of entries.filter(e => e.size > 0).sort((a, b) => a.offset - b.offset || a.ordinal - b.ordinal)) {
    if (furthest && entry.offset < furthest.offset + furthest.size)
      diagnostics.push({ code: 'overlapping-members', ordinals: [furthest.ordinal, entry.ordinal] });
    if (!furthest || entry.offset + entry.size > furthest.offset + furthest.size) furthest = entry;
  }
  return {
    format: classic ? 'classic' : encrypted ? 'encrypted' : 'flagged', flags, dataOffset, dataSize,
    entries: Object.freeze(entries), diagnostics,
    checksum: hasChecksum ? { status: 'unverified', offset: checksumOffset, expectedSha1: hex(await readExact(source, checksumOffset, 20)) } : { status: 'absent' },
    trailingBytes: source.size - checksumOffset - (hasChecksum ? 20 : 0),
  };
}
export function mixMemberSource(source: ByteSource, archive: MixArchive, entry: MixEntry): ByteSource {
  if (archive.entries[entry.ordinal] !== entry) throw new MixError('entry', 'Entry does not belong to this index');
  assertRange(archive.dataSize, entry.offset, entry.size);
  return sliceSource(source, archive.dataOffset + entry.offset, entry.size);
}
