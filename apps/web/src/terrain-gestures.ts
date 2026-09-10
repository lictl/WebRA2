// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Pure pointer interpretation; no simulation mutation.
import type { SelectionBox } from './world-selection.ts';

export type GestureToken = { frameId: number; epoch: number; revision: number };
export type PointerInput = { id: number; button: number; x: number; y: number; alt: boolean; shift: boolean };
export type WorldGesture = GestureToken & { id: number; mode: 'select' | 'pan'; shift: boolean; startX: number; startY: number; x: number; y: number; moved: boolean };
export type GestureCompletion = { kind: 'click'; x: number; y: number; additive: boolean; frameId: number } | { kind: 'box'; box: SelectionBox; additive: boolean; frameId: number } | { kind: 'pan' };

export function beginWorldGesture(input: PointerInput, token: GestureToken): WorldGesture | null {
  if (![0, 1].includes(input.button) || !Number.isFinite(input.x) || !Number.isFinite(input.y)) return null;
  return { ...token, id: input.id, mode: input.button === 1 || input.alt ? 'pan' : 'select', shift: input.shift, startX: input.x, startY: input.y, x: input.x, y: input.y, moved: false };
}

export function updateWorldGesture(gesture: WorldGesture, id: number, x: number, y: number): { gesture: WorldGesture; pan: [number, number] | null; box: SelectionBox | null } | null {
  if (id !== gesture.id || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const moved = gesture.moved || Math.max(Math.abs(x - gesture.startX), Math.abs(y - gesture.startY)) > 4;
  const pan: [number, number] | null = gesture.mode === 'pan' && moved ? [gesture.moved ? gesture.x - x : gesture.startX - x, gesture.moved ? gesture.y - y : gesture.startY - y] : null;
  return { gesture: { ...gesture, x, y, moved }, pan, box: gesture.mode === 'select' && moved ? rectangle(gesture.startX, gesture.startY, x, y) : null };
}

export function finishWorldGesture(gesture: WorldGesture, token: GestureToken): GestureCompletion | null {
  if (gesture.epoch !== token.epoch || gesture.revision !== token.revision || gesture.mode === 'select' && gesture.frameId !== token.frameId) return null;
  if (gesture.mode === 'pan') return { kind: 'pan' };
  return gesture.moved ? { kind: 'box', box: rectangle(gesture.startX, gesture.startY, gesture.x, gesture.y), additive: gesture.shift, frameId: gesture.frameId } : { kind: 'click', x: Math.floor(gesture.x), y: Math.floor(gesture.y), additive: gesture.shift, frameId: gesture.frameId };
}

function rectangle(x1: number, y1: number, x2: number, y2: number): SelectionBox {
  return { left: Math.floor(Math.min(x1, x2)), top: Math.floor(Math.min(y1, y2)), right: Math.floor(Math.max(x1, x2)), bottom: Math.floor(Math.max(y1, y2)) };
}

export function worldShortcut(key: string, targetIsCanvas: boolean, modifiers: { altKey: boolean; ctrlKey: boolean; metaKey: boolean }): 'run' | 'stop' | 'clear' | 'move-picked' | null {
  if (!targetIsCanvas || modifiers.altKey || modifiers.ctrlKey || modifiers.metaKey) return null;
  return key === ' ' ? 'run' : key.toLowerCase() === 's' ? 'stop' : key === 'Escape' ? 'clear' : key.toLowerCase() === 'm' ? 'move-picked' : null;
}
