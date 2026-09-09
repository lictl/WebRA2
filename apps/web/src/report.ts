// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors.
import type { BrowserImportDiagnostic } from '../../../packages/vfs/src/browser-types.ts';
/** Keep actionable failures visible when the presentation cap truncates a report. */
export function displayDiagnostics(items: readonly BrowserImportDiagnostic[]): readonly BrowserImportDiagnostic[] {
  const result: BrowserImportDiagnostic[] = [];
  for (const severity of ['error', 'warning', 'info']) {
    for (const item of items) if (item.severity === severity) {
      result.push(item); if (result.length === 100) return result;
    }
  }
  return result;
}
