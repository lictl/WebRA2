// SPDX-License-Identifier: GPL-3.0-or-later
import { worldDocumentText as saveText } from './world-protocol.ts';
export type SaveSlot = 1 | 2 | 3;
export interface WorldStorage { read(slot: SaveSlot, signal: AbortSignal): Promise<string | null>; write(slot: SaveSlot, text: string, signal: AbortSignal): Promise<void>; remove(slot: SaveSlot, signal: AbortSignal): Promise<void> }
export class LocalWorldStorage implements WorldStorage {
  constructor(private readonly factory: IDBFactory | undefined = globalThis.indexedDB) {}
  #transaction(slot: SaveSlot, operation: 'get' | 'put' | 'delete', text: string | undefined, signal: AbortSignal): Promise<string | null> {
    if (![1, 2, 3].includes(slot) || (operation === 'put' && !saveText(text))) return Promise.reject(new Error('invalid'));
    if (signal.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
    return new Promise((resolve, reject) => {
      let database: IDBDatabase | undefined, transaction: IDBTransaction | undefined, settled = false, result: string | null = null;
      const done = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timeout); signal.removeEventListener('abort', abort); database?.close(); error ? reject(error) : resolve(result); };
      const abort = () => { try { transaction?.abort(); } catch { /* Already finished. */ } done(new DOMException('Cancelled', 'AbortError')); };
      const failure = (error?: DOMException | null) => done(new Error(error?.name === 'QuotaExceededError' ? 'quota' : 'storage'));
      const timeout = setTimeout(() => { try { transaction?.abort(); } catch { /* Already finished. */ } failure(); }, 10_000);
      signal.addEventListener('abort', abort, { once: true });
      try {
        if (!this.factory) throw new Error('storage');
        const open = this.factory.open('webra2-world-v1', 1);
        open.onupgradeneeded = () => { if (settled) { open.transaction?.abort(); return; } if (!open.result.objectStoreNames.contains('slots')) open.result.createObjectStore('slots'); };
        open.onerror = () => failure(open.error); open.onblocked = () => failure();
        open.onsuccess = () => {
          database = open.result; if (settled) { database.close(); return; }
          database.onversionchange = () => { try { transaction?.abort(); } catch { /* Already finished. */ } failure(); };
          try {
            transaction = database.transaction('slots', operation === 'get' ? 'readonly' : 'readwrite');
            transaction.onabort = () => failure(transaction?.error); transaction.onerror = () => failure(transaction?.error); transaction.oncomplete = () => done();
            const store = transaction.objectStore('slots');
            const request = operation === 'get' ? store.get(slot) : operation === 'put' ? store.put(text, slot) : store.delete(slot);
            request.onerror = () => failure(request.error);
            request.onsuccess = () => { if (operation !== 'get') return; const value: unknown = request.result; if (value === undefined) result = null; else if (saveText(value)) result = value; else { try { transaction?.abort(); } catch { /* Already finished. */ } done(new Error('invalid')); } };
          } catch { failure(); }
        };
      } catch { failure(); }
    });
  }
  async read(slot: SaveSlot, signal: AbortSignal): Promise<string | null> { return this.#transaction(slot, 'get', undefined, signal); }
  async write(slot: SaveSlot, text: string, signal: AbortSignal): Promise<void> { await this.#transaction(slot, 'put', text, signal); }
  async remove(slot: SaveSlot, signal: AbortSignal): Promise<void> { await this.#transaction(slot, 'delete', undefined, signal); }
}
