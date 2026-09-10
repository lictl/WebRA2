# Initial waypoint execution provenance

`src/initial-waypoints.ts`, its original fixtures, and the focused execution gates
in `src/team-activation.ts`, `packages/sim/src/team-runtime-program.ts` and
`packages/sim/src/team-recruitment-catalog.ts` are WebRA2 contributor work under
**GPL-3.0-or-later**. They compose the existing GPL content/simulation components.
No additional dependency or native code is adopted. Preserve this notice and
provide corresponding source when distributing this component.

This is a source execution boundary, not a complete reimplementation of native INI
parsing or all Scenario waypoint state. The source metadata and operand compilers
remain broad. See [the focused report](../../docs/initial-waypoints.md),
[typed team evidence](TEAM_DEFINITIONS_PROVENANCE.md),
[team runtime evidence](../sim/TEAM_RUNTIME_PROVENANCE.md),
[action operands](TEAM_ACTIVATION_PROVENANCE.md) and
[recruitment evidence](../sim/TEAM_RECRUITMENT_PROVENANCE.md).
The map diamond is the existing WebRA2 geometry guard, not a newly proven native
cell-validity test. Native reader cell flags and subsequent dynamic updates are
outside this component.

## Paired static evidence

The original files were read, never executed. Exact full-image SHA-256 pins and
file-offset/range hashes are in the
[27-row native ledger](../../docs/analysis/initial-waypoints-native.json).
It contains 23 selected code spans ending on complete decoded instructions and
four literal-data pins, totaling 1,742 bytes. Capstone 5.0.6 is a private inspection
tool only; no listings or native payloads are distributed.

| Path | RA2 selected address | YR selected address | Supported interpretation |
| --- | --- | --- | --- |
| Initial Scenario source reader | `663280..663349` | `68BDC0..68BE8F` | Reads canonical `%d` keys from exact `Waypoints`, inclusive indices 0–100 / 0–701. Missing/default or integer zero stores the invalid-cell value. |
| Stored Scenario cell accessor | `663180..663194` | `68BCC0..68BCD4` | Reads the indexed four-byte cell at the Scenario array. Operand decoding alone does not prove this cell was loaded. |
| Alphabetic decoder | `724A70..724AC5` | `763690..7636E5` | Both profiles can decode the first two alphabetic characters to 0–701. Existing metadata excludes longer strings; it remains unchanged. |
| Script 3 cell use | `6BAEE3..6BAF18` | `6EC859..6EC88E` | The script argument reaches the Scenario accessor, map-cell lookup and team-focus method. Arrival semantics remain the existing D03 team policy. |
| TeamType ordinary waypoint getter | `6BFA90..6BFAC9` | `6F18A0..6F18D9` | A field value of -1 returns the native invalid sentinel; otherwise the field indexes Scenario waypoints. |
| Team constructor waypoint focus | `6B76B6..6B76F7` | `6E8D1A..6E8D5B` | Uses that TeamType getter, compares the sentinel and initializes focus from the map cell when present. |
| Nearest recruitment anchor | `6B91C0..6B9254` | `6EAA90..6EAB24` | Starts from current focus and overrides it with the TeamType waypoint center when non-sentinel. The bounded source recruitment adapter still requires that explicit anchor. |
| Actions 7/80 | `6AECD4..6AED1F` | `6DEBAE..6DEBF9` | Existing dispatch supplies -1 or the explicit action waypoint to reinforcement. |
| Reinforcement waypoint selection | `639A35..639A76` | `65D9A9..65D9E6` | Explicit action value uses Scenario directly; -1 uses the TeamType getter. |
| Transport waypoint getter | `6BFAD0..6BFB09` | `6F18E0..6F1919` | A separate field uses the same array. Transport-origin execution is still gated by unsupported team behavior; it is not enabled here. |

The reader splits nonzero signed integers using signed division/remainder by 1000
and stores two 16-bit coordinates. Existing WebRA2 source metadata admits only
bounded unsigned decimal coordinates in its supported map diamond; this change
does not add wrapping, signed-coordinate, alternate integer syntax or full native
parser compatibility. Exact-case and retained-origin handling inherits the
[source view evidence](INI_SOURCE_PROVENANCE.md), while duplicate/suffix ambiguity
is conservatively rejected for execution.
