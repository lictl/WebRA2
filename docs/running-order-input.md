# Running order acknowledgement

Issue [214](https://github.com/lictl/WebRA2/issues/214) investigates two unacknowledged
Move clicks observed during the [team transaction browser check](mission-team-dispatch.md).
Those observations do not establish a planner regression or prove that an enabled
button accepted the click.

The original controlled worker fixture reproduces a narrower feedback defect:
an order attempted during an outstanding tick is refused with `worldControlsBusy`,
but the tick response immediately replaces that message with `worldRunning`.
The same response also erases selection and accepted-order acknowledgements.
No command was queued by the refused attempt. The mounted canvas Stop shortcut
provides a real event path into this refusal; the Move and Stop buttons remain
accurately disabled while the controller is busy. Native implicit form submission
is a separate browser behavior, not established by a manually dispatched test event.

Automatic tick frames now retain the latest user-action acknowledgement. Explicit
Run/pause, selection, restore, transport failure and other actions retain their own
feedback. The English and Traditional Chinese busy message explicitly says the
order was not queued and must be retried. Stable guidance explains disabled order
controls and is associated with Move, Stop, inspected-cell Move and Attack through
`aria-describedby`. A queued-order acknowledgement no longer tells an already
running player to press Run.

This is a feedback correction. Busy admission, expected revisions, worker protocol,
source/model authority and deterministic commands are unchanged. No intent or
command is retained for later submission. The current operation must finish before
the player retries; pausing Run leaves controls available after that completion.

Original tests use a genuine original world, real worker runtime and bridge, with
explicitly delayed worker messages. They cover refusal and success across ticks,
Stop, selection/player changes, cancellation/replacement, planner rejection,
restore and transport failure. A mounted original DOM fixture checks disabled
controls, keyboard Stop, bilingual acknowledgement and pause/retry. These are
synthetic application tests, not retail behavior or native browser evidence.

Chrome acceptance is pending at the first source checkpoint. Exact immutable
build and native observations will be recorded after the source is committed.
