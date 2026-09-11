# Placed stationary mission policy provenance

SPDX-License-Identifier: GPL-3.0-or-later

The new stationary source/policy modules and original fixtures are WebRA2 work
licensed GPL-3.0-or-later. They compose the existing GPL team/source components;
they contain no retail bytes, disassembly or extracted mission rows.

This #247 component includes a paired native ledger, private source census and
serialized core witness. The optional root runtime integration and independent
review remain. It must not be
used to admit a mission or to replace the current ownership/recruitment gate yet.

Static observations on the pinned RA2/YR images distinguish the current mission
from the queued mission. The effective selector returns current unless it is -1
(RA2 `594770..594782`, YR `5B3040..5B3052`). QueueMission is a separate operation
(RA2 `594CB0..594D15`, YR `5B35E0..5B3645`); its immediate-start request still calls
the actor's CanStart gate before NextMission. Infantry idle has a Guard/AreaGuard
preservation branch and separate Zombie/Paralyzed checks. YR ownership explicitly
queues Guard; the RA2 owner routine instead reaches the family idle callback.
These are conditional control-flow observations, not proof that a motionless
world entity has any particular current or queued native mission.

The [native ledger](../../docs/analysis/mission-stationary-native.json) records
66 spans/pointers/literals totaling 11,876 bytes, including 36 complete functions.
The full image pins are RA2 `game.exe`
`73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`
and YR `gamemd.exe`
`3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.
The private verifier checks instruction boundaries, concrete vtable targets,
mission-name indices and selected consumer calls (112 assertions). Existing
[allocation evidence](../../docs/mission-team-allocation-source.md) supplies the
fresh campaign mode distinction; the native placed-row branch is pinned here.
The [census](../../docs/analysis/mission-stationary-census.json) records the separate
109,522-value raw-source comparison over five complete archive roots/eight members.
These are author reproducibility checks, not independent review or retail execution.

The new source catalog consumes only a genuine
`MissionTeamOwnedBinding`. Its source/model/house joins and complete upstream
graphs are inherited from that factory. The importer remains responsible for
the existing rules-table byte authentication boundary; matching pins alone do
not prove arbitrary caller tables came from those bytes. Original mission bytes
are owned and rehashed by the upstream factories.

The explicit D03 policy invalidates certification on actual command admission,
movement, combat or any team history, even when an actor later returns to rest.
It preserves source Sleep and unresolved Unit/constructor/capture gates.
Native autonomous target acquisition and full MissionClass scheduling are outside
this bounded stationary certificate.
