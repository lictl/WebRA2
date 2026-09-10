# Decisions and open questions

Recorded 2026-09-09. User answers override proposed defaults in other documents.
This file is the product decision record; `task.md` is the work-state record.

## Confirmed by the owner

| ID | Decision | Consequence |
| --- | --- | --- |
| D01 | Reimplement the game engine in a browser; players supply a full installation or assets only, and can play locally | The runtime must not require Windows game executables; asset import is a first-class product feature |
| D02 | First campaign release includes Red Alert 2 **and** Yuri's Revenge campaigns | All four faction/game campaign tracks are release scope; early playable slices are internal milestones |
| D03 | Preserve original mission behavior, rules, and saves where feasible; prioritize playability | Track deviations explicitly; do not require undocumented binary-exact timing as the default success criterion |
| D04 | Browser-native TypeScript; WebAssembly where profiling justifies it; vetted open source dependencies | Keep the simulation in TypeScript initially; evaluate native codecs as separate bounded dependencies |
| D05 | Original RA2/YR maps, INI rules, and replacement assets at launch; extension mods later | Ares/Phobos and DLL extensions are a separate compatibility tier |
| D06 | Desktop Chrome, Edge, Firefox, and Safari; keyboard and mouse | Include actual Safari release checks; mobile/touch can follow |
| D07 | GPL is acceptable if engine/decoder reuse meaningfully speeds development | Do not reject useful GPL components by default; preserve provenance and select a coherent distribution license when adopting them |
| D08 | Cinematics required for campaign release; WebRA2 saves required; original save import best effort | Prove a browser media path early; make original saves a separate investigation |
| D09 | Singleplayer campaign first, full engine features and mods ultimately, multiplayer later | Preserve deterministic seams now; defer networking services and protocol implementation |
| D10 | Supplied installation is from Steam, Traditional Chinese; exact version unknown | Pin observed hashes and discover effective patched content; Traditional Chinese is a primary test locale |
| D11 | Owner can run the original and provide observations, recordings, and saves | Prepare small comparison recipes; agents are not assumed to have a Windows environment |
| D12 | On-device file/folder import plus a localhost launcher; no asset upload to a server | Hosted app ships engine code only; local helper serves allowlisted assets over loopback |
| D13 | All languages actually present in the supplied installation at launch | Census playable language packs; multilingual manuals alone do not prove localized game assets |
| D14 | Accept one coordinator plus three workers, incremental milestones, no promised completion date | Default maximum is four active agents; no monetary budget or paid service authorization was specified |
| D15 | Agents must use GitHub integration or `gh` CLI to create issues, PRs, reviews and merges so work is traceable | Every substantive slice follows the linked issue → branch/PR → review → validated merge workflow; record URLs and merge SHA in the handoff |
| D17 | During development, focus browser testing on Chrome for speed; defer full Firefox/Edge/Safari end-to-end tests until the remaining implementation is finished (owner update 2026-09-10) | Chrome is the active development acceptance target; all four desktop families remain final release scope |
| D16 | Commit changes during implementation; record blockers as GitHub issues; involve humans only when necessary; proceed with the accepted plan | Agents resolve routine issues autonomously, commit coherent work and preserve blocker evidence; execution starts with planning bootstrap followed by M0 |

## Completed question round

All twelve initial product questions were answered. Do not repeat them in a fresh
session. The remaining unknowns below need evidence or a later milestone decision.

| ID | Question | Answer | Remaining evidence |
| --- | --- | --- | --- |
| Q01 | Installation source/build/locale | Steam, Traditional Chinese; owner does not know versions | Exact build, overrides, and locale files in M0 |
| Q02 | Reference game access | Owner can provide observations, recordings, saves | Agreed scenario recipes and received evidence |
| Q03 | Import/local behavior | On-device import plus localhost; no server asset upload | Four-browser capability and import tests |
| Q04 | Localization | All languages present in supplied installation | Playable locale census, fonts, CSF and legacy encoding checks |
| Q05 | Work budget/concurrency | Proposed four-agent, incremental approach accepted | Forecast after measured slices; paid services not authorized |

## Proposed technical decisions, subject to milestone evidence

- WebGL2 renderer and Web Audio; DOM-based accessible application shell; optional
  higher-end rendering paths later. Verify feature support in the target browsers.
- Worker-owned deterministic simulation; asynchronous file/codecs workers with
  bounded queues. Start with transferable messages, not mandatory shared memory.
- Browser-local content storage with capability detection and a portable file-input
  fallback. No cloud accounts or cloud save service for campaign release.
- New versioned WebRA2 save/replay formats. Pause singleplayer when backgrounded by
  default; return explicitly to the simulation tick schedule on resume.
- RA2 and YR use explicit version/content profiles, including patch archives and
  content fingerprints. [ADR 0002](adr/0002-reference-profiles-and-initial-budgets.md)
  adopts installation-specific source selections from native static evidence;
  universal dynamic/mod precedence and historical patch numbers remain unverified.
- First selected campaign slices are Allied RA2 `all01t.map` and Allied YR
  `all01umd.map`, with pinned source hashes, continuation evidence and candidate
  dependency counts in [the M0 ledger](analysis/m0-campaign-ledger.md). Synthetic
  determinism and import diagnostics precede those playable targets.
- Future multiplayer initially means WebRA2-to-WebRA2. Original executable/CnCNet
  wire interoperability, campaign co-op, accounts, matchmaking, and anti-cheat
  policy remain uncommitted until that milestone's requirements are gathered.

## Decisions deliberately deferred

The M0 [toolchain/contract decision](adr/0001-m0-toolchain-and-contracts.md) now pins
Node/TypeScript, the npm lockfile and initial envelopes; [MIX provenance](../packages/formats/PROVENANCE.md)
records the adopted archive component. Browser/media reports record measured versions
and hardware, not a permanent minimum support matrix.

Before each relevant implementation slice: production decoder builds, renderer library
versus direct WebGL, complete save schema v1 and minimum browser versions remain.
[ADR 0002](adr/0002-reference-profiles-and-initial-budgets.md) establishes initial
import/media resource gates; gameplay and release hardware budgets remain.
Choose these in short architecture decision records with alternatives, evidence and
consequences; do not open-endedly benchmark stacks.

Before campaign release: hosting provider/domain, supported storefront/locale matrix,
update and cache migration policy, public distribution license/notices, branding,
and release claims. User-supplied assets are an engineering distribution boundary,
not a blanket determination that every copyright/licensing issue is settled.

Before extension mods/multiplayer: named mod targets and extension versions, script
capabilities, sandbox design, determinism across peers, transport/server authority,
operating cost, reconnect/desync policy, and compatibility promises.
