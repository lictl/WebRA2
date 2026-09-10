// SPDX-License-Identifier: GPL-3.0-or-later
// Original bounded source composition. See ../MISSION_TEAM_ACTION_PROVENANCE.md.
import type { ScenarioLogic, LogicDefinition } from '../../content/src/scenario-logic.ts';
import { isTeamActivationSource, teamActivationDefinitions, type TeamActivationSource, type TeamActivationPlan } from '../../content/src/team-activation.ts';
import type { TeamDefinitions, TeamDefinition, TaskForceDefinition, TeamScriptDefinition } from '../../content/src/team-definitions.ts';
import { isMissionBindingCatalog, missionBindingSourceContext, type MissionBindingCatalog } from './mission-bindings.ts';
import { isTeamProgram, teamProgramWorld, teamRuntimeFreeze as freeze, type TeamProgram } from './team-runtime-program.ts';
import { isTeamSpawnCatalog, teamSpawnCatalogData, type TeamSpawnCatalog } from './team-spawn-context.ts';
import { isTeamRecruitmentCatalog, teamRecruitmentCatalogData, type TeamRecruitmentCatalog } from './team-recruitment-catalog.ts';
import type { WorldContent } from './world-content.ts';
import { teamFingerprint } from '../../content/src/team-values.ts';
import { worldList, worldRecord } from './world-values.ts';

export const MISSION_TEAM_ACTION_POLICY = 'webra2-mission-team-action-source-1' as const;
export const MISSION_TEAM_ACTION_LIMITS = Object.freeze({ programs: 256, catalogs: 512, actions: 8192,
  declarations: 32768, scriptRows: 131072, diagnostics: 131072, work: 4_194_304,
  nodes: 2_000_000, characters: 32 * 1024 ** 2, serializedBytes: 32 * 1024 ** 2 });
