// SPDX-License-Identifier: GPL-3.0-or-later
// Original compact definitions and binary fixtures; no retail content.
import { createHash } from 'node:crypto';
import { compileRuntimeIni } from '../../packages/content/src/runtime-ini.ts';
import { compileScenarioObjects } from '../../packages/content/src/scenario-objects.ts';
import { compileObjectArt, OBJECT_ART_POLICY } from '../../packages/content/src/object-art.ts';
import { hashMixName } from '../../packages/formats/src/mix-names.ts';
export const encode = (s: string): Uint8Array => new TextEncoder().encode(s);
export const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');
export const mission = '[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,3,2\n[Houses]\n0=OriginalHouse\n[OriginalHouse]\nCountry=OriginalCountry\n[Infantry]\n0=OriginalHouse,PERSON,256,2,2,2,Guard,0,None\n[Units]\n0=OriginalHouse,ROVER,256,2,2,0,Guard,None\n[Aircraft]\n0=OriginalHouse,FLYER,256,2,2,0,Guard,None\n[Structures]\n0=OriginalHouse,GHALL,256,2,2,0,None\n[Terrain]\n2002=PLANT\n[Smudge]\n0=TRACE,2,2,0\n';
export const rules = '[PERSON]\nImage=SPRITE_PERSON\n[ROVER]\nStrength=20\n[FLYER]\nStrength=20\n[GHALL]\nStrength=20\n[PLANT]\nStrength=20\n[TRACE]\nWidth=1\n';
export const art = '[SPRITE_PERSON]\nImage=ACTOR\nRemapable=yes\nSequence=OriginalSequence\n[ROVER]\nVoxel=yes\n[FLYER]\nVoxel=yes\n[GHALL]\nNewTheater=yes\nFoundation=2x3\n[PLANT]\nTheater=yes\n[TRACE]\nTerrainPalette=yes\n';
export function input(options: { profile?: 'ra2' | 'yr'; mission?: string; rules?: string; art?: string } = {}) {
  const profile = options.profile ?? 'ra2', m = encode(options.mission ?? mission), r = encode(options.rules ?? rules), a = encode(options.art ?? art);
  const source = { id: 'original-map', profile, sha256: sha(m) };
  return { policy: OBJECT_ART_POLICY, theater: profile === 'ra2' ? 'URBAN' as const : 'NEWURBAN' as const,
    objects: compileScenarioObjects({ profile, source, bytes: m }),
    rules: compileRuntimeIni(profile, [{ id: 'rules', profile, order: 0, kind: 'base', sourceSha256: sha(r), bytes: r }, { id: source.id, profile, order: 1, kind: 'map', sourceSha256: source.sha256, bytes: m }]),
    art: compileRuntimeIni(profile, [{ id: 'art', profile, order: 0, kind: 'base', sourceSha256: sha(a), bytes: a }]) };
}
export const plan = (options: Parameters<typeof input>[0] = {}) => compileObjectArt(input(options));
export function shp(color = 2): Uint8Array {
  const b = new Uint8Array(36), v = new DataView(b.buffer);
  v.setUint16(2, 4, true); v.setUint16(4, 4, true); v.setUint16(6, 1, true);
  v.setUint16(8, 1, true); v.setUint16(10, 1, true); v.setUint16(12, 2, true); v.setUint16(14, 2, true);
  v.setUint32(28, 32, true); b.set([0, color, color, 0], 32); return b;
}
export const palette = (): Uint8Array => Uint8Array.from({ length: 768 }, (_, i) => i % 64);
export function mix(rows: Record<string, Uint8Array>): Uint8Array {
  const entries = Object.entries(rows), total = entries.reduce((s, [, b]) => s + b.length, 0), data = 6 + entries.length * 12;
  const b = new Uint8Array(data + total), v = new DataView(b.buffer); v.setUint16(0, entries.length, true); v.setUint32(2, total, true);
  let offset = 0;
  entries.forEach(([name, bytes], i) => { const at = 6 + i * 12; v.setUint32(at, hashMixName(name), true); v.setUint32(at + 4, offset, true); v.setUint32(at + 8, bytes.length, true); b.set(bytes, data + offset); offset += bytes.length; });
  return b;
}
export const file = (name: string, bytes: Uint8Array): File => new File([Uint8Array.from(bytes).buffer], name);
export function assets(profile: 'ra2' | 'yr' = 'ra2'): Record<string, Uint8Array> {
  const suffix = profile === 'ra2' ? 'urb' : 'ubn', letter = profile === 'ra2' ? 'u' : 'n';
  return { 'actor.shp': shp(), [`g${letter}all.shp`]: shp(3), [`plant.${suffix}`]: shp(4), 'trace.shp': shp(5), [`unit${suffix}.pal`]: palette(), [`iso${suffix}.pal`]: palette() };
}
