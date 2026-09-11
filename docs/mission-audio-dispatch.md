# Mission sound and EVA dispatch

[Issue #220](https://github.com/lictl/WebRA2/issues/220) adds an optional sound/EVA
capability to the mission compiler and compound world. Actions 19 and 21 now emit
ordered requests when their original trigger executes. A request identifies the
instruction, trigger, binding, tick, VM order and audio sequence. It refers to the
exact genuine [source-policy catalog](mission-audio-policy.md).

The compiler checks every original action operand against the cue catalog, its
profile/mission identity and the complete audio policy. Missing, stale, copied or
unsupported policy bindings cannot authorize dispatch. Other required unsupported
instructions still prevent whole-program authority. Theme 20 and movie 10 remain
outside this capability; spatial sound and in-game movies require their own source
consumers.

Only the private compound transaction converts VM effects into a genuine
`MissionWorldAudio` batch. Public traces, JSON copies and caller-created request
objects have no invocation authority. Each immutable batch identifies its exact
model, source catalogs, tick range and final checkpoint hash. An equal but separately
compiled model cannot adopt another model's batch.

## Runtime and persistence

Requests follow the existing trigger lifecycle and D03 scheduling policy. Ordinary
polling, nested force, disabled/deleted triggers, repeating tags and actual cell
crossings retain their VM order. Team spawning and team-cell callbacks share the
same world tick; spawn placement by itself does not cause a cell-entry sound.

The optional saved cursor records source policy, last processed tick and next
request sequence. Restore checks source identity, both simulation clocks, effect
order bounds and initial-state consistency. Grouped steps and replay reproduce the
same requests. Restoring an active save resumes at its next sequence instead of
re-emitting earlier requests. The browser still needs a session-scoped consumer
that replaces its own playback state when a save is loaded.

No sample is selected here. Queue priority, controller limits, AudioContext,
category gain, stream clocks and native global audio RNG remain presentation
consumer concerns. Dispatch adds no random draw or audio clock to world simulation.
`playbackAuthorized` and `nativePlaybackVerified` remain false; source invocation
is distinct from output. The [browser PCM component](mission-audio-playback.md)
provides bounded playback but has not yet been connected to these batches.

Programs that do not select audio keep their existing program/model hashes and
checkpoint/result fields. Programs selecting audio include the policy catalog hash
and `webra2-source-audio-dispatch-1` identity in their model. Changing the selected
source policy prevents an old checkpoint from loading against the new model.

## Bounds and verification

A tick admits at most 1,024 audio requests; a cursor admits at most 1,000,000
sequences. Audio and other presentation requests share 1,048,576 counted characters
per compound call. Existing 32,768 trace, 128 tick, work and replay limits also
apply. Work/payload failures discard the whole candidate transaction, leaving the
caller's world, VM, cursor and pending inputs unchanged.

Twelve original tests exercise both profiles, source/operand mutations, unsupported
and forged capabilities, immutable batches, nested trigger lifecycle, actual cell
crossings, team births, per-tick/payload/work failure, and every-boundary restore
and replay. Exact pre-dispatch hashes are pinned for both profiles. An independent
standalone world step also confirms that sound/EVA requests do not alter world
state. These tests contain no retail payloads and do not prove native audio timing.

Reproduce with Node 24.20.0:

```sh
node --import tsx --test tests/sim/mission-audio-dispatch.test.ts
npm run check
# Private complete opening preflight, from the preserved dispatch worktree:
node --import tsx local/probe220.mjs
python3 local/audit220.py
```

A fresh 438-file preparation rebuilds the complete opening source preflight. With
the audio capability, all 39 sound / 18 EVA RA2 occurrences and 10 sound / 14 EVA YR
occurrences are admitted. Required diagnostic counts change from 254 to 197 and
461 to 437 respectively; every unrelated diagnostic remains identical and both
whole-mission authorities remain null. These are occurrence counts, not feature
counts or completion percentages. The [aggregate census](analysis/mission-audio-dispatch.json)
contains only reviewed metadata.

An independent Python raw-source audit passed 7,930 comparisons, including the
existing 6,954 closure checks and 976 additional audio/dispatch checks. It reparses
mission instructions and verifies exact coverage, preserved unrelated diagnostics,
source identities and policy readiness. No native game or browser mission was run.

The composed full check passed 1,305 public tests plus 14 tool tests, types,
202 documents / 1,036 local links, publication/M0 checks and 78 build files from
145 approved inputs. Later report/handoff-only changes receive fresh link and
publication checks. Final independent review must cover the exact merged revision. First playable remains tracked in
[parent #230](https://github.com/lictl/WebRA2/issues/230); source dispatch alone
does not satisfy the original mission's runtime dependencies or victory condition.
