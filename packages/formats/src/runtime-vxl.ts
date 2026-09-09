// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors; OpenRA Developers and Contributors; Olaf van der Spek.
// See ../VOXEL_PROVENANCE.md. Raw geometry only; no normal/palette/world-space interpretation.
export const RUNTIME_VXL_LIMITS = Object.freeze({ fileBytes: 16 * 1024 * 1024, sections: 256, columns: 1048576, voxels: 4194304, runs: 4194304 });
type Limits = { -readonly [K in keyof typeof RUNTIME_VXL_LIMITS]: number };
export interface VxlName { readonly ascii: string | null; readonly bytes: readonly number[] }
export interface VxlFloatBlock { readonly values: readonly number[]; readonly bits: readonly number[] }
export interface VxlRange { readonly offset: number; readonly size: number }
export interface RuntimeVxlSection {
  readonly ordinal: number; readonly name: VxlName;
  readonly headerOffset: number; readonly footerOffset: number;
  readonly sectionId: number; readonly headerWord1: number; readonly headerWord2: number;
  readonly spanStartOffset: number; readonly spanEndOffset: number; readonly spanDataOffset: number;
  readonly scale: VxlFloatBlock; readonly transform: VxlFloatBlock; readonly bounds: VxlFloatBlock;
  readonly sizeX: number; readonly sizeY: number; readonly sizeZ: number;
  readonly normalType: number; readonly normalTable: 'ts-2' | 'ra2-4' | 'unsupported';
  readonly columnCount: number; readonly emptyColumns: number; readonly voxelCount: number; readonly runCount: number;
}
export interface VxlSpan {
  readonly column: number; readonly x: number; readonly y: number;
  readonly start: number; readonly endInclusive: number; readonly range: VxlRange | null;
}
export interface VxlGeometry {
  readonly section: number; readonly voxelCount: number; readonly stride: 5;
  /** Caller-owned records [x,y,z,colorIndex,normalIndex], ordered y, then x, then z. Color zero is retained. */
  readonly voxels: Uint8Array;
}
export interface RuntimeVxl {
  readonly format: 'vxl'; readonly sourceIdentity: 'not-hashed'; readonly byteLength: number;
  readonly headerWord: number; readonly paletteWord: number;
  readonly bodyRange: VxlRange; readonly sections: readonly RuntimeVxlSection[];
  readonly voxelCount: number; readonly columnCount: number; readonly runCount: number;
  readonly unclaimedBodyBytes: number; readonly unclaimedBodyRanges: number;
  readonly diagnostics: readonly Readonly<{ code: string; count: number }>[];
  readonly allocations: Readonly<{ sourceBytes: number; rangeWorkBytes: number; allGeometryBytes: number }>;
  /** Original 768 RGB bytes, without bit expansion, remapping or palette choice. */
  copyPalette(): Uint8Array;
  span(section: number, column: number): VxlSpan;
  decodeSection(section: number): VxlGeometry;
}
export class RuntimeVxlError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'RuntimeVxlError'; }
}
function fail(code: string): never { throw new RuntimeVxlError(code); }
function integer(value: unknown, min: number, max: number, code: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) fail(code);
}
function limits(options: Partial<Limits>): Limits {
  if (!options || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) fail('vxl-limits');
  const cap: Limits = { ...RUNTIME_VXL_LIMITS };
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('vxl-limits');
    const d = Object.getOwnPropertyDescriptor(options, key)!; if (!('value' in d)) fail('vxl-limits');
    integer(d.value, 0, cap[key as keyof Limits], 'vxl-limits'); cap[key as keyof Limits] = d.value;
  }
  return cap;
}
const typed = Object.getPrototypeOf(Uint8Array.prototype) as object;
const lengthOf = Object.getOwnPropertyDescriptor(typed, 'byteLength')!.get!;
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer')!.get!;
const resizableOf = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
function snapshot(input: Uint8Array, maximum: number): Uint8Array {
  if (!input || Object.getPrototypeOf(input) !== Uint8Array.prototype) fail('vxl-input');
  const length = lengthOf.call(input) as number, buffer: unknown = bufferOf.call(input);
  if (!(buffer instanceof ArrayBuffer) || resizableOf?.call(buffer) || length < 802 || length > maximum) fail('vxl-input-size');
  const bytes = new Uint8Array(length); Uint8Array.prototype.set.call(bytes, input); return bytes;
}
function name(bytes: Uint8Array, offset: number): VxlName {
  const raw = Array.from(bytes.subarray(offset, offset + 16)), end = raw.indexOf(0), used = raw.slice(0, end < 0 ? 16 : end);
  return Object.freeze({ ascii: used.every(n => n >= 32 && n <= 126) ? String.fromCharCode(...used) : null, bytes: Object.freeze(raw) });
}
function floats(view: DataView, offset: number, count: number): VxlFloatBlock {
  const values: number[] = [], bits: number[] = [];
  for (let i = 0; i < count; i++) {
    const value = view.getFloat32(offset + i * 4, true); if (!Number.isFinite(value)) fail('vxl-unsupported-nonfinite-float');
    values.push(value); bits.push(view.getUint32(offset + i * 4, true));
  }
  return Object.freeze({ values: Object.freeze(values), bits: Object.freeze(bits) });
}
const range = (offset: number, size: number): VxlRange => Object.freeze({ offset, size });
interface SectionDraft extends Omit<RuntimeVxlSection, 'emptyColumns' | 'voxelCount' | 'runCount'> { emptyColumns: number; voxelCount: number; runCount: number }

