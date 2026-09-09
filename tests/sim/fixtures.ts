// SPDX-License-Identifier: MIT
// Entirely original synthetic scenario; no retail map, rules or save data.
import { createHash } from 'node:crypto';
import type { CommandEnvelope, ContentIdentity } from '../../packages/contracts/src/index.ts';
import type { Scenario } from '../../packages/sim/src/index.ts';
export const content: ContentIdentity = { profile: 'ra2', manifestSha256: '1'.repeat(64), rulesSha256: '2'.repeat(64), orderedModHashes: ['3'.repeat(64), '4'.repeat(64)] };
export const digest = async (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export function scenario(): Scenario { return { width: 8, height: 6, blocked: [{ x: 2, y: 1 }, { x: 1, y: 2 }], entities: [{ owner: 0, x: 0, y: 0, hp: 12 }, { owner: 1, x: 3, y: 0, hp: 11 }, { owner: 0, x: 0, y: 1, hp: 8 }], reinforcements: [{ dueTick: 4, owner: 1, x: 6, y: 4, hp: 7 }], seed: 7 }; }
export function move(tick: number, playerId: number, sequence: number, entityId: number, x: number, y: number): CommandEnvelope { return { schemaVersion: 1, tick, playerId, sequence, kind: 'move', payload: { entityId, x, y } }; }
export function attack(tick: number, playerId: number, sequence: number, entityId: number, targetId: number): CommandEnvelope { return { schemaVersion: 1, tick, playerId, sequence, kind: 'attack', payload: { entityId, targetId } }; }
export const commands = () => [move(0, 0, 0, 1, 2, 0), attack(0, 1, 0, 2, 1), attack(1, 0, 1, 1, 2), attack(4, 0, 2, 1, 2), attack(4, 1, 1, 2, 1)];
