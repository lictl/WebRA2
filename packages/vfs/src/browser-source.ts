// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Composes the attributed MIX ByteSource contract.
import { assertRange, type ByteSource } from '../../formats/src/mix.ts';

export const BROWSER_RANGE_BYTES = 1024 * 1024;
let outstandingBuffers = 0;
export class BrowserSourceError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'BrowserSourceError'; }
}
export function throwIfImportAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Local inspection cancelled', 'AbortError');
}
export interface BrowserSourceOptions {
  readonly signal?: AbortSignal;
  /** Called before allocating a range; may reject a shared operation budget. */
  readonly beforeRead?: (length: number) => void;
  readonly onRead?: (length: number) => void;
}
interface WorkerSyncReader { readAsArrayBuffer(blob: Blob): ArrayBuffer }
type WorkerSyncReaderConstructor = new () => WorkerSyncReader;
function dedicatedWorkerReader(): WorkerSyncReaderConstructor | undefined {
  // Keep the DOM build's types narrow; Worker globals are capability-checked and
  // never invoked on the main thread, in a shared worker or a service worker.
  const scope = globalThis as unknown as {
    DedicatedWorkerGlobalScope?: { new (...args: never[]): object };
    FileReaderSync?: WorkerSyncReaderConstructor;
  };
  return typeof scope.DedicatedWorkerGlobalScope === 'function' && globalThis instanceof scope.DedicatedWorkerGlobalScope &&
    typeof scope.FileReaderSync === 'function' ? scope.FileReaderSync : undefined;
}
/** One in-flight range per adapter, at most four underlying range operations per module. */
export function createBrowserByteSource(blob: Blob, options: BrowserSourceOptions = {}): ByteSource {
  if (!(blob instanceof Blob) || !Number.isSafeInteger(blob.size)) throw new BrowserSourceError('browser-source-type');
  const size = blob.size, signal = options.signal, beforeRead = options.beforeRead, onRead = options.onRead;
  const SyncReader = dedicatedWorkerReader(); let syncReader: WorkerSyncReader | undefined;
  let active = false;
  return Object.freeze({ size,
    async read(offset: number, length: number): Promise<Uint8Array> {
      throwIfImportAborted(signal);
      assertRange(size, offset, length);
      if (length > BROWSER_RANGE_BYTES) throw new BrowserSourceError('browser-range-limit');
      if (active) throw new BrowserSourceError('browser-source-busy');
      if (outstandingBuffers >= 4) throw new BrowserSourceError('browser-buffer-limit');
      active = true; outstandingBuffers++;
      // Callbacks can synchronously re-enter read(). Reserve ownership first,
      // then release it if the callback rejects or cancels before I/O starts.
      try { beforeRead?.(length); throwIfImportAborted(signal); }
      catch (error) { active = false; outstandingBuffers--; throw error; }
      if (!length) { active = false; outstandingBuffers--; return new Uint8Array(0); }
      if (SyncReader) {
        try {
          syncReader ??= new SyncReader();
          throwIfImportAborted(signal);
          const range = blob.slice(offset, offset + length);
          throwIfImportAborted(signal);
          const bytes = new Uint8Array(syncReader.readAsArrayBuffer(range));
          if (bytes.length !== length) throw new BrowserSourceError('browser-short-read');
          onRead?.(bytes.length); throwIfImportAborted(signal);
          return bytes;
        } finally { active = false; outstandingBuffers--; }
      }
      // Blob.arrayBuffer cannot be stopped, so cancellation rejects promptly while
      // its bounded operation keeps the slot until it settles. A cancelled job
      // cannot clear the guard early and start more underlying reads.
      let listener: (() => void) | undefined;
      const cancelled = new Promise<never>((_resolve, reject) => {
        listener = () => reject(new DOMException('Local inspection cancelled', 'AbortError'));
        signal?.addEventListener('abort', listener, { once: true });
      });
      const pending = (async () => {
        try {
          const bytes = new Uint8Array(await blob.slice(offset, offset + length).arrayBuffer());
          if (bytes.length !== length) throw new BrowserSourceError('browser-short-read');
          onRead?.(bytes.length);
          throwIfImportAborted(signal);
          return bytes;
        } finally { active = false; outstandingBuffers--; }
      })();
      try { return await Promise.race([pending, cancelled]); }
      finally { if (listener) signal?.removeEventListener('abort', listener); }
    },
  });
}
