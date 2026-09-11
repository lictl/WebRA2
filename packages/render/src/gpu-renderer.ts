// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../GPU_PROVENANCE.md.
import { copyGpuFrameData, copyGpuSceneData } from './gpu-scene.ts';
import { GPU_DEPTH_MAX, GPU_DEPTH_MIN, GPU_DRAW as D, GPU_DRAW_STRIDE,
  GPU_PREPARE_LIMITS, GPU_RENDERER_LIMITS } from './gpu-contracts.ts';
import type { GpuDrawReceipt, GpuFrame, GpuFrameData, GpuReadback, GpuRendererLimits,
  GpuRendererStats, GpuScene, GpuSceneData } from './gpu-contracts.ts';

export class GpuRendererError extends Error {
  constructor(readonly code: string, detail = '') { super(code + (detail ? ': ' + detail.slice(0, 4096) : '')); this.name = 'GpuRendererError'; }
}
function fail(code: string): never { throw new GpuRendererError(code); }

// Internal context-bound accounting. Tokens expose neither handles nor mutable counters.
declare const resourceBudgetBrand: unique symbol;
export interface GpuResourceBudget { readonly [resourceBudgetBrand]: true }
interface ResourceBudgetData { context: WebGL2RenderingContext; gpuCap: number; cpuCap: number; peakGpu: number; peakCpu: number; owners: Map<object, { gpu: number; cpu: number }> }
const resourceBudgets = new WeakMap<GpuResourceBudget, ResourceBudgetData>();
function budgetData(budget: GpuResourceBudget): ResourceBudgetData { const data = resourceBudgets.get(budget); if (!data) fail('gpu-budget-identity'); return data; }
export function createGpuResourceBudget(context: WebGL2RenderingContext, gpuBytes: number, cpuBytes: number): GpuResourceBudget {
  integer(gpuBytes, 1, GPU_RENDERER_LIMITS.gpuBytes, 'gpu-budget-limit'); integer(cpuBytes, 1, GPU_RENDERER_LIMITS.gpuBytes, 'gpu-budget-limit');
  const result = Object.freeze({}) as GpuResourceBudget;
  resourceBudgets.set(result, { context, gpuCap: gpuBytes, cpuCap: cpuBytes, peakGpu: 0, peakCpu: 0, owners: new Map() }); return result;
}
export function registerGpuResourceOwner(budget: GpuResourceBudget, context: WebGL2RenderingContext): object {
  const data = budgetData(budget); if (data.context !== context) fail('gpu-budget-context');
  // Three live participants: base, optional voxel, combined targets. Released slots may be reused.
  if (data.owners.size >= 3) fail('gpu-budget-owners'); const owner = Object.freeze({}); data.owners.set(owner, { gpu: 0, cpu: 0 }); return owner;
}
export function checkGpuResourceBudget(budget: GpuResourceBudget, owner: object, gpu: number, cpu: number): void {
  const data = budgetData(budget); if (!data.owners.has(owner)) fail('gpu-budget-owner');
  integer(gpu, 0, Number.MAX_SAFE_INTEGER, 'gpu-budget-data'); integer(cpu, 0, Number.MAX_SAFE_INTEGER, 'gpu-budget-data');
  for (const [key, value] of data.owners) if (key !== owner) { gpu += value.gpu; cpu += value.cpu; }
  if (gpu > data.gpuCap) fail('gpu-aggregate-memory-limit'); if (cpu > data.cpuCap) fail('gpu-aggregate-staging-limit');
  data.peakGpu = Math.max(data.peakGpu, gpu); data.peakCpu = Math.max(data.peakCpu, cpu);
}
export function commitGpuResourceBudget(budget: GpuResourceBudget, owner: object, gpu: number, cpu: number): void {
  checkGpuResourceBudget(budget, owner, gpu, cpu); budgetData(budget).owners.set(owner, { gpu, cpu });
}
export function releaseGpuResourceOwner(budget: GpuResourceBudget, owner: object): void { if (!budgetData(budget).owners.delete(owner)) fail('gpu-budget-owner'); }
export function gpuResourceBudgetStats(budget: GpuResourceBudget) {
  const data = budgetData(budget); let gpu = 0, cpu = 0; for (const value of data.owners.values()) { gpu += value.gpu; cpu += value.cpu; }
  return Object.freeze({ requestedGpuBytes: gpu, ownedCpuBytes: cpu, peakRequestedGpuBytes: data.peakGpu, peakStagingBytes: data.peakCpu });
}
export interface GpuBaseLayerReceipt extends GpuDrawReceipt { readonly generation: number; readonly width: number; readonly height: number }
const NONE_DEPTH = -2147483648;
const INSTANCE_BYTES = GPU_DRAW_STRIDE * 4;
function integer(value: unknown, min: number, max: number, code = 'gpu-data'): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || Object.is(value, -0) || value < min || value > max) fail(code);
  return value;
}
function field(value: unknown, name: string, code = 'gpu-descriptor'): unknown {
  if (!value || typeof value !== 'object') fail(code);
  const d = Object.getOwnPropertyDescriptor(value, name);
  if (!d || !('value' in d)) fail(code);
  return d.value;
}
function limits(input: Partial<GpuRendererLimits>): Readonly<GpuRendererLimits> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('gpu-limits');
  const result: GpuRendererLimits = { ...GPU_RENDERER_LIMITS };
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string' || !Object.hasOwn(result, key)) fail('gpu-limits');
    const name = key as keyof GpuRendererLimits;
    result[name] = integer(field(input, key, 'gpu-limits'), 1, GPU_RENDERER_LIMITS[name], 'gpu-limits');
  }
  return Object.freeze(result);
}
function powerOfTwoAtMost(value: number): number { return 2 ** Math.floor(Math.log2(value)); }

