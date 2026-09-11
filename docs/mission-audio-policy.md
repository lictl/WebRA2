# Mission sound and EVA source policy

[Issue #219](https://github.com/lictl/WebRA2/issues/219) supplies the typed source
policy needed by [mission dispatch #220](https://github.com/lictl/WebRA2/issues/220).
`compileMissionAudioPolicy` accepts genuine cue/audio catalogs and the explicit
`fresh-process-audio-load` initialization policy. It produces a branded immutable
catalog, exact source identities, per-occurrence readiness, retained histories,
ordered sample alternatives, caller overrides and required runtime state.
It does not choose a sample, modify simulation RNG or start audio.

## Source behavior

| Input | Retained interpretation |
| --- | --- |
| Sound action 19 | Global request, panning 8192, volume 1 and no existing controller |
| Sound defaults | Image values followed by supported Defaults and definition reads; named Priority fallback remains NORMAL |
| Control / Type | Ordered whitespace tokens; OR control flags and the native exclusive Type masks |
| Attack / body / decay | Preserve repeated candidate IDs, source partitions and ALL-before-RANDOM selection rule |
| Loop / delay / shifts | Preserve configured values and distinguish fixed endpoints from runtime RNG requirements |
| EVA action 21 | Source side stem/sample, definition priority, stored Type/Volume, fixed request Type 2 and priority override -1 |
| Theme action 20 | Retained as unsupported by this policy |

Volume/MinVolume histories distinguish a Defaults global dword store from a named
reader value. Percentage values use the existing reviewed numeric policy; they are
not assumed to be a final browser gain. VShift remains the configured value before
the native clamp. Unknown controls, numeric boundaries outside the supported
reader, invalid partitions/ranges, unknown fields, missing samples and unsupported
references remain visible with per-occurrence reasons. Later explicit fields do
not erase an earlier unsupported source history.

EVA Text and Defaults are preserved without claiming their playback consumption.
The current side, device availability, suppression, active EVA identity, priority
queues, stream clock and postclip delay are required runtime context. Stored EVA
Volume consumption is still unproved. Sound requires controller/channel limits,
interrupt state, category volume/panning and an audio clock. Random sound choices
use the native global audio generator, distinct from Scenario RNG. No generated
random value is added to a mission save by source preparation.

The immutable catalog exposes `runtimeAuthority`, `nativeExecutionVerified`,
`playbackReady` and `canStartCampaign` as false. `supported-source` means that this
source record has a supported interpretation, not that a mission may play it.
The [PCM output component](mission-audio-playback.md) is a separate consumer.

## Ownership and limits

Factory identity binds the cue and verified audio catalogs in the same realm;
spread/JSON copies cannot acquire that identity. Input records and option values
are captured from data descriptors. Preparation retains genuine immutable catalog
references and freezes its result; it exposes no mutable waveform buffers.
The SHA256 includes source identities, initialization and every interpreted or
retained policy field.

Default caps are 8,192 bindings, 262,144 fields/tokens/diagnostics, 524,288 history
entries, 131,072 sample references, 2,097,152 work units, 16 MiB counted characters
and 32 MiB serialized output. Caller options may only lower these limits. Global
field/sample/string counting precedes repeated typed expansion. These are logical
component budgets, not a measured process RSS ceiling.

## Evidence

The source checkpoint `6e1e730` was preserved during the owner's performance priority.
It is now composed with reviewed main `c265e01`; its policy implementation and ten
original tests are unchanged. The remaining paired prefix evidence, independent
oracle and distribution documentation complete that source-policy checkpoint.

The [native ledger](analysis/mission-audio-policy-native.json) contains 68 factual
records / 58 instruction spans, 17,151 bytes and 186 structural/data checks across both
pinned images. It includes loader/setter/consumer branches, process initialization,
PE zero-fill, numeric startup and the EBX-zero state-machine prefix. These are
static observations; neither image was executed. The
[provenance notice](../packages/content/MISSION_AUDIO_POLICY_PROVENANCE.md) records
primary leads, reuse boundaries and what each evidence family supports.

A fresh on-device 438-file preparation is checked by a separately written Python
raw source oracle. It rehashes seven source roots, reparses mission instructions
and selected INIs, verifies source fields/sample references, and compares typed
values, origins, histories, partitions, callers, required runtime state and
readiness. Its numeric checks use binary packing and exact rational arithmetic,
not the TypeScript numeric helper. There are 9,887 combined comparisons, including
1,638 typed controls and 4,032 history entries. The raw-reference portion contributes
6,143 comparisons; these counts are assertions, not independent native behaviors.

| Profile / source side | Occurrences | Supported source | Unsupported |
| --- | ---: | ---: | ---: |
| RA2 /0 | 57 | 57 | 0 |
| RA2 /1 | 57 | 57 | 0 |
| YR /0 | 24 | 24 | 0 |
| YR /1 | 24 | 24 | 0 |
| YR /2 | 24 | 15 | 9 |

The nine YR side 2 missing-stem references remain unsupported. Profile sides are
explicit source-preparation inputs, not proof of the local player's house.
[Aggregate census](analysis/mission-audio-policy-census.json) contains only counts
and identities. Retail bytes, field contents, samples and native listings remain
in ignored `local/`.

Ten original synthetic tests cover both profiles, defaults and caller distinctions,
ordered alternatives, unknown/invalid controls, genuine brands/descriptor handling,
aggregate lower limits, retained unsupported/theme occurrences, equal-endpoint RNG
requirements, and positive/negative percentage stores with halfway rejection.
They test source preparation, not queues, playback or full-mission execution.

Reproduce with Node 24.20.0:

```sh
node --import tsx --test tests/content/mission-audio-policy.test.ts
npm run check
# Private source gates, from the preserved mission-audio-policy worktree:
node --import tsx local/probe219.mjs
python3 local/oracle-policy219.py
# Native ledger uses the existing Capstone 5.0.6 environment and writes ignored local.
```

The composed full check passed 1,293 public tests, 14 tool tests, type checking,
201 Markdown files / 1,028 local links, publication-path checks and M0 metadata
consistency. The build contains 78 code/license files from 145 approved inputs.
These public tests use original fixtures; the private corpus is reported separately.
Final independent review must cover the merged revision. The follow-up is source-authorized VM request batches and saved cursors
in #220, then browser source selection/queue/output integration. First-playable
[parent #230](https://github.com/lictl/WebRA2/issues/230) still requires all remaining
mission runtime families and actual Chrome victory/defeat/save acceptance.
