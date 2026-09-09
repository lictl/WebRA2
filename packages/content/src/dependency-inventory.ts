// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Uses the reviewed OpenRA-derived MIX name hashes.
import { hashMixName } from '../../formats/src/mix-names.ts';
import type { FileCandidate } from './dependency-candidates.ts';
export interface PhysicalDependencyInventory { archives: { path: string; rootFile: string; absoluteOffset: number; size: number; sha256: string; dataOffset: number; dataSize: number; members: { ordinal: number; id: number; offset: number; size: number; idHex: string }[] }[] }
function integer(n: number) { return Number.isSafeInteger(n) && n >= 0 && !Object.is(n, -0); }
function name(n: string) { return typeof n === 'string' && n.length > 0 && n.length <= 2048 && !/[\x00-\x1f\x7f]/.test(n); }
function hash(n: string) { return typeof n === 'string' && /^[a-f0-9]{64}$/.test(n); }
export function createDependencyFileResolver(input: PhysicalDependencyInventory, numericAliases: readonly { filename: string; id: number; evidence: string }[] = []) {
  if (numericAliases.length > 128 || numericAliases.some(a => !/^[a-z0-9_][a-z0-9_.-]{0,254}$/i.test(a.filename) || !integer(a.id) || a.id > 0xffffffff || !name(a.evidence))) throw new Error('dependency-alias-limit');
  if (!Array.isArray(input.archives) || input.archives.length > 512) throw new Error('dependency-archive-limit');
  const roots = new Map<string, { size: number; sha256: string }>(), paths = new Set<string>();
  for (const a of input.archives) {
    if (!name(a.path) || !name(a.rootFile) || /[/\\:]/.test(a.rootFile) || a.rootFile === '..' || ![a.absoluteOffset, a.size, a.dataOffset, a.dataSize].every(integer) || !hash(a.sha256) || a.dataOffset > a.size || a.dataSize > a.size - a.dataOffset || paths.has(a.path)) throw new Error('dependency-archive-identity');
    paths.add(a.path);
    if (a.path === a.rootFile && a.absoluteOffset === 0) roots.set(a.rootFile, { size: a.size, sha256: a.sha256 });
  }
  const members = new Map<number, Omit<FileCandidate, 'hashKinds'>[]>(); let count = 0;
  for (const a of input.archives) {
    const root = roots.get(a.rootFile); if (!root || a.absoluteOffset > root.size || a.size > root.size - a.absoluteOffset) throw new Error('dependency-archive-range');
    if (!Array.isArray(a.members) || a.members.length > 65_535 || (count += a.members.length) > 250_000) throw new Error('dependency-member-limit');
    const ordinals = new Set<number>();
    for (const m of a.members) {
      if (![m.ordinal, m.id, m.offset, m.size].every(integer) || m.id > 0xffffffff || m.idHex !== m.id.toString(16).padStart(8, '0') || ordinals.has(m.ordinal) || m.offset > a.dataSize || m.size > a.dataSize - m.offset) throw new Error('dependency-member-identity');
      ordinals.add(m.ordinal);
      const row = { rootFile: a.rootFile, rootSha256: root.sha256, archivePath: a.path, archiveSha256: a.sha256, absoluteOffset: a.absoluteOffset + a.dataOffset + m.offset, size: m.size, memberId: m.idHex, ordinal: m.ordinal };
      const list = members.get(m.id) ?? []; list.push(row); members.set(m.id, list);
    }
  }
  return (filename: string): FileCandidate[] => {
    if (!/^[a-z0-9_][a-z0-9_.-]{0,254}$/i.test(filename)) throw new Error('dependency-unsafe-filename');
    const results = new Map<string, FileCandidate>();
    for (const kind of ['classic', 'crc32'] as const) for (const member of members.get(hashMixName(filename, kind)) ?? []) {
      const key = JSON.stringify(member), found = results.get(key);
      if (found) found.hashKinds.push(kind); else results.set(key, { ...member, hashKinds: [kind] });
    }
    for (const alias of numericAliases.filter(a => a.filename.toLowerCase() === filename.toLowerCase())) for (const member of members.get(alias.id) ?? []) {
      const key = JSON.stringify(member), found = results.get(key);
      if (found) found.numericAliasEvidence = alias.evidence; else results.set(key, { ...member, hashKinds: [], numericAliasEvidence: alias.evidence });
    }
    return [...results.values()].sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0);
  };
}
