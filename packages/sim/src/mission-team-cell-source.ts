// SPDX-License-Identifier: GPL-3.0-or-later
// Original bounded constructor prerequisites. See ../MISSION_TEAM_CELL_PROVENANCE.md.
import { isEntityDefinitions, type EntityDefinitions, type EntityField } from '../../content/src/entity-definitions.ts';
import { compileCombatActors } from '../../content/src/combat-actors.ts';
import { compileCombatVeterancy } from '../../content/src/combat-veterancy.ts';
import { createIniSourceView, findIniSourceEntries, findIniSourceSections } from '../../content/src/ini-source-view.ts';
import type { RuntimeIni, IniOrigin } from '../../content/src/runtime-ini.ts';
import { weaponBoolean, weaponInteger } from '../../content/src/weapon-numbers.ts';
import { isTerrainTraversal } from '../../content/src/terrain-traversal.ts';
import { teamFingerprint } from '../../content/src/team-values.ts';
import { isMissionCellEntrySource, missionCellEntrySourceBindings, type MissionCellEntrySource } from './mission-cell-entry-source.ts';
import { isMissionTeamActionSource, missionTeamActionSourceContext, type MissionTeamActionSource } from './mission-team-action-source.ts';
import { worldContentTraversal, type WorldContent } from './world-content.ts';
import { teamRuntimeFreeze as freeze } from './team-runtime-program.ts';
import { worldRecord } from './world-values.ts';
import { missionTeamCellBytes, missionTeamCellCompare as compare, missionTeamCellFail as fail, missionTeamCellLimits } from './mission-team-cell-values.ts';
import { MISSION_TEAM_CELL_SOURCE_POLICY, type MissionTeamCellSource, type MissionTeamCellSourceInput, type MissionTeamCellLimits,
  type MissionTeamCellArchetype, type MissionTeamCellSourceAction, type MissionTeamCellWorldInvariant, type MissionTeamCellTypeFields } from './mission-team-cell-types.ts';
export { MissionTeamCellError } from './mission-team-cell-values.ts';
export type { MissionTeamCellSource, MissionTeamCellSourceInput } from './mission-team-cell-types.ts';
export interface MissionTeamCellSourceContext {
  readonly cells: MissionCellEntrySource; readonly actions: MissionTeamActionSource; readonly definitions: EntityDefinitions;
  readonly rules: RuntimeIni; readonly world: WorldContent; readonly traversal: ReturnType<typeof worldContentTraversal>;
}
const contexts = new WeakMap<object, MissionTeamCellSourceContext>();
export const isMissionTeamCellSource = (v: unknown): v is MissionTeamCellSource => !!v && typeof v === 'object' && contexts.has(v);
export function missionTeamCellSourceContext(source: MissionTeamCellSource): MissionTeamCellSourceContext {
  return contexts.get(source) ?? fail('source-brand');
}
const initial = <T>(value: T): EntityField<T> => ({ value, status: 'default', rule: 'fresh-native-type-constructor', origin: null, history: [] });
const known = <T>(field: EntityField<T>): T | null => field.status === 'unsupported' || field.status === 'not-applicable' ? null : field.value;

