# Opening-world orders and checkpoints

[#127](https://github.com/lictl/WebRA2/issues/127) connects authoritative cell
movement to the existing mission viewport. This slice is **in progress**. The
worker/controller and final native footprint binding have passed original fixture
and separately labeled private checks; actual four-browser acceptance is pending. No original mission
is playable or completed by this checkpoint.

## Worker and display boundary

The existing `/workers/terrain.js` worker uses application-private protocol v3.
It owns the prepared terrain/art resources and one `WorldReplayRecorder`. Its
`world-order` action accepts a player/entity and move destination or stop request;
the worker assigns schema-v1 command tick and sequence from the current checkpoint.
Wrong ownership and immovable actors reject before admission. Step requests are
integer `1..4`. No elapsed time, camera position or pixels enter authoritative state.

Each frame binds its request ID, model/content identities and monotonic world
revision. Render/focus requests retain the revision; successful orders, steps and
restore increment it. Picking remains tied to the displayed frame. Static actor
descriptions join source row → entity ID → artwork placement ID explicitly.
The renderer retains owned source planes and applies whole-cell snapshot offsets
to the named still-preview geometry. It does not infer collision from artwork,
interpolate native locomotion, animate facing or remap player colors.

There is one outstanding RPC and one acknowledged progress message. The UI timer
requests the explicit 15 Hz policy, with at most four ticks of accumulated credit;
hidden pages pause and discard accumulated debt. Cancellation, navigation and
profile/file replacement terminate the worker. Slow rendering can reduce observed
simulation speed; it does not change movement rules or permit an unbounded backlog.

The wire admits at most 2,048 actors, 256 players, 512 KiB of actor-description
characters, eight reasons per actor and 64 recent events with omitted counts.
Snapshots expose cell/health/goal/next edge/progress, counts and a canonical state
hash. Full routes stay in the worker. Pixel transfers retain the existing bounded
960×640 RGBA contract and exact byte-length validation. World parser/work/replay
limits remain those in [authoritative movement](world-movement.md).

## Local state and recovery

World checkpoints use a separate `webra2-world-v1` IndexedDB database with three
slots of at most 2 MiB each. Existing Practice state and storage are unchanged.
Checkpoint and replay exports use locally generated Blob URLs; no network request
carries their bytes. File import checks size before reading and validates bounded
UTF-8 text, duplicate JSON keys, model/version/content identity and authoritative
state in the worker. Invalid data returns a recoverable rejection and retains the
live world. Restore starts a new recording from that checkpoint. Replay validation
reexecutes admission timing and checks its terminal hash without replacing the
current world. Save/export/restore/verify pause running first.

Commands may also be entered with cell-coordinate fields and unit selection, so
missing artwork does not prevent inspecting or controlling a supported entity.
The chosen house is explicit. Canvas Space toggles run/pause, S stops the selected
unit and M moves it to the inspected terrain cell. Interface and recovery copy is
original English/Traditional Chinese. Combat, mission triggers, victory,
infantry subcells and native movement fidelity remain unsupported.

## Current validation

`node --import tsx --test tests/browser/world*.test.ts tests/web-ui/terrain.test.ts`
passes 24 tests at the integrated binding checkpoint: fourteen map-identity/session/worker/controller
tests plus ten migrated terrain tests. Adding `tests/browser/object-viewport.test.ts`
passes 31 focused tests, including a changed-pixel and retained-pick movement test. They exercise original obstacle detours,
ownership, stop/replacement, moving save continuation, replay hash verification,
strict malformed messages, duplicate-key/mismatched saves, cancel→new-session
continuations, storage namespace and scheduler bounds. These tests use original
fixtures; they are not browser observations or native mission comparisons.

The integrated private application loader, using all 438 selected files, reproduces
both independently reviewed [world adapter](world-movement.md) model hashes:

| Profile | World model SHA-256 | Mobile / total actors | Occupancy cells |
| --- | --- | --- | --- |
| RA2 | `57bb08af8cdafefc5afb18d8d5f2019725f1fd45e31dbda994ea44218d70cda4` | 58 / 811 | 1,108 |
| YR | `fd4126992c8c896f50766a8240aa69dd48e9d4a8e2ff444fb9f9cd5a020c3dff` | 70 / 570 | 1,478 |

The worker re-reads the exact verified mission locator and compares all root/member
identity fields before compiling definitions, all eight traversal classes and native
base footprint masks. Only a genuine `unsupported-required-footprint` error retains
a static preview with an explicit unavailable explanation. Other failures propagate.
Private checks retain both initial static viewport hashes, execute an actual movable
actor's adjacent-cell order, restore its partially completed edge, continue to the
same terminal state and verify its recorded replay. These are Node File-compatible
private checks, not native browser input or proof of original mission behavior.

Final acceptance must record the actual
four-browser input/movement/persistence/lifecycle outcomes and immutable code-only
bundle identity. Retail files, decoded frames, exported saves/replays and private
observations remain in ignored `local/` and are never published with this report.
