# Browser PCM playback provenance

`src/browser-pcm-playback.ts` is original WebRA2 TypeScript, copyright 2026
WebRA2 contributors, distributed under GPL-3.0-or-later. The original fixtures in
`tests/browser/mission-audio-playback*` use the same license. No retail audio,
native executable code, or external playback implementation is included.

The component consumes the genuine same-realm output and owned-copy interface of
the [mission audio decoder](../formats/MISSION_AUDIO_DECODE_PROVENANCE.md).
That separately attributed decoder includes GPL XCC IMA arithmetic/tables; this
notice does not replace its provenance or corresponding-source obligations.

The Web Audio API is a platform interface, not a newly bundled dependency. API
behavior was checked against the fixed
[W3C Web Audio Recommendation of 17 June 2021](https://www.w3.org/TR/2021/REC-webaudio-20210617/),
especially `AudioContext.resume`, `suspend`, `close`, `AudioBuffer`, and buffer
content acquisition by `AudioBufferSourceNode.start`. User gesture admission uses
the browser's [user activation interface](https://html.spec.whatwg.org/multipage/interaction.html#tracking-user-activation).
No specification text or sample implementation is copied.

This is an explicit WebRA2 output policy. It establishes neither RA2/YR sample
selection, mixing priority, gain, looping, voice stealing, stream scheduling nor
mission opcode semantics. The [component report](../../docs/mission-audio-playback.md)
records API scope, resource accounting and separately labeled browser evidence.

Distribution must retain this notice, the decoder notice and applicable GPL
license text, and provide the corresponding source when distributing their
bundled code. No new dependency, root configuration or app bundle entry is added
by this component.
