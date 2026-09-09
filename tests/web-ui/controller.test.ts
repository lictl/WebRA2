// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original synthetic selection/job tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ImportController, type Inspector } from '../../apps/web/src/controller.ts';
import { translate, localeFromLanguage, formatBytes } from '../../apps/web/src/i18n.ts';
import type { BrowserImportOptions, BrowserImportReport } from '../../packages/vfs/src/browser-types.ts';
function report(profile: 'ra2' | 'yr' = 'ra2', policy: 'tolerant' | 'strict' = 'tolerant'): BrowserImportReport {
  return { schemaVersion: 1, profile, policy, status: 'inspected', files: [], archives: [], requirements: [], diagnostics: [],
    summary: { selectedFiles: 1, acceptedFiles: 1, ignoredFiles: 0, archives: 0, members: 0, namedMembers: 0, bytesRead: 0 }, canStartCampaign: false };
}
function pending() {
  const calls: { options: BrowserImportOptions; files: readonly File[]; resolve: (report: BrowserImportReport) => void; reject: (error: Error) => void }[] = [];
  const inspect: Inspector = (files, options) => new Promise((resolve, reject) => { calls.push({ options, files, resolve, reject }); });
  return { calls, controller: new ImportController(inspect) };
}
test('file selection stays private, is detached from caller arrays, and can be cleared', () => {
  const { controller } = pending(); const files = [new File(['123'], '測試.ini'), new File(['45'], 'rules.ini')];
  controller.select(files); files.pop();
  assert.deepEqual(controller.snapshot().selection, { count: 2, bytes: 5, preview: ['測試.ini', 'rules.ini'] });
  assert.equal('files' in controller.snapshot(), false); assert.equal(controller.snapshot().phase, 'selected');
  assert.ok(Object.isFrozen(controller.snapshot().selection.preview));
  controller.clear(); assert.equal(controller.snapshot().phase, 'empty'); assert.equal(controller.snapshot().selection.count, 0);
});
test('progress, completion and policy/profile metadata belong to the selected job', async () => {
  const { calls, controller } = pending(); controller.select([new File(['x'], 'ra2.mix')]); controller.setProfile('yr'); controller.setPolicy('strict');
  const done = controller.inspect(); assert.equal(controller.snapshot().phase, 'inspecting');
  assert.equal(calls[0]!.options.profile, 'yr'); assert.equal(calls[0]!.options.policy, 'strict');
  calls[0]!.options.onProgress!({ phase: 'archives', filesProcessed: 1, totalFiles: 1, archives: 2, members: 10, bytesRead: 24 });
  assert.equal(controller.snapshot().progress?.members, 10);
  calls[0]!.resolve(report('yr', 'strict')); await done;
  assert.equal(controller.snapshot().phase, 'complete'); assert.equal(controller.snapshot().report?.canStartCampaign, false);
  controller.setProfile('ra2'); assert.equal(controller.snapshot().report, null); assert.equal(controller.snapshot().phase, 'selected');
});
test('cancel aborts active work and ignores late progress/completion without losing selection', async () => {
  const { calls, controller } = pending(); controller.select([new File(['x'], 'ra2.mix')]);
  const first = controller.inspect(); controller.cancel();
  assert.equal(calls[0]!.options.signal?.aborted, true); assert.equal(controller.snapshot().phase, 'cancelled');
  calls[0]!.options.onProgress!({ phase: 'requirements', filesProcessed: 1, totalFiles: 1, archives: 90, members: 90, bytesRead: 90 });
  calls[0]!.resolve(report()); await first;
  assert.equal(controller.snapshot().progress, null); assert.equal(controller.snapshot().report, null); assert.equal(controller.snapshot().selection.count, 1);
  const retry = controller.inspect(); calls[1]!.resolve(report()); await retry; assert.equal(controller.snapshot().phase, 'complete');
});
test('replacing files or changing profile cannot inherit an older report or error', async () => {
  const { calls, controller } = pending(); controller.select([new File(['old'], 'old.mix')]); const first = controller.inspect();
  controller.select([new File(['new'], 'new.mix')]); controller.setProfile('yr'); const second = controller.inspect();
  calls[0]!.reject(new Error('obsolete error')); await first;
  assert.equal(controller.snapshot().phase, 'inspecting'); assert.equal(controller.snapshot().error, null);
  calls[1]!.resolve(report('yr')); await second; assert.equal(controller.snapshot().report?.profile, 'yr');
  assert.deepEqual(controller.snapshot().selection.preview, ['new.mix']);
});
test('malformed contract or profile response cannot masquerade as successful inspection', async () => {
  const { calls, controller } = pending(); controller.select([new File(['x'], 'rules.ini')]); const first = controller.inspect();
  calls[0]!.resolve(report('yr')); await first;
  assert.equal(controller.snapshot().phase, 'failed'); assert.equal(controller.snapshot().report, null);
  const second = controller.inspect(); calls[1]!.resolve({ ...report(), canStartCampaign: true } as unknown as BrowserImportReport); await second;
  assert.equal(controller.snapshot().phase, 'failed'); assert.equal(controller.snapshot().report, null);
});
test('empty selections and unreadable files produce recoverable localized error keys', async () => {
  const { calls, controller } = pending(); await controller.inspect(); assert.equal(calls.length, 0); assert.equal(controller.snapshot().error, 'noFile');
  controller.select([new File(['x'], 'rules.ini')]); const first = controller.inspect();
  const error = new Error('private payload that must not appear in state'); error.name = 'NotReadableError'; calls[0]!.reject(error); await first;
  assert.equal(controller.snapshot().error, 'fileAccessFailure'); assert.equal(JSON.stringify(controller.snapshot()).includes('private payload'), false);
  controller.clear(); assert.equal(controller.snapshot().error, null);
});
test('duplicate inspect requests do not multiply jobs; dispose aborts and detaches observers', async () => {
  const { calls, controller } = pending(); let updates = 0; controller.subscribe(() => { updates++; });
  controller.select([new File(['x'], 'ra2.mix')]); const first = controller.inspect(); await controller.inspect(); assert.equal(calls.length, 1);
  controller.dispose(); const before = updates; assert.equal(calls[0]!.options.signal?.aborted, true); calls[0]!.resolve(report()); await first; assert.equal(updates, before);
});
test('locale changes preserve a running job and both shell languages contain useful messages', async () => {
  const { calls, controller } = pending(); controller.select([new File(['x'], 'rules.ini')]); const done = controller.inspect();
  controller.setLocale('zh-Hant'); assert.equal(controller.snapshot().phase, 'inspecting'); assert.equal(calls[0]!.options.signal?.aborted, false);
  assert.equal(localeFromLanguage('zh-TW'), 'zh-Hant'); assert.equal(localeFromLanguage('ja-JP'), 'en');
  assert.equal(translate('zh-Hant', 'chooseFolder'), '選擇遊戲資料夾'); assert.equal(translate('en', 'missing'), 'Missing');
  assert.equal(formatBytes(1048576, 'en'), '1 MiB'); assert.equal(formatBytes(Infinity, 'en'), '—');
  calls[0]!.resolve(report()); await done; assert.equal(controller.snapshot().locale, 'zh-Hant');
});

test('oversized selections are rejected before copying or reading file metadata', () => {
  const controller = new ImportController(async () => { throw new Error('must not inspect'); });
  controller.select([new File(['old'], 'old.mix')]);
  const huge: ArrayLike<File> = { length: 4097, get 0(): File { throw new Error('must not copy'); } };
  controller.select(huge);
  assert.equal(controller.snapshot().error, 'tooManyFiles');
  assert.equal(controller.snapshot().selection.count, 0);
  controller.select([new File(['new'], 'new.mix')]);
  assert.equal(controller.snapshot().phase, 'selected');
  assert.equal(controller.snapshot().error, null);
});
