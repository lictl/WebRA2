/** Diagnostic limits only; this does not replace a complete Bink parser. */
export function inspectBinkHeader(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 44 || bytes.byteLength > 64 * 1024 * 1024) {
    throw new RangeError('Bink sample must be 44 bytes to 64 MiB');
  }
  if (bytes[0] !== 66 || bytes[1] !== 73 || bytes[2] !== 75 || ![98, 102, 103, 104, 105, 107].includes(bytes[3])) {
    throw new Error('Expected supported Bink 1 header');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const declaredBytes = view.getUint32(4, true) + 8;
  const frames = view.getUint32(8, true);
  const maximumFrameBytes = view.getUint32(12, true);
  const width = view.getUint32(20, true);
  const height = view.getUint32(24, true);
  const fpsNumerator = view.getUint32(28, true);
  const fpsDenominator = view.getUint32(32, true);
  const audioTracks = view.getUint32(40, true);
  if (declaredBytes !== bytes.length || frames < 1 || frames > 100000 || maximumFrameBytes > bytes.length ||
      width < 1 || height < 1 || width > 2048 || height > 2048 || width * height > 2097152 ||
      fpsNumerator < 1 || fpsDenominator < 1 || fpsNumerator / fpsDenominator > 120 || audioTracks > 8) {
    throw new RangeError('Bink header exceeds diagnostic dimensions, frame count, rate, tracks or length limits');
  }
  return { declaredBytes, frames, width, height, fpsNumerator, fpsDenominator, audioTracks };
}
