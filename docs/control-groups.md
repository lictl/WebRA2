# Numbered battlefield control groups

Issue [206](https://github.com/lictl/WebRA2/issues/206) adds ten session-local
selection groups to the existing battlefield controls. With the canvas focused,
Ctrl+0–9 assigns the current selection and an unmodified digit recalls it.
macOS deliberately uses Control; Command, Alt and Shift combinations are left
untouched. Key repeats and IME composition are ignored. Shortcuts do not run from
inputs, selects, editable content, loading scenes or busy/replay operations.

Each group retains at most64 sorted, unique, known actor IDs. Assignment and recall
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

Original helper/controller and mounted-view fixtures cover all ten slots,64-member
bounds, sparse/invalid selections, current eligibility, source/player/reset rules,
returned-array ownership, empty/unavailable outcomes, focus/modifier/IME/busy gates,
localized feedback and durable replay cancellation. A genuine original world
fixture proves assigning/recalling emits no commands; equivalent subsequent move
and Stop orders produce identical complete save/replay text.

```sh
node --import tsx --test tests/browser/world-control-groups*.test.*
npm run check
```

Actual Chrome acceptance with local RA2/YR content is pending. No browser or
campaign-completion claim follows from the original synthetic tests. Private
screenshots, source geometry, actor identities and saves remain in ignored `local/`.
Other browser-family end-to-end runs remain deferred under owner decision D17.
