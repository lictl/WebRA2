// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Worker-owned state and bounded wire projections.
import { canonicalText, parseJson } from '../../../packages/sim/src/canonical.ts';
import { WorldReplayRecorder, replayWorld } from '../../../packages/sim/src/world-replay.ts';
import { planTeamDestinations } from '../../../packages/sim/src/team-runtime-destinations.ts';
import { assertWorldModel, worldEdgeCost, worldHash, worldPosition, type WorldModel } from '../../../packages/sim/src/world-model.ts';
import type { WorldTrace } from '../../../packages/sim/src/world.ts';
import { combatSourceBridge } from '../../../packages/sim/src/combat-model.ts';
import { evaluateOrdinaryInfantryAttack } from '../../../packages/sim/src/ordinary-infantry-bridge.ts';
import { WORLD_UI, validWorldAction, validWorldSummary, validWorldSnapshot, worldDocumentText, type WorldAction, type WorldSummary, type WorldSnapshot, type WorldDocument, type WorldPlayer } from './world-protocol.ts';
export type WorldPreparation = { model: WorldModel; players: readonly { playerId: number; houseId: string; name: string }[]; defaultPlayerId: number | null; placements: readonly { rowId: string; entityId: number | null; status: string; reasons: readonly string[] }[]; limitations: readonly string[] };
export class WorldSession {
  readonly summary: WorldSummary; readonly model: WorldModel;
  #recorder: WorldReplayRecorder; #revision = 0; #events: WorldTrace[] = []; #omittedEvents = 0;
  constructor(prepared: WorldPreparation) {
    assertWorldModel(prepared.model); this.model = prepared.model;
    if (prepared.players.length > WORLD_UI.players || prepared.placements.length > 32768 || prepared.limitations.length > 65535) throw new Error('world-ui-metadata-limit');
    let truncatedFields = 0;
    const label = (s: string, cap: number) => { const value = s.replace(/[\u0000-\u001f\u007f]/g, '�').slice(0, cap); if (s !== value) truncatedFields++; return value; };
    const players: WorldPlayer[] = prepared.players.map(p => ({ id: p.playerId, houseId: label(p.houseId, 255), name: label(p.name, 128) }));
    const joins = new Map(prepared.placements.map((p, i) => [p.rowId, { ...p, index: i, reasons: p.reasons.slice() }]));
    if (joins.size !== prepared.placements.length) throw new Error('world-ui-placement-join');
    const bridge=this.model.combat?combatSourceBridge(this.model.combat):undefined;
    const passage=this.model.infantryPassage,slotRows=new Map(passage?.actors.map(a=>[a.entityId,a])??[]);
    const combatRows=new Map(bridge?.actors.map(a=>[a.entityId,a])??[]);
    const actors = this.model.entities.map(e => {
      const p = joins.get(e.rowId); if (!p || p.entityId !== e.id || e.id !== p.index + 1) throw new Error('world-ui-placement-join');
      const slot=slotRows.get(e.id);if(passage&&(!slot||slot.rowId!==e.rowId))throw new Error('world-ui-slot-join');
      const combat=combatRows.get(e.id),reasons=[...p.reasons,...(combat?.attackReasons??[])];
      return { ...(passage?{initialSubcell:slot!.status==='ordinary-slots'?slot!.sourceSubcell as 2|3|4:null}:{}), ...(bridge?{combatRole:combat!.role}:{}), id: e.id, rowId: e.rowId, objectId: `object-${p.index}`, typeId: e.typeId, owner: e.owner, kind: e.kind, movable: e.movementPerTick > 0 && e.navigationClass !== null && e.owner !== null && e.initialHealth !== null && e.initialHealth > 0,
        maximumHealth: e.maximumHealth, reasons: reasons.slice(0, 8).map(r => label(r, 128)), omittedReasons: Math.max(0, reasons.length - 8) };
    });
    this.summary = { ...(passage?{infantryPolicy:passage.policy,infantryCatalogHash:passage.sha256}:{}), ...(bridge?{combatPolicy:'webra2-source-standing-infantry-combat-1' as const}:{}), policy: 'webra2-world-ui-1', modelHash: this.model.sha256, motionPolicy: this.model.motionPolicy, defaultPlayerId: prepared.defaultPlayerId, players, actors, limitations: prepared.limitations.slice(0, 32).map(s => label(s, 128)), omittedLimitations: Math.max(0, prepared.limitations.length - 32), truncatedFields };
    if (!validWorldSummary(this.summary)) throw new Error('world-ui-metadata');
    // Own all descriptors before any worker await. External callers receive fresh wire clones.
    for (const a of actors) { Object.freeze(a.reasons); Object.freeze(a); } for (const p of players) Object.freeze(p);
    Object.freeze(actors); Object.freeze(players); Object.freeze(this.summary.limitations); Object.freeze(this.summary);
    this.#recorder = new WorldReplayRecorder(this.model);
  }
  get revision(): number { return this.#revision; }
  snapshot(): WorldSnapshot {
    const save = this.#recorder.save(), definitions = new Map(this.model.entities.map(e => [e.id, e]));
    const slots=new Map(save.state.infantrySlots?.map(s=>[s.entityId,s])??[]);
    const source=this.summary.combatPolicy?save.state.combat:undefined;
    const combatActors=new Map(source?.actors.map(a=>[a.entityId,a])??[]),windups=new Map(source?.infantryFiring?.map(s=>[s.state.actorId,s.state.pending?.dueTick??null])??[]),deaths=new Map(source?.deaths?.map(d=>[d.entityId,d])??[]);
    const actors = save.state.entities.map(e => {
      const def = definitions.get(e.id)!, grid = this.model.navigation.find(n => n.grid.movementClass === def.navigationClass)?.grid;
      const goal = e.goal === null ? null : worldPosition(e.goal), next = e.route.length < 2 ? null : worldPosition(e.route[1]!);
      const combat=combatActors.get(e.id),death=deaths.get(e.id);
      const slot=slots.get(e.id);
      return { ...(this.model.infantryPassage?{subcell:slot?.subcell??null,reservedSubcell:slot?.reservedSubcell??null}:{}), ...(combat?{combat:{targetId:combat.targetId,readyTick:combat.readyTick,windupUntil:windups.get(e.id)??null,deathSequence:death?.sequence??null,deathUntil:death?.completionTick??null,corpseIndex:death?.corpseIndex??null}}:{}), id: e.id, x: e.x, y: e.y, health: e.health, goalX: goal?.x ?? null, goalY: goal?.y ?? null, nextX: next?.x ?? null, nextY: next?.y ?? null, routeLength: e.route.length, progress: e.progress,
        edgeCost: next && grid ? worldEdgeCost(grid, e.route[0]!, e.route[1]!, new Set()) : null, waitTicks: e.waitTicks };
    });
    const result = { modelHash: this.model.sha256, revision: this.#revision, nextTick: save.nextTick, stateHash: worldHash(save), queuedCommands: save.queuedCommands.length, actors, events: this.#events.map(e => ({ ...e })), omittedEvents: this.#omittedEvents };
    if (!validWorldSnapshot(result, this.summary)) throw new Error('world-ui-snapshot'); return result;
  }
  act(action: WorldAction): WorldDocument | null {
    if (!validWorldAction(action)) throw new Error('world-ui-action');
    if (action.type === 'world-save' || action.type === 'world-replay-export') {
      const save = this.#recorder.save(), text = canonicalText(action.type === 'world-save' ? save : this.#recorder.document());
      if (!worldDocumentText(text)) throw new Error('world-ui-document-limit');
      return { type: 'world-document', kind: action.type === 'world-save' ? 'save' : 'replay', modelHash: this.model.sha256, revision: this.#revision, stateHash: worldHash(save), text };
    }
    if (action.type === 'world-replay-validate') {
      const verified = replayWorld(this.model, parseJson(action.text));
      return { type: 'world-document', kind: 'validated', modelHash: this.model.sha256, revision: this.#revision, stateHash: verified.stateSha256, text: null };
    }
    if (this.#revision >= 0x7fffffff) throw new Error('world-ui-revision-limit');
    if (action.type === 'world-restore') {
      const candidate = new WorldReplayRecorder(this.model, parseJson(action.text));
      this.#recorder = candidate; this.#events = []; this.#omittedEvents = 0;
    } else if (action.type === 'world-order' || action.type === 'world-orders') {
      if (action.type === 'world-orders' && action.expectedRevision !== this.#revision) throw new Error('world-ui-stale-orders');
      const ids = action.type === 'world-orders' ? action.entityIds : [action.entityId];
      const save = this.#recorder.save(), cursor = save.state.admissionCursors.find(c => c.playerId === action.playerId);
      const bridge=this.model.combat?combatSourceBridge(this.model.combat):undefined;
      for (const entityId of ids) {
        const info = this.summary.actors.find(e => e.id === entityId), actor = save.state.entities.find(e => e.id === entityId);
        if (!info || info.owner !== action.playerId) throw new Error('world-ui-not-owner');
        if (!info.movable || actor?.health === null || actor?.health === undefined || actor.health <= 0) throw new Error('world-ui-immovable');
        if(action.order==='attack'){
          if(!bridge||info.combatRole!=='attacker')throw new Error('world-ui-attack-unsupported');
          const d=evaluateOrdinaryInfantryAttack(bridge,this.model,save,{sourceId:entityId,targetId:action.targetId});
          if(d.status!=='eligible')throw new Error(d.reasons.includes('out-of-range')?'world-ui-attack-range':d.reasons.includes('moving-actor')?'world-ui-attack-moving':'world-ui-attack-context');
        }
      }
      const destinations = new Map<number, { entityId: number; x: number; y: number }>();
      if (action.order === 'move') {
        if (action.type === 'world-orders') {
          const plan = planTeamDestinations({ model: this.model, checkpoint: save, actorIds: ids, target: { x: action.x, y: action.y } });
          if (plan.status !== 'ready') throw new Error(`world-ui-group-${plan.status}`);
          for (const destination of plan.assignments) destinations.set(destination.entityId, destination);
        } else destinations.set(action.entityId, { entityId: action.entityId, x: action.x, y: action.y });
      }
      // The recorder validates the aggregate queue, sequences and replay on a detached candidate before committing.
      this.#recorder.admitCommands(ids.map((entityId, index) => ({ schemaVersion: 1, tick: save.nextTick, playerId: action.playerId,
        sequence: (cursor ? cursor.sequence + 1 : 0) + index, kind: action.order,
        payload: action.order === 'move' ? { ...destinations.get(entityId)! } : action.order==='attack'?{entityId,targetId:action.targetId}:{ entityId } })));
      this.#events = []; this.#omittedEvents = 0;
    } else if (action.type === 'world-step') {
      const result = this.#recorder.step(action.ticks); this.#events = result.events.slice(-WORLD_UI.trace); this.#omittedEvents = Math.max(0, result.events.length - WORLD_UI.trace);
    }
    this.#revision++; return null;
  }
}
