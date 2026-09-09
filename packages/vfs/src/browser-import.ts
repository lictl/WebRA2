// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Uses GPL MIX/name/integrity components; see docs/browser-import.md.
import { MixError, assertRange, readExact, mixMemberSource, type ByteSource } from '../../formats/src/mix.ts';
import { inspectMixIntegrity, decideMixImport } from '../../formats/src/mix-integrity.ts';
import { MixNameResolver, hashMixName, readXccLocalNames } from '../../formats/src/mix-names.ts';
import { normalizeAssetPath } from './profile.ts';
import { createBrowserByteSource, BrowserSourceError, throwIfImportAborted } from './browser-source.ts';
import { yieldBrowserTask } from './browser-yield.ts';
import type { BrowserImportArchive, BrowserImportDiagnostic, BrowserImportFile, BrowserImportMember, BrowserImportOptions, BrowserImportReport, BrowserImportRequirement, BrowserProfileStatus, ImportProgress } from './browser-types.ts';

export const BROWSER_IMPORT_LIMITS = Object.freeze({ files: 4096, archives: 512, members: 250_000,
  entriesPerArchive: 8192, depth: 4, readBytes: 64 * 1024 * 1024, databaseBytes: 1024 * 1024,
  databaseNames: 8192, nameCandidates: 10_000, namesPerMember: 16, diagnostics: 4096 });
const identity = Object.freeze({ status: 'unverified' as const, sha256: null });
const archiveExtension = /\.(mix|mmx|yro)$/;
const looseExtension = /\.(ini|map|mpr|csf|shp|pal|fnt|aud|wav|bik|vxl|hva|tmp|pcx|bag|idx)$/;
const profileFiles = {
  ra2: ['rules.ini', 'art.ini', 'ai.ini', 'battle.ini', 'mapsel.ini', 'mission.ini', 'sound.ini', 'ra2.csf', 'game.fnt', 'all01t.map'],
  yr: ['rulesmd.ini', 'artmd.ini', 'aimd.ini', 'battlemd.ini', 'mapselmd.ini', 'missionmd.ini', 'soundmd.ini', 'ra2md.csf', 'game.fnt', 'all01umd.map'],
} as const;
const sharedArchiveNames = new Set(['ra2.mix', 'language.mix', 'local.mix', 'cache.mix', 'audio.mix', 'sounds.mix', 'conquer.mix', 'generic.mix', 'cameo.mix', 'temperat.mix', 'snow.mix', 'urban.mix', 'urbann.mix', 'desert.mix', 'lunar.mix', 'isotemp.mix', 'isosnow.mix', 'isourb.mix', 'isoubn.mix', 'isodes.mix', 'isolun.mix', 'isotem.mix', 'isosno.mix']);
const yrArchiveNames = new Set(['ra2md.mix', 'langmd.mix', 'localmd.mix', 'cachemd.mix', 'audiomd.mix', 'soundsmd.mix', 'conquermd.mix', 'genericmd.mix', 'cameomd.mix', 'temperatmd.mix', 'snowmd.mix', 'urbanmd.mix', 'urbannmd.mix', 'desertmd.mix', 'lunarmd.mix', 'isotempmd.mix', 'isosnowmd.mix', 'isourbmd.mix', 'isoubnmd.mix', 'isodesmd.mix', 'isolunmd.mix']);
function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function seedNames(): string[] {
  const names = ['local mix database.dat', ...profileFiles.ra2, ...profileFiles.yr, ...sharedArchiveNames, ...yrArchiveNames,
    'sound.ini', 'soundmd.ini', 'theme.ini', 'thememd.ini', 'mission.ini', 'missionmd.ini', 'glslmd.shp', 'glssmd.shp', 'glsmd.pal'];
  for (const faction of ['all', 'sov']) for (let n = 1; n <= 20; n++) for (const suffix of ['t', 's', 'u', 'umd', 'smd', 'tmd', 'md', 'a', 'b'])
    names.push(`${faction}${String(n).padStart(2, '0')}${suffix}.map`);
  for (let n = 0; n <= 99; n++) for (const prefix of ['expand', 'expandmd', 'maps', 'mapsmd', 'movies', 'movmd']) names.push(`${prefix}${String(n).padStart(2, '0')}.mix`);
  return [...new Set(names)].sort(compare);
}
/** A conservative inspection eligibility policy; no native mount ranks or content winners. */
export function classifyBrowserAssetScope(path: string, profile: BrowserImportOptions['profile'], archive: boolean): BrowserProfileStatus {
  if (path.includes('/')) return 'unassigned';
  const yr = yrArchiveNames.has(path) || /^(expandmd|ecachemd|elocalmd|mapsmd|movmd|moviesmd)\d{2}\.mix$/.test(path) ||
    /^(rules|art|ai|battle|mapsel|sound|theme|mission)md\.ini$/.test(path) || path === 'ra2md.csf' || /^(all|sov)\d{2}(u|s|t)?md\.map$/.test(path) || path.endsWith('.yro');
  const ra2 = /^(expand|ecache|elocal)\d{2}\.mix$/.test(path) ||
    /^(rules|art|ai|battle|mapsel|sound|theme|mission)\.ini$/.test(path) || path === 'ra2.csf' || /^(all|sov)\d{2}[tsuab]\.map$/.test(path);
  if (yr) return profile === 'yr' ? 'eligible' : 'excluded';
  if (ra2) return profile === 'ra2' ? 'eligible' : 'excluded';
  if (!archive || sharedArchiveNames.has(path) || /^(maps|movies)\d{2}\.mix$/.test(path)) return 'eligible';
  return 'unassigned';
}
function combinedScope(parent: BrowserProfileStatus, names: readonly string[], profile: BrowserImportOptions['profile']): BrowserProfileStatus {
  if (parent !== 'eligible') return parent;
  if (!names.length) return parent; // Numeric member inherits the chosen archive scope, without a resolved filename.
  const scopes = names.map(name => classifyBrowserAssetScope(name, profile, archiveExtension.test(name)));
  return scopes.every(value => value === 'excluded') ? 'excluded' : scopes.some(value => value === 'eligible') ? 'eligible' : 'unassigned';
}
function isKnownNonArchive(bytes: Uint8Array): boolean {
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  return magic === ' FSC' || magic === 'RIFF' || magic === 'fonT' || magic === 'FoNt' || /^BIK.$/.test(magic);
}

