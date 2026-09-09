// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors.
import type { Inspector } from './controller.ts';
import type { ImportProgress } from '../../../packages/vfs/src/browser-types.ts';
import { IMPORT_PROTOCOL, MAX_WORKER_FILES, MAX_WORKER_PATH, errorName, positiveInteger, record, type ImportReply } from './import-protocol.ts';
export interface ImportWorkerScope { onmessage: ((event: { data: unknown }) => void) | null; postMessage(message: ImportReply): void }
/** Trusted bundled entry only. Incoming Files remain local; no executable content is accepted. */
export function attachImportWorker(scope: ImportWorkerScope, inspect: Inspector): void {
  let started = false, finished = false, jobId = 0, sequence = 0, outstanding = 0;
  let pending: ImportProgress | null = null;
  function flush(): void {
    if (finished || outstanding || !pending) return;
    const progress = pending; pending = null; outstanding = ++sequence;
    scope.postMessage({ version: IMPORT_PROTOCOL, type: 'progress', jobId, sequence, progress });
  }
  scope.onmessage = event => {
    const value = event.data;
    if (!record(value) || value.version !== IMPORT_PROTOCOL || !positiveInteger(value.jobId)) return;
    if (value.type === 'ack') {
      if (!finished && value.jobId === jobId && value.sequence === outstanding) { outstanding = 0; flush(); }
      return;
    }
    if (started || value.type !== 'inspect') return;
    started = true; jobId = value.jobId;
    void (async () => {
      try {
        if ((value.profile !== 'ra2' && value.profile !== 'yr') || (value.policy !== 'tolerant' && value.policy !== 'strict') ||
          !Array.isArray(value.files) || value.files.length > MAX_WORKER_FILES) throw new TypeError('Invalid import request');
        const files: File[] = [];
        for (const item of value.files) {
          if (!record(item) || !(item.file instanceof File) || typeof item.relativePath !== 'string' || item.relativePath.length > MAX_WORKER_PATH || item.file.name.length > MAX_WORKER_PATH) throw new TypeError('Invalid selected file');
          // File cloning can omit the nonstandard folder path. Restore only that
          // explicit selection metadata; the importer still validates/normalizes it.
          Object.defineProperty(item.file, 'webkitRelativePath', { value: item.relativePath, configurable: true });
          files.push(item.file);
        }
        const report = await inspect(files, { profile: value.profile, policy: value.policy, onProgress(progress) { pending = progress; flush(); } });
        finished = true; pending = null;
        scope.postMessage({ version: IMPORT_PROTOCOL, type: 'report', jobId, report });
      } catch (error) {
        finished = true; pending = null;
        scope.postMessage({ version: IMPORT_PROTOCOL, type: 'error', jobId, name: errorName(error) });
      }
    })();
  };
}
