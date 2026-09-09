// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic diagnostics only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { displayDiagnostics } from '../../apps/web/src/report.ts';
import { diagnosticText } from '../../apps/web/src/i18n.ts';
import type { BrowserImportDiagnostic } from '../../packages/vfs/src/browser-types.ts';
test('late actionable errors remain visible ahead of informational selection noise', () => {
  const info: BrowserImportDiagnostic[] = Array.from({ length: 120 }, (_, i) => ({ severity: 'info', code: `info-${i}` }));
  const source: BrowserImportDiagnostic[] = [...info, { severity: 'warning', code: 'checksum-unverified' }, { severity: 'error', code: 'archive-unverified' }];
  const result = displayDiagnostics(source);
  assert.equal(result.length, 100);
  assert.deepEqual(result.slice(0, 4).map(x => x.code), ['archive-unverified', 'checksum-unverified', 'info-0', 'info-1']);
  assert.equal(source[0]?.code, 'info-0'); assert.equal(source.length, 122);
});
test('diagnostic explanations provide translated recovery without reflecting arbitrary payloads', () => {
  assert.match(diagnosticText('en', 'archive-unverified'), /Strict mode/);
  assert.match(diagnosticText('zh-Hant', 'archive-unverified'), /嚴格模式/);
  assert.match(diagnosticText('zh-Hant', 'browser-read-budget'), /較少的檔案/);
  assert.doesNotMatch(diagnosticText('en', '<svg onload=attack()>'), /svg|attack/);
});
