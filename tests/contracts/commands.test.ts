// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import test from 'node:test';
import { assertCommand, assertJsonValue, orderCommands } from '../../packages/contracts/src/index.ts';

const command = (tick = 0, playerId = 0, sequence = 0) => ({
  schemaVersion: 1, tick, playerId, sequence, kind: 'unit.move', payload: { ids: [1], x: 2, y: 3 },
});

test('arrival order does not change the command schedule or mutate the input batch', () => {
  const expected = [command(1, 0, 3), command(1, 1, 0), command(2, 0, 0)];
  const arrival = [expected[2], expected[0], expected[1]];
  assert.deepEqual(orderCommands(arrival), expected);
  assert.equal(arrival[0], expected[2]);
  assert.deepEqual(orderCommands([...arrival].reverse()), expected);
});

test('duplicate identities are rejected even when the order payload differs', () => {
  assert.throws(() => orderCommands([command(), { ...command(), kind: 'unit.stop' }]), /Duplicate/);
});

test('unsafe ticks, fractional player IDs and invalid sequence values cannot enter a replay', () => {
  for (const invalid of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    for (const field of ['tick', 'playerId', 'sequence']) assert.throws(() => assertCommand({ ...command(), [field]: invalid }));
  }
  assert.doesNotThrow(() => assertCommand(command(Number.MAX_SAFE_INTEGER)));
});

test('unsupported/missing/extra command fields fail before dispatch', () => {
  for (const value of [null, {}, { ...command(), schemaVersion: 2 }, { ...command(), kind: '' },
    { ...command(), payload: undefined }, { ...command(), extra: true }]) assert.throws(() => assertCommand(value));
});

test('JSON state cannot silently lose values during persistence', () => {
  const cycle: unknown[] = []; cycle.push(cycle);
  const nonIndex = Object.assign([], { '4294967295': 'lost by JSON.stringify' });
  for (const value of [undefined, -0, NaN, Infinity, 1n, new Date(), new Map(), [undefined], Array(1), cycle,
    nonIndex, { run() {} }, { [Symbol('hidden')]: true }]) assert.throws(() => assertJsonValue(value));
  let invoked = false;
  assert.throws(() => assertJsonValue({ get bad() { invoked = true; return 1; } }));
  assert.equal(invoked, false);
  const plain = { text: '盟軍指揮官', children: [null, false, 1.5], child: { a: 1 } };
  assert.doesNotThrow(() => assertJsonValue(plain));
  assert.deepEqual(JSON.parse(JSON.stringify(plain)), plain);
});

test('hostile nesting and declared array sizes are bounded', () => {
  let nested: unknown = null;
  for (let i = 0; i < 66; i++) nested = [nested];
  assert.throws(() => assertJsonValue(nested), /limits/);
  assert.throws(() => assertJsonValue(Array(100_001)), /limits/);
});
