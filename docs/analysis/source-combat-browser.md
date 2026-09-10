# Source-bound infantry combat: Chrome acceptance

This report belongs to [source combat #132](https://github.com/lictl/WebRA2/issues/132)
and [integration PR #177](https://github.com/lictl/WebRA2/pull/177). It covers the
browser integration of the [ordinary infantry source bridge](../ordinary-infantry-bridge.md)
and [authenticated world6 runtime](../source-infantry-world.md). Original mission
triggers, victory, general combat and native firing/death artwork remain incomplete.
The owner selected Chrome for development checks in D17; the other three desktop
browser families retain their final release gates.

## Baseline and method

The initial actual Chrome run used immutable commit
`91306168858efd2ed94427fe7310b650ec3eaa3a`, served at `127.0.0.1:4179`.
Its 59-file manifest SHA-256 was
`73805254a1641b09c53a6bdb5ab7721ad6be99ef149b56dba0a20fef00dc266c`.
The game folder was selected through the native file picker: 438 local files.
Source files stayed on-device. Retail screenshots, checkpoints and DOM captures
remain private under `local/source-attack-browser/9130616/chrome/`.
The server retained no request history; this run makes no new network-log claim.
Code-only route allowlisting and CSP validation are separate launcher checks.

The actual browser family was Chrome. Access to `chrome://version` was rejected
by browser URL policy, so this run does not record an independently measured
version. No browser settings or security controls were changed.

The RA2 route uses an explicit alternate development house and moves a supported
infantry unit into range of an eligible enemy. It is an ordinary source-bound
scenario, not the original player campaign path; [issue #178](https://github.com/lictl/WebRA2/issues/178) tracks
the default RA2 actor's current traversal limitation.

## Initial observations and regression

RA2 loaded with world SHA-256
`b314f5dd1f8e0028134f1f9efa1d41ceace3e3479015019c026544d783204ddf`.
The first moving checkpoint matched the independent private world probe.
An out-of-range attack from the default actor left tick 0 and the command queue
unchanged and displayed an actionable range message.

After movement, the actual browser attack was admitted at tick 723. The pending
checkpoint at tick 724 had state SHA-256
`e9b14505bba5c9fda234befd03e962d44f6cad71e2b7b834fd0541ffef0200ee`.
Stop followed by a step cancelled the windup and left the target at 125 health.
Restoring the checkpoint and stepping through the due shot reduced health to 114
at tick 726. The saved pending state survived a genuine page reload, reselection
of all 438 files and browser-local slot restore with the same world and state
hashes. Native export and re-import of that checkpoint also matched.

The 9130616 build then failed with an `invalid` frame diagnostic near the death
transition. YR's initial frame also failed with that diagnostic. A separate private
real-scene probe isolated the issue: RA2 at tick 995 had 804 prepared objects and 803
active objects after death, while YR initially had 569 prepared and 568 active
objects because one source structure starts at zero health. Both world snapshots
and scene summaries passed validation; the combined frame rejected the changed
active count. This is recorded in the
[acceptance failure comment](https://github.com/lictl/WebRA2/pull/177#issuecomment-5614906524).
These remain failed baseline observations, separate from the corrected results
below.

## Corrected build

The actual corrected Chrome checks used commit
`26d1b3a829450ab40f9188fe9eefed258690f51f`, served at `127.0.0.1:4181`, with
60-file manifest SHA-256
`5775c5d17141972f47e1daf6bbdbbe07a3bfd0c93a8c33f0093afe279850582f`.
An independent HTTP probe matched every served file to its frozen bytes, size and
manifest hash and observed `connect-src 'none'`. This is a code-distribution check,
not a record of the browser's requests. Builds 9130616 and 26d1b3a are reported
separately; no intervening build is credited with these actual checks.

The corrected frame reports removed object IDs against completed-death or
initially zero-health world actors. Initial prepared artwork totals remain source
metadata. The frame can therefore remove a dead actor's artwork without rejecting the whole
preview. RA2's world and pending-save hashes remained unchanged across the fix.

| Actual Chrome check | Observed result |
| --- | --- |
| YR 438-file load, cancel, retry | Cancellation retains selection; retry reaches a ready scene while retaining the initially zero-health entity in the world |
| YR movement | A supported infantry unit under the default player house moved into range; tick 1 state matched the private source probe; browser-local moving save succeeded |
| Inspected versus manual target | After inspecting one enemy, manually selecting another remained selected through an out-of-range rejection at tick 666, with no admitted order; choosing the in-range enemy then admitted the valid attack |
| YR pending save | Attack starts 666, saved windup 667 is due 668; native export hash equals the displayed state hash |
| YR Stop and restore | Stop leaves target health 100 at 668; restore returns the identical 667 state; due-shot continuation shows 85 health at 669 |
| RA2 saved-state compatibility | Native import of 9130616's pending 724 checkpoint returns the same world/state hashes in 26d1b3a |
| Corrected RA2 Stop and restore | Local save, Stop and restore repeat successfully; target remains 125 after cancellation and becomes 114 after the restored due shot |
| Automatic running and completed deaths | Both profiles retain the ready preview through lethal damage and completed death; target health becomes 0 |
| Replay verification | Both actual exported continuations verify to the displayed terminal state hashes below |
| Exported replay file | At RA2 live tick 1119, native file validation of the 1118 replay reports its 1118 terminal hash while leaving the distinct live 1119 state unchanged |
| Traditional Chinese | YR's result shows localized destroyed health/status and controls; inspecting the former infantry position returns visible terrain after retirement |

The YR moving tick 1 state SHA-256 is
`b3b4316963a0c0dca6eebaea1ba39aadc1bb9e3144ea045280f5deaa6217e480`.
Its pending 667 state SHA-256 is
`63e6f507c5bc19c9da036cc1c3b2f3d7021fe20d72a9f27e4bfe84b680e4046e`.
The native final exports record these outcomes:

| Profile | World SHA-256 | Final tick / state SHA-256 | Shots / RNG draws | Death start / completion / corpse index |
| --- | --- | --- | --- | --- |
| RA2 | `b314f5dd1f8e0028134f1f9efa1d41ceace3e3479015019c026544d783204ddf` | 1118 / `5efd4a48ede5febc544187749d08ff05c25e6bd0a760fad85052318fb1ca52aa` | 12 / 18 | 979 / 994 / 1 |
| YR | `5c5a7396c346e7bf3b6c8d5f94af1042e368754365e53be4ee758fa2ee72c08d` | 1098 / `3b0c4e4c21f35ed224d9c8829af42600317df7aea81c261ba368c51c4cbf56a3` | 7 / 11 | 807 / 822 / 3 |

RA2's exported checkpoint/replay sizes are 87,620/87,727 bytes; YR's are 65,525/65,649
bytes. Both exported replays start from the saved pending checkpoint, at 724 and 667
respectively, and contain no new command admissions. They prove deterministic
continuation from that checkpoint. The earlier movement and attack orders were
observed separately in the UI; the exported continuations are not presented as a
complete launch-to-death command recording.

Private corrected-build evidence is retained under
`local/source-attack-browser/26d1b3a/chrome/`: `acceptance-facts.json`,
`http-code-manifest-check.json`, full DOM observations, native checkpoint/replay
exports and screenshots. Baseline failure and the independent real-scene
frame-count probe stay under the separate 9130616 directory.

## Remaining scope

This closes the measured Chrome integration regression and the two bounded
source-combat scenarios. It does not establish an original campaign playthrough.
RA2 uses an alternate development house; issue #178 remains open. D03's 15 Hz logical
policy, seed 0, Normal house indices and explicit 15-tick death durations are
development rules. Native firing, death and corpse animation presentation remains
unimplemented; corpse indices above describe saved simulation state. General
weapons, special statuses, mission triggers and victory remain separate work.

Fresh-page folder reselection and persistent pending restore were measured on the
baseline RA2 build, followed by compatible native import into the corrected build.
They were not repeated as a fresh YR-page experiment. Corrected YR had local slot
restore, native export and current-replay verification; its exported replay file
was not separately re-imported. The actual replay-file validation test is RA2.
Browser versions, request history and the deferred Firefox/Edge/Safari runs are
not inferred from these Chrome results.
