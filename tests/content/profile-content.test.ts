// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original data and Node SHA-256 oracle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assembleProfileContent, type ProfileContentPlan, type ProfileContentFile, type ProfileContentRole } from '../../packages/content/src/profile-content.ts';
import { createBrowserVerifiedSession } from '../../packages/vfs/src/browser-verified.ts';
import { lookupRuntimeIni } from '../../packages/content/src/runtime-ini.ts';
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function csf(): Uint8Array {
  const u32 = (value: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(value); return b; };
  const label = Buffer.from('UI:EXAMPLE'), text = '原創測試', encoded = Buffer.from(text, 'utf16le');
  for (let i = 0; i < encoded.length; i++) encoded[i] = encoded[i]! ^ 255;
  return new Uint8Array(Buffer.concat([Buffer.from(' FSC'), u32(3), u32(1), u32(1), u32(0), u32(9),
    Buffer.from(' LBL'), u32(1), u32(label.length), label, Buffer.from(' RTS'), u32(text.length), encoded]));
}
function fixture(profile: 'ra2' | 'yr' = 'ra2', prefix = 'source') {
  const roles: ProfileContentRole[] = ['rules', 'art', 'ai', 'battle', 'mapsel', 'briefing', 'sound', 'strings', 'font', 'mission'];
  const payloads = roles.map(role => role === 'strings' ? csf() : role === 'font' ? Uint8Array.of(1, 2, 3) :
    new TextEncoder().encode(`[Toy]\nValue=${role}\n${role === 'rules' ? 'Retained=base\n' : ''}`));
  const roots = payloads.map((bytes, i) => ({ sourceId: `${prefix}${i}`, blob: new Blob([new Uint8Array(bytes)]) }));
  const files: ProfileContentFile[] = roles.map((role, order) => ({ profile, role, order, kind: role === 'mission' ? 'map' : 'base',
    path: `${role}.${role === 'mission' ? 'map' : role === 'strings' ? 'csf' : role === 'font' ? 'fnt' : 'ini'}`,
    source: { root: { sourceId: roots[order]!.sourceId, size: payloads[order]!.length, sha256: digest(payloads[order]!) },
      absoluteOffset: 0, size: payloads[order]!.length, sha256: digest(payloads[order]!) } }));
  const plan: ProfileContentPlan = { profile, engineVersion: 'test-engine-1', orderedModHashes: [], files };
  return { roots, plan, payloads };
}
async function assembled(f = fixture(), plan = f.plan) {
  const reader = createBrowserVerifiedSession(f.roots);
  try { return await assembleProfileContent(reader, plan); } finally { await reader.dispose(); }
}
test('verified profile assembly compiles map overrides and independent table namespaces, preserving local CSF', async () => {
  const result = await assembled();
  assert.equal(lookupRuntimeIni(result.rules, 'Toy', 'Value')!.value, 'mission');
  assert.equal(lookupRuntimeIni(result.rules, 'Toy', 'Retained')!.value, 'base');
  assert.equal(lookupRuntimeIni(result.mission, 'Toy', 'Retained'), undefined);
  for (const [role, table] of Object.entries(result.tables)) assert.equal(lookupRuntimeIni(table, 'Toy', 'Value')!.value, role);
  assert.equal(result.strings.resolve('ui:example').text, '原創測試');
  assert.equal(result.files.length, 10); assert.equal(result.canStartCampaign, false); assert.equal(result.scope, 'definitions-and-opening-mission');
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.files[0]!.source.root)); assert.ok(Object.isFrozen(result.contentIdentity));
});
test('fingerprints ignore picker IDs, physical locations and caller enumeration but include ordered semantic choices', async () => {
  const f = fixture(), first = await assembled(f), other = fixture('ra2', 'different');
  assert.deepEqual((await assembled(other, { ...other.plan, files: [...other.plan.files].reverse() })).contentIdentity, first.contentIdentity);
  const packed = fixture(), prefix = Uint8Array.of(91, 92, 93);
  packed.roots = packed.payloads.map((bytes, i) => ({ sourceId: `archive${i}`, blob: new Blob([prefix, new Uint8Array(bytes), prefix]) }));
  const packedPlan: ProfileContentPlan = { ...packed.plan, files: packed.plan.files.map((file, i) => ({ ...file,
    source: { ...file.source, absoluteOffset: prefix.length, root: { sourceId: packed.roots[i]!.sourceId,
      size: file.source.size + prefix.length * 2, sha256: digest(new Uint8Array([...prefix, ...packed.payloads[i]!, ...prefix])) } } })) };
  assert.deepEqual((await assembled(packed, packedPlan)).contentIdentity, first.contentIdentity);
  const semantic = (files: readonly ProfileContentFile[]) => files.map(file => ({ path: file.path, role: file.role, order: file.order, kind: file.kind, size: file.source.size, sha256: file.source.sha256 }));
  const version = { policy: 'webra2-profile-content-1', iniPolicy: 'webra2-ini-1', csfPolicy: 'v3-ambiguous-labels-1', engineVersion: 'test-engine-1', profile: 'ra2', orderedModHashes: [] };
  assert.equal(first.contentIdentity.manifestSha256, digest(new TextEncoder().encode(JSON.stringify({ ...version, files: semantic(f.plan.files) }))));
  const mods = ['a'.repeat(64), 'b'.repeat(64)];
  for (const plan of [{ ...f.plan, engineVersion: 'test-engine-2' }, { ...f.plan, orderedModHashes: mods }, { ...f.plan, files: f.plan.files.map(file => file.role === 'art' ? { ...file, path: 'replacement.ini' } : file) }])
    assert.notEqual((await assembled(f, plan)).contentIdentity.manifestSha256, first.contentIdentity.manifestSha256);
  assert.notEqual((await assembled(f, { ...f.plan, orderedModHashes: mods })).contentIdentity.rulesSha256,
    (await assembled(f, { ...f.plan, orderedModHashes: [...mods].reverse() })).contentIdentity.rulesSha256);
  assert.notEqual((await assembled(fixture('yr'))).contentIdentity.manifestSha256, first.contentIdentity.manifestSha256);
});
test('plans are detached before asynchronous reads; incomplete/conflicting/cross-profile plans fail before I/O', async () => {
  const f = fixture(), plan = structuredClone(f.plan), reader = createBrowserVerifiedSession(f.roots);
  try {
    const pending = assembleProfileContent(reader, plan);
    (plan.files[0]!.source.root as { sha256: string }).sha256 = '0'.repeat(64);
    assert.equal((await pending).rules.profile, 'ra2');
  } finally { await reader.dispose(); }
  let reads = 0; const forbidden = { async read() { reads++; throw new Error('unexpected read'); } };
  const wrong: ProfileContentPlan[] = [
    { ...f.plan, files: f.plan.files.slice(1) },
    { ...f.plan, files: f.plan.files.map((file, i) => i ? file : { ...file, profile: 'yr' }) },
    { ...f.plan, files: f.plan.files.map((file, i) => i ? file : { ...file, order: 1 }) },
    { ...f.plan, files: f.plan.files.map((file, i) => i ? file : { ...file, order: 100 }) },
    { ...f.plan, files: f.plan.files.map((file, i) => i ? file : { ...file, path: '../escape.ini' }) },
    { ...f.plan, files: f.plan.files.map((file, i) => i === 1 ? { ...file, path: f.plan.files[0]!.path } : file) },
    { ...f.plan, orderedModHashes: ['a'.repeat(64), 'a'.repeat(64)] },
  ];
  for (const plan of wrong) await assert.rejects(assembleProfileContent(forbidden, plan));
  await assert.rejects(assembleProfileContent(forbidden, { ...f.plan, files: new Array(129) }));
  let getterCalls = 0;
  for (const key of ['files', 'orderedModHashes']) {
    const accessorPlan = { ...f.plan };
    Object.defineProperty(accessorPlan, key, { enumerable: true, get() { getterCalls++; throw new Error('must not invoke plan accessors'); } });
    await assert.rejects(assembleProfileContent(forbidden, accessorPlan), /content-plan-limit/);
  }
  assert.equal(getterCalls, 0); assert.equal(reads, 0);
});
test('wrong adapter bytes and original expected member pins cannot become compiled content', async () => {
  const f = fixture();
  await assert.rejects(assembleProfileContent({ async read() { return new Uint8Array(0); } }, f.plan), /content-read-size/);
  await assert.rejects(assembleProfileContent({ async read(identity) { return new Uint8Array(identity.size); } }, f.plan), /content-read-hash/);
  const reader = createBrowserVerifiedSession(f.roots);
  try { await assert.rejects(assembleProfileContent(reader, { ...f.plan, files: f.plan.files.map((file, i) => i ? file : { ...file, source: { ...file.source, sha256: 'f'.repeat(64) } }) }), /member-hash-mismatch/); }
  finally { await reader.dispose(); }
});
test('cancellation and callback failures stop assembly without a partial result', async () => {
  const f = fixture(), controller = new AbortController(), reader = createBrowserVerifiedSession(f.roots, { signal: controller.signal });
  let completed = 0;
  try {
    await assert.rejects(assembleProfileContent(reader, f.plan, { signal: controller.signal, onProgress(p) { completed++; assert.ok(Object.isFrozen(p)); controller.abort(); } }), { name: 'AbortError' });
    assert.equal(completed, 1);
  } finally { await reader.dispose(); }
  const second = createBrowserVerifiedSession(f.roots);
  try { await assert.rejects(assembleProfileContent(second, f.plan, { onProgress() { throw new Error('original callback failure'); } }), /original callback failure/); }
  finally { await second.dispose(); }
});
test('ordinary browser realms without SharedArrayBuffer can assemble valid content', async () => {
  const original = globalThis.SharedArrayBuffer;
  try {
    (globalThis as unknown as { SharedArrayBuffer: undefined }).SharedArrayBuffer = undefined;
    assert.equal((await assembled()).contentIdentity.profile, 'ra2');
  } finally { globalThis.SharedArrayBuffer = original; }
});
