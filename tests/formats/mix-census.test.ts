// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic archive payloads only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { censusInstallation } from '../../tools/analysis/mix-census.ts';
import { hashMixName } from '../../packages/formats/src/mix-names.ts';
function archive(id: number, payload: Uint8Array, checksum = false) {
  const offset = checksum ? 4 : 0, dataOffset = offset + 18;
  const bytes = new Uint8Array(dataOffset + payload.length + (checksum ? 20 : 0)), v = new DataView(bytes.buffer);
  if (checksum) v.setUint32(0, 0x10000, true);
  v.setUint16(offset, 1, true); v.setUint32(offset + 2, payload.length, true);
  v.setUint32(offset + 6, id, true); v.setUint32(offset + 14, payload.length, true); bytes.set(payload, dataOffset);
  if (checksum) bytes.set(createHash('sha1').update(payload).digest(), dataOffset + payload.length);
  return bytes;
}
test('metadata census follows named nested members, hashes bounds and reports checksum disagreement', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'webra2-mix-'));
  try {
    const nested = archive(0x12345678, Uint8Array.of(1, 2, 3));
    const parent = archive(hashMixName('cache.mix'), nested, true);
    await writeFile(join(directory, 'fixture.mix'), parent);
    let census = await censusInstallation(directory);
    assert.equal(census.summary.topLevelArchives, 1); assert.equal(census.summary.totalArchives, 2);
    assert.equal(census.summary.memberRecords, 2); assert.equal(census.summary.checksumPayloadMatches, 1);
    assert.equal(census.archives[1]!.absoluteOffset, 22); assert.equal(census.archives[1]!.identification, 'name-candidate');
    assert.deepEqual(census.failures, []); assert.equal(census.summary.unresolvedRecords, 1);
    parent[parent.length - 1] = parent[parent.length - 1]! ^ 1; await writeFile(join(directory, 'fixture.mix'), parent);
    census = await censusInstallation(directory); assert.equal(census.summary.checksumPayloadMismatches, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('invalid archive and malformed named nested member appear as failures', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'webra2-mix-'));
  try {
    await writeFile(join(directory, 'broken.mix'), new Uint8Array(6));
    await writeFile(join(directory, 'container.mix'), archive(hashMixName('cache.mix'), new Uint8Array(6)));
    const census = await censusInstallation(directory); assert.equal(census.failures.length, 2);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
