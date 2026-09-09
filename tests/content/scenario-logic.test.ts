// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original synthetic mission definitions.
import assert from 'node:assert/strict';
import test from 'node:test';
import { compileScenarioLogic, ScenarioLogicError, type ScenarioLogicInput } from '../../packages/content/src/scenario-logic.ts';
const base = '[Basic]\nNewINIFormat=4\n';
const bytes = (text: string) => new TextEncoder().encode(text);
const input = (text: string, profile: 'ra2' | 'yr' = 'yr'): ScenarioLogicInput => ({ profile,
  source: { id: 'original-fixture', profile, sha256: '1'.repeat(64) }, bytes: bytes(base + text) });
const compile = (text: string, caps: Parameters<typeof compileScenarioLogic>[1] = {}) => compileScenarioLogic(input(text), caps);
function code(fn: () => unknown, expected: string) { assert.throws(fn, (e: unknown) => e instanceof ScenarioLogicError && e.code === expected); }
const trigger = (attachment = '<none>') => `Faction,${attachment},Original fixture,unverified,yes,no,maybe,opaque`;
const action = '9001,0,unknown-type,-99,opaque,0,unchanged,A';

test('mixed event widths and action stride preserve unknown operands and exact token origin', () => {
  const result = compile(`[Triggers]\nT=${trigger()}\n[Events]\nT=2, 7001 ,0,-22,7002,2,opaque,TYPE ; source comment\n[Actions]\nT=1,${action}\n`);
  assert.equal(result.framingComplete, true); assert.equal(result.executionReady, false); assert.equal(result.capabilityClosure, 'incomplete-operand-schemas');
  const events = result.events[0]!;
  assert.deepEqual(events.instructions.map(i => [i.tokenStart, i.tokenCount, i.opcode, i.discriminator]), [[1, 3, 7001, 0], [4, 4, 7002, 2]]);
  assert.deepEqual(events.instructions[1]!.parameters, ['2', 'opaque', 'TYPE']);
  assert.equal(events.row.tokens[1], ' 7001 '); assert.ok(events.row.entry.selected.rawValue.endsWith('; source comment'));
  assert.equal(events.row.entry.selected.line, 6); assert.equal(events.row.entry.selected.sourceSha256, '1'.repeat(64));
  assert.equal(result.actions[0]!.instructions[0]!.tokenCount, 8);
  assert.deepEqual(result.actions[0]!.instructions[0]!.parameters, ['0', 'unknown-type', '-99', 'opaque', '0', 'unchanged', 'A']);
  assert.equal(result.triggers[0]!.disabledRaw, 'unverified'); assert.equal(result.triggers[0]!.tailRaw, 'opaque');
  assert.ok(result.capabilities.every(c => c.operandSchema === 'unknown' && c.semantics === 'unimplemented'));
});

test('zero-count rows succeed; every counted truncation or extra token rejects atomically', () => {
  assert.equal(compile('[Events]\nT=0\n[Actions]\nT=0\n').events[0]!.instructions.length, 0);
  for (const [section, value] of [['Events', '2,81,0,A,82,2,B,C'], ['Actions', `1,${action}`]]) {
    const tokens = value!.split(',');
    for (let end = 1; end < tokens.length; end++) assert.throws(() => compile(`[${section}]\nT=${tokens.slice(0, end).join(',')}\n`), ScenarioLogicError);
    code(() => compile(`[${section}]\nT=${value},extra\n`), 'logic-counted-trailing');
  }
  code(() => compile('[Events]\nT=0,\n'), 'logic-counted-trailing');
  code(() => compile('[Events]\nT=1,81,0,\n'), 'logic-counted-empty');
  code(() => compile('[Events]\nT=1,81,unknown,A\n'), 'logic-number-syntax');
  code(() => compile('[Actions]\nT=-1\n'), 'logic-number-syntax');
});

test('scripts retain numeric gaps, arbitrary properties and raw parameters without renumbering', () => {
  const result = compile('[ScriptTypes]\n9=S\n[S]\nName=fixture\n10=9000,-4\n2=9001,TYPE\nExtra=opaque,metadata\n');
  const script = result.scripts[0]!;
  assert.deepEqual(script.steps.map(s => [s.index, s.instruction.opcode, s.instruction.parameters[0]]), [[2, 9001, 'TYPE'], [10, 9000, '-4']]);
  assert.equal(script.declaration.entry.key, '9'); assert.equal(script.fields.find(f => f.entry.key === 'extra')!.tokens.length, 2);
  assert.deepEqual(result.diagnostics.map(d => d.code), ['numeric-row-gaps', 'opaque-script-property']);
  code(() => compile('[ScriptTypes]\n0=S\n[S]\n0=10,\n'), 'logic-script-empty-parameter');
  code(() => compile('[ScriptTypes]\n0=S\n[S]\n0=10,1,2\n'), 'logic-row-shape');
});

