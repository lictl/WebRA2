# WebRA2

A planned browser-native reimplementation of the Red Alert 2 and Yuri's Revenge
engines, using assets supplied by the player. Singleplayer campaigns come first;
complete vanilla engine coverage, broader mods, and multiplayer follow.

**Current state:** planning and initial static analysis only. There is no playable
app, package manager configuration, build command, or production asset decoder yet.

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
- [Compatibility matrix](docs/compatibility.md): what full support must prove.

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

Original repository material currently uses [MIT](LICENSE). The owner accepts GPL
reuse when it materially helps; dependency selection must record applicable licenses
and update distribution notices before integration. No external implementation code
has been vendored during this planning pass. Game assets remain separate from the
engine project and are not licensed by this repository's license.
