# Persistent team Sleep provenance

The original `src/team-sleep-policy.ts` and focused synthetic fixtures/tests are
GPL-3.0-or-later. Preserve this notice, GPL text and corresponding source when
distributing the composed runtime. Original game content is not included.

The source semantics were investigated using both pinned executable images without
execution. [The range ledger](../../docs/analysis/team-sleep-native.json) records
30 code/data spans, 2074 bytes, image hashes, PE file offsets and complete instruction
endpoints checked with Capstone 5.0.6. The primary layout references are
[YRpp TeamClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TeamClass.h),
[MissionClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/MissionClass.h),
[TechnoClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TechnoClass.h)
and [GeneralDefinitions](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/GeneralDefinitions.h).
Header labels are corroborated by the following native assignments/calls.

| Path | RA2 | YR | Observed interpretation |
| --- | --- | --- | --- |
| Script dispatch | `6B8179` | `6E9812` | Opcode 11 passes its frame to the mission handler |
| Full mission handler | `6BBBB0..6BBE53` | `6ED7E0..6EDA8F` | Conditionally regroups eligible members, clears focus/target/destination and queues the integer mission; never writes StepCompleted |
| QueueMission | `594CB0..594D15` | `5B35E0..5B3645` | Writes a queued mission, with separate optional immediate promotion |
| NextMission | `594C50..594CAC` | `5B3570..5B35D2` | Promotes the queued mission and resets status/timers |
| Sleep implementation | `594570..594576` | `5B2E10..5B2E16` | Ordinary infantry/unit vtable target returns 450 without further work |

Ranges end exclusively. Source mission zero is Sleep; other operands remain
unsupported. The shared team dispatcher advances only after StepCompleted. Sleep
therefore holds its source cursor indefinitely rather than advancing a later line.
The handler also has native Stray/RelaxedStray, readiness and regrouping behavior;
these are not reproduced by the bounded component.

`webra2-team-sleep-stationary-1` is explicit WebRA2 policy: stop living members at
the authoritative entry tick, preserve their stationary state and source cursor,
and retain member loss. It uses no RNG. Native mission queue phase, actor AI,
retaliation/acquisition, regroup cadence and full actor mission behavior are not
claimed. The initial integration is movement-only; a combat consumer must explicitly
honor the Sleep capability before composition. See [the report](../../docs/team-sleep.md).
