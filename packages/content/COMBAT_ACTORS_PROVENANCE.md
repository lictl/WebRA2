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
listings stay in ignored `local/native139/`; only reviewed factual metadata will
be published. Range-ledger and independent comparison validation are still in progress.

| Scope | RA2 addresses | YR addresses |
| --- | --- | --- |
| InitialAmmo/Ammo current-default reads | `6DCCAE` | `71474C` |
| Object Immune / Techno TypeImmune reads | `5D7A1B` / `6DAFD2` | `5F94E7` / `712208` |
| Aircraft/building/infantry/unit initial ammo assignment | `413D5A`, `43F87D`, `4FF959`, `6FA5CC` | `41403A`, `442C81`, `517D69`, `735598` |
| TurretCount/WeaponCount/ClearAllWeapons conditional loading | `6DB614` | `71284A` |
| Comma/exact-house alliance mask parser | `46A720` | `475260` |
| MakeAlly / CanAlly initialization gate | `4E5660` / `4EC4E0` | `4F9B70` / `501540` |
| Fresh scenario initialization counter increment | `65EB40` | `686B20` |

Constructor/source staging, narrow scalar parser inputs and exact case reconstruction
reuse the independently reviewed [entity policy](ENTITY_DEFINITIONS_PROVENANCE.md)
and [source view](INI_SOURCE_PROVENANCE.md). Integer and boolean helpers come from
the GPL [weapon compiler](WEAPON_DEFINITIONS_PROVENANCE.md); canonical encoding is
original project code. No combat effect, full diplomacy, reload, dynamic turret,
elite, veterancy or complete modifier interpretation follows from these typed fields.
