# Placed stationary mission policy provenance

SPDX-License-Identifier: GPL-3.0-or-later

The new stationary source/policy modules and original fixtures are WebRA2 work
licensed GPL-3.0-or-later. They compose the existing GPL team/source components;
they contain no retail bytes, disassembly or extracted mission rows.

This is an intermediate #247 source checkpoint. The paired native ledger, private
source census and serialized core witness are still in progress. It must not be
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

The new source catalog consumes only a genuine
`MissionTeamOwnedBinding`. Its source/model/house joins and complete upstream
graphs are inherited from that factory. The importer remains responsible for
the existing rules-table byte authentication boundary; matching pins alone do
not prove arbitrary caller tables came from those bytes. Original mission bytes
are owned and rehashed by the upstream factories.

The intended D03 policy will invalidate certification on actual command admission,
movement, combat or any team history, even when an actor later returns to rest.
It will preserve source Sleep and unresolved Unit/constructor/capture gates.
Native autonomous target acquisition and full MissionClass scheduling are outside
this bounded stationary certificate.
