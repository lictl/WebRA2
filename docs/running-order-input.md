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

Chrome tested the original controlled fixture on loopback4196. With a pending
worker tick, native Enter on the coordinate field produced zero form submissions
because the default Move button was disabled. Native canvas S produced the explicit
busy refusal, still visible after tick completion and an English-to-Traditional
Chinese switch. A separately armed fixture began the tick on an enabled Move
button's pointerdown: disabling the button before activation also produced zero
form submissions. A paused retry then submitted exactly one fresh-revision order.
This explains a possible unadmitted mouse gesture; it does not identify the exact
cause of the two historical clicks. The fixture supplies original content and
manual message release, not retail timing or a production test hook.

The product Chrome build is frozen at `d12986e731e4ad2a62ae8a1a13b5a9e0f133b205`
on loopback4197. Manifest SHA-256:
`c32c58f10ddf318cad362b5f971395cbce16b07a446f3d318b153bac6fb2dbb5`.
It contains75 code/license outputs and145 approved inputs. Only `app.js` differs
from the reviewed fdba15a transaction acceptance build; every worker, stylesheet
and other output is unchanged. Private artifacts stay under ignored
`local/running-input-browser/d12986e`.

Actual Chrome used16 on-device asset files for each profile, with no executables.
The installed Chrome application reports152.0.7977.83; this is installed metadata,
not a fresh runtime-version-page measurement. Both openings kept their previously
verified world identities. RA2 used an explicit development control house to test
a two-member group; YR used its source-default player.

| Native observation | RA2 | YR |
| --- | --- | --- |
| Paused group move and real movement | Observed | Observed |
| Accepted running Stop acknowledgement survives later ticks | Observed | Observed |
| Received busy Stop refusal survives later ticks and language switch | English→Traditional Chinese | Traditional Chinese→English |
| Pause and retry Stop | Two orders queued | Two orders queued |
| Saved checkpoint / advance / restore |363 /364 /363 |510 /511 /510 |
| Exact replay verification and restored state |`d5910e80a00e6e3ece3148db48de6a3c4348d191e6a8384cec8cddcde3ad0c03` |`f5be324882563ca7394922e18f7bcdef6ddbecbf44329efe6f63bea1808e8cce` |

Both restores clear selection. Back and profile change retained the16 Files; a
cancelled YR scan exposed its retry action and retained those same files. The
RA2 busy refusal was read at tick192 and remained visible in the other language
at358. YR also retained its refusal through later completed ticks. User Run/pause
and restore replace the acknowledgement as intended.

Running Enter attempts in both profiles, and a later YR Move click, did not visibly
replace the existing destination. No deferred admission is claimed. The native
controlled fixture establishes why disabled controls can suppress activation;
it does not prove the exact timing of each retail-scene attempt. This slice fixes
erased feedback for received actions and explains retry behavior. It does not make
controls accept input during an outstanding operation.

The native pre-audit request log contains23 GETs:22 successful code/style requests
and one favicon404, with no declared bodies or asset endpoints. A separate75-file
HTTP audit matches every frozen file's size/hash and the `connect-src 'none'` CSP
(98 combined GETs,97 successful). Four captured listener-response channel-closure
messages occurred at chooser navigation, without an application stack. There were
no later captured warning/error entries during gameplay. Their cause is unassigned;
this is not a claim of an empty console or proof that an extension caused them.
Screenshots, source identities, detailed DOM observations and local checkpoints
remain private. Other browser families and full original mission behavior were not
retested by this bounded feedback change.

Validation at the source checkpoint: real `npm ci`, `npm run check` with1,201 tests,
186 documents /938 local links, publication/M0 checks, and the75-output build.
The four new focused tests pass; their three controller cases fail against the
prior acknowledgement behavior. The final evidence update changes this document
only; its document links, publication paths and whitespace are checked again.
