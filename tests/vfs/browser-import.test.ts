// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original synthetic archives and loose files only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectInstallation, BROWSER_IMPORT_LIMITS } from '../../packages/vfs/src/browser-import.ts';
import { hashMixName } from '../../packages/formats/src/mix-names.ts';

const text = (value: string) => new TextEncoder().encode(value);
function mix(rows: readonly { name?: string; id?: number; data: Uint8Array }[], checksum = false): Uint8Array {
  const index = (checksum ? 10 : 6) + rows.length * 12, size = rows.reduce((n, row) => n + row.data.length, 0);
  const bytes = new Uint8Array(index + size + (checksum ? 20 : 0)), view = new DataView(bytes.buffer);
  const header = checksum ? 4 : 0; if (checksum) view.setUint32(0, 0x10000, true);
  view.setUint16(header, rows.length, true); view.setUint32(header + 2, size, true);
  let offset = 0;
  for (const [i, row] of rows.entries()) {
    const at = header + 6 + i * 12; view.setUint32(at, row.id ?? hashMixName(row.name!), true); view.setUint32(at + 4, offset, true); view.setUint32(at + 8, row.data.length, true); bytes.set(row.data, index + offset); offset += row.data.length;
  }
  return bytes;
}
function file(name: string, bytes: Uint8Array = text('ORIGINAL_SYNTHETIC_PAYLOAD')): File { return new File([new Uint8Array(bytes)], name); }
function database(names: readonly string[]): Uint8Array {
  const payload = text(names.map(name => `${name}\0`).join('')), bytes = new Uint8Array(52 + payload.length);
  bytes.set([88,67,67,32,98,121,32,79,108,97,102,32,118,97,110,32,100,101,114,32,83,112,101,107,26,4,23,39,16,25,128,0]);
  const view = new DataView(bytes.buffer); view.setUint32(32, bytes.length, true); view.setUint32(48, names.length, true); bytes.set(payload, 52); return bytes;
}
const options = { profile: 'ra2', policy: 'tolerant' } as const;
const requirement = (report: Awaited<ReturnType<typeof inspectInstallation>>, path: string) => report.requirements.find(row => row.path === path)!;