// Integer attributes and texelFetch avoid filtered indices and interpolated source coordinates.
const DRAW_VERTEX = `#version 300 es
precision highp float;
precision highp int;
precision highp isampler2D;
layout(location=0) in ivec4 aBounds;
layout(location=1) in ivec4 aPlacement;
layout(location=2) in ivec4 aOwner;
uniform ivec2 uSize;
uniform isampler2D uMetadata;
uniform int uMetadataWidth;
flat out ivec4 vPlacement;
flat out ivec4 vRaster;
flat out ivec3 vOwner;
void main() {
  ivec2 corner=ivec2(gl_VertexID & 1, gl_VertexID >> 1);
  ivec2 p=ivec2(corner.x == 0 ? aBounds.x : aBounds.z, corner.y == 0 ? aBounds.y : aBounds.w);
  gl_Position=vec4(vec2(p)*vec2(2.0,-2.0)/vec2(uSize)+vec2(-1.0,1.0),0.0,1.0);
  vPlacement=aPlacement;
  int id=aPlacement.z;
  vRaster=texelFetch(uMetadata,ivec2(id % uMetadataWidth,id / uMetadataWidth),0);
  vOwner=aOwner.xyz;
}`;
const DRAW_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2DArray;
precision highp isampler2DArray;
precision highp isampler2D;
uniform usampler2DArray uColor;
uniform isampler2DArray uDepth;
uniform isampler2D uSampleX;
uniform isampler2D uSampleY;
uniform isampler2D uTerrain;
uniform int uAtlasSide;
uniform int uHeight;
uniform int uSprite;
flat in ivec4 vPlacement;
flat in ivec4 vRaster;
flat in ivec3 vOwner;
layout(location=0) out uvec4 oColor;
layout(location=1) out ivec2 oInfo;
void main() {
  ivec2 pixel=ivec2(gl_FragCoord.xy);
  int x=texelFetch(uSampleX,ivec2(pixel.x,0),0).r-vPlacement.x;
  int y=texelFetch(uSampleY,ivec2(uHeight-1-pixel.y,0),0).r-vPlacement.y;
  if (x<0 || y<0 || x>=vRaster.x || y>=vRaster.y) discard;
  int index=vRaster.z+y*vRaster.x+x;
  int area=uAtlasSide*uAtlasSide;
  ivec3 at=ivec3(index % uAtlasSide,(index / uAtlasSide) % uAtlasSide,index / area);
  uvec4 color=texelFetch(uColor,at,0);
  if (color.a==0u) discard;
  int depth=vPlacement.w+texelFetch(uDepth,at,0).r;
  if (uSprite!=0) {
    ivec2 terrain=texelFetch(uTerrain,pixel,0).rg;
    if (depth<terrain.x || (depth==terrain.x && terrain.y>=0 && vOwner.z==0)) discard;
  }
  // Exact for the admitted integer range [-2097151,2097151], using a 32F depth target.
  gl_FragDepth=float(depth+2097152)*(1.0/4194304.0);
  oColor=color;
  oInfo=ivec2(depth,vOwner.x);
}`;
const COMPOSITE_VERTEX = `#version 300 es
void main() {
  vec2 p=vec2(float((gl_VertexID << 1) & 2),float(gl_VertexID & 2));
  gl_Position=vec4(p*2.0-1.0,0.0,1.0);
}`;
const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
precision highp isampler2D;
uniform usampler2D uTerrainColor;
uniform isampler2D uTerrainInfo;
uniform usampler2D uSpriteColor;
uniform isampler2D uSpriteInfo;
uniform uvec4 uBackground;
out vec4 oColor;
void main() {
  ivec2 p=ivec2(gl_FragCoord.xy);
  uvec4 color=uBackground;
  if (texelFetch(uTerrainInfo,p,0).g>=0) color=texelFetch(uTerrainColor,p,0);
  if (texelFetch(uSpriteInfo,p,0).g>=0) color=texelFetch(uSpriteColor,p,0);
  oColor=vec4(color)*(1.0/255.0);
}`;

interface Bag { textures: WebGLTexture[]; buffers: WebGLBuffer[]; vaos: WebGLVertexArrayObject[];
  framebuffers: WebGLFramebuffer[]; renderbuffers: WebGLRenderbuffer[]; programs: WebGLProgram[] }
function bag(): Bag { return { textures: [], buffers: [], vaos: [], framebuffers: [], renderbuffers: [], programs: [] }; }
interface Program { handle: WebGLProgram; uniform: Readonly<Record<string, WebGLUniformLocation>> }
interface Target { framebuffer: WebGLFramebuffer; color: WebGLTexture; info: WebGLTexture }
interface Targets { bag: Bag; terrain: Target; sprites: Target; sampleX: WebGLTexture; sampleY: WebGLTexture;
  width: number; height: number; bytes: number }
