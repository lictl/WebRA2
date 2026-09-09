// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic maps and compression streams; no retail terrain or pack data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioTerrain, SCENARIO_TERRAIN_LIMITS, ScenarioTerrainError, type ScenarioTerrainInput } from '../../packages/content/src/scenario-terrain.ts';
const encode = (text: string) => new TextEncoder().encode(text);
const coordinates = [[1, 3], [2, 2], [3, 1], [2, 3], [3, 2], [2, 4], [3, 3], [4, 2], [3, 4], [4, 3]] as const;
function isoRecords(): Uint8Array {
  const raw = new Uint8Array(114), view = new DataView(raw.buffer);
  coordinates.forEach(([x, y], i) => {
    view.setUint16(i * 11, x, true); view.setUint16(i * 11 + 2, y, true);
    view.setUint16(i * 11 + 4, i ? i + 10 : 65535, true); view.setUint16(i * 11 + 6, i === 1 ? 0x1234 : 0, true);
    raw[i * 11 + 8] = i; raw[i * 11 + 9] = i % 3; raw[i * 11 + 10] = i === 2 ? 9 : 0;
  });
  return raw;
}
function pack(raw: Uint8Array, codec: 'lzo' | 'lcw'): Uint8Array {
  const blocks: Buffer[] = [];
  for (let at = 0; at < raw.length; at += 8192) {
    const block = raw.subarray(at, Math.min(raw.length, at + 8192)), stream: number[] = [];
    if (codec === 'lzo') {
      if (block.length <= 238) stream.push(17 + block.length);
      else { let left = block.length - 18; stream.push(0); while (left > 255) { stream.push(0); left -= 255; } stream.push(left); }
      stream.push(...block, 17, 0, 0);
    } else {
      for (let i = 0; i < block.length;) {
        let end = i + 1; while (end < block.length && block[end] === block[i]) end++;
        const length = end - i; stream.push(254, length & 255, length >> 8, block[i]!); i = end;
      }
      stream.push(128);
    }
    const header = Buffer.alloc(4); header.writeUInt16LE(stream.length); header.writeUInt16LE(block.length, 2);
    blocks.push(header, Buffer.from(stream));
  }
  return new Uint8Array(Buffer.concat(blocks));
}
function rows(name: string, packed: Uint8Array, reverse = false): string {
  const data = Buffer.from(packed).toString('base64'), lines: string[] = [];
  for (let at = 0; at < data.length; at += 12) lines.push(`${at / 12 + 1}=${data.slice(at, at + 12)}`);
  if (reverse) lines.reverse(); return `[${name}]\n${lines.join('\n')}\n`;
}
function fixture(options: { iso?: Uint8Array; overlay?: Uint8Array; data?: Uint8Array; reverse?: boolean; metadata?: string } = {}): string {
  const overlay = options.overlay ?? new Uint8Array(512 * 512).fill(255), data = options.data ?? new Uint8Array(512 * 512);
  if (!options.overlay && !options.data) {
    overlay[2 + 512 * 3] = 7; data[2 + 512 * 3] = 11;
    data[1 + 512 * 3] = 17; overlay[511 + 512 * 511] = 8; data[511 + 512 * 511] = 10;
  }
  return (options.metadata ?? '[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,3,2\nLocalSize=1,0,2,2\nTheater=URBAN\n') +
    rows('IsoMapPack5', pack(options.iso ?? isoRecords(), 'lzo'), options.reverse) +
    rows('OverlayPack', pack(overlay, 'lcw'), options.reverse) + rows('OverlayDataPack', pack(data, 'lcw'), options.reverse);
}
function input(text: string, profile: 'ra2' | 'yr' = 'ra2'): ScenarioTerrainInput {
  return { profile, source: { id: 'original-test-map', profile, sha256: 'a'.repeat(64) }, bytes: encode(text) };
}
test('typed diamond records preserve coordinates, both tile words, elevation, ice and all overlay bytes', () => {
  const result = compileScenarioTerrain(input(fixture()));
  assert.equal(result.cells.length, 10); assert.equal(result.policy, 'webra2-terrain-1');
  assert.equal(result.geometryComplete, true); assert.equal(result.assetResolution, 'unresolved'); assert.equal(result.nativeBehaviorVerified, false);
  assert.deepEqual(result.cells.map(c => [c.x, c.y]), coordinates);
  assert.deepEqual(result.cells.map(c => [c.projectedColumn, c.projectedRow]), [[0, 0], [2, 0], [4, 0], [1, 1], [3, 1], [0, 2], [2, 2], [4, 2], [1, 3], [3, 3]]);
  assert.equal(result.cells[0]!.tileIndex, 65535); assert.equal(result.cells[1]!.extraTileWord, 0x1234);
  assert.equal(result.cells[1]!.rawTileIndex, 0x1234000b); assert.equal(result.cells[2]!.iceRaw, 9); assert.equal(result.cells[2]!.elevation, 2);
  assert.deepEqual(result.overlays, [{ x: 1, y: 3, type: 255, data: 17 }, { x: 2, y: 3, type: 7, data: 11 }, { x: 511, y: 511, type: 8, data: 10 }]);
  assert.equal(result.cells[0]!.overlayData, 17); assert.equal(result.cells[3]!.overlayType, 7);
  assert.deepEqual(result.diagnostics.map(d => [d.code, d.count]), [['uninterpreted-tile-extra-word', 1], ['uninterpreted-ice-byte', 1],
    ['unresolved-clear-tile-sentinel', 1], ['overlay-outside-terrain-diamond', 1], ['data-with-empty-overlay', 1]]);
});
test('pack numeric ordering ignores textual row order without losing source-row provenance', () => {
  const normal = compileScenarioTerrain(input(fixture())), reverse = compileScenarioTerrain(input(fixture({ reverse: true }), 'yr'));
  assert.deepEqual(reverse.cells, normal.cells); assert.deepEqual(reverse.overlays, normal.overlays);
  assert.equal(reverse.profile, 'yr'); assert.equal(reverse.source.profile, 'yr');
  assert.ok(reverse.packs[0]!.rows[0]!.line > reverse.packs[0]!.rows[1]!.line);
  assert.deepEqual(reverse.packs[0]!.rows.map(r => r.number), normal.packs[0]!.rows.map(r => r.number));
});
test('geometry and provenance are deeply frozen and source mutation cannot change the result', () => {
  const source = input(fixture()), result = compileScenarioTerrain(source); source.bytes.fill(0);
  for (const item of [result, result.source, result.size, result.localSize, result.metadataLines, result.cells, result.cells[0], result.overlays,
    result.overlays[0], result.packs, result.packs[0], result.packs[0]!.rows, result.packs[0]!.rows[0], result.diagnostics, result.diagnostics[0]]) assert.ok(Object.isFrozen(item));
  assert.throws(() => { (result.cells[0] as { tileIndex: number }).tileIndex = 0; }, TypeError);
  assert.equal(result.cells[0]!.tileIndex, 65535);
  const mismatch = { ...input('\0'), source: { ...source.source, profile: 'yr' as const } };
  assert.throws(() => compileScenarioTerrain(mismatch), /terrain-profile/);
});
test('required metadata, profile-specific source boundaries and unsupported geometry fail explicitly', () => {
  const text = fixture();
  for (const [before, after, code] of [['NewINIFormat=4', 'NewINIFormat=3', 'unsupported-format'], ['NewINIFormat=4', '', 'missing-metadata'],
    ['Theater=URBAN', 'Theater=ß', 'terrain-theater'], ['Size=0,0,3,2', 'Size=1,0,3,2', 'unsupported-origin'],
    ['Size=0,0,3,2', 'Size=0,0,0,2', 'terrain-size'], ['Size=0,0,3,2', 'Size=0,0,257,2', 'terrain-size'],
    ['Size=0,0,3,2', 'Size=0,0,3.0,2', 'terrain-rectangle'], ['LocalSize=1,0,2,2', 'LocalSize=2,0,2,2', 'terrain-local-size'],
    ['Theater=URBAN', 'Theater=URBAN\ntheater=SNOW', 'duplicate-metadata']] as const) assert.throws(() => compileScenarioTerrain(input(text.replace(before, after))), new RegExp(code));
  const unknown = compileScenarioTerrain(input(text.replace('Theater=URBAN', 'Theater=toy_theater')));
  assert.equal(unknown.theater, 'TOY_THEATER'); assert.ok(unknown.diagnostics.some(d => d.code === 'unsupported-theater-assets'));
});
test('pack rows cannot be duplicated, aliased, gapped, absent or hidden by an INI winner', () => {
  const text = fixture(), first = /\[IsoMapPack5\]\n1=([^\n]+)/.exec(text)![1]!;
  for (const [changed, code] of [[text.replace('[IsoMapPack5]\n1=', '[IsoMapPack5]\n01='), 'row-key'],
    [text.replace('[IsoMapPack5]\n1=', '[IsoMapPack5]\n0='), 'row-key'], [text.replace(/\[IsoMapPack5\]\n1=[^\n]+\n/, '[IsoMapPack5]\n'), 'row-gap'],
    [text.replace('[IsoMapPack5]\n', `[IsoMapPack5]\n1=${first}\n`), 'duplicate-pack-row'],
    [text.replace('[IsoMapPack5]', '[IsoMapPack5]\n[IsoMapPack5]'), 'duplicate-pack-section'],
    [text.replace(/\[IsoMapPack5\][\s\S]*?\[OverlayPack\]/, '[OverlayPack]'), 'missing-pack'],
    [text.replace(/\[IsoMapPack5\][\s\S]*?\[OverlayPack\]/, '[IsoMapPack5]\n[OverlayPack]'), 'empty-pack']] as const) assert.throws(() => compileScenarioTerrain(input(changed)), new RegExp(code));
});
test('Base64 alphabet, quartet length, interior padding and noncanonical pad bits reject', () => {
  const text = fixture();
  const replacement = (encoded: string) => text.replace(/\[IsoMapPack5\][\s\S]*?\[OverlayPack\]/, `[IsoMapPack5]\n1=${encoded}\n[OverlayPack]`);
  for (const [encoded, code] of [['AAA', 'base64-length'], ['AAA?', 'base64-character'], ['A=AA', 'base64-character'],
    ['AB==', 'base64-pad-bits'], ['AAB=', 'base64-pad-bits'], ['AAAA====', 'base64-character']] as const) assert.throws(() => compileScenarioTerrain(input(replacement(encoded))), new RegExp(code));
});
test('exact cell count and terminal zero word are required independently of successful decompression', () => {
  const raw = isoRecords(); raw[raw.length - 1] = 1;
  assert.throws(() => compileScenarioTerrain(input(fixture({ iso: raw }))), /terrain-trailer/);
  for (const changed of [isoRecords().slice(0, -4), isoRecords().slice(0, -11), new Uint8Array([...isoRecords(), 0])]) {
    assert.throws(() => compileScenarioTerrain(input(fixture({ iso: changed }))), /terrain-codec:pack-(length-mismatch|output-limit)/);
  }
  assert.throws(() => compileScenarioTerrain(input(fixture({ overlay: new Uint8Array(512 * 512 - 1).fill(255) }))), /terrain-codec:pack-length-mismatch/);
});
test('a one-column diamond includes both even projected rows without inventing odd-row cells', () => {
  const raw = new Uint8Array(26), view = new DataView(raw.buffer);
  for (const i of [0, 1]) { view.setUint16(i * 11, i + 1, true); view.setUint16(i * 11 + 2, i + 1, true); }
  const result = compileScenarioTerrain(input(fixture({ iso: raw, metadata: '[Basic]\nNewINIFormat=4\n[Map]\nSize=0,0,1,2\nLocalSize=0,0,1,2\nTheater=SNOW\n' })));
  assert.deepEqual(result.cells.map(c => [c.x, c.y, c.projectedColumn, c.projectedRow]), [[1, 1, 0, 0], [2, 2, 0, 2]]);
});
test('duplicate and out-of-diamond coordinates cannot be accepted through a matching record count', () => {
  const repeated = isoRecords(); repeated.copyWithin(11, 0, 4);
  assert.throws(() => compileScenarioTerrain(input(fixture({ iso: repeated }))), /terrain-duplicate-cell/);
  for (const [x, y] of [[0, 3], [511, 511], [1, 1], [2, 5], [65535, 3]]) {
    const raw = isoRecords(), view = new DataView(raw.buffer); view.setUint16(0, x!, true); view.setUint16(2, y!, true);
    assert.throws(() => compileScenarioTerrain(input(fixture({ iso: raw }))), (error: unknown) => error instanceof ScenarioTerrainError && error.code === 'terrain-cell-coordinate' && error.record === 0);
  }
});
test('framed pack consumption rejects trailing bytes and an appended empty compression header', () => {
  const text = fixture(), source = pack(isoRecords(), 'lzo');
  for (const suffix of [[0], [0, 0, 0, 0]]) {
    const replacement = rows('IsoMapPack5', new Uint8Array([...source, ...suffix]));
    assert.throws(() => compileScenarioTerrain(input(text.replace(/\[IsoMapPack5\][\s\S]*?\[OverlayPack\]/, `${replacement}[OverlayPack]`))), /terrain-codec:/);
  }
});
test('lower budgets cover source, aggregate encoded/packed rows, cells and all retained overlays', () => {
  const source = input(fixture());
  for (const [options, code] of [[{ inputBytes: source.bytes.length - 1 }, 'ini-byte-limit'], [{ packCharacters: 5 }, 'pack-character-limit'],
    [{ packedBytes: 1 }, 'packed-byte-limit'], [{ packRows: 1 }, 'pack-row-limit'], [{ cells: 9 }, 'cell-limit'],
    [{ overlayRecords: 2 }, 'overlay-record-limit'], [{ diagnostics: 1 }, 'diagnostic-limit'],
    [{ cells: SCENARIO_TERRAIN_LIMITS.cells + 1 }, 'terrain-limits']] as const) assert.throws(() => compileScenarioTerrain(source, options), new RegExp(code));
  // The only retained overlay below is outside the terrain diamond, and still consumes capacity.
  const overlay = new Uint8Array(262144).fill(255); overlay[262143] = 7;
  assert.throws(() => compileScenarioTerrain(input(fixture({ overlay, data: new Uint8Array(262144) })), { overlayRecords: 0 }), /overlay-record-limit/);
});
