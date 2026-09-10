# Native Scenario random primitive provenance

The implementation in [native-random.ts](src/native-random.ts) is a TypeScript
adaptation of Electronic Arts' Random2/Random3 algorithms and the first four values
of each Random3 mix table. Copyright 2025 Electronic Arts Inc.; modifications
copyright 2026 WebRA2 contributors. SPDX: **GPL-3.0-or-later**. The complete license
is [GPL-3.0-or-later](../../LICENSES/GPL-3.0-or-later.txt). Distributions containing
this implementation must preserve the license/copyright notices and provide the
applicable corresponding source. This is not an MIT-only component.

Primary source: `electronicarts/CnC_Renegade`, exact commit
`3e00c3a1b97381bb28be89a35b856375e0629a08`:

- [Code/wwlib/random.cpp](https://github.com/electronicarts/CnC_Renegade/blob/3e00c3a1b97381bb28be89a35b856375e0629a08/Code/wwlib/random.cpp):
  Random2 initialization/word generation, Random3 seed expansion and mix constants.
- [Code/wwlib/random.h](https://github.com/electronicarts/CnC_Renegade/blob/3e00c3a1b97381bb28be89a35b856375e0629a08/Code/wwlib/random.h):
  range helper and state dimensions.
- [Source license](https://github.com/electronicarts/CnC_Renegade/blob/3e00c3a1b97381bb28be89a35b856375e0629a08/LICENSE.md).

The source-file headers explicitly permit GPL version 3 or later. Raw downloaded
file SHA-256 values: random.cpp
`7cf29e72a3861c30c8f78be07172580d3ffa8bf031d642f4cf2bd439240f5998`,
random.h `41b60643f16bc07672af64b0750dbc44cd8d26c2929c70f11046056c1dfd28ae`.
The public module uses licensed primary-source constants, not bytes copied from
the retail image. Each native 80-byte table agrees with all 20 source values;
only its first four entries participate in the observed four rounds. No new
runtime dependency is introduced.

Changes from the C++ implementation: explicit `Math.imul`, signed shifts, wrapped
32-bit arithmetic and unsigned output words; owned immutable state; descriptor
validation of restores; preserved native disabled guard; specialized bounded 0..2
sampling; and explicit errors. The legacy arbitrary signed-range API is not exposed.
Original synthetic tests are MIT and contain generated arithmetic digests and
invented states, not game saves or retail RNG state.

## Native observations

Pinned Steam Traditional Chinese installation, historical build labels unverified:
`game.exe`, 5,077,312 bytes, SHA-256
`73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`;
`gamemd.exe`, 5,286,208 bytes, SHA-256
`3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.
Static PE mapping and Capstone 5.0.6 verify these 10 spans / 1,168 bytes.
Code rows have complete instruction boundaries; data rows are table bytes.
No native executable was run. The disabled byte is separate from the indices at
+4/+8 and the 250 words at +12. Three padding bytes are not logical state.

| Profile | Inspected purpose | VA start–end (exclusive) | File offset | Bytes | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| ra2 | seed expansion | 0x638790–0x63883a | 2328464 | 170 | `9691f50e548b63b02bff3812dde10572915c8fa89c1e00819443f052de9587d7` |
| ra2 | word and disabled guard | 0x638840–0x638891 | 2328640 | 81 | `cf081827914bebb075b66d2c900d946c68af2028ffc8d9a5c3f86b55e18eec6d` |
| ra2 | inclusive ranged rejection | 0x6388a0–0x63894d | 2328736 | 173 | `491f7e640b1a946d48267acb7f314472d13bfdad51b53e850e3c99ceb2b76829` |
| ra2 | primary-source Mix1 | 0x7ee4ac–0x7ee4fc | 4121772 | 80 | `7b6d0392c70bf35d486564d8869d129c2781ab053a043331474e2624f09edd9d` |
| ra2 | primary-source Mix2 | 0x7ee4fc–0x7ee54c | 4121852 | 80 | `24b639ffbe594662587abef93f828b784b1b9097627a9ad9be6a6fb88b100434` |
| yr | seed expansion | 0x65c6d0–0x65c77a | 2475728 | 170 | `60889d008c03c4b02b53ccaa67109bd2997602bdfcaba8e31003ad168bd0df1b` |
| yr | word and disabled guard | 0x65c780–0x65c7d1 | 2475904 | 81 | `cf081827914bebb075b66d2c900d946c68af2028ffc8d9a5c3f86b55e18eec6d` |
| yr | inclusive ranged rejection | 0x65c7e0–0x65c88d | 2476000 | 173 | `491f7e640b1a946d48267acb7f314472d13bfdad51b53e850e3c99ceb2b76829` |
| yr | primary-source Mix1 | 0x839644–0x839694 | 4429380 | 80 | `7b6d0392c70bf35d486564d8869d129c2781ab053a043331474e2624f09edd9d` |
| yr | primary-source Mix2 | 0x839694–0x8396e4 | 4429460 | 80 | `24b639ffbe594662587abef93f828b784b1b9097627a9ad9be6a6fb88b100434` |

Both profiles agree on the primitive, including the signed high-word seed math,
initial index separation 103, zero-without-advance disabled guard and rejection
sampling. The implementation returns the full word as a uint32 bit pattern; the
native C++ API returns an int with the same 32 bits. Fresh seed construction sets
the guard false. Restored valid guarded states retain true and consume zero words.

The broader [reload research](https://github.com/lictl/WebRA2/issues/147#issuecomment-5612484737)
records 23 ranges / 3,222 bytes: native ROF arithmetic, burst/timer call context,
Scenario+0x218 state storage, fresh zero initialization and later session reseeding.
That evidence does not prove complete campaign random-call order. Initial attack
delay, all constructor/animation/audio calls and native save import remain outside
this primitive. There is no claim that a retail campaign starts with seed zero.

## Verification and interpretation

Independent private Python signed32 and separately compiled licensed C++ method
comparisons cover eight explicit boundary seeds, 160,000 word/jitter samples and
all 250 worst-case ring rotations (63,500 returned scalar/state values). The
TypeScript module matches all 223,500 scalar values byte-for-byte. The combined
little-endian uint32 vector SHA-256 is
`7c6ec650e9134f222450845e12156169466e958df1dd2ac9c994c93c99d1eefd`.
The C++ harness is synthetic licensed-source execution, not execution of the retail
binaries. Public tests independently retain the seed/continuation/state digests;
private native mapping/table comparisons remain a separate evidence check.

The 251-draw bound is an inference proved from the verified recurrence. Given
indices separated by 103 modulo 250, output words obey
`x[n] = x[n-250] XOR x[n-147]` for n ≥ 250. If all first 250 low-two-bit values
are the rejected value 3, the next is `3 XOR 3 = 0` and is accepted. This holds
for any valid restored word array, including zeros. Tests construct the extremal
state at every index rotation and verify exact returned state against the separate
source oracle. This is stronger than imposing an arbitrary short retry cap.

The public [component report](../../docs/native-random.md) defines the API, fixed
bounds and integration limits. Scheduling and native global sequencing remain
[#132](https://github.com/lictl/WebRA2/issues/132) and
[#147](https://github.com/lictl/WebRA2/issues/147).
