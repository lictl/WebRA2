// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Experimental bounded unlit voxel layer.
import { copyGpuVoxelSceneData, copyGpuVoxelFrameData, resolveGpuVoxelOwner, assertGpuVoxelScene, assertGpuVoxelFrame, type GpuVoxelScene, type GpuVoxelFrame, type GpuVoxelHit } from './gpu-voxel-policy.ts';

export const GPU_VOXEL_RENDER_LIMITS = Object.freeze({ gpuBytes: 256 * 1024 * 1024, stagingBytes: 256 * 1024 * 1024, textureSide: 2048 });
export type GpuVoxelRendererLimits = { -readonly [K in keyof typeof GPU_VOXEL_RENDER_LIMITS]: number };
interface Texture { handle: WebGLTexture; width: number; height: number; bytes: number; internal: number; format: number; type: number; components: number }
interface Program { handle: WebGLProgram; uniforms: Map<string, WebGLUniformLocation> }
interface Targets { framebuffer: WebGLFramebuffer; color: Texture; hit: Texture; width: number; height: number }
type FrameData = ReturnType<typeof copyGpuVoxelFrameData>;
const NONE = 0xffffffff;
const vertex = `#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0,1);}`;
const fragment = `#version 300 es
precision highp float;precision highp int;precision highp sampler2D;precision highp usampler2D;precision highp isampler2D;
uniform usampler2D uGeometry,uPalette,uBins,uCandidates;uniform isampler2D uBoxes;uniform sampler2D uInverse;
uniform ivec2 uSize;uniform int uTilesX;
layout(location=0)out uvec4 outColor;layout(location=1)out uvec2 outHit;
ivec2 coord(int i,int width){return ivec2(i%width,i/width);}
ivec4 boxAt(int i){return texelFetch(uBoxes,coord(i,textureSize(uBoxes,0).x),0);}
vec4 inverseAt(int i){return texelFetch(uInverse,coord(i,textureSize(uInverse,0).x),0);}
float hitDepth(int instance,uvec3 lo,vec2 pixel){
 float near=3.402823466e38,far=-3.402823466e38;
 for(int axis=0;axis<3;axis++){
  vec4 row=inverseAt(instance*3+axis);float a=row.x*pixel.x;float b=row.y*pixel.y;float origin=(a+b)+row.w;
  float lower=float(lo[axis]),d=row.z;
  if(d==0.0){if(origin<lower||origin>=lower+1.0)return -3.402823466e38;continue;}
  float start=(lower-origin)/d,end=(lower+1.0-origin)/d;
  far=max(far,min(start,end));near=min(near,max(start,end));if(near<=far)return -3.402823466e38;
 }
 if(isnan(near)||isinf(near))return -3.402823466e38;return near;
}
void main(){
 ivec2 pixel=ivec2(int(gl_FragCoord.x),uSize.y-1-int(gl_FragCoord.y));
 int bin=(pixel.y/16)*uTilesX+pixel.x/16;uvec2 span=texelFetch(uBins,coord(bin,textureSize(uBins,0).x),0).xy;
 float best=-3.402823466e38;uint owner=0xffffffffu;uvec4 color=uvec4(0);
 for(uint at=span.x;at<span.y;at++){
  uint index=texelFetch(uCandidates,coord(int(at),textureSize(uCandidates,0).x),0).x;
  ivec4 bounds=boxAt(int(index)*2);if(pixel.x<bounds.x||pixel.y<bounds.y||pixel.x>=bounds.z||pixel.y>=bounds.w)continue;
  ivec4 data=boxAt(int(index)*2+1);uint word=texelFetch(uGeometry,coord(data.x,textureSize(uGeometry,0).x),0).x;
  uvec4 rgba=texelFetch(uPalette,ivec2(int(word>>24),data.w),0);if(rgba.a==0u)continue;
  float depth=hitDepth(data.y,uvec3(word&255u,(word>>8)&255u,(word>>16)&255u),vec2(pixel)+vec2(.5));
  if(depth>best){best=depth;owner=uint(data.z);color=rgba;}
 }
 outColor=color;outHit=uvec2(owner,floatBitsToUint(best));
}`;
const composite = `#version 300 es
precision highp float;precision highp int;precision highp usampler2D;
uniform usampler2D uColor;uniform uvec4 uBackground;out vec4 color;
void main(){uvec4 p=texelFetch(uColor,ivec2(gl_FragCoord.xy),0);color=vec4(p.a==0u?uBackground:p)*(1.0/255.0);}`;
function fail(code: string): never { throw new Error('gpu-voxel-renderer-' + code); }
function capValue(value: unknown, max: number): number { if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > max) fail('limits'); return value as number; }
function background(input: readonly number[]): Uint32Array {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype || Reflect.ownKeys(input).length !== 5 || Object.getOwnPropertyDescriptor(input, 'length')?.value !== 4) fail('background');
  const out = new Uint32Array(4); for (let i = 0; i < 4; i++) { const d = Object.getOwnPropertyDescriptor(input, String(i)); if (!d || !('value' in d) || !Number.isInteger(d.value) || d.value < 0 || d.value > 255) fail('background'); out[i] = d.value; } return out;
}