/** Index-only, on-device inspection. Cancellation rejects AbortError; no payload/handles escape. */
export async function inspectInstallation(input: readonly File[], options: BrowserImportOptions): Promise<BrowserImportReport> {
  if (!options || (options.profile !== 'ra2' && options.profile !== 'yr') || (options.policy !== 'tolerant' && options.policy !== 'strict')) throw new TypeError('browser-import-options');
  if (!Array.isArray(input) || input.length > BROWSER_IMPORT_LIMITS.files) throw new RangeError('browser-file-limit');
  for (let i = 0; i < input.length; i++) if (!Object.hasOwn(input, i) || !(input[i] instanceof File)) throw new TypeError('browser-file-type');
  const profile = options.profile, policy = options.policy, signal = options.signal, onProgress = options.onProgress;
  throwIfImportAborted(signal);
  const selections = [...input];
  const files: BrowserImportFile[] = [], archives: BrowserImportArchive[] = [], diagnostics: BrowserImportDiagnostic[] = [];
  const handles = new Map<string, ByteSource>();
  let bytesRead = 0, reservedBytes = 0, members = 0, filesProcessed = 0, limited = false, readLimit = false;
  let lastYield = performance.now(), steps = 0;
  const resolver = new MixNameResolver(seedNames().map(name => ({ name, source: 'webra2-standard-filename-candidates-v1' })), BROWSER_IMPORT_LIMITS.nameCandidates);
  function diagnostic(item: BrowserImportDiagnostic): void {
    if (diagnostics.length < BROWSER_IMPORT_LIMITS.diagnostics - 1) diagnostics.push(item);
    else if (diagnostics.length < BROWSER_IMPORT_LIMITS.diagnostics) { limited = true; diagnostics.push({ code: 'diagnostic-limit', severity: 'error' }); }
  }
  function guard(): void { throwIfImportAborted(signal); if (readLimit) throw new BrowserSourceError('browser-read-budget'); }
  function progress(phase: ImportProgress['phase'], currentPath?: string): void {
    guard(); onProgress?.(Object.freeze({ phase, filesProcessed, totalFiles: selections.length, archives: archives.length, members, bytesRead, ...(currentPath ? { currentPath } : {}) })); guard();
  }
  async function checkpoint(phase: ImportProgress['phase'], path?: string, force = false): Promise<void> {
    guard();
    if (force || ++steps >= 32 || performance.now() - lastYield >= 8) {
      progress(phase, path); await yieldBrowserTask(signal); guard(); steps = 0; lastYield = performance.now();
    }
  }
  const normalized = selections.map((file, i) => {
    try { return normalizeAssetPath(file.webkitRelativePath || file.name); }
    catch { diagnostic({ code: 'unsafe-file-path', severity: 'error', sourceId: `file:${i}` }); return null; }
  });
  const validPaths = normalized.filter((path): path is string => path !== null);
  const firstFolder = validPaths[0]?.split('/')[0];
  const stripFolder = firstFolder && validPaths.every(path => path.includes('/') && path.split('/')[0] === firstFolder) ? `${firstFolder}/` : '';
  const paths = normalized.map(path => path && stripFolder ? path.slice(stripFolder.length) : path);
  const pathCounts = new Map<string, number>();
  for (const path of paths) if (path) pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1);
  for (const [i, file] of selections.entries()) {
    const path = paths[i], id = `file:${i}`;
    let kind: BrowserImportFile['kind'] = path && archiveExtension.test(path) ? 'archive' : path && looseExtension.test(path) ? 'loose' : path && /\.(exe|dll|com|bat|cmd|scr)$/i.test(path) ? 'program' : 'unsupported';
    let status: BrowserImportFile['status'] = 'accepted';
    const profileStatus = path ? classifyBrowserAssetScope(path, profile, kind === 'archive') : 'unassigned';
    if (!path) status = 'invalid';
    else if ((pathCounts.get(path) ?? 0) > 1) { status = 'duplicate'; diagnostic({ code: 'duplicate-file-path', severity: 'error', sourceId: id, path }); }
    else if (profileStatus === 'excluded' || kind === 'program' || kind === 'unsupported') {
      status = 'ignored'; diagnostic({ code: profileStatus === 'excluded' ? 'excluded-profile' : kind === 'program' ? 'program-not-required' : 'unsupported-file-type', severity: 'info', sourceId: id, path });
    } else if (profileStatus === 'unassigned') diagnostic({ code: 'unassigned-content-scope', severity: 'warning', sourceId: id, path });
    files.push({ id, path: path ?? `invalid-selection-${i}`, size: file.size, kind, status, profileStatus, identity });
    if (status === 'accepted') {
      handles.set(id, createBrowserByteSource(file, { ...(signal ? { signal } : {}), beforeRead(length) {
        guard(); if (length > BROWSER_IMPORT_LIMITS.readBytes - reservedBytes) { readLimit = true; throw new BrowserSourceError('browser-read-budget'); } reservedBytes += length;
      }, onRead(length) { bytesRead += length; } }));
      if (path && /^[\x20-\x7e]{1,255}$/.test(path)) resolver.add({ name: path, source: `selected-file:${id}` });
    }
    await checkpoint('validate', path ?? undefined);
  }
  await checkpoint('archives', undefined, true);
  const databaseIds = new Set(['classic', 'crc32'].map(kind => hashMixName('local mix database.dat', kind as 'classic' | 'crc32')));
  async function visit(source: ByteSource, file: BrowserImportFile, parentId: string | null, offset: number, depth: number, names: readonly string[], identification: BrowserImportArchive['identification'], ancestorAllowed = true): Promise<void> {
    guard();
    if (archives.length >= BROWSER_IMPORT_LIMITS.archives) { limited = true; diagnostic({ code: 'archive-limit', severity: 'error', sourceId: file.id }); return; }
    const inspected = await inspectMixIntegrity(source, { verifyChecksum: false, limits: { maxEntries: Math.min(BROWSER_IMPORT_LIMITS.entriesPerArchive, BROWSER_IMPORT_LIMITS.members - members) } });
    guard();
    const mix = inspected.archive;
    const known = identification !== 'structural-probe';
    if (!known && (!mix || inspected.status === 'structural-failure' || mix.entries.length === 0)) return;
    const id = `${file.id}/archive:${offset}:${source.size}`;
    const profileStatus = combinedScope(file.profileStatus, names, profile);
    const decision = decideMixImport(inspected, policy);
    const records: BrowserImportMember[] = [];
    const row: BrowserImportArchive = { id, sourceId: file.id, parentId, absoluteOffset: offset, size: source.size, nameCandidates: [...names], identification,
      profileStatus, identity, format: mix?.format ?? null, dataOffset: mix?.dataOffset ?? 0, memberCount: mix?.entries.length ?? 0,
      integrity: inspected.status, allowed: ancestorAllowed && decision.allow && profileStatus === 'eligible', members: records };
    archives.push(row);
    if (!mix) {
      if (inspected.reason?.endsWith('-limit')) limited = true;
      diagnostic({ code: inspected.reason ?? 'archive-parse-failure', severity: 'error', sourceId: file.id, archiveId: id }); return;
    }
    members += mix.entries.length;
    if (!decision.allow) diagnostic({ code: `archive-${inspected.status}`, severity: 'error', sourceId: file.id, archiveId: id });
    for (const warning of decision.warnings) diagnostic({ code: warning, severity: 'warning', sourceId: file.id, archiveId: id });
    if (mix.diagnostics.length || mix.trailingBytes) diagnostic({ code: 'ambiguous-archive-layout', severity: 'error', sourceId: file.id, archiveId: id });
    // Numeric records remain inspectable even if policy blocks their use. A
    // structurally ambiguous archive is never recursively interpreted.
    for (const entry of mix.entries) records.push({ ordinal: entry.ordinal, idHex: entry.id.toString(16).padStart(8, '0'), offset: entry.offset, size: entry.size, names: [], nameEvidence: [] });
    if (inspected.status === 'structural-failure') return;
    for (const entry of mix.entries) if (databaseIds.has(entry.id)) {
      if (entry.size > BROWSER_IMPORT_LIMITS.databaseBytes) { limited = true; diagnostic({ code: 'database-byte-limit', severity: 'warning', sourceId: file.id, archiveId: id }); continue; }
      try {
        for (const name of readXccLocalNames(await readExact(mixMemberSource(source, mix, entry), 0, entry.size), BROWSER_IMPORT_LIMITS.databaseNames)) {
          const safe = normalizeAssetPath(name);
          resolver.add({ name: safe, source: `${id}/member:${entry.ordinal}:xcc-local-database` });
          await checkpoint('archives', file.path);
        }
      } catch (error) {
        guard();
        const capped = error instanceof MixError && (error.code === 'database-limit' || error.code === 'name-limit');
        if (capped) limited = true;
        diagnostic({ code: capped ? error.code : 'database-rejected', severity: 'warning', sourceId: file.id, archiveId: id });
      }
      await checkpoint('archives', file.path);
    }
    for (const entry of mix.entries) {
      const candidates = [...new Set(resolver.resolve(entry.id).map(name => name.name))].sort(compare);
      const nestedNames = candidates.filter(name => archiveExtension.test(name));
      const uncachedSource = mixMemberSource(source, mix, entry);
      let memberSource = uncachedSource;
      if (entry.size < 6 && !nestedNames.length) continue;
      if (!nestedNames.length) {
        const prefix = await readExact(uncachedSource, 0, Math.min(10, entry.size));
        if (isKnownNonArchive(prefix)) continue;
        // Structural MIX probes immediately request the same header again. Retain
        // only these already-read bytes for this visit, without payload read-ahead.
        memberSource = { size: uncachedSource.size, async read(start, length) {
          guard(); assertRange(uncachedSource.size, start, length);
          return start <= prefix.length && length <= prefix.length - start ? prefix.slice(start, start + length) : readExact(uncachedSource, start, length);
        } };
      }
      if (depth >= BROWSER_IMPORT_LIMITS.depth) {
        if (nestedNames.length) { limited = true; diagnostic({ code: 'archive-depth-limit', severity: 'warning', sourceId: file.id, archiveId: id }); }
        continue;
      }
      await visit(memberSource, { ...file, profileStatus }, id, offset + mix.dataOffset + entry.offset, depth + 1, nestedNames, nestedNames.length ? 'name-candidate' : 'structural-probe', row.allowed);
      await checkpoint('archives', file.path);
    }
  }
  try {
    for (const file of files) {
      if (file.status === 'accepted' && file.kind === 'archive') await visit(handles.get(file.id)!, file, null, 0, 0, [file.path], 'filename');
      filesProcessed++; await checkpoint('archives', file.path, true);
    }
  } catch (error) {
    throwIfImportAborted(signal);
    if (error instanceof BrowserSourceError && error.code === 'browser-read-budget') { limited = true; diagnostic({ code: error.code, severity: 'error' }); }
    else throw error;
  }
  // Names found in a later local database apply to earlier numeric rows too.
  // The final pass never reinterprets those names as proof of a verified hash.
  async function metadataCheckpoint(): Promise<void> {
    throwIfImportAborted(signal);
    if (++steps >= 128 || performance.now() - lastYield >= 8) { await yieldBrowserTask(signal); throwIfImportAborted(signal); steps = 0; lastYield = performance.now(); }
  }
  for (const archive of archives) for (const member of archive.members) {
    throwIfImportAborted(signal);
    const evidence = resolver.resolve(Number.parseInt(member.idHex, 16));
    if (evidence.length > BROWSER_IMPORT_LIMITS.namesPerMember) { limited = true; diagnostic({ code: 'member-name-limit', severity: 'warning', sourceId: archive.sourceId, archiveId: archive.id }); }
    Object.assign(member, { names: [...new Set(evidence.map(row => row.name))].sort(compare).slice(0, BROWSER_IMPORT_LIMITS.namesPerMember), nameEvidence: evidence.slice(0, BROWSER_IMPORT_LIMITS.namesPerMember).map(row => ({ ...row })) });
    await metadataCheckpoint();
  }
  const requirements: BrowserImportRequirement[] = [];
  for (const path of profileFiles[profile]) {
    const candidates: { match: BrowserImportRequirement['matches'][number]; allowed: boolean; literal: boolean; collision: boolean }[] = [];
    for (const file of files) if (file.path === path && file.kind === 'loose' && file.profileStatus === 'eligible') candidates.push({ match: { sourceId: file.id, archiveId: null, ordinal: null }, allowed: file.status === 'accepted', literal: true, collision: file.status === 'duplicate' });
    for (const archive of archives) {
      if (archive.profileStatus === 'eligible') for (const member of archive.members) if (member.names.includes(path)) {
        candidates.push({ match: { sourceId: archive.sourceId, archiveId: archive.id, ordinal: member.ordinal }, allowed: archive.allowed, literal: false, collision: member.names.length > 1 });
      }
      await metadataCheckpoint();
    }
    const status = candidates.length === 0 ? 'missing' : candidates.some(row => row.collision) || candidates.length > 1 ? 'ambiguous' : !candidates[0]!.allowed ? 'blocked' : candidates[0]!.literal ? 'literal' : 'candidate';
    requirements.push({ path, status, matches: candidates.map(row => row.match) });
  }
  // Once a read budget is reached, metadata completion must still be cancellable.
  throwIfImportAborted(signal);
  onProgress?.(Object.freeze({ phase: 'requirements', filesProcessed, totalFiles: selections.length, archives: archives.length, members, bytesRead }));
  throwIfImportAborted(signal);
  for (const archive of archives) { for (const member of archive.members) { Object.freeze(member.names); for (const name of member.nameEvidence) Object.freeze(name); Object.freeze(member.nameEvidence); Object.freeze(member); await metadataCheckpoint(); } Object.freeze(archive.members); Object.freeze(archive.nameCandidates); Object.freeze(archive); }
  for (const file of files) Object.freeze(file);
  for (const item of requirements) { for (const match of item.matches) Object.freeze(match); Object.freeze(item.matches); Object.freeze(item); }
  for (const item of diagnostics) Object.freeze(item);
  return Object.freeze({ schemaVersion: 1, profile, policy, status: limited ? 'limited' : 'inspected', files: Object.freeze(files), archives: Object.freeze(archives), requirements: Object.freeze(requirements), diagnostics: Object.freeze(diagnostics),
    summary: Object.freeze({ selectedFiles: selections.length, acceptedFiles: files.filter(file => file.status === 'accepted').length, ignoredFiles: files.filter(file => file.status === 'ignored').length,
      archives: archives.length, members, namedMembers: archives.reduce((sum, archive) => sum + archive.members.filter(member => member.names.length > 0).length, 0), bytesRead }), canStartCampaign: false });
}
