// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Verified source joins precede world compilation.
import type { BrowserCatalog } from '../../../packages/vfs/src/browser-catalog.ts';
import type { BrowserMemberIdentity } from '../../../packages/vfs/src/browser-verified.ts';
import type { TerrainPreview } from '../../../packages/content/src/terrain-preview.ts';
import { compileEntityDefinitions } from '../../../packages/content/src/entity-definitions.ts';
import { compileTerrainTraversal } from '../../../packages/content/src/terrain-traversal.ts';
import { compileFoundationOccupancy } from '../../../packages/content/src/foundation-occupancy.ts';
import { compileWorldContent, WORLD_CONTENT_LIMITS, WorldContentError } from '../../../packages/sim/src/world-content.ts';

/** Re-read only the exact verified mission selected by the prepared profile. */
export async function readWorldMission(catalog: Pick<BrowserCatalog, 'lookup' | 'read'>, input: { path: string; source: BrowserMemberIdentity }): Promise<Uint8Array> {
  const path = input.path, source = Object.freeze({ ...input.source, root: Object.freeze({ ...input.source.root }) });
  if (!Number.isSafeInteger(source.size) || source.size < 1 || source.size > WORLD_CONTENT_LIMITS.mapBytes) throw new Error('world-map-limit');
  const candidates = catalog.lookup(path).candidates.filter(c => c.allowed && !c.ambiguousName && c.sourceId === source.root.sourceId && c.absoluteOffset === source.absoluteOffset && c.size === source.size);
  if (candidates.length !== 1) throw new Error('world-map-candidate');
  const candidateId = candidates[0]!.id;
  const read = await catalog.read(candidateId, source.sha256), actual = read.identity;
  if (actual.root.sourceId !== source.root.sourceId || actual.root.size !== source.root.size || actual.root.sha256 !== source.root.sha256 || actual.absoluteOffset !== source.absoluteOffset || actual.size !== source.size || actual.sha256 !== source.sha256 || read.bytes.byteLength !== source.size) throw new Error('world-map-identity');
  return read.bytes;
}

export async function prepareMissionWorld(catalog: BrowserCatalog, preview: TerrainPreview) {
  const content = preview.definitions.content; if (!content) throw new Error('world-content-unresolved');
  const mission = content.files.filter(f => f.role === 'mission');
  if (mission.length !== 1) throw new Error('world-map-source');
  const mapBytes = await readWorldMission(catalog, mission[0]!);
  const definitions = compileEntityDefinitions({ objects: preview.objects, rules: content.rules, art: content.tables.art });
  const traversal = compileTerrainTraversal({ contentIdentity: content.contentIdentity, terrain: preview.terrain, mapBytes, rules: content.sourceViews.rules, assets: preview.assets, choices: preview.choices, movementClasses: Array.from({ length: 8 }, (_, speedType) => ({ id: `speed-${speedType}`, speedType })) });
  try { return compileWorldContent({ mapBytes, rules: content.rules, definitions, traversal, footprints: compileFoundationOccupancy({ definitions }) }); }
  catch (error) {
    // An unsupported required native mask prevents movement, while the already
    // prepared static scene remains inspectable. Identity and other failures propagate.
    if (isUnavailableWorldFootprint(error)) return null;
    throw error;
  }
}
export function isUnavailableWorldFootprint(error: unknown): boolean { return error instanceof WorldContentError && error.code === 'unsupported-required-footprint'; }
