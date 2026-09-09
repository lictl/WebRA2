// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original synthetic worker lifecycle tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerInspector, type ImportWorkerPort } from '../../apps/web/src/import-bridge.ts';
import { attachImportWorker, type ImportWorkerScope } from '../../apps/web/src/import-worker-runtime.ts';
import { ImportController } from '../../apps/web/src/controller.ts';
import type { ImportReply } from '../../apps/web/src/import-protocol.ts';
import type { BrowserImportReport, BrowserImportOptions, ImportProgress } from '../../packages/vfs/src/browser-types.ts';
const progress: ImportProgress = { phase: 'archives', totalFiles: 1, filesProcessed: 0, archives: 1, members: 2, bytesRead: 30 };
function report(): BrowserImportReport { return { schemaVersion: 1, profile: 'ra2', policy: 'tolerant', status: 'inspected', files: [], archives: [], requirements: [], diagnostics: [], summary: { selectedFiles: 0, acceptedFiles: 0, ignoredFiles: 0, archives: 0, members: 0, namedMembers: 0, bytesRead: 0 }, canStartCampaign: false }; }
class FakeWorker implements ImportWorkerPort {
  onmessage: Worker['onmessage'] = null; onerror: Worker['onerror'] = null; onmessageerror: Worker['onmessageerror'] = null;
  sent: unknown[] = []; terminations = 0;
  postMessage(value: unknown) { this.sent.push(value); }
  terminate() { this.terminations++; }
  emit(value: unknown) { this.onmessage?.call(this as unknown as Worker, { data: value } as MessageEvent); }
}
const files = () => [new File(['synthetic'], 'rules.ini')];
test('bridge preserves explicit folder metadata, acknowledges progress, and disposes completed workers', async () => {
  const worker = new FakeWorker(), selected = files(), values: ImportProgress[] = [];
  Object.defineProperty(selected[0], 'webkitRelativePath', { value: 'game/資料/rules.ini' });
  const done = createWorkerInspector(() => worker)(selected, { profile: 'ra2', policy: 'tolerant', onProgress: value => values.push(value) });
  assert.deepEqual(worker.sent[0], { version: 1, type: 'inspect', jobId: 1, files: [{ file: selected[0], relativePath: 'game/資料/rules.ini' }], profile: 'ra2', policy: 'tolerant' });
  worker.emit({ version: 1, type: 'progress', jobId: 1, sequence: 1, progress });
  assert.deepEqual(values, [progress]); assert.deepEqual(worker.sent[1], { version: 1, type: 'ack', jobId: 1, sequence: 1 });
  worker.emit({ version: 1, type: 'report', jobId: 1, report: report() });
  assert.deepEqual(await done, report()); assert.equal(worker.terminations, 1); assert.equal(worker.onmessage, null); assert.equal(worker.onerror, null);
});
test('abort terminates immediately; replacement ignores retained old events and mismatched generations', async () => {
  const workers: FakeWorker[] = [], inspect = createWorkerInspector(() => { const worker = new FakeWorker(); workers.push(worker); return worker; });
  const controller = new ImportController(inspect); controller.select(files()); const first = controller.inspect();
  const oldHandler = workers[0]!.onmessage!; controller.select(files()); const second = controller.inspect();
  assert.equal(workers[0]!.terminations, 1); await first;
  oldHandler.call(workers[0] as unknown as Worker, { data: { version: 1, type: 'report', jobId: 1, report: report() } } as MessageEvent);
  workers[1]!.emit({ version: 1, type: 'report', jobId: 1, report: report() }); assert.equal(controller.snapshot().phase, 'inspecting');
  workers[1]!.emit({ version: 1, type: 'report', jobId: 2, report: report() }); await second;
  assert.equal(controller.snapshot().phase, 'complete'); assert.equal(workers[1]!.terminations, 1);
});
test('pre-abort avoids worker creation; dispose terminates a running job; no main-thread fallback', async () => {
  const abort = new AbortController(); abort.abort(); let created = 0;
  const inspect = createWorkerInspector(() => { created++; return new FakeWorker(); });
  await assert.rejects(inspect(files(), { profile: 'ra2', policy: 'tolerant', signal: abort.signal }), { name: 'AbortError' }); assert.equal(created, 0);
  const worker = new FakeWorker(), controller = new ImportController(createWorkerInspector(() => worker));
  controller.select(files()); const done = controller.inspect(); controller.dispose(); await done; assert.equal(worker.terminations, 1);
  await assert.rejects(createWorkerInspector(() => { throw new DOMException('private URL', 'SecurityError'); })(files(), { profile: 'ra2', policy: 'tolerant' }), error => error instanceof Error && error.name === 'SecurityError' && !error.message.includes('private URL'));
});
test('worker errors and invalid messages fail closed without exposing arbitrary payloads', async () => {
  for (const message of [{ version: 2, type: 'report', jobId: 1 }, { version: 1, type: 'progress', jobId: 1, sequence: 1, progress: { ...progress, bytesRead: 2 ** 30 } },
    { version: 1, type: 'report', jobId: 1, report: { ...report(), canStartCampaign: true } },
    { version: 1, type: 'report', jobId: 1, report: { ...report(), files: [null], summary: {} } }, { version: 1, type: 'error', jobId: 1, name: 'PRIVATE CONTENT' }]) {
    const worker = new FakeWorker(); const done = createWorkerInspector(() => worker)(files(), { profile: 'ra2', policy: 'tolerant' }); worker.emit(message);
    await assert.rejects(done, error => error instanceof Error && error.name === 'Error' && !error.message.includes('PRIVATE')); assert.equal(worker.terminations, 1);
  }
  for (const event of ['error', 'messageerror'] as const) {
    const worker = new FakeWorker(); const done = createWorkerInspector(() => worker)(files(), { profile: 'ra2', policy: 'tolerant' });
    if (event === 'error') worker.onerror?.call(worker as unknown as Worker, { preventDefault() {} } as ErrorEvent);
    else worker.onmessageerror?.call(worker as unknown as Worker, {} as MessageEvent);
    await assert.rejects(done); assert.equal(worker.terminations, 1);
  }
});
test('structured-clone failures terminate workers and callback cancellation sends no acknowledgement', async () => {
  const worker = new FakeWorker(); worker.postMessage = () => { throw new DOMException('private', 'DataCloneError'); };
  await assert.rejects(createWorkerInspector(() => worker)(files(), { profile: 'ra2', policy: 'tolerant' }), { name: 'DataCloneError' }); assert.equal(worker.terminations, 1);
  const another = new FakeWorker(), abort = new AbortController();
  const done = createWorkerInspector(() => another)(files(), { profile: 'ra2', policy: 'tolerant', signal: abort.signal, onProgress() { abort.abort(); } });
  another.emit({ version: 1, type: 'progress', jobId: 1, sequence: 1, progress }); await assert.rejects(done, { name: 'AbortError' }); assert.equal(another.sent.length, 1);
});
function runtime(inspect: Parameters<typeof attachImportWorker>[1]) {
  const sent: ImportReply[] = [], scope: ImportWorkerScope = { onmessage: null, postMessage(value) { sent.push(value); } };
  attachImportWorker(scope, inspect);
  return { sent, receive(value: unknown) { scope.onmessage!({ data: value }); } };
}
const request = () => ({ version: 1, type: 'inspect', jobId: 7, profile: 'ra2', policy: 'tolerant', files: [{ file: new File(['original'], 'rules.ini'), relativePath: 'game/mod/rules.ini' }] });
test('runtime preserves File payloads/folder paths and bounds pending progress to one message plus latest metadata', async () => {
  let options!: BrowserImportOptions, resolve!: (value: BrowserImportReport) => void, calls = 0;
  const worker = runtime((selected, value) => { calls++; options = value; assert.equal(selected[0]!.webkitRelativePath, 'game/mod/rules.ini'); assert.equal(selected[0]!.size, 8); return new Promise(done => { resolve = done; }); });
  worker.receive(request()); worker.receive(request()); assert.equal(calls, 1);
  for (let i = 0; i < 1000; i++) options.onProgress!({ ...progress, bytesRead: i });
  assert.equal(worker.sent.length, 1);
  worker.receive({ version: 1, type: 'ack', jobId: 8, sequence: 1 }); assert.equal(worker.sent.length, 1);
  worker.receive({ version: 1, type: 'ack', jobId: 7, sequence: 1 }); assert.equal(worker.sent.length, 2);
  assert.deepEqual(worker.sent[1], { version: 1, type: 'progress', jobId: 7, sequence: 2, progress: { ...progress, bytesRead: 999 } });
  resolve(report()); await Promise.resolve(); assert.equal(worker.sent[2]?.type, 'report');
  worker.receive({ version: 1, type: 'ack', jobId: 7, sequence: 2 }); assert.equal(worker.sent.length, 3);
});
test('runtime rejects wrong profiles, over-cap and non-File inputs before inspection and sanitizes failures', async () => {
  for (const invalid of [{ ...request(), profile: 'other' }, { ...request(), files: Array(4097) }, { ...request(), files: [{ file: {}, relativePath: '' }] },
    { ...request(), files: [{ file: new File([], 'x'), relativePath: 'x'.repeat(4097) }] }]) {
    const worker = runtime(async () => { assert.fail('invalid request must not reach importer'); }); worker.receive(invalid); await Promise.resolve();
    assert.deepEqual(worker.sent, [{ version: 1, type: 'error', jobId: 7, name: 'TypeError' }]);
  }
  const worker = runtime(async () => { throw { name: 'SECRET', message: 'private payload' }; }); worker.receive(request()); await Promise.resolve();
  assert.deepEqual(worker.sent, [{ version: 1, type: 'error', jobId: 7, name: 'Error' }]);
});

