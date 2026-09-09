# Original practice and local saves

Issue [#75](https://github.com/lictl/WebRA2/issues/75). Implementation in progress;
actual four-browser acceptance and independent review remain pending. This is an
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

## Checks and outstanding evidence

Focused command: `node --import tsx --test tests/web-ui/practice*.test.ts`.
Nine original tests currently cover real synthetic movement/damage, queued and
in-flight save boundaries, RNG/reinforcement continuations, Node SHA-256 comparison,
replay, grouping-independent enemy decisions, incompatible restore, malformed worker
messages, cancellation/stale jobs, slot operations, oversized input before read,
quota/blocked transactions and visibility pause. IndexedDB event fakes validate
wiring only; browser persistence is a separate gate.

Actual Chrome, Edge, Firefox and Safari interaction/reload tests, EN/Traditional
Chinese presentation, keyboard/focus, export/import and network observations will
be recorded before readiness. Do not treat this pending browser gate as passed.
All interface text, layouts, scenario data and tests are original project work under
the [application GPL provenance](../apps/web/PROVENANCE.md). No new dependency or
retail content is introduced.
