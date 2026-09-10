# Campaign chooser and retained local content

Issue [179](https://github.com/lictl/WebRA2/issues/179) adds a source-selected
opening chooser. The source compiler and retained worker/UI integration are implemented. Actual
Chrome acceptance is pending at this checkpoint.
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

## Checkpoint validation

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
No actual Chrome chooser run has occurred at this checkpoint.

Run `node --import tsx --test tests/content/campaign-launch.test.ts` with Node24.20.0.
Private corpus commands are in this worktree's ignored
`local/campaign-launch/probe.ts` and `ledger.py`; the probe reads the root `game/`
installation and writes only private metadata and extracted research inputs.
