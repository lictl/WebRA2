#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Verify source inputs and assemble private corresponding source/relink material."""
import argparse, gzip, hashlib, io, json, subprocess, tarfile
from pathlib import Path
PINS = {
 'ffmpeg': ('ffmpeg-9.0.1.tar.xz', 'cf38e0e28c7e5605942c4a77755349b0145804a397af37eb1fb4c77cb237f635'),
 'emscripten': ('emscripten-6.0.9.tar.gz', '426911732c683c5940e3e089782d90d272ec2738c933e53593f9e9a65ff6aa96'),
}
def digest(p):
 with p.open('rb') as f: return hashlib.file_digest(f, 'sha256').hexdigest()
def verify(archive, directory, prefix_filter=None):
 count=0
 with tarfile.open(archive) as tar:
  for member in tar:
   if not member.isfile() or any(part.startswith('.') for part in Path(member.name).parts[1:]): continue
   relative=Path(*Path(member.name).parts[1:])
   if prefix_filter and (str(relative) == 'tools/install.py' or str(relative).startswith('tools/maint/')): continue
   if prefix_filter and not any(str(relative).startswith(p) for p in prefix_filter): continue
   target=directory/relative
   if not target.is_file(): raise ValueError(f'missing source {relative}')
   if hashlib.sha256(tar.extractfile(member).read()).hexdigest()!=digest(target): raise ValueError(f'modified source {relative}')
   count+=1
 return count
parser=argparse.ArgumentParser();parser.add_argument('private');parser.add_argument('--verify-only',action='store_true');args=parser.parse_args()
private=Path(args.private).resolve();repo=Path(__file__).resolve().parents[2]
for name,(filename,sha) in PINS.items():
 if digest(private/filename)!=sha: raise ValueError(f'{name} archive mismatch')
counts={'ffmpeg':verify(private/PINS['ffmpeg'][0],private/'ffmpeg-9.0.1'),
 'emscripten_runtime':verify(private/PINS['emscripten'][0],private/'emsdk/upstream/emscripten',('system/lib/','src/','emcc.py','tools/'))}
if args.verify_only: print(json.dumps(counts));raise SystemExit()
artifacts=['decoder.js','decoder.wasm','config.h','config_components.h','config.mak','configure.txt','compile.txt','link.map','FFMPEG-LICENSE.txt','RUNTIME-NOTICES.txt']
manifest={'schemaVersion':1,'sourceVerification':counts,'sources':PINS,'buildArtifacts':{},'toolchainBinaries':{}}
for name in artifacts:
 p=private/'build'/name
 if p.is_file(): manifest['buildArtifacts'][name]={'size':p.stat().st_size,'sha256':digest(p)}
for name in ['clang','wasm-ld','wasm-opt','llvm-ar']:
 p=private/'emsdk/upstream/bin'/name
 manifest['toolchainBinaries'][name]={'sha256':digest(p),'size':p.stat().st_size}
manifest['versions']=subprocess.check_output([str(private/'emsdk/upstream/emscripten/emcc'),'--version'],text=True)
(private/'build-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
# Stable tar ordering/ownership/timestamps and gzip header; no wall-clock values enter the archive.
with (private/'corresponding-source.tar.gz').open('wb') as raw, gzip.GzipFile(filename='',mode='wb',fileobj=raw,mtime=0) as compressed, tarfile.open(fileobj=compressed,mode='w') as tar:
 def add(path,name):
  if path.is_dir():
   for child in sorted(path.iterdir()): add(child,name+'/'+child.name)
  elif path.is_file() and not path.is_symlink():
   data=path.read_bytes();info=tarfile.TarInfo(name);info.size=len(data);info.mode=0o644;info.mtime=0;tar.addfile(info,io.BytesIO(data))
  else: raise ValueError('non-regular source input')
 for filename,_ in PINS.values():add(private/filename,'sources/'+filename)
 for path in ['packages/media','tools/media','tests/media','node_modules/@noble/hashes']:
  add(repo/path,'webra2/'+path)
 for path in ['package.json','package-lock.json','tsconfig.json','LICENSE']:
  add(repo/path,'webra2/'+path)
 for name in artifacts:
  if (private/'build'/name).is_file() and not name.endswith(('.wasm','.js')):add(private/'build'/name,'configuration/'+name)
 add(private/'build-manifest.json','build-manifest.json')
print(json.dumps({'manifest':str(private/'build-manifest.json'),'sourceBundleSha256':digest(private/'corresponding-source.tar.gz'),'verification':counts},indent=2))

distribution={}
for filename in ['decoder.js','decoder.wasm','FFMPEG-LICENSE.txt','RUNTIME-NOTICES.txt']:
 p=private/'build'/filename;distribution[filename]={'size':p.stat().st_size,'sha256':digest(p)}
p=private/'corresponding-source.tar.gz';distribution[p.name]={'size':p.stat().st_size,'sha256':digest(p)}
(private/'distribution-manifest.json').write_text(json.dumps(distribution,indent=2)+'\n')
