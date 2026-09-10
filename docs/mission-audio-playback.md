# Bounded browser PCM output

Issue [216](https://github.com/lictl/WebRA2/issues/216) adds an output component for
genuine decoded PCM. `webra2-browser-pcm-playback-1` lives in
[browser-pcm-playback.ts](../packages/audio/src/browser-pcm-playback.ts). The
application, mission VM, source selector and worker protocol are unchanged. Sound
19/EVA 21 source policy remains a separate [219](https://github.com/lictl/WebRA2/issues/219)
investigation. This component grants no mission playback authority.

## API and identity

Construct `BrowserPcmPlayback({sessionId, profile}, lowerLimits?, environment?)`.
Session IDs are positive safe integers and must strictly increase on replacement;
the current profile is exactly `ra2` or `yr`. These are caller-owned source-session
joins. A profile label is not authenticated by decoded waveform bytes.

`register` accepts a bounded sample ID, exact current session/profile, genuine
same-realm `MissionAudioPcm`, and the expected encoded-byte, PCM-byte and full
decode/interpretation SHA256s. A JSON copy, proxy around the branded decoder result,
different hash or stale session is refused. The expected full decode hash also
binds sample rate, channels and decoder interpretation. Registration takes one
owned interleaved PCM16 copy through `copyMissionAudioPcm`. It projects only needed
scalar metadata and does not retain the branded result or its decoder-owned PCM.
The caller remains responsible for validating genuine source selection before
registration; no catalog or filename is inferred here.

`activate(sessionId)` must be called directly during a visible-page user gesture.
It creates the AudioContext only then, or resumes the existing paused context.
`play({sessionId,requestId,sampleId})` performs synchronous preflight and starts the
entire registered sample immediately. Requests are positive safe integers,
strictly greater than the last successfully started request in the session. A
refused request consumes no ID; there is no deferred queue. Unactivated, paused,
externally suspended, transitioning, unknown-sample and full-capacity requests
fail explicitly. Concurrent lifecycle transitions also fail immediately; callers
must report this failure and may always replace/dispose to cancel pending work.

`pause` suspends the AudioContext and retains each voice's buffer and existing
clock position; `activate` resumes those same sources without restarting them.
`setOutput` controls gain in the inclusive range 0–1 and mute. A transition mutes
immediately and unmutes only after the current successful activation. Failed
resume/suspend leaves output muted and playback blocked. A rejected suspension is
not a successful clock pause: telemetry separately reports actual context state.
`stop`, `stopAll` and `unregister` release explicitly selected component resources.
Unregistering a sample does not stop already playing copies.

`replaceSession` synchronously invalidates all old requests/callbacks, clears the
cache, stops/disconnects old voices, and cancels pending lifecycle promises. Its
returned promise reports native context close completion. New sample registration
is allowed for the replacement session while close is pending, but activation is
refused. Exactly one closing context is retained per component, including after a
close rejection. `retryClose` explicitly retries a failed close. No new context
can be created until closure succeeds. Repeated disposal is idempotent; it still
reports unresolved/failed closure. Late native completion and ended callbacks
cannot update a replacement session or release a replacement voice.

The host owns visibility/navigation handling: stop or dispose when the containing
session leaves, and pause on hidden when no lifecycle transition is pending.
If pause is refused during a pending transition, cancellation/disposal remains
available. Do not force hidden playback or use an audio clock to advance the
simulation. The optional environment is a trusted platform/test adapter, not
imported data or an authority callback.

## Bounded ownership

| Resource | Default hard admission cap per component |
| --- | --- |
| Registered samples | 32 |
| Owned interleaved PCM16 cache | 32 MiB |
| Active or paused voices | 8 |
| Active/paused AudioBuffer float sample storage | 32 MiB |
| Live or retiring AudioContexts | 1 |

Limits may only be lowered, including to zero. Cache checks precede the owned PCM
copy. Voice checks precede AudioBuffer allocation. One interleaved PCM16 scalar
becomes one float sample using `value / 32768`; channels are deinterleaved without
an additional temporary float buffer. There is no native gain/resampling claim;
the browser resamples to its output device as necessary.

These caps describe component-owned logical storage, not browser RSS or a hard
hostile-codec/process memory bound. The decoder's own earlier allocations and any
caller-retained PCM are outside this consumer's cache count. Browser acquisition
of AudioBuffer contents, render quantum state, mixers, device buffers, delayed
garbage collection and transient retiring copies are implementation-owned and
not measurable through this API. Active sample byte telemetry estimates float
channel storage as `scalarSamples * 4`; it does not multiply or pretend to measure
unknown internal copies. Stop/end releases component references promptly, while
native release may occur later. Closing resources remain counted until successful
closure. Multiple independently created consumers require an outer host budget.

## Validation

The [original fixtures](../tests/browser/mission-audio-playback.fixture.ts) and
[12 focused tests](../tests/browser/mission-audio-playback.test.ts) cover exact
stereo normalization, brands/three hash joins, profile/session separation,
descriptor snapshots, cache/voice boundary refusal before allocation, accepted-only
request IDs, allocation/start failure cleanup, pause/resume clock continuity,
gain/mute, delayed resume/suspend across replacement, close failure/retry,
late ended callbacks, unfulfilled activation cancellation, and partial context
creation cleanup. These controlled audio objects are synthetic evidence; they do
not establish native browser or speaker behavior.

Run `node --import tsx --test tests/browser/mission-audio-playback.test.ts`, then
`npm run check`, using the repository Node 24 toolchain. Actual Chrome acceptance
will use an immutable code-only private harness with original generated tones.
It remains pending at this source checkpoint. No retail sample, audio recording or
game screenshot is included in this report. Other browser families are deferred
to the owner's final E2E gate under D17. No campaign cinematic, native selector,
physical speaker audibility or mission-complete claim follows from this output
component. See the [provenance notice](../packages/audio/PROVENANCE.md).
