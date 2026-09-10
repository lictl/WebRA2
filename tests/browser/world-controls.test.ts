// SPDX-License-Identifier: GPL-3.0-or-later
// Entirely original actor layouts; no retail behavior claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldSession, type WorldPreparation } from '../../apps/web/src/world-session.ts';
import { validWorldAction, WORLD_UI } from '../../apps/web/src/world-protocol.ts';
import { actorsInBox, controllable, projectControlPoints, selectWorldActors, validControlPoints } from '../../apps/web/src/world-selection.ts';
import { createWorldModel } from '../../packages/sim/src/world-model.ts';
import { createNavigationGrid } from '../../packages/sim/src/navigation.ts';
import { originalWorld } from './world-ui.fixture.ts';
import { beginWorldGesture, finishWorldGesture, updateWorldGesture, worldShortcut } from '../../apps/web/src/terrain-gestures.ts';
import { TerrainController } from '../../apps/web/src/terrain-controller.ts';
import { TerrainBridge } from '../../apps/web/src/terrain-bridge.ts';
import { attachTerrainWorker, type TerrainScope } from '../../apps/web/src/terrain-worker-runtime.ts';
import { worldText } from '../../apps/web/src/world-i18n.ts';

function groupWorld(count = 4) {
  const base = originalWorld(), entities = Array.from({ length: count }, (_, i) => ({ ...base.model.entities[0]!, id: i + 1, rowId: `original:${i}`, x: i % 7 + 1, y: Math.floor(i / 7) % 5 + 1, blocksCell: false }));
  const model = createWorldModel({ contentIdentity: base.model.contentIdentity, sourceSha256: base.model.sourceSha256, definitionsSha256: base.model.definitionsSha256, entities, navigation: base.model.navigation, blocked: [] });
  return { ...base, model, placements: entities.map(e => ({ rowId: e.rowId, entityId: e.id, status: 'ready', reasons: [] })) };
}
const stop = (entityIds: number[], expectedRevision: number) => ({ type: 'world-orders' as const, order: 'stop' as const, playerId: 0, entityIds, expectedRevision });

test('UI selection replaces, toggles, adds and bounds stable own live movement IDs', () => {
  const session = new WorldSession(originalWorld()), { summary } = session, snapshot = session.snapshot();
  assert(controllable(summary, snapshot, 0, 1)); assert(!controllable(summary, snapshot, 0, 2)); assert(!controllable(summary, snapshot, 0, 3));
  assert.deepEqual(selectWorldActors([], [3, 2, 1], 'replace', summary, snapshot, 0), { ids: [1], limited: false });
  assert.deepEqual(selectWorldActors([1], [1], 'toggle', summary, snapshot, 0).ids, []);
  snapshot.actors[0]!.health = 0; assert(!controllable(summary, snapshot, 0, 1));
  assert.deepEqual(selectWorldActors([1], [1], 'add', summary, snapshot, 0).ids, []);
  const many = new WorldSession(groupWorld(65)), ids = many.summary.actors.map(a => a.id);
  assert.deepEqual(selectWorldActors([1], ids, 'replace', many.summary, many.snapshot(), 0), { ids: [1], limited: true });
  assert.deepEqual(selectWorldActors([3], [2, 1, 2], 'add', many.summary, many.snapshot(), 0).ids, [1, 2, 3]);
});

test('frame control points use verified terrain anchors, whole-cell snapshot positions and exact bounded metadata', () => {
  const session = new WorldSession(originalWorld()), snapshot = session.snapshot(), camera = { cameraX: 10, cameraY: 20, zoom: 2, width: 100, height: 100 };
  const points = projectControlPoints(session.summary, snapshot, camera, (x, y) => ({ x: x * 20, y: y * 10 }));
  assert.deepEqual(points, [{ entityId: 1, x: 20, y: 20 }]); assert(validControlPoints(points, 100, 100, session.summary, snapshot));
  assert.deepEqual(actorsInBox(points, { left: 20, right: 20, top: 20, bottom: 20 }), [1]);
  assert.deepEqual(actorsInBox(points, { left: 21, right: 40, top: 20, bottom: 40 }), []);
  for (const bad of [[...points, ...points], [{ entityId: 3, x: 20, y: 20 }], [{ entityId: 99, x: 20, y: 20 }], [{ ...points[0], x: 100 }], Object.assign([...points], { hidden: new Blob(['original']) }), Array(1)]) assert.equal(validControlPoints(bad, 100, 100, session.summary, snapshot), false);
  snapshot.actors[0]!.health = 0; assert.deepEqual(projectControlPoints(session.summary, snapshot, camera, (x, y) => ({ x: x * 20, y: y * 10 })), []);
  assert.equal(validControlPoints(points, 100, 100, session.summary, snapshot), false);
});

