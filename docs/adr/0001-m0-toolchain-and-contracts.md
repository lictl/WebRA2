# ADR 0001 — M0 TypeScript tooling and boundary contracts

Status: accepted for M0, 2026-09-09. Work issue: https://github.com/lictl/WebRA2/issues/8.

Use Node 24.20.0 (pinned `.nvmrc`), npm lockfile v3, TypeScript 7.0.2, tsx 4.23.13 and
node:test. Node is analysis/development infrastructure, not a browser runtime requirement.
The host initially supplied Node 20.19.0; tests use a private Node 24 installation
without changing the user's global runtime. Node 24 is an LTS line according to
[the Node release schedule](https://nodejs.org/en/about/previous-releases).

Choose a minimal root package rather than a framework/workspace orchestrator at this
stage. `npm ci` reproduces dependencies; `npm run check` performs strict type checking,
synthetic tests, local document links/whitespace and a tracked-path publication guard.
The public CI template has read-only repository permission, pinned actions and no
asset upload. Activation is tracked in [#10](https://github.com/lictl/WebRA2/issues/10)
because the CLI credential currently lacks workflow-write scope. Local checks run
normally; no remote CI pass is claimed until an actual run succeeds.
The guard complements manual provenance review; it cannot prove arbitrary text files
do not contain retail data. Renderer, UI framework, build bundler and WASM tooling
remain unset until their own evidence warrants adoption.

`packages/contracts` defines proposed WebRA2 command/content/save/replay/evidence
types. Commands sort by tick, player ID and sequence; duplicate player/sequence
identities across the entire batch and unsafe
counters are rejected. Persistable JSON rejects lossy/nonfinite/negative-zero values,
cycles, accessors and excessive nesting. These are WebRA2 rules, not recovered RA2
internals. Checkpoints mean the start of `nextTick`. Native tick rate, phase order,
RNG compatibility and actual save implementation remain unknown/unimplemented.
Cross-batch admission cursors and late-command validation belong to the future
simulation session; this pure ordering helper does not track session history.
EvidenceSummary is a compact trace/UI view, distinct from the richer research
interchange records. JSON structural validation permits finite fractional numbers;
gameplay command kinds must impose their own numeric rules when implemented.

Save/replay/content types currently have no wire loader or hash algorithm. Their
presence does not constitute validated native-save import, complete state capture,
or cross-browser deterministic gameplay. New mechanics must supply appropriate
state/migration tests when the simulation is implemented.

Use `egoroof-blowfish@4.0.3` for the MIX worker's cipher primitive after its dependency
proposal. Preserve the MIX component's conservative GPL-3.0-or-later provenance;
see [component licensing](../licensing.md). This dependency does not select a general
engine rewrite or authorize publishing retail assets.
