// SPDX-License-Identifier: MIT
/** WebRA2 wire contracts v1; these are not claims about original engine internals. */
export type ProfileId = 'ra2' | 'yr';
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface ContentIdentity {
  readonly profile: ProfileId;
  readonly manifestSha256: string;
  readonly rulesSha256: string;
  readonly orderedModHashes: readonly string[];
}

export interface CommandEnvelope {
  readonly schemaVersion: 1;
  readonly tick: number;
  readonly playerId: number;
  readonly sequence: number;
  readonly kind: string;
  readonly payload: JsonValue;
}

/** At a tick boundary: tick nextTick has not yet begun. State must include all authoritative data. */
export interface SaveEnvelope<State extends JsonValue = JsonValue> {
  readonly schemaVersion: 1;
  readonly engineVersion: string;
  readonly simulationRulesVersion: string;
  readonly contentIdentity: ContentIdentity;
  readonly nextTick: number;
  readonly state: State;
  readonly queuedCommands: readonly CommandEnvelope[];
  readonly scheduledWork: readonly JsonValue[];
  readonly rngStates: Readonly<Record<string, JsonValue>>;
}

export interface ReplayEnvelope {
  readonly schemaVersion: 1;
  readonly engineVersion: string;
  readonly simulationRulesVersion: string;
  readonly contentIdentity: ContentIdentity;
  readonly initialCheckpoint: SaveEnvelope;
  readonly commands: readonly CommandEnvelope[];
  readonly checkpoints: readonly { readonly nextTick: number; readonly stateSha256: string }[];
}

/** Compact trace/UI summary; the richer research interchange schema lives in docs/specs. */
export interface EvidenceSummary {
  readonly id: string;
  readonly sourceKind: 'static-bytes' | 'licensed-source' | 'original-observation' | 'synthetic-test' | 'proposal';
  readonly locator: string;
  readonly sourceSha256?: string;
  readonly sourceRevision?: string;
  readonly observedFact: string;
  readonly interpretation: string;
  readonly confidence: 'low' | 'medium' | 'high';
  readonly runtimeStatus: 'unknown' | 'specified' | 'implemented' | 'verified';
  readonly verificationReferences: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

/** Reject values JSON would silently lose/change, cycles, accessors, and excessive structure. */
export function assertJsonValue(value: unknown): asserts value is JsonValue {
  const active = new Set<object>();
  let remaining = 100_000;
  function visit(item: unknown, depth: number): void {
    if (--remaining < 0 || depth > 64) throw new TypeError('JSON structure exceeds contract limits');
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return;
    if (typeof item === 'number' && Number.isFinite(item) && !Object.is(item, -0)) return;
    if (!Array.isArray(item) && !isRecord(item)) throw new TypeError('Expected a plain finite JSON value');
    if (Array.isArray(item) && Object.getPrototypeOf(item) !== Array.prototype) {
      throw new TypeError('Expected a plain JSON array');
    }
    if (active.has(item)) throw new TypeError('Cyclic JSON value');
    active.add(item);
    const descriptors = Object.getOwnPropertyDescriptors(item);
    if (Reflect.ownKeys(item).some(key => typeof key !== 'string')) throw new TypeError('Symbol keys are not JSON');
    if (Array.isArray(item)) {
      if (item.length > remaining) throw new TypeError('JSON array exceeds contract limits');
      if (Object.keys(descriptors).some(key => key !== 'length' &&
        (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= item.length))) {
        throw new TypeError('Non-index array properties are not JSON');
      }
      for (let index = 0; index < item.length; index++) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw new TypeError('Sparse/accessor arrays are not JSON');
        visit(descriptor.value, depth + 1);
      }
    } else {
      for (const descriptor of Object.values(descriptors)) {
        if (!('value' in descriptor) || !descriptor.enumerable) throw new TypeError('Hidden/accessor properties are not JSON');
        visit(descriptor.value, depth + 1);
      }
    }
    active.delete(item);
  }
  visit(value, 0);
}

export function assertCommand(value: unknown): asserts value is CommandEnvelope {
  assertJsonValue(value);
  if (!isRecord(value) || value.schemaVersion !== 1) throw new TypeError('Unsupported command schema');
  const keys = ['schemaVersion', 'tick', 'playerId', 'sequence', 'kind', 'payload'];
  if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) {
    throw new TypeError('Command fields must match schema v1');
  }
  for (const key of ['tick', 'playerId', 'sequence']) {
    if (!Number.isSafeInteger(value[key]) || (value[key] as number) < 0) throw new TypeError(`Invalid ${key}`);
  }
  if (typeof value.kind !== 'string' || !/^[a-z][a-z0-9.-]{0,63}$/.test(value.kind)) throw new TypeError('Invalid command kind');
}

/** Proposed WebRA2 total order. No original-engine tick/phase ordering is asserted. */
export function orderCommands(values: readonly unknown[]): CommandEnvelope[] {
  const commands = values.map(value => { assertCommand(value); return value; });
  const identities = new Set<string>();
  for (const command of commands) {
    const identity = `${command.playerId}:${command.sequence}`;
    if (identities.has(identity)) throw new TypeError('Duplicate command identity');
    identities.add(identity);
  }
  commands.sort((a, b) => a.tick - b.tick || a.playerId - b.playerId || a.sequence - b.sequence);
  return commands;
}
