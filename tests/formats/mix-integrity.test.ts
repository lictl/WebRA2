// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors
// Original synthetic content only; no retail bytes or hashes are needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { memorySource, type ByteSource } from '../../packages/formats/src/mix.ts';
import { decideMixImport, inspectMixIntegrity, type MixDigest, type MixIntegrityReport } from '../../packages/formats/src/mix-integrity.ts';

const digest: MixDigest = async (algorithm, chunks) => {
  const hash = createHash(algorithm); for await (const chunk of chunks) hash.update(chunk); return hash.digest('hex');
};
function fixture(checksum = true, payload = Uint8Array.of(1, 2, 3, 4)) {
  const offset = checksum ? 4 : 0, dataOffset = offset + 18;
  const bytes = new Uint8Array(dataOffset + payload.length + (checksum ? 20 : 0));
  const view = new DataView(bytes.buffer);
  if (checksum) view.setUint32(0, 0x10000, true);
  view.setUint16(offset, 1, true); view.setUint32(offset + 2, payload.length, true);
  view.setUint32(offset + 6, 0x12345678, true); view.setUint32(offset + 14, payload.length, true);
  bytes.set(payload, dataOffset);
  if (checksum) bytes.set(createHash('sha1').update(payload).digest(), dataOffset + payload.length);
  return bytes;
}
const fingerprint = (bytes: Uint8Array) => ({ size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });

