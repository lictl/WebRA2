# Local installation shell

Issue [#27](https://github.com/lictl/WebRA2/issues/27) adds the first original
application UI under `apps/web/`. It composes the
[browser importer](browser-import.md); campaign play is explicitly unavailable.
The coordinator-owned build/localhost launcher in
[PR #46](https://github.com/lictl/WebRA2/pull/46) provides `npm run build` and
`npm run preview` after integration. The entry is `apps/web/src/main.ts` and CSS
is bundled locally. No remote font, artwork, runtime import or asset endpoint is used.

The shell supports English and original Traditional Chinese interface text, explicit
RA2/YR selection, folder selection with individual-file fallback, tolerant/strict
inspection, bounded progress, cancellation, replacement, clearing and reinspection.
Strict-mode text explains that this index-only pass does not verify advertised
checksums. Reports distinguish literal files, archive candidates, ambiguity, missing
and blocked requirements; identities and campaign readiness remain unverified.
Source tables are paginated at 25 rows; diagnostics put errors and warnings first; diagnostic and provenance lists disclose
when presentation is truncated. Imported names and technical codes use `textContent`.

The DOM-independent controller owns selected handles and a monotonically increasing
job generation. Cancellation/replacement/profile or policy changes abort old jobs
and prevent stale progress, errors or results from replacing current state. Selection
rejects more than 4,096 files before copying handles. Progress updates preserve the
main controls; pagination restores keyboard focus. Page departure releases handles;
a back/forward-cache return creates a fresh session. No local storage is used.

## Dedicated import worker

The app-local protocol in `import-protocol.ts` is version 1. Every inspection creates
one dedicated module worker at `/workers/import.js`; `main.ts` has no main-thread
fallback. The request contains a positive job ID, explicit RA2/YR profile and policy,
and at most 4,096 selected File handles with separate relative-path metadata. Each
path/name is capped at 4,096 code units before dispatch. File structured cloning is
an on-device browser operation; it does not send file bytes to the localhost server.
The worker restores the explicit folder path on its cloned File before the existing
importer's path validation and normalization. The kernel's byte/member/archive limits
remain in force; the bridge does not verify content identities.

Replies contain the same protocol/job ID and progress, a metadata report, or a
whitelisted error name. One progress message may be outstanding until acknowledged;
the worker coalesces further updates into the latest pending state. A terminal reply
can follow that one outstanding progress message. Invalid envelope versions, malformed bounded report fields, invalid
progress bounds and worker loading/cloning failures fail closed. Different job IDs
and late replies cannot become the current report. Errors never carry arbitrary
exception messages or retail payloads.

Completion, errors, cancellation, replacement, profile/policy changes and page
departure terminate the worker and remove its event handlers. Termination is the
cancellation mechanism: a synchronous worker file read does not need to process a
cancel message before the UI can stop the job. There is no uploaded JavaScript,
`eval`, network decoder or worker reuse across selections. The coordinator-owned
build bundles an explicit worker entry and serves only its validated code path.

[Application provenance](../apps/web/PROVENANCE.md) records original WebRA2
attribution and GPL-3.0-or-later composition with the importer/reader. No retail
content is present in app files, fixtures or build outputs.

## Validation

`node tools/run-tests.mjs tests/web-ui` passes 19 original synthetic tests: nine
selection/state tests, two diagnostic/localization tests and eight worker tests.
They cover cancellation/replacement races, page-departure disposal, stale generations,
clone/load errors, bounded progress, nested report validation, dense metadata arrays,
unknown fields, boxed values, wrong profiles, error sanitization and real synthetic
importer reports. Explicit strict app/test TypeScript checking passes. The full
repository check passes 292 tests, strict types, 58 Markdown files / 271 local links,
publication and M0 evidence checks at this handoff; consult the linked PR for CI.
The independent [worker code review](https://github.com/lictl/WebRA2/pull/56#pullrequestreview-5157650790)
records the reviewed code head and resolved findings. Browser results below are private
retail-input checks, separate from public fixtures and campaign compatibility.

### Actual final-bundle browser checks

All four browsers ran the real dedicated worker against the selected Steam game
folder on this macOS host. The full recursive selection contains 438 files / 1.83 GiB,
including the unassigned `finalalert2/marble.mix` editor archive. Each YR/tolerant run
completed with **118 archives, 14,912 entries, 158 accepted / 280 ignored files,
91 named entries**, and ten requirements: **eight archive candidates / two ambiguous**.
These are candidate inventories, not verified effective content or mission readiness.

| Browser | Version | Final reported bytes read | Coarse observed interval |
| --- | --- | --- | --- |
| Chrome | 152.0.7977.83 | 1,020,238 B | 33.047 s |
| Firefox | 151.0.1 | 1,020,238 B | 12.349 s |
| Safari | 26.6.2 | 996.33 KiB displayed; exact title bytes unavailable through native AX | 248.102 s |
| Edge | 152.0.4191.66 | 1,020,238 B | 61.772 s |

Intervals run from the tool's start-click timestamp to the observed terminal state.
They include tool round trips, native window/accessibility lag, visibility scheduling
and idle time; **they are not execution-time benchmarks or comparable speed claims**.
Firefox already showed a terminal byte count in the first post-click observation.
Chrome repeated quickly enough to finish before one attempted cancellation; a further
run was cancelled while active and correctly retained all 438 selected handles with
no report. No timeout or sleeping tab was relabeled as completed work.

A further final-bundle Chrome RA2/strict run retained the same 438-file selection and
completed with 74 archives / 8,094 entries / 140 accepted / 298 ignored / 49 named /
866,848 B read. Its ten requirements were nine blocked and one ambiguous; strict
archive errors appeared before informational diagnostics. Changing profile/policy
cleared the previous YR report before this run.

Native Edge sometimes returned stale accessibility state or a sleeping tab. Fresh
native windows, ordinary keyboard input and opening/cancelling the individual-file
picker exposed the updated selection/result; no browser settings, extension permissions
or access rules changed. Chrome extension-controlled file selection lacked file-URL
permission; the actual acceptance run used a fresh native window/picker instead.
All four final runs requested the worker code route and reached an actual final report.

Firefox's final report was switched from English to Traditional Chinese and visually
inspected: counts persisted, source kind/status/profile descriptions and warning
recovery text were translated. Earlier UI checks also covered profile/policy changes,
clear/replace, refresh releasing handles, provenance expansion, source pagination and
keyboard focus restoration. An original four-byte file named `檢查<&>.mix` displayed
literally, then produced an unsafe-path diagnostic without reading its payload; this
is a path/presentation check, not a malformed archive decoding test.

The final byte counts include the independently reviewed
[member-header reuse change](https://github.com/lictl/WebRA2/pull/70). A private Node
File-compatible comparison retained every report field except `bytesRead` while
reducing YR source reads from 36,923 to 15,438. Before that change, Chrome/Firefox
main-thread full-folder reports read 1,149,148 B; the worker Safari full-folder report
also completed with matching inventory and a rounded 1.1 MiB display, while an Edge
worker run of `ra2.mix` alone completed with 21 archives / 5,703 entries / 705,246 B.
Those are separately scoped earlier builds, not final-bundle measurements. The
[worker source backend](browser-import-worker.md) uses FileReaderSync only when
available in a dedicated worker; the UI checks do not independently instrument that
internal capability branch or establish a performance win for it.

### Reproducible build and privacy boundary

The final browser code was built from app code through `aaf352ffe28296c46881630fde22b3e46bd72116`
and header reuse `1e4eb432ace162f150c50a4a8c61c3d7a5b4719b`, using the coordinator's
locked build helper. The launcher snapshots the validated build, so a rebuild requires
a launcher restart. Observed code fingerprints:

| Path | Bytes | SHA-256 |
| --- | --- | --- |
| `app.js` | 52,207 | `bcba8234576279594338d6c6e26dda2bca08ae278abe5de1f7f8ea4c80151d0d` |
| `workers/import.js` | 56,371 | `6706d722565d50fbe01f8be5d73092e590f83f6dab0f1cdddaf1a5c217e378e7` |
| `chunks/chunk-XQE3HTTW.js` | 1,593 | `86bb6cb65da5490db819fa64006770220c3e3290c60aed754b264e0f22da124b` |
| `app.css` | 18,424 | `c29945064bce4a7d70b1f48b890bc5e8910b6a83334e14b34ac4097aeb165615` |

Private metadata evidence is retained in ignored `local/import-shell/`:
`browser-worker-observations.json`, `browser-observations-before-scheduler.json`,
`requests-final.jsonl`, `requests-worker.jsonl`, `report-validation.json` and check logs.
No retail payloads, extracted assets or screenshots are part of this publication.

The final localhost observations recorded only GET requests for the app HTML/CSS/JS,
worker/shared module and Firefox's unsuccessful favicon request, with no request body
length headers. This is a localhost request observation, not a packet capture or
an audit of unrelated browser extensions. App and worker code contain no asset-upload
path; the launcher only serves allowlisted code/licenses with `connect-src 'none'`
and `worker-src 'self'`. Selected File handles are cloned only between local browser
threads. Browser-native “Upload” wording grants the page file handles; the app sends
no selected assets to a server. Root source hashes, full dependency closure, campaign
selection/play, saves and renderer integration remain later work.
