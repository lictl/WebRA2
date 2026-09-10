// SPDX-License-Identifier: GPL-3.0-or-later
// Original controlled worker fixture; no retail data or production timing hooks.
import { attachTerrainWorker, type TerrainScope, type SceneLoader } from '../../apps/web/src/terrain-worker-runtime.ts';
import { TerrainBridge } from '../../apps/web/src/terrain-bridge.ts';
import { TerrainController } from '../../apps/web/src/terrain-controller.ts';
import { type TerrainReply, type TerrainAction, type FrameResult } from '../../apps/web/src/terrain-protocol.ts';
import { type WorldStorage } from '../../apps/web/src/world-storage.ts';
import { originalWorld } from './world-ui.fixture.ts';
const artwork = { policy: 'webra2-object-still-2' as const, presentation: 'webra2-placed-still-1' as const, voxel: null, types: 0, rendered: 0, unavailable: 3, assets: 0, palettes: 0, sourceBytes: 0, decodedBytes: 0, indexedFrames: 0, rows: [], omittedTypes: 0, omittedPlacements: 3, omittedRendered: 0, truncatedFields: 0, unplaced: 0 };
const loader: SceneLoader = async () => ({ world: originalWorld(), summary: { profile: 'ra2', mission: 'all01t.map', contentHash: 'a'.repeat(64), mapHash: 'c'.repeat(64), paletteHash: 'e'.repeat(64), artwork, cells: 35, objects: 3, assets: 1, verifiedBytes: 100, sourceBytes: 100, decodedBytes: 100, decodedSlots: 1, bounds: { x: 0, y: 0, width: 100, height: 100 }, diagnostics: [] }, scene: {
  locate(x, y) { return { x: x * 20, y: y * 10 }; },
  render(viewport) { const bytes = viewport.width * viewport.height * 4; return { viewport, rgba: new Uint8Array(bytes), allocations: { rgbaBytes: bytes, depthBytes: bytes, ownerBytes: bytes, objectOwnerBytes: bytes, totalPixelBytes: bytes * 4, samples: 0, spriteSamples: 0, paletteBytes: 0, objects: 0 }, pick() { return null; } }; }
} });
class LocalWorker extends EventTarget {
  terminated = 0; transform: ((reply: TerrainReply) => TerrainReply) | null = null; readonly scope: TerrainScope;
  constructor() { super(); this.scope = { onmessage: null, postMessage: (message, transfer) => { const data = structuredClone(message, { transfer: transfer ?? [] }); queueMicrotask(() => { if (!this.terminated) this.dispatchEvent(new MessageEvent('message', { data: this.transform?.(data) ?? data })); }); } }; attachTerrainWorker(this.scope, loader); }
  postMessage(value: unknown) { const data = structuredClone(value); queueMicrotask(() => { if (!this.terminated) this.scope.onmessage?.({ data }); }); }
  terminate() { this.terminated++; }
}

export class ControlledWorker extends LocalWorker {
  holdType: string | null = null; held: unknown = null; sent: TerrainAction[] = [];
  override postMessage(value: unknown) {
    const message = value as { action?: TerrainAction };
    if(message.action)this.sent.push(structuredClone(message.action));
    if(message.action?.type===this.holdType){this.held=structuredClone(value);return;}
    super.postMessage(value);
  }
  release(){const value=this.held;this.held=null;this.holdType=null;if(value)super.postMessage(value);}
}
export async function runningFixture(){
  const workers:ControlledWorker[]=[],saved=new Map<number,string>();
  const storage:WorldStorage={async read(slot){return saved.get(slot)??null;},async write(slot,text){saved.set(slot,text);},async remove(slot){saved.delete(slot);}};
  const controller=new TerrainController('en',()=>{const w=new ControlledWorker();workers.push(w);return new TerrainBridge(w);},storage);
  controller.resize(120,80);controller.select([new File(['original-fixture'],'original.mix')]);await controller.load();
  return {controller,workers,saved};
}