test('nested numeric MIX metadata preserves ranges and candidate provenance without payloads or verified hashes', async () => {
  const child = mix([{ name: 'rules.ini', data: text('DO_NOT_PUBLISH_SYNTHETIC_CONTENT') }]);
  const report = await inspectInstallation([file('ra2.mix', mix([{ name: 'cache.mix', data: child }]))], options);
  assert.equal(report.summary.archives, 2); assert.equal(report.summary.members, 2);
  const nested = report.archives[1]!; assert.equal(nested.parentId, report.archives[0]!.id); assert.equal(nested.absoluteOffset, 18);
  assert.equal(requirement(report, 'rules.ini').status, 'candidate');
  assert.equal(nested.members[0]!.nameEvidence[0]!.source, 'webra2-standard-filename-candidates-v1');
  assert.equal(report.files[0]!.identity.sha256, null); assert.equal(report.canStartCampaign, false);
  assert.doesNotMatch(JSON.stringify(report), /DO_NOT_PUBLISH|arrayBuffer/); assert.ok(Object.isFrozen(nested.members[0]!.nameEvidence));
});
test('numeric candidate probes reuse only ten header bytes while valid nested indexes still read their exact ranges', async () => {
  const child = mix([{ name: 'rules.ini', data: text('NOT_AN_ARCHIVE_HEADER') }]);
  const bad = text('NOT_AN_ARCHIVE_HEADER');
  const root = mix([{ id: 0x12345678, data: child }, { id: 0x23456789, data: bad }]);
  const ranges: [number, number][] = [];
  class CountedFile extends File {
    override slice(start = 0, end = this.size, type?: string): Blob { ranges.push([start, end - start]); return super.slice(start, end, type); }
  }
  const report = await inspectInstallation([new CountedFile([new Uint8Array(root)], 'ra2.mix')], options);
  assert.equal(report.archives.length, 2); assert.equal(report.summary.members, 3);
  assert.equal(report.archives[1]!.identification, 'structural-probe');
  assert.equal(requirement(report, 'rules.ini').status, 'candidate');
  const childStart = 30, payloadStart = childStart + 18, badStart = childStart + child.length;
  assert.deepEqual(ranges, [[0, 6], [0, 6], [0, 30], [childStart, 10], [childStart, 18], [payloadStart, 10], [badStart, 10]]);
  assert.equal(report.summary.bytesRead, ranges.reduce((n, [, size]) => n + size, 0));
  assert.equal(report.summary.bytesRead, 90);
});
test('short structural prefixes and cancellation after a prefix read do not trigger additional native reads', async () => {
  const short = Uint8Array.of(255, 255, 0, 0, 0, 0);
  const root = mix([{ id: 0x12345678, data: short }]);
  const ranges: [number, number][] = [];
  const controller = new AbortController(); let cancel = false;
  class CountedFile extends File {
    override slice(start = 0, end = this.size): Blob {
      ranges.push([start, end - start]);
      if (cancel && start === 18) controller.abort();
      return super.slice(start, end);
    }
  }
  const source = new CountedFile([new Uint8Array(root)], 'ra2.mix');
  const report = await inspectInstallation([source], options);
  assert.equal(report.archives.length, 1); assert.deepEqual(ranges, [[0, 6], [0, 6], [0, 18], [18, 6]]);
  cancel = true; ranges.length = 0;
  await assert.rejects(inspectInstallation([source], { ...options, signal: controller.signal }), { name: 'AbortError' });
  assert.deepEqual(ranges, [[0, 6], [0, 6], [0, 18], [18, 6]]);
});
test('strict blocks unverified checksum ancestry while tolerant inspection retains explicit warnings', async () => {
  const root = file('ra2.mix', mix([{ name: 'cache.mix', data: mix([{ name: 'rules.ini', data: text('synthetic') }]) }], true));
  const strict = await inspectInstallation([root], { ...options, policy: 'strict' });
  assert.equal(strict.archives[0]!.integrity, 'unverified'); assert.equal(strict.archives[1]!.integrity, 'no-checksum');
  assert.ok(strict.archives.every(row => !row.allowed)); assert.equal(requirement(strict, 'rules.ini').status, 'blocked');
  const tolerant = await inspectInstallation([root], options); assert.equal(requirement(tolerant, 'rules.ini').status, 'candidate');
  assert.ok(tolerant.diagnostics.some(row => row.code === 'checksum-unverified'));
});
test('supported loose files work without programs and keep literal names separate from content verification', async () => {
  const report = await inspectInstallation([file('RULES.INI'), file('art.ini'), file('game.exe'), file('legacy.dll'), file('assets.zip')], options);
  assert.equal(requirement(report, 'rules.ini').status, 'literal'); assert.equal(requirement(report, 'game.fnt').status, 'missing');
  assert.equal(report.summary.acceptedFiles, 2); assert.equal(report.summary.ignoredFiles, 3); assert.equal(report.summary.bytesRead, 0);
  assert.ok(report.diagnostics.some(row => row.code === 'program-not-required')); assert.equal(report.canStartCampaign, false);
});
test('duplicate casefold paths never become an arbitrary content winner', async () => {
  const report = await inspectInstallation([file('Rules.ini'), file('RULES.INI'), file('ra2.mix'), file('RA2.MIX')], options);
  assert.ok(report.files.every(row => row.status === 'duplicate')); assert.equal(report.summary.bytesRead, 0);
  assert.equal(requirement(report, 'rules.ini').status, 'ambiguous'); assert.equal(report.archives.length, 0);
});
test('folder-root normalization retains nested namespaces and rejects traversal or unsafe paths', async () => {
  const a = file('rules.ini'), b = file('custom.ini'); Object.defineProperty(a, 'webkitRelativePath', { value: 'Game/RULES.INI' }); Object.defineProperty(b, 'webkitRelativePath', { value: 'Game/mod/custom.ini' });
  const folder = await inspectInstallation([a, b], options);
  assert.equal(folder.files[0]!.path, 'rules.ini'); assert.equal(folder.files[1]!.path, 'mod/custom.ini'); assert.equal(folder.files[1]!.profileStatus, 'unassigned');
  const bad = await inspectInstallation([file('../rules.ini'), file('c:rules.ini'), file('%2e%2e.ini')], options);
  assert.ok(bad.files.every(row => row.status === 'invalid')); assert.equal(bad.summary.bytesRead, 0); assert.equal(bad.diagnostics.filter(row => row.code === 'unsafe-file-path').length, 3);
});
test('explicit RA2 selection excludes YR roots and definitions; unknown mod archives stay unassigned', async () => {
  const md = file('ra2md.mix', mix([{ name: 'rulesmd.ini', data: text('YR') }]));
  const ra2 = await inspectInstallation([md, file('rulesmd.ini'), file('rules.ini'), file('custom.mix', mix([{ name: 'art.ini', data: text('mod') }]))], options);
  assert.equal(ra2.files[0]!.profileStatus, 'excluded'); assert.equal(ra2.files[0]!.status, 'ignored');
  assert.equal(ra2.archives[0]!.profileStatus, 'unassigned'); assert.equal(ra2.archives[0]!.allowed, false);
  assert.equal(requirement(ra2, 'art.ini').status, 'missing');
  const yr = await inspectInstallation([md, file('rules.ini')], { ...options, profile: 'yr' });
  assert.equal(requirement(yr, 'rulesmd.ini').status, 'candidate'); assert.equal(yr.files[1]!.profileStatus, 'excluded');
});
test('invalid folder entries cannot hide a valid common root; mixed valid roots stay distinct', async () => {
  const selected = (path: string) => { const value = file(path.split('/').at(-1)!); Object.defineProperty(value, 'webkitRelativePath', { value: path }); return value; };
  const report = await inspectInstallation([selected('Game/CON.ini'), selected('Game/rules.ini'), selected('Game/mod/art.ini')], options);
  assert.equal(report.files[0]!.status, 'invalid'); assert.equal(report.files[1]!.path, 'rules.ini');
  assert.equal(requirement(report, 'rules.ini').status, 'literal');
  assert.equal(report.files[2]!.path, 'mod/art.ini'); assert.equal(report.files[2]!.profileStatus, 'unassigned');
  assert.ok(report.diagnostics.some(row => row.code === 'unsafe-file-path'));
  const mixed = await inspectInstallation([selected('Game/rules.ini'), selected('Other/art.ini'), selected('Game/CON.ini')], options);
  assert.deepEqual(mixed.files.slice(0, 2).map(row => row.path), ['game/rules.ini', 'other/art.ini']);
  assert.ok(mixed.files.slice(0, 2).every(row => row.profileStatus === 'unassigned'));
  assert.equal(requirement(mixed, 'rules.ini').status, 'missing');
});
test('malformed named archives and short named nested candidates remain explicit failures', async () => {
  const report = await inspectInstallation([file('ra2.mix', mix([{ name: 'cache.mix', data: text('bad') }])), file('language.mix', Uint8Array.of(1))], options);
  assert.equal(report.archives.length, 3); assert.equal(report.archives.filter(row => row.integrity === 'structural-failure').length, 2);
  assert.equal(report.archives[1]!.format, null); assert.ok(report.diagnostics.some(row => row.severity === 'error'));
});
test('structurally duplicate numeric IDs block archive use and remain ambiguous candidates', async () => {
  const report = await inspectInstallation([file('ra2.mix', mix([{ name: 'rules.ini', data: text('a') }, { name: 'rules.ini', data: text('b') }]))], options);
  assert.equal(report.archives[0]!.integrity, 'structural-failure'); assert.equal(report.archives[0]!.allowed, false);
  assert.equal(requirement(report, 'rules.ini').status, 'ambiguous');
});
test('depth and declared per-archive entry caps fail explicitly before unbounded work', async () => {
  let bytes = mix([{ name: 'rules.ini', data: text('data') }]);
  for (let i = 0; i < 5; i++) bytes = mix([{ name: 'cache.mix', data: bytes }]);
  const deep = await inspectInstallation([file('ra2.mix', bytes)], options);
  assert.equal(deep.status, 'limited'); assert.ok(deep.diagnostics.some(row => row.code === 'archive-depth-limit'));
  const huge = new Uint8Array(6); new DataView(huge.buffer).setUint16(0, BROWSER_IMPORT_LIMITS.entriesPerArchive + 1, true);
  const capped = await inspectInstallation([file('ra2.mix', huge)], options); assert.equal(capped.status, 'limited'); assert.ok(capped.diagnostics.some(row => row.code === 'entry-limit'));
});
test('a later bounded XCC database supplies candidate names and exact metadata provenance to earlier records', async () => {
  const report = await inspectInstallation([
    file('ra2.mix', mix([{ name: 'custom-unit.shp', data: text('PRIVATE_SYNTHETIC_PAYLOAD') }])),
    file('language.mix', mix([{ name: 'local mix database.dat', data: database(['custom-unit.shp']) }])),
  ], options);
  const member = report.archives[0]!.members[0]!;
  assert.deepEqual(member.names, ['custom-unit.shp']);
  assert.equal(member.nameEvidence[0]!.source, `${report.archives[1]!.id}/member:0:xcc-local-database`);
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE_SYNTHETIC_PAYLOAD/);
  assert.equal(report.requirements.length, 10);
});
test('unsafe XCC names are rejected and declared name caps make inspection explicitly limited', async () => {
  const unsafe = await inspectInstallation([file('ra2.mix', mix([{ name: 'local mix database.dat', data: database(['../rules.ini']) }]))], options);
  assert.ok(unsafe.diagnostics.some(row => row.code === 'database-rejected'));
  assert.equal(requirement(unsafe, 'rules.ini').status, 'missing');
  const excessive = database([]); new DataView(excessive.buffer).setUint32(48, BROWSER_IMPORT_LIMITS.databaseNames + 1, true);
  const capped = await inspectInstallation([file('ra2.mix', mix([{ name: 'local mix database.dat', data: excessive }]))], options);
  assert.equal(capped.status, 'limited'); assert.ok(capped.diagnostics.some(row => row.code === 'database-limit'));
});
test('progress cancellation rejects AbortError and later re-selection has no stale state', async () => {
  const controller = new AbortController(), inputs = [file('ra2.mix', mix([{ name: 'rules.ini', data: text('data') }]))];
  await assert.rejects(inspectInstallation(inputs, { ...options, signal: controller.signal, onProgress(progress) { if (progress.archives) controller.abort(); } }), { name: 'AbortError' });
  const next = await inspectInstallation([file('rules.ini')], options); assert.equal(requirement(next, 'rules.ini').status, 'literal'); assert.equal(next.archives.length, 0);
  const cancelled = new AbortController(); cancelled.abort(); await assert.rejects(inspectInstallation([], { ...options, signal: cancelled.signal }), { name: 'AbortError' });
});
test('input arrays/options are snapshotted and invalid sparse/oversized selections reject', async () => {
  const selected = [file('rules.ini')], changed = { profile: 'ra2' as 'ra2' | 'yr', policy: 'tolerant' as const };
  const report = await inspectInstallation(selected, { ...changed, onProgress() { selected[0] = file('rulesmd.ini'); changed.profile = 'yr'; } });
  assert.equal(report.profile, 'ra2'); assert.equal(requirement(report, 'rules.ini').status, 'literal');
  await assert.rejects(inspectInstallation(new Array<File>(1), options), /file-type/);
  await assert.rejects(inspectInstallation(Array.from({ length: BROWSER_IMPORT_LIMITS.files + 1 }, () => file('x')), options), /file-limit/);
});
test('the shared 64 MiB inspection budget stops before another large metadata allocation', async () => {
  const database = new Uint8Array(BROWSER_IMPORT_LIMITS.databaseBytes);
  const bytes = mix([{ name: 'local mix database.dat', data: database }]);
  const files = Array.from({ length: 65 }, (_, i) => file(`expand${String(i).padStart(2, '0')}.mix`, bytes));
  const report = await inspectInstallation(files, options);
  assert.equal(report.status, 'limited'); assert.ok(report.summary.bytesRead <= BROWSER_IMPORT_LIMITS.readBytes);
  assert.ok(report.diagnostics.some(row => row.code === 'browser-read-budget')); assert.ok(report.summary.bytesRead > 60 * 1024 * 1024);
});

test('all six loose theater tile extensions are data inputs while executable siblings remain ignored', async () => {
  const names = ['original.tem', 'original.sno', 'original.urb', 'original.ubn', 'original.des', 'original.lun', 'engine.exe'];
  for (const profile of ['ra2', 'yr'] as const) {
    const report = await inspectInstallation(names.map(name => new File([Uint8Array.of(1, 2, 3)], name)), { profile, policy: 'tolerant' });
    assert.deepEqual(report.files.filter(f => f.status === 'accepted').map(f => f.path), names.slice(0, 6));
    assert.equal(report.files.find(f => f.path === 'engine.exe')!.status, 'ignored');
    assert.equal(report.canStartCampaign, false); assert.equal(report.archives.length, 0);
  }
});
