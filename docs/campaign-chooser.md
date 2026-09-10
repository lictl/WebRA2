# Campaign chooser and retained local content

Issue [179](https://github.com/lictl/WebRA2/issues/179) adds a source-selected
opening chooser. The source compiler and retained worker/UI integration are implemented.
The bounded actual Chrome launch checks are recorded below.
It does not implement campaign progression, cinematics, mission victory or a
completed playable original campaign.

The source compiler reads the explicit profile's battle, MAPSEL, mission and CSF
files through the verified catalog. Ordinary named faction entries select their
own `Scenario`; arbitrary table order and debug entries do not select openings.
The mission's `Map/Theater` selects the proved native control-file and palette
formulas. Both current reference factions prepare successfully in each profile.
Labels, briefing text and cinematic references remain runtime-only local content.
Missing/ambiguous fields and missing sources disable individual starts. MAPSEL is
retained and verified as a source dependency; its rows do not create progression
edges in this component. Additional battle-file augmentation and debug-menu starts
are outside this first chooser policy.

A genuine same-realm plan owns its launch requests. The UI submits only the
cached fingerprint and faction entry ID. The main app retains local File handles. Private terrain wirev6 adds bounded
`campaign-scan`, `campaign-launch` and `campaign-back` actions. One worker retains
its verified catalog and genuine plan; back releases the scene/world, while cancel
terminates the worker and preserves main-owned files for retry. Profile replacement
releases the old catalog. Progress allows one unacknowledged message plus the latest
coalesced record. Only exact cached plan identity and entry IDs authorize a launch;
returned profile, mission hash and frame identity must match. No arbitrary map path
or source file upload is accepted from a launch message.
Plan identity binds selected source bytes and excludes session source handles.
World/save identity continues through the existing content factories unchanged.

The source reader allows at most32 distinct paths,256 candidates,16MiB per member,
64MiB candidate bytes and1GiB aggregate distinct roots. It verifies bytes against
member hashes and preserves conflicts at equal rank. The plan has two entries,
16 pinned files,8 cinematic references per entry,8,192 code units per localized
field and32,768 serialized code-unit budget. No asset bytes cross the plan wire.

## Native evidence

No bundled game program was executed. The read-only source pins are RA2
`73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`
and YR `3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.
The private ledger validates24 complete instruction spans/2,828 bytes and14 data
records. Its canonical SHA-256 is
`398219e2c945ed72054832e6a5a9c5d7fd47e3e382c53148b8e3ecc3dd895f5f`.
The private scripts rehash both entire executables before decoding ranges.

| Consumer | RA2 virtual range (end exclusive) | YR virtual range (end exclusive) |
| --- | --- | --- |
| Named faction buttons / campaign lookup | `0x514d00–0x514d38` / `0x465580–0x4655bd` | `0x52f232–0x52f26b` / `0x46cc90–0x46cccd` |
| Battle membership / field reader | `0x4656f0–0x46585b` / `0x4655c0–0x4656dd` | `0x46ce10–0x46cf7b` / `0x46ccd0–0x46cdf6` |
| Selected Scenario reaches startup | `0x51429a–0x5142d7` | `0x52e6e0–0x52e71d` |
| Mission Map/Theater read | `0x49d0f9–0x49d117` | `0x4acfd8–0x4acff6` |
| Theater ID search / palette and control path | `0x482b10–0x482b43` / `0x529b94–0x529c4a` | `0x48dbe0–0x48dc13` / `0x54547f–0x545535` |

The ordinary faction buttons use named entries; the campaign class's scenario
string is passed to startup. `DebugOnly` changes the description-reading path; it
is not evidence that every battle-list member appears on the normal menu. The
chooser conservatively excludes debug-only starts and all extra list entries.
The native theater tables contain three RA2 records at`0x79ab68`, stride104, and
six YR records at`0x7e1b78`, stride112. Control fields begin at48; extension fields
are68 and78 respectively. The selected control name forms `%s.INI` (RA2) or
`%sMD.INI` (YR); the extension forms `ISO%s.PAL`. Unknown theater IDs stay disabled.
General wrong-case key behavior is not inferred from the proved case-insensitive
campaign-ID/theater lookup: wrong-case fields are explicitly unsupported here.

These are bounded static interpretations. Native intro sequencing and subsequent
mission progression remain separate work. Existing MAPSEL progression evidence
is in [native profile analysis](analysis/native-profile-evidence.md).
Research uses the previously pinned private Capstone5.0.6 environment; it adds no
runtime dependency. [Component provenance](../packages/content/CAMPAIGN_LAUNCH_PROVENANCE.md)
records the source leads and license boundary.

## Validation

Eleven original tests cover profile/faction choices, source-derived theater paths,
localized values, absent and conflicting fields, malicious paths, debug entries,
independent catalog ordering, abort/reentrancy, immutable plan authority and text
bounds. Mounted event tests cover selection, locale, profile replacement, disabled
entries and literal rendering of hostile text. Additional bridge/controller/worker
tests cover retained catalog authority, stale messages, back, cancellation and retry.
The full438-file private probe prepares both faction scenes/worlds in both profiles.
The existing Allied model hashes remain exactly `b314f5dd1f8e0028134f1f9efa1d41ceace3e3479015019c026544d783204ddf`
(RA2) and `5c5a7396c346e7bf3b6c8d5f94af1042e368754365e53be4ee758fa2ee72c08d`
(YR). These private preparations are not browser measurements or completed missions.
The independent private Python oracle also rehashes seven archive roots and both
executables, reads18 candidate member ranges directly, reconstructs INI/CSF values
and native theater-table strings, and compares the four entry projections. Its
9,836 comparisons include CSF framing checks; this is not a count of gameplay
behaviors. The source review independently reproduced all four preparations and
the native ledger.

Run `node --import tsx --test tests/content/campaign-launch.test.ts` with Node24.20.0.
Private corpus commands are in this worktree's ignored
`local/campaign-launch/probe.ts` and `ledger.py`; the probe reads the root `game/`
installation and writes only private metadata and extracted research inputs.


## Actual Chrome launch checks

The tested runtime is `b72388fa86e668b918cc95f1b9e80f6fd8ffbc10`, served from an
immutable local bundle on port4183. Its manifest SHA-256 is
`4f2c92ff77fe79cc9aa7eb3be21bc6a4fbc66bcf817fc74892b35dcaf4b44d54`.
All63 code/license output files were checked against the manifest and actual HTTP
responses. This slice uses the owner's Chrome-first development policy; renewed
Edge/Firefox/Safari end-to-end tests remain deferred. No browser-version claim is
made from an unverified user-agent string.

Chrome selected the complete438-file installation once, cancelled and retried the
scan with the keyboard, then launched both faction openings in both profiles.
Returning to the chooser retained the verified catalog; switching profiles retained
the same selected files while replacing the profile catalog. English/Traditional
Chinese controls, source-localized faction labels and available briefing text were
observed. The YR Allied source has no resolved briefing under this policy and shows
that outcome explicitly. Intro/progression transitions remain disconnected.

| Opening | Actual browser result | World identity |
| --- | --- | --- |
| RA2 Allied | Ready; step, local save, advance, restore and replay verification | `b314f5dd1f8e0028134f1f9efa1d41ceace3e3479015019c026544d783204ddf` |
| RA2 Soviet | Ready; step and replay verification | `34c9632450db38958c52772593c3a7264dbe7e9b8df23d305dec2dec960178fb` |
| YR Allied | Ready; movement order, moving save, Stop, restore and replay verification | `5c5a7396c346e7bf3b6c8d5f94af1042e368754365e53be4ee758fa2ee72c08d` |
| YR Soviet | Ready; step and replay verification | `a00da82dc676ed5a40561c59f56f43918644684306dbf8f33078c5b735c99607` |

The moving YR checkpoint restores tick1 and state
`caf2d2b167a2dce2db0d40f4c56249b6d3b333a6773e00a74f4674f0c3c6be03`.
The existing attack control rejects an out-of-range request without changing this
state. This smoke check preserves the earlier source-combat boundary; it is not a
new full combat or campaign acceptance claim. A checkpoint from the other world
was rejected without replacing the active world. Scene preparation cancellation
also preserves files and allows a clean retry.

Chrome also selected16 MIX archives through the native multiple-file picker,
without executable files. These private read-only hardlinks retain the original
archive bytes. Both profiles produced the same plan fingerprints as the full-folder
source probe. The assets-only YR Allied launch restored the full-installation moving
checkpoint above and verified its replay. Selecting an original asset-free text
fixture instead disabled both starts with concrete missing-source diagnostics in
English and Traditional Chinese; clearing the selection disabled scanning.

The checkpoint full check passes995 original tests, type checks,153 document files
and775 links,538 tracked publication paths and63 code/license outputs. Its local
request log contains106 GET requests with no declared body, including63 explicit
manual manifest-verification fetches. These counts do not measure all browser
network activity.

An initial925f85a Chrome run exposed a reentrant viewport mount: the initial resize
notified the campaign subscriber before its cleanup handle had been assigned,
creating duplicate order panels. The b72388f fix guards the mount and clears the
cleanup handle before invoking a notification-producing release. The mounted
regression reproduces both notifications. Corrected Chrome launches each have one
order panel. The original4182 bundle and failed observation remain private.

Private DOM observations, screenshots, source-member facts and checkpoints stay in
ignored `local/campaign-browser/` and `local/campaign-launch/`. The local server's
request records cover its own allowlisted routes, not all browser/extension traffic.
Console capture includes extension warnings and three asynchronous-listener errors;
these did not produce a rejected campaign load and are not claimed as a clean
browser console. No retail text, screenshots, actor IDs or scene coordinates are
published with this report.
