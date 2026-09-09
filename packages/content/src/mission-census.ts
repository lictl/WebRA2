// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. EA editor framing references in ../PROVENANCE.md.
import { censusValue, type IniDocument, type IniEntry } from './ini.ts';

export const OPCODE_LIMITS = Object.freeze({ recordsPerRow: 4096, tokensPerRow: 32_769 });
export interface CensusDiagnostic { section: string; key: string; line: number; code: string; token?: number }
export interface OpcodeRow { id: number; count: number; parameterWidths: number[] }
function integer(text: string | undefined): number | undefined {
  if (text === undefined || !/^\d+$/.test(text.trim())) return undefined;
  const value = Number(text.trim()); return Number.isSafeInteger(value) && value <= 0xffffffff ? value : undefined;
}
function add(table: Map<number, { count: number; widths: Set<number> }>, id: number, width: number): void {
  const row = table.get(id) ?? { count: 0, widths: new Set<number>() };
  row.count++; row.widths.add(width); table.set(id, row);
}
function finish(table: Map<number, { count: number; widths: Set<number> }>): OpcodeRow[] {
  return [...table].sort(([a], [b]) => a - b).map(([id, row]) => ({ id, count: row.count, parameterWidths: [...row.widths].sort((a, b) => a - b) }));
}
export function censusMission(document: IniDocument) {
  const diagnostics: CensusDiagnostic[] = [];
  const sections = new Map<string, IniEntry[]>();
  for (const row of document.entries) { const key = row.section.toLowerCase(); const rows = sections.get(key) ?? []; rows.push(row); sections.set(key, rows); }
  const entries = (section: string): IniEntry[] => sections.get(section.toLowerCase()) ?? [];
  const events = new Map<number, { count: number; widths: Set<number> }>();
  const actions = new Map<number, { count: number; widths: Set<number> }>();
  const scripts = new Map<number, { count: number; widths: Set<number> }>();
  function diagnostic(row: IniEntry, code: string, token?: number): void {
    diagnostics.push({ section: row.section, key: row.key, line: row.line, code, ...(token === undefined ? {} : { token }) });
  }
  function counted(row: IniEntry, kind: 'events' | 'actions'): void {
    const tokens = censusValue(row.value).split(',').map(t => t.trim());
    if (tokens.length > OPCODE_LIMITS.tokensPerRow) { diagnostic(row, 'token-limit'); return; }
    const count = integer(tokens[0]);
    if (count === undefined || count > OPCODE_LIMITS.recordsPerRow) { diagnostic(row, 'invalid-record-count', 0); return; }
    let cursor = 1;
    // Reject the entire row on framing failure; a partial opcode list would look complete.
    const parsed: { id: number; width: number }[] = [];
    for (let index = 0; index < count; index++) {
      const id = integer(tokens[cursor]);
      if (id === undefined) { diagnostic(row, 'invalid-opcode', cursor); return; }
      let width = 8;
      if (kind === 'events') {
        const discriminator = integer(tokens[cursor + 1]);
        if (discriminator === undefined) { diagnostic(row, 'invalid-event-discriminator', cursor + 1); return; }
        width = discriminator === 2 ? 4 : 3;
      }
      if (cursor + width > tokens.length || tokens.slice(cursor, cursor + width).some(t => !t)) {
        diagnostic(row, 'truncated-or-empty-record', cursor); return;
      }
      parsed.push({ id, width: width - 1 }); cursor += width;
    }
    if (cursor !== tokens.length) { diagnostic(row, 'trailing-tokens', cursor); return; }
    for (const record of parsed) add(kind === 'events' ? events : actions, record.id, record.width);
  }
  for (const row of entries('Events')) counted(row, 'events');
  for (const row of entries('Actions')) counted(row, 'actions');
  const scriptIds = [...new Set(entries('ScriptTypes').map(row => censusValue(row.value)))];
  for (const scriptId of scriptIds) {
    const rows = entries(scriptId);
    if (!rows.length) { diagnostics.push({ section: 'ScriptTypes', key: scriptId, line: 0, code: 'missing-script-section' }); continue; }
    const indices = new Set<number>();
    for (const row of rows) {
      if (row.key.toLowerCase() === 'name') continue;
      const index = integer(row.key);
      if (index === undefined) { diagnostic(row, 'non-numeric-script-step'); continue; }
      if (indices.has(index)) diagnostic(row, 'duplicate-script-step');
      indices.add(index);
      const tokens = censusValue(row.value).split(',').map(t => t.trim());
      const id = integer(tokens[0]);
      if (id === undefined || tokens.length !== 2 || !tokens[1]) { diagnostic(row, 'unsupported-script-framing'); continue; }
      add(scripts, id, 1);
    }
    const ordered = [...indices].sort((a, b) => a - b);
    if (ordered.some((value, index) => value !== index)) diagnostics.push({ section: scriptId, key: '', line: 0, code: 'noncontiguous-script-steps' });
  }
  const sectionNames = new Set(document.sections.map(s => s.name.toLowerCase()));
  return {
    isMapCandidate: sectionNames.has('basic') && sectionNames.has('map'),
    rows: Object.fromEntries(['Events', 'Actions', 'Triggers', 'Tags', 'TeamTypes', 'TaskForces', 'ScriptTypes', 'AITriggerTypes'].map(section => [section, entries(section).length])),
    eventOpcodes: finish(events), actionOpcodes: finish(actions), scriptOpcodes: finish(scripts),
    framingComplete: diagnostics.length === 0, diagnostics,
  };
}
