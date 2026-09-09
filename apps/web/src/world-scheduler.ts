// SPDX-License-Identifier: GPL-3.0-or-later
// UI scheduling only: elapsed time never enters an authoritative command or state.
import { WORLD_UI } from './world-protocol.ts';
export class WorldTickSchedule {
  #previous: number | null = null; #credit = 0;
  advance(now: number, running: boolean, busy: boolean): number {
    if (!Number.isFinite(now) || now < 0) { this.#previous = null; this.#credit = 0; return 0; }
    if (!running || this.#previous === null || now < this.#previous) { this.#previous = now; this.#credit = 0; return 0; }
    this.#credit = Math.min(WORLD_UI.catchup, this.#credit + (now - this.#previous) * WORLD_UI.hz / 1000); this.#previous = now;
    if (busy) return 0;
    const ticks = Math.floor(this.#credit); this.#credit -= ticks; return ticks;
  }
}
