# Infantry firing scheduler provenance

`src/infantry-firing.ts` and its original synthetic tests are copyright 2026 WebRA2
contributors, licensed GPL-3.0-or-later. The implementation is original TypeScript.
It consumes an independently source-bound WebRA2 timing program and the existing
canonical fingerprint helper; no new dependency, native code or retail data is
included.

The pending/revalidation/rearm separation is informed by the inspected native
ranges in [the source report](../../docs/combat-initial-runtime.md). Mapping FireUp
to logical ticks and requiring a new update after ROF zero are the explicit D03
WebRA2 policy, not a reconstruction of the native animation timer or frame cadence.
The [scheduler contract](../../docs/infantry-firing.md) describes the caller-owned
world authorization, numerical/RNG transaction and save boundaries.
