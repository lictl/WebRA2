// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalPracticeStorage } from '../../apps/web/src/practice-storage.ts';
// Event-contract fake for error/abort wiring; actual IndexedDB durability is a separate browser gate.
function fake() {
  const slots = new Map<number, string>(); const names: [string, number | undefined][] = []; let quota = false, blocked = false, hold = false, aborts = 0, closes = 0;
  const factory = { open(name: string, version?: number) {
    names.push([name, version]); const open: any = {};
    const database = { close() { closes++; }, objectStoreNames: { contains() { return true; } }, transaction() {
      const transaction: any = { abort() { aborts++; queueMicrotask(() => transaction.onabort?.()); }, objectStore() {
        function request(kind: string, key: number, value?: string) {
          const request: any = {}; queueMicrotask(() => {
            if (quota) { request.error = new DOMException('Full', 'QuotaExceededError'); request.onerror?.(); return; }
            if (kind === 'get') request.result = slots.get(key);
            request.onsuccess?.(); if (hold) return;
            if (kind === 'put') slots.set(key, value!); if (kind === 'delete') slots.delete(key); transaction.oncomplete?.();
          }); return request;
        }
        return { get: (key: number) => request('get', key), put: (text: string, key: number) => request('put', key, text), delete: (key: number) => request('delete', key) };
      } }; return transaction;
    } };
    queueMicrotask(() => { if (blocked) { open.onblocked?.(); return; } open.result = database; open.onsuccess?.(); }); return open;
  } };
  return { storage: new LocalPracticeStorage(factory as unknown as IDBFactory), slots, names, quota() { quota = true; }, blocked() { blocked = true; }, hold() { hold = true; }, get aborts() { return aborts; }, get closes() { return closes; } };
}
test('IndexedDB adapter uses fixed origin-local database/slot keys and waits for transaction completion', async () => {
  const fixture = fake(), signal = new AbortController().signal;
  assert.equal(await fixture.storage.read(1, signal), null);
  await fixture.storage.write(2, '{"original":true}', signal); assert.equal(await fixture.storage.read(2, signal), '{"original":true}');
  await fixture.storage.remove(2, signal); assert.equal(await fixture.storage.read(2, signal), null);
  assert.ok(fixture.names.every(([name, version]) => name === 'webra2-practice-v1' && version === 1)); assert.equal(fixture.closes, 5);
  await assert.rejects(fixture.storage.write(4 as 1, '{}', signal), /invalid/); assert.equal(fixture.names.length, 5);
});
test('IndexedDB adapter maps quota/blocked errors and aborts a cancelled uncommitted transaction', async () => {
  const quota = fake(); quota.quota(); await assert.rejects(quota.storage.write(1, '{}', new AbortController().signal), /quota/);
  const blocked = fake(); blocked.blocked(); await assert.rejects(blocked.storage.read(1, new AbortController().signal), /storage/);
  const fixture = fake(); fixture.hold(); const abort = new AbortController(); const write = fixture.storage.write(1, '{}', abort.signal);
  await new Promise<void>(resolve => queueMicrotask(() => queueMicrotask(resolve))); abort.abort();
  await assert.rejects(write, { name: 'AbortError' }); assert.equal(fixture.slots.size, 0); assert.equal(fixture.aborts, 1);
  const cancelled = new AbortController(); cancelled.abort(); await assert.rejects(fixture.storage.read(1, cancelled.signal), { name: 'AbortError' });
});
