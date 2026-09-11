// SPDX-License-Identifier: GPL-3.0-or-later
// Original source catalog; no mission invocation or lifecycle authority.
import { isEntityDefinitions, type EntityField } from '../../content/src/entity-definitions.ts';
import { compileCombatActors } from '../../content/src/combat-actors.ts';
import { createIniSourceView, findIniSourceSections, findIniSourceEntries } from '../../content/src/ini-source-view.ts';
import type { IniOrigin, RuntimeIni } from '../../content/src/runtime-ini.ts';
import { weaponBoolean } from '../../content/src/weapon-numbers.ts';
import { teamFingerprint } from '../../content/src/team-values.ts';
import { isMissionBindingCatalog, missionBindingSourceContext } from './mission-bindings.ts';
import { worldRecord } from './world-values.ts';
import { teamRuntimeFreeze as freeze } from './team-runtime-program.ts';
import { houseBytes, houseFail as fail, houseLimits } from './mission-house-values.ts';
import { MISSION_HOUSE_SOURCE_POLICY, type MissionHouseInput, type MissionHouseSource, type MissionHouseType,
  type MissionHouseLimits, type MissionHouseInstruction, type MissionHouseSelector, type HousePopulationClass } from './mission-house-types.ts';
export * from './mission-house-types.ts';

const contexts = new WeakMap<object, Omit<MissionHouseInput, 'mission'>>();
export const isMissionHouseSource = (value: unknown): value is MissionHouseSource => !!value && typeof value === 'object' && contexts.has(value);
export function missionHouseSourceContext(source: MissionHouseSource) { return contexts.get(source) ?? fail('source-brand'); }
const initial = <T>(value: T, rule = 'fresh-native-constructor'): EntityField<T> => ({ value, status: 'default', rule, origin: null, history: [] });
const known = <T>(field: EntityField<T>) => field.status === 'unsupported' ? null : field.value;

/** Ordered rule pins are upstream verified-source identities. Mission bytes are
 * owned and rehashed by the actor compiler; a source label alone is insufficient. */