/** Full bounded span preflight over a fixed snapshot. Never accepts a caller-provided parsed index. */
export function createRuntimeVxl(input: Uint8Array, options: Partial<Limits> = {}): RuntimeVxl {
  const cap = limits(options), bytes = snapshot(input, cap.fileBytes), view = new DataView(bytes.buffer);
  const magic = 'Voxel Animation\0'; for (let i = 0; i < 16; i++) if (bytes[i] !== magic.charCodeAt(i)) fail('vxl-signature');
  const headerWord = view.getUint32(16, true), count = view.getUint32(20, true), footerCount = view.getUint32(24, true), bodySize = view.getUint32(28, true), paletteWord = view.getUint16(32, true);
  if (headerWord !== 1) fail('vxl-unsupported-header');
  integer(count, 1, cap.sections, 'vxl-section-limit'); if (footerCount !== count) fail('vxl-section-counts');
  const body = 802 + count * 28, footer = body + bodySize;
  if (footer + count * 92 !== bytes.length) fail('vxl-file-size');
  const sections: SectionDraft[] = []; let columnCount = 0, unknownNormals = 0, headerWords = 0, names = 0;
  for (let ordinal = 0; ordinal < count; ordinal++) {
    const h = 802 + ordinal * 28, f = footer + ordinal * 92;
    const sizeX = bytes[f + 88]!, sizeY = bytes[f + 89]!, sizeZ = bytes[f + 90]!, normalType = bytes[f + 91]!;
    if (!sizeX || !sizeY || !sizeZ) fail('vxl-empty-dimensions');
    const columns = sizeX * sizeY; columnCount += columns; if (columnCount > cap.columns) fail('vxl-column-limit');
    const spanStartOffset = view.getInt32(f, true), spanEndOffset = view.getInt32(f + 4, true), spanDataOffset = view.getInt32(f + 8, true);
    for (const offset of [spanStartOffset, spanEndOffset]) integer(offset, 0, bodySize - columns * 4, 'vxl-table-range');
    integer(spanDataOffset, 0, bodySize, 'vxl-data-range');
    const sectionId = view.getInt32(h + 16, true), headerWord1 = view.getUint32(h + 20, true), headerWord2 = view.getUint32(h + 24, true);
    const sectionName = name(bytes, h); if (sectionName.ascii === null) names++;
    if (sectionId !== ordinal || headerWord1 !== 1 || headerWord2 !== 0) headerWords++;
    const normalTable = normalType === 2 ? 'ts-2' : normalType === 4 ? 'ra2-4' : 'unsupported'; if (normalTable === 'unsupported') unknownNormals++;
    sections.push({ ordinal, name: sectionName, headerOffset: h, footerOffset: f, sectionId, headerWord1, headerWord2,
      spanStartOffset, spanEndOffset, spanDataOffset, scale: floats(view, f + 12, 1), transform: floats(view, f + 16, 12), bounds: floats(view, f + 64, 6),
      sizeX, sizeY, sizeZ, normalType, normalTable, columnCount: columns, emptyColumns: 0, voxelCount: 0, runCount: 0 });
  }
  // Packed integer intervals stay exact below 2^49 and avoid one JS object per span.
  const radix = RUNTIME_VXL_LIMITS.fileBytes + 1, ranges = new Float64Array(columnCount + sections.length * 2); let rangeCount = 0;
  function interval(start: number, end: number) { ranges[rangeCount++] = start * radix + end; }
  function spanOf(s: SectionDraft | RuntimeVxlSection, column: number): VxlSpan {
    integer(column, 0, s.columnCount - 1, 'vxl-column-index');
    const start = view.getInt32(body + s.spanStartOffset + column * 4, true), endInclusive = view.getInt32(body + s.spanEndOffset + column * 4, true);
    let value: VxlRange | null = null;
    if (start === -1 && endInclusive === -1) { /* Explicit empty column. */ }
    else {
      if (start < 0 || endInclusive < start || endInclusive >= bodySize - s.spanDataOffset) fail('vxl-span-range');
      value = range(body + s.spanDataOffset + start, endInclusive - start + 1);
    }
    return Object.freeze({ column, x: column % s.sizeX, y: Math.floor(column / s.sizeX), start, endInclusive, range: value });
  }
  for (const section of sections) {
    interval(section.spanStartOffset, section.spanStartOffset + section.columnCount * 4);
    interval(section.spanEndOffset, section.spanEndOffset + section.columnCount * 4);
    for (let column = 0; column < section.columnCount; column++) {
      const span = spanOf(section, column);
      if (span.range) interval(span.range.offset - body, span.range.offset - body + span.range.size); else section.emptyColumns++;
    }
  }
  ranges.subarray(0, rangeCount).sort(); let end = 0, unclaimedBodyBytes = 0, unclaimedBodyRanges = 0;
  for (let i = 0; i < rangeCount; i++) {
    const packed = ranges[i]!, start = Math.floor(packed / radix), next = packed - start * radix;
    if (start < end) fail('vxl-overlapping-ranges');
    if (start > end) { unclaimedBodyBytes += start - end; unclaimedBodyRanges++; } end = next;
  }
  if (end < bodySize) { unclaimedBodyBytes += bodySize - end; unclaimedBodyRanges++; }
  let voxelCount = 0, runCount = 0;
  function walk(section: SectionDraft | RuntimeVxlSection, output?: Uint8Array): { voxels: number; runs: number } {
    let written = 0, runs = 0;
    for (let column = 0; column < section.columnCount; column++) {
      const span = spanOf(section, column); if (!span.range) continue;
      let at = span.range.offset, z = 0; const stop = at + span.range.size;
      while (z < section.sizeZ) {
        if (stop - at < 3) fail('vxl-truncated-run');
        const skip = bytes[at++]!, count = bytes[at++]!;
        if (!skip && !count) fail('vxl-zero-progress');
        z += skip; if (z > section.sizeZ || count > section.sizeZ - z) fail('vxl-z-overflow');
        if (count * 2 + 1 > stop - at) fail('vxl-truncated-run');
        runs++; if (!output && runCount + runs > cap.runs) fail('vxl-run-limit');
        if (!output && voxelCount + written + count > cap.voxels) fail('vxl-voxel-limit');
        for (let i = 0; i < count; i++) {
          if (output) { const out = written * 5; output[out] = span.x; output[out + 1] = span.y; output[out + 2] = z; output[out + 3] = bytes[at]!; output[out + 4] = bytes[at + 1]!; }
          at += 2; z++; written++;
        }
        if (bytes[at++] !== count) fail('vxl-repeat-count');
      }
      if (at !== stop) fail('vxl-span-trailing-bytes');
    }
    return { voxels: written, runs };
  }
  for (const section of sections) {
    const decoded = walk(section); section.voxelCount = decoded.voxels; section.runCount = decoded.runs;
    voxelCount += decoded.voxels; runCount += decoded.runs; Object.freeze(section);
  }
  const diagnostics: { code: string; count: number }[] = [];
  for (const [code, amount] of [['uninterpreted-palette-word', paletteWord === 0x1f10 ? 0 : 1], ['nonstandard-section-header-words', headerWords],
    ['unsupported-normal-table', unknownNormals], ['non-ascii-section-name', names], ['unclaimed-body-ranges', unclaimedBodyRanges]] as const) {
    if (amount) diagnostics.push(Object.freeze({ code, count: amount }));
  }
  const sectionAt = (ordinal: number) => { integer(ordinal, 0, sections.length - 1, 'vxl-section-index'); return sections[ordinal]!; };
  return Object.freeze({ format: 'vxl' as const, sourceIdentity: 'not-hashed' as const, byteLength: bytes.length, headerWord, paletteWord, bodyRange: range(body, bodySize),
    sections: Object.freeze(sections), voxelCount, columnCount, runCount, unclaimedBodyBytes, unclaimedBodyRanges, diagnostics: Object.freeze(diagnostics),
    allocations: Object.freeze({ sourceBytes: bytes.length, rangeWorkBytes: ranges.byteLength, allGeometryBytes: voxelCount * 5 }),
    copyPalette: () => bytes.slice(34, 802),
    span: (section: number, column: number) => spanOf(sectionAt(section), column),
    decodeSection(ordinal: number): VxlGeometry {
      const section = sectionAt(ordinal), voxels = new Uint8Array(section.voxelCount * 5); walk(section, voxels);
      return Object.freeze({ section: ordinal, voxelCount: section.voxelCount, stride: 5 as const, voxels });
    },
  });
}
