# Source-bound infantry combat: Chrome acceptance

This report belongs to [source combat132](https://github.com/lictl/WebRA2/issues/132)
and [integration PR177](https://github.com/lictl/WebRA2/pull/177). It covers the
browser integration of the [ordinary infantry source bridge](../ordinary-infantry-bridge.md)
and [authenticated world6 runtime](../source-infantry-world.md). Original mission
triggers, victory, general combat and native firing/death artwork remain incomplete.
The owner selected Chrome for development checks in D17; the other three desktop
browser families retain their final release gates.

## Baseline and method

The initial actual Chrome run used immutable commit
`91306168858efd2ed94427fe7310b650ec3eaa3a`, served at `127.0.0.1:4179`.
Its59-file manifest SHA-256 was
`73805254a1641b09c53a6bdb5ab7721ad6be99ef149b56dba0a20fef00dc266c`.
The game folder was selected through the native file picker:438 local files.
Source files stayed on-device. Retail screenshots, checkpoints and DOM captures
remain private under `local/source-attack-browser/9130616/chrome/`.
The server retained no request history; this run makes no new network-log claim.
Code-only route allowlisting and CSP validation are separate launcher checks.

The actual browser family was Chrome. Access to `chrome://version` was rejected
by browser URL policy, so this run does not record an independently measured
version. No browser settings or security controls were changed.

The RA2 route uses the explicit development house5, actor23 and target32, with a
move to cell32,44. It is an ordinary source-bound scenario, not the original
player campaign path; [issue178](https://github.com/lictl/WebRA2/issues/178) tracks
the default RA2 actor's current traversal limitation.

## Initial observations and regression

RA2 loaded with world SHA-256
`b314f5dd1f8e0028134f1f9efa1d41ceace3e3479015019c026544d783204ddf`.
The first moving checkpoint matched the independent private world probe.
An out-of-range attack from the default actor left tick0 and the command queue
unchanged and displayed an actionable range message.

After movement, the actual browser attack was admitted at tick723. The pending
checkpoint at tick724 had state SHA-256
`e9b14505bba5c9fda234befd03e962d44f6cad71e2b7b834fd0541ffef0200ee`.
Stop followed by a step cancelled the windup and left the target at125 health.
Restoring the checkpoint and stepping through the due shot reduced health to114
at tick726. The saved pending state survived a genuine page reload, reselection
of all438 files and browser-local slot restore with the same world and state
hashes. Native export and re-import of that checkpoint also matched.

The9130616 build then failed with an `invalid` frame diagnostic near the death
transition. YR's initial frame also failed with that diagnostic. A separate private
real-scene probe isolated the issue: RA2 at tick995 had804 prepared objects and803
active objects after death, while YR initially had569 prepared and568 active
objects because one source structure starts at zero health. Both world snapshots
and scene summaries passed validation; the combined frame rejected the changed
active count. This is recorded in the
[acceptance failure comment](https://github.com/lictl/WebRA2/pull/177#issuecomment-5614906524).
These remain failed baseline observations, not passing death or YR acceptance.
Final corrected-build acceptance is pending.
