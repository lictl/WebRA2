# Battlefield controls and optional panels

[Issue197](https://github.com/lictl/WebRA2/issues/197) makes the existing source-bound
movement and ordinary infantry combat preview usable without scrolling past diagnostics.
The map and a compact order rail share the desktop viewport. The status note explicitly
states that mission objectives and campaign progression are not active.

Orders remain on the existing controller/worker interface. Selection, source ownership,
movement/attack admission, ticks, model identities, checkpoints and replay formats are
unchanged. Camera sizing fits the available map area uniformly within the existing
960×640 pixel budget; display dimensions do not enter the simulation.

Save/replay and diagnostics occupy optional sections of the same rail. Opening either
pauses through the existing controller. Returning never resumes automatically. The
Return to battlefield button and Escape from an optional panel restore canvas focus.
The current pane and form controls are retained across state updates. Run/Pause, Stop,
focus and operation status stay outside the optional sections. Replay cancellation uses
the existing durable `verifyingReplay` flag, independent of pane visibility and notices;
cancellation still terminates the worker and retains selected Files and local checkpoints.

Keyboard unit selection and coordinate orders remain available under Keyboard orders.
The development house override, single-tick debug step, source hashes, state identities,
implementation limitations, selected-entity internals and source diagnostic tables move
to Diagnostics. Source text is assigned through text nodes, never interpreted as HTML.
All new controls have original English and Traditional Chinese copy. No dependency,
game asset or shared simulation/contract change is introduced.

## Validation

`npm run check` at source `654f256eb2b4ffabf3700a8355b36ee42c1b1eed` passes
1,070 public tests, TypeScript, 166 document/826 local-link checks, publication and
M0 evidence checks, and a 68-file build from 144 approved inputs. Original mounted
fixtures cover retained forms, pause, Escape/focus return, cleanup, pane scrolling,
unchanged genuine world state/target choices, selection messages and durable replay
cancellation across panel, selection and keyboard changes. These are synthetic UI
checks; the following native observations are separate.

Actual Chrome on macOS used 16 locally selected MIX files, including Traditional
Chinese assets. Installed Chrome binary metadata reports 152.0.7977.83. Every frozen
bundle was served from its own localhost port and retained with file hashes; no retail
files were served. The browser checks span these explicit revisions:

| Source revision | Native scope | Build manifest SHA-256 |
| --- | --- | --- |
| `c3398abb0be5a8b12cedb4fe71accacac3d2ad0c` | RA2 layout, moving checkpoint/local restore, replay cancellation and retained-file retry | `35e299f0b7e87bb76d82cfb4ea5c277366200437f79f326ff024bd32bd2f09ad` |
| `dad147bd3cff783ff356482799368d02737dcb3d` | YR pending checkpoint, attack/damage, ground movement, replay export/verification, Traditional Chinese and corrected Shift-deselection message | `56ea3825c8b8e1381eebe7ad61a16ff4daf4a4a34d3d667a6a8f8a5634742e72` |
| `654f256eb2b4ffabf3700a8355b36ee42c1b1eed` | Final RA2 panel-scroll/focus, compact layout, selection/Stop/restore, localized replay cancellation and retained-file retry regression | `6f56ab4965e174d3f5a84fcd4fb75d99598f5df58334d91dfdff704923e4906a` |

Between these freezes only `app.js` and the manifest changed. Every worker, shared
chunk, stylesheet and notice stayed byte-identical. The first correction changes the
notice when a valid Shift-click clears the last unit; unsupported selection still
reports rejection. The second resets the shared rail's scroll offset on pane changes,
so returning from scrolled diagnostics shows the selection controls. Neither changes
command admission, simulation, checkpoint format or source identity.

The map measured 1,690×808 CSS pixels at the normal 2,056×1,057 viewport, 914×551 at
1,280×800, 658×519 at 1,024×768, and 664×534 at the compact-rail 980×768 breakpoint.
The corresponding rails were 320 pixels wide, or 285 at the compact breakpoint.
All four layouts had no page overflow. Optional panels scroll within the rail, and
Return/Escape restores canvas focus. Temporary viewport overrides were reset afterward.
These are layout measurements, not native pixel-scale or artwork-depth equivalence.

RA2 kept the existing opening world/initial hashes. A genuine moving checkpoint from
the earlier infantry gate restored at tick 686; Stop completed at tick 687 with the
same previously verified state hash. Local restore returned exactly to the moving
hash. Starting the prior long replay, switching panels, pressing battlefield shortcuts
and changing language kept the dedicated cancellation control visible. Cancel returned
to the chooser with all 16 Files available; retry and local restoration were checked.
The full long replay was not repeated to completion for this presentation change.

YR also kept its existing opening identities. A pending checkpoint extracted unchanged
from the previous native replay was imported, saved locally, stopped and restored to
its exact tick-478 hash. A fresh attack through the target selector and Run reduced
the target's displayed health from 100 to 10. A subsequent right-click on verified
exposed ground admitted movement to the inspected destination. Opening Save paused
playback; Return did not resume it. The actual browser exported a three-admission
replay ending at tick 753 with SHA-256
`7b28558c57baf7cc46bfedb0fa9d3b488cbd8ea3bbc39764d69613b83dccf1e4`.
Both native verification and a fresh private source preparation using the final app
source reproduced that hash. This bounded controls test is not a new campaign
playthrough or a complete fresh-install battle test.

HTTP auditing compared all 68 served code/license files to each frozen manifest and
checked `connect-src 'none'`. Before those audit requests, the first two browser logs
contained respectively 18/13 GETs, including one favicon 404 each; no non-GET requests,
request-body declarations or unlisted endpoints appeared. The final server snapshot
contains 86 GETs (85 successful and one favicon 404), including a complete manifest
audit; it is a combined browser/audit count, not browser-only traffic. Logs, native images,
checkpoint files, exact scene interactions and the replay probe remain in ignored
`local/battlefield-browser/` and the worker's `local/battlefield-ui/` directory.

Prior engine route/long-replay evidence remains in [the infantry browser report](infantry-browser.md).
Other browser-family E2E stays deferred under D17. Mission objectives, victory,
campaign progression, animated firing/death art and cinematic transitions remain
outside this interface slice; the battlefield status states that boundary.

## Provenance

The templates, styles, panel behavior, copy and original fixtures are WebRA2 contributor
work under [the application GPL notice](../apps/web/PROVENANCE.md). Existing source
decoders and simulation components retain their separate notices; this slice adds no
third-party implementation or source-content distribution.
