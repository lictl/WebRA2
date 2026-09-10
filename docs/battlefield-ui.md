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

## Validation checkpoint

Focused original DOM-interface tests cover repeated optional-panel navigation, retained
form values, explicit pause, Escape/focus return, listener cleanup, unchanged genuine
world state and target choice, plus replay cancellation across panel/selection/keyboard
changes. They do not prove browser layout or native focus behavior. `npm run check` passes 1,035 public tests, TypeScript, document/publication/evidence
checks and a 65-file build from 144 approved inputs. Actual Chrome acceptance remains
pending at this implementation checkpoint.

The native gate will use on-device assets and record practical viewport visibility,
selection/orders, moving and pending-shot save/restore, cancellation and return,
localization, desktop resizing and unchanged identities. Prior long-replay evidence is
in [the infantry browser report](infantry-browser.md); repeating that unchanged workload
is not required for this presentation change. All retail images, saves and observations
remain in ignored local evidence. Other browser-family E2E stays deferred under D17.

## Provenance

The templates, styles, panel behavior, copy and original fixtures are WebRA2 contributor
work under [the application GPL notice](../apps/web/PROVENANCE.md). Existing source
decoders and simulation components retain their separate notices; this slice adds no
third-party implementation or source-content distribution.
