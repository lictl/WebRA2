// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. DOM-independent job and selection state.
import type { ProfileId } from '../../../packages/contracts/src/index.ts';
import type { MixImportPolicy } from '../../../packages/formats/src/mix-integrity.ts';
import type { BrowserImportOptions, BrowserImportReport, ImportProgress } from '../../../packages/vfs/src/browser-types.ts';
import type { Locale } from './i18n.ts';
export type Inspector = (files: readonly File[], options: BrowserImportOptions) => Promise<BrowserImportReport>;
export type Phase = 'empty' | 'selected' | 'inspecting' | 'cancelled' | 'failed' | 'complete';
export interface ShellState {
  readonly profile: ProfileId;
  readonly policy: MixImportPolicy;
  readonly locale: Locale;
  readonly phase: Phase;
  readonly selection: { readonly count: number; readonly bytes: number; readonly preview: readonly string[] };
  readonly progress: ImportProgress | null;
  readonly report: BrowserImportReport | null;
  readonly error: 'noFile' | 'genericFailure' | 'fileAccessFailure' | 'tooManyFiles' | null;
  readonly errorCode: string | null;
}
export class ImportController {
  private files: readonly File[] = [];
  private job = 0;
  private active: AbortController | null = null;
  private listeners = new Set<(state: ShellState) => void>();
  private state: ShellState;
  constructor(private readonly inspector: Inspector, locale: Locale = 'en') {
    this.state = Object.freeze({ profile: 'ra2', policy: 'tolerant', locale, phase: 'empty',
      selection: Object.freeze({ count: 0, bytes: 0, preview: Object.freeze([]) }), progress: null, report: null, error: null, errorCode: null });
  }
  snapshot(): ShellState { return this.state; }
  subscribe(listener: (state: ShellState) => void): () => void { this.listeners.add(listener); listener(this.state); return () => { this.listeners.delete(listener); }; }
  private update(changes: Partial<ShellState>): void {
    this.state = Object.freeze({ ...this.state, ...changes });
    for (const listener of this.listeners) listener(this.state);
  }
  private invalidate(): void { this.job++; this.active?.abort(); this.active = null; }
  select(files: ArrayLike<File>): void {
    this.invalidate();
    if (files.length > 4096) {
      this.files = [];
      this.update({ phase: 'failed', progress: null, report: null, error: 'tooManyFiles', errorCode: null,
        selection: Object.freeze({ count: 0, bytes: 0, preview: Object.freeze([]) }) });
      return;
    }
    this.files = Object.freeze(Array.from(files));
    const bytes = this.files.reduce((total, file) => total + file.size, 0);
    this.update({ phase: files.length ? 'selected' : 'empty', progress: null, report: null, error: null, errorCode: null,
      selection: Object.freeze({ count: files.length, bytes, preview: Object.freeze(this.files.slice(0, 3).map(file => file.webkitRelativePath || file.name)) }) });
  }
  clear(): void { this.select([]); }
  setLocale(locale: Locale): void { if (locale === 'en' || locale === 'zh-Hant') this.update({ locale }); }
  setProfile(profile: ProfileId): void {
    if ((profile !== 'ra2' && profile !== 'yr') || profile === this.state.profile) return;
    this.invalidate(); this.update({ profile, phase: this.files.length ? 'selected' : 'empty', progress: null, report: null, error: null, errorCode: null });
  }
  setPolicy(policy: MixImportPolicy): void {
    if ((policy !== 'tolerant' && policy !== 'strict') || policy === this.state.policy) return;
    this.invalidate(); this.update({ policy, phase: this.files.length ? 'selected' : 'empty', progress: null, report: null, error: null, errorCode: null });
  }
  cancel(): void {
    if (!this.active) return;
    this.invalidate(); this.update({ phase: 'cancelled', progress: null, report: null, error: null, errorCode: null });
  }
  async inspect(): Promise<void> {
    if (this.active) return;
    if (!this.files.length) { this.update({ phase: 'failed', error: 'noFile', errorCode: null }); return; }
    const id = ++this.job, controller = new AbortController(), profile = this.state.profile, policy = this.state.policy;
    this.active = controller;
    this.update({ phase: 'inspecting', report: null, progress: null, error: null, errorCode: null });
    try {
      const report = await this.inspector(this.files, { profile, policy, signal: controller.signal,
        onProgress: progress => { if (id === this.job && this.active === controller) this.update({ progress: Object.freeze({ ...progress }) }); } });
      if (id !== this.job || this.active !== controller) return;
      if (report.schemaVersion !== 1 || report.profile !== profile || report.policy !== policy || report.canStartCampaign !== false) throw new Error('UnexpectedImportContract');
      this.active = null; this.update({ phase: 'complete', report, progress: null });
    } catch (error) {
      if (id !== this.job || this.active !== controller) return;
      this.active = null;
      const name = error instanceof Error ? error.name : 'Error';
      if (name === 'AbortError') this.update({ phase: 'cancelled', progress: null });
      else this.update({ phase: 'failed', progress: null, error: ['NotReadableError', 'NotFoundError', 'SecurityError'].includes(name) ? 'fileAccessFailure' : 'genericFailure', errorCode: name });
    }
  }
  dispose(): void { this.invalidate(); this.files = []; this.listeners.clear(); }
}
