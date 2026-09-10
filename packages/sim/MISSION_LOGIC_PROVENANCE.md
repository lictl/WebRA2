# Mission trigger runtime provenance

Scope: the original implementation and original synthetic fixtures for
[issue #91](https://github.com/lictl/WebRA2/issues/91),
[`mission-logic.ts`](src/mission-logic.ts) and its
[runtime specification](../../docs/mission-logic-runtime.md).

## License and source boundary

New runtime code and fixtures: **GPL-3.0-or-later**, copyright 2026 WebRA2 contributors.
The existing integer canonical encoding/validation helpers are original MIT code;
the scenario compiler is original GPL-3.0-or-later. No new dependency is adopted.
No native executable implementation, machine code, extracted mission row, header
implementation body or proprietary asset is distributed by this change. Native
analysis is factual evidence and is not presented as licensed source reuse or a
formal clean-room process. The coordinator owns shared distribution/license mapping.

The EA editor sources used by the existing compiler are pinned to
`6abf0f557469baea73079c6bf6550709e2e3584e`, copyright 1999–2024 Electronic Arts,
authored by Matthias Wagner, GPL-3.0-or-later as recorded in the
[compiler provenance](../../docs/scenario-logic.md). Its
[action framing](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/TriggerActionsDlg.cpp)
and [event framing](https://github.com/electronicarts/CNC_TS_and_RA2_Mission_Editor/blob/6abf0f557469baea73079c6bf6550709e2e3584e/MissionEditor/TriggerEventsDlg.cpp)
are storage evidence, not proof of trigger execution.

YRpp is pinned to `61d0887eb6040cfb36af16d592e9770ceae4dfb2`:

- [TEventClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TEventClass.h),
  [TActionClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TActionClass.h): addresses and field-offset leads.
- [TriggerClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TriggerClass.h),
  [TriggerTypeClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TriggerTypeClass.h),
  [TagClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TagClass.h),
  [TagTypeClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TagTypeClass.h): instance/list/control investigation leads.
- [GeneralDefinitions](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/GeneralDefinitions.h)
  and [ScenarioClass](https://github.com/Ares-Developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/ScenarioClass.h): opcode names and flag/timer structure leads.

These header bodies are not adopted or vendored. Address/type facts were checked
against the actual pinned executable rather than assuming every header address was
correct. In particular, this executable's event loader is `0x71f4e0`, called by
TriggerType loading; the header's `0x71f4a0` lies in preceding table data here.
Static strings, editor labels and wrapper names alone do not establish semantics.

## Pinned native observations

The supplied Steam `gamemd.exe` is 5,286,208 bytes with SHA-256
`3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.
All virtual addresses below refer to this exact image; historical patch labels are
unverified. PE section headers map virtual addresses to file offsets. A private
Capstone 5.0.6 disassembly (private Python 3.14.7 environment) was read alongside the raw bytes; no original executable was
run. Full listings stay ignored. The table contains factual range/hash metadata,
with end addresses exclusive; some ranges are selected function segments or data
tables, not complete function boundaries.

| Virtual-address range | File offset | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `0071f4e0–0071f5b0` | 3273952 | 208 | `9a513562297227070ba35a3f72202ada72e17683389392edb90d099d665d0a8e` |
| `0071e940–0071f2c0` | 3270976 | 2432 | `008b98d4ad35546c567d521e441017301c4bafd2d7f6af03e7b648b167f6845e` |
| `0071f950–0071fa30` | 3275088 | 224 | `aee71017360fd25ec790871bb94459bf9f63c63ba7898d30146cf56d048100f6` |
| `007263a0–00726630` | 3302304 | 656 | `8f6057e1fd0dd887e4ab57201b7572f8bb58cefb09422ff6bb719c08b9cee355` |
| `00727374–007275a5` | 3306356 | 561 | `53cf4c4a711d4f43fb2fd1c2bfe46b04ae4be5d84c15bc910d604f2f415df45b` |
| `00725fa0–00726131` | 3301280 | 401 | `7f657616b161fb7606fb1857a6dc7fb766c86e9e1973f8c8974cfd3ebfb30b0e` |
| `006e2af0–006e2bb0` | 3025648 | 192 | `397b2330e5e61c97585d9138d73cfc813ec4eedaad34e8e10eee4e9f0316318f` |
| `007268f0–00726904` | 3303664 | 20 | `e16860fd8254c8bacbe2cddfaa1950e3c0d31fe83f8ff5888c8518cb41afc654` |
| `006e4f19–006e4f5a` | 3034905 | 65 | `0b0d731f9624fde0bce4d8984da5b7e642edffcc0993d3ee9531da3fedab449b` |
| `006e53a0–006e54f4` | 3036064 | 340 | `b8671cfb5f9d3be8b49885ec3d94f1f0813b2b3c1294894102e28ac46c2932db` |
| `00689670–006896b6` | 2659952 | 70 | `1ff1b0c9314584deccd6a103835e1793b9d410db227936a418e6e47c5673e8ab` |
| `00689760–00689787` | 2660192 | 39 | `eb413a4fe09cef87e957e5e8b41353b5c0294d58040db543f2afebd35658b877` |
| `00689910–00689956` | 2660624 | 70 | `3f13ce96cbfe7ac4d3aee41f74fd4a14f618b39ff10c928308397524802fb130` |
| `00689a00–00689a27` | 2660864 | 39 | `90e6e5251c8c7371cc5786b242fe97c25742dfd03f5b8f73dbf8e2daaca30776` |
| `00727010–00727081` | 3305488 | 113 | `26f01791bb61d0fd8cf90d6323c1d65f84d56340ca4191568d77f7e308057bd7` |
| `006e57f0–006e5850` | 3037168 | 96 | `8a2052088930d1c9b91109ec6ac53ce96967288b5073fc00f9f789602ab8008a` |
| `006de418–006de61e` | 3007512 | 518 | `04ed69e0eaafbd2470932532c462a9a7be71ebed47b62ff4b243dfa23c285a88` |
| `0046b640–0046b654` | 439872 | 20 | `189ba5f9f58a4f910b48d6540fc54937bbefa50606d5d0576f506c073372de3b` |
| `006dd5b0–006dd87d` | 3003824 | 717 | `4c10f8e7bb69e52af2e0405b71fe405d3b46d9f09ecd5497bf567386b0a03806` |
| `006dfdec–006e0030` | 3014124 | 580 | `64c723a957c580410200329073f80e0c9ff5e0d4a658a3774ca60b91c9e72040` |
| `006dea37–006dea97` | 3009079 | 96 | `21c0a3f6910a101c6c898469e2f7ad018c085cc0025e1faf071b8f7a9763d345` |
| `006de2ce–006de316` | 3007182 | 72 | `bde2d171d02c2a2213ae4980eb9396e7e9dc6502bd704b608c56a2b26b2903f5` |
| `006df137–006df221` | 3010871 | 234 | `7355b763bfdbf4cf2b018ccad87d67be752f58dbeef532d766d934231fe93e7a` |

The checked relationships are deliberately narrow:

- Event load mode 0 stores the integer argument; mode 2 has an extra type-name token.
  The event dispatch tables direct 13/14 to timer tests, 27/28 and 36/37 to the
  global/local readers, and 47 to frame-counter division by 15. Event 0 is false;
  8 follows the unconditional path. The selected events fail the first persistent
  latch-state gate. Native event-bit accumulation is not generalized to other IDs.
- Trigger load inverts the disabled field, reads three difficulty flags and the
  transfer tail, prepends events and appends actions. Trigger construction resets
  its shared timer and gates initial enablement on the selected difficulty.
  ResetTimers multiplies elapsed operands by 15, overwriting the shared timer while
  traversing the reversed event list. RegisterEvent requires all conditions and
  resets timers for successful repeating evaluation before FireActions.
- FireActions iterates the source-ordered action list after its entry enable/deletion
  check. Tag construction prepends linked trigger instances. RaiseEvent handles mode
  2 by firing repeatedly; mode 0 destroys fired instances and schedules tag removal
  after traversal. Mode 1 inspects attachment instance count and is unsupported.
- Action load mode 0 selects its integer field; mode 2 resolves a named trigger, with
  a separate short numeric-index path. Dispatch slots 23–29, 53/54 and 56/57 reach
  the documented timer/flag/enable paths. Timer constructors start at the current
  frame, including set/extend/shorten; shortening clamps to zero. The flag setters
  check array bounds and notify tags only if the value changes. Matching flag
  predicates lead to timer resets. Enable checks difficulty and resets timing;
  disable only clears enablement.
- Outcome action 1/2 reads the country-index field and interacts with the player
  house. That is sufficient for a typed request, not full victory/defeat semantics.
  The interpreter does not resolve that request or end the scenario.

Source arguments named above use strict bounded WebRA2 parsing; native malformed
`atoi` coercions, negative/overflow timer behavior and ignored out-of-range flags
are outside the supported subset. The runtime documentation distinguishes these
local observations from WebRA2's polling cadence, cross-tag order, binding creation
and save policy. These observations are YR-specific static evidence. Matching RA2
operand layouts in the supplied map and passing synthetic tests do not prove RA2
native execution equivalence or a complete campaign.

For independent reproduction, verify the complete executable hash, parse its PE
sections, hash the selected file ranges, then inspect the dispatch/load/control
paths. Private helpers `local/native.py`, `local/native-reviewed-ranges.json`,
`local/dispatch.json` and pinned header copies are retained in the mission-logic
worktree. The helper uses the existing private Capstone environment; it executes
only the research Python process. Copy scripts into an isolated reviewer checkout
and keep all raw outputs under ignored `local/`. A missing executable is a skipped
private evidence gate. Owner observations can later distinguish native poll order,
attachment lifecycle and occurrence-event latch behavior.

## Trigger lifecycle extension

[Issue182](https://github.com/lictl/WebRA2/issues/182) adds original GPL-3.0-or-later
forcing/deletion VM code and original tests, with no dependency or license change.
The [lifecycle report](../../docs/mission-trigger-lifecycle.md) and
[paired ledger](../../docs/analysis/mission-lifecycle-native.json) distinguish common
FireActions entry/ordering from RA2 immediate destructor and YR deferred destruction.
The34 selected ranges/3796 bytes have complete instruction endpoints; the YR
constructor now includes the complete return through726133. That ledger supersedes
the older truncated726131 constructor endpoint for this investigation. Source
attachment/host cleanup is not claimed by the logical D03 tombstone policy.
All raw bytes, listings and private source projections remain ignored.
