# WebRA2

A planned browser-native reimplementation of the Red Alert 2 and Yuri's Revenge
engines, using assets supplied by the player. Singleplayer campaigns come first;
complete vanilla engine coverage, broader mods, and multiplayer follow.

**Current state:** M1 implementation is in progress. An English/Traditional Chinese
browser app inspects locally selected game folders and asset files, with explicit
RA2/YR selection and cancellation. The headless synthetic simulation survives
save/restore and replay. Verified source reads, CSF text lookup and map-pack codecs
are implemented; original mission gameplay and rendering remain in development.
See [the current handoff](docs/task.md) for exact evidence and remaining gates.

To run the asset inspector with Node 24.20.0:

```sh
npm ci
npm start
```

Open `http://127.0.0.1:4173`, choose RA2 or Yuri's Revenge, select your game folder
or asset files, then inspect. Files stay on your device. No executable is needed.
This build reports asset metadata; campaign play is not available yet.
`npm run build` creates a code-only build, and `npm run preview` serves it locally.

## Project documents

- [Agent instructions](AGENTS.md): start here in a refreshed session.
- [Current task and handoff](docs/task.md): completed work and the next bounded slice.
- [Implementation and collaboration plan](docs/plan.md): milestones, dependencies,
  ownership, and acceptance gates.
- [Reference profiles and budgets](docs/adr/0002-reference-profiles-and-initial-budgets.md):
  selected first RA2/YR missions, asset provenance and initial engineering limits.
- [GitHub workflow](docs/github-workflow.md): issues, linked PRs, recorded reviews,
  merge gates, and traceability across sessions.
- [Architecture](docs/architecture.md): simulation, content, browser, saves, and mods.
- [Decisions and questions](docs/decisions.md): user answers and unresolved choices.
- [Static analysis](docs/analysis/static-analysis.md): findings, evidence, limitations,
  and follow-up analysis.
- [MIX reader and census](docs/analysis/mix-reader.md): encrypted/nested archive
  results and unresolved names/checksums.
- [Campaign](docs/analysis/campaign-census.md) and
  [locale](docs/analysis/locale-census.md) census: mission variants, opcode coverage
  and string-table metadata.
- [Profile resolution](docs/analysis/profile-resolution.md),
  [campaign graphs](docs/analysis/campaign-graph.md), and
  [MIX integrity policy](docs/analysis/checksum-policy.md): implemented primitives,
  reproducible metadata, and remaining compatibility evidence.
- [Verified source reader](docs/analysis/verified-source-reader.md): bounded local
  analysis reads pinned to source and member hashes.
- [Browser](docs/analysis/browser-feasibility.md) and
  [media](docs/analysis/media-feasibility.md) probes: measured results and remaining gates.
- [Behavior specifications](docs/specs/README.md): evidence records and reference probes.
- [Compatibility matrix](docs/compatibility.md): what full support must prove.

## Development checks

Use Node 24.20.0 from `.nvmrc`, then run:

```sh
npm ci
npm run check
```

These checks use original synthetic fixtures and need no game installation. They
cover types, synthetic parser/contract/diagnostic tests, document links and tracked
publication paths, plus consistency of public profile/campaign metadata. See
[the toolchain decision](docs/adr/0001-m0-toolchain-and-contracts.md) for limits.

## Inspect a local installation

Place your installation in `game/`, which is ignored by Git. From the repository root:

```sh
python3 tools/static_inventory.py game
```

This standard-library script reads archive headers, executable metadata, and map
section counts. It does not execute the game, extract assets, or decrypt indexes.
The checked-in [inventory snapshot](docs/analysis/installation-inventory.json)
contains filenames, sizes, hashes, and structural metadata, not game payloads.

Keep extracted content, original-game saves, recordings, and private reference
material under ignored `local/`. Do not put retail assets in web public directories,
Git, packages, CI artifacts, or deployments.

The local launcher currently serves engine code only. Select assets through the
browser's file picker; direct local asset serving, ZIP import and persistent save/UI
flows follow in M1. The architecture describes planned behavior separately from the
commands implemented above.

## Licensing

Original repository material uses [MIT](LICENSE). The MIX, sprite and content census
components are licensed GPL-3.0-or-later; combined distributions must honor it. See
[component licenses and notices](docs/licensing.md) before reusing or distributing
code. Game assets remain separate and are not licensed by this repository.