test('atomic group envelopes preserve stable single-command save and replay semantics', () => {
  const grouped = new WorldSession(groupWorld()), singles = new WorldSession(groupWorld());
  const action = { ...stop([1, 2, 3], 0), order: 'move' as const, x: 6, y: 3 };
  assert(validWorldAction(action)); grouped.act(action);
  // Independent expected cells for this original open grid and the named stable destination policy.
  const destinations = [{ entityId: 1, x: 6, y: 3 }, { entityId: 2, x: 6, y: 2 }, { entityId: 3, x: 7, y: 3 }];
  assert.deepEqual(JSON.parse(grouped.act({ type: 'world-save' })!.text!).queuedCommands.map((c: { payload: unknown }) => c.payload), destinations);
  for (const target of destinations) singles.act({ type: 'world-order', order: 'move', playerId: 0, ...target });
  assert.equal(grouped.snapshot().stateHash, singles.snapshot().stateHash);
  assert.deepEqual(JSON.parse(grouped.act({ type: 'world-save' })!.text!).queuedCommands.map((c: { sequence: number }) => c.sequence), [0, 1, 2]);
  for (const session of [grouped, singles]) for (let i = 0; i < 5; i++) session.act({ type: 'world-step', ticks: 4 });
  assert.equal(grouped.snapshot().stateHash, singles.snapshot().stateHash);
  for (const target of destinations) { const actor = grouped.snapshot().actors.find(a => a.id === target.entityId)!; assert.deepEqual([actor.x, actor.y, actor.goalX], [target.x, target.y, null]); }
  for (const session of [grouped, singles]) {
    const replay = session.act({ type: 'world-replay-export' })!;
    assert.equal(session.act({ type: 'world-replay-validate', text: replay.text! })!.stateHash, grouped.snapshot().stateHash);
  }
});

test('duplicate, oversized, obsolete or hostile groups reject before mutation', () => {
  const session = new WorldSession(groupWorld()), before = session.snapshot();
  for (const ids of [[], [2, 1], [1, 1], Array.from({ length: WORLD_UI.group + 1 }, (_, i) => i + 1)]) assert(!validWorldAction(stop(ids, 0)));
  assert(!validWorldAction({ ...stop([1], 0), payload: new Blob(['original']) }));
  assert.throws(() => session.act(stop([1, 99], 0)), /not-owner/); assert.deepEqual(session.snapshot(), before);
  assert.throws(() => session.act(stop([1], 1)), /stale-orders/); assert.deepEqual(session.snapshot(), before);
  const other = new WorldSession(originalWorld()); assert.throws(() => other.act(stop([1, 2], 0)), /not-owner/); assert.equal(other.snapshot().queuedCommands, 0);
  const dead = JSON.parse(session.act({ type: 'world-save' })!.text!); dead.state.entities[1].health = 0;
  session.act({ type: 'world-restore', text: JSON.stringify(dead) }); const restored = session.snapshot();
  assert.throws(() => session.act(stop([1, 2], session.revision)), /immovable/); assert.deepEqual(session.snapshot(), restored);
});

test('aggregate queue and admission sequence overflow roll back every group member and revision', () => {
  const session = new WorldSession(groupWorld(64)), ids = Array.from({ length: 64 }, (_, i) => i + 1);
  for (let i = 0; i < 4; i++) session.act(stop(ids, session.revision));
  const full = session.snapshot(); assert.equal(full.queuedCommands, 256);
  assert.throws(() => session.act(stop([1, 2], session.revision)), /queue/); assert.deepEqual(session.snapshot(), full);
  const fresh = new WorldSession(groupWorld()), save = JSON.parse(fresh.act({ type: 'world-save' })!.text!);
  save.state.admissionCursors = [{ playerId: 0, sequence: Number.MAX_SAFE_INTEGER - 1 }];
  fresh.act({ type: 'world-restore', text: JSON.stringify(save) }); const before = fresh.snapshot();
  assert.throws(() => fresh.act(stop([1, 2], fresh.revision))); assert.deepEqual(fresh.snapshot(), before);
});

