# Original-game comparison recipes

Status: prepared for later bounded requests; **none has been run**. No request for
owner action is needed to finish M0-03. Original-game access is owner-operated under
decision D11. Agents must not execute the bundled game during static analysis.

## Prepare once for a selected comparison

Choose a resolved mission/member and profile after the M0 census, or construct an
original minimal diagnostic map after verifying its parameter framing. Do not edit
`game/`; keep diagnostic maps and copied working-test installations private under
`local/reference/` or another owner-selected private path. Retail payloads, original
saves and recordings never enter Git, issue attachments or public CI.

Each run has a manifest: recipe/version, profile, executable and effective content
hashes, mission/diagnostic-map hash, locale, difficulty, speed setting, OS and active
wrappers/mods, starting save hash or fresh-start marker. Record visible actions and
outcomes, capture rate/timebase, uncertainty and interruptions. Keep originals and
recording metadata; public results contain only the scenario/build hashes, steps,
observed facts and limitations. A changed build/mod/speed creates a new run group.

Use at least three fresh repeats where feasible. Include a negative/control case;
record divergent results instead of selecting the nicest recording. Pausing, menus,
loading, media and focus changes can affect wall time. Label wall-clock seconds,
video frames and inferred game ticks separately. Human actions are not tick-exact.
An observation that cannot distinguish alternatives is `INCONCLUSIVE`, not PASS.

## OBS-01: timer and speed mapping

Question: how does a controlled mission timer relate to visible progress across
speed settings, pause and backgrounding?

1. Select a mission with a reproducible visible countdown/event; if unavailable,
   prepare a minimal timer diagnostic with a visible marker and no combat/AI.
2. Start fresh at one fixed speed. Record countdown changes and the marker through
   the same interval; repeat at a second speed. Record loading/media separately.
3. Repeat with a pause in the middle and once with a controlled focus change. Keep
   baseline runs free of these interruptions.
4. Report event ordering and countdown/wall-time intervals with uncertainty. This
   can constrain speed mapping; it cannot establish an exact internal tick rate from
   a display rounded to seconds. More precise claims need stronger instrumentation.

## OBS-02: repeat and shared attachment scope

Question: is a trigger condition consumed once, on each rising edge, or while true;
and is that state shared by multiple attachments?

1. Build an original diagnostic after confirming editor field framing. Give one
   controlled condition a harmless visible marker/counter. Record the chosen raw
   trigger/tag mode as metadata without trusting its translated label.
2. Drive false → true → held true → false → true, leaving long visible gaps.
   Count marker events and preserve their order. Repeat for each mode separately.
3. Use two labeled objects attached to the same tag. Activate them in A-then-B and
   B-then-A order; compare with distinct-tag controls. Avoid death/capture side effects
   until the basic event is understood.
4. Report counts per attachment and mode. A disappearing marker or overlapping
   sound is not proof of a single firing; choose a cumulative visible outcome.

## OBS-03: linked trigger ordering

Question: when A enables, disables or deletes B during evaluation, when can B act?

1. Prepare separate two-trigger diagnostics with distinct visible cumulative
   effects. Make both predicates eligible together; initially disable B only in the
   enable variant. Record all source IDs and table order.
2. Swap source order/IDs without changing logical conditions. Repeat each enable,
   disable and delete case from a fresh start. Add a no-link control.
3. Record which effects occur and their order; same video frame only establishes
   that the frame could not resolve the delay. Do not call that “same tick.”
4. If visual timing cannot separate candidates, choose consequences that differ
   observably (for example a later condition affected by B), or retain UNKNOWN.
   Cyclic chains require a separate bounded test; do not begin with an unbounded loop.

## OBS-04: ownership, team membership and script wait

Question: does a team preserve its script progress after member loss or ownership
change, and are RA2/YR differences observable?

1. Prepare a small team with identifiable members and a two-step route/wait/marker
   diagnostic. Establish a no-intervention baseline and a saved checkpoint during
   the wait. Record owner and member identities using visible labels/positions.
2. In separate runs, remove one member, change ownership through an available
   legitimate mechanic, and remove the current target. Do not combine interventions.
3. Observe destination/marker sequence, recruitment, waiting and final ownership.
   Compare with the baseline and a save/reload run around the same intervention.
4. Repeat only the mechanics available to that profile. Mind control, capture and
   owner-change trigger actions are distinct interventions; one cannot stand for all.

## OBS-05: native mid-event save and continuation

Question: which observable pending mission effects survive original save/reload?

1. Select a timer/reinforcement/script wait with a clear next visible outcome. Save
   shortly before the outcome; record approximate timing uncertainty.
2. Continue uninterrupted to the outcome. Reload that exact save and repeat the
   same documented inputs to the outcome, at least three times.
3. Compare event count/order, ownership/team behavior, objectives and outcome. Repeat
   around a just-fired one-shot trigger and a disabled linked trigger when possible.
4. Keep the native save private with its hash. Do not compare its binary bytes to
   WebRA2 saves; compare observables. Native save import remains best effort. WebRA2
   must separately prove its own exact checkpoint/replay equivalence.

## OBS-06: randomness and interruption controls

Question: is an observed random-looking outcome stable across the same native save,
and do unrelated actions change later outcomes?

1. Choose a bounded repeated outcome such as a scripted random branch when one is
   identified by the census. Record the starting save and complete visible inputs.
2. Repeat from the same save, then compare a fresh start. In a separate run add one
   controlled unrelated action and retain a no-action control.
3. Report the sequence of outcomes and whether differences repeat. Avoid using a
   chaotic battle as the first experiment: targeting/path changes confound sampling.
4. This can reveal a reproducible dependency but cannot identify the RNG recurrence,
   seed, number of streams or exact call order. Keep those UNKNOWN until stronger
   evidence is available. WebRA2 seeded repeatability is a separate test.

## OBS-07: profile and unsupported-semantics control

This recipe is primarily an agent-run WebRA2 preflight check when the compiler
exists; the owner is needed only to resolve an original content ambiguity.

1. Import a resolved RA2 mission under its profile and the corresponding YR fixture
   separately. Record effective rules and ordered content hashes.
2. Add an original synthetic row with a deliberately unsupported opcode and a
   malformed event width. Expect a source-located preflight error before any tick.
3. Alter profile/mod order without altering save bytes. Expect a content mismatch,
   not silent expansion defaults. This verifies WebRA2 policy, not original rejection
   behavior. Never run deliberately malformed data in the original just for parity.
