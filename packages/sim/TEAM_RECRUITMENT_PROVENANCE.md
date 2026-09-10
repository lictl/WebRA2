# Existing actor recruitment and Flash provenance

The original `src/team-recruitment-*.ts` modules and synthetic tests/fixture are
GPL-3.0-or-later. They compose the existing GPL team/world controller and reuse its
source-bound transaction pattern. Preserve this notice, the GPL text, corresponding
source and the existing team/runtime notices in distributions. No game payload,
listing or executable code is included. The shared program/roster/Flash patch was
also authored by the component worker; coordinator application does not constitute
independent authorship. Review it independently before integration.

The [paired native ledger](../../docs/analysis/team-recruitment-native.json) pins both
supplied executable image hashes and 56 ranges totaling 10148 bytes: 44 code spans,
six pointer slots and six key/name literal hashes. PE ranges were read statically;
code starts were inspected and complete endpoints checked with Capstone 5.0.6. No
original executable was run. The primary layout references are pinned
[TeamClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TeamClass.h),
[TeamTypeClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TeamTypeClass.h),
[TaskForceClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TaskForceClass.h),
[MissionClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/MissionClass.h)
and [TechnoClass](https://github.com/Phobos-developers/YRpp/blob/61d0887eb6040cfb36af16d592e9770ceae4dfb2/TechnoClass.h).
Header names alone do not prove behavior. In particular, the header's CanRecruitUnit
address does not identify the actual supplied-image selection routine; the real
Team AI caller and CanAdd/AddMember chain were traced below. No YRpp license claim
is made for those layout references.

| Native path (exclusive end in ledger) | RA2 entry | YR entry | Bounded interpretation |
| --- | --- | --- | --- |
| Source action4 | `6AEC7D` | `6DEB57` | Triggered counter encloses empty-team creation; this is distinct from reinforcement actor creation |
| CreateTeam / constructor | `6BEC80` / `6B7430` | `6F09C0` / `6E8A90` | Allocate team/script/owner/waypoint context; triggered path bypasses ordinary Max check |
| Deficient TaskForce loop | `6B7BE5` | `6E9255` | Native AI incrementally asks for missing member slots; WebRA2 full-force atomicity is a D03 choice |
| CanAdd / AddMember | `6B8DC0` / `6B8CC0` | `6EA610` / `6EA500` | Owner/type/mission/flag/current-team gates; first matching TaskForce type slot; assign Group and member-recruitable B |
| Effective Group | `6BFA60` | `6F1870` | -1 falls back to TaskForce Group, -2 is wildcard; other values retained |
| Nearest selection | `6B91C0` | `6EAA90` | Family iteration, group filtering, 12800 mismatch score, incumbent tie retention and final AddMember |
| Squared XY helper | `5D4E00` | `5F6560` | Signed32 XY sum; Z is copied but not part of the returned squared distance |
| Liberate / destructor | `6B8FB0` / `6B7770` | `6EA870` / `6E8DE0` | Clear membership/counts and invoke further actor idle behavior; Group/B are not restored |
| Script end / destructor dispatch | `6B7CF4` / `6B807A` | `6E9364` / `6E9713` | No next script step leads to team destruction and member release |
| MissionControl constructor / load | `594DD0` / `594E30` | `5B3700` / `5B3760` | Fresh Recruitable=true; exact source bool default retains prior field; rules Properties traverses all mission records |
| Flash50 / counter update | `6B865E` / `4BBF00` | `6E9CF7` / `4CC770` | First-entry member counter assignment completes the script step; positive update decrements and sets low bit, zero preserves bit |

The [earlier placement ledger](../../docs/analysis/combat-placement-native.json)
provides the paired 128-byte CSV framing and rank/Group/bridge/follower/A/B source
loads. The [Sleep ledger](../../docs/analysis/team-sleep-native.json) establishes
first-entry dispatch and persistent Sleep rather than fabricated completion.
The [source activation notice](../../packages/content/TEAM_ACTIVATION_PROVENANCE.md)
records literal action operand framing and CreateTeam versus reinforcement branches.

WebRA2 restricts this to free stationary ordinary infantry/units in a genuine fresh
movement world, without imported combat/transport/tag contexts. It preserves raw
rank, uses complete source programs, rejects unsupported native branches and retains
source histories. Full-force acquisition, stable-ID ties, wide horizontal cell-center
arithmetic, 15-tick retries, one-instruction tick phases and release boundary are
explicit D03 policies. They are not claims of native phase, coordinate, formation,
priority-stealing, post-release mission or global Scenario RNG equivalence. A running
Flash counter and its bit remain separately saved, including zero-overwrite behavior.
See the [focused report](../../docs/team-recruitment.md) for exact APIs, limits,
original synthetic coverage and separately labeled private evidence.
