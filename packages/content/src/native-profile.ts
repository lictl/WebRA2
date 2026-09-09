// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original structural census; not a mission interpreter.
import { censusValue, type IniDocument, type IniEntry } from './ini.ts';

const fold = (text: string) => censusValue(text).toLowerCase();
const filename = /^[a-z0-9_][a-z0-9_.-]{0,127}\.map$/;
function bounded(document: IniDocument): void {
  if (document.sections.length > 4096 || document.entries.length > 100_000) throw new Error('native-profile-record-limit');
  let characters = 0;
  for (const row of document.entries) {
    characters += row.section.length + row.key.length + row.value.length;
    if (characters > 16 * 1024 * 1024) throw new Error('native-profile-text-limit');
  }
}
/** MAPSEL structural links, retaining ambiguity. Never derives edges from filename order. */
export function censusNativeMapSelection(document: IniDocument, knownFilenames: readonly string[]) {
  bounded(document);
  if (knownFilenames.length > 1024 || knownFilenames.some(name => !filename.test(name))) throw new Error('native-profile-filename-limit');
  const known = new Set(knownFilenames);
  const diagnostics = document.diagnostics.map(row => ({ line: row.line, code: 'ini-diagnostic' }));
  const rowGroups = new Map<string, IniEntry[]>();
  for (const row of document.entries) {
    const key = JSON.stringify([fold(row.section), row.sectionOccurrence]);
    const group = rowGroups.get(key) ?? []; group.push(row); rowGroups.set(key, group);
  }
  const stages = document.sections.map((section, ordinal) => {
    const rows = rowGroups.get(JSON.stringify([fold(section.name), section.occurrence])) ?? [];
    const scenarios = rows.filter(row => fold(row.key) === 'scenario');
    const values = scenarios.map(row => fold(row.value));
    const scenario = scenarios.length === 1 && known.has(values[0]!) ? values[0]! : null;
    if (scenarios.length > 1) diagnostics.push({ line: scenarios[1]!.line, code: 'duplicate-scenario' });
    if (scenarios.length === 1 && values[0] && !scenario) diagnostics.push({ line: scenarios[0]!.line, code: 'unclassified-scenario' });
    return { ordinal, sectionLine: section.line, scenario, scenarioLines: scenarios.map(row => row.line), hasScenario: scenarios.length > 0, rows, name: fold(section.name) };
  });
  const targetsByName = new Map<string, number[]>();
  for (const stage of stages) if (stage.hasScenario) {
    const matches = targetsByName.get(stage.name) ?? []; matches.push(stage.ordinal); targetsByName.set(stage.name, matches);
  }
  const edges: { from: number; to: number[]; choice: number; line: number; ambiguous: boolean }[] = [];
  let targetCount = 0;
  for (const stage of stages) {
    if (!stage.hasScenario) continue;
    const numbered = stage.rows.filter(row => /^\d+$/.test(fold(row.key)));
    const counts = new Map<number, number>();
    for (const row of numbered) { const number = Number(fold(row.key)); counts.set(number, (counts.get(number) ?? 0) + 1); }
    for (const row of numbered) {
      const choice = Number(fold(row.key));
      if (!Number.isSafeInteger(choice) || choice < 1 || choice > 255) { diagnostics.push({ line: row.line, code: 'unsupported-choice-number' }); continue; }
      const targets = targetsByName.get(fold(row.value)) ?? [];
      targetCount += targets.length;
      if (targetCount > 100_000) throw new Error('native-profile-edge-limit');
      const duplicateKey = counts.get(choice)! > 1;
      if (!targets.length) diagnostics.push({ line: row.line, code: 'missing-stage' });
      if (targets.length > 1 || duplicateKey) diagnostics.push({ line: row.line, code: 'ambiguous-stage-link' });
      edges.push({ from: stage.ordinal, to: [...targets], choice, line: row.line, ambiguous: targets.length !== 1 || duplicateKey });
    }
  }
  return {
    stages: stages.filter(stage => stage.hasScenario).map(({ ordinal, sectionLine, scenario, scenarioLines }) => ({ ordinal, sectionLine, scenario, scenarioLines })),
    edges, diagnostics,
    interpretation: 'structural-choice-links; native branch execution and presentation untested',
  };
}

/** Emits only control booleans/locations. Legacy continuation strings are not published. */
export function censusNativeCampaignControls(document: IniDocument) {
  bounded(document);
  const basic = document.entries.filter(row => fold(row.section) === 'basic');
  const controls = ['endofgame', 'skipmapselect', 'onetimeonly'].map(key => {
    const rows = basic.filter(row => fold(row.key) === key);
    const parse = (row: IniEntry): boolean | null => {
      const text = fold(row.value);
      return ['yes', 'true', '1'].includes(text) ? true : ['no', 'false', '0'].includes(text) ? false : null;
    };
    return { key, lines: rows.map(row => row.line), value: rows.length === 1 ? parse(rows[0]!) : null,
      status: rows.length === 0 ? 'absent' : rows.length > 1 ? 'ambiguous' : parse(rows[0]!) === null ? 'unsupported' : 'literal' };
  });
  return { controls, legacyContinuationLines: basic.filter(row => ['nextscenario', 'altnextscenario'].includes(fold(row.key))).map(row => row.line) };
}
