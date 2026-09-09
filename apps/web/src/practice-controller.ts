// SPDX-License-Identifier: GPL-3.0-or-later
import { PracticeBridge, type PracticePort } from './practice-bridge.ts';
import { SAVE_BYTES, saveText, type PracticeAction, type PracticeId, type PracticeSnapshot } from './practice-protocol.ts';
import { LocalPracticeStorage, type PracticeStorage, type SaveSlot } from './practice-storage.ts';
import type { Locale } from './i18n.ts';
export type PracticeNotice = 'ready' | 'saved' | 'loaded' | 'deleted' | 'empty' | 'cancelled' | 'verified' | 'invalid' | 'quota' | 'storage' | 'unavailable' | 'limit' | 'hidden';
export type PracticeState = { locale: Locale; snapshot: PracticeSnapshot | null; selected: number | null; running: boolean; busy: boolean; notice: PracticeNotice; slot: SaveSlot; scenario: PracticeId };
export class PracticeController {
  #state: PracticeState; #listeners = new Set<(state: PracticeState) => void>(); #port: PracticePort | null = null; #abort: AbortController | null = null; #generation = 0; #disposed = false;
  constructor(locale: Locale, private readonly portFactory: () => PracticePort = () => new PracticeBridge(), private readonly storage: PracticeStorage = new LocalPracticeStorage()) { this.#state = { locale, snapshot: null, selected: null, running: false, busy: false, notice: 'ready', slot: 1, scenario: 'relay' }; }
  get state(): PracticeState { return this.#state; }
  subscribe(listener: (state: PracticeState) => void): () => void { this.#listeners.add(listener); listener(this.#state); return () => this.#listeners.delete(listener); }
  #emit(patch: Partial<PracticeState>): void { if (this.#disposed) return; this.#state = { ...this.#state, ...patch }; for (const listener of this.#listeners) listener(this.#state); }
  setLocale(locale: Locale): void { this.#emit({ locale }); }
  setSlot(slot: SaveSlot): void { if (!this.#state.busy && [1, 2, 3].includes(slot)) this.#emit({ slot }); }
  select(id: number): void { if (this.#state.snapshot?.units.some(u => u.id === id && u.owner === 0)) this.#emit({ selected: id }); }
  setRunning(running: boolean): void { this.#emit({ running: running && !this.#state.busy && this.#state.snapshot?.outcome === 'active' }); }
  hidden(): void { this.#emit({ running: false, notice: 'hidden' }); }
  async #operation(run: (signal: AbortSignal) => Promise<void>): Promise<void> {
    if (this.#disposed || this.#state.busy) return;
    const generation = ++this.#generation, abort = new AbortController(); this.#abort = abort; this.#emit({ busy: true });
    try { await run(abort.signal); }
    catch (error) {
      if (generation !== this.#generation) return;
      this.#port?.dispose(); this.#port = null;
      const message = error instanceof Error ? error.message : '';
      this.#emit({ running: false, notice: ['invalid', 'quota', 'storage', 'unavailable', 'limit', 'empty'].includes(message) ? message as PracticeNotice : 'invalid' });
    } finally { if (generation === this.#generation) { this.#abort = null; this.#emit({ busy: false }); } }
  }
  async #request(action: PracticeAction, signal: AbortSignal): Promise<void> {
    if (!this.#port) {
      this.#port = this.portFactory();
      if (this.#state.snapshot && action.type !== 'init' && action.type !== 'restore') await this.#port.request({ type: 'restore', text: this.#state.snapshot.checkpoint }, signal);
    }
    if (signal.aborted) return;
    const result = await this.#port.request(action, signal);
    if (signal.aborted || this.#disposed) return;
    const snapshot = result.snapshot;
    this.#emit({ snapshot, scenario: snapshot.scenario, selected: snapshot.units.some(u => u.id === this.#state.selected && u.owner === 0) ? this.#state.selected : snapshot.units.find(u => u.owner === 0)?.id ?? null, running: this.#state.running && snapshot.outcome === 'active', notice: result.verified ? 'verified' : action.type === 'restore' ? 'loaded' : 'ready' });
  }
  async start(scenario: PracticeId = this.#state.scenario): Promise<void> { this.cancel(false); this.#emit({ running: false, scenario }); await this.#operation(signal => this.#request({ type: 'init', scenario }, signal)); }
  async step(ticks = 1): Promise<void> { if (!this.#state.snapshot || this.#state.snapshot.outcome !== 'active') return; await this.#operation(signal => this.#request({ type: 'step', ticks }, signal)); }
  async order(action: Extract<PracticeAction, { type: 'move' | 'attack' }>): Promise<void> { if (this.#state.snapshot?.outcome !== 'active') return; await this.#operation(signal => this.#request(action, signal)); }
  async verify(): Promise<void> { this.setRunning(false); if (this.#state.snapshot) await this.#operation(signal => this.#request({ type: 'verify' }, signal)); }
  async save(): Promise<void> { this.setRunning(false); const text = this.#state.snapshot?.checkpoint, slot = this.#state.slot; if (text) await this.#operation(async signal => { await this.storage.write(slot, text, signal); if (!signal.aborted) this.#emit({ notice: 'saved' }); }); }
  async load(): Promise<void> { this.setRunning(false); const slot = this.#state.slot; await this.#operation(async signal => { const text = await this.storage.read(slot, signal); if (!text) throw new Error('empty'); if (!signal.aborted) await this.#request({ type: 'restore', text }, signal); }); }
  async remove(): Promise<void> { this.setRunning(false); const slot = this.#state.slot; await this.#operation(async signal => { await this.storage.remove(slot, signal); if (!signal.aborted) this.#emit({ notice: 'deleted' }); }); }
  async importFile(file: Pick<File, 'size' | 'text'>): Promise<void> {
    this.setRunning(false);
    await this.#operation(async signal => { if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > SAVE_BYTES) throw new Error('invalid'); const text = await file.text(); if (signal.aborted) return; if (!saveText(text)) throw new Error('invalid'); await this.#request({ type: 'restore', text }, signal); });
  }
  export(): { text: string; name: string } | null { this.setRunning(false); const snapshot = this.#state.snapshot; return snapshot && !this.#state.busy ? { text: snapshot.checkpoint, name: `webra2-practice-${snapshot.scenario}-${snapshot.nextTick}.json` } : null; }
  cancel(announce = true): void { ++this.#generation; this.#abort?.abort(); this.#abort = null; this.#port?.dispose(); this.#port = null; this.#emit({ busy: false, running: false, ...(announce ? { notice: 'cancelled' as const } : {}) }); }
  dispose(): void { this.cancel(false); this.#disposed = true; this.#listeners.clear(); }
}
