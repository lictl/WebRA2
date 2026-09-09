// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Private, bounded application messages.
import { validArtworkSummary, validObjectPick, type ArtworkSummary, type ObjectPick } from './object-protocol.ts';
export const TERRAIN_VERSION = 2;
export const VIEW_LIMIT = Object.freeze({ width: 960, height: 640, files: 4096, path: 4096 });
export type TerrainProfile = 'ra2' | 'yr';
export type Zoom = 0.5 | 1 | 2 | 4;
export type Camera = { cameraX: number; cameraY: number; zoom: Zoom; width: number; height: number };
export type TerrainProgress = { phase: 'scan' | 'verify' | 'definitions' | 'mission' | 'theater' | 'tiles' | 'compose' | 'artwork' | 'sprites'; completed: number; total: number; bytes: number };
export type SceneSummary = { profile: TerrainProfile; mission: string; contentHash: string; artwork: ArtworkSummary; mapHash: string; paletteHash: string; cells: number; objects: number; assets: number; verifiedBytes: number; sourceBytes: number; decodedBytes: number; decodedSlots: number; bounds: { x: number; y: number; width: number; height: number }; diagnostics: { code: string; count: number }[] };
export type FrameSummary = { rgbaBytes: number; depthBytes: number; ownerBytes: number; totalPixelBytes: number; samples: number; objectOwnerBytes: number; spriteSamples: number; paletteBytes: number; objects: number };
export type CellPick = { sourceRecord: number; x: number; y: number; assetId: string; subtile: number; worldX: number; worldY: number; depth: number };
export type SelectedTerrainFile = { file: File; relativePath: string };
export type TerrainAction = { type: 'load'; profile: TerrainProfile; files: SelectedTerrainFile[]; width: number; height: number } | { type: 'render'; camera: Camera } | { type: 'pick'; frameId: number; x: number; y: number };
export type FrameResult = { type: 'frame'; frameId: number; camera: Camera; summary: SceneSummary; allocations: FrameSummary; rgba: ArrayBuffer };
export type ViewportPick = { kind: 'terrain'; cell: CellPick } | ObjectPick | null;
export type PickResult = { type: 'pick'; frameId: number; selection: ViewportPick };
export type TerrainResult = FrameResult | PickResult;
export type TerrainReply = { version: 2; id: number; type: 'progress'; sequence: number; progress: TerrainProgress } | { version: 2; id: number; type: 'result'; result: TerrainResult } | { version: 2; id: number; type: 'error'; code: string };
export function shape(value: unknown, names: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length !== names.length) return false;
  return names.every(n => { const d = Object.getOwnPropertyDescriptor(value, n); return d && 'value' in d; });
}
export function rows(value: unknown, max: number): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max || Reflect.ownKeys(value).length !== value.length + 1) return false;
  for (let i = 0; i < value.length; i++) { const d = Object.getOwnPropertyDescriptor(value, String(i)); if (!d || !('value' in d)) return false; }
  return true;
}
export const int = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
export const number = (v: unknown, max = 1048576): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max;
export const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export const profileId = (v: unknown): v is TerrainProfile => v === 'ra2' || v === 'yr';
export const code = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z][A-Za-z0-9-]{0,95}$/.test(v);
export const dimensions = (w: unknown, h: unknown): boolean => int(w, 1, VIEW_LIMIT.width) && int(h, 1, VIEW_LIMIT.height);
export function validCamera(v: unknown): v is Camera { return shape(v, ['cameraX','cameraY','zoom','width','height']) && number(v.cameraX) && number(v.cameraY) && [0.5,1,2,4].some(z=>v.zoom===z) && dimensions(v.width,v.height); }
export function validAction(v: unknown): v is TerrainAction {
  if (!v || typeof v !== 'object') return false;
  if (shape(v,['type','profile','files','width','height']) && v.type === 'load') return profileId(v.profile) && dimensions(v.width,v.height) && rows(v.files,VIEW_LIMIT.files) && v.files.length > 0 && v.files.every(f=>shape(f,['file','relativePath']) && f.file instanceof File && typeof f.relativePath === 'string' && f.relativePath.length <= VIEW_LIMIT.path && f.file.name.length <= VIEW_LIMIT.path);
  if (shape(v,['type','camera']) && v.type === 'render') return validCamera(v.camera);
  return shape(v,['type','frameId','x','y']) && v.type === 'pick' && int(v.frameId,1) && int(v.x,0,VIEW_LIMIT.width-1) && int(v.y,0,VIEW_LIMIT.height-1);
}
export function validProgress(v: unknown): v is TerrainProgress { return shape(v,['phase','completed','total','bytes']) && ['scan','verify','definitions','mission','theater','tiles','compose','artwork','sprites'].some(p=>v.phase===p) && int(v.completed,0,2**34) && int(v.total,0,2**34) && v.completed <= v.total && int(v.bytes,0,2**34); }
export function validScene(v: unknown): v is SceneSummary {
  if (!shape(v,['profile','mission','contentHash','artwork','mapHash','paletteHash','cells','objects','assets','verifiedBytes','sourceBytes','decodedBytes','decodedSlots','bounds','diagnostics']) || !profileId(v.profile) || v.mission !== (v.profile==='ra2'?'all01t.map':'all01umd.map') || !hash(v.mapHash) || !hash(v.paletteHash) || !hash(v.contentHash)) return false;
  if (!int(v.cells,1,130816) || !int(v.objects,0,32768) || !int(v.assets,1,1024) || !int(v.verifiedBytes,0,2**34) || !int(v.sourceBytes,0,128*1024**2) || !int(v.decodedBytes,0,64*1024**2) || !int(v.decodedSlots,0,65536)) return false;
  return validArtworkSummary(v.artwork,v.objects) && shape(v.bounds,['x','y','width','height']) && number(v.bounds.x) && number(v.bounds.y) && int(v.bounds.width,1,2097152) && int(v.bounds.height,1,2097152) && rows(v.diagnostics,32) && v.diagnostics.every(d=>shape(d,['code','count']) && code(d.code) && int(d.count,0,2**34));
}
export function validCellPick(v: unknown): v is CellPick | null { return v === null || (shape(v,['sourceRecord','x','y','assetId','subtile','worldX','worldY','depth']) && int(v.sourceRecord,0,130815) && int(v.x,1,511) && int(v.y,1,511) && typeof v.assetId==='string' && /^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,255}$/.test(v.assetId) && int(v.subtile,0,255) && number(v.worldX) && number(v.worldY) && number(v.depth,2097152)); }
export function validPick(v: unknown): v is ViewportPick { return v === null || validObjectPick(v) || (shape(v,['kind','cell']) && v.kind === 'terrain' && v.cell !== null && validCellPick(v.cell)); }
export function validResult(v: unknown): v is TerrainResult {
  if (shape(v,['type','frameId','selection']) && v.type==='pick') return int(v.frameId,1) && validPick(v.selection);
  if (!shape(v,['type','frameId','camera','summary','allocations','rgba']) || v.type!=='frame' || !int(v.frameId,1) || !validCamera(v.camera) || !validScene(v.summary)) return false;
  const bytes=v.camera.width*v.camera.height*4, a=v.allocations;
  return shape(a,['rgbaBytes','depthBytes','ownerBytes','totalPixelBytes','samples','objectOwnerBytes','spriteSamples','paletteBytes','objects']) && a.rgbaBytes===bytes && a.depthBytes===bytes && a.ownerBytes===bytes && a.totalPixelBytes===bytes*4 && a.objectOwnerBytes===bytes && int(a.samples,0,64*1024**2) && int(a.spriteSamples,0,a.samples) && int(a.paletteBytes,0,256*1280) && a.objects===v.summary.artwork.rendered && v.rgba instanceof ArrayBuffer && Object.getPrototypeOf(v.rgba)===ArrayBuffer.prototype && !Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'resizable')?.get?.call(v.rgba) && Reflect.ownKeys(v.rgba).length===0 && v.rgba.byteLength===bytes;
}
export function centered(summary: SceneSummary, width: number, height: number, zoom: Zoom = 1): Camera { return { cameraX:summary.bounds.x+summary.bounds.width/2-width/zoom/2, cameraY:summary.bounds.y+summary.bounds.height/2-height/zoom/2, width,height,zoom }; }
