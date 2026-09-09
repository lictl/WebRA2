// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Research schema; pinned evidence in docs/analysis/dependency-candidates.md.
export type DependencyKind = 'type' | 'weapon' | 'projectile' | 'warhead' | 'animation' | 'voxel-animation' | 'particle-system' | 'particle' | 'art' | 'sound' | 'audio-sample' | 'file' | 'group' | 'missing';
export type Requirement = 'required' | 'conditional' | 'optional' | 'unsupported';
export interface DependencyField { owners: DependencyKind[]; pattern: RegExp; target: DependencyKind; list: boolean; requirement: Requirement; evidence: 'yrpp-types' | 'ea-editor' | 'local-field-observation' }
function field(owners: DependencyKind[], pattern: RegExp, target: DependencyKind, list = false, requirement: Requirement = 'conditional', evidence: DependencyField['evidence'] = 'yrpp-types'): DependencyField { return { owners, pattern, target, list, requirement, evidence }; }
/** Matches complete known field names; extension lookalikes do not acquire native semantics. */
export const DEPENDENCY_FIELDS: readonly DependencyField[] = [
  field(['type'], /^(primary|secondary|eliteprimary|elitesecondary|(?:elite)?weapon\d+|deathweapon)$/, 'weapon'),
  field(['type'], /^(deploysinto|undeploysinto|unloadingclass|spawns|enslaves|powersupbuilding)$/, 'type'),
  field(['type'], /^prerequisite(?:override)?$/, 'group', true),
  field(['type'], /^(explosion|debrisanims)$/, 'animation', true),
  field(['type'], /^deployinganim$/, 'animation'),
  field(['type', 'warhead'], /^debristypes$/, 'voxel-animation', true),
  field(['type'], /^(voiceselect(?:enslaved|deactivated)?|voicemove|voiceattack|voicespecialattack|voicedie|voicefeedback|voicefalling|voicecrashing|voicesinking|voiceenter|voicecapture|voiceharvest|voiceprimaryweaponattack|voiceprimaryeliteweaponattack|voicesecondaryweaponattack|voicesecondaryeliteweaponattack|voicedeploy|voiceundeploy|movesound|diesound|deploysound|undeploysound|creatingsound)$/, 'sound', true),
  field(['weapon'], /^projectile$/, 'projectile', false, 'required'),
  field(['weapon', 'animation', 'voxel-animation'], /^warhead$/, 'warhead', false, 'required'),
  field(['weapon'], /^(report|downreport)$/, 'sound', true),
  field(['weapon'], /^anim$/, 'animation', true),
  field(['weapon'], /^(occupantanim|assaultanim|opentoppedanim)$/, 'animation'),
  field(['weapon'], /^attachedparticlesystem$/, 'particle-system'),
  field(['projectile'], /^(airburstweapon|shrapnelweapon)$/, 'weapon'),
  field(['projectile'], /^trailer$/, 'animation'),
  field(['warhead'], /^animlist$/, 'animation', true),
  field(['animation'], /^(next|spawns|traileranim)$/, 'animation'),
  field(['animation'], /^report$/, 'sound'),
  field(['particle-system'], /^holdswhat$/, 'particle', false, 'required'),
  field(['particle'], /^nextparticle$/, 'particle'),
  field(['art'], /^(bibshape|activeanim\d*|idleanim|superanim\d+|specialanim\d+|turretanim)$/, 'art', false, 'conditional', 'ea-editor'),
];
export const PREREQUISITE_GROUPS = new Map([['power', 'prerequisitepower'], ['factory', 'prerequisitefactory'], ['barracks', 'prerequisitebarracks'], ['radar', 'prerequisiteradar'], ['tech', 'prerequisitetech'], ['proc', 'prerequisiteproc']]);
