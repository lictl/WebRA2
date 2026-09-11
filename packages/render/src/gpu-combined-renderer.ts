// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. See ../GPU_COMBINED_PROVENANCE.md.
import { assertGpuFrame, assertGpuScene, pickGpuFrame } from './gpu-scene.ts';
import { GPU_DEPTH_MAX, GPU_DEPTH_MIN, type GpuFrame, type GpuScene } from './gpu-contracts.ts';
import { GpuRenderer, createGpuResourceBudget, registerGpuResourceOwner, checkGpuResourceBudget, commitGpuResourceBudget, releaseGpuResourceOwner, gpuResourceBudgetStats, type GpuResourceBudget } from './gpu-renderer.ts';
import { GpuVoxelRenderer } from './gpu-voxel-renderer.ts';
import { assertGpuVoxelFrame, assertGpuVoxelScene, resolveGpuVoxelOwner, type GpuVoxelFrame, type GpuVoxelScene, type GpuVoxelHit } from './gpu-voxel-policy.ts';

export const GPU_COMBINED_LIMITS = Object.freeze({ gpuBytes: 256 * 1024 * 1024, stagingBytes: 256 * 1024 * 1024, textureSide: 2048 });
export type GpuCombinedLimits = { -readonly [K in keyof typeof GPU_COMBINED_LIMITS]: number };
export class GpuCombinedRendererError extends Error {
  readonly fallbackRequired = true;
  constructor(readonly code: string, options?: ErrorOptions) { super('gpu-combined-' + code, options); this.name = 'GpuCombinedRendererError'; }
}
export interface GpuCombinedReceipt {
  readonly generation: number; readonly sequence: number; readonly width: number; readonly height: number;
  readonly base: GpuFrame; readonly voxel: GpuVoxelFrame | null; readonly submitted: true;
  readonly drawCalls: number; readonly uploadedBytes: number;
}
export type GpuCombinedHit = NonNullable<ReturnType<typeof pickGpuFrame>> | (GpuVoxelHit & { readonly kind: 'voxel' });
export interface GpuCombinedReadback {
  readonly generation: number; readonly sequence: number; readonly width: number; readonly height: number;
  readonly rgba: Uint8Array; readonly kind: Uint8Array; readonly owner: Int32Array; readonly depthWord: Uint32Array; readonly depth: Float64Array;
}
interface Program { handle: WebGLProgram; uniforms: Map<string, WebGLUniformLocation> }
interface Targets { framebuffer: WebGLFramebuffer; color: WebGLTexture; hit: WebGLTexture; width: number; height: number }
const NONE = 0xffffffff;
const vertex = `#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0,1);}`;
// All admitted base integers have an exact binary32 encoding. Construct it with integer
// shifts, so mixed-layer ordering never depends on a float(int) conversion or rounding.
const winner = `#version 300 es
precision highp float;precision highp int;precision highp usampler2D;precision highp isampler2D;
uniform usampler2D uTerrainColor,uSpriteColor,uVoxelColor,uVoxelHit;
uniform isampler2D uTerrainInfo,uSpriteInfo;uniform bool uVoxel;uniform uvec4 uBackground;
layout(location=0)out uvec4 outColor;layout(location=1)out uvec4 outHit;
uint integerBits(int v){if(v==0)return 0u;uint n=uint(v<0?-v:v);int e=0;uint q=n;if(q>=65536u){q>>=16;e+=16;}if(q>=256u){q>>=8;e+=8;}if(q>=16u){q>>=4;e+=4;}if(q>=4u){q>>=2;e+=2;}if(q>=2u)e+=1;return(v<0?0x80000000u:0u)|(uint(e+127)<<23)|((n<<uint(23-e))&0x7fffffu);}
uint ordered(uint w){return(w&0x80000000u)!=0u?~w:(w^0x80000000u);}
bool greater(uint w,int base){if((w&0x7fffffffu)==0u&&base==0)return false;return ordered(w)>ordered(integerBits(base));}
void main(){
 ivec2 p=ivec2(gl_FragCoord.xy);ivec2 t=texelFetch(uTerrainInfo,p,0).xy,s=texelFetch(uSpriteInfo,p,0).xy;
 int d=0;uint owner=0xffffffffu,kind=0u,word=0u;uvec4 c=uBackground;bool valid=true;
 if(t.y>=0){d=t.x;owner=uint(t.y);kind=1u;c=texelFetch(uTerrainColor,p,0);}
 if(s.y>=0){d=s.x;owner=uint(s.y);kind=2u;c=texelFetch(uSpriteColor,p,0);}
 if(kind!=0u){valid=d>=-2097151&&d<=2097151&&c.a==255u;word=uint(d);}
 if(uVoxel){uvec2 hit=texelFetch(uVoxelHit,p,0).xy;uvec4 vc=texelFetch(uVoxelColor,p,0);
  if(hit.x!=0xffffffffu){uint magnitude=hit.y&0x7fffffffu;
   // 0x4a000000 is exact 2097152. No widened world/depth policy is admitted.
   if(magnitude>0x4a000000u||vc.a!=255u)valid=false;
   else if(valid&&(kind==0u||greater(hit.y,d))){owner=hit.x;word=hit.y;kind=3u;c=vc;}
  }else if(vc.a!=0u)valid=false;
 }
 if(!valid){outColor=uvec4(255,0,255,255);outHit=uvec4(0,0xffffffffu,0,0);return;}
 outColor=c;outHit=uvec4(kind,owner,word,1);
}`;
const delivery = `#version 300 es
precision highp float;precision highp int;precision highp usampler2D;
uniform usampler2D uColor;out vec4 color;
void main(){color=vec4(texelFetch(uColor,ivec2(gl_FragCoord.xy),0))*(1.0/255.0);}`;
function fail(code: string): never { throw new GpuCombinedRendererError(code); }
function captureLimits(input: Partial<GpuCombinedLimits>): GpuCombinedLimits {
  if (!input || Object.getPrototypeOf(input) !== Object.prototype) fail('limits'); const cap = { ...GPU_COMBINED_LIMITS };
  for (const key of Reflect.ownKeys(input)) { if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('limits'); const d = Object.getOwnPropertyDescriptor(input, key);
    if (!d || !('value' in d) || !Number.isSafeInteger(d.value) || d.value < 1 || d.value > cap[key as keyof GpuCombinedLimits]) fail('limits'); cap[key as keyof GpuCombinedLimits] = d.value;
  } return cap;
}

