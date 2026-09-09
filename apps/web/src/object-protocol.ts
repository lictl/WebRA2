// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Bounded application metadata; never source pixels.
export const PLACED_STILL_POLICY = 'webra2-placed-still-1' as const;
export const ART_REPORT_LIMIT = Object.freeze({ types: 256, characters: 262144, reasons: 8, label: 128, path: 256 });
export type ObjectFamily = 'infantry' | 'unit' | 'aircraft' | 'structure' | 'terrain' | 'smudge';
export type ArtworkStatus = 'ready' | 'missing' | 'blocked' | 'conflict' | 'unsupported-mount' | 'name-collision' | 'voxel' | 'unsupported-plan';
export type ArtworkType = { id: string; name: string; family: ObjectFamily; status: ArtworkStatus; placements: number; rendered: number; reasons: string[]; omittedReasons: number; sourcePath: string | null; sourceHash: string | null; palettePath: string | null; paletteHash: string | null };
export type ArtworkSummary = { policy: 'webra2-object-still-2'; presentation: typeof PLACED_STILL_POLICY; types: number; rendered: number; unavailable: number; assets: number; palettes: number; sourceBytes: number; decodedBytes: number; indexedFrames: number; rows: ArtworkType[]; omittedTypes: number; omittedPlacements: number; omittedRendered: number; truncatedFields: number; unplaced: number };
export type ObjectInfo = { id: string; typeId: string; name: string; family: ObjectFamily; owner: string | null; x: number; y: number; frame: 0; sourcePath: string; sourceHash: string; palettePath: string; paletteHash: string };
export type ObjectPick = { kind: 'object'; object: ObjectInfo; canvasX: number; canvasY: number; worldX: number; worldY: number; depth: number };
const familyValues = ['infantry','unit','aircraft','structure','terrain','smudge'];
const statusValues = ['ready','missing','blocked','conflict','unsupported-mount','name-collision','voxel','unsupported-plan'];
function record(v: unknown, keys: readonly string[]): v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || Object.getPrototypeOf(v) !== Object.prototype || Reflect.ownKeys(v).length !== keys.length) return false;
  return keys.every(k => { const d = Object.getOwnPropertyDescriptor(v,k); return d && 'value' in d; });
}
function dense(v: unknown, cap: number): v is unknown[] {
  if (!Array.isArray(v) || Object.getPrototypeOf(v) !== Array.prototype || v.length > cap || Reflect.ownKeys(v).length !== v.length + 1) return false;
  for (let i=0;i<v.length;i++) { const d = Object.getOwnPropertyDescriptor(v,String(i)); if (!d || !('value' in d)) return false; } return true;
}
const nat = (v: unknown, cap=32768): v is number => typeof v === 'number' && Number.isSafeInteger(v) && !Object.is(v,-0) && v >= 0 && v <= cap;
const text = (v: unknown, cap: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= cap && !/[\u0000-\u001f\u007f]/.test(v);
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,255}$/.test(v);
const sourcePair = (path: unknown, hash: unknown): boolean => path === null ? hash === null : text(path,ART_REPORT_LIMIT.path) && digest(hash);
export function validArtworkSummary(v: unknown, placements: number): v is ArtworkSummary {
  if (!record(v,['policy','presentation','types','rendered','unavailable','assets','palettes','sourceBytes','decodedBytes','indexedFrames','rows','omittedTypes','omittedPlacements','omittedRendered','truncatedFields','unplaced']) || v.policy !== 'webra2-object-still-2' || v.presentation !== PLACED_STILL_POLICY) return false;
  if (!nat(v.types,2048) || !nat(v.rendered) || !nat(v.unavailable) || v.rendered + v.unavailable !== placements || !nat(v.assets,1024) || !nat(v.palettes,256) || !nat(v.sourceBytes,128*1024**2) || !nat(v.decodedBytes,64*1024**2) || !nat(v.indexedFrames,65536) || !nat(v.omittedTypes,2048) || !nat(v.omittedPlacements) || !nat(v.omittedRendered) || !nat(v.truncatedFields,131072) || !nat(v.unplaced) || v.unplaced > v.unavailable || !dense(v.rows,ART_REPORT_LIMIT.types)) return false;
  let total=v.omittedPlacements, rendered=v.omittedRendered, characters=0; const ids=new Set<string>();
  for (const row of v.rows) {
    if (!record(row,['id','name','family','status','placements','rendered','reasons','omittedReasons','sourcePath','sourceHash','palettePath','paletteHash']) || !id(row.id) || ids.has(row.id) || !text(row.name,ART_REPORT_LIMIT.label) || !familyValues.some(f=>row.family===f) || !statusValues.some(s=>row.status===s) || !nat(row.placements) || !nat(row.rendered) || row.rendered > row.placements || (row.status !== 'ready' && row.rendered !== 0) || !dense(row.reasons,ART_REPORT_LIMIT.reasons) || !row.reasons.every(r=>text(r,128)) || !nat(row.omittedReasons) || !sourcePair(row.sourcePath,row.sourceHash) || !sourcePair(row.palettePath,row.paletteHash)) return false;
    if (row.status === 'ready' && (row.sourcePath === null || row.palettePath === null)) return false;
    ids.add(row.id); total += row.placements; rendered += row.rendered;
    characters += [row.id,row.name,row.family,row.status,row.sourcePath,row.sourceHash,row.palettePath,row.paletteHash,...row.reasons].reduce<number>((n,s)=>n+(typeof s==='string'?s.length:0),0);
    if (characters > ART_REPORT_LIMIT.characters) return false;
  }
  return v.rows.length + v.omittedTypes === v.types && total === placements && rendered === v.rendered && v.omittedRendered <= v.omittedPlacements;
}
export function validObjectPick(v: unknown): v is ObjectPick {
  if (!record(v,['kind','object','canvasX','canvasY','worldX','worldY','depth']) || v.kind !== 'object') return false;
  const o=v.object;
  if (!record(o,['id','typeId','name','family','owner','x','y','frame','sourcePath','sourceHash','palettePath','paletteHash']) || !id(o.id) || !id(o.typeId) || !text(o.name,ART_REPORT_LIMIT.label) || !familyValues.some(f=>o.family===f) || !(o.owner===null || text(o.owner,ART_REPORT_LIMIT.label)) || !nat(o.x,511) || o.x===0 || !nat(o.y,511) || o.y===0 || o.frame !== 0 || !text(o.sourcePath,ART_REPORT_LIMIT.path) || !digest(o.sourceHash) || !text(o.palettePath,ART_REPORT_LIMIT.path) || !digest(o.paletteHash)) return false;
  return nat(v.canvasX,2047) && nat(v.canvasY,2047) && [v.worldX,v.worldY,v.depth].every(n=>typeof n==='number' && Number.isSafeInteger(n) && Math.abs(n)<=2097152);
}