test('left drag selects, Shift extends and alternate pan gestures preserve distinct frame semantics', () => {
  const token = { frameId: 1, epoch: 2, revision: 3 }, input = { id: 5, button: 0, x: 50, y: 40, alt: false, shift: true };
  const initial = beginWorldGesture(input, token)!;
  const click = updateWorldGesture(initial, 5, 52, 41)!;
  assert.deepEqual(finishWorldGesture(click.gesture, token), { kind: 'click', x: 52, y: 41, additive: true, frameId: 1 });
  const box = updateWorldGesture(initial, 5, 20, 10)!;
  assert.deepEqual(box.box, { left: 20, top: 10, right: 50, bottom: 40 }); assert.equal(box.pan, null);
  assert.equal(finishWorldGesture(box.gesture, { ...token, frameId: 2 }), null);
  assert.equal(finishWorldGesture(box.gesture, { ...token, epoch: 3 }), null);
  for (const pan of [{ ...input, alt: true }, { ...input, button: 1 }]) {
    const gesture = updateWorldGesture(beginWorldGesture(pan, token)!, 5, 30, 25)!;
    assert.deepEqual(gesture.pan, [20, 15]); assert.equal(gesture.box, null);
    assert.deepEqual(finishWorldGesture(gesture.gesture, { ...token, frameId: 9 }), { kind: 'pan' });
    assert.equal(finishWorldGesture(gesture.gesture, { ...token, revision: 4 }), null);
  }
  assert.equal(beginWorldGesture({ ...input, button: 2 }, token), null);
  assert.equal(updateWorldGesture(initial, 6, 20, 10), null);
});

test('viewport shortcuts preserve form and modified-key behavior and provide bilingual feedback', () => {
  const none = { ctrlKey: false, altKey: false, metaKey: false };
  assert.equal(worldShortcut('S', true, none), 'stop'); assert.equal(worldShortcut('Escape', true, none), 'clear');
  assert.equal(worldShortcut(' ', true, none), 'run'); assert.equal(worldShortcut('M', true, none), 'move-picked');
  for (const key of ['s', 'Escape', ' ', 'm']) {
    assert.equal(worldShortcut(key, false, none), null);
    for (const flag of ['ctrlKey', 'altKey', 'metaKey']) assert.equal(worldShortcut(key, true, { ...none, [flag]: true }), null);
  }
  for (const key of ['worldSelectionChanged', 'worldSelectionCleared', 'worldSelectionLimit', 'worldCannotSelect', 'worldCannotOrder', 'worldControlsBusy', 'worldExposedGround', 'worldOrdersQueued', 'worldGroupBlocked', 'worldGroupBudget', 'directControls', 'development', 'keyboardSelection', 'kind-unit']) {
    assert.notEqual(worldText('en', key), worldText('en', 'unknown')); assert.match(worldText('zh-Hant', key), /[\u3400-\u9fff]/);
  }
});

function controllerHarness(prepared: WorldPreparation = groupWorld()) {
  class Worker extends EventTarget {
    terminated = false; scope: TerrainScope;
    constructor() {
      super(); this.scope = { onmessage: null, postMessage: (message, transfer) => { const data = structuredClone(message, { transfer: transfer ?? [] }); queueMicrotask(() => { if (!this.terminated) this.dispatchEvent(new MessageEvent('message', { data })); }); } };
      attachTerrainWorker(this.scope, async () => ({ world: prepared, summary: { profile: 'ra2', mission: 'all01t.map', contentHash: 'a'.repeat(64), mapHash: 'c'.repeat(64), paletteHash: 'e'.repeat(64), cells: 35, objects: 4, assets: 1, verifiedBytes: 1, sourceBytes: 1, decodedBytes: 1, decodedSlots: 1, bounds: { x: 0, y: 0, width: 100, height: 100 }, diagnostics: [], artwork: { policy: 'webra2-object-still-2', presentation: 'webra2-placed-still-1', voxel: null, types: 0, rendered: 0, unavailable: 4, assets: 0, palettes: 0, sourceBytes: 0, decodedBytes: 0, indexedFrames: 0, rows: [], omittedTypes: 0, omittedPlacements: 4, omittedRendered: 0, truncatedFields: 0, unplaced: 0 } }, scene: {
        locate(x, y) { return { x: x * 20, y: y * 10 }; },
        render(viewport) {
          const bytes = viewport.width * viewport.height * 4;
          return { viewport, rgba: new Uint8Array(bytes), allocations: { rgbaBytes: bytes, depthBytes: bytes, ownerBytes: bytes, objectOwnerBytes: bytes, totalPixelBytes: bytes * 4, samples: 0, spriteSamples: 0, paletteBytes: 0, objects: 0 }, pick(x, y) {
            if (x === 30) return { kind: 'terrain', cell: { sourceRecord: 0, x: 6, y: 3, assetId: 'original', subtile: 0, worldX: 0, worldY: 0, depth: 0 } };
            if (x !== 10 && x !== 20) return null;
            return { kind: 'object', object: { id: x === 10 ? 'object-0' : 'object-1', typeId: 'original', name: 'Original unit', family: 'unit', owner: 'Original player', format: 'shp', voxel: null, x: x / 10, y: 1, frame: 0, sourcePath: 'original.shp', sourceHash: 'a'.repeat(64), palettePath: 'original.pal', paletteHash: 'b'.repeat(64) }, canvasX: x, canvasY: y, worldX: x, worldY: y, depth: 0 };
          } };
        }
      } }));
    }
    postMessage(value: unknown) { const data = structuredClone(value); queueMicrotask(() => { if (!this.terminated) this.scope.onmessage?.({ data }); }); }
    terminate() { this.terminated = true; }
  }
  const workers: Worker[] = [], controller = new TerrainController('en', () => { const worker = new Worker(); workers.push(worker); return new TerrainBridge(worker); });
  controller.resize(240, 160); controller.select([new File(['original fixture'], 'original.mix')]); return { controller, workers };
}

