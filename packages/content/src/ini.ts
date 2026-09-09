// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../PROVENANCE.md.
/** Bounded research scanner. It preserves occurrences and does not select effective INI precedence. */
export const INI_LIMITS = Object.freeze({ bytes: 16 * 1024 * 1024, lines: 250_000, lineLength: 262_144, entries: 200_000 });
export interface IniEntry { section: string; sectionOccurrence: number; key: string; keyOccurrence: number; value: string; line: number }
export interface IniDocument {
  encoding: 'byte-preserving-ascii-compatible' | 'utf-8-bom' | 'utf-16le-bom';
  sections: { name: string; occurrence: number; line: number }[];
  entries: IniEntry[];
  diagnostics: { line: number; code: string }[];
}
export class ContentError extends Error {
  constructor(readonly code: string, readonly offset: number, message: string) { super(message); this.name = 'ContentError'; }
}
export function asciiBytes(bytes: Uint8Array): string {
  let output = '';
  for (let at = 0; at < bytes.length; at += 8192) output += String.fromCharCode(...bytes.subarray(at, at + 8192));
  return output;
}
function trim(value: string): string { return value.replace(/^[ \t]+|[ \t]+$/g, ''); }
export function scanIni(bytes: Uint8Array): IniDocument {
  if (bytes.length > INI_LIMITS.bytes) throw new ContentError('ini-byte-limit', 0, 'INI exceeds byte cap');
  let encoding: IniDocument['encoding'] = 'byte-preserving-ascii-compatible';
  let text: string;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = 'utf-16le-bom';
    if (bytes.length % 2) throw new ContentError('ini-encoding', 0, 'Odd UTF-16 byte length');
    text = new TextDecoder('utf-16le', { fatal: true }).decode(bytes.subarray(2));
  } else if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    encoding = 'utf-8-bom'; text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(3));
  } else text = asciiBytes(bytes);
  if (text.includes('\0')) throw new ContentError('ini-nul', 0, 'NUL is outside the supported INI subset');
  const lines = text.split(/\r\n|\n|\r/);
  if (lines.length > INI_LIMITS.lines) throw new ContentError('ini-line-limit', 0, 'INI exceeds line cap');
  const result: IniDocument = { encoding, sections: [], entries: [], diagnostics: [] };
  const sectionCounts = new Map<string, number>(), keyCounts = new Map<string, number>();
  let section: string | undefined, sectionOccurrence = 0;
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index]!;
    if (raw.length > INI_LIMITS.lineLength) throw new ContentError('ini-line-length', index + 1, 'INI line exceeds cap');
    const line = trim(raw);
    if (!line || line.startsWith(';')) continue;
    if (line.startsWith('[')) {
      const match = /^\[([^\]\r\n]{1,255})\]\s*(?:;.*)?$/.exec(line);
      if (!match) { result.diagnostics.push({ line: index + 1, code: 'malformed-section' }); section = undefined; continue; }
      section = trim(match[1]!);
      if (!section) { result.diagnostics.push({ line: index + 1, code: 'empty-section' }); section = undefined; continue; }
      const identity = section.toLowerCase();
      sectionOccurrence = sectionCounts.get(identity) ?? 0;
      sectionCounts.set(identity, sectionOccurrence + 1);
      result.sections.push({ name: section, occurrence: sectionOccurrence, line: index + 1 });
      continue;
    }
    const equals = line.indexOf('=');
    if (equals < 1 || section === undefined) { result.diagnostics.push({ line: index + 1, code: 'unscoped-or-malformed-entry' }); continue; }
    const key = trim(line.slice(0, equals));
    if (!key || key.length > 512) { result.diagnostics.push({ line: index + 1, code: 'invalid-key' }); continue; }
    const identity = `${section.toLowerCase()}\0${key.toLowerCase()}`;
    const keyOccurrence = keyCounts.get(identity) ?? 0;
    keyCounts.set(identity, keyOccurrence + 1);
    result.entries.push({ section, sectionOccurrence, key, keyOccurrence, value: trim(line.slice(equals + 1)), line: index + 1 });
    if (result.entries.length > INI_LIMITS.entries) throw new ContentError('ini-entry-limit', index + 1, 'INI exceeds entry cap');
  }
  return result;
}
export function entriesIn(document: IniDocument, section: string): IniEntry[] {
  return document.entries.filter(entry => entry.section.toLowerCase() === section.toLowerCase());
}
/** Comments are removed only by numeric/reference consumers, never from preserved source values. */
export function censusValue(value: string): string { return value.split(';', 1)[0]!.trim(); }
