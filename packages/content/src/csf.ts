// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. XCC format reference: see ../PROVENANCE.md.
import { asciiBytes, ContentError } from './ini.ts';
export const CSF_LIMITS = Object.freeze({ bytes: 16 * 1024 * 1024, labels: 100_000, strings: 100_000, labelBytes: 512, codeUnits: 4_000_000, extraBytes: 4096 });
/** Returns structural/character-class counts only, never translated values or label text. */
export function censusCsf(bytes: Uint8Array) {
  if (bytes.length > CSF_LIMITS.bytes) throw new ContentError('csf-byte-limit', 0, 'CSF exceeds byte cap');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let cursor = 0;
  function take(count: number): Uint8Array {
    if (!Number.isSafeInteger(count) || count < 0 || count > bytes.length - cursor) throw new ContentError('csf-truncated', cursor, 'CSF record exceeds bounded member');
    const part = bytes.subarray(cursor, cursor + count); cursor += count; return part;
  }
  function u32(): number { const at = cursor; take(4); return view.getUint32(at, true); }
  function tag(): string { return asciiBytes(take(4)); }
  if (tag() !== ' FSC') throw new ContentError('csf-magic', 0, 'Unsupported CSF magic');
  const version = u32(), labelCount = u32(), declaredStrings = u32(), reserved = u32(), languageId = u32();
  if (version !== 3) throw new ContentError('csf-version', 4, 'Only CSF version 3 is covered by this census');
  if (labelCount > CSF_LIMITS.labels || declaredStrings > CSF_LIMITS.strings) throw new ContentError('csf-count-limit', 8, 'CSF header exceeds count cap');
  let strings = 0, emptyLabels = 0, duplicateLabels = 0, extraRecords = 0, codeUnits = 0, hanCodeUnits = 0, asciiCodeUnits = 0, invalidSurrogates = 0;
  const labels = new Set<string>();
  for (let index = 0; index < labelCount; index++) {
    if (tag() !== ' LBL') throw new ContentError('csf-label-tag', cursor - 4, 'Unsupported CSF label tag');
    const count = u32(), length = u32();
    if (length > CSF_LIMITS.labelBytes) throw new ContentError('csf-label-limit', cursor - 4, 'CSF label exceeds cap');
    const label = take(length);
    if (label.some(b => b < 0x20 || b > 0x7e)) throw new ContentError('csf-label-encoding', cursor - length, 'Non-ASCII CSF label is outside this census');
    const identity = asciiBytes(label).toLowerCase();
    if (labels.has(identity)) duplicateLabels++; labels.add(identity);
    // The pinned XCC reader handles an empty or one-value label. Do not guess a multi-value variant.
    if (count > 1) throw new ContentError('csf-multiple-values', cursor, 'Multiple-value label requires a separate format investigation');
    if (!count) { emptyLabels++; continue; }
    const kind = tag();
    if (kind !== ' RTS' && kind !== 'WRTS') throw new ContentError('csf-string-tag', cursor - 4, 'Unsupported CSF string tag');
    const units = u32(); codeUnits += units;
    if (codeUnits > CSF_LIMITS.codeUnits) throw new ContentError('csf-string-limit', cursor - 4, 'Decoded CSF characters exceed cap');
    const encoded = take(units * 2), data = new DataView(encoded.buffer, encoded.byteOffset, encoded.byteLength);
    let pendingHigh = false;
    for (let at = 0; at < units; at++) {
      const unit = data.getUint16(at * 2, true) ^ 0xffff;
      if (unit < 0x80) asciiCodeUnits++;
      if ((unit >= 0x3400 && unit <= 0x4dbf) || (unit >= 0x4e00 && unit <= 0x9fff) || (unit >= 0xf900 && unit <= 0xfaff)) hanCodeUnits++;
      if (unit >= 0xdc00 && unit <= 0xdfff) { if (!pendingHigh) invalidSurrogates++; pendingHigh = false; }
      else { if (pendingHigh) invalidSurrogates++; pendingHigh = unit >= 0xd800 && unit <= 0xdbff; }
    }
    if (pendingHigh) invalidSurrogates++;
    if (kind === 'WRTS') { const extra = u32(); if (extra > CSF_LIMITS.extraBytes) throw new ContentError('csf-extra-limit', cursor - 4, 'CSF extra value exceeds cap'); take(extra); extraRecords++; }
    strings++;
  }
  if (strings !== declaredStrings) throw new ContentError('csf-string-count', 12, 'CSF declared string count differs from parsed records');
  if (cursor !== bytes.length) throw new ContentError('csf-trailing', cursor, 'CSF has unexplained trailing bytes');
  return { version, languageId, reserved, labelCount, strings, emptyLabels, duplicateLabels, extraRecords, codeUnits, hanCodeUnits, asciiCodeUnits, invalidSurrogates };
}