test('checksum states distinguish absent, unverified, verified and mismatched bytes', async () => {
  assert.equal((await inspectMixIntegrity(memorySource(fixture(false)), { digest })).status, 'no-checksum');
  assert.equal((await inspectMixIntegrity(memorySource(fixture()))).status, 'unverified');
  assert.equal((await inspectMixIntegrity(memorySource(fixture()), { digest, verifyChecksum: false })).status, 'unverified');
  const report = await inspectMixIntegrity(memorySource(fixture()), { digest });
  assert.equal(report.status, 'verified'); assert.equal(report.actualSha1, '12dada1fff4d4787ade3333147202c3b443e376f');
  const changed = fixture(); changed[22] = 99;
  const mismatch = await inspectMixIntegrity(memorySource(changed), { digest });
  assert.equal(mismatch.status, 'mismatch'); assert.notEqual(mismatch.actualSha1, mismatch.expectedSha1);
});
test('strict enforces advertised checksums; tolerant warns on incomplete or mismatched checksums', async () => {
  const verified = await inspectMixIntegrity(memorySource(fixture()), { digest });
  for (const policy of ['strict', 'tolerant'] as const) {
    assert.equal(decideMixImport(verified, policy).allow, true);
    const absent = decideMixImport(await inspectMixIntegrity(memorySource(fixture(false))), policy);
    assert.equal(absent.allow, true); assert.deepEqual(absent.warnings, ['checksum-absent']);
  }
  const changed = fixture(); changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
  for (const report of [await inspectMixIntegrity(memorySource(fixture())), await inspectMixIntegrity(memorySource(changed), { digest })]) {
    assert.equal(decideMixImport(report, 'strict').allow, false);
    assert.equal(decideMixImport(report, 'tolerant').allow, true);
    assert.equal(decideMixImport(report, 'tolerant').warnings.length, 1);
  }
});
test('both policies reject invalid ranges, missing trailer, trailing data and ambiguous index layout', async () => {
  const overlap = new Uint8Array(34), v = new DataView(overlap.buffer);
  v.setUint16(0, 2, true); v.setUint32(2, 4, true);
  for (const at of [6, 18]) { v.setUint32(at, 1, true); v.setUint32(at + 8, 4, true); }
  const trailing = new Uint8Array(fixture().length + 1); trailing.set(fixture());
  for (const bytes of [new Uint8Array(2), fixture().slice(0, -1), trailing, overlap]) {
    const report = await inspectMixIntegrity(memorySource(bytes), { digest });
    assert.equal(report.status, 'structural-failure');
    for (const policy of ['strict', 'tolerant'] as const) assert.equal(decideMixImport(report, policy).allow, false);
  }
});
test('expected full-source identity distinguishes same-size changes from payload checksum agreement', async () => {
  const bytes = fixture(), expected = fingerprint(bytes);
  const good = await inspectMixIntegrity(memorySource(bytes), { digest, expectedSource: expected });
  assert.equal(good.status, 'verified'); assert.equal(good.sourceIdentity.status, 'verified');
  // Change only the indexed filename ID, outside the payload checksum domain.
  const changed = bytes.slice(); changed[10] = changed[10]! ^ 1;
  assert.equal((await inspectMixIntegrity(memorySource(changed), { digest })).status, 'verified');
  const mismatch = await inspectMixIntegrity(memorySource(changed), { digest, expectedSource: expected });
  assert.equal(mismatch.status, 'source-identity-failure');
  assert.equal(mismatch.sourceIdentity.status === 'failed' && mismatch.sourceIdentity.reason, 'hash-mismatch');
  for (const policy of ['strict', 'tolerant'] as const) assert.equal(decideMixImport(mismatch, policy).allow, false);
});
test('pinned identity rejects unavailable digest, different size and digest errors', async () => {
  const bytes = fixture(), expected = fingerprint(bytes);
  for (const options of [{ expectedSource: expected }, { digest, expectedSource: { ...expected, size: expected.size + 1 } },
    { digest: async () => { throw new Error('backend unavailable'); }, expectedSource: expected }]) {
    const report = await inspectMixIntegrity(memorySource(bytes), options);
    assert.equal(report.status, 'source-identity-failure'); assert.equal(decideMixImport(report, 'tolerant').allow, false);
  }
});
test('bounded digest chunks cover payload exactly, including zero-length payload', async () => {
  const calls: number[] = [];
  const recording: MixDigest = async (algorithm, chunks) => {
    const hash = createHash(algorithm); for await (const chunk of chunks) { calls.push(chunk.length); hash.update(chunk); } return hash.digest('hex');
  };
  const bytes = fixture(true, new Uint8Array(37));
  assert.equal((await inspectMixIntegrity(memorySource(bytes), { digest: recording, chunkBytes: 8 })).status, 'verified');
  assert.deepEqual(calls, [8, 8, 8, 8, 5]);
  assert.equal((await inspectMixIntegrity(memorySource(fixture(true, new Uint8Array(0))), { digest })).status, 'verified');
});
test('digest errors, short reads, incomplete consumption and malformed digest results never permit import', async () => {
  const bytes = fixture();
  const partial: ByteSource = { size: bytes.length, async read(offset, length) {
    return offset === 22 ? new Uint8Array(0) : bytes.slice(offset, offset + length);
  } };
  const incomplete: MixDigest = async () => '0'.repeat(40);
  const malformed: MixDigest = async (_, chunks) => { for await (const chunk of chunks) void chunk; return 'invalid'; };
  for (const report of [await inspectMixIntegrity(partial, { digest }), await inspectMixIntegrity(memorySource(bytes), { digest: incomplete }),
    await inspectMixIntegrity(memorySource(bytes), { digest: malformed })]) {
    assert.equal(report.status, 'verification-failure'); assert.equal(decideMixImport(report, 'tolerant').allow, false);
  }
});
test('parser caps run before expensive source hashing and malformed policy options reject', async () => {
  let digests = 0; const bytes = fixture();
  const report = await inspectMixIntegrity(memorySource(bytes), { digest: async () => { digests++; return ''; }, expectedSource: fingerprint(bytes), limits: { maxArchiveBytes: 1 } });
  assert.equal(report.status, 'structural-failure'); assert.equal(digests, 0);
  for (const chunkBytes of [0, -1, 0.5, NaN, 1024 * 1024 + 1]) await assert.rejects(inspectMixIntegrity(memorySource(bytes), { chunkBytes }), /Digest chunks/);
  await assert.rejects(inspectMixIntegrity(memorySource(bytes), { expectedSource: { size: 1, sha256: 'bad' } }), /fingerprint/);
  assert.throws(() => decideMixImport(report, 'unknown' as 'strict'), /Unknown MIX import policy/);
});
test('policy cannot accidentally accept a recomposed report with failed pinned identity', () => {
  const report: MixIntegrityReport = { status: 'verified', sourceIdentity: { status: 'failed', reason: 'size-mismatch', expected: { size: 1, sha256: '0'.repeat(64) }, actualSize: 2 } };
  assert.equal(decideMixImport(report, 'tolerant').allow, false);
});
test('an in-flight caller mutation cannot replace the expected source identity', async () => {
  const bytes = fixture(), actual = fingerprint(bytes);
  const expected = { ...actual, sha256: '0'.repeat(64) };
  const pending = inspectMixIntegrity(memorySource(bytes), { digest, expectedSource: expected });
  expected.sha256 = actual.sha256;
  const report = await pending;
  assert.equal(report.status, 'source-identity-failure');
  assert.equal(report.sourceIdentity.status === 'failed' && report.sourceIdentity.expected.sha256, '0'.repeat(64));
});
