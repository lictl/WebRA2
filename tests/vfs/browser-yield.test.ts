// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original scheduling fixtures; no timing thresholds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PENDING_BROWSER_YIELDS, yieldBrowserTask } from '../../packages/vfs/src/browser-yield.ts';

class Port {
  onmessage: (() => void) | null = null; onmessageerror: (() => void) | null = null;
  closed = 0; sent: unknown[] = [];
  close() { this.closed++; }
  postMessage(value: unknown) { this.sent.push(value); }
}
function channels(hooks: { constructed?: () => void; posted?: () => void } = {}) {
  const original = globalThis.MessageChannel, opened: { port1: Port; port2: Port }[] = [];
  class Channel {
    port1 = new Port(); port2 = new Port();
    constructor() {
      opened.push(this);
      this.port2.postMessage = value => { this.port2.sent.push(value); hooks.posted?.(); };
      hooks.constructed?.();
    }
  }
  globalThis.MessageChannel = Channel as unknown as typeof MessageChannel;
  return { opened, restore() { globalThis.MessageChannel = original; } };
}
test('native yield crosses a task boundary after the current microtask checkpoint', async () => {
  const order = ['call'], task = yieldBrowserTask().then(() => { order.push('task'); });
  await Promise.resolve(); order.push('microtask'); assert.deepEqual(order, ['call', 'microtask']);
  await task; assert.deepEqual(order, ['call', 'microtask', 'task']);
});
test('successful delivery closes both ports, clears handlers and ignores duplicate delivery', async () => {
  const fake = channels();
  try {
    const task = yieldBrowserTask(), channel = fake.opened[0]!, delivery = channel.port1.onmessage!;
    assert.deepEqual(channel.port2.sent, [0]); delivery(); await task; delivery();
    assert.equal(channel.port1.closed, 1); assert.equal(channel.port2.closed, 1);
    assert.equal(channel.port1.onmessage, null); assert.equal(channel.port1.onmessageerror, null);
  } finally { fake.restore(); }
});
test('pre-abort allocates no channel; in-flight abort closes ports and removes its listener', async () => {
  const fake = channels(), before = new AbortController(), during = new AbortController(); before.abort();
  let removed = 0; const originalRemove = during.signal.removeEventListener.bind(during.signal);
  during.signal.removeEventListener = (...args: Parameters<typeof originalRemove>) => { removed++; return originalRemove(...args); };
  try {
    await assert.rejects(yieldBrowserTask(before.signal), { name: 'AbortError' }); assert.equal(fake.opened.length, 0);
    const task = yieldBrowserTask(during.signal), late = fake.opened[0]!.port1.onmessage!;
    during.abort(); await assert.rejects(task, { name: 'AbortError' }); late();
    assert.equal(removed, 1); assert.equal(fake.opened[0]!.port1.closed, 1); assert.equal(fake.opened[0]!.port2.closed, 1);
  } finally { fake.restore(); }
});
test('abort during channel construction still closes the returned ports without posting', async () => {
  const controller = new AbortController(), fake = channels({ constructed() { controller.abort(); } });
  try {
    await assert.rejects(yieldBrowserTask(controller.signal), { name: 'AbortError' });
    assert.equal(fake.opened[0]!.port1.closed, 1); assert.equal(fake.opened[0]!.port2.closed, 1); assert.deepEqual(fake.opened[0]!.port2.sent, []);
  } finally { fake.restore(); }
});
test('reentrant posting keeps independent lifetimes and the global pending cap rejects before allocation', async () => {
  let nested!: Promise<void>;
  const fake = channels({ posted() { if (fake.opened.length === 1) nested = yieldBrowserTask(); } });
  try {
    const first = yieldBrowserTask(); assert.equal(fake.opened.length, 2);
    fake.opened[0]!.port1.onmessage!(); await first; assert.equal(fake.opened[1]!.port1.closed, 0);
    fake.opened[1]!.port1.onmessage!(); await nested;
    const tasks = Array.from({ length: MAX_PENDING_BROWSER_YIELDS }, () => yieldBrowserTask());
    await assert.rejects(yieldBrowserTask(), /browser-yield-limit/); assert.equal(fake.opened.length, MAX_PENDING_BROWSER_YIELDS + 2);
    for (const channel of fake.opened.slice(2)) channel.port1.onmessage!(); await Promise.all(tasks);
    const next = yieldBrowserTask(); fake.opened.at(-1)!.port1.onmessage!(); await next;
  } finally { fake.restore(); }
});
test('scheduling and delivery failures reject and close every available port', async () => {
  const fake = channels({ posted() { throw new Error('synthetic post failure'); } });
  try {
    await assert.rejects(yieldBrowserTask(), /browser-yield-schedule/);
    assert.equal(fake.opened[0]!.port1.closed, 1); assert.equal(fake.opened[0]!.port2.closed, 1);
  } finally { fake.restore(); }
  const broken = channels();
  try {
    const task = yieldBrowserTask(); broken.opened[0]!.port1.onmessageerror!(); await assert.rejects(task, /browser-yield-message/);
    assert.equal(broken.opened[0]!.port1.closed, 1); assert.equal(broken.opened[0]!.port2.closed, 1);
  } finally { broken.restore(); }
  const original = globalThis.MessageChannel;
  try {
    globalThis.MessageChannel = class { constructor() { throw new Error('synthetic constructor failure'); } } as unknown as typeof MessageChannel;
    await assert.rejects(yieldBrowserTask(), /browser-yield-schedule/);
  } finally { globalThis.MessageChannel = original; }
  await yieldBrowserTask();
});
test('unavailable MessageChannel uses one cancellable timer and surfaces fallback scheduling errors', async () => {
  const originalChannel = globalThis.MessageChannel, originalTimer = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
  let callback!: () => void, timers = 0, cleared = 0;
  try {
    (globalThis as unknown as { MessageChannel: undefined }).MessageChannel = undefined;
    globalThis.setTimeout = ((fn: () => void) => { callback = fn; timers++; return 7; }) as unknown as typeof setTimeout;
    globalThis.clearTimeout = (() => { cleared++; }) as typeof clearTimeout;
    const successful = yieldBrowserTask(); assert.equal(timers, 1); callback(); await successful; assert.equal(cleared, 1);
    const controller = new AbortController(), task = yieldBrowserTask(controller.signal);
    controller.abort(); await assert.rejects(task, { name: 'AbortError' }); callback(); assert.equal(timers, 2); assert.equal(cleared, 2);
    globalThis.setTimeout = (() => { throw new Error('synthetic timer failure'); }) as unknown as typeof setTimeout;
    await assert.rejects(yieldBrowserTask(), /browser-yield-schedule/);
  } finally { globalThis.MessageChannel = originalChannel; globalThis.setTimeout = originalTimer; globalThis.clearTimeout = originalClear; }
  await yieldBrowserTask();
});
