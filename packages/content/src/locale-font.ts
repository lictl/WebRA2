// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Format adaptation: see ../LOCALE_PROVENANCE.md.
import { censusCsf } from './csf.ts';
import { asciiBytes, ContentError } from './ini.ts';

const FONT_LIMITS = Object.freeze({ bytes: 16 * 1024 * 1024, symbols: 65_535, stride: 32, height: 256, requests: 65_536 });
const FONT_HEADER_BYTES = 28, FONT_TABLE_BYTES = 131_072;
const equalBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((value, index) => value === b[index]);

/** Reuses the validated CSF grammar; emits codepoint usage and duplicate ordinals, never label/value text. */
export function inspectLocaleStrings(bytes: Uint8Array) {
  const structure = censusCsf(bytes);
  if (structure.invalidSurrogates) throw new ContentError('locale-surrogate', 0, 'Invalid UTF-16 cannot establish font coverage');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let cursor = 24;
  const used = new Set<number>();
  const labels = new Map<string, { ordinal: number; text: Uint8Array; extra: Uint8Array; kind: string }>();
  const duplicates: { firstOrdinal: number; duplicateOrdinal: number; sameText: boolean; sameExtra: boolean; sameKind: boolean }[] = [];
  for (let ordinal = 0; ordinal < structure.labelCount; ordinal++) {
    const count = view.getUint32(cursor + 4, true), length = view.getUint32(cursor + 8, true); cursor += 12;
    const label = asciiBytes(bytes.subarray(cursor, cursor + length)).toLowerCase(); cursor += length;
    let text = bytes.subarray(0, 0), extra = bytes.subarray(0, 0), kind = 'empty';
    if (count) {
      kind = asciiBytes(bytes.subarray(cursor, cursor + 4));
      const units = view.getUint32(cursor + 4, true); cursor += 8;
      text = bytes.subarray(cursor, cursor + units * 2);
      for (let at = 0; at < units; at++) {
        const unit = view.getUint16(cursor + at * 2, true) ^ 0xffff;
        if (unit >= 0xd800 && unit <= 0xdbff) {
          const low = view.getUint16(cursor + ++at * 2, true) ^ 0xffff;
          used.add(0x10000 + ((unit - 0xd800) << 10) + low - 0xdc00);
        } else used.add(unit);
        if (used.size > 65_536) throw new ContentError('locale-codepoint-limit', cursor, 'Locale codepoint set exceeds cap');
      }
      cursor += units * 2;
      if (kind === 'WRTS') { const length = view.getUint32(cursor, true); cursor += 4; extra = bytes.subarray(cursor, cursor + length); cursor += length; }
    }
    const previous = labels.get(label);
    if (previous) duplicates.push({ firstOrdinal: previous.ordinal, duplicateOrdinal: ordinal, sameText: equalBytes(previous.text, text), sameExtra: equalBytes(previous.extra, extra), sameKind: previous.kind === kind });
    else labels.set(label, { ordinal, text, extra, kind });
  }
  return { structure, codepoints: [...used].sort((a, b) => a - b), duplicates };
}

/** Bounded fonT metadata/coverage only. Unicode map entries are one-based; zero means unmapped. */
export function inspectUnicodeBitmapFont(bytes: Uint8Array, requestedCodepoints: readonly number[] = []) {
  function fail(code: string): never { throw new ContentError(code, 0, code); }
  if (bytes.length > FONT_LIMITS.bytes || bytes.length < FONT_HEADER_BYTES + FONT_TABLE_BYTES) fail('font-byte-limit');
  if (asciiBytes(bytes.subarray(0, 4)) !== 'fonT') fail('font-magic');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ideographWidth = view.getUint32(4, true), stride = view.getUint32(8, true), symbolHeight = view.getUint32(12, true), fontHeight = view.getUint32(16, true), symbols = view.getUint32(20, true), recordBytes = view.getUint32(24, true);
  if (!stride || stride > FONT_LIMITS.stride || !symbolHeight || symbolHeight > FONT_LIMITS.height || !fontHeight || fontHeight > FONT_LIMITS.height || ideographWidth > 256 || !symbols || symbols > FONT_LIMITS.symbols) fail('font-dimension-limit');
  if (recordBytes !== 1 + stride * symbolHeight) fail('font-record-size');
  const start = FONT_HEADER_BYTES + FONT_TABLE_BYTES;
  if (start + symbols * recordBytes !== bytes.length) fail('font-size-mismatch');
  let zeroWidthSymbols = 0, maxGlyphWidth = 0, mappedCodepoints = 0;
  for (let i = 0; i < symbols; i++) {
    const width = bytes[start + i * recordBytes]!;
    if (width > stride * 8) fail('font-glyph-width');
    if (!width) zeroWidthSymbols++;
    maxGlyphWidth = Math.max(maxGlyphWidth, width);
  }
  for (let cp = 0; cp < 65_536; cp++) {
    const mapping = view.getUint16(FONT_HEADER_BYTES + cp * 2, true);
    if (mapping > symbols) fail('font-unicode-mapping');
    if (mapping) mappedCodepoints++;
  }
  if (requestedCodepoints.length > FONT_LIMITS.requests) fail('font-codepoint-limit');
  for (const cp of requestedCodepoints) if (!Number.isSafeInteger(cp) || cp < 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) fail('font-codepoint-limit');
  const requested = [...new Set(requestedCodepoints)].sort((a, b) => a - b);
  const missing: number[] = [], zeroWidth: number[] = [], blank: number[] = [], layoutControls: number[] = [];
  let mappedRequests = 0;
  const glyphInk = new Map<number, boolean>();
  for (const cp of requested) {
    if (cp === 9 || cp === 10 || cp === 13) { layoutControls.push(cp); continue; }
    const mapping = cp < 65_536 ? view.getUint16(FONT_HEADER_BYTES + cp * 2, true) : 0;
    if (!mapping) { missing.push(cp); continue; }
    mappedRequests++;
    const at = start + (mapping - 1) * recordBytes, width = bytes[at]!;
    if (!width) zeroWidth.push(cp);
    let ink = glyphInk.get(mapping);
    if (ink === undefined) {
      ink = false;
      for (let y = 0; y < symbolHeight && !ink; y++) for (let x = 0; x < width; x++) {
        if ((bytes[at + 1 + y * stride + (x >>> 3)]! & (1 << (7 - (x & 7)))) !== 0) { ink = true; break; }
      }
      glyphInk.set(mapping, ink);
    }
    if (!ink) blank.push(cp);
  }
  return {
    format: 'fonT' as const, ideographWidth, stride, symbolHeight, fontHeight, symbols, recordBytes, zeroWidthSymbols, maxGlyphWidth, mappedCodepoints,
    coverage: { requested: requested.length, mapped: mappedRequests, layoutControls, missing, zeroWidth, blank, allNonControlMapped: missing.length === 0 },
  };
}
