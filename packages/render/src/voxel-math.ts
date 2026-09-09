// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original bounded affine math.
export class VoxelRenderError extends Error { constructor(readonly code: string) { super(code); this.name = 'VoxelRenderError'; } }
export function fail(code: string): never { throw new VoxelRenderError(code); }
export function fields(value: unknown, names: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Reflect.ownKeys(value).length !== names.length) fail('voxel-fields');
  for (const name of names) { const d = Object.getOwnPropertyDescriptor(value, name); if (!d || !('value' in d) || !d.enumerable) fail('voxel-fields'); }
}
export function array(value: unknown, maximum: number): asserts value is readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum || Reflect.ownKeys(value).length !== value.length + 1) fail('voxel-array');
  for (let i = 0; i < value.length; i++) { const d = Object.getOwnPropertyDescriptor(value, String(i)); if (!d || !('value' in d) || !d.enumerable) fail('voxel-array'); }
}
export function integer(value: unknown, minimum: number, maximum: number, code = 'voxel-integer'): asserts value is number {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || (value as number) < minimum || (value as number) > maximum) fail(code);
}
export function finite(value: unknown, maximum = 1048576): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > maximum) fail('voxel-coordinate');
}
export function id(value: unknown): asserts value is string { if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,255}$/.test(value)) fail('voxel-id'); }
export const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const typed = Object.getPrototypeOf(Uint8Array.prototype) as object;
const lengthOf = Object.getOwnPropertyDescriptor(typed, 'byteLength')!.get!;
const bufferOf = Object.getOwnPropertyDescriptor(typed, 'buffer')!.get!;
const resizableOf = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
export function byteSize(input: Uint8Array, minimum: number, maximum: number): number {
  if (!input || Object.getPrototypeOf(input) !== Uint8Array.prototype) fail('voxel-bytes');
  const size = lengthOf.call(input) as number, buffer: unknown = bufferOf.call(input);
  if (!buffer || Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype || resizableOf?.call(buffer) || size < minimum || size > maximum) fail('voxel-byte-limit');
  return size;
}
export function copy(input: Uint8Array, size: number): Uint8Array { const out = new Uint8Array(size); Uint8Array.prototype.set.call(out, input); return out; }
export function matrix(value: readonly number[]): number[] {
  array(value, 12); if (value.length !== 12) fail('voxel-matrix');
  for (const n of value) finite(n); return Array.from(value);
}
export function multiply(a: readonly number[], b: readonly number[]): number[] {
  const out: number[] = [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
    let value = col === 3 ? a[row * 4 + 3]! : 0;
    for (let k = 0; k < 3; k++) value += a[row * 4 + k]! * b[k * 4 + col]!;
    finite(value); out.push(value);
  }
  return out;
}
export function inverse(m: readonly number[]): number[] {
  const [a,b,c,t,d,e,f,u,g,h,i,v] = m as [number,number,number,number,number,number,number,number,number,number,number,number];
  const det = a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);
  if (!Number.isFinite(det) || det === 0) fail('voxel-singular-transform');
  const out = [(e*i-f*h)/det,(c*h-b*i)/det,(b*f-c*e)/det,0,
    (f*g-d*i)/det,(a*i-c*g)/det,(c*d-a*f)/det,0,
    (d*h-e*g)/det,(b*g-a*h)/det,(a*e-b*d)/det,0];
  const norm = Math.max(...[0,4,8].map(r=>Math.abs(m[r]!)+Math.abs(m[r+1]!)+Math.abs(m[r+2]!)));
  const inverseNorm = Math.max(...[0,4,8].map(r=>Math.abs(out[r]!)+Math.abs(out[r+1]!)+Math.abs(out[r+2]!)));
  if (!Number.isFinite(inverseNorm) || norm*inverseNorm > 1e8) fail('voxel-ill-conditioned-transform');
  for (let r=0;r<12;r+=4) out[r+3]=-(out[r]!*t+out[r+1]!*u+out[r+2]!*v);
  for (const n of out) finite(n); return out;
}
export const identity = (): number[] => [1,0,0,0,0,1,0,0,0,0,1,0];
export function point(m: readonly number[], x: number, y: number, z: number): number[] {
  return [0,4,8].map(r=>m[r]!*x+m[r+1]!*y+m[r+2]!*z+m[r+3]!);
}
