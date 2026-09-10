// SPDX-License-Identifier: GPL-3.0-or-later
// Original WebRA2 policy; see ../TERRAIN_TRAVERSAL_GROUND_PROVENANCE.md.
import { sha256 } from '@noble/hashes/sha2.js';
import { isTerrainTraversal, type TerrainTraversal, type TerrainTraversalCell,
  type TerrainTraversalClass, type TraversalBlocker } from './terrain-traversal.ts';

export const TERRAIN_TRAVERSAL_GROUND_POLICY = 'webra2-ordinary-ground-1' as const;
export const TERRAIN_TRAVERSAL_GROUND_LIMITS = Object.freeze({ cells: 130816, classes: 8,
  graphWork: 8_388_608, outputCells: 1_046_528, outputBytes: 128 * 1024 ** 2 });
type Limits = { -readonly [K in keyof typeof TERRAIN_TRAVERSAL_GROUND_LIMITS]: number };
export type GroundTraversalBlocker = Exclude<TraversalBlocker, 'ramp' | 'tmp-height' | 'extra-plane'> |
  'unsupported-ramp-code' | 'unsupported-signed-level';
export interface TerrainTraversalGroundCell extends Omit<TerrainTraversalCell, 'blockers'> {
  readonly baseBlockers: readonly TraversalBlocker[];
  readonly blockers: readonly GroundTraversalBlocker[];
}
export interface TerrainTraversalGround {
  readonly policy: typeof TERRAIN_TRAVERSAL_GROUND_POLICY;
  /** Genuine immutable authority, including verified map/TMP bytes and exact land-factor provenance. */
  readonly base: TerrainTraversal;
  readonly baseSha256: string;
  readonly sha256: string;
  readonly source: TerrainTraversal['source'];
  readonly contentIdentity: TerrainTraversal['contentIdentity'];
  readonly traversalComplete: false;
  readonly nativeBehaviorVerified: false;
  readonly cells: readonly TerrainTraversalGroundCell[];
  readonly movementClasses: readonly TerrainTraversalClass[];
  readonly unresolved: readonly string[];
  readonly allocations: Readonly<{ graphWork: number; outputCells: number; outputBytes: number; reservedBytes: number }>;
}
export class TerrainTraversalGroundError extends Error {
  constructor(readonly code: string) { super(`ground-traversal-${code}`); this.name = 'TerrainTraversalGroundError'; }
}
const compiled = new WeakSet<object>(), freeze = Object.freeze;
const DX = [0, 1, 1, 1, 0, -1, -1, -1] as const, DY = [-1, -1, 0, 1, 1, 1, 0, -1] as const;
const UNRESOLVED = freeze(['native-INI-merge-and-CRT-boundaries', 'initial-land-table',
  'overlay-and-bridges', 'ice-and-tunnels', 'extra-tile-semantics', 'MovementZone-and-locomotors',
  'object-occupancy-and-infantry-subcells', 'continuous-height-and-native-pathfinding']);
function fail(code: string): never { throw new TerrainTraversalGroundError(code); }
function record(value: unknown): object {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('record');
  return value;
}
function datum(value: object, key: string): unknown {
  const d = Object.getOwnPropertyDescriptor(value, key);
  if (!d || !('value' in d) || !d.enumerable) fail('fields');
  return d.value;
}
function limits(input: Partial<Limits>): Limits {
  const value = record(input), out: Limits = { ...TERRAIN_TRAVERSAL_GROUND_LIMITS };
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !Object.hasOwn(out, key)) fail('limits');
    const n = datum(value, key);
    if (!Number.isSafeInteger(n) || Object.is(n, -0) || (n as number) < 0 || (n as number) > out[key as keyof Limits]) fail('limits');
    out[key as keyof Limits] = n as number;
  }
  return out;
}
/** Only genuine same-realm results are authority; frozen copies, proxies and saved JSON are not. */
export function isTerrainTraversalGround(value: unknown): value is TerrainTraversalGround {
  return !!value && typeof value === 'object' && compiled.has(value);
}
/** The ordinary nonbridge neighbor stage, not complete native locomotion or collision admission. */
function crosses(from: TerrainTraversalGroundCell, to: TerrainTraversalGroundCell): boolean {
  const delta = to.elevation - from.elevation;
  return delta === 0 || (delta === 1 && from.tmp.rampTypeByte !== 0) ||
    (delta === -1 && to.tmp.rampTypeByte !== 0);
}