test('task-force quantities stay bounded metadata; properties and zero quantities survive', () => {
  const result = compile('[TaskForces]\n0=F\n[F]\nName=fixture\nGroup=-1\n0=0,TYPE_A\n1=65535,TYPE_B\nExtra=x\n');
  assert.deepEqual(result.taskForces[0]!.members.map(m => [m.index, m.quantity, m.type]), [[0, 0, 'TYPE_A'], [1, 65535, 'TYPE_B']]);
  assert.equal(result.taskForces[0]!.fields.find(f => f.entry.key === 'group')!.values[0], '-1');
  assert.ok(result.references.every(r => r.status === 'external' && r.targetKind === 'object-type'));
  code(() => compile('[TaskForces]\n0=F\n[F]\n0=65536,TYPE\n'), 'logic-number-range');
  code(() => compile('[TaskForces]\n0=F\n[F]\n0=-1,TYPE\n'), 'logic-number-syntax');
});

test('literal references separate declared targets, missing definitions and undeclared raw sections', () => {
  const result = compile(`[Triggers]\nT=${trigger()}\n[Events]\nT=0\n[Actions]\nT=0\n[Tags]\nTAG=unknown,label,T\n[TeamTypes]\n0=TEAM\n1=ABSENT\n[TEAM]\nScript=ORPHAN\nTaskForce=MISSING\nTag=TAG\nHouse=Faction\nNoDefault=\n[ORPHAN]\n0=9999,opaque\n[Houses]\n0=Faction\n[Countries]\n0=Faction\n`);
  assert.equal(result.teams[1]!.definitionPresent, false);
  assert.equal(result.references.find(r => r.field === 'script')!.status, 'undeclared');
  assert.equal(result.references.find(r => r.field === 'taskforce')!.status, 'missing');
  assert.equal(result.references.find(r => r.field === 'tag')!.status, 'resolved');
  assert.equal(result.references.find(r => r.field === 'house')!.targets.length, 2);
  assert.equal(result.orphanSections[0]!.section, 'orphan'); assert.equal(result.orphanSections[0]!.fields[0]!.selected.rawValue, '9999,opaque');
  assert.equal(result.scripts.length, 0); assert.equal(result.capabilities.length, 0);
  assert.equal(result.teams[0]!.fields.find(f => f.entry.key === 'nodefault')!.values[0], '');
  assert.ok(result.diagnostics.some(d => d.code === 'missing-declaration'));
});

test('missing event/action owners and references remain visible rather than fabricating trigger rows', () => {
  const result = compile(`[Triggers]\nT=${trigger('MISSING')}\n[Tags]\nTAG=0,label,MISSING\n[Events]\nORPHAN=0\n`);
  assert.equal(result.triggers.length, 1); assert.equal(result.events.length, 1);
  assert.equal(result.references.filter(r => r.status === 'missing').length, 5);
  assert.equal(result.references.find(r => r.field === 'owner')!.status, 'external');
});

test('declared-but-absent targets and sentinel name collisions stay explicitly unresolved', () => {
  const result = compile('[TeamTypes]\n0=T\n[T]\nScript=S\nTaskForce=F\nTag=None\n[ScriptTypes]\n0=S\n[TaskForces]\n0=F\n[Tags]\nNone=0,label,MISSING\n');
  assert.equal(result.references.find(r => r.field === 'script')!.status, 'missing-definition');
  assert.equal(result.references.find(r => r.field === 'taskforce')!.status, 'missing-definition');
  assert.equal(result.references.find(r => r.field === 'tag')!.status, 'unsupported');
  assert.equal(result.scripts[0]!.steps.length, 0); assert.equal(result.scripts[0]!.definitionPresent, false);
});

test('attachment cycles and self-links are retained with bounded iterative diagnostics', () => {
  const result = compile(`[Triggers]\nB=${trigger('A')}\nA=${trigger('B')}\nZ=${trigger('Z')}\n`);
  assert.deepEqual(result.triggerAttachmentCycles, [['trigger:a', 'trigger:b'], ['trigger:z']]);
  assert.equal(result.diagnostics.filter(d => d.code === 'trigger-attachment-cycle').length, 2);
  assert.equal(result.executionReady, false);
});

