// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. XCC framing reference: see ../PROVENANCE.md.
import { censusCsf, CSF_LIMITS } from './csf.ts';
import { asciiBytes, ContentError } from './ini.ts';

export interface CsfStringRecord {
  readonly ordinal: number;
  readonly label: string;
  /** null means a label with no string record; an empty string is distinct. */
  readonly text: string | null;
  /** WRTS bytes preserved one byte per code unit; no locale/filename interpretation. */
  readonly extra: string | null;
}
export interface CsfResolution {
  readonly status: 'missing' | 'empty' | 'resolved' | 'ambiguous';
  readonly text: string | null;
  readonly extra: string | null;
  readonly records: readonly CsfStringRecord[];
}
export interface CsfCatalog {
  readonly version: 3;
  readonly languageId: number;
  readonly records: readonly CsfStringRecord[];
  resolve(label: string): CsfResolution;
}

/** Runtime-only values. Never spread this catalog into a public research report. */
export function decodeCsf(input: Uint8Array): CsfCatalog {
  if (input.byteLength > CSF_LIMITS.bytes) throw new ContentError('csf-byte-limit', 0, 'CSF exceeds byte cap');
  // Snapshot even a shared/caller-owned buffer, then validate the same immutable bytes
  // we decode. The established framing scanner remains the single validation policy.
  const bytes = new Uint8Array(input);
  const metadata = censusCsf(bytes);
  if (metadata.invalidSurrogates) throw new ContentError('csf-unicode', 0, 'CSF has unpaired UTF-16 surrogates');
  const view = new DataView(bytes.buffer);
  let cursor = 24;
  const records: CsfStringRecord[] = [];
  const byLabel = new Map<string, CsfStringRecord[]>();
  function u32() { const value = view.getUint32(cursor, true); cursor += 4; return value; }
  function take(length: number) { const part = bytes.subarray(cursor, cursor + length); cursor += length; return part; }
  for (let ordinal = 0; ordinal < metadata.labelCount; ordinal++) {
    cursor += 4; // LBL tag validated by censusCsf.
    const count = u32(), label = asciiBytes(take(u32()));
    let text: string | null = null, extra: string | null = null;
    if (count) {
      const tag = asciiBytes(take(4)), length = u32();
      const encoded = take(length * 2), values = new DataView(encoded.buffer, encoded.byteOffset, encoded.byteLength);
      const pieces: string[] = [];
      for (let at = 0; at < length; at += 8192) {
        const units: number[] = [];
        for (let i = at; i < Math.min(at + 8192, length); i++) units.push(values.getUint16(i * 2, true) ^ 0xffff);
        pieces.push(String.fromCharCode(...units));
      }
      text = pieces.join('');
      if (tag === 'WRTS') extra = asciiBytes(take(u32()));
    }
    const record = Object.freeze({ ordinal, label, text, extra }); records.push(record);
    const key = label.toLowerCase(), previous = byLabel.get(key) ?? []; previous.push(record); byLabel.set(key, previous);
  }
  const resolutions = new Map<string, CsfResolution>();
  for (const [label, values] of byLabel) {
    const first = values[0]!;
    const ambiguous = values.some(value => value.text !== first.text || value.extra !== first.extra);
    resolutions.set(label, Object.freeze({ status: ambiguous ? 'ambiguous' : first.text === null ? 'empty' : 'resolved',
      text: ambiguous ? null : first.text, extra: ambiguous ? null : first.extra, records: Object.freeze(values) }));
  }
  const missing: CsfResolution = Object.freeze({ status: 'missing', text: null, extra: null, records: Object.freeze([]) });
  return Object.freeze({ version: 3, languageId: metadata.languageId, records: Object.freeze(records),
    resolve(label: string) {
      if (typeof label !== 'string' || !/^[\x20-\x7e]{0,512}$/.test(label)) throw new ContentError('csf-label-encoding', 0, 'CSF lookup requires a bounded ASCII label');
      return resolutions.get(label.toLowerCase()) ?? missing;
    },
  });
}