/** Dedicated caller-owned WebGL2 context. No full-frame readback occurs during draw. */
export class GpuVoxelRenderer {
  #gl: WebGL2RenderingContext; #cap: GpuVoxelRendererLimits; #scene: GpuVoxelScene | null = null;
  #resident: ReturnType<typeof copyGpuVoxelSceneData> | null = null; #frame: GpuVoxelFrame | null = null;
  #textures = new Map<string, Texture>(); #targets: Targets | null = null; #ray: Program | null = null; #composite: Program | null = null; #vao: WebGLVertexArrayObject | null = null;
  #state: 'empty' | 'ready' | 'lost' | 'disposed' = 'empty'; #generation = 0; #sequence = 0; #gpuBytes = 0; #peak = 0; #peakStaging = 0;
  #lost = (event: Event) => { event.preventDefault(); if (this.#state === 'disposed') return; this.#drop(false); this.#state = 'lost'; this.#frame = null; };
  constructor(context: WebGL2RenderingContext, lower: Partial<GpuVoxelRendererLimits> = {}) {
    const cap: GpuVoxelRendererLimits = { ...GPU_VOXEL_RENDER_LIMITS };
    if (!lower || Object.getPrototypeOf(lower) !== Object.prototype) fail('limits');
    for (const key of Reflect.ownKeys(lower)) { if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('limits'); const d = Object.getOwnPropertyDescriptor(lower, key); if (!d || !('value' in d)) fail('limits'); cap[key as keyof GpuVoxelRendererLimits] = capValue(d.value, cap[key as keyof GpuVoxelRendererLimits]); }
    this.#gl = context; this.#cap = cap; const attributes = context.getContextAttributes();
    if (!attributes || !attributes.alpha || attributes.premultipliedAlpha || attributes.antialias) fail('context-attributes');
    this.#cap.textureSide = Math.min(cap.textureSide, context.getParameter(context.MAX_TEXTURE_SIZE) as number);
    if (this.#cap.textureSide < 256) fail('texture-side');
    (context.canvas as EventTarget).addEventListener('webglcontextlost', this.#lost);
  }
  #active(): void { if (this.#state === 'disposed') fail('disposed'); if (this.#state === 'lost' || this.#gl.isContextLost()) fail('context-lost'); }
  #check(): void { if (this.#gl.isContextLost()) fail('context-lost'); if (this.#gl.getError() !== this.#gl.NO_ERROR) fail('gl-error'); }
  #reserve(bytes: number): void { if (this.#gpuBytes + bytes > this.#cap.gpuBytes) fail('gpu-budget'); this.#gpuBytes += bytes; this.#peak = Math.max(this.#peak, this.#gpuBytes); }
  #program(fragmentSource: string, names: string[]): Program {
    const gl = this.#gl, shaders: WebGLShader[] = []; const handle = gl.createProgram(); if (!handle) return fail('allocation');
    try { for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragmentSource]] as const) { const s = gl.createShader(type); if (!s) fail('allocation'); shaders.push(s); gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error('gpu-voxel-shader: ' + gl.getShaderInfoLog(s)); gl.attachShader(handle, s); }
      gl.linkProgram(handle); if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) throw Error('gpu-voxel-program: ' + gl.getProgramInfoLog(handle));
      const uniforms = new Map<string, WebGLUniformLocation>(); for (const name of names) { const value = gl.getUniformLocation(handle, name); if (value === null) fail('uniform'); uniforms.set(name, value); } return { handle, uniforms };
    } catch (error) { gl.deleteProgram(handle); throw error; } finally { for (const s of shaders) gl.deleteShader(s); }
  }
  #setup(): void {
    const gl = this.#gl; this.#ray = this.#program(fragment, ['uGeometry', 'uPalette', 'uBins', 'uCandidates', 'uBoxes', 'uInverse', 'uSize', 'uTilesX']); this.#composite = this.#program(composite, ['uColor', 'uBackground']); this.#vao = gl.createVertexArray(); if (!this.#vao) fail('allocation'); this.#check();
  }
  #dimensions(texels: number): [number, number] {
    const side = this.#cap.textureSide; let width = 1, height = 1; while (width < Math.min(side, Math.max(1, texels))) width = Math.min(side, width * 2);
    while (width * height < texels) height *= 2; if (height > side) fail('texture-budget'); return [width, height];
  }
  #texture(internal: number, format: number, type: number, components: number, width: number, height: number, bytesPerComponent: number): Texture {
    const gl = this.#gl, bytes = width * height * components * bytesPerComponent; this.#reserve(bytes); const handle = gl.createTexture(); if (!handle) { this.#gpuBytes -= bytes; return fail('allocation'); }
    try { gl.bindTexture(gl.TEXTURE_2D, handle); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texStorage2D(gl.TEXTURE_2D, 1, internal, width, height); this.#check(); return { handle, width, height, bytes, internal, format, type, components };
    } catch (error) { gl.deleteTexture(handle); this.#gpuBytes -= bytes; throw error; }
  }
  #remove(texture: Texture): void { this.#gl.deleteTexture(texture.handle); this.#gpuBytes -= texture.bytes; }
  #upload(name: string, input: Uint32Array | Int32Array | Float32Array | Uint8Array, components: number, internal: number, format: number, type: number, fixedWidth?: number): number {
    const gl = this.#gl, texels = Math.ceil(input.length / components), [width, height] = fixedWidth ? [fixedWidth, Math.max(1, Math.ceil(texels / fixedWidth))] : this.#dimensions(texels);
    if (width > this.#cap.textureSide || height > this.#cap.textureSide) fail('texture-budget');
    let t = this.#textures.get(name); if (!t || t.width < width || t.height < height || t.internal !== internal) { const next = this.#texture(internal, format, type, components, width, height, input.BYTES_PER_ELEMENT); if (t) this.#remove(t); this.#textures.set(name, next); t = next; }
    const count = t.width * t.height * components, bytes = count * input.BYTES_PER_ELEMENT; if (bytes > this.#cap.stagingBytes) fail('staging-budget');
    const padded = input instanceof Float32Array ? new Float32Array(count) : input instanceof Int32Array ? new Int32Array(count) : input instanceof Uint8Array ? new Uint8Array(count) : new Uint32Array(count); padded.set(input);
    gl.bindTexture(gl.TEXTURE_2D, t.handle); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, t.width, t.height, format, type, padded); return bytes;
  }
  #allocateTargets(width: number, height: number): void {
    const gl = this.#gl; if (this.#targets?.width === width && this.#targets.height === height) return;
    const created: Texture[] = []; let framebuffer: WebGLFramebuffer | null = null;
    try { created.push(this.#texture(gl.RGBA8UI, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, 4, width, height, 1)); created.push(this.#texture(gl.RG32UI, gl.RG_INTEGER, gl.UNSIGNED_INT, 2, width, height, 4));
      framebuffer = gl.createFramebuffer(); if (!framebuffer) fail('allocation'); gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      created.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t.handle, 0)); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]); if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) fail('framebuffer'); this.#check();
      if (this.#targets) { for (const t of [this.#targets.color, this.#targets.hit]) this.#remove(t); gl.deleteFramebuffer(this.#targets.framebuffer); }
      this.#targets = { framebuffer, color: created[0]!, hit: created[1]!, width, height };
    } catch (error) { for (const t of created) this.#remove(t); if (framebuffer) gl.deleteFramebuffer(framebuffer); throw error; }
  }
  #preflight(scene: GpuVoxelScene, frame?: GpuVoxelFrame): void {
    if (scene.allocations.residentBytes > this.#cap.stagingBytes) fail('staging-budget');
    if (frame && (frame.width > this.#cap.textureSide || frame.height > this.#cap.textureSide || frame.allocations.frameBytes * 2 > this.#cap.stagingBytes)) fail('staging-budget');
  }
  load(scene: GpuVoxelScene): void {
    this.#active(); assertGpuVoxelScene(scene); this.#preflight(scene);
    const [gw, gh] = this.#dimensions(scene.allocations.voxels), required = gw * gh * 8 + 256 * Math.max(1, scene.allocations.palettes) * 4;
    if (this.#gpuBytes + required > this.#cap.gpuBytes) fail('gpu-budget');
    const copyBytes = scene.allocations.voxels * 8 + scene.allocations.palettes * 1024, oldCopy = (this.#resident?.geometry.byteLength ?? 0) + (this.#resident?.rgba.byteLength ?? 0);
    const staging = Math.max(copyBytes, oldCopy) + copyBytes + Math.max(gw * gh * 8, 256 * Math.max(1, scene.allocations.palettes) * 4);
    if (staging > this.#cap.stagingBytes) fail('staging-budget'); this.#peakStaging = Math.max(this.#peakStaging, staging);
    const resident = copyGpuVoxelSceneData(scene), prior = { textures: this.#textures, targets: this.#targets, ray: this.#ray, composite: this.#composite, vao: this.#vao, gpuBytes: this.#gpuBytes, frame: this.#frame, state: this.#state };
    this.#textures = new Map(); this.#targets = null; this.#ray = null; this.#composite = null; this.#vao = null;
    try { this.#setup(); const gl = this.#gl; this.#upload('geometry', resident.geometry, 2, gl.RG32UI, gl.RG_INTEGER, gl.UNSIGNED_INT); this.#upload('palette', resident.rgba, 4, gl.RGBA8UI, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, 256); this.#check();
      for (const t of prior.textures.values()) gl.deleteTexture(t.handle);
      if (prior.targets) { for (const t of [prior.targets.color, prior.targets.hit]) gl.deleteTexture(t.handle); gl.deleteFramebuffer(prior.targets.framebuffer); }
      if (prior.ray) gl.deleteProgram(prior.ray.handle); if (prior.composite) gl.deleteProgram(prior.composite.handle); if (prior.vao) gl.deleteVertexArray(prior.vao);
      this.#gpuBytes -= prior.gpuBytes; this.#scene = scene; this.#resident = resident; this.#frame = null; this.#state = 'ready'; this.#generation++;
    } catch (error) {
      const lost = this.#gl.isContextLost(); this.#drop(!lost);
      if (!lost) { this.#textures = prior.textures; this.#targets = prior.targets; this.#ray = prior.ray; this.#composite = prior.composite; this.#vao = prior.vao; this.#gpuBytes = prior.gpuBytes; this.#frame = prior.frame; this.#state = prior.state; }
      else { this.#state = 'lost'; this.#frame = null; }
      throw error;
    }
  }
  #stage(data: FrameData): number {
    const gl = this.#gl, boxes = data.boxes; for (let i = 0; i < boxes.length; i += 8) boxes[i + 7] = data.placements[boxes[i + 5]!]!.palette;
    const bins = new Uint32Array(Math.max(0, data.offsets.length - 1) * 2); for (let i = 0; i < data.offsets.length - 1; i++) { bins[i * 2] = data.offsets[i]!; bins[i * 2 + 1] = data.offsets[i + 1]!; }
    return this.#upload('boxes', boxes, 4, gl.RGBA32I, gl.RGBA_INTEGER, gl.INT) + this.#upload('inverse', data.inverses, 4, gl.RGBA32F, gl.RGBA, gl.FLOAT) + this.#upload('bins', bins, 2, gl.RG32UI, gl.RG_INTEGER, gl.UNSIGNED_INT) + this.#upload('candidates', data.candidates, 1, gl.R32UI, gl.RED_INTEGER, gl.UNSIGNED_INT);
  }
  draw(frame: GpuVoxelFrame, backgroundRgba: readonly number[] = [0, 0, 0, 0]) {
    this.#active(); assertGpuVoxelFrame(frame); if (this.#state !== 'ready' || !this.#scene || frame.scene !== this.#scene) fail('scene'); this.#preflight(this.#scene, frame); const bg = background(backgroundRgba);
    if (this.#gl.drawingBufferWidth !== frame.width || this.#gl.drawingBufferHeight !== frame.height) fail('drawing-buffer-size');
    const tileCount = Math.ceil(frame.width / 16) * Math.ceil(frame.height / 16), sizes = [
      ['boxes', frame.allocations.boxes * 2, 16], ['inverse', frame.allocations.instances * 3, 16], ['bins', tileCount, 8], ['candidates', frame.allocations.binEntries, 4]
    ] as const;
    let additions = this.#targets?.width === frame.width && this.#targets.height === frame.height ? 0 : frame.width * frame.height * 12, paddedPeak = 0;
    for (const [name, texels, bytes] of sizes) { const [w, h] = this.#dimensions(texels), old = this.#textures.get(name); if (!old || old.width < w || old.height < h) additions += w * h * bytes; paddedPeak = Math.max(paddedPeak, Math.max(old?.width ?? 0, w) * Math.max(old?.height ?? 0, h) * bytes); }
    if (this.#gpuBytes + additions > this.#cap.gpuBytes) fail('gpu-budget');
    const staging = this.#residentBytes() + frame.allocations.boxes * 32 + frame.allocations.instances * 48 + (tileCount + 1) * 4 + frame.allocations.binEntries * 4 + tileCount * 8 + paddedPeak;
    if (staging > this.#cap.stagingBytes) fail('staging-budget'); this.#peakStaging = Math.max(this.#peakStaging, staging);
    const gl = this.#gl; let uploadedBytes = 0; const data = frame === this.#frame ? null : copyGpuVoxelFrameData(frame);
    try {
      this.#allocateTargets(frame.width, frame.height); if (data) uploadedBytes = this.#stage(data);
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.STENCIL_TEST); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.DITHER); gl.colorMask(true, true, true, true); gl.bindVertexArray(this.#vao);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.#targets!.framebuffer); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]); gl.viewport(0, 0, frame.width, frame.height); gl.useProgram(this.#ray!.handle);
      ['Geometry', 'Palette', 'Bins', 'Candidates', 'Boxes', 'Inverse'].forEach((name, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, this.#textures.get(name.toLowerCase())!.handle); gl.uniform1i(this.#ray!.uniforms.get('u' + name)!, i); });
      gl.uniform2i(this.#ray!.uniforms.get('uSize')!, frame.width, frame.height); gl.uniform1i(this.#ray!.uniforms.get('uTilesX')!, data?.tilesX ?? Math.ceil(frame.width / 16)); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.drawBuffers([gl.BACK]); gl.viewport(0, 0, frame.width, frame.height); gl.useProgram(this.#composite!.handle); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.#targets!.color.handle); gl.uniform1i(this.#composite!.uniforms.get('uColor')!, 0); gl.uniform4uiv(this.#composite!.uniforms.get('uBackground')!, bg); gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (this.#state !== 'ready' || gl.isContextLost()) fail('context-lost'); this.#frame = frame; return Object.freeze({ frame, sequence: ++this.#sequence, submitted: true as const, drawCalls: 2, uploadedBytes });
    } catch (error) { this.#frame = null; throw error; }
  }
  #read(x: number, y: number, width: number, height: number, includeColor = true) {
    this.#active(); if (!this.#frame || !this.#targets) fail('no-frame'); const bytes = this.#residentBytes() + width * height * (includeColor ? 32 : 16); if (bytes > this.#cap.stagingBytes) fail('readback-budget'); this.#peakStaging = Math.max(this.#peakStaging, bytes);
    const gl = this.#gl, color = new Uint32Array(includeColor ? width * height * 4 : 0), hits = new Uint32Array(width * height * 4);
    try { gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.#targets.framebuffer); if (includeColor) { gl.readBuffer(gl.COLOR_ATTACHMENT0); gl.readPixels(x, y, width, height, gl.RGBA_INTEGER, gl.UNSIGNED_INT, color); } gl.readBuffer(gl.COLOR_ATTACHMENT1); gl.readPixels(x, y, width, height, gl.RGBA_INTEGER, gl.UNSIGNED_INT, hits); this.#check(); return { color, hits }; }
    finally { gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); }
  }
  /** Diagnostic only. Top-left planes, matching the frame's pixel coordinate convention. */
  readback() {
    if (!this.#frame) return fail('no-frame'); const { width, height } = this.#frame, bytes = this.#residentBytes() + width * height * 44; if (bytes > this.#cap.stagingBytes) fail('readback-budget'); this.#peakStaging = Math.max(this.#peakStaging, bytes); const raw = this.#read(0, 0, width, height), floats = new Float32Array(raw.hits.buffer), rgba = new Uint8Array(width * height * 4), owner = new Uint32Array(width * height), depth = new Float32Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const out = y * width + x, source = (height - 1 - y) * width + x; rgba.set(raw.color.subarray(source * 4, source * 4 + 4), out * 4); owner[out] = raw.hits[source * 4]!; depth[out] = owner[out] === NONE ? -Infinity : floats[source * 4 + 1]!; } return { width, height, rgba, owner, depth };
  }
  /** Displayed interaction: one GPU owner/depth pixel, pinned to the caller's submission sequence. */
  pick(x: number, y: number, expectedSequence: number): GpuVoxelHit | null {
    this.#active(); if (!this.#frame || expectedSequence !== this.#sequence || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= this.#frame.width || y >= this.#frame.height) return null;
    const raw = this.#read(Math.floor(x), this.#frame.height - 1 - Math.floor(y), 1, 1, false); return resolveGpuVoxelOwner(this.#frame, raw.hits[0]!, new Float32Array(raw.hits.buffer)[1]!);
  }
  #residentBytes(): number { return (this.#resident?.geometry.byteLength ?? 0) + (this.#resident?.rgba.byteLength ?? 0); }
  stats() { return Object.freeze({ state: this.#state, generation: this.#generation, sequence: this.#sequence, requestedGpuBytes: this.#gpuBytes, peakRequestedGpuBytes: this.#peak, peakStagingBytes: this.#peakStaging, ownedCpuBytes: this.#residentBytes() }); }
  #drop(remove: boolean): void {
    const gl = this.#gl; if (remove) { for (const texture of this.#textures.values()) gl.deleteTexture(texture.handle); if (this.#targets) { for (const t of [this.#targets.color, this.#targets.hit]) gl.deleteTexture(t.handle); gl.deleteFramebuffer(this.#targets.framebuffer); } if (this.#ray) gl.deleteProgram(this.#ray.handle); if (this.#composite) gl.deleteProgram(this.#composite.handle); if (this.#vao) gl.deleteVertexArray(this.#vao); }
    this.#textures.clear(); this.#targets = null; this.#ray = null; this.#composite = null; this.#vao = null; this.#gpuBytes = 0;
  }
  restore(): void {
    if (this.#state !== 'lost' || this.#gl.isContextLost() || !this.#scene) fail('restore');
    this.#state = 'empty';
    try { this.load(this.#scene); } catch (error) { this.#state = 'lost'; throw error; }
  }
  dispose(): void { if (this.#state === 'disposed') return; (this.#gl.canvas as EventTarget).removeEventListener('webglcontextlost', this.#lost); this.#drop(!this.#gl.isContextLost()); this.#state = 'disposed'; this.#scene = null; this.#resident = null; this.#frame = null; }
}