/** Source preflight only. Constructor facts and the required WebRA2 transition invariant are separate. */
export function compileMissionTeamCellSource(input: MissionTeamCellSourceInput, lowerLimits: Partial<MissionTeamCellLimits> = {}): MissionTeamCellSource {
  const r = worldRecord(input, ['cells', 'actions', 'definitions', 'rules', 'mission']), cap = missionTeamCellLimits(lowerLimits);
  if (!isMissionCellEntrySource(r.cells) || !isMissionTeamActionSource(r.actions) || !isEntityDefinitions(r.definitions)) fail('factory');
  const cells = r.cells, actions = r.actions, definitions = r.definitions, ac = missionTeamActionSourceContext(actions), world = ac.world;
  if (missionCellEntrySourceBindings(cells) !== ac.bindings || cells.worldContentSha256 !== world.sha256 || cells.worldSha256 !== world.model.sha256 ||
    actions.entitiesSha256 !== definitions.fingerprint || world.definitionsSha256 !== definitions.fingerprint || cells.profile !== definitions.profile) fail('source-identity');
  if (definitions.definitions.length > cap.types || world.model.entities.length > cap.actors || cells.actors.length > cap.actors ||
    actions.actions.length > cap.actions || ac.spawnCatalogs.length + ac.recruitmentCatalogs.length > cap.catalogs) fail('count-limit');
  const mr = worldRecord(r.mission, ['source', 'bytes']), ms = worldRecord(mr.source, ['id', 'profile', 'sha256']);
  if (ms.id !== definitions.source.id || ms.profile !== definitions.profile || ms.sha256 !== definitions.source.sha256 ||
    actions.source.id !== ms.id || actions.source.sha256 !== ms.sha256) fail('mission-identity');
  const mission = { source: { ...definitions.source }, bytes: missionTeamCellBytes(mr.bytes, cap.missionBytes) }, rules = r.rules as RuntimeIni;
  // Each nested compiler has its own bounded work counter. Eight disjoint shares reserve
  // its source-view passes, reconstruction and our final indexing; no full cap per pass.
  const passWork = Math.floor(cap.sourceWork / 8), nested = { stages: cap.stages, occurrences: cap.occurrences,
    nodes: Math.min(cap.nodes, passWork), characters: cap.characters, work: passWork };
  const actorSource = compileCombatActors({ definitions, rules, mission }, { ...nested, types: cap.types, placements: cap.actors,
    fields: cap.fields, rawFields: cap.fields, history: cap.history, tokens: Math.min(32768, cap.tokens), missionBytes: cap.missionBytes, serializedBytes: cap.serializedBytes });
  const veterancy = compileCombatVeterancy({ actors: actorSource, rules }, { ...nested, types: cap.types, fields: cap.fields,
    history: cap.history, tokens: cap.tokens, serializedBytes: cap.serializedBytes });
  const view = createIniSourceView(rules, nested), hash = (v: unknown) => teamFingerprint(v, cap.serializedBytes);
  if (hash(rules.layers) !== hash(ac.bindings.rules) || actorSource.entityFingerprint !== definitions.fingerprint ||
    hash(definitions.source) !== hash(cells.source)) fail('rules-identity');
  let work = 0, references = 0, history = 0, fieldReads = 0;
  const charge = (n = 1) => { if (n > passWork - work) fail('source-work-limit'); work += n; };
  const reference = (n = 1) => { if (n > cap.references - references) fail('reference-limit'); references += n; charge(n); };
  const diagnostics: { code: string; subjectId: string }[] = [];
  const diagnostic = (code: string, subjectId: string) => { reference(); diagnostics.push({ code, subjectId }); };
  charge(definitions.definitions.length + actorSource.definitions.length + veterancy.types.length);
  const types = new Map(definitions.definitions.map(t => [t.id, t])), rawTypes = new Map(actorSource.definitions.map(t => [t.id, t]));
  const abilities = new Map(veterancy.types.map(t => [t.typeId, t]));
  charge(view.stages.length); const encodings = new Map(view.stages.map(s => [s.layer.id, s.layer.encoding]));
  function field<T extends number | boolean>(typeId: string, key: string, fallback: T): EntityField<T> {
    const type = rawTypes.get(typeId) ?? fail('type-source'); let result = initial(fallback);
    for (const origin of type.rawFields) {
      charge(); if (origin.keySpelling !== key) continue;
      if (++fieldReads > cap.fields) fail('field-limit');
      const sections = findIniSourceSections(view, origin.layerId, origin.sectionSpelling);
      if (sections.length !== 1) fail('field-section');
      const entries = findIniSourceEntries(sections[0]!, key), e = entries[0];
      if (entries.length !== 1 || !e || hash(e.origin) !== hash(origin)) fail('field-origin');
      if (result.history.length + 1 > cap.history - history) fail('history-limit'); history += result.history.length + 1;
      const origins: readonly IniOrigin[] = [...result.history, origin];
      if (!e.value) { result = { ...result, history: origins }; continue; }
      const value = e.value.length <= 127 && encodings.get(origin.layerId) === 'byte-preserving-ascii-compatible'
        ? (typeof fallback === 'boolean' ? weaponBoolean(e.value) : weaponInteger(e.value)) : null;
      result = { value: value as T | null, status: value === null ? 'unsupported' : 'explicit',
        rule: value === null ? 'unsupported-native-parser-input' : 'native-read-current-default', origin, history: origins };
    }
    return result;
  }
  const prerequisites = new Map<string, { fields: MissionTeamCellTypeFields; reasons: readonly string[] }>();
  function prerequisite(typeId: string) {
    charge(); const cached = prerequisites.get(typeId); if (cached) return cached;
    const type = types.get(typeId) ?? fail('type-identity'), ability = abilities.get(typeId) ?? fail('ability-identity');
    const fields: MissionTeamCellTypeFields = { cloakable: field(typeId, 'Cloakable', false), passengers: field(typeId, 'Passengers', 0),
      veteranAbilities: ability.veteran, eliteAbilities: ability.elite, locomotor: type.locomotor };
    const reasons: string[] = [];
    if (type.kind !== 'infantry' && type.kind !== 'unit') reasons.push('unsupported-actor-family');
    if (known(fields.cloakable) !== false) reasons.push('cloakable-construction');
    if (known(fields.passengers) !== 0) reasons.push('transport-construction');
    for (const [name, f] of [['veteran', fields.veteranAbilities], ['elite', fields.eliteAbilities]] as const)
      if (known(f) === null || known(f)!.includes('CLOAK')) reasons.push(`${name}-cloak-ability`);
    if (known(fields.locomotor)?.kind !== (type.kind === 'infantry' ? 'walk' : 'drive')) reasons.push('unsupported-entry-locomotor');
    const value = { fields, reasons }; prerequisites.set(typeId, value); return value;
  }
  const traversal = worldContentTraversal(world), flat = isTerrainTraversal(traversal);
  let navigationReady = flat;
  if (!flat) diagnostic('requires-authenticated-flat-traversal', 'world');
  else {
    charge(traversal.cells.length); const terrain = new Map(traversal.cells.map(c => [c.y * 512 + c.x, c]));
    // The retained factory, not its SHA label, proves the selected world grids.
    // Overlay and bridge-adjacent unsupported cells can remain in source metadata,
    // but never in the admitted flat movement graph.
    for (const movement of traversal.movementClasses) for (const c of movement.cells) {
      charge(); const cell = terrain.get(c.y * 512 + c.x);
      if (!cell || cell.blockers.length || cell.overlayType !== 255) navigationReady = false;
    }
    if (!navigationReady) diagnostic('unsupported-navigation-cell', 'world');
  }
  const providers: MissionTeamCellWorldInvariant['initialCloakProviders'][number][] = [], providerTypes = new Map<string, EntityField<boolean>>();
  const initialActors: MissionTeamCellWorldInvariant['initialActors'][number][] = [];
  for (const entity of world.model.entities) {
    charge();
    if (entity.movementPerTick > 0 && entity.initialHealth !== 0) {
      const { fields, reasons } = prerequisite(entity.typeId);
      initialActors.push({ entityId: entity.id, typeId: entity.typeId, fields, status: reasons.length ? 'unsupported' : 'supported', reasons });
      for (const reason of reasons) diagnostic(`initial-context:${reason}`, `entity:${entity.id}`);
    }
    if (entity.kind !== 'structure') continue;
    const cloakGenerator = providerTypes.get(entity.typeId) ?? field(entity.typeId, 'CloakGenerator', false);
    providerTypes.set(entity.typeId, cloakGenerator); const status = known(cloakGenerator) === false ? 'inactive' : 'unsupported';
    providers.push({ entityId: entity.id, typeId: entity.typeId, cloakGenerator, status });
    if (status === 'unsupported') diagnostic('initial-cloak-provider', `entity:${entity.id}`);
  }
  const archetypeRefs = new Map<string, { actionIds: Set<string>; catalogs: Set<string> }>(), actionRows: MissionTeamCellSourceAction[] = [];
  charge(ac.spawnCatalogs.length); const spawn = new Map(ac.spawnCatalogs.map(c => [c.sha256, c]));
  for (const action of actions.actions) {
    reference(); const reasons = [...action.reasons]; let kind: MissionTeamCellSourceAction['kind'] = 'unsupported'; let typeIds: string[] = [];
    if (action.candidates.length === 1 && action.catalogSha256) {
      const candidate = action.candidates[0]!; kind = candidate.family;
      if (candidate.family === 'spawn') {
        const catalog = spawn.get(action.catalogSha256) ?? fail('action-catalog'); charge(catalog.templates.length);
        const template = catalog.templates.find(t => t.teamId === action.teamId) ?? fail('action-template');
        reference(template.memberTypeIds.length); typeIds = [...template.memberTypeIds];
        for (const typeId of typeIds) { const refs = archetypeRefs.get(typeId) ?? { actionIds: new Set<string>(), catalogs: new Set<string>() };
          refs.actionIds.add(action.instructionId); refs.catalogs.add(catalog.sha256); archetypeRefs.set(typeId, refs); }
      }
    }
    if (action.status !== 'supported-source' || kind === 'unsupported') reasons.push('unsupported-team-action');
    actionRows.push({ instructionId: action.instructionId, catalogSha256: action.catalogSha256, kind, typeIds,
      status: reasons.length ? 'unsupported' : 'supported', reasons });
  }
  const archetypes: MissionTeamCellArchetype[] = [];
  for (const [typeId, refs] of [...archetypeRefs].sort((a, b) => compare(a[0], b[0]))) {
    reference(); const type = types.get(typeId) ?? fail('type-identity');
    if (type.kind !== 'infantry' && type.kind !== 'unit') fail('spawn-family');
    const { fields, reasons } = prerequisite(typeId);
    archetypes.push({ typeId, kind: type.kind, actionIds: [...refs.actionIds].sort(compare), catalogSha256s: [...refs.catalogs].sort(compare),
      fields, constructorEligibility: reasons.length ? 'unsupported' : 'supported', reasons });
    for (const reason of reasons) diagnostic(reason, typeId);
  }
  const byType = new Map(archetypes.map(t => [t.typeId, t]));
  for (let i = 0; i < actionRows.length; i++) {
    const action = actionRows[i]!; reference(action.typeIds.length);
    const reasons = [...action.reasons]; if (action.typeIds.some(id => byType.get(id)?.constructorEligibility !== 'supported')) reasons.push('unsupported-construction');
    if (reasons.length) { actionRows[i] = { ...action, status: 'unsupported', reasons }; for (const code of reasons) diagnostic(code, action.instructionId); }
  }
  const constructorReady = actionRows.every(a => a.status === 'supported'), invariantReady = navigationReady && providers.every(p => p.status === 'inactive') && initialActors.every(a => a.status === 'supported');
  const invariant: MissionTeamCellWorldInvariant = { policy: 'webra2-independent-ground-team-cell-1', navigation: 'authenticated-flat-source-no-overlay',
    initialActors, initialCloakProviders: providers, dynamicOwnershipSupported: false, transportAndFollowerAttachmentSupported: false,
    automaticCrateAndCloakProviderMutationSupported: false, nativeAutonomousBehaviorVerified: false };
  const common = { policy: MISSION_TEAM_CELL_SOURCE_POLICY, profile: definitions.profile, cellSourceSha256: cells.sha256,
    actionSourceSha256: actions.sha256, baseWorldSha256: world.sha256, baseModelSha256: world.model.sha256, definitionsSha256: definitions.fingerprint,
    source: definitions.source, sources: rules.layers, archetypes, actions: actionRows, invariant, diagnostics,
    coverage: { representedSpawnActions: actionRows.filter(a => a.kind === 'spawn').length, representedSpawnArchetypes: archetypes.length,
      unsupportedSpawnArchetypes: archetypes.filter(a => a.constructorEligibility === 'unsupported').length,
      allRequiredConstructorsReady: constructorReady, supportedWorldInvariantReady: invariantReady },
    limits: cap, nativeExecutionVerified: false as const, canStartCampaign: false as const };
  const result: MissionTeamCellSource = freeze({ ...common, sha256: hash(common) });
  contexts.set(result, freeze({ cells, actions, definitions, rules, world, traversal })); return result;
}
