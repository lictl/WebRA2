# Incremental source hashing provenance

`src/hash-source.ts` and its original tests use GPL-3.0-or-later consistently with
the MIX ByteSource/range primitives they compose. They call the unmodified
**@noble/hashes 2.4.0** npm package, licensed MIT, for incremental SHA-256 and SHA-1.
No algorithm implementation is copied or translated into WebRA2.

- Upstream: [noble-hashes](https://github.com/paulmillr/noble-hashes).
- Registry-reported source revision: `663c2aeeffc308ac0cded59bd32f7c212adacfc2`.
- Exact tarball/integrity are in `package-lock.json`; registry integrity checked
  2026-09-10: `sha512-X5XaVWZIBCT7HHZGm5I7ZQXDwLG+bGXuSrMQAW+7Zvl87h1kmc1ZB1VSRJcpUfoUrGQp4Fkoxm5kZ+Ms+aW+eA==`.
- Imports: `sha2.js` SHA-256 and `legacy.js` SHA-1, with their package helpers.
- Installed package: no runtime dependencies or lifecycle install scripts. Only
  hash functions are used; no randomness, credentials or network calls are needed.
- Upstream documents partial `create/update/digest` processing. WebRA2 tests compare
  varied message/chunk boundaries against independent Node crypto digests. This is
  integration validation, not a claim that this particular release has been audited.

`hashByteSource` performs sequential reads, normally 64 KiB (hard cap 1 MiB), yields
cooperatively and reports immutable progress. Ordinary inputs default to 16 MiB;
whole archive hashing requires an explicit larger `byteLimit`, bounded by the MIX
size cap. Cancellation, short reads, changed source length or failed callbacks reject
without returning a partial digest. Hash state is destroyed on every exit. ByteSource
must provide immutable bytes; a computed digest is not by itself a match against
an expected installation identity. SHA-1 is only for legacy MIX checksum comparison.

The first browser inspector remains index-only. UI/profile verification and measured
large-file browser behavior follow separately. Its 64 MiB index-read budget is not
silently raised by this separately requested full-range operation. No retail data,
new WASM binary or decoded content is included. Future browser bundles using this
module must allow the exact package's code inputs and include its MIT notice below,
along with WebRA2's applicable combined GPL source/notice obligations.

## Upstream MIT notice

The MIT License (MIT)

Copyright (c) 2022 Paul Miller (https://paulmillr.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
