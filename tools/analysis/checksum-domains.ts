// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors
// Bounded read-only domain comparisons; emits metadata, never source bytes.
import { open, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readExact, type ByteSource, type MixArchive } from '../../packages/formats/src/mix.ts';
import { inspectMixIntegrity, decideMixImport, type MixDigest } from '../../packages/formats/src/mix-integrity.ts';

const CHUNK_BYTES = 256 * 1024;
interface Range { offset: number; size: number }
interface Baseline { archives: { path: string; size: number; sha256: string }[] }
const digest: MixDigest = async (algorithm, chunks) => {
  const hash = createHash(algorithm); for await (const bytes of chunks) hash.update(bytes); return hash.digest('hex');
};
async function hashRanges(source: ByteSource, ranges: readonly Range[], prefix?: Uint8Array) {
  const hash = createHash('sha1'); if (prefix) hash.update(prefix);
  for (const range of ranges) for (let at = 0; at < range.size; at += CHUNK_BYTES)
    hash.update(await readExact(source, range.offset + at, Math.min(CHUNK_BYTES, range.size - at)));
  return hash.digest('hex');
}
function logicalIndex(mix: MixArchive) {
  const bytes = new Uint8Array(6 + mix.entries.length * 12), view = new DataView(bytes.buffer);
  view.setUint16(0, mix.entries.length, true); view.setUint32(2, mix.dataSize, true);
  for (const e of mix.entries) {
    const at = 6 + e.ordinal * 12; view.setUint32(at, e.id, true); view.setUint32(at + 4, e.offset, true); view.setUint32(at + 8, e.size, true);
  }
  return bytes;
}
export async function compareChecksumDomains(directory: string) {
  const baseline = JSON.parse(await readFile(new URL('../../docs/analysis/mix-census.json', import.meta.url), 'utf8')) as Baseline;
  const results = [];
  for (const name of ['movies01.mix', 'movies02.mix', 'movmd03.mix']) {
    const reference = baseline.archives.find(a => a.path === name);
    if (!reference) throw new Error(`Missing pinned source identity for ${name}`);
    const file = await open(join(resolve(directory), name), 'r');
    try {
      const before = await file.stat({ bigint: true });
      const source: ByteSource = { size: Number(before.size), async read(offset, length) {
        const bytes = new Uint8Array(length); let done = 0;
        while (done < length) { const { bytesRead } = await file.read(bytes, done, length - done, offset + done); if (!bytesRead) break; done += bytesRead; }
        return bytes.subarray(0, done);
      } };
      const report = await inspectMixIntegrity(source, { digest, expectedSource: { size: reference.size, sha256: reference.sha256 }, chunkBytes: CHUNK_BYTES });
      if (report.sourceIdentity.status !== 'verified' || !report.archive || !['verified', 'mismatch'].includes(report.status)) {
        results.push({ source: name, status: report.status, sourceIdentity: report.sourceIdentity }); continue;
      }
      const mix = report.archive;
      const payload = [{ offset: mix.dataOffset, size: mix.dataSize }];
      const physical = [...mix.entries].sort((a, b) => a.offset - b.offset || a.ordinal - b.ordinal);
      const gaps: Range[] = []; let end = 0;
      for (const e of physical) { if (e.offset > end) gaps.push({ offset: mix.dataOffset + end, size: e.offset - end }); end = e.offset + e.size; }
      if (end < mix.dataSize) gaps.push({ offset: mix.dataOffset + end, size: mix.dataSize - end });
      let gapNonzeroBytes = 0;
      for (const range of gaps) for (let at = 0; at < range.size; at += CHUNK_BYTES)
        for (const value of await readExact(source, range.offset + at, Math.min(CHUNK_BYTES, range.size - at))) if (value !== 0) gapNonzeroBytes++;
      let binkMembers = 0;
      const binkLengthMismatches = [];
      for (const e of mix.entries) {
        const bytes = await readExact(source, mix.dataOffset + e.offset, Math.min(8, e.size));
        if (bytes.length === 8 && bytes[0] === 66 && bytes[1] === 73 && bytes[2] === 75) {
          binkMembers++;
          const declaredBytes = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) + 8;
          if (declaredBytes !== e.size) binkLengthMismatches.push({ ordinal: e.ordinal, id: e.id, memberSize: e.size, declaredBytes });
        }
      }
      const rangeFor = (e: { offset: number; size: number }) => ({ offset: mix.dataOffset + e.offset, size: e.size });
      const domains = [
        { domain: 'declared-payload', sha1: report.actualSha1!, bytes: mix.dataSize },
        { domain: 'file-before-trailer', sha1: await hashRanges(source, [{ offset: 0, size: mix.checksum.offset! }]), bytes: mix.checksum.offset! },
        { domain: 'members-in-physical-order', sha1: await hashRanges(source, physical.map(rangeFor)), bytes: physical.reduce((sum, e) => sum + e.size, 0) },
        { domain: 'members-in-index-order', sha1: await hashRanges(source, mix.entries.map(rangeFor)), bytes: mix.entries.reduce((sum, e) => sum + e.size, 0) },
        { domain: 'logical-index-then-payload', sha1: await hashRanges(source, payload, logicalIndex(mix)), bytes: 6 + mix.entries.length * 12 + mix.dataSize },
      ].map(row => ({ ...row, matchesStored: row.sha1 === report.expectedSha1 }));
      const stored = Buffer.from(report.expectedSha1!, 'hex');
      const swappedWords = Buffer.from(stored); swappedWords.swap32();
      const after = await file.stat({ bigint: true });
      if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs)
        throw new Error('Source changed during checksum comparison; discard this run');
      results.push({ source: name, size: source.size, sourceIdentity: report.sourceIdentity,
        format: mix.format, flags: mix.flags, dataOffset: mix.dataOffset, dataSize: mix.dataSize,
        memberCount: mix.entries.length, checksumOffset: mix.checksum.offset, expectedSha1: report.expectedSha1,
        checksumStatus: report.status, importPolicy: { tolerant: decideMixImport(report, 'tolerant'), strict: decideMixImport(report, 'strict') },
        gaps: { count: gaps.length, bytes: gaps.reduce((sum, gap) => sum + gap.size, 0), nonzeroBytes: gapNonzeroBytes },
        binkMembers, binkLengthMismatches, domains,
        payloadMatchesReversedTrailer: report.actualSha1 === Buffer.from(stored).reverse().toString('hex'),
        payloadMatchesWordSwappedTrailer: report.actualSha1 === swappedWords.toString('hex') });
    } finally { await file.close(); }
  }
  return { schemaVersion: 1, scope: 'Two mismatched movie archives and one checksum-matching control; source identity pinned to M0 census',
    chunkBytes: CHUNK_BYTES, sourcePolicy: 'Read-only; source identity failures stop domain comparisons',
    nativeCause: 'unresolved', results };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error('Usage: node --import tsx tools/analysis/checksum-domains.ts /path/to/game');
  const result = await compareChecksumDomains(process.argv[2]);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.results.some(row => 'status' in row)) process.exitCode = 1;
}
