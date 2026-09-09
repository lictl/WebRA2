// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Composes the attributed SHP subset decoder.
import { decodeShpFrame, decodeShpPalette, shpRgba, SHP_LIMITS } from '/shp-ts.mjs';
const sprite = document.querySelector('#sprite'), palette = document.querySelector('#palette');
const decode = document.querySelector('#decode'), canvas = document.querySelector('#canvas'), result = document.querySelector('#results');
const context = canvas.getContext('2d', { alpha: false });
let generation = 0;
function ready() { decode.disabled = !sprite.files?.[0] || !palette.files?.[0]; }
sprite.addEventListener('change', ready); palette.addEventListener('change', ready);
const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
function release() { generation++; sprite.value = ''; palette.value = ''; sprite.disabled = palette.disabled = false; decode.disabled = true; canvas.width = canvas.height = 1; result.textContent = 'Released local files and pixels.'; }
document.querySelector('#release').addEventListener('click', release);
decode.addEventListener('click', async () => {
  const sf = sprite.files?.[0], pf = palette.files?.[0]; if (!sf || !pf) return;
  const current = ++generation, started = performance.now(); decode.disabled = sprite.disabled = palette.disabled = true;
  try {
    if (sf.size > SHP_LIMITS.fileBytes || pf.size !== 768) throw new Error('File exceeds diagnostic bounds');
    const sb = new Uint8Array(await sf.arrayBuffer()), pb = new Uint8Array(await pf.arrayBuffer());
    if (generation !== current) return;
    const readMs = performance.now() - started, decoding = performance.now();
    const frame = decodeShpFrame(sb, 0), colors = decodeShpPalette(pb), rgba = shpRgba(frame.pixels, colors);
    const decodeMs = performance.now() - decoding;
    const pixelHash = await hash(frame.pixels), rgbaHash = await hash(rgba), spriteHash = await hash(sb), paletteHash = await hash(pb);
    if (generation !== current) return;
    canvas.width = frame.index.width; canvas.height = frame.index.height;
    context.putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer), frame.frame.width, frame.frame.height), frame.frame.x, frame.frame.y);
    const report = { status: 'displayed', date: new Date().toISOString(), userAgent: navigator.userAgent,
      spriteBytes: sb.length, paletteBytes: pb.length, spriteSha256: spriteHash, paletteSha256: paletteHash,
      geometry: frame.frame, canvas: [canvas.width, canvas.height], indexedPixelSha256: pixelHash, rgbaSha256: rgbaHash,
      readMs, decodeAndRgbaMs: decodeMs, throughDrawAndHashMs: performance.now() - started,
      ownedInputAndOutputBytes: sb.length + pb.length + frame.pixels.length + colors.length + rgba.length,
      canvasPixelBytes: canvas.width * canvas.height * 4, jsHeapPointBytes: performance.memory?.usedJSHeapSize ?? null,
      limitation: 'Owned byte counts exclude digest/canvas copies, browser allocations and GC. Draw completion is not physical-display latency or native color comparison.' };
    result.replaceChildren(...JSON.stringify(report, null, 2).split('\n').map(line => { const span = document.createElement('span'); span.textContent = line + '\n'; return span; }));
  } catch (error) { if (generation === current) result.textContent = `Failed: ${error.message}`; }
  finally { if (generation === current) { sprite.disabled = palette.disabled = false; ready(); } }
});
