# Combat actor compiler provenance

The original compiler, helper and synthetic fixtures are GPL-3.0-or-later,
consistent with the project's accepted use of pinned GPL primary references and
existing entity/source-view/construction components. Shared distribution notice
mapping is coordinator-owned and remains required before merge.

Primary symbol references are YRpp commit
`61d0887eb6040cfb36af16d592e9770ceae4dfb2`:
[TechnoClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TechnoClass.h),
[TechnoTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TechnoTypeClass.h),
[HouseClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/HouseClass.h).
Headers identify symbols; constructor/load/runtime assignments require independent
pinned-image static evidence. They do not prove native gameplay by themselves.

Private research verifies Steam game.exe SHA-256
`73288c03b58d370be268ca6d156b4e33bfdb2066dc980359467d8852ff3b00df`
and gamemd.exe SHA-256
`3e81a61775d2745d1dabe397325ef663cd994ffc194da4e998e3bf5d2d308600`.
No original native programs are executed. Source rows, images, strings and assembly
listings stay in ignored `local/native139/`; public records contain factual metadata
only. The [native ledger](../../docs/analysis/combat-actors-native.json) records 45
inspected code ranges totaling 18,783 bytes, with profile, VA, file offset, size,
SHA-256 and interpretation. Each range was separately mapped through the pinned PE
sections and decoded to a complete instruction endpoint. Ranges are selected
evidence spans, not a claim that every full function or allocation path is covered.

| Scope | RA2 addresses | YR addresses |
| --- | --- | --- |
| InitialAmmo/Ammo current-default reads | `6DCCAE` | `71474C` |
| Object Immune / Techno TypeImmune reads | `5D7A1B` / `6DAFD2` | `5F94E7` / `712208` |
| SmudgeType Immune constructor override | `687DA0` | `6B5260` |
| Aircraft/building/infantry/unit initial ammo assignment | `413D5A`, `43F87D`, `4FF959`, `6FA5CC` | `41403A`, `442C81`, `517D69`, `735598` |
| TurretCount/WeaponCount/ClearAllWeapons conditional loading | `6DB614` | `71284A` |
| Comma/exact-house alliance mask parser | `46A720` | `475260` |
| MakeAlly / CanAlly initialization gate | `4E5660` / `4EC4E0` | `4F9B70` / `501540` |
| Fresh scenario initialization counter increment | `65EB40` | `686B20` |

The four actor initialization paths select InitialAmmo unless it is exactly -1,
then fall back to Ammo; each assignment stores the selected integer directly.
The Unit path's EDI=-1 setup is pinned separately. This is the starting selection,
not a proof of later reload, rearm or runtime consumption semantics. Immune defaults
are checked in ObjectType and the SmudgeType override; TypeImmune remains a distinct
TechnoType field, with its damage-filter behavior outside this component.

Fresh House construction clears the current alliance mask, distinct from the
separate starting/alternate mask. The campaign scenario reader raises the native
initialization counter before loading the mission's house list. Under that scope,
CanAlly admits a non-self/non-existing relation after the game-mode gate; MakeAlly
sets only the source house's target bit and skips the live diplomacy path. The
compiler therefore exposes directed initial pairs, not a symmetric alliance or
enemy matrix. The native tokenizer delimiter bytes were also inspected at RA2
`0x7CE9C0` (file offset 3,992,000) and YR `0x817F70` (4,292,464), one byte each,
SHA-256 `d03502c43d74a30b936740a9517dc4ea2b2ad7168caa0a774cefe793ce0b33e7`.
Unknown lookup results and indices outside the 32-bit mask can alias native shift
bits; the compiler explicitly marks these inputs unsupported instead of reproducing
that hazard or inferring hostility. Dynamic diplomacy and noncampaign modes need
separate evidence and policy.

Constructor/source staging, narrow scalar parser inputs and exact case reconstruction
reuse the independently reviewed [entity policy](ENTITY_DEFINITIONS_PROVENANCE.md)
and [source view](INI_SOURCE_PROVENANCE.md). Integer and boolean helpers come from
the GPL [weapon compiler](WEAPON_DEFINITIONS_PROVENANCE.md); canonical encoding is
original project code. No combat effect, full diplomacy, reload, dynamic turret,
elite, veterancy or complete modifier interpretation follows from these typed fields.
The unknown WeaponCount constructor value remains unsupported; it does not prevent
the separately evidenced ordinary branch when TurretCount is nonpositive.

The [component report](../../docs/combat-actors.md) records original synthetic cases,
private reproduction commands and independent raw-source comparison scope. The
[metadata census](../../docs/analysis/combat-actors-census.json) pins both selected
opening source sets, result fingerprints and independent projection digests. Static
disassembly and raw-source oracle agreement are distinct from original-game
observations; no such execution or full campaign acceptance is claimed here.
