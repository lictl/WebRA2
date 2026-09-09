# WebRA2

A planned browser-native reimplementation of the Red Alert 2 and Yuri's Revenge
engines, using assets supplied by the player. Singleplayer campaigns come first;
complete vanilla engine coverage, broader mods, and multiplayer follow.

**Current state:** M0 implementation is underway. TypeScript tooling/contracts,
the bounded MIX reader and census, behavior specifications, and browser/media
diagnostics, and the bounded campaign/locale census are merged. Effective content
profiles and campaign dependency selection are the next planned slice.
There is no playable game app yet.

## Project documents

- [Agent instructions](AGENTS.md): start here in a refreshed session.
- [Current task and handoff](docs/task.md): completed work and the next bounded slice.
- [Implementation and collaboration plan](docs/plan.md): milestones, dependencies,
  ownership, and acceptance gates.
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
publication paths. See
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

The planned app will support importing an installation or asset files and playing
through a local launcher. The exact browser and localhost behavior is described in
[the architecture](docs/architecture.md); these are planned features, not commands
that exist today.

## Licensing

Original repository material uses [MIT](LICENSE). The MIX and content census
components are licensed GPL-3.0-or-later; combined distributions must honor it. See
[component licenses and notices](docs/licensing.md) before reusing or distributing
code. Game assets remain separate and are not licensed by this repository.
