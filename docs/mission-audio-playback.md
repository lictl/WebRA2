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
`npm run check`, using Node24.20.0. The resumed source merges reviewed main
28ed58273164ad8556c378b5d9b75da9f8645d5e at
`cebf07194188cd258dc91b3c84de4fece551bd0d`. All five original author files remain
byte-identical to checkpoint0c5a436301a170558ab1139b828c38dccba00001 before this
report update; decoder inputs and lockfile are unchanged. `npm ci` and the full
composed check pass:1,283 public tests,5 baseline-tool tests,9 GPU-tool tests,
types,198 documents/1,007 links,716 publication paths, M0 and77 existing app
outputs/145 inputs. These counts describe source/component checks, not campaigns.

## Actual Chrome output and lifecycle

The original-only private harness at `local/harness216` was frozen under
`local/pcm216/final-1` and served on loopback4210. Its source revision is the merged
checkpoint above; no component code changed after browser validation. Minified
ES2022 output uses locked esbuild0.28.2, product CSP including `connect-src 'none'`,
and no cross-origin isolation. The69 code/license files include the broader
existing notices plus this consumer’s provenance. All69 disk/HTTP digests and
7 bundled source inputs match the manifest; six asset/query/upload/foreign-origin
requests fail. The helper serves no source installation or general directory.
Existing frozen servers are preserved. Private build recipe and original harness
sources are retained with the evidence for independent reproduction.

The manifest SHA256 is
`7b4386afc8a370994585217faa3e48e94ac61987a69bd08563960b75d9c85e69`.
Chrome reports152.0.0.0 in its captured user-agent string. The genuine decoder
consumes an original20-second stereo PCM16 tone:22,050Hz,441,000 frames,
1,764,000 cached bytes. Encoded/PCM hash is
`fd29856141041657aa732e515eb83c43cad0d6f717e7ff5d20533962cd6abd88`;
full decode hash is
`fa6db38329215e6abed913a224fd4078479d1ee2550a9bb1734de2f2a45b5a9a`.
Both profile labels use the same original waveform; they do not prove native
RA2/YR sample selection. An analyser connected to the component gain provides an
observation branch; it is not a microphone or speaker recording.

| Observed action | Native result |
| --- | --- |
| Automatic activation and Play before activation | Explicit refusal, zero AudioContexts and unchanged request cursor |
| User activation and Play | Running context, one voice,3,528,000 estimated float bytes, nonzero analyser peak about0.022866 at gain0.2 |
| Pause and later observation | Clock remains7.029333seconds over14.223seconds wall time; identical request/source start and retained voice buffer |
| Resume | Same source start0.272seconds; clock advances, output returns, no replacement context |
| Gain/mute | Native gain0.1/0.2 and zero while muted; analyser reaches zero while a voice remains active |
| Two voices then a third request | Two voices/7,056,000 float bytes; third refused, last accepted ID remains3 |
| Stop while paused then replay request | Voice references drop to zero; previously refused ID4 is accepted after resume |
| External native suspend | Context suspended; new Play refused until activation resumes it |
| RA2→YR replacement and stale input | Old context closes; immediate retirement counted, old ID refused, new session needs activation and starts request ID1 |
| Natural end / explicit disposal | Ended voices disappear; disposal closes context and clears cache, voices and retirement count |
| Reload / restart | New unactivated component creates no context; fresh activation/play produces output, then disposal releases it |

The analyser’s last block can remain visible after suspension or closure; a stale
peak alone is not evidence of continued sound. Clock/state/gain/voice observations
are interpreted together. Native resume/suspend/close rejection and delayed stale
callbacks remain controlled-fixture cases, not artificially induced browser failures.

A separate **native-only** visibility check resolves an instrumentation difference.
While the debugger was attached, selecting another native tab still left this
page reporting `visible`; that observation is preserved. After stopping debugger
instrumentation through Chrome’s existing infobar and reloading with native UI,
activation/Play followed by a native tab switch suspended the context at8.138667
seconds and set gain0. Returning did not resume it automatically. Explicit
activation resumed the same voice (original start0.224seconds), followed by
nonzero analyser output and successful Stop/disposal. No browser setting was
changed and no hidden execution was forced. This is host visibility handling
using the component’s pause seam, not simulation or native game audio policy.

Private evidence identities:

| Artifact | Scope | SHA256 |
| --- | --- | --- |
| `chrome-lifecycle.json` | 39 original lifecycle observations | `b660538fb43e0f037fb44c892226f6d07409a25d8be73f6ceeb6f1fa0a17a0d0` |
| `native-hidden-resume.json` | 9 native-only observations | `5214fd6d2348e97501e6690a78cb4254b39ee1b9d812a740c904c3eb909399c8` |
| `restart.json` | Fresh load, active output and disposal | `08903c366cbfc17f30e39b702fc0a832f22fc2683f0f4dcdca1e471930b9c2d4` |

The private audit rechecks request/cap/clock/voice joins, all output/input hashes
and route refusals. Downloaded facts contain only the generated fixture and
metadata. Physical speaker audibility, native sample/mixing/loop/priority policy,
retail playback, campaign cinematics and a playable mission are not claimed.
Other browser families remain deferred under D17. Source sound/EVA policy and
mission dispatch must supply genuine playback requests in later integration;
see [issue219](https://github.com/lictl/WebRA2/issues/219) and
[issue220](https://github.com/lictl/WebRA2/issues/220). No application, simulation,
model/save identity or worker protocol changed in this component. The
[provenance notice](../packages/audio/PROVENANCE.md) remains applicable.