test('duplicate/aliased declarations and steps fail even if last assignment would look valid', () => {
  for (const section of ['Events', 'Actions']) code(() => compile(`[${section}]\nT=0\nt=0\n`), 'logic-duplicate-row');
  code(() => compile('[ScriptTypes]\n1=A\n01=B\n'), 'logic-aliased-id');
  code(() => compile('[ScriptTypes]\n1=A\n2=a\n'), 'logic-aliased-definition-section');
  code(() => compile('[ScriptTypes]\n0=A\n[TaskForces]\n0=A\n'), 'logic-aliased-definition-section');
  code(() => compile('[ScriptTypes]\n0=Events\n'), 'logic-aliased-definition-section');
  code(() => compile('[ScriptTypes]\n0=S\n[S]\n1=1,A\n01=2,B\n'), 'logic-aliased-id');
  code(() => compile('[ScriptTypes]\n0=S\n[S]\nName=A\nName=B\n'), 'logic-duplicate-row');
});

test('raw INI shadowed origins are retained for uncompiled fields and orphan summaries', () => {
  const result = compile('[TeamTypes]\n0=T\n[T]\nScript=ORPHAN\n[ORPHAN]\n0=1,A\n0=2,B\n[Other]\nValue=old\nValue=new\n');
  const orphan = result.orphanSections[0]!.fields[0]!;
  assert.equal(orphan.shadowed[0]!.rawValue, '1,A'); assert.equal(orphan.selected.rawValue, '2,B');
  assert.equal(result.ini.entries.find(e => e.section === 'other')!.shadowed[0]!.rawValue, 'old');
  assert.equal(result.scripts.length, 0);
});

test('resource caps reject before row/record/reference expansion and cannot increase', () => {
  const events = '[Events]\nT=1,1,0,X\n';
  code(() => compile(events, { declarations: 0 }), 'logic-declaration-limit');
  code(() => compile('[ScriptTypes]\nnot-an-index=bad\n', { declarations: 0 }), 'logic-declaration-limit');
  code(() => compile(events, { records: 0 }), 'logic-record-limit');
  code(() => compile(events, { recordsPerRow: 0 }), 'logic-number-range');
  code(() => compile(events, { tokensPerRow: 2 }), 'logic-token-limit');
  code(() => compile(events, { tokens: 4 }), 'logic-token-limit');
  code(() => compile(events, { tokenCharacters: 0 }), 'logic-token-length');
  code(() => compile(events, { references: 0 }), 'logic-reference-limit');
  code(() => compile(events, { capabilities: 0 }), 'logic-capability-limit');
  code(() => compile('[TaskForces]\n0=F\n[F]\n0=1,TYPE\n[ScriptTypes]\n0=S\n[S]\n0=1,X\n', { records: 1 }), 'logic-record-limit');
  code(() => compile(events, { diagnostics: 0 }), 'logic-diagnostic-limit');
  assert.throws(() => compile(events, { inputBytes: 1 }), /ini-byte-limit/);
  code(() => compile('', { records: 65537 }), 'logic-limits');
  code(() => compile('', { declarations: -0 }), 'logic-limits');
  let invoked = false;
  code(() => compile('', { get tokens() { invoked = true; return 10; } }), 'logic-limits'); assert.equal(invoked, false);
});

test('metadata is deterministic, frozen and detached; source profiles and versions stay explicit', () => {
  const source = input(`[Triggers]\nconstructor=${trigger('<none>')}\n[Events]\nconstructor=0\n[Actions]\nconstructor=0\n`);
  const first = compileScenarioLogic(source), second = compileScenarioLogic(source);
  assert.deepEqual(first, second); source.bytes.fill(0); assert.equal(first.triggers[0]!.row.entry.key, 'constructor');
  assert.ok(Object.isFrozen(first) && Object.isFrozen(first.triggers) && Object.isFrozen(first.triggers[0]!.row.tokens));
  assert.throws(() => { (first.triggers[0] as { name: string }).name = 'changed'; }, TypeError);
  const ra2 = compileScenarioLogic(input('', 'ra2')); assert.equal(ra2.profile, 'ra2'); assert.equal(first.profile, 'yr');
  const wrong = input(''); code(() => compileScenarioLogic({ ...wrong, profile: 'ra2' }), 'logic-profile');
  code(() => compileScenarioLogic({ ...input(''), bytes: bytes('[Basic]\nNewINIFormat=3\n') }), 'logic-unsupported-format');
  code(() => compileScenarioLogic({ ...input(''), bytes: bytes('[Basic]\n') }), 'logic-unsupported-format');
  code(() => compile(`[Triggers]\nT=${trigger()},extra\n`), 'logic-row-shape');
});
