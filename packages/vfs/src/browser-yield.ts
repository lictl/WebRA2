// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original task scheduling; see docs/browser-yield.md.
export const MAX_PENDING_BROWSER_YIELDS = 32;
let pending = 0;
export class BrowserYieldError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'BrowserYieldError'; }
}
function cancelled(): DOMException { return new DOMException('Browser task yield cancelled', 'AbortError'); }

/** Yield to a task, not a microtask. Suspended/background execution is browser policy. */
export function yieldBrowserTask(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(cancelled());
  if (pending >= MAX_PENDING_BROWSER_YIELDS) return Promise.reject(new BrowserYieldError('browser-yield-limit'));
  pending++;
  return new Promise<void>((resolve, reject) => {
    let settled = false, channel: MessageChannel | undefined, portsClosed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function closePorts(): void {
      if (!channel || portsClosed) return;
      portsClosed = true;
      channel.port1.onmessage = null; channel.port1.onmessageerror = null;
      try { channel.port1.close(); } finally { channel.port2.close(); }
    }
    function finish(error?: unknown): void {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      if (timer !== undefined) clearTimeout(timer);
      try { closePorts(); }
      catch { error ??= new BrowserYieldError('browser-yield-cleanup'); }
      finally { pending--; }
      if (error !== undefined) reject(error); else resolve();
    }
    function abort(): void { finish(cancelled()); }
    try {
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      if (typeof globalThis.MessageChannel !== 'function') {
        timer = setTimeout(() => finish(), 0);
        return;
      }
      channel = new MessageChannel();
      // An abort during a replaced constructor must not strand its returned ports.
      if (settled) { closePorts(); return; }
      channel.port1.onmessage = () => finish();
      channel.port1.onmessageerror = () => finish(new BrowserYieldError('browser-yield-message'));
      if (settled) { closePorts(); return; }
      channel.port2.postMessage(0);
    } catch { finish(new BrowserYieldError('browser-yield-schedule')); }
  });
}
