// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic definitions only; no retail data.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileTheaterTiles, resolveTheaterTile, TheaterTilesError, type TheaterTiles, type TileTheater } from '../../packages/content/src/theater-tiles.ts';
import type { RuntimeIniLayer } from '../../packages/content/src/runtime-ini.ts';
const bytes = (text: string) => new TextEncoder().encode(text);
function layer(text: string, order = 0, profile: 'ra2' | 'yr' = 'yr'): RuntimeIniLayer {
  return { id: `definition-${order}`, profile, order, kind: order ? 'mod' : 'base', sourceSha256: String(order % 10).repeat(64), bytes: bytes(text) };
}
function compile(text: string, options: Parameters<typeof compileTheaterTiles>[1] = {}) {
  return compileTheaterTiles({ profile: 'yr', theater: 'NEWURBAN', layers: [layer(text)] }, options);
}
function error(code: string, fn: () => unknown) { assert.throws(fn, (e: unknown) => e instanceof TheaterTilesError && e.code === code); }
function resolve(table: TheaterTiles, tileIndex: number, subtile = 0, extraTileWord = 0) {
  return resolveTheaterTile(table, { tileIndex, extraTileWord, subtile });
}
const simple = '[General]\nClearTile=0\n[TileSet0000]\nTilesInSet=1\nFileName=original_\n';

test('cumulative file numbering preserves zero-length sets and independent TMP slots', () => {
  const table = compile('[General]\nClearTile=2\n[TileSet0000]\nTilesInSet=100\nFileName=alpha\n[TileSet0001]\nTilesInSet=0\n[TileSet0002]\nTilesInSet=2\nFileName=beta\nCustomField=retained\n');
  assert.equal(table.totalTiles, 102); assert.deepEqual(table.sets.map(s => [s.firstTile, s.tiles]), [[0, 100], [100, 0], [100, 2]]);
  for (const [tile, expected] of [[98, 'alpha99.ubn'], [99, 'alpha100.ubn'], [100, 'beta01.ubn'], [101, 'beta02.ubn']] as const) {
    const value = resolve(table, tile, 17); assert.equal(value.status, 'candidate');
    if (value.status !== 'candidate') assert.fail();
    assert.equal(value.candidates[0]!.filename, expected); assert.equal(value.subtile, 17);
    assert.equal(value.physicalAssetsVerified, false); assert.equal(value.variantSelection, 'unresolved');
  }
  assert.equal(table.sets[2]!.fields.find(e => e.key === 'customfield')!.value, 'retained');
  const clear = resolve(table, 65535, 7); assert.equal(clear.status, 'clear-sentinel');
  if (clear.status !== 'clear-sentinel') assert.fail();
  assert.equal(clear.globalTile, 100); assert.equal(clear.setId, 2); assert.equal(clear.subtile, 7);
  assert.equal(clear.candidates[0]!.filename, 'beta01.ubn');
  assert.equal(resolve(table, 102).status, 'tile-out-of-range');
  assert.equal(resolve(table, 65535, 0, 1).status, 'unsupported-extra-word');
});

test('replacement names are bounded candidates with explicit ordered probing and no selected image', () => {
  const table = compile(simple), resolution = resolve(table, 0);
  if (resolution.status !== 'candidate') assert.fail();
  assert.equal(table.potentialCandidateNames, 27); assert.equal(resolution.candidates.length, 27);
  assert.deepEqual(resolution.candidates.slice(0, 3).map(c => c.filename), ['original_01.ubn', 'original_01a.ubn', 'original_01b.ubn']);
  assert.equal(resolution.candidates[26]!.filename, 'original_01z.ubn');
  assert.equal(resolution.replacementProbe, 'successive-suffixes-until-first-missing'); assert.equal(resolution.replacementCompleteness, 'bounded');
  const limited = resolve(compile(simple, { replacementVariants: 0, candidateNames: 1 }), 0);
  if (limited.status !== 'candidate') assert.fail(); assert.equal(limited.candidates.length, 1);
  error('theater-candidate-limit', () => compile(simple, { candidateNames: 26 }));
  error('theater-limits', () => compile(simple, { replacementVariants: 27 }));
});

test('explicit profile/theater pairing determines extension without inferred md layers', () => {
  for (const [theater, extension] of [['TEMPERATE', '.tem'], ['SNOW', '.sno'], ['URBAN', '.urb'], ['NEWURBAN', '.ubn'], ['DESERT', '.des'], ['LUNAR', '.lun']] as const) {
    const table = compileTheaterTiles({ profile: 'yr', theater, layers: [layer(simple)] });
    assert.equal(table.extension, extension);
  }
  error('theater-profile', () => compileTheaterTiles({ profile: 'ra2', theater: 'NEWURBAN', layers: [layer(simple, 0, 'ra2')] }));
  error('theater-profile', () => compileTheaterTiles({ profile: 'yr', theater: 'constructor' as TileTheater, layers: [layer(simple)] }));
  const ra2 = compileTheaterTiles({ profile: 'ra2', theater: 'URBAN', layers: [layer(simple, 0, 'ra2')] });
  assert.equal(ra2.mappingEvidence, 'ea-editor-ra2-native-unverified');
  assert.throws(() => compileTheaterTiles({ profile: 'ra2', theater: 'URBAN', layers: [layer(simple)] }), /ini-profile-mismatch/);
});

