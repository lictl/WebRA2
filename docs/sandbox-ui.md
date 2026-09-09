# Original practice and local saves

Issue [#75](https://github.com/lictl/WebRA2/issues/75), implementation
[PR #85](https://github.com/lictl/WebRA2/pull/85). The bounded practice interface
and four-browser checks below are implemented; final revision review precedes merge. This is an
original WebRA2 practice interface, not an original RA2/YR mission or a campaign
compatibility claim. It requires no selected retail files.

Run `npm ci` and `npm start`, then choose **Practice**. The two 12×8 layouts use
the existing [synthetic simulation](simulation-foundation.md), seeded damage,
stable IDs, X-first movement and delayed impacts. Select a friendly unit, then an
empty cell to move or an opponent to attack. Arrow keys navigate the grid; Enter
activates its focused cell. Practice starts paused. Resume schedules one explicit
logical tick per completed 250 ms timer; there is no accumulated catch-up debt.
Visibility changes pause scheduling. These timers affect pacing, not simulation
state or replay ordering.

Enemy decisions occur every four logical ticks, choosing nearest Manhattan distance
then lowest ID. The policy string and original scenario definitions are hashed into
the synthetic content identity; future semantic changes must version that policy.
Outcomes wait for pending commands/impacts/reinforcements. A 1,000-tick cap bounds
each practice. No game tick rate, native AI or original combat behavior is inferred.

## Worker and state boundary

`simulation-worker.ts` is explicitly bundled at `/workers/simulation.js`; it never
loads user code. Its app-local v1 protocol carries monotonic request IDs and only
`init`, `restore`, `move`, `attack`, `step` (1–4 ticks), and `verify` operations.
One worker owns one `PracticeModel`/`ReplayRecorder`. One request may be outstanding;
there is no unbounded input queue. The main bridge validates bounded plain metadata,
dense arrays, primitive types, IDs and snapshot dimensions before accepting replies.
Invalid replies, failure, timeout or cancellation terminate the worker.

Each successful reply includes a ≤2 MiB canonical save wrapper and a canonical
simulation hash. The main controller retains that latest acknowledged checkpoint
for recovery. Cancellation ignores late completions and rolls back an unacknowledged
worker operation; the next operation restores that checkpoint in a new worker.
Imported saves stage schema, content, simulation-policy and practice bounds validation
before replacing worker state. No File handles from the asset inspector cross this
protocol. Imported saves are user-controlled state, not authenticated history.

Replay verification replays recorded admissions from the initial checkpoint of the
current segment and compares the complete canonical simulation state. Loading or
recovering a checkpoint starts a fresh replay segment. It does not reconstruct the
commands that preceded that checkpoint. Saves include queued commands, scheduled
work, RNG and admission cursors; the visible details panel exposes the resulting hash.

## Persistence boundary

IndexedDB database `webra2-practice-v1`, schema 1, store `slots` has only the fixed
numeric keys 1, 2 and 3. Each value is one bounded save string, at most 2 MiB. The app
does not enumerate or persist selected game assets. Transactions close their database
connection and map quota, blocked, abort and failure cases to original EN/zh-Hant
recovery text. Completion waits for transaction commit. The controller allows only
one storage/worker operation at once and cancellation aborts uncommitted transactions.

Save/load pauses practice. Export creates a local Blob URL for a save file; import
checks size before reading and validates it in the worker. Neither operation uploads
data. Browser eviction and origin isolation still apply; export provides an explicit
backup. File reads are bounded but native `File.text()` is not itself interruptible;
cancellation discards its late result. Restart creates a new scenario; it does not
delete the three saved slots.

## Public checks

Focused command: `node --import tsx --test tests/web-ui/practice*.test.ts`.
Ten original tests cover real synthetic movement/damage, queued and
in-flight save boundaries, RNG/reinforcement continuations, Node SHA-256 comparison,
replay, grouping-independent enemy decisions, incompatible restore, malformed worker
messages, cancellation/stale jobs, slot operations, oversized input before read,
quota/blocked transactions, visibility pause, and ordinary-order victory/idle defeat
with final replay equivalence. IndexedDB event fakes validate wiring only; the
browser persistence checks below use actual browser storage.

At integrated revision `7e8b99d79b0809e0b6a3939885d6f7f50dae7322`, Node 24.20.0
`npm run check` passed: strict types, 370 public tests, 67 Markdown files / 326 local
links, publication and M0 metadata checks, and an actual build with 23 code/license
files from 36 inputs. The coordinator authored the simulation-worker build/server
route and fixture delta; another agent reviewed that infrastructure independently
from the application review. The results below are original practice checks, not
retail mission tests.

## Actual browser evidence

Observed on macOS on 2026-09-10 (Asia/Tokyo), through the localhost app and actual
UI controls. The tested practice source is
`fd27a4bddcd4be35e24e2b03e1bee9071ae27b0b`. The final integrated worker, both shared
chunks and stylesheet are byte-identical to that build. The app bundle differs
only in two English/Traditional Chinese inspector paragraphs, which now mention
the implemented original practice saves; the integration also carries an existing
SHP runtime notice. A final Chrome smoke check on the integrated build verified
Crossfire selection, a slot-3 save/step/load hash match, deletion and empty-slot
recovery retaining state, and the corrected Traditional Chinese inspector text.

| Browser | Actual persistence and continuation | Additional observed behavior |
| --- | --- | --- |
| Chrome 152.0.7977.83 | Saved tick 3 with one pending impact; a fresh page restored the exact hash, then reached the same tick-5 hash and verified replay. | Friendly selection, move/attack, ordinary-order victory at tick 12 and replay; arrow-key grid focus with one tab stop and Enter issuing an order; English and Traditional Chinese. |
| Firefox 151.0.1 | A document reload restored the same tick-3 save, tick-5 continuation and verified replay. | Restart/resume with no player orders reached defeat at tick 59; terminal replay verified; English and Traditional Chinese outcome/recovery controls. |
| Safari 26.6.2 | A document reload restored the same tick-3 save, tick-5 continuation and verified replay. | Exported an actual 1,209-byte save after accepting the normal localhost download prompt; file import restored tick 5; an 18-byte malformed save retained the checkpoint and showed recovery text; English and Traditional Chinese. |
| Edge 152.0.4191.66 | Imported Safari's tick-5 file, saved to IndexedDB, opened a fresh normal window, restored tick 5, and reached an identical tick-6 continuation with verified replay. | Original scenario start, portable save import, stepping and local persistence observed. Native accessibility/paint updates were delayed; opening/cancelling the file picker exposed completed state. A stale blank refresh surface was bypassed with a fresh window. No controlled action-time or Edge locale claim. |

The common Chrome/Firefox/Safari path moved unit 1 from (2,3) to (4,3), stepped
twice, attacked unit 3 at (6,3), then stepped once before saving. Canonical state
hashes (not exported-file hashes):

| State | SHA-256 |
| --- | --- |
| Tick 3, one pending impact | `13798097692667f72f7a468dff5ffcdc97156c5c293c966973f8e65589800887` |
| Tick 5 continuation; also Edge's imported/restored checkpoint | `890a4dafe5bbd7993f68083ea993d126f7684f9159e7091bc571814454fc3719` |
| Edge tick 6 before/after fresh-window restoration | `0246fdd2ec1890d1a138c478ca8ce27662ab45af176beb641efa0bb32d9cc650` |
| Chrome ordinary-order victory, tick 12 | `7724e4cc502bc96f2823c8f4314df0692e9dfc553034b0bfe88ea715479485c8` |
| Firefox idle defeat, tick 59 | `38ef873946eb059e79a04d23875730961c609622f275469118abdc11920c4a57` |

The tested simulation worker is 40,001 bytes, SHA-256
`fc8a90a1309081b105d5c773ca383c32d04beffc5c99930389353b6a80e48d90`;
the stylesheet is 22,298 bytes, SHA-256
`aa4b2b97d761097d3887907cda898fc36c6c79887f4a36a3d26acbd525eb6d12`.
The initial app bundle hash is
`55156a2806a97e2ce1becd0fe498fbdcc0fb9303a7dac0d7c219f32907e13247`;
the integrated app hash is
`701e2b9c0c633707d8d26585841f63f7b76fd1f4a7862e00679fbe9a2bcc2cf8`.

Private metadata, manifests, request logs and the original synthetic exported fixture
are retained under `local/sandbox-ui/` at the repository root. Localhost request
observations contained only GETs for the page, app code/styles, shared chunks,
simulation worker and a rejected favicon request. No asset/save request or request
body appeared. This observes the app server boundary, not browser telemetry or
extension traffic. The launcher also enforces its code-only routes and
`connect-src 'none'` policy. Chrome's log surface retained three older asynchronous
listener-channel errors without a useful stack; they were not attributed to the
app, and did not prevent the observed worker/storage/UI checks.

These checks do not establish every browser's export flow, all locale/focus
combinations, storage eviction behavior, or cancellation during a slow native read.
The explicit cancellation/failure paths have synthetic lifecycle/transaction tests;
native `File.text()` and browser scheduling limitations remain as described above.

All interface text, layouts, scenario data and tests are original project work under
the [application GPL provenance](../apps/web/PROVENANCE.md). No new dependency or
retail content is introduced.
