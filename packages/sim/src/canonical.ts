// SPDX-License-Identifier: MIT
import { assertJsonValue } from '../../contracts/src/index.ts';
import { LIMITS, SimulationError, type Digest, type JsonValue } from './types.ts';

function unicode(value: string): void {
  for (let i = 0; i < value.length; i++) {
    const n = value.charCodeAt(i);
    if (n >= 0xd800 && n <= 0xdbff) { const next = value.charCodeAt(++i); if (!(next >= 0xdc00 && next <= 0xdfff)) throw new SimulationError('invalid-unicode'); }
    else if (n >= 0xdc00 && n <= 0xdfff) throw new SimulationError('invalid-unicode');
  }
}
/** Version 1 canonical integer JSON: UTF-16 key order, exact array order, no Unicode normalization. Not a general JCS implementation. */
export function canonicalText(value: unknown): string {
  try { assertJsonValue(value); } catch { throw new SimulationError('invalid-json-value'); }
  let nodes = 0, characters = 0;
  function visit(item: JsonValue, depth: number): string {
    if (++nodes > LIMITS.jsonNodes || depth > LIMITS.jsonDepth) throw new SimulationError('json-structure-limit');
    if (typeof item === 'string') { characters += item.length; if (characters > LIMITS.jsonBytes) throw new SimulationError('json-byte-limit'); unicode(item); return JSON.stringify(item); }
    if (typeof item === 'number') { if (!Number.isSafeInteger(item)) throw new SimulationError('json-integer-required'); return String(item); }
    if (item === null || typeof item === 'boolean') return String(item);
    if (Array.isArray(item)) return '[' + item.map(v => visit(v, depth + 1)).join(',') + ']';
    return '{' + Object.keys(item).sort().map(key => { unicode(key); characters += key.length; if (characters > LIMITS.jsonBytes) throw new SimulationError('json-byte-limit'); return JSON.stringify(key) + ':' + visit((item as Record<string, JsonValue>)[key]!, depth + 1); }).join(',') + '}';
  }
  const text = visit(value, 0);
  if (new TextEncoder().encode(text).length > LIMITS.jsonBytes) throw new SimulationError('json-byte-limit');
  return text;
}
export function canonicalBytes(value: unknown): Uint8Array { return new TextEncoder().encode(canonicalText(value)); }
export async function canonicalHash(value: unknown, digest: Digest): Promise<string> {
  const result = await digest(canonicalBytes(value));
  if (!/^[a-f0-9]{64}$/.test(result)) throw new SimulationError('invalid-digest-result');
  return result;
}

/** Strict bounded JSON wire reader; rejects duplicate keys before JSON.parse can discard them. */
export function parseJson(input: string | Uint8Array): JsonValue {
  let text: string;
  if (typeof input === 'string') { if (input.length > LIMITS.jsonBytes) throw new SimulationError('json-byte-limit'); text = input; }
  else { if (!(input instanceof Uint8Array) || input.byteLength > LIMITS.jsonBytes) throw new SimulationError('json-byte-limit'); try { text = new TextDecoder('utf8', { fatal: true }).decode(input); } catch { throw new SimulationError('invalid-utf8'); } }
  if (new TextEncoder().encode(text).length > LIMITS.jsonBytes) throw new SimulationError('json-byte-limit');
  let offset = 0, nodes = 0;
  const fail = (): never => { throw new SimulationError('invalid-json-text'); };
  function space() { while (/^[\t\n\r ]$/.test(text[offset] ?? '')) offset++; }
  function string(): string {
    const start = offset++; if (text[start] !== '"') return fail();
    while (offset < text.length) {
      const c = text[offset++]!;
      if (c === '"') { let value: string; try { value = JSON.parse(text.slice(start, offset)) as string; } catch { return fail(); } unicode(value); return value; }
      if (c === '\\') offset++;
    }
    return fail();
  }
  function value(depth: number): JsonValue {
    if (++nodes > LIMITS.jsonNodes || depth > LIMITS.jsonDepth) throw new SimulationError('json-structure-limit');
    space(); const c = text[offset];
    if (c === '"') return string();
    if (c === '[') {
      offset++; space(); const array: JsonValue[] = []; if (text[offset] === ']') { offset++; return array; }
      while (true) { array.push(value(depth + 1)); space(); if (text[offset] === ']') { offset++; return array; } if (text[offset++] !== ',') return fail(); }
    }
    if (c === '{') {
      offset++; space(); const object: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
      if (text[offset] === '}') { offset++; return object; }
      while (true) {
        space(); if (text[offset] !== '"') return fail(); const key = string();
        if (Object.hasOwn(object, key)) throw new SimulationError('duplicate-json-key');
        space(); if (text[offset++] !== ':') return fail(); object[key] = value(depth + 1);
        space(); if (text[offset] === '}') { offset++; return object; } if (text[offset++] !== ',') return fail();
      }
    }
    for (const [literal, result] of [['true', true], ['false', false], ['null', null]] as const) if (text.startsWith(literal, offset)) { offset += literal.length; return result; }
    const start = offset;
    while (/^[0-9eE+.\-]$/.test(text[offset] ?? '')) offset++;
    if (start === offset) return fail();
    const token = text.slice(start, offset);
    // Accept integer lexemes only: rounding/underflow of a decimal exponent must not become a valid counter.
    if (!/^-?(?:0|[1-9]\d*)$/.test(token)) throw new SimulationError('json-integer-required');
    const number = Number(token);
    if (!Number.isSafeInteger(number) || Object.is(number, -0)) throw new SimulationError('json-integer-required'); return number;
  }
  const result = value(0); space(); if (offset !== text.length) fail(); return result;
}