test('controller click, toggle, box, verified ground group order and clear use the displayed authoritative frame', async () => {
  const { controller } = controllerHarness(); await controller.load();
  await controller.pick(10, 10); await controller.pick(20, 10, 'toggle'); assert.deepEqual(controller.state.selectedEntities, [1, 2]);
  await controller.pick(10, 10, 'toggle'); assert.deepEqual(controller.state.selectedEntities, [2]);
  const frameId = controller.state.frame!.frameId;
  assert(controller.selectBox(frameId, { left: 105, top: 35, right: 155, bottom: 45 })); assert.deepEqual(controller.state.selectedEntities, [2, 3, 4]);
  assert(!controller.selectBox(frameId + 1, { left: 0, top: 0, right: 239, bottom: 159 }));
  await controller.moveAt(10, 10); assert.equal(controller.state.worldNotice, 'worldExposedGround'); assert.equal(controller.state.frame!.world!.queuedCommands, 0);
  await controller.moveAt(30, 10); assert.equal(controller.state.frame!.world!.queuedCommands, 3); assert.equal(controller.state.worldNotice, 'worldOrdersQueued');
  await controller.step(); assert.deepEqual(controller.state.frame!.world!.actors.slice(1).map(a => [a.goalX, a.goalY]), [[6, 3], [6, 2], [7, 3]]);
  controller.clearSelection(); assert.deepEqual(controller.state.selectedEntities, []); assert(!controller.canOrder());
  controller.dispose();
});

test('group destination blockage and real planner exhaustion preserve the world and actionable feedback', async () => {
  const base = groupWorld(1), contentIdentity = base.model.contentIdentity;
  const grid = createNavigationGrid({ contentIdentity, movementClass: 'foot', cells: [{ x: 0, y: 0, cost: 1, exits: 0 }, ...Array.from({ length: 1089 }, (_, i) => ({ x: 10 + i % 33, y: 10 + Math.floor(i / 33), cost: 1, exits: 0 }))] });
  const model = createWorldModel({ contentIdentity, sourceSha256: base.model.sourceSha256, definitionsSha256: base.model.definitionsSha256, entities: [{ ...base.model.entities[0]!, x: 0, y: 0 }], navigation: [{ grid, costScale: 1 }], blocked: [] });
  for (const [prepared, x, y, notice, code] of [[groupWorld(), 511, 511, 'worldGroupBlocked', 'world-ui-group-blocked'], [{ ...base, model }, 26, 26, 'worldGroupBudget', 'world-ui-group-budget-exhausted']] as const) {
    const { controller } = controllerHarness(prepared); await controller.load(); const before = structuredClone(controller.state.frame!.world!);
    await controller.order(x, y); assert.equal(controller.state.worldNotice, notice); assert.equal(controller.state.error, code);
    assert.deepEqual(controller.state.frame!.world, before); assert(!controller.state.busy);
    assert.match(worldText('en', notice), /No orders were queued/);
    await controller.order(); assert.equal(controller.state.worldNotice, 'worldOrdersQueued'); assert.equal(controller.state.error, null); assert.equal(controller.state.frame!.world!.queuedCommands, 1);
    controller.dispose();
  }
});

test('interaction holds and obsolete asynchronous picks cannot restore a cleared or replaced selection', async () => {
  const { controller, workers } = controllerHarness(); await controller.load();
  assert(controller.setInteracting(true)); assert(controller.state.interacting); controller.cancelInteraction(); assert(!controller.state.interacting);
  const pending = controller.pick(20, 10); assert(!controller.setInteracting(true)); controller.clearSelection(); await pending;
  await new Promise<void>(resolve => setImmediate(resolve)); assert.deepEqual(controller.state.selectedEntities, []); assert.equal(controller.state.selection, null);
  const old = controller.pick(10, 10); controller.leave(); await old; assert.equal(controller.state.frame, null); assert(workers.every(w => w.terminated)); assert(!controller.state.interacting);
  controller.dispose();
});
