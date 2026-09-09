// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors.
import type { Inspector } from './controller.ts';
import { IMPORT_PROTOCOL, MAX_WORKER_FILES, MAX_WORKER_PATH, errorName, positiveInteger, record, validProgress, type ImportRequest, type ProgressAck } from './import-protocol.ts';
import type { BrowserImportReport } from '../../../packages/vfs/src/browser-types.ts';
export type ImportWorkerPort = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>;
function failure(name = 'Error'): Error { const error = new Error('Local import worker failed'); error.name = name; return error; }
/** One worker per job; cancellation also interrupts a worker inside a synchronous File read. */
export function createWorkerInspector(createWorker: () => ImportWorkerPort = () => new Worker('/workers/import.js', { type: 'module' })): Inspector {
  let generation = 0;
  return (files, options) => new Promise((resolve, reject) => {
    if (options.signal?.aborted) { reject(failure('AbortError')); return; }
    if (files.length > MAX_WORKER_FILES) { reject(failure('RangeError')); return; }
    const jobId = ++generation;
    let worker: ImportWorkerPort | undefined, finished = false, lastSequence = 0;
    const finish = (report?: BrowserImportReport, error?: Error) => {
      if (finished) return;
      finished = true;
      options.signal?.removeEventListener('abort', abort);
      if (worker) { worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null; worker.terminate(); }
      if (report) resolve(report); else reject(error ?? failure());
    };
    const abort = () => finish(undefined, failure('AbortError'));
    try {
      const selected = files.map(file => {
        const relativePath = file.webkitRelativePath || '';
        if (relativePath.length > MAX_WORKER_PATH || file.name.length > MAX_WORKER_PATH) throw failure('RangeError');
        return { file, relativePath };
      });
      worker = createWorker();
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) { abort(); return; }
      worker.onerror = event => { event.preventDefault(); finish(); };
      worker.onmessageerror = () => finish(undefined, failure('DataCloneError'));
      worker.onmessage = event => {
        if (finished) return;
        const value: unknown = event.data;
        if (!record(value) || value.version !== IMPORT_PROTOCOL || !positiveInteger(value.jobId)) { finish(); return; }
        if (value.jobId !== jobId) return;
        try {
          if (value.type === 'progress' && positiveInteger(value.sequence) && value.sequence > lastSequence && validProgress(value.progress)) {
            lastSequence = value.sequence;
            options.onProgress?.(value.progress);
            if (!finished) worker!.postMessage({ version: IMPORT_PROTOCOL, type: 'ack', jobId, sequence: lastSequence } satisfies ProgressAck);
          } else if (value.type === 'report' && record(value.report) && value.report.schemaVersion === 1 && value.report.profile === options.profile &&
            value.report.policy === options.policy && value.report.canStartCampaign === false && ['inspected', 'limited'].includes(String(value.report.status)) &&
            Array.isArray(value.report.files) && value.report.files.length <= MAX_WORKER_FILES && Array.isArray(value.report.archives) && value.report.archives.length <= 512 &&
            Array.isArray(value.report.requirements) && value.report.requirements.length <= 10 && Array.isArray(value.report.diagnostics) && value.report.diagnostics.length <= 4096 && record(value.report.summary)) {
            finish(value.report as unknown as BrowserImportReport);
          } else if (value.type === 'error') finish(undefined, failure(errorName(value.name)));
          else finish();
        } catch { finish(); }
      };
      worker.postMessage({ version: IMPORT_PROTOCOL, type: 'inspect', jobId, files: selected, profile: options.profile, policy: options.policy } satisfies ImportRequest);
    } catch (error) { finish(undefined, failure(errorName(error))); }
  });
}