export type MissionTeamActionLimits = { -readonly [K in keyof typeof MISSION_TEAM_ACTION_LIMITS]: number };
export interface MissionTeamActionInput {
  readonly bindings: MissionBindingCatalog; readonly activation: TeamActivationSource;
  readonly programs: readonly TeamProgram[]; readonly spawnCatalogs: readonly TeamSpawnCatalog[];
  readonly recruitmentCatalogs: readonly TeamRecruitmentCatalog[];
}
export interface MissionTeamActionCandidate {
  readonly family: 'spawn' | 'recruitment'; readonly programSha256: string; readonly catalogSha256: string;
}
export interface MissionTeamAction {
  readonly instructionId: string; readonly triggerId: string; readonly rowId: string; readonly ordinal: number;
  readonly opcode: 4 | 7 | 80; readonly parameters: readonly string[]; readonly rawTokens: readonly string[];
  readonly plan: TeamActivationPlan; readonly teamId: string | null; readonly branch: TeamActivationPlan['branch'];
  readonly candidates: readonly MissionTeamActionCandidate[];
  readonly programSha256: string | null; readonly catalogSha256: string | null;
  readonly status: 'supported-source' | 'unsupported'; readonly reasons: readonly string[];
}
export interface MissionTeamActionDeclaration<T> {
  readonly id: string;
  /** Exact mission declaration, including every raw field and unreachable script row. */
  readonly mission: LogicDefinition | null;
  /** Complete effective typed source and load history; global declarations are retained too. */
  readonly definition: T | null;
  readonly programSha256s: readonly string[];
  readonly status: 'supported-source' | 'unsupported'; readonly reasons: readonly string[];
}
export interface MissionTeamActionDiagnostic {
  readonly namespace: 'bindings' | 'logic' | 'definitions' | 'action' | 'team' | 'script' | 'taskforce' | 'orphan';
  readonly subjectId: string; readonly code: string;
}
export interface MissionTeamActionDiagnosticResolution {
  readonly namespace: 'definitions'; readonly sourceIndex: number; readonly subjectId: string; readonly code: string;
  readonly status: 'resolved' | 'required'; readonly rule: 'complete-program-script' | 'literal-complete-declarations' | null;
  readonly programSha256s: readonly string[];
}
export interface MissionTeamActionSource {
  readonly policy: typeof MISSION_TEAM_ACTION_POLICY; readonly profile: ScenarioLogic['profile'];
  readonly source: ScenarioLogic['source']; readonly bindingsSha256: string; readonly activationSha256: string;
  readonly worldContentSha256: string; readonly baseWorldSha256: string; readonly teamsSha256: string;
  readonly entitiesSha256: string; readonly initialWaypointsSha256: string;
  readonly programSha256s: readonly string[]; readonly spawnCatalogSha256s: readonly string[];
  readonly recruitmentCatalogSha256s: readonly string[]; readonly actions: readonly MissionTeamAction[];
  readonly declarations: Readonly<{
    teams: readonly MissionTeamActionDeclaration<TeamDefinition>[];
    scripts: readonly MissionTeamActionDeclaration<TeamScriptDefinition>[];
    taskForces: readonly MissionTeamActionDeclaration<TaskForceDefinition>[];
  }>;
  readonly sourceDiagnostics: Readonly<{ bindings: MissionBindingCatalog['diagnostics']; logic: ScenarioLogic['diagnostics']; definitions: TeamDefinitions['diagnostics'] }>;
  readonly diagnosticResolutions: readonly MissionTeamActionDiagnosticResolution[];
  readonly orphanSections: ScenarioLogic['orphanSections']; readonly diagnostics: readonly MissionTeamActionDiagnostic[];
  readonly allActionsSupported: boolean; readonly declarationsComplete: boolean; readonly wholeSourceReady: boolean;
  readonly nativeAllocationComplete: false; readonly runtimeAuthority: false; readonly nativeExecutionVerified: false; readonly canStartCampaign: false;
  readonly sha256: string;
}
export interface MissionTeamActionSourceContext extends MissionTeamActionInput {
  readonly world: WorldContent; readonly logic: ScenarioLogic; readonly definitions: TeamDefinitions;
}
export class MissionTeamActionError extends Error {
  constructor(readonly code: string) { super(`mission-team-action-${code}`); this.name = 'MissionTeamActionError'; }
}
function fail(code: string): never { throw new MissionTeamActionError(code); }
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const contexts = new WeakMap<object, MissionTeamActionSourceContext>();
export const isMissionTeamActionSource = (v: unknown): v is MissionTeamActionSource => !!v && typeof v === 'object' && contexts.has(v);
/** Same-realm source capability. JSON copies and caller effect records cannot obtain these factories. */
export function missionTeamActionSourceContext(source: MissionTeamActionSource): MissionTeamActionSourceContext {
  return contexts.get(source) ?? fail('source-brand');
}
function limits(v: Partial<MissionTeamActionLimits>): MissionTeamActionLimits {
  if (!v || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) fail('limits');
  const cap: MissionTeamActionLimits = { ...MISSION_TEAM_ACTION_LIMITS };
  for (const key of Reflect.ownKeys(v)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('limits');
    const d = Object.getOwnPropertyDescriptor(v, key)!;
    if (!('value' in d) || !d.enumerable || !Number.isSafeInteger(d.value) || Object.is(d.value, -0) || d.value < 0 || d.value > cap[key as keyof MissionTeamActionLimits]) fail('limits');
    cap[key as keyof MissionTeamActionLimits] = d.value;
  }
  return cap;
}

