# Numbered battlefield control groups

Issue [206](https://github.com/lictl/WebRA2/issues/206) adds ten session-local
selection groups to the existing battlefield controls. With the canvas focused,
Ctrl+0–9 assigns the current selection and an unmodified digit recalls it.
macOS deliberately uses Control; Command, Alt and Shift combinations are left
untouched. Key repeats and IME composition are ignored. Shortcuts do not run from
inputs, selects, editable content, loading scenes or busy/replay operations.

Each group retains at most 64 sorted, unique, known actor IDs. Assignment and recall
use the existing current-snapshot alive, owned and movable selection rules. Recall
filters members again; an empty or unavailable group preserves the current
selection. Assigning an empty selection clears that group. Returned selections do
not alias the helper's retained arrays.

The controller binds groups to its scene generation, world model identity and
player. A source/profile replacement, return to the chooser, scene cancellation,
player change or successful save restore clears them. Ordinary stepping, camera
changes, localization, saving and replay verification retain groups. Failed jobs
that discard the scene also discard its groups. No groups are serialized in world
saves/replays or persisted across browser relaunch. Double-tap camera centering is
outside this slice.

English and Traditional Chinese hints explain the shortcuts and reset policy;
an atomic polite status region reports assignment, recall, clearing and unavailable
members without exposing source hashes. Current selection/HUD and existing move,
attack and Stop paths remain authoritative. UI groups cannot grant an actor a new
simulation capability. No simulation, worker protocol, content contract or build
dependency changes are required. New code and original fixtures fall under the
existing [GPL app provenance](../apps/web/PROVENANCE.md).

## Verification

Original helper/controller and mounted-view fixtures cover all ten slots, 64-member
bounds, sparse/invalid selections, current eligibility, source/player/reset rules,
returned-array ownership, empty/unavailable outcomes, focus/modifier/IME/busy gates,
localized feedback and durable replay cancellation. A genuine original world
fixture proves assigning/recalling emits no commands; equivalent subsequent move
and Stop orders produce identical complete save/replay text.

```sh
node --import tsx --test tests/browser/world-control-groups*.test.*
npm run check
```

The integrated source at `2b3ad0e0bd2427d5c7ef9911fc8e3279f2db6b61` passed all
1,125 public tests, typechecks, 175 document / 871 local-link checks, publication
checks for 620 tracked paths, M0 evidence consistency and the 71-file build.
These are public original/synthetic checks, separate from the private corpus gate.

## Chrome acceptance

Chrome 152.0.7977.83 on macOS exercised an immutable localhost build from that
exact head. Its manifest SHA-256 is
`98fe82d787e8a3da5ad1ad2310512fd86c1797db7d40e213ecdb1828d7800f24`.
The same 16 on-device asset-only files supplied both Allied openings. Native
Control+digit, Escape, digit and Stop keyboard input was combined with browser
locator interactions for the existing forms and panels. English and Traditional
Chinese group guidance and status were checked; screenshots remain private.

| Measured interaction | RA2 | Yuri’s Revenge |
| --- | --- | --- |
| Assignment, clear selection, recall, empty recall | Passed | Passed |
| Two-member assignment / recall | Passed after explicit development-player selection | Passed for the source default player |
| Recall followed by move, Run/pause and Stop | Passed for the source default player | Passed for a two-member default-player group |
| World tick / command queue unchanged by assignment and recall | Passed | Passed |
| Local checkpoint restoration | Same state at tick 97; group cleared | Same state at tick 132 after cancel/retry; groups cleared |

Additional Chrome checks covered an input-focused assignment chord being ignored,
player changes clearing groups, profile replacement retaining the 16 Files while
clearing groups, and language changes preserving groups. Replacing one YR group
with a single member left a separate two-member group intact. A group assignment
attempt during replay verification was ignored; subsequent recall confirmed that
slot remained empty. Replay verification matched its recorded terminal state.
A separate replay attempt was cancelled from the Orders panel: the dedicated
cancel control remained visible, the scene closed and all selected files remained
available for retry. The browser-local checkpoint survived cancellation and reopening; restore reproduced
the saved model and complete state hashes exactly. Explicit empty-selection
assignment also reported that the group was cleared.

Before the separate HTTP audit, the server recorded 23 requests: 22 successful
code/style GETs and one favicon 404, with no declared request bodies or asset
endpoints. The separate 71-file disk/HTTP audit matched every manifest size
and SHA-256 and the `connect-src 'none'` policy. These request observations are
separate from the static server allowlist and original network-boundary tests.

The world identities remain the previously accepted source models:
RA2 `d806540b34de53b0571b73ee6954694bb58b8ee24a4bd014e68da3d47627f17d`,
YR `a39150b933eaf2070743bfba49797501ba5276aba5b6ffb4234fee5ce2abc952`.
Public synthetic save/replay equivalence covers identical orders with and without
control-group interactions; native checks do not independently recreate that
entire paired transcript.

All-ten-slot, 64-member, actor-death filtering, IME/repeat and the complete modifier
matrix remain synthetic coverage; they are not implied native measurements.
Private screenshots, geometry, source actor identities and checkpoints remain in
ignored `local/`. This is a control-group feature gate, not mission completion.
Other browser-family end-to-end runs remain deferred under owner decision D17.
