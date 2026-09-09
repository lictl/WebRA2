/** Diagnostic range reader; independent of production VFS contracts. */
export const MAX_RANGE_BYTES = 256 * 1024;

export function validateRange(size, offset, length, limit = MAX_RANGE_BYTES) {
  if (![size, offset, length, limit].every(Number.isSafeInteger) ||
      size < 0 || offset < 0 || length < 0 || limit < 1 ||
      length > limit || offset > size || length > size - offset) {
    throw new RangeError('Range outside source bounds or diagnostic buffer limit');
  }
}

export function makeRangeReader(source, limit = MAX_RANGE_BYTES) {
  validateRange(source.size, 0, 0, limit);
  let active = false;
  return async function readRange(offset, length, signal) {
    validateRange(source.size, offset, length, limit);
    signal?.throwIfAborted();
    if (active) throw new Error('Only one range may be buffered at a time');
    active = true;
    try {
      const data = await source.slice(offset, offset + length).arrayBuffer();
      signal?.throwIfAborted();
      if (data.byteLength !== length) throw new Error('Short range read');
      return data;
    } finally {
      active = false;
    }
  };
}
