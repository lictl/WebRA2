// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic INIs; no retail bytes, text or identifiers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileRuntimeIni, type RuntimeIni } from '../../packages/content/src/runtime-ini.ts';
import { createIniSourceView, findIniSourceEntries, findIniSourceSections, uniqueIniSourceEntry, uniqueIniSourceSection,
  INI_SOURCE_VIEW_LIMITS } from '../../packages/content/src/ini-source-view.ts';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
function table(texts: string[], profile: 'ra2' | 'yr' = 'ra2'): RuntimeIni {
  return compileRuntimeIni(profile, texts.map((s, i) => ({ id: `layer-${i}`, profile, order: i * 10, kind: i ? 'mod' : 'base', sourceSha256: hash(s), bytes: new TextEncoder().encode(s) })));
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const v of Object.values(value)) freeze(v); Object.freeze(value); }
  return value;
}
function changed(input: RuntimeIni, mutate: (v: any) => void): RuntimeIni {
  const clone = JSON.parse(JSON.stringify(input)); mutate(clone); return freeze(clone);
}
const fixture = ['[Zeta] suffix retained as a diagnostic\n9=first ; note\n1=second\n[Node]\nImage=Old\nName=Upper\nname=Lower\n[node]\nImage=Different\n[Node]\nImage=RepeatedSection\n[Empty]\n', '[Node]\nImage=Later\n'];
test('both profiles preserve source stage/header/entry order, exact spelling and every folded shadowed origin', () => {
  for (const profile of ['ra2', 'yr'] as const) {
    const input = table(fixture, profile), before = JSON.stringify(input), result = createIniSourceView(input);
    assert.equal(result.profile, profile); assert.equal(result.policy, 'webra2-ini-source-view-1');
    assert.equal(result.inputPolicy, 'webra2-ini-1'); assert.equal(result.valuePolicy, 'webra2-ini-1');
    assert.equal(result.sourceScope, 'retained-runtime-ini-origins'); assert.equal(result.nativeParserVerified, false);
    assert.deepEqual(result.stages.map(s => [s.layer.id, s.layer.order, s.layer.sourceSha256]), [['layer-0', 0, hash(fixture[0]!)], ['layer-1', 10, hash(fixture[1]!)]]);
    assert.deepEqual(result.stages[0]!.sections.map(s => [s.name, s.line, s.occurrence]), [['Zeta', 1, 0], ['Node', 4, 0], ['node', 8, 1], ['Node', 10, 2], ['Empty', 12, 0]]);
    assert.deepEqual(result.stages[0]!.sections[0]!.entries.map(e => e.key), ['9', '1']);
    assert.equal(result.stages[0]!.sections[0]!.entries[0]!.value, 'first');
    assert.equal(result.stages[0]!.sections[0]!.entries[0]!.origin.rawValue, 'first ; note');
    assert.equal(result.stages.flatMap(s => s.sections).flatMap(s => s.entries).length, input.entries.reduce((n, e) => n + e.shadowed.length + 1, 0));
    assert.deepEqual(result.diagnostics, input.diagnostics); assert.ok(result.diagnostics.some(d => d.code === 'ignored-section-suffix'));
    assert.equal(JSON.stringify(input), before);
  }
});
test('exact indexed lookups retain repeated sections and differently cased keys without selecting a winner', () => {
  const view = createIniSourceView(table(fixture));
  const matches = findIniSourceSections(view, 'layer-0', 'Node'); assert.equal(matches.length, 2);
  assert.strictEqual(matches, findIniSourceSections(view, 'layer-0', 'Node'));
  assert.equal(findIniSourceSections(view, 'layer-0', 'node').length, 1);
  assert.equal(findIniSourceSections(view, 'layer-0', 'NODE').length, 0);
  assert.equal(uniqueIniSourceSection(view, 'layer-0', 'Node').status, 'ambiguous');
  assert.equal(uniqueIniSourceSection(view, 'layer-0', 'Empty').status, 'unique');
  assert.equal(uniqueIniSourceSection(view, 'layer-0', 'Missing').status, 'missing');
  const first = matches[0]!;
  assert.equal(findIniSourceEntries(first, 'Name')[0]!.value, 'Upper');
  assert.equal(findIniSourceEntries(first, 'name')[0]!.value, 'Lower');
  assert.equal(uniqueIniSourceEntry(first, 'NAME').status, 'missing');
  assert.equal(findIniSourceEntries(first, 'Image')[0]!.value, 'Old');
  assert.equal(findIniSourceEntries(findIniSourceSections(view, 'layer-1', 'Node')[0]!, 'Image')[0]!.value, 'Later');
});
test('exact repeated entries remain separate and strict selection reports ambiguity including empty values', () => {
  const view = createIniSourceView(table(['[Item]\nImage=One\nImage=\nImage=Three\nimage=Different\n']));
  const section = view.stages[0]!.sections[0]!, rows = findIniSourceEntries(section, 'Image');
  assert.deepEqual(rows.map(r => [r.value, r.origin.keyOccurrence]), [['One', 0], ['', 1], ['Three', 2]]);
  const selection = uniqueIniSourceEntry(section, 'Image'); assert.equal(selection.status, 'ambiguous');
  if (selection.status === 'ambiguous') assert.strictEqual(selection.values, rows);
  assert.equal(uniqueIniSourceEntry(section, 'image').status, 'unique');
});
test('empty sources and empty section occurrences stay present without manufactured entries or defaults', () => {
  const view = createIniSourceView(table(['', '[Empty]\n[Empty]\n']));
  assert.equal(view.stages[0]!.sections.length, 0);
  assert.equal(findIniSourceSections(view, 'layer-1', 'Empty').length, 2);
  assert.ok(view.stages[1]!.sections.every(s => !s.entries.length));
  assert.equal(createIniSourceView(table(['']), { occurrences: 0 }).stages.length, 1);
});
test('UTF source values and raw text stay intact while semantic trimming remains inherited policy', () => {
  const text = '\ufeff[標記]\n名稱=  測試 ; 保留\n';
  const view = createIniSourceView(table([text], 'yr')), section = findIniSourceSections(view, 'layer-0', '標記')[0]!;
  assert.equal(section.entries[0]!.value, '測試'); assert.equal(section.entries[0]!.origin.rawValue, '  測試 ; 保留');
  assert.equal(view.stages[0]!.layer.encoding, 'utf-8-bom');
});
test('factory brands reject clones/forgeries and every returned collection is immutable', () => {
  const view = createIniSourceView(table(fixture)), section = view.stages[0]!.sections[0]!;
  assert.throws(() => findIniSourceSections(freeze(structuredClone(view)), 'layer-0', 'Zeta'), /view-brand/);
  assert.throws(() => findIniSourceEntries(freeze(structuredClone(section)), '9'), /section-brand/);
  assert.throws(() => findIniSourceSections(view, 'absent-layer', 'Node'), /layer-lookup/);
  assert.throws(() => findIniSourceSections(view, 'layer-0', ''), /lookup-name/);
  assert.throws(() => findIniSourceEntries(section, 'A'.repeat(513)), /lookup-name/);
  assert.throws(() => (section.entries as any[]).push(null), TypeError);
  assert.throws(() => (findIniSourceEntries(section, '9') as any[]).splice(0, 1), TypeError);
  assert.ok(Object.isFrozen(view.stages[0]!.layer)); assert.ok(Object.isFrozen(uniqueIniSourceEntry(section, '9')));
});
test('prototype-like section/key/layer names are ordinary indexed data', () => {
  const input = table(['[constructor]\n__proto__=Safe\n[toString]\nconstructor=AlsoSafe\n']);
  const renamed = changed(input, v => {
    v.layers[0].id = '__proto__';
    for (const s of v.sections) for (const o of s.occurrences) o.layerId = '__proto__';
    for (const e of v.entries) for (const o of [...e.shadowed, e.selected]) o.layerId = '__proto__';
  });
  const view = createIniSourceView(renamed), section = findIniSourceSections(view, '__proto__', 'constructor')[0]!;
  assert.equal(findIniSourceEntries(section, '__proto__')[0]!.value, 'Safe');
});
test('entry origin must belong to its immediately preceding exact header and cannot share any source line', () => {
  const input = table(['[First]\nA=1\n[Other]\nB=2\n']);
  assert.throws(() => createIniSourceView(changed(input, v => { v.entries[0].selected.line = 5; })), /entry-origin/);
  assert.throws(() => createIniSourceView(changed(input, v => { v.entries[0].selected.line = 3; })), /entry-origin/);
  assert.throws(() => createIniSourceView(changed(input, v => { v.entries[0].selected.sectionSpelling = 'first'; })), /entry-origin/);
  assert.throws(() => createIniSourceView(changed(input, v => { v.entries[1].selected.line = 2; })), /entry-origin/);
});
test('stage/hash joins, folded table shape, duplicate lines/counters and chronological shadow history reject corruption', () => {
  const input = table(['[First]\nA=1\nA=2\n[First]\nB=3\n', '[First]\nA=4\n']);
  const mutations = [
    (v: any) => { v.layers.reverse(); }, (v: any) => { v.layers[1].profile = 'yr'; },
    (v: any) => { v.entries[0].selected.sourceSha256 = 'f'.repeat(64); },
    (v: any) => { v.entries[0].shadowed.reverse(); },
    (v: any) => { v.entries[0].shadowed[1].keyOccurrence = 0; },
    (v: any) => { v.sections[0].occurrences[1].line = 1; },
    (v: any) => { v.sections[0].occurrences[1].occurrence = 0; },
    (v: any) => { v.entries[0].value = 'Incorrect'; }, (v: any) => { v.entries.push(v.entries[0]); },
  ];
  for (const mutate of mutations) assert.throws(() => createIniSourceView(changed(input, mutate)), /ini-source-/);
});
test('count/character/work caps include overwritten rows and fail without publishing partial state', () => {
  const input = table(['[A]\nX=1\nX=2\nX=3\n']); const before = JSON.stringify(input);
  assert.throws(() => createIniSourceView(input, { occurrences: 3 }), /occurrence-limit/);
  assert.equal(createIniSourceView(input, { occurrences: 4 }).stages[0]!.sections[0]!.entries.length, 3);
  for (const cap of [{ stages: 0 }, { work: 0 }, { work: 5 }, { nodes: 5 }, { characters: 3 }]) assert.throws(() => createIniSourceView(input, cap), /ini-source-/);
  assert.throws(() => createIniSourceView(input, { stages: INI_SOURCE_VIEW_LIMITS.stages + 1 }), /limit/);
  assert.throws(() => createIniSourceView(input, { occurrences: -0 }), /limit/); assert.equal(JSON.stringify(input), before);
});
test('mutable input, accessors, exotic arrays and cycles reject before getters can run', () => {
  const input = table(['[A]\nB=C\n']);
  assert.throws(() => createIniSourceView({ ...input }), /immutable-input/);
  let read = false; const accessor = Object.freeze({ ...input, get marker() { read = true; return 'never'; } });
  assert.throws(() => createIniSourceView(accessor), /input-property/); assert.equal(read, false);
  class Rows extends Array {}
  const exotic = Object.freeze({ ...input, diagnostics: Object.freeze(new Rows()) });
  assert.throws(() => createIniSourceView(exotic as unknown as RuntimeIni), /array/);
  const cycle: any = { ...input }; cycle.cycle = cycle; Object.freeze(cycle);
  assert.throws(() => createIniSourceView(cycle), /input-cycle/);
});

test('inherited scanner counters must remain contiguous across differently cased exact names', () => {
  const input = table(['[Node]\nName=Upper\n[node]\nname=Lower\n']);
  assert.throws(() => createIniSourceView(changed(input, v => { v.sections[0].occurrences[1].occurrence = 0; })), /section-origin/);
  assert.throws(() => createIniSourceView(changed(input, v => { v.entries[0].selected.keyOccurrence = 9; })), /entry-origin/);
});