/** Caller-owned dedicated context. Cadence has no readback; pick reads one displayed pixel. */
export class GpuCombinedRenderer {
  #gl: WebGL2RenderingContext; #cap: GpuCombinedLimits; #budget: GpuResourceBudget; #owner: object;
  #base: GpuRenderer | null = null; #voxel: GpuVoxelRenderer | null = null; #source: { base: GpuScene; voxel: GpuVoxelScene | null } | null = null;
  #targets: Targets | null = null; #winner: Program | null = null; #delivery: Program | null = null; #vao: WebGLVertexArrayObject | null = null;
  #last: GpuCombinedReceipt | null = null; #generation = 0; #sequence = 0;
  #state: 'empty' | 'ready' | 'lost' | 'failed' | 'disposed' = 'empty';
  #onLost = (event: Event): void => { event.preventDefault(); if (this.#state === 'disposed' || this.#state === 'lost') return; this.#last = null; this.#state = 'lost'; this.#generation++; this.#disposeLayers(); this.#dropTargets(false); };
  constructor(context: WebGL2RenderingContext, lower: Partial<GpuCombinedLimits> = {}) {
    this.#cap = captureLimits(lower); this.#gl = context;
    const attributes = context.getContextAttributes(); if (!attributes?.alpha || attributes.antialias || attributes.premultipliedAlpha) fail('context-attributes');
    this.#cap.textureSide = Math.min(this.#cap.textureSide, context.getParameter(context.MAX_TEXTURE_SIZE) as number);
    if (!Number.isInteger(this.#cap.textureSide) || this.#cap.textureSide < 1 || context.getParameter(context.MAX_DRAW_BUFFERS) < 2 || context.getParameter(context.MAX_COLOR_ATTACHMENTS) < 2 || context.getParameter(context.MAX_TEXTURE_IMAGE_UNITS) < 6) fail('capabilities');
    this.#budget = createGpuResourceBudget(context, this.#cap.gpuBytes, this.#cap.stagingBytes); this.#owner = registerGpuResourceOwner(this.#budget, context);
    (context.canvas as EventTarget).addEventListener('webglcontextlost', this.#onLost);
    if (context.isContextLost()) this.#state = 'lost';
  }
  #active(): void { if (this.#state === 'disposed') fail('disposed'); if (this.#gl.isContextLost()) { if (this.#state !== 'lost') this.#onLost(new Event('webglcontextlost')); fail('context-lost'); } if (this.#state === 'lost') fail('context-lost'); }
  #bytes(): number { return this.#targets ? this.#targets.width * this.#targets.height * 20 : 0; }
  #check(): void { this.#active(); if (this.#gl.getError() !== this.#gl.NO_ERROR) fail('gl-error'); }
  #sync(): void { commitGpuResourceBudget(this.#budget, this.#owner, this.#bytes(), 0); }
  #dropTargets(remove: boolean): void {
    const gl = this.#gl; if (remove) { if (this.#targets) { gl.deleteFramebuffer(this.#targets.framebuffer); gl.deleteTexture(this.#targets.color); gl.deleteTexture(this.#targets.hit); }
      if (this.#winner) gl.deleteProgram(this.#winner.handle); if (this.#delivery) gl.deleteProgram(this.#delivery.handle); if (this.#vao) gl.deleteVertexArray(this.#vao);
    } this.#targets = null; this.#winner = null; this.#delivery = null; this.#vao = null; this.#sync();
  }
  #disposeLayers(): void { this.#base?.dispose(); this.#voxel?.dispose(); this.#base = null; this.#voxel = null; }
  #error(error: unknown): never { this.#last = null; if (this.#state !== 'lost' && this.#state !== 'disposed') this.#state = 'failed'; if (error instanceof GpuCombinedRendererError) throw error; throw new GpuCombinedRendererError('operation', { cause: error }); }
  load(base: GpuScene, voxel: GpuVoxelScene | null = null): void {
    this.#last = null;
    try {
      this.#active(); assertGpuScene(base); if (voxel !== null) assertGpuVoxelScene(voxel);
      if (this.#generation >= Number.MAX_SAFE_INTEGER) fail('generation-limit');
      this.#base ??= new GpuRenderer(this.#gl, { gpuBytes: this.#cap.gpuBytes, textureSide: this.#cap.textureSide }, this.#budget);
      this.#base.load(base);
      if (voxel) { this.#voxel ??= new GpuVoxelRenderer(this.#gl, this.#cap, this.#budget); this.#voxel.load(voxel); }
      else { this.#voxel?.dispose(); this.#voxel = null; }
      this.#dropTargets(true); this.#source = { base, voxel }; this.#generation++; this.#state = 'ready';
    } catch (error) { this.#error(error); }
  }
  #program(source: string, names: readonly string[]): Program {
    const gl = this.#gl, shaders: WebGLShader[] = []; const handle = gl.createProgram(); if (!handle) fail('allocation');
    try { for (const [type, text] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, source]] as const) { const shader = gl.createShader(type); if (!shader) fail('allocation'); shaders.push(shader); gl.shaderSource(shader, text); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) fail('shader'); gl.attachShader(handle, shader); }
      gl.linkProgram(handle); if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) fail('program'); const uniforms = new Map<string, WebGLUniformLocation>();
      for (const name of names) { const location = gl.getUniformLocation(handle, name); if (location === null) fail('uniform'); uniforms.set(name, location); } return { handle, uniforms };
    } catch (error) { gl.deleteProgram(handle); throw error; } finally { for (const shader of shaders) gl.deleteShader(shader); }
  }
  #allocate(width: number, height: number): void {
    const gl = this.#gl;
    if (!this.#winner) this.#winner = this.#program(winner, ['uTerrainColor', 'uTerrainInfo', 'uSpriteColor', 'uSpriteInfo', 'uVoxelColor', 'uVoxelHit', 'uVoxel', 'uBackground']);
    if (!this.#delivery) this.#delivery = this.#program(delivery, ['uColor']);
    if (!this.#vao) { this.#vao = gl.createVertexArray(); if (!this.#vao) fail('allocation'); }
    if (this.#targets?.width === width && this.#targets.height === height) return;
    checkGpuResourceBudget(this.#budget, this.#owner, this.#bytes() + width * height * 20, 0);
    const textures: WebGLTexture[] = []; let framebuffer: WebGLFramebuffer | null = null;
    try {
      gl.activeTexture(gl.TEXTURE0); gl.bindSampler(0, null);
      for (const format of [gl.RGBA8UI, gl.RGBA32UI]) { const texture = gl.createTexture(); if (!texture) fail('allocation'); textures.push(texture); gl.bindTexture(gl.TEXTURE_2D, texture);
        for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texStorage2D(gl.TEXTURE_2D, 1, format, width, height);
      }
      framebuffer = gl.createFramebuffer(); if (!framebuffer) fail('allocation'); gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      textures.forEach((texture, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, texture, 0)); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) fail('framebuffer'); this.#check();
      const prior = this.#targets; this.#targets = { framebuffer, color: textures[0]!, hit: textures[1]!, width, height };
      if (prior) { gl.deleteFramebuffer(prior.framebuffer); gl.deleteTexture(prior.color); gl.deleteTexture(prior.hit); } this.#sync();
    } catch (error) { for (const texture of textures) gl.deleteTexture(texture); if (framebuffer) gl.deleteFramebuffer(framebuffer); throw error; }
  }
  draw(base: GpuFrame, voxel: GpuVoxelFrame | null = null): GpuCombinedReceipt {
    this.#last = null;
    try {
      this.#active(); if (this.#state !== 'ready' || !this.#source || !this.#base) fail('no-scene'); assertGpuFrame(base); if (voxel !== null) assertGpuVoxelFrame(voxel);
      if (base.scene !== this.#source.base || (voxel?.scene ?? null) !== this.#source.voxel || (voxel === null) !== (this.#voxel === null)) fail('scene');
      const { width, height } = base.viewport;
      if (width > this.#cap.textureSide || height > this.#cap.textureSide || (voxel && (voxel.width !== width || voxel.height !== height)) || this.#gl.drawingBufferWidth !== width || this.#gl.drawingBufferHeight !== height) fail('size');
      if (this.#sequence >= Number.MAX_SAFE_INTEGER) fail('sequence-limit');
      const b = this.#base.drawLayer(base), v = voxel ? this.#voxel!.drawLayer(voxel) : null;
      this.#allocate(width, height); const gl = this.#gl, t = this.#targets!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.framebuffer); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      for (const cap of [gl.BLEND, gl.DITHER, gl.DEPTH_TEST, gl.STENCIL_TEST, gl.SCISSOR_TEST, gl.CULL_FACE, gl.POLYGON_OFFSET_FILL, gl.SAMPLE_ALPHA_TO_COVERAGE, gl.SAMPLE_COVERAGE, gl.RASTERIZER_DISCARD]) gl.disable(cap);
      gl.colorMask(true, true, true, true); gl.bindVertexArray(this.#vao); gl.viewport(0, 0, width, height); gl.useProgram(this.#winner!.handle);
      this.#base.bindLayer(b, gl); if (v) this.#voxel!.bindLayer(v, gl);
      for (const [unit, name] of ['uTerrainColor', 'uTerrainInfo', 'uSpriteColor', 'uSpriteInfo', 'uVoxelColor', 'uVoxelHit'].entries()) gl.uniform1i(this.#winner!.uniforms.get(name)!, unit);
      gl.uniform1i(this.#winner!.uniforms.get('uVoxel')!, v ? 1 : 0); const bg = base.viewport.backgroundRgba; gl.uniform4ui(this.#winner!.uniforms.get('uBackground')!, bg[0], bg[1], bg[2], bg[3]); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.drawBuffers([gl.BACK]); gl.useProgram(this.#delivery!.handle); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t.color); gl.uniform1i(this.#delivery!.uniforms.get('uColor')!, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.#active(); return this.#last = Object.freeze({ generation: this.#generation, sequence: ++this.#sequence, width, height, base, voxel, submitted: true, drawCalls: b.drawCalls + (v?.drawCalls ?? 0) + 2, uploadedBytes: b.uploadedBytes + (v?.uploadedBytes ?? 0) });
    } catch (error) { this.#error(error); }
  }
  #current(sequence?: number): GpuCombinedReceipt {
    this.#active(); const receipt = this.#last; if (!receipt || this.#state !== 'ready' || (sequence !== undefined && sequence !== receipt.sequence)) fail('no-frame');
    if (this.#gl.drawingBufferWidth !== receipt.width || this.#gl.drawingBufferHeight !== receipt.height) this.#error(new GpuCombinedRendererError('resized'));
    return receipt;
  }
  #read(x: number, y: number, width: number, height: number, color: boolean): { hits: Uint32Array; rgba: Uint32Array } {
    const gl = this.#gl, hits = new Uint32Array(width * height * 4), rgba = new Uint32Array(color ? hits.length : 0);
    try { gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null); gl.pixelStorei(gl.PACK_ALIGNMENT, 1); for (const p of [gl.PACK_ROW_LENGTH, gl.PACK_SKIP_ROWS, gl.PACK_SKIP_PIXELS]) gl.pixelStorei(p, 0);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.#targets!.framebuffer); if (color) { gl.readBuffer(gl.COLOR_ATTACHMENT0); gl.readPixels(x, y, width, height, gl.RGBA_INTEGER, gl.UNSIGNED_INT, rgba); }
      gl.readBuffer(gl.COLOR_ATTACHMENT1); gl.readPixels(x, y, width, height, gl.RGBA_INTEGER, gl.UNSIGNED_INT, hits); this.#check(); return { hits, rgba };
    } finally { gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); }
  }
  #sample(words: Uint32Array, at: number): { kind: number; owner: number; word: number; depth: number } {
    const kind = words[at]!, owner = words[at + 1]!, word = words[at + 2]!, valid = words[at + 3]!;
    const frame = this.#last!;
    if (valid !== 1 || kind > 3 || (kind === 0 && (owner !== NONE || word !== 0)) ||
      (kind === 1 && owner >= frame.base.scene.allocations.terrainPieces) ||
      (kind === 2 && owner >= frame.base.allocations.objects) ||
      (kind === 3 && (!frame.voxel || owner >= frame.voxel.allocations.instanceVoxels))) fail('invalid-depth');
    const depth = kind === 3 ? new Float32Array(words.buffer, words.byteOffset + (at + 2) * 4, 1)[0]! : kind ? word | 0 : -Infinity;
    if (kind && (!Number.isFinite(depth) || (kind === 3 ? Math.abs(depth) > 2097152 || owner === NONE : depth < GPU_DEPTH_MIN || depth > GPU_DEPTH_MAX))) fail('invalid-depth');
    return { kind, owner: kind === 0 ? -1 : owner, word, depth };
  }
  pick(sequence: number, x: number, y: number): GpuCombinedHit | null {
    try {
      this.#active(); if (!this.#last || sequence !== this.#last.sequence || !Number.isSafeInteger(sequence) || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= this.#last.width || y >= this.#last.height) return null;
      const receipt = this.#current(sequence); checkGpuResourceBudget(this.#budget, this.#owner, this.#bytes(), 16);
      const { hits } = this.#read(Math.floor(x), receipt.height - 1 - Math.floor(y), 1, 1, false), sample = this.#sample(hits, 0);
      if (!sample.kind) return null;
      if (sample.kind === 3) { if (!receipt.voxel) fail('invalid-depth'); const hit = resolveGpuVoxelOwner(receipt.voxel, sample.owner, sample.depth); if (!hit) fail('invalid-depth'); return Object.freeze({ kind: 'voxel', ...hit }); }
      return pickGpuFrame(receipt.base, { kind: sample.kind, owner: sample.owner, depth: sample.depth }, x, y);
    } catch (error) { this.#error(error); }
  }
  /** Explicit diagnostic only. Any invalid shader sentinel invalidates every displayed pick. */
  readback(sequence?: number): GpuCombinedReadback {
    try {
      const receipt = this.#current(sequence), { width, height } = receipt, pixels = width * height;
      checkGpuResourceBudget(this.#budget, this.#owner, this.#bytes(), pixels * 53);
      const raw = this.#read(0, 0, width, height, true), rgba = new Uint8Array(pixels * 4), kind = new Uint8Array(pixels), owner = new Int32Array(pixels), depthWord = new Uint32Array(pixels), depth = new Float64Array(pixels);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const target = y * width + x, source = ((height - y - 1) * width + x) * 4, sample = this.#sample(raw.hits, source);
        for (let c = 0; c < 4; c++) rgba[target * 4 + c] = raw.rgba[source + c]!;
        kind[target] = sample.kind; owner[target] = sample.owner; depthWord[target] = sample.word; depth[target] = sample.depth;
      } return Object.freeze({ generation: receipt.generation, sequence: receipt.sequence, width, height, rgba, kind, owner, depthWord, depth });
    } catch (error) { this.#error(error); }
  }
  stats() { if (this.#state !== 'disposed' && this.#gl.isContextLost() && this.#state !== 'lost') this.#onLost(new Event('webglcontextlost')); return Object.freeze({ state: this.#state, generation: this.#generation, sequence: this.#sequence, ...gpuResourceBudgetStats(this.#budget) }); }
  restore(): void {
    try { if (this.#state === 'disposed' || (this.#state !== 'lost' && this.#state !== 'failed') || this.#gl.isContextLost() || !this.#source) fail('restore');
      const source = this.#source; this.#last = null; this.#disposeLayers(); this.#dropTargets(true); this.#state = 'empty'; this.load(source.base, source.voxel);
    } catch (error) { this.#error(error); }
  }
  dispose(): void {
    if (this.#state === 'disposed') return; this.#last = null; this.#disposeLayers(); this.#dropTargets(!this.#gl.isContextLost()); this.#source = null; this.#state = 'disposed'; this.#generation++;
    releaseGpuResourceOwner(this.#budget, this.#owner); (this.#gl.canvas as EventTarget).removeEventListener('webglcontextlost', this.#onLost);
  }
}