export function compileMissionHouseSource(input: MissionHouseInput, options: Partial<MissionHouseLimits> = {}): MissionHouseSource {
  const r = worldRecord(input, ['bindings', 'definitions', 'rules', 'mission']), cap = houseLimits(options);
  if (!isMissionBindingCatalog(r.bindings) || !isEntityDefinitions(r.definitions)) fail('factory');
  const bindings = r.bindings, definitions = r.definitions, { world, logic, countries, houses } = missionBindingSourceContext(bindings);
  const hash = (v: unknown) => teamFingerprint(v, cap.serializedBytes);
  if (bindings.definitionsSha256 !== definitions.fingerprint || hash(bindings.source) !== hash(definitions.source) ||
    bindings.worldSha256 !== world.model.sha256 || bindings.worldContentSha256 !== world.sha256) fail('source-identity');
  if (world.model.entities.length > cap.actors || definitions.definitions.length > cap.types || world.players.length > cap.houses) fail('count-limit');
  const mr = worldRecord(r.mission, ['source', 'bytes']), ms = worldRecord(mr.source, ['id', 'profile', 'sha256']);
  if (hash(ms) !== hash(definitions.source)) fail('mission-identity');
  const mission = { source: { ...definitions.source }, bytes: houseBytes(mr.bytes, cap.missionBytes) }, rules = r.rules as RuntimeIni;
  // Two fixed construction ceilings are reserved before the actor compiler's
  // three counters and this module's source-view and projection counters.
  const fixed = 2 * 4_194_304;
  if (cap.sourceWork <= fixed) fail('source-work-limit');
  const passWork = Math.floor((cap.sourceWork - fixed) / 5), nested = { stages: cap.stages, occurrences: cap.occurrences,
    nodes: Math.min(cap.nodes, passWork), characters: cap.characters, work: passWork };
  const actors = compileCombatActors({ definitions, rules, mission }, { ...nested, types: cap.types, placements: cap.actors,
    houses: cap.houses, fields: cap.fields, rawFields: Math.min(cap.fields, 524288), history: cap.history, missionBytes: cap.missionBytes, serializedBytes: cap.serializedBytes });
  const view = createIniSourceView(rules, nested);
  if (hash(rules.layers) !== hash(bindings.rules) || actors.entityFingerprint !== definitions.fingerprint) fail('rules-identity');
  let work = 0, references = 0, history = 0, fields = 0;
  const charge = (n = 1) => { if (n > passWork - work) fail('source-work-limit'); work += n; };
  const reference = (n = 1) => { if (n > cap.references - references) fail('reference-limit'); references += n; charge(n); };
  const diagnostics: { code: string; subjectId: string }[] = [];
  const diagnostic = (code: string, subjectId: string) => { reference(); diagnostics.push({ code, subjectId }); };
  charge(actors.definitions.length + definitions.definitions.length + view.stages.length);
  const rawTypes = new Map(actors.definitions.map(t => [t.id, t])), encodings = new Map(view.stages.map(s => [s.layer.id, s.layer.encoding]));
  function field<T extends boolean | string>(typeId: string, key: string, fallback: T): EntityField<T> {
    let result = initial(fallback); const type = rawTypes.get(typeId) ?? fail('type-source');
    for (const origin of type.rawFields) {
      charge(); if (origin.keySpelling !== key) continue;
      if (++fields > cap.fields) fail('field-limit');
      const sections = findIniSourceSections(view, origin.layerId, origin.sectionSpelling);
      if (sections.length !== 1) fail('field-section');
      const entries = findIniSourceEntries(sections[0]!, key), entry = entries[0];
      if (entries.length !== 1 || !entry || hash(entry.origin) !== hash(origin)) fail('field-origin');
      if (result.history.length + 1 > cap.history - history) fail('history-limit'); history += result.history.length + 1;
      const origins: readonly IniOrigin[] = [...result.history, origin];
      if (!entry.value) { result = { ...result, history: origins }; continue; }
      const value = entry.value.length <= 127 && encodings.get(origin.layerId) === 'byte-preserving-ascii-compatible'
        ? (typeof fallback === 'boolean' ? weaponBoolean(entry.value) : entry.value) : null;
      result = { value: value as T | null, status: value === null ? 'unsupported' : 'explicit',
        rule: value === null ? 'unsupported-native-parser-input' : typeof fallback === 'boolean' ? 'native-read-current-default' : 'retained-pointer-selector-requires-allocation-proof', origin, history: origins };
    }
    return result;
  }
  const unitTypes = new Map(definitions.definitions.filter(t => t.kind === 'unit').map(t => [t.name, t]));
  const types: MissionHouseType[] = definitions.definitions.map(type => {
    charge(); const techno = ['unit', 'infantry', 'structure', 'aircraft'].includes(type.kind), yr = bindings.profile === 'yr';
    const f = { insignificant: techno ? field<boolean>(type.id, 'Insignificant', false) : initial<boolean>(false, 'not-a-techno'), dontScore: yr && techno ? field<boolean>(type.id, 'DontScore', false) : initial<boolean>(false, 'not-consumed-in-this-profile-family'),
      undeploysInto: techno ? field<string>(type.id, 'UndeploysInto', '') : initial<string>('', 'not-a-techno'),
      constructionYard: !yr && type.kind === 'structure' ? field<boolean>(type.id, 'ConstructionYard', false) : initial<boolean>(false, 'not-in-this-population-predicate'),
      resourceGatherer: yr && type.kind === 'unit' ? field<boolean>(type.id, 'ResourceGatherer', false) : initial<boolean>(false, 'not-in-this-population-predicate'),
      powered: yr && type.kind === 'structure' ? field<boolean>(type.id, 'Powered', false) : initial<boolean>(false, 'not-in-action36-second-pass'),
      poweredSpecial: yr && type.kind === 'structure' ? field<boolean>(type.id, 'PoweredSpecial', false) : initial<boolean>(false, 'not-in-action36-second-pass') };
    const family: HousePopulationClass = type.kind === 'structure' ? 'building' : techno ? type.kind as HousePopulationClass : 'none';
    const undeploy = known(f.undeploysInto), noUndeploy = undeploy === '' || /^(?:none|<none>)$/i.test(undeploy ?? 'invalid');
    // The allocator compares without case, but unseen earlier allocations can
    // alter load spelling. Only an exact retained type spelling supplies fields.
    const target = undeploy === null || noUndeploy ? undefined : unitTypes.get(undeploy);
    let registered: HousePopulationClass | null = family;
    if (techno) {
      if (known(f.insignificant) === true || known(f.dontScore) === true) registered = 'none';
      else if (known(f.insignificant) === null || known(f.dontScore) === null) registered = null;
      else if (type.kind === 'structure' && !noUndeploy) {
        if (!yr) registered = known(f.constructionYard) === true ? 'building' : !target || known(f.constructionYard) === null ? null : 'unit';
        else if (!target) registered = null;
        else {
          const foundation = known(type.foundation), gatherer = known(field<boolean>(target.id, 'ResourceGatherer', false));
          registered = foundation?.width === 1 && foundation.height === 1 || gatherer === true ? 'unit' :
            foundation === null || gatherer === null ? null : 'building';
        }
      }
    }
    // YR unit gain has no DontScore test, but loss does. That asymmetric type
    // cannot be represented by a current-participation ledger without residuals.
    const present: HousePopulationClass | null = !yr ? 'none' : type.kind === 'unit' ? known(f.dontScore) === false ? 'unit' : null :
      type.kind === 'infantry' || type.kind === 'structure' || type.kind === 'aircraft'
        ? known(f.dontScore) === null ? null : known(f.dontScore) ? 'none' : family : 'none';
    const phase = known(f.powered) === true || known(f.poweredSpecial) === true ? 1 :
      known(f.powered) === null || known(f.poweredSpecial) === null ? null : 0;
    const reasons: string[] = [];
    if (registered === null) reasons.push(type.kind === 'structure' && known(f.undeploysInto) !== '' ? 'deployable-building-population' : 'unknown-registered-contribution');
    if (present === null) reasons.push(type.kind === 'unit' && known(f.dontScore) === true ? 'asymmetric-unit-dontscore-counter' : 'unknown-present-contribution');
    if (phase === null) reasons.push('unknown-transfer-pass');
    return { typeId: type.id, kind: type.kind, fields: f, undeployTargetTypeId: target?.id ?? null,
      registeredClass: registered, presentClass: present, transferPhase: phase,
      status: registered === null || present === null ? 'unsupported' : 'supported-counts', reasons };
  });
  charge(houses.length + countries.length + world.players.length + bindings.triggers.length + bindings.tags.length + bindings.objects.length);
  const first = new Map<number, typeof houses[number]>();
  for (const house of houses) if (house.country.index !== null && !first.has(house.country.index)) first.set(house.country.index, house);
  const players = new Map(world.players.map(p => [p.houseId, p])), triggers = new Map(bindings.triggers.map(t => [t.id, t]));
  function selector(raw: string | undefined, triggerId: string, action: boolean): MissionHouseSelector {
    const none: MissionHouseSelector = { kind: 'unsupported', raw: raw ?? null, countryIndex: null, houseId: null, playerId: null };
    if (raw === undefined || !/^(?:0|[1-9][0-9]*)$/.test(raw)) return none;
    const index = Number(raw); if (!Number.isSafeInteger(index) || index > 0x7fffffff) return none;
    const special = action && bindings.profile === 'yr' && index === 8997;
    // YR multiplayer slot selectors 4475..4482 need Scenario player-slot state.
    if (action && bindings.profile === 'yr' && index >= 4475 && index <= 4482) return none;
    if (special) return { kind: 'current-trigger-house', raw, countryIndex: null, houseId: null, playerId: null };
    const countryIndex = index;
    const house = countryIndex === null ? undefined : first.get(countryIndex), player = house ? players.get(house.id) : undefined;
    if (!house || house.country.status === 'unsupported' || !player) return none;
    return { kind: 'first-country-house', raw, countryIndex, houseId: house.id, playerId: player.playerId };
  }
  const instructions: MissionHouseInstruction[] = [];
  for (const kind of ['event', 'action'] as const) for (const row of kind === 'event' ? logic.events : logic.actions) for (const [ordinal, instruction] of row.instructions.entries()) {
    charge(); const opcode = instruction.opcode;
    if (kind === 'event' ? ![9, 10, 11].includes(opcode ?? -1) : ![14, 36].includes(opcode ?? -1)) continue;
    if (instructions.length >= cap.instructions) fail('instruction-limit');
    const parameters = row.row.tokens.slice(instruction.tokenStart + 1, instruction.tokenStart + instruction.tokenCount), rawTokens = row.row.tokens.slice(instruction.tokenStart, instruction.tokenStart + instruction.tokenCount);
    reference(rawTokens.length); charge(rawTokens.reduce((n, s) => n + s.length, 0));
    const triggerId = `trigger:${row.id.slice(kind === 'event' ? 'event-row:'.length : 'action-row:'.length)}`, reasons: string[] = [];
    if (!triggers.has(triggerId)) reasons.push('missing-trigger');
    const framed = kind === 'event' ? parameters.length === 2 && parameters[0] === '0' : parameters.length === 7 && parameters[0] === '0';
    const selected = framed ? selector(parameters[1], triggerId, kind === 'action') : selector(undefined, triggerId, kind === 'action');
    if (!framed) reasons.push('unsupported-operands');
    if (selected.kind === 'unsupported') reasons.push('unsupported-house-selector');
    const value: MissionHouseInstruction = { instructionId: instruction.id, triggerId, rowId: row.id, ordinal,
      opcode: opcode as MissionHouseInstruction['opcode'], kind, parameters, rawTokens, selector: selected, status: reasons.length ? 'unsupported' : 'supported-source', reasons };
    instructions.push(value); for (const reason of reasons) diagnostic(reason, instruction.id);
  }
  for (const layer of [...logic.ini.layers, ...bindings.rules]) if (layer.encoding !== 'byte-preserving-ascii-compatible') diagnostic('native-byte-encoding', layer.id);
  for (const d of bindings.diagnostics) diagnostic(`bindings:${d.code}`, d.subjectId);
  const objectTags = new Map(bindings.objects.map(o => [o.entityId, o.tagId])), typeMap = new Map(types.map(t => [t.typeId, t]));
  const initialActors = world.model.entities.map(e => { reference(); return { entityId: e.id, typeId: e.typeId, owner: e.owner, tagId: objectTags.get(e.id) ?? null }; });
  const source = { policy: MISSION_HOUSE_SOURCE_POLICY, profile: definitions.profile, source: definitions.source,
    bindingsSha256: bindings.fingerprint, definitionsSha256: definitions.fingerprint, worldContentSha256: world.sha256, baseWorldSha256: world.model.sha256,
    houses: world.players.map(p => ({ playerId: p.playerId, houseId: p.houseId, countryIndex: houses.find(h => h.id === p.houseId)?.country.index ?? null })),
    initialActors, types, instructions, tagChains: bindings.tags.filter(t => t.allocated).map(t => { reference(t.runtimeChain.length); return { tagId: t.tagId, triggerIds: [...t.runtimeChain] }; }), diagnostics,
    allInstructionsSupported: instructions.every(i => i.status === 'supported-source') && diagnostics.length === 0,
    initialPopulationTypesSupported: initialActors.every(a => typeMap.get(a.typeId)?.status === 'supported-counts'), limits: cap,
    runtimeAuthority: false as const, nativeExecutionVerified: false as const, canStartCampaign: false as const };
  const result: MissionHouseSource = freeze({ ...source, sha256: hash(source) });
  contexts.set(result, Object.freeze({ bindings, definitions, rules })); return result;
}
