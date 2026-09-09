// SPDX-License-Identifier: GPL-3.0-or-later
// Metadata only. Node filesystem/crypto adapter stays outside browser format code.
import { open, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { type ByteSource, readExact, readMix, mixMemberSource, type MixArchive } from '../../packages/formats/src/mix.ts';
import { MixNameResolver, hashMixName, readXccLocalNames } from '../../packages/formats/src/mix-names.ts';

export const CENSUS_LIMITS = Object.freeze({ depth: 4, archives: 512, entries: 250_000, databaseBytes: 4 * 1024 * 1024, chunkBytes: 1024 * 1024 });
export interface CensusMember {
  ordinal: number; id: number; idHex: string; offset: number; size: number;
  names: ReturnType<MixNameResolver['resolve']>; signature?: string;
}
export interface CensusArchive {
  path: string; rootFile: string; absoluteOffset: number; size: number; sha256: string;
  identification: 'extension' | 'name-candidate' | 'structural-probe';
  format: MixArchive['format']; flags: number; dataOffset: number; dataSize: number;
  checksum: MixArchive['checksum'] & { payloadSha1?: string; payloadMatch?: boolean };
  trailingBytes: number; diagnostics: MixArchive['diagnostics']; members: CensusMember[];
}
function seedNames(): string[] {
  const names = ['local mix database.dat', 'rules.ini', 'rulesmd.ini', 'art.ini', 'artmd.ini', 'ai.ini', 'aimd.ini', 'battle.ini', 'battlemd.ini', 'ra2.csf', 'ra2md.csf', 'theme.ini', 'thememd.ini', 'missions.ini', 'missionsmd.ini'];
  for (const stem of ['cache','cameo','conquer','generic','isosnow','isotemp','isourb','isourbann','isodes','isolun','isotem','isosno','isoubn','isodesert','isolunar','isourban','local','language','audio','sounds','snow','temperat','urban','urbann','desert','lunar','expand','maps','movies'])
    for (const suffix of ['', 'md']) names.push(`${stem}${suffix}.mix`);
  for (const faction of ['all', 'sov']) for (let n = 1; n <= 20; n++) for (const suffix of ['t', 's', 'u', 'umd', 'smd', 'tmd', 'md', 'a', 'b'])
    names.push(`${faction}${String(n).padStart(2, '0')}${suffix}.map`);
  return names;
}
async function digest(source: ByteSource, algorithm: 'sha1' | 'sha256', offset = 0, length = source.size): Promise<string> {
  const hash = createHash(algorithm);
  for (let done = 0; done < length; done += CENSUS_LIMITS.chunkBytes)
    hash.update(await readExact(source, offset + done, Math.min(CENSUS_LIMITS.chunkBytes, length - done)));
  return hash.digest('hex');
}
function signature(bytes: Uint8Array): string | undefined {
  const ascii = String.fromCharCode(...bytes.slice(0, 4));
  if (ascii.length === 4 && ascii.startsWith('BIK')) return `bink:${bytes[3]!.toString(16)}`;
  if (ascii === 'RIFF') return 'riff';
  if (ascii === ' FSC') return 'csf';
  return undefined;
}
export async function censusInstallation(directory: string) {
  const root = resolve(directory);
  const files = (await readdir(root, { withFileTypes: true })).filter(e => e.isFile()).map(e => e.name).sort();
  const resolver = new MixNameResolver(seedNames().map(name => ({ name, source: 'generated-format-candidates-v1' })));
  for (const name of files) if (/^[\x20-\x7e]{1,255}$/.test(name)) resolver.add({ name, source: 'installation-filename' });
  const candidateSources: { file: string; size: number; sha256?: string; status: string }[] = [];
  // Bounded read-only filename references from the optional source executables.
  // Only recognizable ASCII filenames become metadata; no listings or arbitrary
  // strings are retained. Assets-only installations simply omit these candidates.
  for (const name of files.filter(name => /^(game|gamemd)\.exe$/i.test(name))) {
    const file = await open(join(root, name), 'r');
    try {
      const size = (await file.stat()).size;
      if (size > 8 * CENSUS_LIMITS.chunkBytes) { candidateSources.push({ file: name, size, status: 'skipped-size-cap' }); continue; }
      let tail = ''; const sourceHash = createHash('sha256');
      for (let position = 0; position < size; position += CENSUS_LIMITS.chunkBytes) {
        const bytes = new Uint8Array(Math.min(CENSUS_LIMITS.chunkBytes, size - position));
        const { bytesRead } = await file.read(bytes, 0, bytes.length, position);
        if (bytesRead !== bytes.length) throw new Error(`Short executable reference read: ${name}`);
        sourceHash.update(bytes);
        const text = tail + Buffer.from(bytes).toString('latin1');
        for (const match of text.matchAll(/(?<![A-Za-z0-9_.-])[A-Za-z0-9_][A-Za-z0-9_-]{0,63}\.(?:mix|ini|csf|map|bik|pal|shp|vxl|hva|tmp|aud|wav|pcx)(?![A-Za-z0-9_.-])/gi))
          resolver.add({ name: match[0], source: `${name}:static-filename-reference` });
        tail = text.slice(-80);
      }
      candidateSources.push({ file: name, size, sha256: sourceHash.digest('hex'), status: 'static-filename-references' });
    } finally { await file.close(); }
  }
  const archives: CensusArchive[] = [];
  const failures: { path: string; error: string }[] = [];
  const limitations: { path: string; reason: string }[] = [];
  let entryCount = 0;
  async function visit(source: ByteSource, path: string, rootFile: string, absoluteOffset: number, depth: number, identification: CensusArchive['identification'], parsed?: MixArchive): Promise<void> {
    if (archives.length >= CENSUS_LIMITS.archives) throw new Error('Census archive cap exceeded');
    const mix = parsed ?? await readMix(source);
    entryCount += mix.entries.length;
    if (entryCount > CENSUS_LIMITS.entries) throw new Error('Census entry cap exceeded');
    const checksum: CensusArchive['checksum'] = { ...mix.checksum };
    if (checksum.status === 'unverified') {
      checksum.payloadSha1 = await digest(source, 'sha1', mix.dataOffset, mix.dataSize);
      checksum.payloadMatch = checksum.payloadSha1 === checksum.expectedSha1;
    }
    const row: CensusArchive = { path, rootFile, absoluteOffset, size: source.size, sha256: await digest(source, 'sha256'), identification,
      format: mix.format, flags: mix.flags, dataOffset: mix.dataOffset, dataSize: mix.dataSize, checksum,
      trailingBytes: mix.trailingBytes, diagnostics: mix.diagnostics, members: [] };
    archives.push(row);
    for (const entry of mix.entries) {
      if (![hashMixName('local mix database.dat', 'classic'), hashMixName('local mix database.dat', 'crc32')].includes(entry.id)) continue;
      if (entry.size > CENSUS_LIMITS.databaseBytes) { limitations.push({ path, reason: 'XCC database byte cap' }); continue; }
      try {
        for (const name of readXccLocalNames(await readExact(mixMemberSource(source, mix, entry), 0, entry.size)))
          resolver.add({ name, source: `${path}#${entry.ordinal}:xcc-local-database` });
      } catch (error) { limitations.push({ path, reason: `XCC database rejected: ${String(error)}` }); }
    }
    for (const entry of mix.entries) {
      const memberSource = mixMemberSource(source, mix, entry);
      const head = await readExact(memberSource, 0, Math.min(10, entry.size));
      const member: CensusMember = { ...entry, idHex: entry.id.toString(16).padStart(8, '0'), names: resolver.resolve(entry.id) };
      const kind = signature(head); if (kind) member.signature = kind;
      row.members.push(member);
      const names = member.names.filter(n => /\.(mix|mmx|yro)$/i.test(n.name));
      const memberPath = `${path}/#${entry.ordinal}:${member.idHex}`;
      if (!names.length && (entry.size < 6 || kind)) continue;
      // Unknown files have no reliable MIX magic. A successful bounded parse with
      // exact declared length is evidence of structure, not a resolved filename.
      let nested: MixArchive;
      try { nested = await readMix(memberSource); }
      catch (error) { if (names.length) failures.push({ path: memberPath, error: String(error) }); continue; }
      if (!names.length && (nested.trailingBytes !== 0 || nested.entries.length === 0 || nested.diagnostics.length)) continue;
      if (depth >= CENSUS_LIMITS.depth) { limitations.push({ path: memberPath, reason: 'Nested archive depth cap' }); continue; }
      try { await visit(memberSource, memberPath, rootFile, absoluteOffset + mix.dataOffset + entry.offset, depth + 1, names.length ? 'name-candidate' : 'structural-probe', nested); }
      catch (error) { failures.push({ path: memberPath, error: String(error) }); }
    }
  }
  for (const name of files.filter(name => /\.(mix|mmx|yro)$/i.test(name))) {
    const file = await open(join(root, name), 'r');
    try {
      const size = (await file.stat()).size;
      const source: ByteSource = { size, async read(offset, length) {
        const bytes = new Uint8Array(length); let done = 0;
        while (done < length) { const { bytesRead } = await file.read(bytes, done, length - done, offset + done); if (!bytesRead) break; done += bytesRead; }
        return bytes.subarray(0, done);
      } };
      await visit(source, name, name, 0, 0, 'extension');
    } catch (error) { failures.push({ path: name, error: String(error) }); }
    finally { await file.close(); }
  }
  // Local databases encountered later can resolve IDs in earlier archives.
  for (const archive of archives) for (const member of archive.members) member.names = resolver.resolve(member.id);
  const members = archives.flatMap(a => a.members);
  return { schemaVersion: 1, source: 'owner-supplied Steam installation; exact build unverified', limits: CENSUS_LIMITS,
    summary: { topLevelArchives: archives.filter(a => a.identification === 'extension').length, totalArchives: archives.length,
      encryptedArchives: archives.filter(a => a.format === 'encrypted').length, memberRecords: members.length,
      unresolvedRecords: members.filter(m => !m.names.length).length,
      ambiguousRecords: members.filter(m => new Set(m.names.map(n => n.name.toUpperCase())).size > 1).length,
      binkSignatureRecords: members.filter(m => m.signature?.startsWith('bink:')).length,
      checksumPayloadMatches: archives.filter(a => a.checksum.payloadMatch === true).length,
      checksumPayloadMismatches: archives.filter(a => a.checksum.payloadMatch === false).length },
    candidateSources, archives, failures, limitations,
    interpretation: ['Names are hash candidates with provenance; unknown names remain numeric IDs.', 'No mount precedence, patch identity, campaign completeness or runtime behavior is inferred.', 'Structural-probe archives need confirmation; checksum payload match is reported separately from unverified format status.', 'Nested archive hashes overlap their parent payloads; sizes must not be summed as installation size.'] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const directory = process.argv[2];
  if (!directory) throw new Error('Usage: node --import tsx tools/analysis/mix-census.ts /path/to/game');
  const result = await censusInstallation(directory);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.failures.length) process.exitCode = 1;
}
