// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic mission logic, without retail rows or content.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileScenarioLogic } from '../../packages/content/src/scenario-logic.ts';
import { canonicalHash, canonicalText } from '../../packages/sim/src/canonical.ts';
import { compileMissionProgram, MissionLogic, replayMission, MISSION_TIMING_POLICY, MISSION_LOGIC_LIMITS as C,
  type MissionInitialState, type MissionInput, type MissionProgram, type MissionReplay } from '../../packages/sim/src/mission-logic.ts';
import type { ContentIdentity } from '../../packages/contracts/src/index.ts';

const sha = async (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
const mutableCopy = <T>(value: T) => structuredClone(value) as Mutable<T>;
const content: ContentIdentity = { profile: 'yr', manifestSha256: '1'.repeat(64), rulesSha256: '2'.repeat(64), orderedModHashes: [] };
type Spec = { id: string; attached?: string; disabled?: boolean; levels?: string; events?: [number, number][]; actions?: [number, number | string][] };
function ini(specs: Spec[], modes: [string, number, string][] = specs.map(s => [`tag_${s.id}`, 0, s.id])): string {
  const ev = (s: Spec) => { const values = s.events ?? [[8, 0]]; return [values.length, ...values.flatMap(([op, n]) => [op, 0, n])].join(','); };
  const ac = (s: Spec) => { const values = s.actions ?? []; return [values.length, ...values.flatMap(([op, n]) => [op, op === 53 || op === 54 ? 2 : 0, n, 0, 0, 0, 0, 'A'])].join(','); };
  return '[Basic]\nNewINIFormat=4\n[Triggers]\n' + specs.map(s => `${s.id}=OriginalOwner,${s.attached ?? '<none>'},Original,${s.disabled ? 1 : 0},${s.levels ?? '1,1,1'},0`).join('\n') +
    '\n[Events]\n' + specs.map(s => `${s.id}=${ev(s)}`).join('\n') + '\n[Actions]\n' + specs.map(s => `${s.id}=${ac(s)}`).join('\n') +
    '\n[Tags]\n' + modes.map(([id, mode, trigger]) => `${id}=${mode},Original,${trigger}`).join('\n') + '\n';
}
function compiled(value: string, profile: 'ra2' | 'yr' = 'yr') {
  const bytes = new TextEncoder().encode(value);
  return compileScenarioLogic({ profile, source: { id: 'original.map', profile, sha256: createHash('sha256').update(bytes).digest('hex') }, bytes });
}
async function prepare(value: string, difficulty: 0 | 1 | 2 = 1, profile: 'ra2' | 'yr' = 'yr') {
  return compileMissionProgram(compiled(value, profile), { contentIdentity: { ...content, profile }, difficulty, timingPolicy: MISSION_TIMING_POLICY }, sha);
}
async function program(value: string, difficulty: 0 | 1 | 2 = 1): Promise<MissionProgram> {
  const r = await prepare(value, difficulty); assert.deepEqual(r.diagnostics, []); assert.ok(r.program); return r.program;
}
function initial(p: MissionProgram): MissionInitialState {
  return { globals: Array(50).fill(false), locals: Array(100).fill(false), bindings: p.tags.map(t => ({ id: t.id, tagId: t.id, attachmentIds: [`attachment:${t.id}`] })) };
}
function create(p: MissionProgram) { return MissionLogic.create(p, initial(p)); }
const flag = (tick: number, sequence: number, value: boolean, index = 0): MissionInput => ({ tick, sequence, kind: 'local', index, value });

test('elapsed frame boundary, same-pass flag effects and once-only outcomes interpret data in both profiles', async () => {
  const source = ini([
    { id: 'AAA', events: [[13, 1]], actions: [[56, 0]] },
    { id: 'BBB', events: [[36, 0]], actions: [[1, 0]] },
  ]);
  for (const profile of ['ra2', 'yr'] as const) {
    const result = await prepare(source, 1, profile); assert.ok(result.program);
    assert.equal(result.nativeBehaviorVerified, false); assert.equal(result.canStartCampaign, false);
    const sim = create(result.program); assert.equal(sim.step(15).effects.length, 0);
    assert.deepEqual(sim.step().effects.map(e => [e.tick, e.opcode, e.kind, e.order]), [[15, 56, 'action', 1], [15, 1, 'outcome-request', 2]]);
    assert.equal(sim.save().lastOutcomeRequest!.countryIndex, 0); assert.ok(sim.save().bindings.every(b => !b.active));
    assert.equal(sim.step(3).effects.length, 0);
  }
});

test('repeat polling does not latch flag truth; actual changes reset the shared elapsed timer', async () => {
  const p = await program(ini([{ id: 'AAA', events: [[13, 1], [36, 0]], actions: [[0, 0]] }], [['tag_repeat', 2, 'AAA']]));
  const sim = create(p); sim.enqueue([flag(10, 0, true), flag(20, 1, true), flag(26, 2, false), flag(27, 3, true)]);
  const events = sim.step(43).effects;
  assert.deepEqual(events.filter(e => e.opcode === 0).map(e => e.tick), [25, 42]);
  const state = sim.save().bindings[0]!.triggers[0]!;
  assert.equal(state.elapsedDue, 57); assert.equal(state.fired, 2); assert.deepEqual(state.observations, [true, true]);
  assert.equal(state.destroyed, false);
});

test('global/local set and clear are level predicates, while event zero never becomes unconditional', async () => {
  const p = await program(ini([
    { id: 'AAA', events: [[0, 0]], actions: [[0, 0]] },
    { id: 'BBB', events: [[28, 3], [37, 4]], actions: [[28, 3], [56, 4]] },
    { id: 'CCC', events: [[27, 3], [36, 4]], actions: [[29, 3], [57, 4]] },
  ]));
  const sim = create(p); assert.deepEqual(sim.step().effects.map(e => e.opcode), [28, 56, 29, 57]);
  assert.equal(sim.save().globals[3], false); assert.equal(sim.save().locals[4], false);
  assert.equal(sim.save().bindings[0]!.triggers[0]!.fired, 0);
});

test('multiple elapsed records use the first source operand shared timer, and elapsed scenario time is independent', async () => {
  const p = await program(ini([
    { id: 'AAA', events: [[13, 1], [13, 9]], actions: [[0, 0]] },
    { id: 'BBB', events: [[47, 2]], actions: [[0, 0]] },
  ]));
  const sim = create(p); const e = sim.step(31).effects;
  assert.deepEqual(e.map(x => [x.triggerId, x.tick]), [['trigger:aaa', 15], ['trigger:bbb', 30]]);
});

test('linked trigger construction reverses the chain, preserves action order, and removes a once tag after traversal', async () => {
  const p = await program(ini([
    { id: 'AAA', attached: 'BBB', actions: [[56, 0], [57, 0]] },
    { id: 'BBB', actions: [[56, 1]] },
  ], [['tag_chain', 0, 'AAA']]));
  const sim = create(p), e = sim.step().effects;
  assert.deepEqual(e.map(x => [x.triggerId, x.opcode, x.target]), [['trigger:bbb', 56, 'local:1'], ['trigger:aaa', 56, 'local:0'], ['trigger:aaa', 57, 'local:0']]);
  assert.equal(sim.save().locals[0], false); assert.equal(sim.save().locals[1], true);
  assert.deepEqual(sim.save().bindings[0]!.triggers.map(t => t.fired), [1, 1]); assert.equal(sim.step().effects.length, 0);
});

test('enable resets timers across bound instances, honors difficulty, and self-disable does not truncate actions', async () => {
  const p = await program(ini([
    { id: 'AAA', actions: [[53, 'BBB']] },
    { id: 'BBB', disabled: true, events: [[13, 1]], actions: [[54, 'BBB'], [56, 0]] },
    { id: 'CCC', levels: '1,0,1', actions: [[56, 1]] },
  ], [['tag_a', 0, 'AAA'], ['tag_b', 2, 'BBB'], ['tag_c', 2, 'CCC']]));
  const setup = initial(p), mutable = mutableCopy(setup);
  mutable.bindings.push({ id: 'tag_b_second', tagId: 'tag:tag_b', attachmentIds: ['original-extra-owner'] });
  const sim = MissionLogic.create(p, mutable), e = sim.step(16).effects;
  assert.deepEqual(e.map(x => [x.tick, x.opcode]), [[0, 53], [15, 54], [15, 56]]);
  // The first instance disables both instances before the second reaches evaluation.
  assert.equal(sim.save().bindings.find(b => b.id === 'tag_b_second')!.triggers[0]!.fired, 0);
  assert.equal(sim.save().locals[1], false);
  assert.equal(sim.step(16).effects.length, 0);
});

test('mission timer set starts, stop preserves remaining time, resume and extension use 15-frame units', async () => {
  const p = await program(ini([
    { id: 'AAA', actions: [[27, 2]] },
    { id: 'BBB', events: [[47, 1]], actions: [[24, 0]] },
    { id: 'CCC', events: [[47, 2]], actions: [[25, 1]] },
    { id: 'DDD', events: [[14, 0]], actions: [[2, 0]] },
  ]));
  const sim = create(p); sim.step(16); assert.deepEqual(sim.save().timer, { startedAt: null, frames: 15 });
  assert.equal(sim.step(14).effects.length, 0); const remaining = sim.step(31).effects;
  assert.deepEqual(remaining.map(e => [e.tick, e.opcode]), [[30, 25], [60, 2]]);
  const zero = await program(ini([{ id: 'AAA', actions: [[27, 0], [24, 0]] }, { id: 'BBB', events: [[14, 0]], actions: [[0, 0]] }]));
  assert.deepEqual(create(zero).step(2).effects.map(e => e.opcode), [27, 24]);
  const resume = await program(ini([{ id: 'AAA', actions: [[27, 2], [26, 3], [24, 0], [23, 0]] }, { id: 'BBB', events: [[14, 0]], actions: [[0, 0]] }]));
  assert.deepEqual(create(resume).step().effects.map(e => e.opcode), [27, 26, 24, 23, 0]);
});

test('every-boundary restore preserves observations, timers, once state, pending input identity and full effect order', async () => {
  const p = await program(ini([{ id: 'AAA', events: [[13, 1], [36, 0]], actions: [[28, 0]] }], [['tag_repeat', 2, 'AAA']]));
  const uninterrupted = create(p); uninterrupted.enqueue([flag(3, 0, true), flag(20, 1, false), flag(23, 2, true)]);
  const start = uninterrupted.save(), all = uninterrupted.step(50).effects;
  for (let at = 0; at <= 50; at++) {
    const first = MissionLogic.restore(p, start), before = at ? first.step(at).effects : [];
    const resumed = MissionLogic.restore(p, first.saveText()), after = at < 50 ? resumed.step(50 - at).effects : [];
    assert.equal(resumed.saveText(), uninterrupted.saveText()); assert.deepEqual([...before, ...after], all);
  }
});

test('admission-aware replay handles initial pending inputs once and verifies checkpoints after same-boundary batches', async () => {
  const p = await program(ini([{ id: 'AAA', events: [[36, 0]], actions: [[0, 0]] }], [['tag_repeat', 2, 'AAA']]));
  const sim = create(p); sim.enqueue([flag(2, 0, true)]); const initialCheckpoint = sim.save();
  const effects = sim.step(3).effects; sim.enqueue([flag(4, 1, false)]); sim.enqueue([flag(6, 2, true)]);
  const checkpoint = { nextTick: 3, sha256: await canonicalHash(sim.save(), sha) }; effects.push(...sim.step(5).effects);
  const document: MissionReplay = { schemaVersion: 1, initialCheckpoint,
    admissions: [{ nextTick: 3, inputs: [flag(4, 1, false)] }, { nextTick: 3, inputs: [flag(6, 2, true)] }],
    finalNextTick: 8, checkpoints: [checkpoint, { nextTick: 8, sha256: await canonicalHash(sim.save(), sha) }] };
  const actual = await replayMission(p, canonicalText(document), sha);
  assert.equal(actual.simulation.saveText(), sim.saveText()); assert.deepEqual(actual.effects, effects); assert.equal(actual.verifiedCheckpoints, 2);
  const corrupted = mutableCopy(document); corrupted.checkpoints[0]!.sha256 = 'f'.repeat(64);
  await assert.rejects(replayMission(p, corrupted, sha), /checkpoint/);
  const duplicate = mutableCopy(document); duplicate.admissions[0]!.inputs.push(flag(4, 0, true));
  await assert.rejects(replayMission(p, duplicate, sha), /sequence/);
  const zero = await replayMission(p, { ...document, checkpoints: [] }, sha); assert.equal(zero.verifiedCheckpoints, 0);
});

test('unknown opcodes, bad operand modes, mode1 tags, transfer tails, cycles and unresolved targets fail closed', async () => {
  for (const value of [
    ini([{ id: 'AAA', events: [[999, 0]] }]),
    ini([{ id: 'AAA', actions: [[999, 0]] }]),
    ini([{ id: 'AAA', actions: [[56, 100]] }]),
    ini([{ id: 'AAA', events: [[13, -1]] }]),
    ini([{ id: 'AAA', actions: [[53, 'ZZZ']] }]),
    ini([{ id: 'AAA', actions: [[53, '01']] }]),
    ini([{ id: 'AAA' }], [['tag_a', 1, 'AAA']]),
    ini([{ id: 'AAA', attached: 'BBB' }, { id: 'BBB', attached: 'AAA' }]),
    ini([{ id: 'AAA' }]).replace('Original,0,1,1,1,0', 'Original,0,1,1,1,1'),
    ini([{ id: 'AAA', actions: [[56, 0]] }]).replace('56,0,0,0,0,0,0,A', '56,4,0,0,0,0,0,A'),
    ini([{ id: 'AAA' }]) + '[ScriptTypes]\n0=OriginalScript\n[OriginalScript]\n0=0,0\n',
  ]) {
    const result = await prepare(value); assert.equal(result.program, null); assert.ok(result.diagnostics.length); assert.equal(result.canExecuteTriggerSubset, false);
  }
});

test('program identity includes ignored operand encodings, difficulty and profile; callers cannot forge or mutate a machine', async () => {
  const source = ini([{ id: 'AAA', actions: [[0, 0]] }]);
  const a = await program(source), b = await program(source.replace('0,0,0,0,0,0,0,A', '0,0,0,1,0,0,0,A'));
  assert.notEqual(a.sha256, b.sha256); assert.notEqual(a.sha256, (await program(source, 0)).sha256);
  const machine = create(a), save = machine.save(); save.locals[0] = true; assert.equal(machine.save().locals[0], false);
  assert.throws(() => MissionLogic.restore(b, machine.save()), /identity/);
  assert.throws(() => create(structuredClone(a)), /program/);
  assert.ok(Object.isFrozen(a.triggers[0]!.events));
  const raw = structuredClone(compiled(source)); let called = false;
  Object.defineProperty(raw.triggers[0], 'disabledRaw', { get() { called = true; return '0'; } });
  await assert.rejects(compileMissionProgram(raw, { contentIdentity: content, difficulty: 1, timingPolicy: MISSION_TIMING_POLICY }, sha), /field/); assert.equal(called, false);
  const captured = mutableCopy(compiled(source)); let resolve!: (hash: string) => void, digestBytes!: Uint8Array;
  const pending = compileMissionProgram(captured, { contentIdentity: content, difficulty: 1, timingPolicy: MISSION_TIMING_POLICY }, bytes => {
    digestBytes = bytes; return new Promise(r => { resolve = r; });
  });
  captured.actions[0]!.instructions[0]!.parameters[1] = '100'; captured.triggers[0]!.disabledRaw = '1';
  resolve(await sha(digestBytes)); const preserved = await pending;
  assert.equal(preserved.program!.sha256, a.sha256); assert.equal(preserved.program!.triggers[0]!.enabled, true);
});

test('malformed save state, noncanonical input, versions and bounds reject without mutating the live machine', async () => {
  const p = await program(ini([{ id: 'AAA', events: [[13, 1]], actions: [[0, 0]] }], [['tag_repeat', 2, 'AAA']]));
  const sim = create(p), original = sim.saveText();
  for (const modify of [
    (s: ReturnType<MissionLogic['save']>) => { s.programSha256 = 'f'.repeat(64); },
    (s: ReturnType<MissionLogic['save']>) => { s.bindings[0]!.triggers[0]!.observations = []; },
    (s: ReturnType<MissionLogic['save']>) => { s.bindings[0]!.triggers[0]!.destroyed = true; },
    (s: ReturnType<MissionLogic['save']>) => { s.bindings[0]!.triggers[0]!.elapsedDue = 16; },
    (s: ReturnType<MissionLogic['save']>) => { s.nextEffectOrder = 0; },
    (s: ReturnType<MissionLogic['save']>) => { s.pending = [flag(0, 0, true)]; },
  ]) { const s = sim.save(); modify(s); assert.throws(() => MissionLogic.restore(p, s)); }
  assert.throws(() => MissionLogic.restore(p, original.replace('"nextTick":0', '"nextTick":0,"nextTick":0')), /duplicate-json-key/);
  assert.throws(() => MissionLogic.restore(p, original.replace('"nextTick":0', '"nextTick":0.0')), /integer-required/);
  assert.throws(() => sim.enqueue([flag(0, 2, true), flag(0, 2, false)]), /sequence/);
  assert.throws(() => sim.enqueue([flag(C.futureTicks + 1, 0, true)]));
  assert.throws(() => sim.step(C.stepTicks + 1)); assert.equal(sim.saveText(), original);
  const capacity = Array.from({ length: C.inputs }, (_, i) => flag(1, i, true)); sim.enqueue(capacity); const full = sim.saveText();
  assert.throws(() => sim.enqueue([flag(1, C.inputs, true)]), /input-limit/); assert.equal(sim.saveText(), full);
});

test('effect and work overflow abort the entire tick batch; action cycles remain finite without recursive firing', async () => {
  const p = await program(ini([{ id: 'AAA', actions: Array.from({ length: C.actionsPerTrigger }, () => [0, 0] as [number, number]) }], [['tag_repeat', 2, 'AAA']]));
  const sim = create(p), before = sim.saveText(); assert.throws(() => sim.step(300), /limit/); assert.equal(sim.saveText(), before);
  const chain = await program(ini([{ id: 'AAA', actions: [[53, 'BBB']] }, { id: 'BBB', actions: [[53, 'AAA']] }], [['tag_a', 2, 'AAA'], ['tag_b', 2, 'BBB']]));
  assert.equal(create(chain).step(3).effects.length, 6);
  const all = initial(chain), crowded = mutableCopy(all);
  crowded.bindings = Array.from({ length: 128 }, (_, i) => ({ id: `binding:${String(i).padStart(3, '0')}`, tagId: chain.tags[i % 2]!.id, attachmentIds: [`owner:${i}`] }));
  const limited = MissionLogic.create(chain, crowded), original = limited.saveText(); assert.throws(() => limited.step(16), /work-limit/); assert.equal(limited.saveText(), original);
  await assert.rejects(replayMission(chain, { schemaVersion: 1, initialCheckpoint: limited.save(), admissions: [], finalNextTick: 100, checkpoints: [] }, sha), /replay-work-limit/);
});
