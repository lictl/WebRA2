// SPDX-License-Identifier: MIT
import { validateEvent, MEDIA_LIMITS, type Header, type MediaEvent } from './session.ts';
export interface Port { postMessage(data: unknown): void; terminate(): void; onmessage: ((event: MessageEvent) => void) | null; onerror: ((event: ErrorEvent) => void) | null; }
export type Reply = { version: 1; id: number; type: string; header?: Header; event?: MediaEvent | null; identity?: string; loadMs?: number; decodeMs?: number; heap?: number; io?: { bytes: number; reads: number; maximumRequest: number; seeks: number } };
function exact(value: unknown, names: string[]): boolean { return !!value && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).sort().join(',') === names.sort().join(','); }
const number = (n: unknown, max = Number.MAX_SAFE_INTEGER): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
/** Exactly one outstanding command; termination rejects it and stale events cannot re-enter. */
export class MediaClient {
  #id = 0; #closed = false; #header: Header | undefined;
  #pending: { id: number; type: string; resolve: (r: Reply) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> } | undefined;
  constructor(readonly port: Port, readonly timeoutMs = 15_000) {
    port.onmessage = ({ data: r }: MessageEvent) => {
      const pending = this.#pending;
      if (this.#closed || !pending) return;
      try {
        if (!r || Object.getPrototypeOf(r) !== Object.prototype || r.version !== 1 || r.id !== pending.id) throw new Error('worker-protocol');
        if (r.type === 'error') throw new Error(typeof r.code === 'string' && /^[a-z-]{1,80}$/.test(r.code) ? r.code : 'worker-failure');
        if (pending.type === 'open') {
          if (!exact(r, ['version','id','type','header','identity','loadMs','heap','io'])) throw new Error('worker-shape');
          const h = r.header;
          if (r.type !== 'ready' || !exact(h, ['width','height','frames','fpsNum','fpsDen','duration','tracks']) || !Object.values(h).every(v => number(v)) || !Number.isSafeInteger(h.frames) || h.frames < 1 || !Number.isSafeInteger(h.width) || h.width < 1 || h.width > MEDIA_LIMITS.width || !Number.isSafeInteger(h.height) || h.height < 1 || h.height > MEDIA_LIMITS.height || !Number.isSafeInteger(h.fpsNum) || h.fpsNum < 1 || !Number.isSafeInteger(h.fpsDen) || h.fpsDen < 1 || h.fpsNum / h.fpsDen > 60 || h.duration !== h.frames * h.fpsDen / h.fpsNum || h.duration > 600 || !Number.isSafeInteger(h.tracks) || h.tracks > 8 || typeof r.identity !== 'string' || !/^[a-f0-9]{64}$/.test(r.identity) || !number(r.loadMs)) throw new Error('worker-header');
          this.#header = h;
        } else if (pending.type === 'next') {
          if (!exact(r, ['version','id','type','event','decodeMs','heap','io'])) throw new Error('worker-shape');
          if (r.type === 'event' && this.#header) validateEvent(r.event, this.#header);
          else if (r.type !== 'eof' || r.event !== null) throw new Error('worker-event');
          if (!number(r.decodeMs)) throw new Error('worker-metrics');
        } else if (!exact(r, ['version','id','type']) || r.type !== (pending.type === 'seek' ? 'seeked' : 'closed')) throw new Error('worker-state');
        if (r.type === 'ready' || r.type === 'event' || r.type === 'eof') {
          if (!Number.isSafeInteger(r.heap) || !number(r.heap, MEDIA_LIMITS.heap) || !exact(r.io, ['bytes','reads','maximumRequest','seeks']) || !['bytes', 'reads', 'maximumRequest', 'seeks'].every(k => Number.isSafeInteger(r.io[k]) && number(r.io[k])) || r.io.maximumRequest > MEDIA_LIMITS.range) throw new Error('worker-metrics');
        }
        clearTimeout(pending.timer); this.#pending = undefined; pending.resolve(r);
      } catch (error) { this.stop(error instanceof Error ? error : new Error('worker-failure')); }
    };
    port.onerror = () => this.stop(new Error('worker-failure'));
  }
  request(type: 'open' | 'next' | 'seek' | 'close', fields: Record<string, unknown> = {}): Promise<Reply> {
    if (this.#closed || this.#pending) return Promise.reject(new Error('worker-busy-or-closed'));
    const id = ++this.#id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.stop(new Error('worker-timeout')), type === 'open' ? Math.max(60_000, this.timeoutMs) : this.timeoutMs);
      this.#pending = { id, type, resolve, reject, timer };
      try { this.port.postMessage({ ...fields, version: 1, id, type }); } catch { this.stop(new Error('worker-send')); }
    });
  }
  stop(reason = new Error('cancelled')): void {
    if (this.#closed) return;
    this.#closed = true; this.port.onmessage = null; this.port.onerror = null; this.port.terminate();
    if (this.#pending) { clearTimeout(this.#pending.timer); this.#pending.reject(reason); this.#pending = undefined; }
  }
}
