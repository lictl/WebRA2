# MIX implementation provenance

The MIX parser, filename hashing, local database parser, census and their tests in
this slice are **GPL-3.0-or-later**. Copyright 2026 WebRA2 contributors. The format
and key-transform implementation adapts the OpenRA sources below; preserve the
OpenRA Developers and Contributors attribution. This is a deliberate narrow reuse
choice, authorized by decision D07. It is not MIT merely because the initial
repository carried an MIT license. See the repository distribution license mapping.

## Pinned source and dependency

- OpenRA revision `f3ec7f8e1593b482f85fd101652deb740c33dee6`, GPL-3.0-or-later:
  [MixFile.cs](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Cnc/FileSystem/MixFile.cs),
  [PackageEntry.cs](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Cnc/FileSystem/PackageEntry.cs),
  [BlowfishKeyProvider.cs](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Cnc/FileFormats/BlowfishKeyProvider.cs),
  [Blowfish.cs](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Cnc/FileFormats/Blowfish.cs),
  [XccLocalDatabase.cs](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/OpenRA.Mods.Cnc/FileFormats/XccLocalDatabase.cs),
  [license](https://github.com/OpenRA/OpenRA/blob/f3ec7f8e1593b482f85fd101652deb740c33dee6/COPYING).
  The TypeScript reader replaces C# streams with bounded asynchronous byte ranges,
  the large integer implementation with JavaScript BigInt, and the primitive with
  the MIT dependency below. No OpenRA game, renderer or simulation is imported.
- `egoroof-blowfish` **4.0.3**, MIT, npm `gitHead`
  `6d8c0d1c1d866d5015b7468e4c8725c1977d65ce`:
  [source](https://github.com/egoroof/blowfish/tree/6d8c0d1c1d866d5015b7468e4c8725c1977d65ce),
  [license](https://github.com/egoroof/blowfish/blob/6d8c0d1c1d866d5015b7468e4c8725c1977d65ce/LICENSE.md).
  npm integrity:
  `sha512-aoiyyD89KSkS/WnIKp83AtYyKWWa6yF13nbTLCTZdL/DZiP2QF70pBNJxynobzh3JnYhTIAAiMgfDW+4XM4JGw==`.
  Browser ES module; no dependencies. Used only for ECB Blowfish. Its NULL padding
  API strips trailing zero bytes; the wrapper restores the specified block length
  before interpreting binary fields. The public RSA modulus is a format constant,
  not a key extracted from this installation or a credential.
- EA FinalAlert2 editor revision `6abf0f557469baea73079c6bf6550709e2e3584e`,
  [mix_file.cpp](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/3rdParty/xcc/misc/mix_file.cpp):
  corroborating archive length and flag interpretation, no code copied from this
  source. Static editor format support is not original gameplay evidence.

## Distribution obligations and boundaries

Retain copyright notices, this provenance and GPL license text. Distributing this
implementation in a combined browser engine requires GPL-compatible distribution
and corresponding source, including build/install scripts and modifications, under
GPL-3.0-or-later. Preserve the Blowfish MIT copyright/permission notice in bundled
distributions. Do not claim that server-only assets or a separate import UI remove
source-license obligations. This decision grants no rights to retail game assets.

Tests use original synthetic headers, local database names and payloads. The RSA
known answer uses `bytes(range(80))` and Python integer `pow`; no encrypted header,
key block or payload was copied from the game. The Blowfish zero-key known answer
checks a published mathematical cipher vector. Public census data contains only
structural metadata, filenames, flags and hashes. No decompiled listing is included.

## Reuse comparison

A new Blowfish primitive would add large constants and cryptographic implementation
risk for no gameplay benefit. Porting all of OpenRA would add a native engine and
unneeded subsystems. The selected browser primitive plus small format adaptation
keeps async I/O and resource policy under WebRA2 control, with an explicit GPL
boundary. WebAssembly is unnecessary for bounded index parsing at this stage.
