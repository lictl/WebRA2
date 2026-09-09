// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Bounded validation at the app worker boundary.
import type { BrowserImportReport } from '../../../packages/vfs/src/browser-types.ts';
import { record as objectRecord, MAX_WORKER_FILES, MAX_WORKER_PATH } from './import-protocol.ts';
function record(value: unknown): value is Record<string, unknown> { return objectRecord(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
function integer(value: unknown, max = Number.MAX_SAFE_INTEGER): value is number { return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= max; }
function text(value: unknown, max = MAX_WORKER_PATH): value is string { return typeof value === 'string' && value.length <= max; }
function choice(value: unknown, values: readonly unknown[]): boolean { return values.includes(value); }
function rows(value: unknown, max: number): value is unknown[] { return Array.isArray(value) && value.length <= max && Reflect.ownKeys(value).length === value.length + 1 && Array.from({ length: value.length }, (_, i) => Object.hasOwn(value, i)).every(Boolean); }
function keys(value: Record<string, unknown>, allowed: string): boolean { const names = new Set(allowed.split(' ')); return Reflect.ownKeys(value).every(key => typeof key === 'string' && names.has(key)); }
function identity(value: unknown): boolean { return record(value) && keys(value, 'status sha256') && value.status === 'unverified' && value.sha256 === null; }
const profiles = ['eligible', 'excluded', 'unassigned'];
/** Validates all imported report fields before the view or downstream app can consume them. */
export function validImportReport(value: unknown): value is BrowserImportReport {
  if (!record(value) || !keys(value, 'schemaVersion profile policy status canStartCampaign files archives requirements diagnostics summary') || value.schemaVersion !== 1 || !choice(value.profile, ['ra2', 'yr']) || !choice(value.policy, ['tolerant', 'strict']) ||
    !choice(value.status, ['inspected', 'limited']) || value.canStartCampaign !== false || !rows(value.files, MAX_WORKER_FILES) || !rows(value.archives, 512) ||
    !rows(value.requirements, 10) || !rows(value.diagnostics, 4096) || !record(value.summary)) return false;
  const files = new Map<string, Record<string, unknown>>(), archives = new Map<string, Record<string, unknown>>();
  let accepted = 0, ignored = 0, members = 0, named = 0;
  for (const file of value.files) {
    if (!record(file) || !keys(file, 'id path size kind status profileStatus identity') || !text(file.id) || files.has(file.id) || !text(file.path) || !integer(file.size) ||
      !choice(file.kind, ['archive', 'loose', 'program', 'unsupported']) || !choice(file.status, ['accepted', 'ignored', 'invalid', 'duplicate']) ||
      !choice(file.profileStatus, profiles) || !identity(file.identity)) return false;
    files.set(file.id, file); if (file.status === 'accepted') accepted++; if (file.status === 'ignored') ignored++;
  }
  for (const archive of value.archives) {
    if (!record(archive) || !keys(archive, 'id sourceId parentId absoluteOffset size dataOffset nameCandidates identity identification profileStatus format integrity allowed memberCount members') || !text(archive.id) || archives.has(archive.id) || !text(archive.sourceId) || !files.has(archive.sourceId) ||
      (archive.parentId !== null && !text(archive.parentId)) || !integer(archive.absoluteOffset) || !integer(archive.size) || !integer(archive.dataOffset) ||
      !rows(archive.nameCandidates, 10_000) || !archive.nameCandidates.every(name => text(name)) || !identity(archive.identity) ||
      !choice(archive.identification, ['filename', 'name-candidate', 'structural-probe']) || !choice(archive.profileStatus, profiles) ||
      !choice(archive.format, [null, 'classic', 'flagged', 'encrypted']) ||
      !choice(archive.integrity, ['no-checksum', 'unverified', 'verified', 'mismatch', 'structural-failure', 'source-identity-failure', 'verification-failure']) ||
      typeof archive.allowed !== 'boolean' || !integer(archive.memberCount, 8192) || !rows(archive.members, 8192) || archive.members.length !== archive.memberCount) return false;
    members += archive.members.length; if (members > 250_000) return false;
    for (const [ordinal, member] of archive.members.entries()) {
      if (!record(member) || !keys(member, 'ordinal idHex offset size names nameEvidence') || member.ordinal !== ordinal || !text(member.idHex, 8) || !/^[a-f0-9]{8}$/.test(member.idHex) ||
        !integer(member.offset) || !integer(member.size) || !rows(member.names, 16) || !member.names.every(name => text(name)) ||
        !rows(member.nameEvidence, 16)) return false;
      for (const evidence of member.nameEvidence) if (!record(evidence) || !keys(evidence, 'name source hashKind') || !text(evidence.name) || !text(evidence.source) || !choice(evidence.hashKind, ['classic', 'crc32'])) return false;
      if (member.names.length) named++;
    }
    archives.set(archive.id, archive);
  }
  for (const archive of archives.values()) if (archive.parentId !== null) {
    const parent = archives.get(archive.parentId as string);
    if (!parent || parent.sourceId !== archive.sourceId || parent.id === archive.id) return false;
  }
  const paths = new Set<string>();
  for (const requirement of value.requirements) {
    if (!record(requirement) || !keys(requirement, 'path status matches') || !text(requirement.path) || paths.has(requirement.path) ||
      !choice(requirement.status, ['literal', 'candidate', 'ambiguous', 'missing', 'blocked']) || !rows(requirement.matches, members + files.size)) return false;
    paths.add(requirement.path);
    for (const match of requirement.matches) {
      if (!record(match) || !keys(match, 'sourceId archiveId ordinal') || !text(match.sourceId) || !files.has(match.sourceId)) return false;
      if (match.archiveId === null) { if (match.ordinal !== null) return false; }
      else {
        if (!text(match.archiveId) || !integer(match.ordinal)) return false;
        const archive = archives.get(match.archiveId);
        if (!archive || archive.sourceId !== match.sourceId || match.ordinal >= (archive.memberCount as number)) return false;
      }
    }
  }
  for (const diagnostic of value.diagnostics) if (!record(diagnostic) || !keys(diagnostic, 'code severity path sourceId archiveId') || !text(diagnostic.code) || !choice(diagnostic.severity, ['info', 'warning', 'error']) ||
    (diagnostic.path !== undefined && !text(diagnostic.path)) || (diagnostic.sourceId !== undefined && (!text(diagnostic.sourceId) || !files.has(diagnostic.sourceId))) ||
    (diagnostic.archiveId !== undefined && (!text(diagnostic.archiveId) || !archives.has(diagnostic.archiveId)))) return false;
  const summary = value.summary;
  return keys(summary, 'selectedFiles acceptedFiles ignoredFiles archives members namedMembers bytesRead') && summary.selectedFiles === files.size && summary.acceptedFiles === accepted && summary.ignoredFiles === ignored && summary.archives === archives.size &&
    summary.members === members && summary.namedMembers === named && integer(summary.bytesRead, 64 * 1024 * 1024);
}
