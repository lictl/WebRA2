// SPDX-License-Identifier: GPL-3.0-or-later
import { Simulation, ReplayRecorder, replay, canonicalText, canonicalHash, parseJson, type Scenario, type Digest, type SimSave, type TraceEvent, type ScheduledWork } from '../../../packages/sim/src/index.ts';
import type { CommandEnvelope, ContentIdentity } from '../../../packages/contracts/src/index.ts';
import { MAX_PRACTICE_TICKS, scenarioId, validAction, type PracticeId, type PracticeAction, type PracticeOutcome, type PracticeSnapshot } from './practice-protocol.ts';

// Entirely original practice data/policy. These hashes never identify retail content.
const policy = 'practice-1:enemy-every-4-ticks;nearest-manhattan-then-id;range4;pending-before-outcome;tick-cap1000';
export function practiceScenario(id: PracticeId): Scenario {
  return { width: 12, height: 8, seed: id === 'relay' ? 0x751 : 0x752,
    blocked: [{ x: 5, y: 1 }, { x: 5, y: 2 }, { x: 5, y: 5 }, { x: 5, y: 6 }],
    entities: [{ owner: 0, x: 2, y: 3, hp: 24 }, { owner: 0, x: 2, y: 4, hp: 24 }, { owner: 1, x: 8, y: 3, hp: id === 'relay' ? 12 : 22 }, { owner: 1, x: 9, y: 5, hp: 12 }],
    reinforcements: id === 'relay' ? [] : [{ dueTick: 24, owner: 1, x: 10, y: 6, hp: 12 }] };
}
export async function practiceIdentity(id: PracticeId, digest: Digest): Promise<ContentIdentity> {
  return { profile: 'ra2', manifestSha256: await canonicalHash({ practice: id, scenario: practiceScenario(id) }, digest), rulesSha256: await canonicalHash(policy, digest), orderedModHashes: [] };
}
export function practiceOutcome(save: SimSave): PracticeOutcome {
  // In-flight impacts and reinforcements finish before deciding an outcome.
  if (!save.scheduledWork.length && !save.queuedCommands.length) {
    const own = save.state.entities.some(e => e.owner === 0), enemy = save.state.entities.some(e => e.owner === 1);
    if (!own && !enemy) return 'draw'; if (!own) return 'defeat'; if (!enemy) return 'victory';
  }
  return save.nextTick >= MAX_PRACTICE_TICKS ? 'limit' : 'active';
}
export class PracticeModel {
  #id: PracticeId = 'relay'; #identity: ContentIdentity | null = null; #recorder: ReplayRecorder | null = null;
  constructor(private readonly digest: Digest) {}
  #ready(): ReplayRecorder { if (!this.#recorder) throw new Error('unavailable'); return this.#recorder; }
  async #load(id: PracticeId, input?: unknown): Promise<void> {
    const identity = await practiceIdentity(id, this.digest);
    const sim = input === undefined ? Simulation.create(practiceScenario(id), identity) : Simulation.restore(input, identity);
    const save = sim.save(), scenario = practiceScenario(id);
    if (save.nextTick > MAX_PRACTICE_TICKS || save.state.width !== 12 || save.state.height !== 8 || canonicalText(save.state.blocked) !== canonicalText(scenario.blocked.sort((a, b) => a.y - b.y || a.x - b.x)) || save.state.entities.length > 12 || save.state.nextEntityId > 256 || save.queuedCommands.length + save.scheduledWork.length > 128 || save.state.entities.some(e => e.owner > 1 || e.hp > 100 || e.id > 256) || save.state.admissionCursors.some(c => c.playerId > 1) || save.queuedCommands.some(c => c.playerId > 1 || c.tick >= MAX_PRACTICE_TICKS)) throw new Error('invalid');
    for (const work of save.scheduledWork as readonly ScheduledWork[]) {
      const payload = work.payload as Record<string, unknown>;
      if (work.dueTick > MAX_PRACTICE_TICKS + 2 || (work.kind === 'reinforcement' && (Number(payload.owner) > 1 || Number(payload.hp) > 100)) || (work.kind === 'impact' && (Number(payload.attackerId) > 256 || Number(payload.targetId) > 256))) throw new Error('invalid');
    }
    const recorder = new ReplayRecorder(save); // Stage validation before replacing the live state.
    this.#id = id; this.#identity = identity; this.#recorder = recorder;
  }
  #command(playerId: number, entityId: number, kind: 'move' | 'attack', target: { x: number; y: number } | { targetId: number }): void {
    const recorder = this.#ready(), save = recorder.save();
    if (save.queuedCommands.length + save.scheduledWork.length >= 128 || (playerId === 0 && save.queuedCommands.filter(c => c.playerId === 0).length >= 16)) throw new Error('limit');
    const sequence = (save.state.admissionCursors.find(c => c.playerId === playerId)?.sequence ?? -1) + 1;
    const command: CommandEnvelope = { schemaVersion: 1, tick: recorder.nextTick, playerId, sequence, kind, payload: { entityId, ...target } };
    recorder.admitCommands([command]);
  }
  async act(action: PracticeAction): Promise<{ snapshot: PracticeSnapshot; verified: boolean }> {
    if (!validAction(action)) throw new Error('invalid');
    let events: TraceEvent[] = [], verified = false;
    if (action.type === 'init') await this.#load(action.scenario);
    else if (action.type === 'restore') {
      const parsed = parseJson(action.text);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('invalid');
      const raw = parsed as Record<string, unknown>;
      if (Object.keys(raw).sort().join(',') !== 'kind,scenario,schemaVersion,simulation' || raw.kind !== 'webra2-practice-save' || raw.schemaVersion !== 1 || !scenarioId(raw.scenario)) throw new Error('invalid');
      await this.#load(raw.scenario, raw.simulation);
    } else {
      const recorder = this.#ready();
      if (action.type === 'verify') {
        const result = await replay(recorder.document(), this.#identity!, this.digest);
        if (result.simulation.saveText() !== canonicalText(recorder.save())) throw new Error('invalid'); verified = true;
      } else {
        if (practiceOutcome(recorder.save()) !== 'active') throw new Error('limit');
        if (action.type === 'step') {
          for (let i = 0; i < action.ticks && practiceOutcome(recorder.save()) === 'active'; i++) {
            const state = recorder.save();
            if (state.nextTick % 4 === 0) for (const enemy of state.state.entities.filter(e => e.owner === 1)) {
              const players = state.state.entities.filter(e => e.owner === 0).sort((a, b) => (Math.abs(a.x - enemy.x) + Math.abs(a.y - enemy.y)) - (Math.abs(b.x - enemy.x) + Math.abs(b.y - enemy.y)) || a.id - b.id);
              const target = players[0]; if (!target) continue;
              if (Math.abs(target.x - enemy.x) + Math.abs(target.y - enemy.y) <= 4) this.#command(1, enemy.id, 'attack', { targetId: target.id });
              else this.#command(1, enemy.id, 'move', { x: target.x, y: target.y });
            }
            events.push(...recorder.step().events);
          }
        } else {
          const entity = recorder.save().state.entities.find(e => e.id === action.entityId);
          if (!entity || entity.owner !== 0) throw new Error('invalid');
          if (action.type === 'move') this.#command(0, entity.id, 'move', { x: action.x, y: action.y });
          else this.#command(0, entity.id, 'attack', { targetId: action.targetId });
        }
      }
    }
    const save = this.#ready().save();
    const checkpoint = canonicalText({ schemaVersion: 1, kind: 'webra2-practice-save', scenario: this.#id, simulation: save });
    const snapshot: PracticeSnapshot = { scenario: this.#id, width: 12, height: 8, nextTick: save.nextTick, outcome: practiceOutcome(save), units: save.state.entities, blocked: save.state.blocked, pending: save.scheduledWork.length + save.queuedCommands.length, checkpoint, hash: await canonicalHash(save, this.digest), events: events.slice(-12).map(e => e.kind) };
    return { snapshot, verified };
  }
}