/** Authenticates complete source references, not trigger execution or dynamic actor capabilities. */
export function compileMissionTeamActionSource(input: MissionTeamActionInput, lowerLimits: Partial<MissionTeamActionLimits> = {}): MissionTeamActionSource {
  const r = worldRecord(input, ['bindings', 'activation', 'programs', 'spawnCatalogs', 'recruitmentCatalogs']), cap = limits(lowerLimits);
  if (!isMissionBindingCatalog(r.bindings) || !isTeamActivationSource(r.activation)) fail('factory');
  const bindings = r.bindings, activation = r.activation, { world, logic } = missionBindingSourceContext(bindings);
  const definitions = teamActivationDefinitions(activation);
  let work = 0, nodes = 0, characters = 0, scriptRows = 0;
  const charge = (n = 1) => { if (n > cap.work - work) fail('work-limit'); work += n; };
  // Arrays are descriptor snapshots before sorting or source inspection. No Proxy property reads.
  const programs = worldList(r.programs, cap.programs).map(p => isTeamProgram(p) ? p : fail('program-brand'));
  const spawnCatalogs = worldList(r.spawnCatalogs, cap.catalogs).map(c => isTeamSpawnCatalog(c) ? c : fail('spawn-brand'));
  const recruitmentCatalogs = worldList(r.recruitmentCatalogs, cap.catalogs - spawnCatalogs.length).map(c => isTeamRecruitmentCatalog(c) ? c : fail('recruitment-brand'));
  function unique<T extends { readonly sha256: string }>(items: T[]): T[] {
    charge(items.length); items.sort((a, b) => compare(a.sha256, b.sha256));
    for (let i = 1; i < items.length; i++) if (items[i - 1]!.sha256 === items[i]!.sha256) fail('duplicate-catalog-or-program');
    return items;
  }
  unique(programs); unique(spawnCatalogs); unique(recruitmentCatalogs);
  const hash = (v: unknown) => teamFingerprint(v, cap.serializedBytes);
  if (bindings.profile !== activation.profile || bindings.source.id !== activation.source.id || bindings.source.sha256 !== activation.source.sha256 ||
    bindings.source.profile !== activation.source.profile || bindings.definitionsSha256 !== activation.entitiesSha256 ||
    bindings.worldContentSha256 !== world.sha256 || bindings.worldSha256 !== world.model.sha256 ||
    definitions.fingerprint !== activation.teamsSha256 || definitions.entityFingerprint !== bindings.definitionsSha256 ||
    hash(bindings.rules) !== hash(activation.rulesSources)) fail('source-identity');
  // These are already frozen factory graphs. Bound traversal before making maps/output; do not inspect the large world grids again.
  function audit(value: unknown, depth = 0): void {
    charge(); if (++nodes > cap.nodes || depth > 64) fail('node-limit');
    if (typeof value === 'string') { if (value.length > cap.characters - characters) fail('character-limit'); characters += value.length; }
    else if (value && typeof value === 'object') {
      const keys = Object.keys(value); charge(keys.length);
      for (const key of keys) audit((value as Record<string, unknown>)[key], depth + 1);
    }
  }
  audit({ definitions, activation, programs, spawnCatalogs, recruitmentCatalogs });
  const programMap = new Map(programs.map(p => [p.sha256, p]));
  const represented = new Map<string, string[]>(), templateHashes = new Map<string, string>();
  for (const p of programs) {
    charge(); const pw = teamProgramWorld(p);
    if (p.profile !== bindings.profile || p.teamsSha256 !== definitions.fingerprint || p.entitiesSha256 !== bindings.definitionsSha256 ||
      p.missionSha256 !== bindings.source.sha256 || p.initialWaypointsSha256 !== activation.initialWaypointsSha256 ||
      p.worldSha256 !== world.sha256 || p.modelSha256 !== world.model.sha256 || pw.sha256 !== world.sha256 || pw.model.sha256 !== world.model.sha256) fail('program-identity');
    for (const t of p.templates) {
      charge(); const signature = hash(t), prior = templateHashes.get(t.id);
      if (prior && prior !== signature) fail('conflicting-template'); templateHashes.set(t.id, signature);
      for (const id of [t.id, t.scriptId, t.taskForceId]) { const refs = represented.get(id) ?? []; refs.push(p.sha256); represented.set(id, refs); }
    }
  }
  const plans = new Map(activation.plans.map(p => [p.id, p])), candidates = new Map<string, MissionTeamActionCandidate[]>();
  if (plans.size !== activation.plans.length || plans.size > cap.actions) fail('action-limit');
  const catalogReasons = new Map<string, readonly string[]>();
  function addCatalog(c: TeamSpawnCatalog | TeamRecruitmentCatalog, family: 'spawn' | 'recruitment'): void {
    const context = family === 'spawn' ? teamSpawnCatalogData(c as TeamSpawnCatalog) : teamRecruitmentCatalogData(c as TeamRecruitmentCatalog);
    const p = programMap.get(c.programSha256);
    if (!p || context.program.sha256 !== p.sha256 || context.world.sha256 !== world.sha256 || context.world.model.sha256 !== world.model.sha256 ||
      c.activationSha256 !== activation.sha256) fail('catalog-identity');
    if (family === 'spawn') {
      const s = c as TeamSpawnCatalog;
      if (s.baseWorldSha256 !== world.sha256 || s.baseModelSha256 !== world.model.sha256 || s.entitiesSha256 !== bindings.definitionsSha256 || s.traversalSha256 !== world.traversalSha256) fail('catalog-identity');
    } else {
      const s = c as TeamRecruitmentCatalog;
      if (s.worldSha256 !== world.sha256 || s.modelSha256 !== world.model.sha256 || s.missionSha256 !== bindings.source.sha256 ||
        s.initialWaypointsSha256 !== activation.initialWaypointsSha256 || hash(s.rulesSources) !== hash(bindings.rules)) fail('catalog-identity');
    }
    for (const a of c.actions) {
      charge(); const expected = plans.get(a.id);
      if (!expected || hash(a) !== hash(expected) || (family === 'recruitment') !== (a.opcode === 4)) fail('catalog-action');
      const refs = candidates.get(a.id) ?? []; refs.push({ family, programSha256: p.sha256, catalogSha256: c.sha256 }); candidates.set(a.id, refs);
      if (family === 'recruitment') {
        const t = (c as TeamRecruitmentCatalog).templates.find(t => t.teamId === a.teamId); charge(c.templates.length);
        if (!t) fail('catalog-template'); if (t.status !== 'supported-source') catalogReasons.set(`${c.sha256}:${a.id}`, t.reasons);
      }
    }
  }
  for (const c of spawnCatalogs) addCatalog(c, 'spawn');
  for (const c of recruitmentCatalogs) addCatalog(c, 'recruitment');
  const diagnostics: MissionTeamActionDiagnostic[] = [];
  function diagnostic(namespace: MissionTeamActionDiagnostic['namespace'], subjectId: string, code: string): void {
    charge(); if (diagnostics.length >= cap.diagnostics) fail('diagnostic-limit'); diagnostics.push({ namespace, subjectId, code });
  }
  for (const d of bindings.diagnostics) diagnostic('bindings', d.subjectId, d.code);
  for (const d of logic.diagnostics) diagnostic('logic', d.rowId, d.code);
  if (!bindings.identityComplete && !bindings.diagnostics.length) diagnostic('bindings', '', 'identity-incomplete');
  let declarationCount = 0;
  function declarations<T extends TeamDefinition | TaskForceDefinition | TeamScriptDefinition>(namespace: 'team' | 'script' | 'taskforce', typed: readonly T[], mission: readonly LogicDefinition[]): MissionTeamActionDeclaration<T>[] {
    charge(typed.length + mission.length);
    const effective = new Map(typed.map(t => [t.id, t])), local = new Map(mission.map(t => [t.id, t]));
    const ids = [...new Set([...effective.keys(), ...local.keys()])].sort(compare);
    if (ids.length > cap.declarations - declarationCount) fail('declaration-limit'); declarationCount += ids.length;
    return ids.map(id => {
      charge(); const definition = effective.get(id) ?? null, original = local.get(id) ?? null;
      const refs = [...new Set(represented.get(id) ?? [])].sort(compare), reasons = new Set<string>();
      if (!refs.length) reasons.add('unrepresented-declaration');
      if (!definition) reasons.add('missing-typed-definition');
      if (original && !original.definitionPresent) reasons.add('missing-mission-definition');
      if (definition) {
        for (const field of definition.unhandledFields) { charge(); reasons.add(`unhandled-field:${field.keySpelling}`); }
        for (const [key, field] of Object.entries(definition.fields)) { charge(); if (field.status === 'unsupported') reasons.add(`unsupported-field:${key}`); }
        if (definition.kind === 'team') {
          if (!definition.typed) reasons.add('unsupported-team-source');
          for (const key of ['autocreate', 'prebuild', 'recruiter']) {
            const f = definition.fields[key];
            if (!f || f.status === 'unsupported' || f.status === 'not-applicable' || f.value !== false) reasons.add(`automatic-team-behavior:${key}`);
          }
        } else if (definition.kind === 'taskforce') {
          if (!definition.typed) reasons.add('unsupported-taskforce-source');
        } else {
          // Do not stop after Sleep or a jump. Genuine programs certify every effective row.
          if (!definition.numericFramingComplete) reasons.add('script-numeric-framing');
          for (const load of definition.stepLoads) {
            charge(load.steps.length); if (load.steps.length > cap.scriptRows - scriptRows) fail('script-row-limit'); scriptRows += load.steps.length;
          }
          if (!refs.length) for (const s of definition.steps) { charge(); reasons.add(`unrepresented-script-row:${s.sourceSlot}`); }
        }
      }
      const codes = [...reasons].sort(compare); for (const code of codes) diagnostic(namespace, id, code);
      return { id, mission: original, definition, programSha256s: refs, status: codes.length ? 'unsupported' : 'supported-source', reasons: codes };
    });
  }
  const declarationRows = { teams: declarations('team', definitions.teams, logic.teams),
    scripts: declarations('script', definitions.scripts, logic.scripts), taskForces: declarations('taskforce', definitions.taskForces, logic.taskForces) };
  for (const s of logic.orphanSections) diagnostic('orphan', s.section, 'unrepresented-orphan-section');
  const triggers = new Set(logic.triggers.map(t => t.id)), actions: MissionTeamAction[] = [], consumed = new Set<string>();
  for (const row of logic.actions) for (const a of row.instructions) {
    charge(); if (a.opcode !== 4 && a.opcode !== 7 && a.opcode !== 80) continue;
    if (actions.length >= cap.actions) fail('action-limit');
    const plan = plans.get(a.id), rawTokens = row.row.tokens.slice(a.tokenStart, a.tokenStart + a.tokenCount);
    if (!plan || consumed.has(a.id) || plan.rowId !== row.row.id || plan.ordinal !== a.ordinal || plan.opcode !== a.opcode ||
      a.parameters.length !== 7 || hash(rawTokens) !== hash(plan.rawTokens) || plan.origin.sourceSha256 !== bindings.source.sha256 ||
      plan.origin.line !== row.row.entry.selected.line || plan.origin.rawValue !== row.row.entry.selected.rawValue ||
      plan.origin.keySpelling !== row.row.entry.selected.keySpelling || plan.origin.sectionSpelling !== row.row.entry.selected.sectionSpelling) fail('action-identity');
    consumed.add(a.id);
    const refs = (candidates.get(a.id) ?? []).sort((a, b) => compare(a.catalogSha256, b.catalogSha256));
    const reasons = new Set(plan.reasons), triggerId = `trigger:${row.id.slice(row.id.indexOf(':') + 1)}`;
    if (!triggers.has(triggerId)) reasons.add('missing-trigger');
    if (!refs.length) reasons.add('missing-family-catalog');
    if (refs.length > 1) reasons.add('ambiguous-family-catalog');
    if (refs.length === 1) {
      const ref = refs[0]!;
      // Only the independently authenticated CreateTeam catalog closes this one historical placeholder.
      if (a.opcode === 4 && ref.family === 'recruitment') reasons.delete('native-recruitment-unimplemented');
      for (const code of catalogReasons.get(`${ref.catalogSha256}:${a.id}`) ?? []) reasons.add(`catalog:${code}`);
    }
    const codes = [...reasons].sort(compare); for (const code of codes) diagnostic('action', a.id, code);
    actions.push({ instructionId: a.id, triggerId, rowId: row.row.id, ordinal: a.ordinal, opcode: a.opcode,
      parameters: a.parameters, rawTokens, plan, teamId: plan.teamId, branch: plan.branch, candidates: refs,
      programSha256: refs.length === 1 ? refs[0]!.programSha256 : null, catalogSha256: refs.length === 1 ? refs[0]!.catalogSha256 : null,
      status: codes.length ? 'unsupported' : 'supported-source', reasons: codes });
  }
  if (consumed.size !== plans.size) fail('activation-coverage');
  const declarationsComplete = Object.values(declarationRows).every(rows => rows.every(d => d.status === 'supported-source')) && !logic.orphanSections.length;
  const allActionsSupported = actions.every(a => a.status === 'supported-source');
  const representedScripts = new Map(declarationRows.scripts.map(d => [d.id, d]));
  const currentScriptOrigins = new Map<string, Set<string>>();
  for (const d of declarationRows.scripts) if (d.programSha256s.length && d.definition) {
    const origins = new Set<string>();
    for (const s of d.definition.steps) { charge(); origins.add(hash(s.origin)); }
    currentScriptOrigins.set(d.id, origins);
  }
  const literalClosure = declarationsComplete && allActionsSupported && definitions.lateCountryAllocations.length === 0 &&
    actions.every(a => a.plan.teamOperand.lookup === 'literal' && a.teamId !== null) &&
    definitions.teams.every(t => t.script.status === 'resolved' && t.taskForce.status === 'resolved' && t.tag.status === 'none');
  const diagnosticResolutions: MissionTeamActionDiagnosticResolution[] = definitions.diagnostics.map((d, sourceIndex) => {
    charge(); let rule: MissionTeamActionDiagnosticResolution['rule'] = null, refs: readonly string[] = [];
    const script = representedScripts.get(d.subjectId);
    if (d.code === 'unsupported-script-operand' && script?.definition?.numericFramingComplete && script.programSha256s.length &&
      d.origin && currentScriptOrigins.get(d.subjectId)?.has(hash(d.origin))) {
      rule = 'complete-program-script'; refs = script.programSha256s;
    } else if (d.code === 'external-allocation-paths-unmodeled' && d.subjectId === 'program' && literalClosure) {
      rule = 'literal-complete-declarations'; refs = programs.map(p => p.sha256);
    }
    if (!rule) diagnostic('definitions', d.subjectId, d.code);
    return { namespace: 'definitions', sourceIndex, subjectId: d.subjectId, code: d.code,
      status: rule ? 'resolved' : 'required', rule, programSha256s: refs };
  });
  const data = { policy: MISSION_TEAM_ACTION_POLICY, profile: bindings.profile, source: bindings.source,
    bindingsSha256: bindings.fingerprint, activationSha256: activation.sha256, worldContentSha256: world.sha256, baseWorldSha256: world.model.sha256,
    teamsSha256: definitions.fingerprint, entitiesSha256: bindings.definitionsSha256, initialWaypointsSha256: activation.initialWaypointsSha256,
    programSha256s: programs.map(p => p.sha256), spawnCatalogSha256s: spawnCatalogs.map(c => c.sha256), recruitmentCatalogSha256s: recruitmentCatalogs.map(c => c.sha256),
    actions, declarations: declarationRows, sourceDiagnostics: { bindings: bindings.diagnostics, logic: logic.diagnostics, definitions: definitions.diagnostics },
    diagnosticResolutions, orphanSections: logic.orphanSections, diagnostics, allActionsSupported, declarationsComplete,
    wholeSourceReady: allActionsSupported && declarationsComplete && !diagnostics.length,
    nativeAllocationComplete: false as const, runtimeAuthority: false as const, nativeExecutionVerified: false as const, canStartCampaign: false as const };
  audit(data);
  const result = freeze({ ...data, sha256: hash(data) });
  contexts.set(result, freeze({ bindings, activation, programs, spawnCatalogs, recruitmentCatalogs, world, logic, definitions }));
  return result;
}