interface ScenePlan { side: number; layers: number; metaWidth: number; metaHeight: number;
  pixels: number; rasterBytes: number; atlasBytes: number; metadataBytes: number; bytes: number }
interface Resident { bag: Bag; color: WebGLTexture; depth: WebGLTexture; metadata: WebGLTexture;
  draw: Program; composite: Program; vao: WebGLVertexArrayObject; compositeVao: WebGLVertexArrayObject;
  buffer: WebGLBuffer; bufferBytes: number; plan: ScenePlan; targets: Targets | null }

/**
 * Dedicated caller-owned WebGL2 context. The caller sizes the drawing buffer before draw.
 * Request alpha:true, premultipliedAlpha:false, antialias:false for exact canvas presentation.
 * readback is blocking diagnostic work, never called by draw. gpuBytes also caps owned CPU
 * staging/readback peaks; requested bytes include a four-byte/pixel default-canvas allowance,
 * but cannot measure driver allocations, shader binaries, compositor copies or process RSS.
 */
export class GpuRenderer {
  readonly #gl: WebGL2RenderingContext;
  readonly #limits: Readonly<GpuRendererLimits>;
  #state: GpuRendererStats['state'] = 'empty';
  #generation = 0;
  #sequence = 0;
  #peak = 0;
  #data: GpuSceneData | null = null;
  #capabilities: { side: number; layers: number } | null = null;
  #resident: Resident | null = null;
  #last: GpuFrame | null = null;
  #layer: GpuBaseLayerReceipt | null = null;
  #shared: { budget: GpuResourceBudget; owner: object } | null = null;
  #syncBudget(): void { if (this.#shared) commitGpuResourceBudget(this.#shared.budget, this.#shared.owner, this.#gpuBytes(), this.#cpuBytes()); }
  readonly #onLost = (event: Event): void => { event.preventDefault(); this.#lose(); };

