# Typed team data foundation

[Issue #131](https://github.com/lictl/WebRA2/issues/131) adds a bounded data compiler
for subsequent team instantiation and script execution. The compiler does not spawn
units, schedule teams, run AI, or make a campaign playable.

`compileTeamDefinitions({ definitions, rules, ai, mission: { source, bytes } }, limits?)`
accepts genuine [entity definitions](entity-definitions.md), explicit rules and one
global AI source, and owned mission bytes. It rehashes the mission and reconstructs
its exact retained source view and construction joins. Rules/AI physical verification
remains the caller's source-session responsibility. `isTeamDefinitions` is a
same-realm factory brand; JSON copies do not pass it. The immutable result includes
source pins, policy `webra2-team-definitions-1`, ordered allocation/registration/load
records, field histories, opaque unsupported operands, diagnostics and a canonical
fingerprint. The existing folded RuntimeIni policy is unchanged.

The scoped native load order is global TeamTypes, mission TeamTypes, global
ScriptTypes, mission ScriptTypes, global TaskForces, mission TaskForces. Global AI
is read from AI.INI for RA2 and AIMD.INI for YR. Each list enumerates source order;
its numeric keys do not specify runtime indices. Each registration allocates or
finds a case-folded ID and immediately loads the section with the first allocated
spelling. Exact section/key spelling matters. Repeated consumed sections/keys are
rejected instead of guessing their native tie behavior. Named sections alone do
not load an implicitly referenced definition.

Team fields retain native constructor/current-value defaults and source histories.
A TeamType House field names a country/alias and selects its first matching house;
this differs from a placement's literal house owner. YR multiplayer selectors are
retained as explicit special values. Unknown country allocation and inherited
country state remain unsupported. Script/TaskForce references may allocate before
those lists are visited. The native TaskForce fallback occurs before Script fallback;
an empty TaskForce array returns from the team load first. Missing definitions and
partial loads remain visible.

Task forces probe literal keys 0–5 and scripts 0–49. Missing/empty slots are skipped;
present script slots compact into runtime sequence order. Task-force members with
an unresolved type do not advance the native member index, but the compiler retains
the attempted row. Type lookup prefers infantry, then vehicles, then aircraft.
Buildings are excluded. The compiler retains quantities without instantiating units;
negative or greater-than-65,535 quantities are outside its typed runtime capability.
Malformed native scanf inputs are unsupported rather than modeled as initialized
values. Integer parsing deliberately accepts a narrow whole-token subset.

Opcode operands currently typed are 3 (waypoint), 4 (legacy 128-stride packed cell),
5 (argument multiplied by 15 native frame units), and 6 (cursor set to argument − 2
before sequence advancement). These describe numeric operands only. Arrival,
completion, scheduling and native timing are unimplemented. Other opcodes retain
their integers with unsupported status. Two-letter team waypoints are decoded;
longer forms are conservatively unsupported. No map, AI, or trigger execution is
inferred from a successful data compilation.

All options lower fixed caps. Aggregate retained source text/occurrences, declarations,
work, field lookups, references, history copies, token pairs, diagnostics and serialized
bytes are bounded before expansion. Task-force quantities never drive allocation.
The canonical digest orders object keys and preserves arrays; all policy/source/history
metadata participates. Output freezing never modifies mutable caller byte buffers.

Original synthetic coverage exercises both profiles, native phases/defaults,
implicit/first-allocated references, exact-case redeclarations, numeric-slot gaps,
unknown fields/types/opcodes, country and house distinctions, immutable ownership,
source/profile checks and lower-only caps. Run:

```sh
node --import tsx --test tests/content/team-definitions.test.ts
npm run check
```

The native evidence and private comparison ledger are being completed before PR
readiness. This checkpoint does not claim a completed private retail gate. See
[component provenance](../packages/content/TEAM_DEFINITIONS_PROVENANCE.md).
