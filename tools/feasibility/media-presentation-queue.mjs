// SPDX-License-Identifier: MIT
export const LIMITS = Object.freeze({ inputBytes: 128 * 1024 * 1024, chunkBytes: 32 * 1024 * 1024, queuedChunks: 2, seconds: 180 });

export function presentationHeader(prefix, fileSize) {
  if (!(prefix instanceof Uint8Array) || prefix.length < 44 || !Number.isSafeInteger(fileSize) || fileSize < 44 || fileSize > LIMITS.inputBytes) {
    throw new RangeError('Invalid bounded Bink input');
  }
  const d = new DataView(prefix.buffer, prefix.byteOffset, prefix.byteLength);
  const signature = String.fromCharCode(...prefix.subarray(0, 4));
  const [declared, frames, width, height, numerator, denominator, tracks] = [4, 8, 20, 24, 28, 32, 40].map(offset => d.getUint32(offset, true));
  if (!/^BIK[bfghik]$/.test(signature) || declared + 8 !== fileSize ||
      !frames || frames > 100000 || !width || !height || width > 1024 || height > 768 ||
      !numerator || !denominator || numerator / denominator > 60 || numerator / denominator < 1 || tracks !== 1) {
    throw new RangeError('Outside presentation diagnostic limits (Bink 1, one audio track, at most 1024×768/60fps)');
  }
  return Object.freeze({ fileSize, signature, frames, width, height, fps: numerator / denominator, duration: frames * denominator / numerator, tracks });
}

export function presentationPlan(header, seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > LIMITS.seconds) throw new RangeError('Invalid presentation duration');
  const frameBytes = header.width * header.height * 4;
  const chunkFrames = Math.max(1, Math.min(Math.round(header.fps), Math.floor((LIMITS.chunkBytes - 1024 * 1024) / frameBytes)));
  const frames = Math.min(header.frames, Math.floor(seconds * header.fps));
  if (!frames) throw new RangeError('At least one frame required');
  return Object.freeze({ frames, frameBytes, chunkFrames, chunks: Math.ceil(frames / chunkFrames), fps: header.fps, duration: frames / header.fps });
}

export function chunkPlan(plan, index) {
  if (!Number.isSafeInteger(index) || index < 0 || index >= plan.chunks) throw new RangeError('Invalid chunk index');
  const startFrame = index * plan.chunkFrames;
  const frames = Math.min(plan.chunkFrames, plan.frames - startFrame);
  return Object.freeze({ index, startFrame, frames, start: startFrame / plan.fps, duration: frames / plan.fps,
    videoBytes: frames * plan.frameBytes });
}

/** Main-thread ownership bound; pending worker requests count toward the same cap. */
export class PresentationQueue {
  items = [];
  pending = false;
  next = 0;
  maxBytes = 0;
  constructor(plan) { this.plan = plan; }
  request() {
    if (this.pending || this.items.length >= LIMITS.queuedChunks || this.next >= this.plan.chunks) return null;
    this.pending = true;
    return this.next++;
  }
  receive(chunk) {
    if (!this.pending || chunk.index !== this.next - 1 || this.items.length >= LIMITS.queuedChunks) throw new Error('Unexpected chunk');
    const expected = chunkPlan(this.plan, chunk.index);
    if (!(chunk.video instanceof ArrayBuffer) || !(chunk.pcm instanceof ArrayBuffer) || chunk.video.byteLength !== expected.videoBytes ||
        chunk.pcm.byteLength === 0 || chunk.pcm.byteLength % 8 !== 0 || chunk.pcm.byteLength > 1024 * 1024) throw new RangeError('Malformed decoded output');
    this.pending = false;
    this.items.push({ ...chunk, ...expected });
    this.maxBytes = Math.max(this.maxBytes, this.items.reduce((sum, item) => sum + item.video.byteLength + item.pcm.byteLength, 0));
  }
  expire(time) {
    while (this.items[0] && time >= this.items[0].start + this.items[0].duration) this.items.shift();
  }
  frame(time) {
    const item = this.items.find(item => time >= item.start && time < item.start + item.duration);
    if (!item) return null;
    const offset = Math.min(item.frames - 1, Math.floor((time - item.start) * this.plan.fps + 1e-7));
    return { item, offset, absoluteFrame: item.startFrame + offset, timestamp: (item.startFrame + offset) / this.plan.fps };
  }
  clear() { this.items.length = 0; this.pending = false; }
}
