// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors; OpenRA Developers and Contributors; Olaf van der Spek.
// See ../VOXEL_PROVENANCE.md. Raw 3x4 matrices; no VXL matching/world-space application.
export const RUNTIME_HVA_LIMITS = Object.freeze({ fileBytes: 16 * 1024 * 1024, sections: 256, frames: 4096, matrices: 65536 });
type Limits = { -readonly [K in keyof typeof RUNTIME_HVA_LIMITS]: number };
export type HvaLayout = 'frame-major' | 'section-major';
export interface HvaName { readonly ascii: string | null; readonly bytes: readonly number[] }
export interface HvaTransform {
  readonly frame: number; readonly section: number; readonly record: number; readonly offset: number;
  /** Caller-owned IEEE-754 words, preserving negative zero and all accepted finite float bits. */
  readonly bits: Uint32Array;
  /** Caller-owned 12 row-major float32 entries, three rows of four columns. */
  readonly values: Float32Array;
}
export interface RuntimeHva {
  readonly format: 'hva'; readonly sourceIdentity: 'not-hashed'; readonly byteLength: number;
  readonly layout: HvaLayout; readonly nativeLayoutVerified: false;
  readonly identifier: HvaName; readonly sectionNames: readonly HvaName[];
  readonly frameCount: number; readonly sectionCount: number; readonly matrixCount: number; readonly dataOffset: number;
  readonly diagnostics: readonly Readonly<{ code: string; count: number }>[];
  transform(frame: number, section: number): HvaTransform;
}
export class RuntimeHvaError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'RuntimeHvaError'; }
}
function fail(code: string): never { throw new RuntimeHvaError(code); }
function integer(value: unknown, min: number, max: number, code: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) fail(code);
}
function limits(options: Partial<Limits>): Limits {
  if (!options || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) fail('hva-limits');
  const cap: Limits = { ...RUNTIME_HVA_LIMITS };
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('hva-limits');
    const d = Object.getOwnPropertyDescriptor(options, key)!; if (!('value' in d)) fail('hva-limits');
    integer(d.value, 0, cap[key as keyof Limits], 'hva-limits'); cap[key as keyof Limits] = d.value;
  }
  return cap;
}
const typed = Object.getPrototypeOf(Uint8Array.prototype) as object;
const lengthOf = Object.getOwnPropertyDescriptor(typed, 'byteLength')!.get!;
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer')!.get!;
const resizableOf = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
function snapshot(input: Uint8Array, maximum: number): Uint8Array {
  if (!input || Object.getPrototypeOf(input) !== Uint8Array.prototype) fail('hva-input');
  const length = lengthOf.call(input) as number, buffer: unknown = bufferOf.call(input);
  if (!(buffer instanceof ArrayBuffer) || resizableOf?.call(buffer) || length < 24 || length > maximum) fail('hva-input-size');
  const bytes = new Uint8Array(length); Uint8Array.prototype.set.call(bytes, input); return bytes;
}
function name(bytes: Uint8Array, offset: number): HvaName {
  const raw = Array.from(bytes.subarray(offset, offset + 16)), end = raw.indexOf(0), used = raw.slice(0, end < 0 ? 16 : end);
  return Object.freeze({ ascii: used.every(n => n >= 32 && n <= 126) ? String.fromCharCode(...used) : null, bytes: Object.freeze(raw) });
}

/** Caller chooses matrix ordering; the file has no layout tag. No name-based section matching is inferred. */
export function createRuntimeHva(input: Uint8Array, interpretation: Readonly<{ layout: HvaLayout }>, options: Partial<Limits> = {}): RuntimeHva {
  if (!interpretation || ![Object.prototype, null].includes(Object.getPrototypeOf(interpretation)) || Reflect.ownKeys(interpretation).length !== 1) fail('hva-layout');
  const descriptor = Object.getOwnPropertyDescriptor(interpretation, 'layout'); if (!descriptor || !('value' in descriptor)) fail('hva-layout');
  const layout: unknown = descriptor.value; if (layout !== 'frame-major' && layout !== 'section-major') fail('hva-layout');
  const cap = limits(options), bytes = snapshot(input, cap.fileBytes), view = new DataView(bytes.buffer);
  const frameCount = view.getUint32(16, true), sectionCount = view.getUint32(20, true);
  integer(frameCount, 1, cap.frames, 'hva-frame-limit'); integer(sectionCount, 1, cap.sections, 'hva-section-limit');
  const matrixCount = frameCount * sectionCount; if (matrixCount > cap.matrices) fail('hva-matrix-limit');
  const dataOffset = 24 + sectionCount * 16;
  if (dataOffset + matrixCount * 48 !== bytes.length) fail('hva-file-size');
  const sectionNames: HvaName[] = [], seen = new Set<string>(); let duplicates = 0, nonAscii = 0;
  for (let section = 0; section < sectionCount; section++) {
    const value = name(bytes, 24 + section * 16), key = value.bytes.join(',');
    if (seen.has(key)) duplicates++; seen.add(key); if (value.ascii === null) nonAscii++; sectionNames.push(value);
  }
  for (let i = 0; i < matrixCount * 12; i++) if (!Number.isFinite(view.getFloat32(dataOffset + i * 4, true))) fail('hva-unsupported-nonfinite-transform');
  const diagnostics: { code: string; count: number }[] = [Object.freeze({ code: 'caller-selected-layout-not-native-verified', count: 1 })];
  if (duplicates) diagnostics.push(Object.freeze({ code: 'duplicate-raw-section-name', count: duplicates }));
  if (nonAscii) diagnostics.push(Object.freeze({ code: 'non-ascii-section-name', count: nonAscii }));
  return Object.freeze({ format: 'hva' as const, sourceIdentity: 'not-hashed' as const, byteLength: bytes.length, layout, nativeLayoutVerified: false as const,
    identifier: name(bytes, 0), sectionNames: Object.freeze(sectionNames), frameCount, sectionCount, matrixCount, dataOffset, diagnostics: Object.freeze(diagnostics),
    transform(frame: number, section: number): HvaTransform {
      integer(frame, 0, frameCount - 1, 'hva-frame-index'); integer(section, 0, sectionCount - 1, 'hva-section-index');
      const record = layout === 'frame-major' ? frame * sectionCount + section : section * frameCount + frame, offset = dataOffset + record * 48;
      const bits = new Uint32Array(12), values = new Float32Array(12);
      for (let i = 0; i < 12; i++) { bits[i] = view.getUint32(offset + i * 4, true); values[i] = view.getFloat32(offset + i * 4, true); }
      return Object.freeze({ frame, section, record, offset, bits, values });
    },
  });
}
