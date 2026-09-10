# Group destination planner provenance

[team-runtime-destinations.ts](src/team-runtime-destinations.ts) is original
WebRA2 code, Copyright 2026 WebRA2 contributors, GPL-3.0-or-later. It defines a
bounded deterministic WebRA2 policy using the existing MIT navigation and world
components. It adopts no new external implementation, native tables or dependency.
The [component report](../../docs/team-destinations.md) distinguishes this policy
from original formations and defines its incomplete congestion guarantees.

Distributions containing this module must retain this notice, the
[GPL license](../../LICENSES/GPL-3.0-or-later.txt), copyright notices and applicable
corresponding source under [the distribution policy](../../docs/licensing.md).
Synthetic tests contain original worlds and commands, with no retail payloads.
