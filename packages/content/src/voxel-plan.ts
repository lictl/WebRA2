// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Native loading facts and explicit still policy; see ../VOXEL_RESOURCES_PROVENANCE.md.
import { assertObjectArtPlan, compileObjectArt, OBJECT_ART_POLICY, type ObjectArtPlan } from './object-art.ts';
import { compileEntityDefinitions, isEntityDefinitions, type EntityDefinitions } from './entity-definitions.ts';
import { assembleScenarioDefinitions } from './scenario-construction.ts';
import { createIniSourceView, findIniSourceSections, findIniSourceEntries } from './ini-source-view.ts';
import type { IniOrigin, RuntimeIni } from './runtime-ini.ts';
import type { ScenarioObjects } from './scenario-objects.ts';
import { fail, fields, limits, fingerprint, freeze, fold } from './voxel-content-utils.ts';
export { VoxelContentError } from './voxel-content-utils.ts';
export const VOXEL_PLAN_POLICY = 'webra2-voxel-still-1' as const;
export const VOXEL_PLAN_LIMITS = Object.freeze({ types: 256, placements: 4096, requests: 256, fieldReads: 1048576 });
type Limits = { -readonly [K in keyof typeof VOXEL_PLAN_LIMITS]: number };
export interface VoxelPlanField { readonly key: string; readonly source: 'rules' | 'art'; readonly value: boolean | number | null;
  readonly history: readonly IniOrigin[]; readonly status: 'default' | 'explicit' | 'unsupported' }
export interface VoxelPlanRequest { readonly id: string; readonly role: 'body' | 'turret' | 'barrel' | 'water-alternate' | 'no-spawn-alternate';
  readonly index: number | null; readonly vxlPath: string; readonly hvaPath: string; readonly required: boolean;
  /** Only body/ordinary turret/barrel enter the still; conditional models require a later runtime choice. */
  readonly still: boolean }
export interface VoxelPlanType { readonly id: string; readonly name: string; readonly status: 'ready' | 'unsupported'; readonly reasons: readonly string[];
  readonly palettePath: string | null; readonly requests: readonly VoxelPlanRequest[]; readonly fields: readonly VoxelPlanField[] }
export interface VoxelPlan {
  readonly policy: typeof VOXEL_PLAN_POLICY; readonly profile: RuntimeIni['profile']; readonly source: ScenarioObjects['source'];
  readonly definitionsSha256: string; readonly artPlanSha256: string; readonly sources: EntityDefinitions['sources'];
  readonly types: readonly VoxelPlanType[]; readonly placements: readonly Readonly<{ rowId: string; typeId: string }>[];
  readonly hvaLayout: 'frame-major'; readonly hvaFrame: 0; readonly sectionPolicy: 'ordinal-with-matching-vxl-id';
  readonly unsupportedPresentation: readonly string[]; readonly fingerprint: string;
  readonly nativeBehaviorVerified: false; readonly canStartCampaign: false;
}
const plans = new WeakSet<object>();
export function isVoxelPlan(value: unknown): value is VoxelPlan { return !!value && typeof value === 'object' && plans.has(value); }
export interface VoxelPlanInput { readonly policy: typeof VOXEL_PLAN_POLICY; readonly objects: ScenarioObjects; readonly artPlan: ObjectArtPlan;
  readonly definitions: EntityDefinitions; readonly rules: RuntimeIni; readonly art: RuntimeIni }
