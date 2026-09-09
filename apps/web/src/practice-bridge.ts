// SPDX-License-Identifier: GPL-3.0-or-later
import { fields, validAction, validSnapshot, type PracticeAction, type PracticeSnapshot } from './practice-protocol.ts';
export type PracticeResult = { snapshot: PracticeSnapshot; verified: boolean };
export interface PracticePort { request(action: PracticeAction, signal: AbortSignal): Promise<PracticeResult>; dispose(): void }
export type WorkerPort = Pick<Worker, 'postMessage' | 'terminate' | 'addEventListener' | 'removeEventListener'>;
export class PracticeBridge implements PracticePort {
  #sequence = 0; #pending: ((error: Error) => void) | null = null; #dead = false;
  constructor(private readonly worker: WorkerPort = new Worker('/workers/simulation.js', { type: 'module' })) {}
  request(action: PracticeAction, signal: AbortSignal): Promise<PracticeResult> {
    if (this.#dead || this.#pending || !validAction(action)) return Promise.reject(new Error('unavailable'));
    if (signal.aborted) { this.dispose(); return Promise.reject(new DOMException('Cancelled', 'AbortError')); }
    const id = ++this.#sequence;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error, value?: PracticeResult) => {
        if (settled) return; settled = true; clearTimeout(timeout); signal.removeEventListener('abort', abort);
        this.worker.removeEventListener('message', message); this.worker.removeEventListener('error', failed); this.worker.removeEventListener('messageerror', failed); this.#pending = null;
        if (error) { this.#dead = true; this.worker.terminate(); reject(error); } else resolve(value!);
      };
      const abort = () => finish(new DOMException('Cancelled', 'AbortError'));
      const failed = () => finish(new Error('unavailable'));
      const message = (event: Event) => {
        const data: unknown = (event as MessageEvent).data;
        if (!data || typeof data !== 'object' || !Object.hasOwn(data, 'id') || (data as { id: unknown }).id !== id) return;
        if (fields(data, ['version', 'id', 'ok', 'snapshot', 'verified']) && data.version === 1 && data.ok === true && typeof data.verified === 'boolean' && validSnapshot(data.snapshot)) finish(undefined, { snapshot: data.snapshot, verified: data.verified });
        else if (fields(data, ['version', 'id', 'ok', 'error']) && data.version === 1 && data.ok === false && (data.error === 'invalid' || data.error === 'limit' || data.error === 'unavailable')) finish(new Error(data.error));
        else finish(new Error('invalid'));
      };
      const timeout = setTimeout(() => finish(new Error('unavailable')), 15_000);
      this.#pending = error => finish(error);
      signal.addEventListener('abort', abort, { once: true }); this.worker.addEventListener('message', message); this.worker.addEventListener('error', failed); this.worker.addEventListener('messageerror', failed);
      try { this.worker.postMessage({ version: 1, id, action }); } catch { failed(); }
    });
  }
  dispose(): void { if (this.#dead) return; this.#dead = true; this.#pending?.(new DOMException('Cancelled', 'AbortError')); this.worker.terminate(); }
}
