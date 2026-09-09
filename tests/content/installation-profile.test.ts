// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic files; Node SHA-256 is independent of the runtime implementation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadInstallationProfile, INSTALLATION_PROFILE_LIMITS } from '../../packages/content/src/installation-profile.ts';
import { inspectBrowserCatalog, type BrowserCatalog } from '../../packages/vfs/src/browser-catalog.ts';
import { hashMixName } from '../../packages/formats/src/mix-names.ts';
import { lookupRuntimeIni } from '../../packages/content/src/runtime-ini.ts';
const encode = (value: string) => new TextEncoder().encode(value);
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const file = (name: string, bytes: Uint8Array) => new File([new Uint8Array(bytes)], name);
const request = { profile: 'ra2', engineVersion: 'test-engine-1', missionPath: 'example.map' } as const;
function csf(): Uint8Array {
  const u32 = (value: number) => { const bytes = Buffer.alloc(4); bytes.writeUInt32LE(value); return bytes; };
  const label = Buffer.from('UI:ORIGINAL'), text = '原創', encoded = Buffer.from(text, 'utf16le');
  for (let i = 0; i < encoded.length; i++) encoded[i] = encoded[i]! ^ 255;
  return new Uint8Array(Buffer.concat([Buffer.from(' FSC'), u32(3), u32(1), u32(1), u32(0), u32(9),
    Buffer.from(' LBL'), u32(1), u32(label.length), label, Buffer.from(' RTS'), u32(text.length), encoded]));
}
function fixture(profile: 'ra2' | 'yr' = 'ra2') {
  const names = profile === 'ra2' ? ['rules.ini', 'art.ini', 'ai.ini', 'battle.ini', 'mapsel.ini', 'mission.ini', 'sound.ini', 'ra2.csf', 'game.fnt', 'example.map'] :
    ['rulesmd.ini', 'artmd.ini', 'aimd.ini', 'battlemd.ini', 'mapselmd.ini', 'missionmd.ini', 'soundmd.ini', 'ra2md.csf', 'game.fnt', 'example.map'];
  return names.map((name, i) => ({ name, bytes: i === 7 ? csf() : i === 8 ? Uint8Array.of(4, 5, 6) :
    encode(`[Original]\nValue=${i}\n${i === 0 ? 'Retained=yes\n' : ''}`) }));
}
function mix(rows: readonly { name: string; bytes: Uint8Array }[], checksum = false): Uint8Array {
  const header = checksum ? 10 : 6, dataStart = header + rows.length * 12, size = rows.reduce((n, row) => n + row.bytes.length, 0);
  const result = new Uint8Array(dataStart + size + (checksum ? 20 : 0)), view = new DataView(result.buffer);
  if (checksum) view.setUint32(0, 0x10000, true);
  view.setUint16(header - 6, rows.length, true); view.setUint32(header - 4, size, true);
  let offset = 0;
  for (const [i, row] of rows.entries()) {
    view.setUint32(header + i * 12, hashMixName(row.name), true); view.setUint32(header + i * 12 + 4, offset, true); view.setUint32(header + i * 12 + 8, row.bytes.length, true);
    result.set(row.bytes, dataStart + offset); offset += row.bytes.length;
  }
  return result;
}
async function catalog(files: File[], profile: 'ra2' | 'yr' = 'ra2') { return inspectBrowserCatalog(files, { profile, policy: 'tolerant' }); }
test('complete loose and archived profiles preserve semantic identity, role namespaces and all equivalent copies', async () => {
  const rows = fixture(), first = await catalog(rows.map(row => file(row.name, row.bytes))), second = await catalog([file('ra2.mix', mix(rows)), file('maps01.mix', mix([rows[9]!]))]);
  try {
    const a = await loadInstallationProfile(first, request), b = await loadInstallationProfile(second, request);
    assert.equal(a.status, 'resolved'); assert.equal(b.status, 'resolved'); assert.equal(a.canStartCampaign, false);
    assert.deepEqual(a.content!.contentIdentity, b.content!.contentIdentity);
    assert.equal(b.definitions[9]!.selected.length, 2); assert.equal(b.definitions[9]!.candidates.length, 2);
    assert.equal(lookupRuntimeIni(b.content!.rules, 'Original', 'Value')!.value, '9');
    assert.equal(lookupRuntimeIni(b.content!.rules, 'Original', 'Retained')!.value, 'yes');
    assert.equal(lookupRuntimeIni(b.content!.tables.art, 'Original', 'Value')!.value, '1');
    assert.equal(b.content!.strings.resolve('ui:original').text, '原創');
    assert.ok(Object.isFrozen(b.definitions)); assert.ok(Object.isFrozen(b.definitions[0]!.candidates[0]!.identity!.root));
    assert.equal(b.content!.files[0]!.source.sha256, sha(rows[0]!.bytes));
  } finally { await first.dispose(); await second.dispose(); }
});
test('loose and descending numbered patches win explicitly; shadowed differing bytes are retained', async () => {
  const rows = fixture('yr'), older = { name: 'rulesmd.ini', bytes: encode('[Original]\nRetained=older') }, newer = { name: 'rulesmd.ini', bytes: encode('[Original]\nRetained=newer') };
  const files = [file('ra2md.mix', mix(rows)), file('expandmd01.mix', mix([older])), file('expandmd99.mix', mix([newer]))];
  const first = await catalog(files, 'yr'), second = await catalog([...files, file('rulesmd.ini', encode('[Original]\nRetained=loose'))], 'yr');
  try {
    const r = { ...request, profile: 'yr' } as const;
    const a = await loadInstallationProfile(first, r), b = await loadInstallationProfile(second, r);
    assert.equal(lookupRuntimeIni(a.content!.rules, 'Original', 'Retained')!.value, 'newer');
    assert.equal(lookupRuntimeIni(b.content!.rules, 'Original', 'Retained')!.value, 'loose');
    assert.equal(a.definitions[0]!.candidates.length, 3); assert.equal(b.definitions[0]!.candidates.length, 4);
    assert.equal(a.definitions[0]!.candidates.find(value => a.definitions[0]!.selected.includes(value.candidate.id))!.priority, 100);
    await assert.rejects(loadInstallationProfile(first, request), /catalog-profile/);
  } finally { await first.dispose(); await second.dispose(); }
});
test('equal-priority differing bytes never select by enumeration, and caller-selected mission changes fingerprints', async () => {
  const rows = fixture(), extra = { name: 'example.map', bytes: encode('[Original]\nValue=other') };
  const conflicting = await catalog([file('ra2.mix', mix(rows)), file('maps01.mix', mix([extra]))]);
  const selectable = await catalog([file('ra2.mix', mix([...rows, { ...extra, name: 'second.map' }]))]);
  try {
    const bad = await loadInstallationProfile(conflicting, request); assert.equal(bad.status, 'unresolved'); assert.equal(bad.content, null);
    assert.equal(bad.definitions[9]!.status, 'content-conflict'); assert.deepEqual(bad.definitions[9]!.selected, []);
    assert.equal(bad.definitions[9]!.candidates.filter(value => value.identity).length, 2);
    const a = await loadInstallationProfile(selectable, request), b = await loadInstallationProfile(selectable, { ...request, missionPath: 'SECOND.MAP' });
    assert.notEqual(a.content!.contentIdentity.manifestSha256, b.content!.contentIdentity.manifestSha256);
    assert.equal(lookupRuntimeIni(b.content!.mission, 'Original', 'Value')!.value, 'other');
  } finally { await conflicting.dispose(); await selectable.dispose(); }
});
test('missing, blocked, unknown mount and duplicate paths stop before expensive verified root reads', async () => {
  const rows = fixture();
  for (const [files, policy, expected] of [
    [[file('ra2.mix', mix(rows.slice(1)))], 'tolerant', 'missing'],
    [[file('ra2.mix', mix(rows, true))], 'strict', 'blocked'],
    [[file('ecache01.mix', mix(rows))], 'tolerant', 'unsupported-mount'],
    [[file('ra2.mix', mix(rows)), file('rules.ini', rows[0]!.bytes), file('RULES.INI', rows[0]!.bytes)], 'tolerant', 'blocked'],
    [[file('ra2.mix', mix([{ name: 'unknown.mix', bytes: mix(rows) }]))], 'tolerant', 'unsupported-mount'],
  ] as const) {
    let verified = 0;
    const c = await inspectBrowserCatalog(files, { profile: 'ra2', policy, onVerifiedProgress() { verified++; } });
    try { const result = await loadInstallationProfile(c, request); assert.equal(result.status, 'unresolved'); assert.equal(result.definitions[0]!.status, expected); assert.equal(verified, 0); }
    finally { await c.dispose(); }
  }
});
test('preflight caps cover candidates, aggregate member bytes and full roots before hashing', async () => {
  const rows = fixture(); let verified = 0;
  const c = await inspectBrowserCatalog([file('ra2.mix', mix(rows))], { profile: 'ra2', policy: 'tolerant', onVerifiedProgress() { verified++; } });
  try {
    for (const limits of [{ candidates: 9 }, { memberBytes: 1 }, { candidateBytes: 1 }, { rootBytes: 1 }]) await assert.rejects(loadInstallationProfile(c, request, { limits }), /installation-(candidate-limit|byte-limit|root-budget)/);
    for (const limits of [{ candidates: INSTALLATION_PROFILE_LIMITS.candidates + 1 }, { rootBytes: -1 }, { candidateBytes: NaN }]) await assert.rejects(loadInstallationProfile(c, request, { limits }), /installation-limit/);
    assert.equal(verified, 0);
    assert.equal((await loadInstallationProfile(c, request)).status, 'resolved');
  } finally { await c.dispose(); }
});
test('request snapshot, sequential busy admission, callback failure and cancellation leave no partial result', async () => {
  const c = await catalog(fixture().map(row => file(row.name, row.bytes))), mutable = { ...request };
  try {
    let reentrant: Promise<void> | undefined;
    const pending = loadInstallationProfile(c, mutable, { onProgress(value) {
      assert.ok(Object.isFrozen(value)); if (!reentrant) reentrant = assert.rejects(loadInstallationProfile(c, request), /installation-busy/);
    } });
    mutable.missionPath = 'changed.map' as 'example.map';
    assert.equal((await pending).content!.files[9]!.path, 'example.map'); await reentrant;
    await assert.rejects(loadInstallationProfile(c, request, { onProgress() { throw new Error('callback failure'); } }), /callback failure/);
    const abort = new AbortController(); let progress = 0;
    await assert.rejects(loadInstallationProfile(c, request, { signal: abort.signal, onProgress() { progress++; abort.abort(); } }), { name: 'AbortError' });
    assert.equal(progress, 1); assert.equal((await loadInstallationProfile(c, request)).status, 'resolved');
  } finally { await c.dispose(); }
});
test('invalid request, partial index and adapter identity/byte mismatches never produce content', async () => {
  const c = await catalog([file('ra2.mix', mix(fixture()))]);
  try {
    for (const invalid of [{ ...request, missionPath: '../example.map' }, { ...request, missionPath: 'rules.ini' }, { ...request, engineVersion: '' }, { ...request, extra: true }]) await assert.rejects(loadInstallationProfile(c, invalid));
    await assert.rejects(loadInstallationProfile({ ...c, report: { ...c.report, status: 'limited' } }, request), /incomplete-index/);
    const incorrect: BrowserCatalog = { ...c, async discover(id) { const found = await c.discover(id); return { ...found, bytes: new Uint8Array(found.bytes.length) }; } };
    await assert.rejects(loadInstallationProfile(incorrect, request), /read-hash/);
    const wrong: BrowserCatalog = { ...c, async discover(id) { const found = await c.discover(id); return { ...found, identity: { ...found.identity, absoluteOffset: 0 } }; } };
    await assert.rejects(loadInstallationProfile(wrong, request), /read-identity/);
  } finally { await c.dispose(); }
});
test('validated discovered identity scalars are detached before hashing yields', async () => {
  const c = await catalog([file('ra2.mix', mix(fixture()))]);
  try {
    const original = c.lookup('rules.ini').candidates[0]!;
    let changed = false;
    const mutable: BrowserCatalog = { ...c, async discover(id) {
      const found = await c.discover(id), identity = structuredClone(found.identity);
      // The first microtask runs before the loader continuation; its nested task
      // runs during the loader's asynchronous hash operation, after validation.
      queueMicrotask(() => queueMicrotask(() => {
        (identity as { absoluteOffset: number }).absoluteOffset++;
        (identity.root as { sha256: string }).sha256 = 'f'.repeat(64); changed = true;
      }));
      return { bytes: found.bytes, identity };
    } };
    const result = await loadInstallationProfile(mutable, request);
    assert.equal(changed, true); assert.equal(result.status, 'resolved');
    assert.equal(result.content!.files[0]!.source.absoluteOffset, original.absoluteOffset);
    assert.equal(result.content!.files[0]!.source.root.sha256, sha(mix(fixture())));
  } finally { await c.dispose(); }
});
test('known-name and cross-path numeric collisions remain unresolved before discovery', async () => {
  const c = await catalog([file('ra2.mix', mix(fixture()))]);
  try {
    let reads = 0;
    for (const crossPath of [false, true]) {
      const colliding: BrowserCatalog = { ...c,
        lookup(path) {
          if (crossPath && path === 'example.map') {
            const lookup = c.lookup('rules.ini');
            return { path, status: 'candidate', candidates: lookup.candidates.map(candidate => ({ ...candidate, knownNames: [] })) };
          }
          const lookup = c.lookup(path);
          return !crossPath && path === 'rules.ini' ? { ...lookup, status: 'ambiguous', candidates: lookup.candidates.map(candidate =>
            ({ ...candidate, ambiguousName: true, knownNames: ['rules.ini', 'collision.ini'] })) } : lookup;
        },
        async discover(id) { reads++; return c.discover(id); },
      };
      const result = await loadInstallationProfile(colliding, request);
      assert.equal(result.status, 'unresolved'); assert.equal(result.definitions[0]!.status, 'name-collision');
      if (crossPath) assert.equal(result.definitions[9]!.status, 'name-collision');
    }
    assert.equal(reads, 0);
  } finally { await c.dispose(); }
});
