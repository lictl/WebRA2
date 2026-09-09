// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Framing from XCC cc_structures.h/audio_idx_file.h; see dependency report.
import { ContentError } from './ini.ts';
export interface AudioIndexEntry { ordinal: number; name: string; offset: number; size: number; sampleRate: number; flags: number; chunkSize: number }
/** Reads only GABA v2 index metadata; does not read/decode BAG audio payloads. */
export function readDependencyAudioIndex(bytes: Uint8Array): AudioIndexEntry[] {
  const fail = (code: string): never => { throw new ContentError(code, 0, code); };
  if (bytes.length > 4 * 1024 * 1024 || bytes.length < 12) fail('audio-index-byte-limit');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x41424147 || view.getUint32(4, true) !== 2) fail('audio-index-header');
  const count = view.getUint32(8, true);
  if (count > 100_000 || 12 + count * 36 !== bytes.length) fail('audio-index-count');
  const result: AudioIndexEntry[] = [];
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 36, end = bytes.subarray(at, at + 16).indexOf(0);
    if (end < 1) fail('audio-index-name');
    const name = String.fromCharCode(...bytes.subarray(at, at + end)).toLowerCase();
    if (!/^[a-z0-9_][a-z0-9_.-]{0,14}$/.test(name)) fail('audio-index-name');
    const offset = view.getUint32(at + 16, true), size = view.getUint32(at + 20, true);
    result.push({ ordinal: i, name, offset, size, sampleRate: view.getUint32(at + 24, true), flags: view.getUint32(at + 28, true), chunkSize: view.getUint32(at + 32, true) });
  }
  return result;
}
