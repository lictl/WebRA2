# Ordinary infantry source bridge provenance

`src/ordinary-infantry-bridge.ts` is original WebRA2 composition code under
GPL-3.0-or-later. It joins the existing licensed source compilers, deterministic
world, numerical combat, source firing programs and ordinary death policy. It
contains no game bytes, extracted artwork, native listings or third-party code.

The component inherits the distribution obligations of the components it imports:
[combat sources](COMBAT_CONTENT_PROVENANCE.md),
[initial source state](../content/COMBAT_INITIAL_RUNTIME_PROVENANCE.md),
[infantry firing](INFANTRY_FIRING_PROVENANCE.md),
[numerical stages](NATIVE_COMBAT_NUMBERS_PROVENANCE.md),
[ordinary death](ORDINARY_DEATH_PROVENANCE.md), and
[terrain traversal](../content/TERRAIN_TRAVERSAL_PROVENANCE.md).

The additional conditional animation interpretation comes from read-only static
inspection of the owner's local executables. Eleven complete instruction ranges
(2,632 bytes) and five bounded data ranges are pinned in a private metadata ledger.
The public specification records their addresses and interpretation in
[the bridge document](../../docs/ordinary-infantry-bridge.md). No retail program
was executed. The original tests use invented names, rules, map cells and TMP
bytes; none reproduce a retail mission or asset.

These observations are not a formal clean-room claim. The explicit WebRA2
standing-pose and logical-timing policy is separate from native frame fidelity.
