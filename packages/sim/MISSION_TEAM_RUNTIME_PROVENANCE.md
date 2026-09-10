# Common mission team transaction provenance

`src/mission-team-context.ts`, `src/mission-team-runtime.ts`,
`src/mission-team-selection.ts` and `src/mission-team-values.ts` are original
WebRA2 TypeScript, licensed GPL-3.0-or-later. The corresponding original synthetic
fixtures/tests use the same license. No retail data, executable code or extracted
listing is included.

The implementation consumes the genuine source factories documented in
[mission team action provenance](MISSION_TEAM_ACTION_PROVENANCE.md),
[reinforcement provenance](TEAM_SPAWN_PROVENANCE.md),
[recruitment provenance](TEAM_RECRUITMENT_PROVENANCE.md),
[script provenance](TEAM_RUNTIME_PROVENANCE.md),
[Sleep provenance](TEAM_SLEEP_PROVENANCE.md) and
[destination planning provenance](TEAM_DESTINATIONS_PROVENANCE.md).
It applies their documented source/constructor/selector policies to one shared
context. It does not infer fresh recruitment eligibility for constructed actors.

The complete-program union, authenticated roster migration and genuine world-step
receipt helpers in existing team modules are coordinator-authored integration work.
They retain their existing component notices. The new runtime composes those
helpers, rather than invoking separate reinforcement/recruitment schedulers.

The transaction order, next-tick effect admission, global history/ID scheme,
structural save format and aggregate limits are explicit WebRA2 policies under
D03. They are not claims of native instruction/frame timing equivalence. Source
proofs are reused from the pinned components above; this slice adds no native
machine-code interpretation. Current scope rejects combat and infantry-slot worlds.
Full original mission authority and browser presentation remain separate gates.

Distribute this notice and the GPL-3.0-or-later license with these modules and
provide the corresponding WebRA2 source. Any later distribution integration must
copy the notice byte-for-byte and retain the dependent component notices.
