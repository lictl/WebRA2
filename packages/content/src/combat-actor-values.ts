// SPDX-License-Identifier: GPL-3.0-or-later
// Original bounded canonical encoding; see ../COMBAT_ACTORS_PROVENANCE.md.
import { sha256 } from '@noble/hashes/sha2.js';
export function combatActorFingerprint(value: unknown, cap: number): string {
  const digest = sha256.create(), encoder = new TextEncoder(); let remaining = cap;
  const emit = (s: string) => { if (s.length > remaining) throw new Error('combat-actors-serialization-limit'); const b = encoder.encode(s); if (b.length > remaining) throw new Error('combat-actors-serialization-limit'); remaining -= b.length; digest.update(b); };
  const string = (s: string) => { if (s.length > Math.floor((remaining - 2) / 6)) throw new Error('combat-actors-serialization-limit'); emit(JSON.stringify(s)); };
  function visit(v: unknown): void {
    if (typeof v === 'string') string(v);
    else if (v === null || typeof v === 'number' || typeof v === 'boolean') emit(JSON.stringify(v));
    else if (Array.isArray(v)) { emit('['); v.forEach((x, i) => { if (i) emit(','); visit(x); }); emit(']'); }
    else { const r = v as Record<string, unknown>; emit('{'); Object.keys(r).sort().forEach((k, i) => { if (i) emit(','); string(k); emit(':'); visit(r[k]); }); emit('}'); }
  }
  visit(value); return Array.from(digest.digest(), b => b.toString(16).padStart(2, '0')).join('');
}
