// SPDX-License-Identifier: GPL-3.0-or-later
// Original source initialization. See ../MISSION_WORLD_PROVENANCE.md.
import { sha256 } from '@noble/hashes/sha2.js';
import { compileRuntimeIni, type IniOrigin } from '../../content/src/runtime-ini.ts';
import { createIniSourceView } from '../../content/src/ini-source-view.ts';
import { isMissionBindingCatalog, type MissionBindingCatalog } from './mission-bindings.ts';
import { worldHash, worldInteger, worldRecord } from './world-values.ts';

export const MISSION_INITIAL_FLAGS_POLICY = 'webra2-fresh-campaign-flags-1' as const;
export const MISSION_INITIAL_FLAGS_LIMITS = Object.freeze({ bytes: 16 * 1024 ** 2, rows: 4096, work: 262144 });
type Limits = { -readonly [K in keyof typeof MISSION_INITIAL_FLAGS_LIMITS]: number };
export interface MissionInitialFlags {
  readonly policy: typeof MISSION_INITIAL_FLAGS_POLICY;
  readonly initialization: 'new-campaign'; readonly catalogSha256: string; readonly worldSha256: string;
  readonly missionSha256: string; readonly profile: 'ra2' | 'yr'; readonly sha256: string;
  readonly localCapacity: 50 | 100; readonly globals: readonly boolean[]; readonly locals: readonly boolean[];
  readonly declarations: readonly Readonly<{ index: number; name: string; explicitValue: boolean | null; origin: IniOrigin }>[];
  readonly diagnostics: readonly Readonly<{ code: string; line: number }>[];
  readonly canInitialize: boolean; readonly canStartCampaign: false; readonly nativeBehaviorVerified: false;
}
export class MissionInitialFlagsError extends Error {
  constructor(readonly code: string) { super(`mission-initial-flags-${code}`); this.name = 'MissionInitialFlagsError'; }
}
function fail(code: string): never { throw new MissionInitialFlagsError(code); }
function freeze<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) { for (const c of Object.values(v)) freeze(c); Object.freeze(v); } return v;
}
const flags = new WeakSet<object>();
export const isMissionInitialFlags = (v: unknown): v is MissionInitialFlags => !!v && typeof v === 'object' && flags.has(v);

