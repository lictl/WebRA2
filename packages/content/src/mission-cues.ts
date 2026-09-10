// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original source binding; see ../MISSION_CUES_PROVENANCE.md.
import { compileScenarioLogic } from './scenario-logic.ts';
import { compileScenarioObjects } from './scenario-objects.ts';
import { scanIni } from './ini.ts';
import { decodeCsf } from './csf-decode.ts';
import { cueBytes, cueFail, cueFingerprint, cueFreeze, cueHash, cueInteger, cueRecord, cueText,
  MISSION_CUE_LIMITS, MISSION_CUE_POLICY, type MissionCueCatalog, type MissionCueInstruction,
  type MissionCueOpcode, type MissionCuePayload, type MissionCueSource } from './mission-cue-types.ts';
export type { MissionCueCatalog, MissionCueInstruction, MissionCuePayload } from './mission-cue-types.ts';
export { MISSION_CUE_LIMITS, MISSION_CUE_POLICY, MissionCueError } from './mission-cue-types.ts';
const brands = new WeakMap<object, ReadonlyMap<string, MissionCueInstruction>>();
const sourceParameters = new WeakMap<object, ReadonlyMap<string, readonly string[]>>();
export const isMissionCueCatalog = (v: unknown): v is MissionCueCatalog => !!v && typeof v === 'object' && brands.has(v);
export function missionCueInstruction(catalog: MissionCueCatalog, id: string): MissionCueInstruction | undefined {
  const index = brands.get(catalog); if (!index) cueFail('catalog-brand'); return index.get(cueText(id));
}
/** Exact owned source operands for an authenticated compiler join, never caller-replaced metadata. */
export function missionCueSourceParameters(catalog: MissionCueCatalog, id: string): readonly string[] | undefined {
  const rows = sourceParameters.get(catalog); if (!rows) cueFail('catalog-brand'); return rows.get(cueText(id));
}
const opcodes: readonly MissionCueOpcode[] = Object.freeze([10, 11, 19, 20, 21, 48, 55]);
const fold = (v: string) => v.replace(/[A-Z]/g, c => c.toLowerCase());
const trim = (v: string) => v.replace(/^[ \t]+|[ \t]+$/g, '');
function decimal(raw: string): number | null {
  const s = trim(raw); if (!/^[+-]?\d{1,10}$/.test(s)) return null;
  const n = Number(s); return Number.isInteger(n) && n >= -2147483648 && n <= 2147483647 ? n || 0 : null;
}
function waypoint(raw: string): number | null {
  // Native consumes the first two alphabetic bytes. Longer/whitespace forms are
  // rejected here instead of guessing their aliases or CRT locale classification.
  if (!/^[A-Za-z]{1,2}$/.test(raw)) return null;
  const s = raw.toUpperCase(); return s.length === 1 ? s.charCodeAt(0) - 65 : 26 * (s.charCodeAt(0) - 64) + s.charCodeAt(1) - 65;
}
export interface MissionCueInput {
  readonly profile: 'ra2' | 'yr';
  readonly mission: { readonly path: string; readonly source: MissionCueSource; readonly bytes: Uint8Array };
  /** Exactly one already selected profile CSF, or null. This does not choose archive/layer precedence. */
  readonly strings: { readonly path: 'ra2.csf' | 'ra2md.csf'; readonly sha256: string; readonly bytes: Uint8Array } | null;
}
/** Binds selected source bytes to cue references; does not authenticate trigger invocation or media playback. */
type Limits = { -readonly [K in keyof typeof MISSION_CUE_LIMITS]: number };
export function compileMissionCues(input: MissionCueInput, lower: Partial<Limits> = {}): MissionCueCatalog {
  const r = cueRecord(input, ['profile', 'mission', 'strings']);
  if (r.profile !== 'ra2' && r.profile !== 'yr') cueFail('profile'); const profile: 'ra2' | 'yr' = r.profile;
  const caps: Limits = { ...MISSION_CUE_LIMITS };
  if (!lower || typeof lower !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(lower))) cueFail('limits');
  for (const key of Reflect.ownKeys(lower)) {
    if (typeof key !== 'string' || !Object.hasOwn(caps, key)) cueFail('limits');
    const d = Object.getOwnPropertyDescriptor(lower, key)!; if (!('value' in d) || !d.enumerable) cueFail('limits');
    caps[key as keyof typeof caps] = cueInteger(d.value, caps[key as keyof typeof caps]);
  }
  const m = cueRecord(r.mission, ['path', 'source', 'bytes']), s = cueRecord(m.source, ['id', 'profile', 'sha256']);
  const path = cueText(m.path, 128);
  if (!/^[a-z0-9][a-z0-9_.-]*\.(map|mpr)$/.test(path) || path.includes('..')) cueFail('mission-path');
  if (s.profile !== profile || typeof s.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(s.sha256)) cueFail('source');
  const source: MissionCueSource = { id: cueText(s.id, 255), profile, sha256: s.sha256 };
  const sr = r.strings === null ? null : cueRecord(r.strings, ['path', 'sha256', 'bytes']);
  if (sr && (sr.path !== (profile === 'ra2' ? 'ra2.csf' : 'ra2md.csf') || typeof sr.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sr.sha256))) cueFail('strings-source');
  // All metadata and buffers are detached before calling any downstream parser.
  const bytes = cueBytes(m.bytes, Math.min(caps.memberBytes, caps.inputBytes));
  const stringBytes = sr ? cueBytes(sr.bytes, Math.min(caps.memberBytes, caps.inputBytes - bytes.length)) : null;
  if (cueHash(bytes) !== source.sha256 || (stringBytes && cueHash(stringBytes) !== sr!.sha256)) cueFail('source-hash');
  const doc = scanIni(bytes);
  if (doc.diagnostics.length || doc.encoding !== 'byte-preserving-ascii-compatible') cueFail('mission-encoding');
  for (const name of ['Basic', 'Map', 'Actions', 'Waypoints']) {
    const found = doc.sections.filter(s => fold(s.name) === fold(name));
    if (found.length > 1 || found.some(s => s.name !== name)) cueFail('source-section');
  }
  const logic = compileScenarioLogic({ profile, source, bytes });
  const objects = compileScenarioObjects({ profile, source, bytes });
  const csf = stringBytes ? decodeCsf(stringBytes) : null;
  const pins: {role:'mission'|'strings';path:string;sha256:string;size:number}[] = [{ role:'mission', path, sha256:source.sha256, size:bytes.length }];
  if (stringBytes) pins.push({ role:'strings', path:sr!.path as string, sha256:sr!.sha256 as string, size:stringBytes.length });
  const waypoints = new Map(objects.waypoints.map(w => [w.number, w]));
  const instructions: MissionCueInstruction[] = []; let textUnits = 0;
  const selectedCount = logic.actions.reduce((n, row) => n + row.instructions.filter(a => opcodes.includes(a.opcode as MissionCueOpcode)).length, 0);
  if (selectedCount > caps.instructions) cueFail('instruction-limit');
  for (const row of logic.actions) for (const a of row.instructions) {
    if (!opcodes.includes(a.opcode as MissionCueOpcode)) continue;
    const opcode = a.opcode as MissionCueOpcode, p = row.row.tokens.slice(a.tokenStart + 1, a.tokenStart + a.tokenCount);
    const reasons: string[] = [], pending: string[] = []; let payload: MissionCuePayload | null = null;
    const add = (v:string) => { if (!reasons.includes(v)) reasons.push(v); };
    const mode = decimal(p[0]!), expectedMode = opcode === 11 ? 4 : opcode === 19 ? 7 : opcode === 20 ? 8 : opcode === 21 ? 6 : 0;
    if (p.length !== 7 || mode !== expectedMode || p.some(v => !/^[\t\x20-\x7e]+$/.test(v))) add('operand-framing');
    if (p.slice(2,6).some(v => decimal(v) !== 0)) add('nonzero-reserved-operands');
    if (!reasons.length && opcode === 11) {
      if (decimal(p[1]!) === -1) payload = { kind:'empty-text' };
      else if (/^[ \t]*[+-]?\d/.test(p[1]!)) add('numeric-label-atoi-boundary');
      else {
        const label = p[1]!.replace(/^[ \t]+/,'').slice(0,31).replace(/[ \t]+$/,'');
        if (!label) payload = {kind:'empty-text'};
        else if (!csf) add('missing-strings');
        else {
          const resolution = csf.resolve(label);
          if (resolution.status !== 'resolved' || resolution.text === null) add(`strings-${resolution.status}`);
          else if (resolution.text.length > caps.textPerCue || resolution.text.length > caps.textUnits - textUnits) cueFail('text-limit');
          else { textUnits += resolution.text.length; payload = {kind:'text',label,text:resolution.text,languageId:csf.languageId,stringOrdinal:resolution.records[0]!.ordinal,stringsSha256:sr!.sha256 as string}; }
        }
      }
      pending.push('native-message-delay-color-layout');
    } else if (!reasons.length && (opcode === 48 || opcode === 55)) {
      const number = waypoint(p[6]!), value = decimal(p[1]!); const wp = number === null ? undefined : waypoints.get(number);
      if (number === null || number > (profile === 'ra2' ? 100 : 701)) add('waypoint-not-native-loaded');
      else if (!wp || wp.packedCoordinate === 0 || !wp.insideDiamond || wp.row.key !== String(number) || wp.row.origin.sectionSpelling !== 'Waypoints') add('waypoint-source');
      if (value === null || value < 0 || (opcode === 55 && value > 16)) add('unsupported-control-operand');
      if (!reasons.length) payload = opcode === 48 ? {kind:'camera-waypoint',waypoint:number!,x:wp!.x,y:wp!.y,nativeArgument:value!} : {kind:'radar-waypoint',waypoint:number!,x:wp!.x,y:wp!.y,nativeType:value!};
      pending.push(...(opcode===48?['native-camera-map-bridge-height','native-camera-speed-viewport']:['native-radar-type-state-coalescing','native-radar-style-duration']));
    } else if (!reasons.length) {
      if (opcode === 10 && decimal(p[1]!) === null) add('movie-index-operand');
      add(opcode===10?'movie-index-resource-table-unresolved':opcode===19?'sound-definition-sample-closure-unresolved':opcode===20?'theme-definition-resource-closure-unresolved':'speech-definition-side-resource-closure-unresolved');
    }
    instructions.push({ id:a.id, triggerId:`trigger:${row.row.entry.key}`, ordinal:a.ordinal, opcode,
      status:payload?'resolved-reference':'unsupported',payload,operand:{mode:p[0]!,value:p[1]!,waypoint:p[6]!},reasons,pendingPresentation:pending });
  }
  const data = {policy:MISSION_CUE_POLICY,profile: profile as 'ra2' | 'yr',source,pins,instructions,
    coverage:opcodes.map(opcode=>({opcode,occurrences:instructions.filter(a=>a.opcode===opcode).length,resolvedReferences:instructions.filter(a=>a.opcode===opcode&&a.status==='resolved-reference').length})),
    nativeExecutionVerified:false as const,canStartCampaign:false as const,playbackReady:false as const};
  const catalog = cueFreeze({...data,sha256:cueFingerprint({...data,source:{profile,sha256:source.sha256}},caps.serializedBytes)}); brands.set(catalog,new Map(instructions.map(a=>[a.id,a])));
  sourceParameters.set(catalog,new Map(logic.actions.flatMap(row=>row.instructions.filter(a=>opcodes.includes(a.opcode as MissionCueOpcode)).map(a=>[a.id,Object.freeze([...a.parameters])] as const)))); return catalog;
}
