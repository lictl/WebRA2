// SPDX-License-Identifier: GPL-3.0-or-later
// Original source-bound ordinary infantry policy. See ../INFANTRY_PASSAGE_PROVENANCE.md.
import { sha256 } from '@noble/hashes/sha2.js';
import { compileCombatActors, isCombatActors, type CombatActors } from '../../content/src/combat-actors.ts';
import { isEntityDefinitions, type EntityDefinitions, type EntityField } from '../../content/src/entity-definitions.ts';
import type { RuntimeIni, IniOrigin } from '../../content/src/runtime-ini.ts';
import type { ScenarioObjects } from '../../content/src/scenario-objects.ts';
import { isWorldContent, type WorldContent } from './world-content.ts';
import type { WorldModel } from './world-model.ts';
import { worldAddress, worldHash, worldInteger, worldRecord } from './world-values.ts';

export const INFANTRY_PASSAGE_POLICY = 'webra2-directed-infantry-slots-1' as const;
export const INFANTRY_PASSAGE_LIMITS = Object.freeze({ missionBytes: 16 * 1024 ** 2, actors: 2048, types: 16384,
  houses: 32, pairs: 1024, work: 4_194_304 });
export type InfantryPassageLimits = { -readonly [K in keyof typeof INFANTRY_PASSAGE_LIMITS]: number };
export type InfantrySubcell = 2 | 3 | 4;
export interface InfantryPassageActor {
  readonly entityId: number; readonly rowId: string; readonly typeId: string | null; readonly houseId: string | null;
  readonly playerId: number | null; readonly initialCell: number; readonly sourceSubcell: number | null;
  readonly sourceMission: string | null; readonly sourceTag: string | null;
  readonly status: 'ordinary-slots' | 'whole-cell'; readonly reasons: readonly string[]; readonly origin: IniOrigin;
}
export interface InfantryPassageCatalog {
  readonly policy: typeof INFANTRY_PASSAGE_POLICY; readonly profile: 'ra2' | 'yr'; readonly sha256: string;
  readonly source: ScenarioObjects['source']; readonly baseModelSha256: string; readonly worldSha256: string;
  readonly definitionsSha256: string; readonly actorsSha256: string; readonly rulesSources: RuntimeIni['layers'];
  readonly actors: readonly InfantryPassageActor[];
  readonly alliances: readonly Readonly<{ from: number; to: number }>[]; readonly alliancesComplete: boolean;
  readonly limits: Readonly<InfantryPassageLimits>; readonly nativeExecutionVerified: false; readonly canStartCampaign: false;
}
export class InfantryPassageError extends Error {
  constructor(readonly code: string) { super(`infantry-passage-${code}`); this.name = 'InfantryPassageError'; }
}
export function infantryPassageFail(code: string): never { throw new InfantryPassageError(code); }
export function infantryPassageFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(infantryPassageFreeze); Object.freeze(value); }
  return value;
}
const catalogs = new WeakMap<object, WorldModel>();
export const isInfantryPassageCatalog = (v: unknown): v is InfantryPassageCatalog => !!v && typeof v === 'object' && catalogs.has(v);
/** The genuine immutable base model only; no factory accepts caller-supplied actor permissions. */
export function infantryPassageBase(catalog: InfantryPassageCatalog): WorldModel {
  const model = catalogs.get(catalog); if (!model) return infantryPassageFail('catalog-brand'); return model;
}
function limits(options: Partial<InfantryPassageLimits>): InfantryPassageLimits {
  if (!options || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) infantryPassageFail('limits');
  const cap: InfantryPassageLimits = { ...INFANTRY_PASSAGE_LIMITS };
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) infantryPassageFail('limits');
    const d = Object.getOwnPropertyDescriptor(options, key)!; if (!('value' in d) || !d.enumerable) infantryPassageFail('limits');
    cap[key as keyof InfantryPassageLimits] = worldInteger(d.value, 0, cap[key as keyof InfantryPassageLimits]);
  } return cap;
}
const known = <T>(f: EntityField<T>): T | null => ['unsupported', 'not-applicable'].includes(f.status) ? null : f.value;
const same = (a: unknown, b: unknown) => worldHash(a) === worldHash(b);
export interface InfantryPassageInput {
  readonly world: WorldContent; readonly definitions: EntityDefinitions; readonly actors: CombatActors; readonly rules: RuntimeIni;
  readonly mission: { readonly source: ScenarioObjects['source']; readonly bytes: Uint8Array };
}
/** Rehashes owned mission bytes and reconstructs the source actor/house table. Rules-file byte authentication remains upstream. */
export function compileInfantryPassageCatalog(input: InfantryPassageInput, options: Partial<InfantryPassageLimits> = {}): InfantryPassageCatalog {
  const r = worldRecord(input, ['world', 'definitions', 'actors', 'rules', 'mission']), cap = limits(options);
  if (!isWorldContent(r.world) || !isEntityDefinitions(r.definitions) || !isCombatActors(r.actors)) infantryPassageFail('factory');
  const world = r.world, definitions = r.definitions, actors = r.actors, rules = r.rules as RuntimeIni;
  const m = worldRecord(r.mission, ['source', 'bytes']), source = worldRecord(m.source, ['id', 'profile', 'sha256']);
  if (world.model.combat || world.definitionsSha256 !== definitions.fingerprint || actors.entityFingerprint !== definitions.fingerprint ||
      actors.profile !== definitions.profile || source.profile !== definitions.profile || !same(source, definitions.source) ||
      !same(actors.source, definitions.source) || !same(actors.sources, definitions.sources.rules)) infantryPassageFail('source-join');
  if (world.model.entities.length > cap.actors || definitions.definitions.length > cap.types || actors.houses.length > cap.houses ||
      actors.directedAllies.length > cap.pairs) infantryPassageFail('source-limit');
  const raw = m.bytes;
  if (!raw || Object.getPrototypeOf(raw) !== Uint8Array.prototype) infantryPassageFail('mission-bytes');
  const proto = Object.getPrototypeOf(Uint8Array.prototype) as object;
  const size = Object.getOwnPropertyDescriptor(proto, 'byteLength')!.get!.call(raw) as number;
  const buffer = Object.getOwnPropertyDescriptor(proto, 'buffer')!.get!.call(raw) as unknown;
  if (!(buffer instanceof ArrayBuffer) || Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get?.call(buffer) ||
      size < 1 || size > cap.missionBytes) infantryPassageFail('mission-bytes');
  const bytes = new Uint8Array(size); Uint8Array.prototype.set.call(bytes, raw as Uint8Array);
  const digest = Array.from(sha256(bytes), n => n.toString(16).padStart(2, '0')).join('');
  if (digest !== source.sha256) infantryPassageFail('mission-hash');
  const fresh = compileCombatActors({ definitions, rules, mission: { source: definitions.source, bytes } },
    { missionBytes: cap.missionBytes, placements: cap.actors, types: cap.types, houses: cap.houses, pairs: cap.pairs, work: cap.work });
  if (fresh.fingerprint !== actors.fingerprint) infantryPassageFail('actor-reconstruction');
  const byId = new Map(world.model.entities.map(e => [e.id, e])), placed = new Map(world.placements.map(p => [p.rowId, p]));
  const types = new Map(definitions.definitions.map(t => [t.id, t]));
  if (fresh.placements.length !== world.placements.length || placed.size !== fresh.placements.length) infantryPassageFail('placement-count');
  const output: InfantryPassageActor[] = [];
  for (const a of fresh.placements) {
    const p = a.sourcePlacement, binding = placed.get(a.rowId), e = binding && byId.get(binding.entityId), type = a.typeId && types.get(a.typeId);
    if (!binding || !e || e.rowId !== a.rowId || binding.typeId !== a.typeId || binding.ownerId !== a.ownerId || e.owner !== a.ownerIndex ||
        e.x !== p.x || e.y !== p.y || e.kind !== p.kind || e.initialHealth !== known(a.initialHealth)) infantryPassageFail('placement-join');
    const reasons: string[] = [], values = p.row.values;
    if (p.kind !== 'infantry') reasons.push('non-infantry');
    else {
      const text = p.row.origin.rawValue.split(';', 1)[0]!.trim();
      if (p.row.origin.sectionSpelling !== 'Infantry' || values.length !== 14 || values.some(v => !v.length) ||
          text.length > 127 || /[^\x20-\x7e]/.test(text)) reasons.push('source-row-framing');
      if (!type || known(type.locomotor)?.kind !== 'walk') reasons.push('non-walk-locomotor');
      if (![2, 3, 4].includes(p.subcellRaw ?? -1)) reasons.push('unsupported-source-subcell');
      if (!/^[+]?0+$/.test(values[11] ?? '')) reasons.push('bridge-layer');
      if (binding.status !== 'mobile' || !e.blocksCell || e.movementPerTick <= 0 || e.initialHealth === null || e.initialHealth <= 0 || a.ownerId === null) reasons.push('unavailable-mobile-actor');
      // The ordinary fresh ground projection has no carried, airborne, teleported or scripted transport state.
      if (p.mission !== 'Guard' && p.mission !== 'Sleep' && p.mission !== 'Area Guard') reasons.push('special-source-mission');
    }
    output.push({ entityId: e.id, rowId: a.rowId, typeId: a.typeId, houseId: a.ownerId, playerId: e.owner,
      initialCell: worldAddress(e.x, e.y), sourceSubcell: p.subcellRaw, sourceMission: p.mission, sourceTag: p.tag,
      status: reasons.length ? 'whole-cell' : 'ordinary-slots', reasons, origin: p.row.origin });
  }
  output.sort((a, b) => a.entityId - b.entityId);
  const slots = new Map<string, InfantryPassageActor[]>();
  for (const a of output) if (a.status === 'ordinary-slots') { const key = `${a.initialCell}:${a.sourceSubcell}`, same = slots.get(key) ?? []; same.push(a); slots.set(key, same); }
  const indices = new Map(output.map((a, index) => [a.entityId, index]));
  for (const list of slots.values()) if (list.length > 1) for (const a of list) {
    // Preserve ambiguous original placements as whole-cell blockers; never silently move or discard them.
    const index = indices.get(a.entityId)!; output[index] = { ...a, status: 'whole-cell', reasons: [...a.reasons, 'source-slot-collision'] };
  }
  const alliances = fresh.coverage.initialAlliancesComplete ? fresh.directedAllies.map(p => ({ from: p.houseIndex, to: p.allyHouseIndex })).sort((a, b) => a.from - b.from || a.to - b.to) : [];
  const value = { policy: INFANTRY_PASSAGE_POLICY, profile: definitions.profile, source: definitions.source, baseModelSha256: world.model.sha256,
    worldSha256: world.sha256, definitionsSha256: definitions.fingerprint, actorsSha256: actors.fingerprint, rulesSources: actors.sources,
    actors: output, alliances, alliancesComplete: fresh.coverage.initialAlliancesComplete, limits: cap, nativeExecutionVerified: false as const, canStartCampaign: false as const };
  const result = infantryPassageFreeze({ ...value, sha256: worldHash(value) }); catalogs.set(result, world.model); return result;
}
