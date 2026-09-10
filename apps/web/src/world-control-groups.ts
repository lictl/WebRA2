// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Session-only UI selection; never simulation authority.
import { controllable } from './world-selection.ts';
import { WORLD_UI, type WorldSummary, type WorldSnapshot } from './world-protocol.ts';

export type ControlGroupContext = { scene: number; summary: WorldSummary; snapshot: WorldSnapshot; playerId: number | null };
export type ControlGroupFeedback = { slot: number; count: number; kind: 'assigned' | 'recalled' | 'cleared' | 'empty' | 'unavailable' };
export type ControlGroupResult = { feedback: ControlGroupFeedback; ids: number[] | null };
const slotValid = (slot: number) => Number.isInteger(slot) && slot >= 0 && slot <= 9;

/** Ten bounded groups. Scene/player replacement and successful restore discard them. */
export class WorldControlGroups {
  #scope: string | null = null;
  #groups: number[][] = Array.from({ length: 10 }, () => []);
  clear(): void { this.#scope = null; this.#groups = Array.from({ length: 10 }, () => []); }
  sync(context: ControlGroupContext | null): boolean {
    const scope = context && Number.isSafeInteger(context.scene) && context.scene >= 0 &&
      context.playerId !== null && context.summary.players.some(p => p.id === context.playerId) &&
      context.summary.modelHash === context.snapshot.modelHash ?
      `${context.scene}:${context.summary.modelHash}:${context.playerId}` : null;
    if (scope === this.#scope) return false;
    this.clear(); this.#scope = scope; return true;
  }
  use(context: ControlGroupContext, slot: number, assign: boolean, selection: readonly number[]): ControlGroupResult | null {
    this.sync(context);
    if (!slotValid(slot)) return null;
    const result = (kind: ControlGroupFeedback['kind'], ids: number[] | null = null): ControlGroupResult => ({ feedback: { slot, count: ids?.length ?? 0, kind }, ids });
    if (!this.#scope) return result('unavailable');
    if (assign && (!Array.isArray(selection) || selection.length > WORLD_UI.group ||
      !Array.from(selection).every(id => Number.isSafeInteger(id) && id > 0))) return result('unavailable');
    const stored = this.#groups[slot]!;
    const ids = [...new Set(assign ? selection : stored)].filter(id => controllable(context.summary, context.snapshot, context.playerId, id)).sort((a, b) => a - b);
    if (assign) {
      if (selection.length && !ids.length) return result('unavailable');
      this.#groups[slot] = ids;
      return { feedback: { slot, count: ids.length, kind: ids.length ? 'assigned' : 'cleared' }, ids: null };
    }
    if (!ids.length) return result(stored.length ? 'unavailable' : 'empty');
    // Retain only currently eligible members. Returned selection never aliases storage.
    this.#groups[slot] = ids.slice(); return result('recalled', ids);
  }
}

/** Canvas focus only. Ctrl is deliberate on macOS; Command/Alt/Shift stay untouched. */
export function controlGroupShortcut(event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; repeat: boolean; isComposing?: boolean }, canvasFocused: boolean, ready: boolean): { slot: number; assign: boolean } | null {
  if (!canvasFocused || !ready || event.repeat || event.isComposing || event.metaKey || event.altKey || event.shiftKey || !/^[0-9]$/.test(event.key)) return null;
  return { slot: Number(event.key), assign: event.ctrlKey };
}
