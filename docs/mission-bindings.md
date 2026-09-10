# Initial mission tag bindings

This component authenticates initial binding candidates from genuine world and entity
factories and a fresh hash-checked mission read. It does not start a mission or
supply global/local flag defaults. Both original openings still fail the existing
whole-program interpreter preflight.

`compileMissionBindings({world, definitions, rules, mission, difficulty})` retains
all source trigger, tag, object and cell identities. A runtime tag is shared by
its object/cell attachments and initial map, scenario-poll and house list
memberships. Its `initialReferenceCount` counts object and cell references only;
`dispatchAttachmentIds` are separate VM membership identifiers. List membership
does not add native `InstanceCount`. Candidate counts are not proof that every
native object constructor or placement succeeds.

`prepareMissionBindings(catalog)` requires the same-realm genuine catalog and
preflights the complete mission through the existing interpreter. Unknown records,
flags, references, repeated consumed sections, unsupported encodings or interpreter
operations leave `authority` null. Disabled and difficulty-excluded rows remain in
that closure. One admitted binding represents one allocated source tag; shared
attachments do not create independent trigger latches. Trigger instances reverse
the source head-to-tail attached chain. Unattached triggers do not invent a global
binding.

The native startup lists and source references are factual classifications, not a
new physical event dispatcher. The existing VM uses its explicit WebRA2 tick and
poll order. Initial flag state, compound world/VM lifecycle, physical event
observations, team/effect transactions and dynamic attachment changes remain
coordinator integration work. Catalog `initialHouseListId` is specifically the
startup country-to-house list lookup; it does not certify later native owner
operands, ParentCountry routing or victory bookkeeping.

The source policy supports fresh NewINIFormat4 maps, ASCII identifiers up to24
bytes, names up to48 bytes and exact consumed section spelling. Source ID/name
lookup uses the first declaration whose ID or name matches without ASCII case;
cell references use IDs only. It retains source origins and rows rather than
silently truncating them. Repeated exact sections, invalid coordinates and implicit
undeclared types retain unsupported diagnostics. Construction and exact-source
view limitations still apply; physical rules authentication is upstream of the
genuine world factory.

Limits bound mission bytes, source parsing, retained actors/cells/declarations,
references, chain expansion, diagnostics, additional join work and canonical output.
Factory inputs and mission bytes are owned before asynchronous preflight. Fresh
source joins, difficulty and policy are fingerprinted. Existing source compilers
also retain their own independent hard caps.

Validation uses original miniature maps in `tests/sim/mission-bindings-fixture.ts`.
The focused test covers shared references, chain order, allocation versus enablement,
country selectors, ID/name differences, source copies/mutations, limits and
once/repeat execution with every-tick restore. Private source/native comparison
results will be appended before final review. No original campaign acceptance is
claimed by these synthetic fixtures.
