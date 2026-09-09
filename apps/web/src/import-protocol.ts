// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. App-private worker protocol, not an engine contract.
import type { BrowserImportOptions, BrowserImportReport, ImportProgress } from '../../../packages/vfs/src/browser-types.ts';
export const IMPORT_PROTOCOL = 1;
export const MAX_WORKER_FILES = 4096;
export const MAX_WORKER_PATH = 4096;
export interface ImportRequest {
  readonly version: 1; readonly type: 'inspect'; readonly jobId: number;
  readonly files: readonly { readonly file: File; readonly relativePath: string }[];
  readonly profile: BrowserImportOptions['profile']; readonly policy: BrowserImportOptions['policy'];
}
export interface ProgressAck { readonly version: 1; readonly type: 'ack'; readonly jobId: number; readonly sequence: number }
export type ImportReply =
  | { readonly version: 1; readonly type: 'progress'; readonly jobId: number; readonly sequence: number; readonly progress: ImportProgress }
  | { readonly version: 1; readonly type: 'report'; readonly jobId: number; readonly report: BrowserImportReport }
  | { readonly version: 1; readonly type: 'error'; readonly jobId: number; readonly name: string };
export function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object'; }
export function positiveInteger(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) > 0; }
const publicErrors = new Set(['AbortError', 'NotReadableError', 'NotFoundError', 'SecurityError', 'DataCloneError', 'TypeError', 'RangeError']);
export function errorName(value: unknown): string {
  const name = record(value) ? value.name : value;
  return typeof name === 'string' && publicErrors.has(name) ? name : 'Error';
}
export function validProgress(value: unknown): value is ImportProgress {
  return record(value) && ['validate', 'archives', 'requirements'].includes(String(value.phase)) &&
    ['filesProcessed', 'totalFiles', 'archives', 'members', 'bytesRead'].every(key => Number.isSafeInteger(value[key]) && (value[key] as number) >= 0) &&
    (value.totalFiles as number) <= MAX_WORKER_FILES && (value.filesProcessed as number) <= (value.totalFiles as number) &&
    (value.archives as number) <= 512 && (value.members as number) <= 250_000 && (value.bytesRead as number) <= 64 * 1024 * 1024 &&
    (value.currentPath === undefined || (typeof value.currentPath === 'string' && value.currentPath.length <= MAX_WORKER_PATH));
}
