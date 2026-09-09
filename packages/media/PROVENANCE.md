# Persistent media component provenance

Original WebRA2 TypeScript, harness and test code is MIT. The original C wrapper
in `native/decoder.c` is LGPL-2.1-or-later, matching its FFmpeg linkage. No retail
movie, codec binary or downloaded source tree is tracked.

The privately built codec uses **FFmpeg 9.0.1**, upstream commit
`bf1b838f2ab88b4f8fd83443325c782ea0e0f7fa`, from the
[official release archive](https://ffmpeg.org/releases/ffmpeg-9.0.1.tar.xz), SHA-256
`cf38e0e28c7e5605942c4a77755349b0145804a397af37eb1fb4c77cb237f635`.
It enables only the Bink demuxer and Bink video/RDFT/DCT audio decoders, avformat,
avcodec, avutil, swscale and swresample. Network, protocols, programs, encoders,
external libraries, GPL and nonfree components are disabled. The generated
configuration reports **LGPL version 2.1 or later**. This is independently built
from current sources; it does not relabel or redistribute the earlier broad
GPL `@ffmpeg/core@0.12.10` reference binary.

Toolchain: [emsdk commit 5eb0bde](https://github.com/emscripten-core/emsdk/tree/5eb0bde7585670252e8ba05e9d361627bffd08b5),
Emscripten **6.0.9**, release build
`f04ea239d533260dd1db760dd2d668d5f9a88d6b`, source commit
[`4e4223852a0835923411059a3929907d7df1232e`](https://github.com/emscripten-core/emscripten/tree/4e4223852a0835923411059a3929907d7df1232e).
Its source tar SHA-256 is
`426911732c683c5940e3e089782d90d272ec2738c933e53593f9e9a65ff6aa96`.
Emsdk selects Node 24.19.0 and Python 3.13.3 for this compiler; the repository uses
its separate Node 24.20.0. Emscripten's MIT/UIUC license, musl MIT notice and linked
compiler runtime notices must accompany the binary; the full pinned Emscripten
source archive contains these notices and runtime source. Browser harness bundles
also use the already approved MIT `@noble/hashes@2.4.0` from the root lockfile.

[Build/source tooling](../../tools/media/build-codec.sh) and the
[source-bundle builder](../../tools/media/source-bundle.py) retain actual generated
configuration, linker map, compiler version, binary hashes and full corresponding
FFmpeg/Emscripten sources plus original wrapper/build source. They verify the
release tar hashes and relevant extracted source bytes before compiling. Installed
SDK packaging omits dotfiles and upstream maintenance/install scripts; those are
excluded from installed-file comparison, while the complete original source tar
is retained. Generated codec/source artifacts stay in ignored `local/`.

LGPL static linkage in WASM requires preserving notices and providing corresponding
library source and relinkable application material (or sufficient application
source/build instructions). The bundle includes the original wrapper and scripts
for rebuilding the complete module against modified FFmpeg sources; distributors
must actually deliver those materials and allow permitted debugging/modification.
The verification gate is for the reference build, not a prohibition on recipient
modification. Consult [FFmpeg's license guidance](https://ffmpeg.org/legal.html).
Root/coordinator owns eventual production distribution/security updates; this
slice ships a local diagnostic and reusable source component, not a campaign claim.

## Actual linked inventory and reconstruction limit

The measured link map contains the five enabled FFmpeg static libraries plus
Emscripten `libc.a`, `libclang_rt.builtins.a` and `libdlmalloc.a`. The source bundle
retains their actual configuration/link map and runtime sources/notices: musl and
its per-file permissive notices, compiler-rt's LLVM exception, and the dlmalloc
public-domain notice. The runtime notice file also includes an LLVM libc notice;
that inclusion does not claim LLVM libc was linked.

An independent clean rebuild of the pinned source/recipe succeeds and matches
all decoded RGBA bytes, sample counts and numeric PCM errors for both reviewed
RA2 and YR samples. The generated JavaScript is byte-identical, but exact WASM
binary reproducibility is **not established**. The measured artifact is 1,158,821
bytes, SHA-256 `478039151c027121f8caa09274f4ed29d6254a23bf5ca0e0af68cad32553492e`;
the clean rebuild is 1,158,751 bytes,
`b9986d357c9355ff02279055c969e83272b87909a0180b67dd959fd470ccc8f3`.
The recorded configuration's `SRC_PATH`/`SRC_LINK` spelling uses `./src`, whereas
the fresh configure uses an absolute source path / `src`. Thirty-five printable
assertion paths differ by the `./` prefix. Both configuration headers match;
normalized binary equivalence has not been proved. The archive includes the
actual measured configuration as well as the rebuild recipe. Source-bundle
assembly is deterministic for the same recorded inputs; that separate property
does not imply bit-reproducible compiler output.
