// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) The OpenRA Developers and Contributors
// Copyright 2026 WebRA2 contributors
// Filename hash and XCC database adaptation; see ../PROVENANCE.md.
import { MixError } from './mix.ts';
export type MixHashKind = 'classic' | 'crc32';
export interface NameCandidate { readonly name: string; readonly source: string }
export interface ResolvedName extends NameCandidate { readonly hashKind: MixHashKind }
export function hashMixName(name: string, kind: MixHashKind = 'crc32'): number {
  if (!/^[\x20-\x7e]{1,255}$/.test(name)) throw new MixError('filename', 'MIX candidate names must be 1–255 printable ASCII characters');
  const upper = name.toUpperCase(), length = upper.length;
  const bytes = new Uint8Array(Math.ceil(length / 4) * 4);
  for (let i = 0; i < length; i++) bytes[i] = upper.charCodeAt(i);
  if (kind === 'classic') {
    const v = new DataView(bytes.buffer); let result = 0;
    for (let i = 0; i < bytes.length; i += 4) result = (((result << 1) | (result >>> 31)) + v.getUint32(i, true)) >>> 0;
    return result;
  }
  const remainder = length % 4;
  if (remainder) {
    bytes[length] = remainder;
    bytes.fill(bytes[length - remainder]!, length + 1);
  }
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
/** Preserve collisions and both hash families; never declare an arbitrary winner. */
export class MixNameResolver {
  private readonly table = new Map<number, ResolvedName[]>();
  private count = 0;
  constructor(candidates: Iterable<NameCandidate> = [], private readonly maxCandidates = 100_000) {
    if (!Number.isSafeInteger(maxCandidates) || maxCandidates < 0) throw new MixError('limits', 'Invalid name candidate cap');
    for (const candidate of candidates) this.add(candidate);
  }
  add(candidate: NameCandidate): void {
    for (const hashKind of ['classic', 'crc32'] as const) {
      const id = hashMixName(candidate.name, hashKind), rows = this.table.get(id) ?? [];
      if (!rows.some(r => r.name.toUpperCase() === candidate.name.toUpperCase() && r.source === candidate.source && r.hashKind === hashKind)) {
        if (this.count >= this.maxCandidates * 2) throw new MixError('name-limit', 'Name candidate cap exceeded');
        rows.push({ ...candidate, hashKind }); this.count++;
      }
      this.table.set(id, rows);
    }
  }
  resolve(id: number): readonly ResolvedName[] { return this.table.get(id) ?? []; }
}
export function readXccLocalNames(bytes: Uint8Array, maxNames = 65_535): string[] {
  if (!Number.isSafeInteger(maxNames) || maxNames < 0) throw new MixError('limits', 'Invalid XCC name cap');
  const magic = [88,67,67,32,98,121,32,79,108,97,102,32,118,97,110,32,100,101,114,32,83,112,101,107,26,4,23,39,16,25,128,0];
  if (bytes.length < 52 || !magic.every((b, i) => bytes[i] === b)) throw new MixError('database', 'Invalid XCC local database header');
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (data.getUint32(32, true) !== bytes.length || data.getUint32(36, true) !== 0 || data.getUint32(40, true) !== 0)
    throw new MixError('database', 'Unsupported XCC database size, type or version');
  const count = data.getUint32(48, true);
  if (count > maxNames) throw new MixError('database-limit', 'XCC name count exceeds cap');
  let cursor = 52; const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const end = bytes.indexOf(0, cursor);
    if (end < 0 || end - cursor > 255) throw new MixError('database', 'Unterminated or overlong XCC name');
    let name = ''; for (; cursor < end; cursor++) name += String.fromCharCode(bytes[cursor]!);
    hashMixName(name); names.push(name); cursor++;
  }
  if (cursor !== bytes.length) throw new MixError('database', 'Unexpected XCC database trailing bytes');
  return names;
}