test('real synthetic importer reports cross validation; malformed nested metadata fails before the UI', async () => {
  const { inspectInstallation } = await import('../../packages/vfs/src/browser-import.ts');
  const { validImportReport } = await import('../../apps/web/src/import-report-validation.ts');
  // One classic member and one loose requirement are original synthetic bytes.
  const bytes = new Uint8Array(24), view = new DataView(bytes.buffer);
  view.setUint16(0, 1, true); view.setUint32(2, 6, true); view.setUint32(6, 123, true); view.setUint32(14, 6, true);
  const value = await inspectInstallation([new File([bytes], 'ra2.mix'), new File(['original'], 'rules.ini')], { profile: 'ra2', policy: 'tolerant' });
  assert.equal(validImportReport(value), true);
  for (const corrupt of [
    (r: any) => { r.unexpected = new Blob(['must not propagate']); }, (r: any) => { r.files[0].payload = new Uint8Array(1); },
    (r: any) => { r.summary.bytesRead = -1; }, (r: any) => { r.files[0].size = Infinity; }, (r: any) => { r.files[0].kind = 'executable-code'; },
    (r: any) => { r.archives[0].nameCandidates = [null]; }, (r: any) => { r.archives[0].members[0].names = [null]; },
    (r: any) => { r.archives[0].members[0].nameEvidence = [{ name: 'x', source: null, hashKind: 'classic' }]; },
    (r: any) => { r.requirements[0].matches[0].sourceId = 'missing'; }, (r: any) => { r.diagnostics.push({ code: 'x', severity: 'unknown' }); },
  ]) { const changed = structuredClone(value); corrupt(changed); assert.equal(validImportReport(changed), false); }
});
