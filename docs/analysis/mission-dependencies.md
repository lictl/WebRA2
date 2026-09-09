# Opening-mission dependency evidence and remaining compilation

The [structural graph](campaign-graph.md) is extended by
[transitive candidates](dependency-candidates.md), [native source selections](native-profile-evidence.md)
and [locale dependencies](locale-dependencies.md). These supply the M0 evidence
baseline while keeping full dependency closure false. The remaining compiler/runtime
work stays under [effective-content #18](https://github.com/lictl/WebRA2/issues/18).

| Unresolved edge or behavior | Evidence available | Next bounded action |
| --- | --- | --- |
| Definition candidate → effective RA2/YR layer | Native expansion/loose/list behavior supports the selected rulesmd, soundmd and all02umd patch copies; all alternatives survive | Apply the reference selections in M1/M2; resolve map overrides, defaults and any required dynamic-loader conflict explicitly |
| Country/owner selector → runtime house | Literal country fields and editor selector code; sentinel occurrences retained | Specify selectors independently of concrete houses; compare one original mission ownership case if static evidence cannot settle it |
| Object → primary/secondary/elite weapon | Literal and numbered weapon candidates now traversed: 32 RA2 / 166 YR with variants | Compile selected definitions and inherited/index defaults; establish activation and numeric semantics |
| Weapon → projectile / warhead | Typed literal graph reaches 11/18 RA2 and 40/81 YR projectile/warhead candidates | Validate effective rules/defaults and implement the referenced combat behavior |
| Object → prerequisite / deploy / undeploy / upgrade | Literal types and built-in group candidates traversed, with cycles/missing operands retained | Recover defaults/alternatives and compile runtime production/deployment requirements |
| Object → voices / explosion / debris animation | Animation chains and sound tables traversed; all 320/670 requested samples have bounded indexed BAG candidates | Resolve native audio/locale selection and decode samples; establish scheduling, fallback and activation |
| Type → implicit image / theater-specific art → SHP/VXL/HVA/TMP/palette | 1,100/1,845 file probes retain hashes/ranges and optional alternatives; all but one non-optional base-name request per opening match a candidate | Resolve native theater/default/voxel fallback, packed terrain and payload decoders before declaring a minimal asset set |
| Packed cells / overlay / terrain / building upgrades → type and visual assets | Placement prefix only; packed formats not decoded | Add bounded map-pack/type extraction; avoid treating visible placement nodes as the entire scene |
| Trigger/action/event/script opcode → referenced object, team, waypoint, variable, media or scheduled work | Opening opcode IDs from prior framing census | Adopt typed, evidence-backed opcode parameter schemas and count unsupported operands; no guessed opcode meanings |
| AI trigger condition / script / recruitment → active team and object | Literal owner/team/type references retained | Specify activation and selector semantics; do not treat all static candidates as active requirements |
| Cinematic identifier → localized Bink/VQA/audio/subtitle resources | Direct file probes and localized archive companions; real Bink/PCM presented in four browsers | Resolve name/stream/locale selection and build persistent playback under #12; direct VQA probes do not imply required VQA content |
| Battle/mission table entry → next native mission and win/lose transition | Native MAPSEL consumers, explicit stage links and EndOfGame controls now pinned | Implement branch/loss/retry/score/save transitions and execute focused original comparison recipes |

The graph's `structuralClosureComplete`, `behaviorClosureComplete` and the report's
`dependencyClosureComplete` remain false. Zero missing literal references is not
enough: unsupported transitive edges can hide further assets or mechanics. Counts
across all indexed rules/AI/art must not be confused with the separately reported
reachable subset. These are planning inputs for the first playable slices, not
claims that either opening campaign can run. The [M0 exit record](m0-exit.md)
distinguishes the completed evidence from these implementation gates. The
[reference manifest](m0-reference-profile.json) is conservative; assets-only import
requires no native executable, but minimal asset subsets remain uncertified.
