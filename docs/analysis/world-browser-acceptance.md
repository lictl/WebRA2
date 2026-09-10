# Opening-world browser observations

These are private retail-file observations for [#127](https://github.com/lictl/WebRA2/issues/127)
and [PR #128](https://github.com/lictl/WebRA2/pull/128), recorded on 2026-09-10.
They validate the [movement/checkpoint component](../world-ui.md), not original
mission behavior, combat, victory or campaign completion. Safari automatic running
remains unresolved under [#115](https://github.com/lictl/WebRA2/issues/115).

## Exact build and method

The tested application head is `fed54cd290d1e72562836e65c146e6c585a2b014`, including
the independently reviewed [durable identity correction](../selection-identity.md).
Its immutable localhost build contains 40 code/license outputs from 92 approved
inputs. All 40 served output sizes and SHA-256 values matched its manifest. No
runtime edits occurred during this acceptance run; later report edits do not alter
the bundle. The preceding `7ed6c52` build remains separate pre-fix evidence.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Manifest | 10,579 | `bc5df9d886c719e6a7bc2145f65bb8ff1aeec591cf2891be2e3f5b00d89617ab` |
| Application JS | 159,225 | `7a16932706037bb106f7c841f1ab94d1747cbe791b361250eee0c31419d663f7` |
| Application CSS | 28,715 | `ad13dae453fa34ac75fe8a66f6841ccaf6623cd1b0a58af76e8d65f564e7d8ba` |
| Terrain/world worker | 349,266 | `638aefd287c74640e0b6c505670e74a7858ffaf6152b7b9769caeb9c25baec71` |

Each family selected the same 438 local files, displayed as 1.83 GiB, through the
native folder chooser. Chrome used native file/keyboard controls plus extension
DOM actions and read-only text inspection. Firefox, Edge and Safari used native
accessibility controls and keyboard input. These were actual browsers, not Node
File-compatible shims. Observed completion and hashes determine results, rather
than the number of clicks or an intermediate progress message. They are functional
checks, not controlled load-time or frame-rate benchmarks.

## Observed outcomes

Every browser loaded both independently checked model identities from
[the component report](../world-ui.md). Artwork coverage stayed explicit: 792/811
placed RA2 objects and 552/570 YR objects had prepared stills. Missing artwork did
not remove the corresponding logical actors.

| Browser | Both openings: movement and local moving restore | Automatic Run/Pause and arrival | Chrome RA2 save import and replay-file validation |
| --- | --- | --- | --- |
| Chrome 152.0.7977.83 | Observed | Observed; both terminal recordings verified | Exported, imported and verified locally |
| Firefox 151.0.1 | Observed | Observed; both terminal recordings verified | Exact same moving and verified replay hash |
| Edge 152.0.4191.66 | Observed | Observed; both terminal recordings verified | Exact same moving and verified replay hash |
| Safari 26.6.2 | Observed through explicit steps | **Open:** Run stays paused because the page reports hidden | Exact same moving and verified replay hash |

The shared RA2 checkpoint has entity 1 at `(62,108)`, destination `(62,107)`,
health 250, next tick 2 and edge credit 7,680/65,536. Chrome, Firefox and Safari
created that state through controls; Edge also imported it exactly. The shared YR
checkpoint has entity 1 at `(88,101)`, destination `(88,100)`, health 100, next tick
2 and credit 10,240/65,536; all four created and restored it through controls.

| State | SHA-256 |
| --- | --- |
| RA2 moving checkpoint; 72,406 bytes | `8e92833b19fcb70aeb329bcc9f357fc62a1121b31cce4eb0f2915c8acbefc25d` |
| YR moving checkpoint; 51,696 bytes | `5fa525ce77b5ccb155e2a7d84d1ffb76bcd601724f8d537b624b915bffe25092` |
| RA2 next tick 22, arrived and replay verified in Safari | `35a8be486e29bccd573b73b92db250a18e682c70a8eb45af3a1b8d82502cea09` |
| YR next tick 22, arrived and replay verified in Safari and restored Chrome | `3451c2133ca6ea840e8c9189e66d8284923e5bd5450505133b4523ae18734f22` |

The two tick-22 states also match the independent private loader. Chrome's YR
checkpoint survived a full page reload, native file reselection and slot restore;
20 further explicit ticks reached the same terminal/replay hash. Full reload and
browser-generated export checks were performed in Chrome. The other families
exercised their local slot restore and Chrome-exported RA2 file import/validation;
exports and full reload were not repeated in those families. The exported RA2
replay was 72,647 bytes, SHA-256
`0bb35c2d28070dae9ae4d871ebb452ed886e1e6f4f7a1f968b71643904b3e634`.

Chrome exercised RA2 stop, blocked destination, a four-cell detour and partial-edge
replacement. Firefox, Edge and Safari exercised the corresponding YR sequence:
stop, blocked `(89,100)`, five-cell detour to `(86,99)`, then replacement with
`(88,100)`. Their next-tick 4/5/6 state hashes matched exactly. Centering and picking
the moved YR object reported its actual `(88,100)` cell; Safari also picked the
moved RA2 object at `(62,107)`. Chrome's canvas was visually inspected privately.
The known still-image, blue utility/filler terrain and missing-art limitations
remain visible and are not native rendering-fidelity claims.

All four rejected an RA2 slot in the YR world without changing the initial world.
Chrome additionally rejected an obsolete same-profile model with `world-save-model`
without changing the live state hash. Each family changed English/Traditional
Chinese and profile, cancelled a pending YR load, retried successfully, and
navigated away with the world controls removed. Chrome/Firefox/Edge exercised
navigation during Run; Safari stayed correctly paused. Chrome additionally exercised
Space on the focused canvas to run and pause. Synthetic checks separately cover
hostile messages, duplicate-key documents and delayed cancellation continuations.

## Limits and retained evidence

Safari's Run action retained next tick 2 in both profiles and displayed the
hidden-page pause explanation. Explicit steps reached and rendered both terminal
states, but they are **not** evidence of automatic visible running. No hidden-page
override, browser flag or settings change was used. Earlier minimal-page diagnosis
also observed hidden plus focused with zero animation frames; this does not
establish an application cause or a necessary human intervention. Issue #115 owns
the remaining normal-visibility investigation and actual automatic-running gate.

Retained Edge tabs reported Sleeping with no page content. Normal menu Quit and
reopening the pinned official browser restored operation. Its accessibility value
setter cleared a numeric field, so the first idle two-tick attempt was excluded
from movement evidence. Ordinary keyboard entry produced the measured order and
moving local checkpoint. Native input values were checked before later orders.

A server-log snapshot contained 133 GET requests: 128 successful code/license
responses and five missing favicon requests. No request declared a nonzero body;
the log includes output-verification requests. The served CSP has
`connect-src 'none'` and only same-origin workers. This is application/server
boundary evidence, not a capture of every operating-system or browser-extension
network connection. Chrome reported extension-attributed warnings and six generic
asynchronous-listener errors without an application stack; this report makes no
clean-console claim or unverified attribution of those errors.

Private metadata, frozen build/manifest, source-loader facts, request log and
exported checkpoints/replay remain in ignored `local/world-ui-final/`. The
observation ledger is manually transcribed native UI metadata, not an automated
browser log. No retail frames, game files or exported state are published here.
At the tested head, Node 24.20.0 `npm run check` passed 640 original/public tests,
TypeScript, document links, publication guard, M0 evidence checks and the code-only
build. Public synthetic checks are separate from the private browser evidence.
