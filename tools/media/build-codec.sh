#!/bin/bash
# SPDX-License-Identifier: MIT
set -euo pipefail
# Inputs must be private, pristine extractions of the pinned release and SDK.
repo=$(cd "$(dirname "$0")/../.." && pwd)
ffsrc=$(cd "${1:?FFmpeg source directory}" && pwd)
sdk=$(cd "${2:?emsdk directory}" && pwd)
out=${3:?Private output directory}
[[ $(basename "$ffsrc") == ffmpeg-9.0.1 && "$sdk" == "$(dirname "$ffsrc")/emsdk" ]]
[[ $(cat "$ffsrc/RELEASE") == 9.0.1 ]]
[[ $(git -C "$sdk" rev-parse HEAD) == 5eb0bde7585670252e8ba05e9d361627bffd08b5 ]]
python3 "$repo/tools/media/source-bundle.py" "$(dirname "$ffsrc")" --verify-only
source "$sdk/emsdk_env.sh" >/dev/null
[[ $(emcc --version | head -n 1) == *6.0.9* ]]
mkdir -p "$out"
out=$(cd "$out" && pwd)
mkdir -p "$out/ffbuild"
cd "$out/ffbuild"
emconfigure "$ffsrc/configure" --target-os=none --arch=wasm32 --enable-cross-compile \
 --cc=emcc --cxx=em++ --ar=emar --ranlib=emranlib --nm=emnm \
 --disable-everything --disable-autodetect --disable-programs --disable-doc \
 --disable-iconv --disable-network --disable-pthreads --disable-w32threads --disable-os2threads \
 --disable-x86asm --disable-inline-asm --disable-runtime-cpudetect --disable-debug \
 --disable-avdevice --disable-avfilter --disable-avformat --enable-avformat \
 --disable-swscale --enable-swscale --disable-swresample --enable-swresample \
 --enable-demuxer=bink --enable-decoder=bink,binkaudio_rdft,binkaudio_dct \
 --extra-cflags='-O3' > "$out/configure.txt"
emmake make -j4 > "$out/compile.txt" 2>&1
emcc -O3 "$repo/packages/media/native/decoder.c" -I. -I"$ffsrc" \
 libavformat/libavformat.a libavcodec/libavcodec.a libswscale/libswscale.a libswresample/libswresample.a libavutil/libavutil.a \
 -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createBinkDecoder -sENVIRONMENT=worker,node \
 -sFILESYSTEM=0 -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=33554432 -sMAXIMUM_MEMORY=134217728 \
 -sABORTING_MALLOC=0 -sSTACK_SIZE=1048576 -sEXPORTED_RUNTIME_METHODS=HEAPU8 \
 -sINCOMING_MODULE_JS_API=wasmBinary,print,printErr -Wl,-Map="$out/link.map" \
 -o "$out/decoder.js"
cp "$ffsrc/COPYING.LGPLv2.1" "$out/FFMPEG-LICENSE.txt"
cat "$sdk/upstream/emscripten/LICENSE" "$sdk/upstream/emscripten/system/lib/libc/musl/COPYRIGHT" "$sdk/upstream/emscripten/system/lib/compiler-rt/LICENSE.TXT" "$sdk/upstream/emscripten/system/lib/llvm-libc/LICENSE.TXT" > "$out/RUNTIME-NOTICES.txt"
cp config.h config_components.h config.mak "$out/" 2>/dev/null || cp ffbuild/config.mak "$out/"
