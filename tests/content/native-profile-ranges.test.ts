// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original synthetic bytes only.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { verifyNativeRanges, type NativeRange } from '../../tools/analysis/native-profile-census.ts';
const bytes = new Uint8Array([7, 9, 3, 5]);
const range: NativeRange = { id: 'synthetic', virtualAddress: 0x401001, absoluteOffset: 1, size: 2, sha256: createHash('sha256').update(bytes.subarray(1, 3)).digest('hex') };
test('span identity covers exact bytes and rejects changed spans', () => {
  verifyNativeRanges(bytes, [range]);
  assert.throws(() => verifyNativeRanges(new Uint8Array([7, 8, 3, 5]), [range]), /range-hash/);
});
test('span bounds reject overflow, negative, fractional and excessive locators', () => {
  for (const patch of [{ absoluteOffset: -1 }, { absoluteOffset: 4 }, { size: 0 }, { size: 4 }, { size: 1.1 }, { absoluteOffset: Number.MAX_SAFE_INTEGER }]) assert.throws(() => verifyNativeRanges(bytes, [{ ...range, ...patch }]), /range-bounds/);
  assert.throws(() => verifyNativeRanges(bytes, Array.from({ length: 65 }, () => range)), /range-count-limit/);
});