/** New campaign policy only; a continuation must restore its complete compound checkpoint. */
export function compileMissionInitialFlags(input: {
  readonly bindings: MissionBindingCatalog; readonly bytes: Uint8Array; readonly initialization: 'new-campaign';
}, lowerLimits: Partial<Limits> = {}): MissionInitialFlags {
  const r = worldRecord(input, ['bindings', 'bytes', 'initialization']);
  if (!isMissionBindingCatalog(r.bindings) || r.initialization !== 'new-campaign') fail('authority');
  const bindings = r.bindings, cap: Limits = { ...MISSION_INITIAL_FLAGS_LIMITS };
  if (!lowerLimits || ![Object.prototype, null].includes(Object.getPrototypeOf(lowerLimits))) fail('limits');
  for (const key of Reflect.ownKeys(lowerLimits)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('limits');
    const d = Object.getOwnPropertyDescriptor(lowerLimits, key)!;
    if (!('value' in d) || !d.enumerable) fail('limits');
    cap[key as keyof typeof cap] = worldInteger(d.value, 0, cap[key as keyof typeof cap]);
  }
  const typed = Object.getPrototypeOf(Uint8Array.prototype);
  if (!r.bytes || Object.getPrototypeOf(r.bytes) !== Uint8Array.prototype) fail('bytes');
  const size = Object.getOwnPropertyDescriptor(typed, 'byteLength')!.get!.call(r.bytes) as number;
  const buffer = Object.getOwnPropertyDescriptor(typed, 'buffer')!.get!.call(r.bytes);
  if (!(buffer instanceof ArrayBuffer) || Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get?.call(buffer) || size < 1 || size > cap.bytes) fail('bytes');
  const bytes = new Uint8Array(size); Uint8Array.prototype.set.call(bytes, r.bytes as Uint8Array);
  const hash = Array.from(sha256(bytes), b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== bindings.source.sha256) fail('mission-hash');
  const ini = compileRuntimeIni(bindings.profile, [{ id: bindings.source.id, profile: bindings.profile, order: 0, kind: 'map', sourceSha256: hash, bytes }]);
  const stage = createIniSourceView(ini).stages[0]!, localCapacity = bindings.profile === 'ra2' ? 50 as const : 100 as const;
  const diagnostics: { code: string; line: number }[] = [], declarations: { index: number; name: string; explicitValue: boolean | null; origin: IniOrigin }[] = [];
  const diagnostic = (code: string, line = 0) => { if (diagnostics.length >= cap.rows + 16) fail('diagnostic-limit'); diagnostics.push({ code, line }); };
  let work = 0;
  const charge = (n = 1) => { if (n > cap.work - work) fail('work-limit'); work += n; };
  charge(stage.sections.length);
  const sections = stage.sections.filter(s => s.name.toLowerCase() === 'variablenames');
  if (stage.layer.encoding !== 'byte-preserving-ascii-compatible') diagnostic('native-byte-encoding');
  if (sections.length > 1) diagnostic('repeated-section');
  if (sections.some(s => s.name !== 'VariableNames')) diagnostic('native-section-case');
  const globals = Array<boolean>(50).fill(false), locals = Array<boolean>(100).fill(false), seen = new Set<number>();
  let rows = 0;
  for (const section of sections) for (const e of section.entries) {
    if (++rows > cap.rows) fail('row-limit'); charge();
    // Native caps enumeration count, but indexes each retained row using atoi(key).
    // Reject noncanonical/duplicate/out-of-range keys instead of reproducing memory writes.
    if (rows > localCapacity) { diagnostic('native-enumeration-cap', e.origin.line); continue; }
    const index = /^(?:0|[1-9][0-9]{0,2})$/.test(e.key) ? Number(e.key) : -1;
    if (index < 0 || index >= localCapacity || seen.has(index)) { diagnostic('native-variable-index', e.origin.line); continue; }
    seen.add(index);
    const raw = e.origin.rawValue.split(';', 1)[0]!.trim(); charge(raw.length);
    if (!raw.length || raw.length > 127 || /[\x00-\x1f\x7f\u0100-\uffff]/.test(raw)) { diagnostic('native-variable-row', e.origin.line); continue; }
    // Native strtok collapses empty comma fields. This bounded closure requires a
    // nonempty name and at most one explicit int32 value, with no ambiguous padding.
    const tokens = raw.split(',');
    if (tokens.length > 2 || tokens.some(t => !t.length || t !== t.trim()) || tokens[0]!.length > 39) { diagnostic('native-variable-framing', e.origin.line); continue; }
    let explicitValue: boolean | null = null;
    if (tokens.length === 2) {
      const token = tokens[1]!;
      const number = /^-?(?:0|[1-9][0-9]{0,9})$/.test(token) ? Number(token) : NaN;
      if (!Number.isSafeInteger(number) || Object.is(number, -0) || number < -0x80000000 || number > 0x7fffffff) { diagnostic('native-variable-value', e.origin.line); continue; }
      explicitValue = number !== 0; locals[index] = explicitValue;
    }
    declarations.push({ index, name: tokens[0]!, explicitValue, origin: e.origin });
  }
  // Input scanner diagnostics touching the consumed table cannot grant authority.
  for (const d of ini.diagnostics) {
    charge(stage.sections.length);
    const section = stage.sections.findLast(s => s.line <= d.line);
    if (section?.name.toLowerCase() === 'variablenames') diagnostic(`ini:${d.code}`, d.line);
  }
  const data = { policy: MISSION_INITIAL_FLAGS_POLICY, initialization: 'new-campaign' as const,
    catalogSha256: bindings.fingerprint, worldSha256: bindings.worldSha256, missionSha256: hash, profile: bindings.profile,
    localCapacity, globals, locals, declarations, diagnostics, canInitialize: diagnostics.length === 0,
    canStartCampaign: false as const, nativeBehaviorVerified: false as const };
  const result = freeze({ ...data, sha256: worldHash(data) }); flags.add(result); return result;
}