test('layer order and original origins survive while same-layer mapping duplicates fail', () => {
  const first = layer(simple), override = layer('[TileSet0000]\nFileName=mod_\n', 1);
  const a = compileTheaterTiles({ profile: 'yr', theater: 'NEWURBAN', layers: [first, override] });
  const b = compileTheaterTiles({ profile: 'yr', theater: 'NEWURBAN', layers: [override, first] }); assert.deepEqual(a, b);
  const name = a.sets[0]!.fields.find(e => e.key === 'filename')!;
  assert.equal(name.selected.layerId, 'definition-1'); assert.equal(name.shadowed[0]!.layerId, 'definition-0');
  assert.equal(name.selected.rawValue, 'mod_'); assert.equal(name.selected.line, 2);
  assert.equal(a.ini.nativeSemanticsVerified, false);
  error('theater-duplicate-field', () => compile(`${simple}FileName=second\n`));
  error('theater-duplicate-field', () => compile(`${simple}[General]\nClearTile=0\n`));
  error('theater-duplicate-field', () => compileTheaterTiles({ profile: 'yr', theater: 'NEWURBAN', layers: [layer(`${simple}FileName=second\n`), override] }));
});

test('supported decimal-prefix and no-digit count semantics stay visible; remapping and overflow fail', () => {
  const table = compile('[TileSet0000]\nTilesInSet=o\n[TileSet0001]\nTilesInSet=+2trailer\nFileName=fixture\nLastTilesInSet=2\n');
  assert.equal(table.totalTiles, 2); assert.equal(table.sets[0]!.fields[0]!.selected.rawValue, 'o');
  assert.deepEqual(table.diagnostics.map(d => d.code), ['no-digit-count-zero', 'decimal-prefix-count', 'missing-clear-set']);
  assert.equal(resolve(table, 65535).status, 'clear-unavailable');
  for (const count of ['-1', '4097', '999999999999999999999999']) error('theater-count-range', () => compile(simple.replace('TilesInSet=1', `TilesInSet=${count}`)));
  for (const count of ['', '$1', '1h', '一']) error('theater-count-syntax', () => compile(simple.replace('TilesInSet=1', `TilesInSet=${count}`)));
  error('theater-unsupported-last-count-remap', () => compile(`${simple}LastTilesInSet=2\n`));
  error('theater-unsupported-last-count-remap', () => compile(`${simple}LastTilesInSet=0\n`));
  assert.equal(compile(`${simple}LastTilesInSet=-1\n`).totalTiles, 1);
});

test('gaps, ambiguous section spellings, missing fields, clear ranges and unsafe names fail', () => {
  error('theater-set-gap-or-spelling', () => compile(simple.replace('0000', '0001')));
  error('theater-set-gap-or-spelling', () => compile(simple.replace('0000', '0')));
  error('theater-set-gap-or-spelling', () => compile(`${simple}[TileSet0002]\nTilesInSet=0\n`));
  error('theater-missing-field', () => compile(simple.replace('TilesInSet=1\n', '')));
  error('theater-missing-field', () => compile(simple.replace('FileName=original_\n', '')));
  for (const prefix of ['../private', '/absolute', 'folder\\tile', 'bad.name', '']) error('theater-file-prefix', () => compile(simple.replace('original_', prefix)));
  error('theater-clear-set', () => compile(simple.replace('ClearTile=0', 'ClearTile=1')));
  error('theater-clear-set', () => compile(simple.replace('TilesInSet=1', 'TilesInSet=0')));
  const alias = compile(`${simple}[TileSet0001]\nTilesInSet=1\nFileName=ORIGINAL_\n`);
  assert.equal(alias.diagnostics[0]!.code, 'shared-file-prefix'); assert.equal(alias.sets[1]!.firstTile, 1);
});

test('byte/count/output budgets are lowered only and no untrusted lookup table authorizes names', () => {
  error('theater-set-limit', () => compile(simple, { sets: 0 }));
  error('theater-tile-limit', () => compile(simple, { tiles: 0 }));
  error('theater-count-range', () => compile(simple, { tilesPerSet: 0 }));
  assert.throws(() => compile(simple, { inputBytes: 1 }), /ini-byte-limit/);
  error('theater-diagnostic-limit', () => compile(simple.replace('[General]\nClearTile=0\n', ''), { diagnostics: 0 }));
  error('theater-limits', () => compile(simple, Object.defineProperty({}, 'sets', { get: () => 1 })));
  const table = compile(simple);
  error('theater-untrusted-table', () => resolve({ ...table }, 0));
  error('theater-untrusted-table', () => resolve(structuredClone(table), 0));
  for (const value of [-1, -0, 0.5, NaN, 65536]) error('theater-tile-reference', () => resolve(table, value));
  error('theater-tile-reference', () => resolve(table, 0, 256));
  error('theater-input', () => resolveTheaterTile(table, Object.defineProperty({ extraTileWord: 0, subtile: 0 }, 'tileIndex', { get: () => 0 }) as never));
});

test('compiled metadata and results remain detached from caller source mutation', () => {
  const source = layer(simple), table = compileTheaterTiles({ profile: 'yr', theater: 'NEWURBAN', layers: [source] });
  const before = resolve(table, 0); source.bytes.fill(0);
  assert.deepEqual(resolve(table, 0), before);
  assert.throws(() => { (table.sets[0] as { firstTile: number }).firstTile = 900; }, TypeError);
  if (before.status !== 'candidate') assert.fail();
  assert.throws(() => { (before.candidates[0] as { filename: string }).filename = 'changed.ubn'; }, TypeError);
  assert.equal(table.ini.layers[0]!.sourceSha256, '0'.repeat(64)); // Provided identity, not computed verification.
});