/** Worker-intended, synchronous, owned graph extension. It cannot remove world/entity occupancy. */
export function compileTerrainTraversalGround(input: Readonly<{ base: TerrainTraversal }>,
  options: Partial<Limits> = {}): TerrainTraversalGround {
  const value = record(input);
  if (Reflect.ownKeys(value).length !== 1) fail('fields');
  // Capture a descriptor scalar before any caller reflection, and brand before nested reads.
  const base = datum(value, 'base');
  if (!isTerrainTraversal(base)) fail('base-authority');
  const cap = limits(options), n = base.cells.length, classes = base.movementClasses.length;
  if (n > cap.cells || classes > cap.classes) fail('count-limit');
  const possibleRows = n * classes, possibleWork = possibleRows * 8;
  if (possibleRows > cap.outputCells || possibleWork > cap.graphWork) fail('graph-limit');
  // Conservative logical allocation envelope before cell copies, maps or graph arrays.
  // Immutable base metadata is shared, not serialized/copied into this reservation.
  const reservedBytes = 8192 + n * 1536 + possibleRows * 128;
  if (reservedBytes > cap.outputBytes) fail('output-limit');
  const cells = base.cells.map((cell): TerrainTraversalGroundCell => {
    const blockers: GroundTraversalBlocker[] = [];
    for (const b of cell.blockers) if (b !== 'ramp' && b !== 'tmp-height' && b !== 'extra-plane') blockers.push(b);
    // Bounded published TS/RA2 ramp domain. No masking/coercion of unknown bytes.
    if (cell.tmp.rampTypeByte > 20) blockers.push('unsupported-ramp-code');
    // Native crossing reads the stored packed-map level with MOVSX byte.
    if (cell.elevation > 127) blockers.push('unsupported-signed-level');
    return freeze({ ...cell, baseBlockers: cell.blockers, blockers: freeze(blockers) });
  });
  let graphWork = 0, outputCells = 0;
  const movementClasses = base.movementClasses.map((c): TerrainTraversalClass => {
    const unavailable = { terrain: 0, factorUnknown: 0, factorNonpositive: 0, costRange: 0 };
    const eligible = new Map<number, { cell: TerrainTraversalGroundCell; cost: number }>();
    for (const cell of cells) {
      if (c.speedType === 4 || cell.blockers.length) { unavailable.terrain++; continue; }
      const factor = base.land[cell.landType!]!.factors[c.speedType]!.value;
      if (factor === null) { unavailable.factorUnknown++; continue; }
      if (factor <= 0) { unavailable.factorNonpositive++; continue; }
      const cost = Math.ceil(256 / factor);
      if (!Number.isSafeInteger(cost) || cost > 65535) { unavailable.costRange++; continue; }
      eligible.set(cell.x + cell.y * 512, { cell, cost });
    }
    const rows = [...eligible.values()].sort((a, b) => a.cell.y - b.cell.y || a.cell.x - b.cell.x).map(({ cell, cost }) => {
      let exits = 0;
      for (let d = 0; d < 8; d++) {
        graphWork++;
        const x = cell.x + DX[d]!, y = cell.y + DY[d]!;
        const to = x >= 0 && x < 512 && y >= 0 && y < 512 ? eligible.get(x + y * 512)?.cell : undefined;
        if (to && crosses(cell, to)) exits |= 1 << d;
      }
      outputCells++;
      return freeze({ x: cell.x, y: cell.y, cost, exits });
    });
    return freeze({ id: c.id, speedType: c.speedType, costScale: 256, status: c.status,
      cells: freeze(rows), unavailable: freeze(unavailable) });
  });
  // Fixed record fields/array order, streamed UTF-8 JSON lines. Base SHA already
  // binds raw cells, selected physical assets, factor histories and class identities.
  const hash = sha256.create(), encoder = new TextEncoder(); let outputBytes = 0;
  const write = (row: unknown): void => {
    const bytes = encoder.encode(JSON.stringify(row) + '\n'); outputBytes += bytes.length;
    if (outputBytes > cap.outputBytes) fail('output-limit'); hash.update(bytes);
  };
  write({ policy: TERRAIN_TRAVERSAL_GROUND_POLICY, baseSha256: base.sha256, unresolved: UNRESOLVED });
  for (const cell of cells) write({ sourceRecord: cell.sourceRecord, blockers: cell.blockers });
  for (const c of movementClasses) {
    write({ id: c.id, speedType: c.speedType, costScale: c.costScale, status: c.status, unavailable: c.unavailable });
    for (const cell of c.cells) write(cell);
  }
  const result: TerrainTraversalGround = freeze({ policy: TERRAIN_TRAVERSAL_GROUND_POLICY, base, baseSha256: base.sha256,
    sha256: Array.from(hash.digest(), b => b.toString(16).padStart(2, '0')).join(''), source: base.source,
    contentIdentity: base.contentIdentity, traversalComplete: false, nativeBehaviorVerified: false,
    cells: freeze(cells), movementClasses: freeze(movementClasses), unresolved: UNRESOLVED,
    allocations: freeze({ graphWork, outputCells, outputBytes, reservedBytes }) });
  compiled.add(result); return result;
}