/** Reconstructs source stages and complete definition/art fingerprints; does not authenticate map geometry. */
export function compileVoxelPlan(input: VoxelPlanInput, options: Partial<Limits> = {}): VoxelPlan {
  fields(input, ['policy', 'objects', 'artPlan', 'definitions', 'rules', 'art']);
  const cap = limits({ ...VOXEL_PLAN_LIMITS }, options);
  if (input.policy !== VOXEL_PLAN_POLICY || !isEntityDefinitions(input.definitions)) fail('plan-input');
  assertObjectArtPlan(input.artPlan);
  const { objects, rules, art, artPlan, definitions } = input;
  // Both compilers validate the complete frozen raw structure before it is consumed here.
  const freshArt = compileObjectArt({ objects, rules, art, theater: artPlan.theater, policy: OBJECT_ART_POLICY });
  const freshDefinitions = compileEntityDefinitions({ objects, rules, art });
  if (freshDefinitions.fingerprint !== definitions.fingerprint || fingerprint(freshArt) !== fingerprint(artPlan)) fail('plan-identity');
  if (objects.placements.length > cap.placements) fail('placement-limit');
  const construction = assembleScenarioDefinitions({ objects, rules });
  const constructed = new Map(construction.registries.flatMap(r => r.entries).map(t => [t.id, t]));
  const view = createIniSourceView(art); let reads = 0, requests = 0;
  const charge = () => { if (++reads > cap.fieldReads) fail('field-limit'); };
  const result: VoxelPlanType[] = [];
  for (const type of artPlan.types) {
    // An unsupported plan with explicit voxel intent remains accounted for.
    if (type.status !== 'voxel' && !type.fields.some(f => f.key === 'Voxel' && /^(yes|true|1)$/i.test(f.value))) continue;
    if (result.length >= cap.types) fail('type-limit');
    const definition = constructed.get(type.id), reasons = [...type.reasons];
    if (type.status !== 'voxel' || !definition?.definitionStages.length) reasons.push('unsupported-art-plan');
    if (type.kind !== 'unit') reasons.push('unsupported-voxel-family');
    const recorded: VoxelPlanField[] = [];
    const read = (key: string, mode: 'bool' | 'count', initial: boolean | number): boolean | number | null => {
      let value: boolean | number | null = initial; const history: IniOrigin[] = [];
      for (const stage of definition?.definitionStages ?? []) for (const origin of stage.origins) {
        charge(); if (origin.keySpelling !== key) continue; history.push(origin);
        const s = origin.rawValue.split(';', 1)[0]!.trim();
        value = mode === 'bool' ? /^(yes|true|1)$/i.test(s) ? true : /^(no|false|0)$/i.test(s) ? false : null :
          /^\+?\d+$/.test(s) && Number(s) <= 18 ? Number(s) : null;
      }
      if (value === null) reasons.push(`unsupported-${fold(key)}`);
      recorded.push({ key, source: 'rules', value, history, status: value === null ? 'unsupported' : history.length ? 'explicit' : 'default' }); return value;
    };
    const turret = read('Turret', 'bool', false), count = read('TurretCount', 'count', 0);
    // IsGattling is a YR gate; the pinned RA2 loader has no corresponding key/branch.
    const gattling = definitions.profile === 'yr' ? read('IsGattling', 'bool', false) : false;
    const noSpawn = read('NoSpawnAlt', 'bool', false), arctic = read('AlternateArcticArt', 'bool', false);
    // Native attachment offset is separate from HVA/model transforms. Support only the unchanged zero case.
    const offsetHistory: IniOrigin[] = []; let offset: number | null = 0;
    for (const stage of definition?.definitionStages ?? []) {
      let image = definition!.name;
      for (const prior of definition!.definitionStages) {
        for (const o of prior.origins) { charge(); if (o.keySpelling === 'Image') image = o.rawValue.split(';', 1)[0]!.trim(); }
        if (prior === stage) break;
      }
      for (const layer of view.stages) {
        charge(); const sections = findIniSourceSections(view, layer.layer.id, image);
        if (sections.length > 1) { reasons.push('ambiguous-art-offset'); offset = null; }
        for (const section of sections) {
          const entries = findIniSourceEntries(section, 'TurretOffset'); if (entries.length > 1) { reasons.push('ambiguous-art-offset'); offset = null; }
          for (const e of entries) { charge(); offsetHistory.push(e.origin); offset = /^[+-]?\d+$/.test(e.value) && Number.isSafeInteger(Number(e.value)) ? Number(e.value) || 0 : null; }
        }
      }
    }
    recorded.push({ key: 'TurretOffset', source: 'art', value: offset, history: offsetHistory, status: offset === null ? 'unsupported' : offsetHistory.length ? 'explicit' : 'default' });
    if (offset !== 0) reasons.push('unsupported-attachment-offset');
    if (arctic) reasons.push('unsupported-arctic-model');
    const stem = fold(type.image), expectedPath = stem + '.vxl';
    if (!/^[a-z0-9_-]{1,24}$/.test(stem) || type.paths.length !== 1 || type.paths[0] !== expectedPath) reasons.push('unsupported-model-path');
    const parts: VoxelPlanRequest[] = [];
    const add = (role: VoxelPlanRequest['role'], suffix: string, index: number | null, required: boolean, still: boolean) => {
      if (++requests > cap.requests) fail('request-limit');
      parts.push({ id: `${type.id}/${role}${index === null ? '' : `/${index}`}`, role, index, vxlPath: stem + suffix + '.vxl', hvaPath: stem + suffix + '.hva', required, still });
    };
    if (!reasons.includes('unsupported-model-path')) {
      add('body', '', null, true, true);
      if (turret === true) {
        if (typeof count === 'number' && count > 0 && gattling === false) {
          reasons.push('unsupported-numbered-turret-selection');
          for (let i = 0; i < count; i++) { add('turret', 'tur' + (i || ''), i, true, false); add('barrel', 'barl' + (i || ''), i, false, false); }
        } else if (count !== null && gattling !== null) { add('turret', 'tur', null, false, true); add('barrel', 'barl', null, false, true); }
      } else if (turret === false) {
        if (definition?.name === 'APC') { add('water-alternate', 'w', null, true, false); reasons.push('unsupported-water-model-selection'); }
        if (noSpawn === true) { add('no-spawn-alternate', 'wo', null, true, false); reasons.push('unsupported-spawn-model-selection'); }
      }
    }
    result.push({ id: type.id, name: definition?.name ?? type.name, status: reasons.length ? 'unsupported' : 'ready', reasons: [...new Set(reasons)],
      palettePath: type.palettePath, requests: parts, fields: recorded });
  }
  const selected = new Set(result.map(t => t.id));
  const body = { policy: VOXEL_PLAN_POLICY, profile: definitions.profile, source: definitions.source,
    definitionsSha256: definitions.fingerprint, artPlanSha256: fingerprint(artPlan), sources: definitions.sources,
    types: result, placements: artPlan.placements.filter(p => selected.has(p.typeId)), hvaLayout: 'frame-major' as const,
    hvaFrame: 0 as const, sectionPolicy: 'ordinal-with-matching-vxl-id' as const,
    unsupportedPresentation: ['native-facing-and-animation', 'native-lighting-and-normal-tables', 'house-remap', 'attachment-motion', 'conditional-model-selection', 'gameplay-collision'],
    nativeBehaviorVerified: false as const, canStartCampaign: false as const };
  const plan = freeze({ ...body, fingerprint: fingerprint(body) }); plans.add(plan); return plan;
}
