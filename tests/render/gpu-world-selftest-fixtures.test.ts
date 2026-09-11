// SPDX-License-Identifier: GPL-3.0-or-later
// Original startup-fixture expectations, checked independently of actual WebGL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gpuWorldSelftestCases } from '../../packages/render/src/gpu-world-selftest-fixtures.ts';
import { createGpuPicker } from '../../packages/render/src/gpu-picking.ts';
import { pickGpuVoxelFrame, copyGpuVoxelFrameData, copyGpuVoxelSceneData } from '../../packages/render/src/gpu-voxel-policy.ts';
import { copyGpuFrameData, copyGpuSceneData } from '../../packages/render/src/gpu-scene.ts';

test('two bounded startup scenes have hand-authored exact mixed winners across all1,024 pixels', () => {
  const cases = gpuWorldSelftestCases(); assert.equal(cases.length, 2);
  let pixels = 0; const counts = new Map<string, number>();
  for (const c of cases) {
    const { width, height } = c.baseFrame.viewport, picker = createGpuPicker(c.base);
    assert.equal(c.expected.length, width * height); assert.ok(c.voxelFrame.allocations.instances <= 22);
    assert.ok(c.voxelFrame.allocations.candidateTests <= 22 * 256);
    const voxels = copyGpuVoxelSceneData(c.voxel);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const b = picker.pick(c.baseFrame, x, y), v = pickGpuVoxelFrame(c.voxelFrame, x, y, 'float32'), e = c.expected[y * width + x]!;
      const voxelWins = v !== null && (b === null || v.depth > b.depth);
      const kind = voxelWins ? 'voxel' : b?.kind === 'terrain' ? 'terrain' : b ? 'sprite' : 'empty';
      const id = voxelWins ? v.instanceId : b?.kind === 'terrain' ? String(b.sourceRecord) : b?.id ?? null;
      assert.deepEqual({ kind, id, depth: voxelWins ? v.depth : b?.depth ?? null }, { kind: e.kind, id: e.id, depth: e.depth }, `${c.id} ${x},${y}`);
      if (voxelWins) assert.deepEqual([...voxels.rgba.slice(v.colorIndex * 4, v.colorIndex * 4 + 4)], e.rgba);
      counts.set(kind, (counts.get(kind) ?? 0) + 1); pixels++;
    }
    picker.dispose();
  }
  assert.equal(pixels, 1024); assert.deepEqual(Object.fromEntries(counts), { empty: 771, terrain: 242, sprite: 2, voxel: 9 });
});

test('startup sources and packets are fresh, bounded factory outputs and contain no retained caller assets', () => {
  const a = gpuWorldSelftestCases(), b = gpuWorldSelftestCases();
  for (let i = 0; i < a.length; i++) {
    assert.notEqual(a[i]!.base, b[i]!.base); assert.notEqual(a[i]!.voxel, b[i]!.voxel);
    assert.deepEqual(copyGpuSceneData(a[i]!.base).rasters, copyGpuSceneData(b[i]!.base).rasters);
    assert.deepEqual(copyGpuFrameData(a[i]!.baseFrame), copyGpuFrameData(b[i]!.baseFrame));
    assert.deepEqual(copyGpuVoxelFrameData(a[i]!.voxelFrame), copyGpuVoxelFrameData(b[i]!.voxelFrame));
    assert.ok(Object.isFrozen(a[i]!.expected));
    assert.ok(a[i]!.expected.every(Object.isFrozen));
  }
});