  constructor(context: WebGL2RenderingContext, options: Partial<GpuRendererLimits> = {}, budget?: GpuResourceBudget) {
    this.#limits = limits(options);
    if (!context || typeof context.isContextLost !== 'function' || !context.canvas || typeof context.texStorage3D !== 'function') fail('gpu-context');
    this.#gl = context;
    if (budget) this.#shared = { budget, owner: registerGpuResourceOwner(budget, context) };
    context.canvas.addEventListener('webglcontextlost', this.#onLost);
    if (context.isContextLost()) this.#lose();
  }
  #lose(): void {
    if (this.#state === 'disposed' || this.#state === 'lost') return;
    this.#state = 'lost'; this.#generation++; this.#resident = null; this.#last = null; this.#layer = null; this.#capabilities = null; this.#syncBudget();
  }
  #live(): void {
    if (this.#state === 'disposed') fail('gpu-disposed');
    if (this.#gl.isContextLost()) this.#lose();
    if (this.#state === 'lost') fail('gpu-context-lost');
  }
  #gpuBytes(): number { const r = this.#resident; return r ? r.plan.bytes + r.bufferBytes + (r.targets?.bytes ?? 0) : 0; }
  #cpuBytes(): number { return this.#data?.rasters.reduce((n, r) => n + r.rgba.byteLength + r.depth.byteLength, 0) ?? 0; }
  #budget(gpu: number, cpu: number): void {
    if (!Number.isSafeInteger(gpu) || gpu > this.#limits.gpuBytes) fail('gpu-memory-limit');
    if (!Number.isSafeInteger(cpu) || cpu > this.#limits.gpuBytes) fail('gpu-cpu-memory-limit');
    if (this.#shared) checkGpuResourceBudget(this.#shared.budget, this.#shared.owner, gpu, cpu);
  }
  #hardware(): { side: number; layers: number } {
    if (this.#capabilities) return this.#capabilities;
    const gl = this.#gl;
    const side = Math.min(this.#limits.textureSide, integer(gl.getParameter(gl.MAX_TEXTURE_SIZE), 1, 2 ** 30, 'gpu-capability'),
      integer(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), 1, 2 ** 30, 'gpu-capability'));
    const layers = Math.min(this.#limits.textureLayers, integer(gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS), 1, 2 ** 30, 'gpu-capability'));
    if (gl.getParameter(gl.MAX_DRAW_BUFFERS) < 2 || gl.getParameter(gl.MAX_COLOR_ATTACHMENTS) < 2 ||
      gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) < 1 || gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) < 6) fail('gpu-capability');
    this.#capabilities = { side, layers }; return this.#capabilities;
  }
  #scenePlan(scene: GpuScene): ScenePlan {
    // These descriptor reads are only a pre-allocation gate. copyGpuSceneData authenticates
    // factory identity before any bytes are admitted; matching public metadata is not proof.
    const a = field(scene, 'allocations');
    const count = integer(field(a, 'rasterCount'), 0, GPU_PREPARE_LIMITS.rasters);
    const pixels = integer(field(a, 'rasterPixels'), 0, GPU_PREPARE_LIMITS.rasterPixels);
    const rasterBytes = integer(field(a, 'rasterBytes'), 0, GPU_PREPARE_LIMITS.rasterBytes);
    if (rasterBytes !== pixels * 8) fail('gpu-data');
    const hw = this.#hardware();
    const maxSide = powerOfTwoAtMost(hw.side);
    const side = Math.min(maxSide, 2 ** Math.ceil(Math.log2(Math.max(1, Math.ceil(Math.sqrt(pixels))))));
    const layers = Math.max(1, Math.ceil(pixels / (side * side)));
    if (layers > hw.layers) fail('gpu-texture-limit');
    const metaWidth = Math.min(Math.max(1, count), hw.side), metaHeight = Math.max(1, Math.ceil(count / metaWidth));
    if (metaHeight > hw.side) fail('gpu-texture-limit');
    const atlasBytes = side * side * layers * 8, metadataBytes = metaWidth * metaHeight * 16;
    return { side, layers, metaWidth, metaHeight, pixels, rasterBytes, atlasBytes, metadataBytes, bytes: atlasBytes + metadataBytes };
  }
  #delete(b: Bag): void {
    const gl = this.#gl;
    for (const x of b.framebuffers) gl.deleteFramebuffer(x);
    for (const x of b.renderbuffers) gl.deleteRenderbuffer(x);
    for (const x of b.textures) gl.deleteTexture(x);
    for (const x of b.buffers) gl.deleteBuffer(x);
    for (const x of b.vaos) gl.deleteVertexArray(x);
    for (const x of b.programs) gl.deleteProgram(x);
  }
  #deleteResident(r: Resident): void { if (r.targets) this.#delete(r.targets.bag); this.#delete(r.bag); }
  #check(): void {
    if (this.#gl.isContextLost()) { this.#lose(); fail('gpu-context-lost'); }
    if (this.#gl.getError() !== this.#gl.NO_ERROR) fail('gpu-operation');
  }
  #texture(b: Bag, target: number): WebGLTexture {
    const gl = this.#gl, texture = gl.createTexture(); if (!texture) fail('gpu-allocation');
    b.textures.push(texture); gl.bindTexture(target, texture);
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(target, gl.TEXTURE_BASE_LEVEL, 0); gl.texParameteri(target, gl.TEXTURE_MAX_LEVEL, 0);
    return texture;
  }
  #program(b: Bag, vertex: string, fragment: string, uniforms: readonly string[]): Program {
    const gl = this.#gl, shaders: WebGLShader[] = [];
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
        const shader = gl.createShader(type); if (!shader) fail('gpu-allocation'); shaders.push(shader);
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new GpuRendererError('gpu-shader-compile', gl.getShaderInfoLog(shader) ?? '');
      }
      const handle = gl.createProgram(); if (!handle) fail('gpu-allocation'); b.programs.push(handle);
      for (const shader of shaders) gl.attachShader(handle, shader);
      gl.linkProgram(handle); if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) throw new GpuRendererError('gpu-shader-link', gl.getProgramInfoLog(handle) ?? '');
      const uniform: Record<string, WebGLUniformLocation> = Object.create(null);
      for (const name of uniforms) { const location = gl.getUniformLocation(handle, name); if (location === null) fail('gpu-shader-uniform'); uniform[name] = location; }
      return { handle, uniform: Object.freeze(uniform) };
    } finally { for (const shader of shaders) gl.deleteShader(shader); }
  }
  #unpack(): void {
    const gl = this.#gl;
    gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    for (const p of [gl.UNPACK_ROW_LENGTH, gl.UNPACK_IMAGE_HEIGHT, gl.UNPACK_SKIP_ROWS, gl.UNPACK_SKIP_PIXELS, gl.UNPACK_SKIP_IMAGES]) gl.pixelStorei(p, 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  }
  #build(data: GpuSceneData, plan: ScenePlan): Resident {
    const gl = this.#gl, b = bag();
    // No GL allocations occur before all supplied raster data and staging sizes are checked.
    const count = data.rasters.length;
    const metadata = new Int32Array(plan.metadataBytes / 4);
    let offset = 0;
    for (let i = 0; i < count; i++) {
      const r = data.rasters[i]!;
      if (r.id !== i || !Number.isSafeInteger(r.width) || !Number.isSafeInteger(r.height) || r.width < 0 || r.height < 0 ||
        r.width * r.height !== r.depth.length || r.rgba.length !== r.depth.length * 4 ||
        !Number.isSafeInteger(r.minDepth) || !Number.isSafeInteger(r.maxDepth) || r.minDepth > r.maxDepth) fail('gpu-raster');
      metadata.set([r.width, r.height, offset, 0], i * 4); offset += r.depth.length;
      let min = Infinity, max = -Infinity;
      for (let p = 0; p < r.depth.length; p++) {
        const alpha = r.rgba[p * 4 + 3]!; if (alpha !== 0 && alpha !== 255) fail('gpu-raster-alpha');
        min = Math.min(min, r.depth[p]!); max = Math.max(max, r.depth[p]!);
      }
      // Factories may provide conservative bounds including zero for transparent pixels.
      if (min < r.minDepth || max > r.maxDepth) fail('gpu-raster-depth');
    }
    if (offset !== plan.pixels || data.scene.allocations.rasterCount !== count) fail('gpu-raster');
    const rgba = new Uint8Array(plan.atlasBytes / 2), depths = new Int32Array(plan.atlasBytes / 8);
    for (let i = 0; i < count; i++) {
      const r = data.rasters[i]!, at = metadata[i * 4 + 2]!;
      rgba.set(r.rgba, at * 4); depths.set(r.depth, at);
    }
    try {
      this.#peak = Math.max(this.#peak, this.#gpuBytes() + plan.bytes);
      this.#unpack(); gl.activeTexture(gl.TEXTURE0);
      const color = this.#texture(b, gl.TEXTURE_2D_ARRAY);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8UI, plan.side, plan.side, plan.layers);
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, plan.side, plan.side, plan.layers, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, rgba);
      const depth = this.#texture(b, gl.TEXTURE_2D_ARRAY);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.R32I, plan.side, plan.side, plan.layers);
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, plan.side, plan.side, plan.layers, gl.RED_INTEGER, gl.INT, depths);
      const meta = this.#texture(b, gl.TEXTURE_2D);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32I, plan.metaWidth, plan.metaHeight);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, plan.metaWidth, plan.metaHeight, gl.RGBA_INTEGER, gl.INT, metadata);
      const draw = this.#program(b, DRAW_VERTEX, DRAW_FRAGMENT,
        ['uSize', 'uMetadata', 'uMetadataWidth', 'uColor', 'uDepth', 'uSampleX', 'uSampleY', 'uTerrain', 'uAtlasSide', 'uHeight', 'uSprite']);
      const composite = this.#program(b, COMPOSITE_VERTEX, COMPOSITE_FRAGMENT,
        ['uTerrainColor', 'uTerrainInfo', 'uSpriteColor', 'uSpriteInfo', 'uBackground']);
      const vao = gl.createVertexArray(), compositeVao = gl.createVertexArray(), buffer = gl.createBuffer();
      if (vao) b.vaos.push(vao); if (compositeVao) b.vaos.push(compositeVao); if (buffer) b.buffers.push(buffer);
      if (!vao || !compositeVao || !buffer) fail('gpu-allocation');
      this.#check();
      return { bag: b, color, depth, metadata: meta, draw, composite, vao, compositeVao, buffer, bufferBytes: 0, plan, targets: null };
    } catch (error) { this.#delete(b); throw error; }
  }

  load(scene: GpuScene): void { this.#layer = null; try { this.#load(scene); } finally { this.#syncBudget(); } }
  #load(scene: GpuScene): void {
    this.#live();
    const plan = this.#scenePlan(scene);
    this.#budget(this.#gpuBytes() + plan.bytes, this.#cpuBytes() + plan.rasterBytes + plan.bytes);
    const data = copyGpuSceneData(scene);
    const candidate = this.#build(data, plan);
    this.#peak = Math.max(this.#peak, this.#gpuBytes() + plan.bytes);
    if (this.#resident) this.#deleteResident(this.#resident);
    this.#resident = candidate; this.#data = data; this.#state = 'ready'; this.#last = null; this.#generation++;
  }
  #target(b: Bag, width: number, height: number): Target {
    const gl = this.#gl, framebuffer = gl.createFramebuffer(); if (!framebuffer) fail('gpu-allocation'); b.framebuffers.push(framebuffer);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    const color = this.#texture(b, gl.TEXTURE_2D); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, width, height);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
    const info = this.#texture(b, gl.TEXTURE_2D); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG32I, width, height);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, info, 0);
    const depth = gl.createRenderbuffer(); if (!depth) fail('gpu-allocation'); b.renderbuffers.push(depth);
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT32F, width, height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) fail('gpu-framebuffer');
    return { framebuffer, color, info };
  }
  #targets(width: number, height: number, bytes: number): Targets {
    const gl = this.#gl, b = bag();
    try {
      const terrain = this.#target(b, width, height), sprites = this.#target(b, width, height);
      const sampleX = this.#texture(b, gl.TEXTURE_2D); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R32I, width, 1);
      const sampleY = this.#texture(b, gl.TEXTURE_2D); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R32I, height, 1);
      this.#check(); return { bag: b, terrain, sprites, sampleX, sampleY, width, height, bytes };
    } catch (error) { this.#delete(b); throw error; }
  }
  #frame(frame: GpuFrame): GpuFrameData {
    if (!this.#resident || !this.#data) fail('gpu-no-scene');
    if (field(frame, 'scene') !== this.#data.scene) fail('gpu-scene-mismatch');
    const a = field(frame, 'allocations');
    const count = integer(field(a, 'draws'), 0, this.#limits.instances, 'gpu-instance-limit');
    const axes = integer(field(a, 'axisBytes'), 0, GPU_PREPARE_LIMITS.viewportDimension * 8);
    const drawBytes = integer(field(a, 'drawBytes'), 0, this.#limits.instances * INSTANCE_BYTES);
    if (drawBytes !== count * INSTANCE_BYTES) fail('gpu-frame');
    this.#budget(this.#gpuBytes(), this.#cpuBytes() + axes + drawBytes);
    const data = copyGpuFrameData(frame);
    const { width, height } = data.viewport, hw = this.#hardware();
    integer(width, 1, Math.min(GPU_PREPARE_LIMITS.viewportDimension, hw.side), 'gpu-viewport');
    integer(height, 1, Math.min(GPU_PREPARE_LIMITS.viewportDimension, hw.side), 'gpu-viewport');
    if (data.scene !== this.#data.scene || data.sampleX.length !== width || data.sampleY.length !== height || axes !== (width + height) * 4 ||
      data.draws.length !== count * GPU_DRAW_STRIDE || data.terrainDraws !== frame.allocations.terrainDraws) fail('gpu-frame');
    integer(data.terrainDraws, 0, count);
    if (this.#gl.drawingBufferWidth !== width || this.#gl.drawingBufferHeight !== height) fail('gpu-drawing-buffer-size');
    let samples = 0, priorTerrain = -1, priorSprite = -1;
    for (let n = 0; n < count; n++) {
      const at = n * GPU_DRAW_STRIDE, values = data.draws;
      const x0 = values[at + D.x0]!, y0 = values[at + D.y0]!, x1 = values[at + D.x1]!, y1 = values[at + D.y1]!;
      if (x0 < 0 || y0 < 0 || x1 > width || y1 > height || x1 <= x0 || y1 <= y0) fail('gpu-draw-bounds');
      const id = values[at + D.raster]!, raster = this.#data.rasters[id]; if (!raster) fail('gpu-raster');
      const base = values[at + D.depthBase]!;
      if (base + raster.minDepth < GPU_DEPTH_MIN || base + raster.maxDepth > GPU_DEPTH_MAX) fail('gpu-depth-limit');
      const owner = values[at + D.owner]!, kind = values[at + D.kind]!, front = values[at + D.front]!;
      if (owner < 0 || kind !== (n < data.terrainDraws ? 1 : 2) || (front !== 0 && front !== 1) || values[at + D.reserved] !== 0) fail('gpu-draw-order');
      if (kind === 1) { if (owner < priorTerrain) fail('gpu-draw-order'); priorTerrain = owner; }
      else { if (owner < priorSprite) fail('gpu-draw-order'); priorSprite = owner; }
      samples += (x1 - x0) * (y1 - y0);
    }
    if (samples > GPU_PREPARE_LIMITS.samples || samples !== frame.allocations.samples) fail('gpu-sample-limit');
    return data;
  }
  #bind(unit: number, target: number, texture: WebGLTexture): void {
    const gl = this.#gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindSampler(unit, null); gl.bindTexture(target, texture);
  }
  #attributes(resident: Resident, offset: number): void {
    const gl = this.#gl; gl.bindVertexArray(resident.vao); gl.bindBuffer(gl.ARRAY_BUFFER, resident.buffer);
    for (let i = 0; i < 3; i++) {
      gl.enableVertexAttribArray(i); gl.vertexAttribIPointer(i, 4, gl.INT, INSTANCE_BYTES, offset + i * 16); gl.vertexAttribDivisor(i, 1);
    }
  }

  draw(frame: GpuFrame): GpuDrawReceipt { this.#layer = null; try { return this.#draw(frame, true); } finally { this.#syncBudget(); } }
  /** Internal composition seam. The identity receipt grants sampler binding, never raw handles. */
  drawLayer(frame: GpuFrame): GpuBaseLayerReceipt {
    this.#layer = null;
    try { const receipt = this.#draw(frame, false); return this.#layer = Object.freeze({ ...receipt, generation: this.#generation, width: frame.viewport.width, height: frame.viewport.height }); }
    finally { this.#syncBudget(); }
  }
  bindLayer(receipt: GpuBaseLayerReceipt, context: WebGL2RenderingContext): void {
    this.#live(); const t = this.#resident?.targets;
    if (context !== this.#gl || !receipt || receipt !== this.#layer || !t || this.#last !== receipt.frame || receipt.generation !== this.#generation || receipt.sequence !== this.#sequence || this.#gl.drawingBufferWidth !== receipt.width || this.#gl.drawingBufferHeight !== receipt.height || t.width !== receipt.width || t.height !== receipt.height) fail('gpu-layer-receipt');
    for (const [unit, texture] of [t.terrain.color, t.terrain.info, t.sprites.color, t.sprites.info].entries()) this.#bind(unit, this.#gl.TEXTURE_2D, texture);
    // Correctly typed unsigned fallback samplers when the optional voxel layer is absent.
    this.#bind(4, this.#gl.TEXTURE_2D, t.terrain.color); this.#bind(5, this.#gl.TEXTURE_2D, t.terrain.color);
  }
  #draw(frame: GpuFrame, present: boolean): GpuDrawReceipt {
    this.#live();
    const data = this.#frame(frame), r = this.#resident!, gl = this.#gl;
    if (this.#sequence >= Number.MAX_SAFE_INTEGER) fail('gpu-sequence-limit');
    const { width, height } = data.viewport;
    const targetBytes = width * height * 36 + (width + height) * 4;
    const replaceTargets = !r.targets || r.targets.width !== width || r.targets.height !== height;
    const replaceBuffer = data.draws.byteLength > r.bufferBytes;
    const bufferBytes = replaceBuffer ? data.draws.byteLength : r.bufferBytes;
    const peak = this.#gpuBytes() + (replaceTargets ? targetBytes : 0) + (replaceBuffer ? bufferBytes : 0);
    this.#budget(peak, this.#cpuBytes() + data.sampleX.byteLength + data.sampleY.byteLength + data.draws.byteLength);
    this.#peak = Math.max(this.#peak, peak);
    let nextTargets: Targets | null = null, nextBuffer: WebGLBuffer | null = null;
    try {
      if (replaceTargets) nextTargets = this.#targets(width, height, targetBytes);
      if (replaceBuffer) {
        nextBuffer = gl.createBuffer(); if (!nextBuffer) fail('gpu-allocation');
        gl.bindBuffer(gl.ARRAY_BUFFER, nextBuffer); gl.bufferData(gl.ARRAY_BUFFER, bufferBytes, gl.DYNAMIC_DRAW);
      }
      if (replaceTargets || replaceBuffer) this.#check();
    } catch (error) { if (nextTargets) this.#delete(nextTargets.bag); if (nextBuffer) gl.deleteBuffer(nextBuffer); throw error; }
    this.#peak = Math.max(this.#peak, peak);
    if (nextTargets) { if (r.targets) this.#delete(r.targets.bag); r.targets = nextTargets; }
    if (nextBuffer) {
      gl.deleteBuffer(r.buffer); r.bag.buffers = r.bag.buffers.filter(x => x !== r.buffer);
      r.buffer = nextBuffer; r.bag.buffers.push(nextBuffer); r.bufferBytes = bufferBytes;
    }
    // Past this point a driver failure invalidates the last diagnostic frame, not game state.
    this.#last = null;
    try {
      const t = r.targets!;
      this.#unpack();
      this.#bind(0, gl.TEXTURE_2D, t.sampleX); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, 1, gl.RED_INTEGER, gl.INT, data.sampleX);
      this.#bind(0, gl.TEXTURE_2D, t.sampleY); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, height, 1, gl.RED_INTEGER, gl.INT, data.sampleY);
      gl.bindBuffer(gl.ARRAY_BUFFER, r.buffer); if (data.draws.length) gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.draws);
      for (const cap of [gl.BLEND, gl.DITHER, gl.SCISSOR_TEST, gl.CULL_FACE, gl.STENCIL_TEST, gl.POLYGON_OFFSET_FILL,
        gl.SAMPLE_ALPHA_TO_COVERAGE, gl.SAMPLE_COVERAGE, gl.RASTERIZER_DISCARD]) gl.disable(cap);
      gl.colorMask(true, true, true, true); gl.depthMask(true); gl.depthRange(0, 1); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.GREATER);
      gl.viewport(0, 0, width, height); gl.useProgram(r.draw.handle);
      const u = r.draw.uniform;
      gl.uniform2i(u.uSize!, width, height); gl.uniform1i(u.uMetadataWidth!, r.plan.metaWidth); gl.uniform1i(u.uAtlasSide!, r.plan.side); gl.uniform1i(u.uHeight!, height);
      const textures: [string, number, WebGLTexture][] = [['uColor', gl.TEXTURE_2D_ARRAY, r.color], ['uDepth', gl.TEXTURE_2D_ARRAY, r.depth],
        ['uMetadata', gl.TEXTURE_2D, r.metadata], ['uSampleX', gl.TEXTURE_2D, t.sampleX], ['uSampleY', gl.TEXTURE_2D, t.sampleY]];
      for (let i = 0; i < textures.length; i++) { const [name, target, texture] = textures[i]!; this.#bind(i, target, texture); gl.uniform1i(u[name]!, i); }
      gl.uniform1i(u.uTerrain!, 5);
      const count = data.draws.length / GPU_DRAW_STRIDE;
      let calls = present ? 1 : 0;
      for (let pass = 0; pass < 2; pass++) {
        const target = pass === 0 ? t.terrain : t.sprites;
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array(4)); gl.clearBufferiv(gl.COLOR, 1, new Int32Array([NONE_DEPTH, -1, 0, 0]));
        gl.clearBufferfv(gl.DEPTH, 0, new Float32Array([0]));
        // The terrain pass must not sample its own framebuffer, even through a disabled branch.
        this.#bind(5, gl.TEXTURE_2D, pass === 0 ? r.metadata : t.terrain.info); gl.uniform1i(u.uSprite!, pass);
        const start = pass === 0 ? 0 : data.terrainDraws, instances = pass === 0 ? data.terrainDraws : count - data.terrainDraws;
        if (instances) { this.#attributes(r, start * INSTANCE_BYTES); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, instances); calls++; }
      }
      if (present) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.drawBuffers([gl.BACK]); gl.disable(gl.DEPTH_TEST);
      gl.bindVertexArray(r.compositeVao); gl.useProgram(r.composite.handle);
      for (const [i, name, texture] of [[0, 'uTerrainColor', t.terrain.color], [1, 'uTerrainInfo', t.terrain.info],
        [2, 'uSpriteColor', t.sprites.color], [3, 'uSpriteInfo', t.sprites.info]] as const) {
        this.#bind(i, gl.TEXTURE_2D, texture); gl.uniform1i(r.composite.uniform[name]!, i);
      }
      const bg = data.viewport.backgroundRgba;
      gl.uniform4ui(r.composite.uniform.uBackground!, bg[0], bg[1], bg[2], bg[3]); gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      // Steady submission does not query errors or wait for completion. The explicit
      // diagnostic readback/caller correctness harness checks errors outside cadence.
      this.#live(); this.#last = frame;
      return Object.freeze({ sequence: ++this.#sequence, frame, submitted: true, drawCalls: calls,
        uploadedBytes: data.draws.byteLength + data.sampleX.byteLength + data.sampleY.byteLength });
    } catch (error) { this.#last = null; throw error; }
  }

  readback(): GpuReadback {
    this.#live();
    const r = this.#resident, frame = this.#last;
    if (!r?.targets || !frame) fail('gpu-no-frame');
    const { width, height } = r.targets, pixels = width * height;
    // Guaranteed integer read formats use 32-bit four-component scratch arrays for each
    // attachment. Scratch is reused for the two passes: 32 B/pixel + 13 B/pixel result.
    this.#budget(this.#gpuBytes(), this.#cpuBytes() + pixels * 45);
    const color = new Uint32Array(pixels * 4), info = new Int32Array(pixels * 4);
    const rgba = new Uint8Array(pixels * 4), depth = new Int32Array(pixels), kind = new Uint8Array(pixels), owner = new Int32Array(pixels);
    depth.fill(NONE_DEPTH); owner.fill(-1);
    const bg = frame.viewport.backgroundRgba; for (let i = 0; i < pixels; i++) rgba.set(bg, i * 4);
    const gl = this.#gl;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null); gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
    for (const p of [gl.PACK_ROW_LENGTH, gl.PACK_SKIP_ROWS, gl.PACK_SKIP_PIXELS]) gl.pixelStorei(p, 0);
    try {
      for (const [target, category] of [[r.targets.terrain, 1], [r.targets.sprites, 2]] as const) {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, target.framebuffer); gl.readBuffer(gl.COLOR_ATTACHMENT0);
        gl.readPixels(0, 0, width, height, gl.RGBA_INTEGER, gl.UNSIGNED_INT, color);
        gl.readBuffer(gl.COLOR_ATTACHMENT1); gl.readPixels(0, 0, width, height, gl.RGBA_INTEGER, gl.INT, info); this.#check();
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const source = ((height - 1 - y) * width + x) * 4, at = y * width + x;
          if (info[source + 1]! < 0) continue;
          depth[at] = info[source]!; owner[at] = info[source + 1]!; kind[at] = category;
          for (let c = 0; c < 4; c++) rgba[at * 4 + c] = color[source + c]!;
        }
      }
      return Object.freeze({ width, height, rgba, depth, kind, owner });
    } finally { gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); }
  }
  stats(): GpuRendererStats {
    if (this.#state !== 'disposed' && this.#gl.isContextLost()) this.#lose();
    return Object.freeze({ state: this.#state, generation: this.#generation, requestedGpuBytes: this.#gpuBytes(),
      peakRequestedGpuBytes: this.#peak, ownedCpuBytes: this.#cpuBytes() });
  }
  /** Call after webglcontextrestored. Rebuilds the retained scene; the next draw supplies a new frame. */
  restore(): void { this.#layer = null; try { this.#restore(); } finally { this.#syncBudget(); } }
  #restore(): void {
    if (this.#state === 'disposed') fail('gpu-disposed');
    if (this.#gl.isContextLost()) { this.#lose(); fail('gpu-context-lost'); }
    if (this.#state !== 'lost') fail('gpu-not-lost');
    if (!this.#data) { this.#state = 'empty'; this.#generation++; return; }
    const plan = this.#scenePlan(this.#data.scene);
    this.#budget(plan.bytes, this.#cpuBytes() + plan.bytes);
    const resident = this.#build(this.#data, plan);
    this.#resident = resident; this.#state = 'ready'; this.#last = null; this.#generation++;
    this.#peak = Math.max(this.#peak, plan.bytes);
  }
  dispose(): void {
    if (this.#state === 'disposed') return;
    if (!this.#gl.isContextLost()) {
      // Programs marked for deletion remain alive while current; release dedicated bindings.
      const gl = this.#gl;
      gl.useProgram(null); gl.bindVertexArray(null); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindRenderbuffer(gl.RENDERBUFFER, null);
      for (const target of [gl.ARRAY_BUFFER, gl.PIXEL_PACK_BUFFER, gl.PIXEL_UNPACK_BUFFER]) gl.bindBuffer(target, null);
      for (let unit = 0; unit < 6; unit++) {
        gl.activeTexture(gl.TEXTURE0 + unit); gl.bindSampler(unit, null);
        gl.bindTexture(gl.TEXTURE_2D, null); gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
      }
      if (this.#resident) this.#deleteResident(this.#resident);
    }
    this.#resident = null; this.#data = null; this.#last = null; this.#state = 'disposed'; this.#generation++;
    this.#layer = null;
    if (this.#shared) { releaseGpuResourceOwner(this.#shared.budget, this.#shared.owner); this.#shared = null; }
    this.#gl.canvas.removeEventListener('webglcontextlost', this.#onLost);
  }
}
