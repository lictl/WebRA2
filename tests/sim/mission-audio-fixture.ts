// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic mission/audio fixtures; no installation data.
import { missionBindingsFixture } from './mission-bindings-fixture.ts';
import { audioFixture, planRoots } from '../content/mission-audio.fixture.ts';
import { cueCsf, hashCueFixture } from '../content/mission-cue.fixture.ts';
import { compileMissionCues } from '../../packages/content/src/mission-cues.ts';
import { compileMissionAudioPlan } from '../../packages/content/src/mission-audio.ts';
import { prepareMissionAudioSamples } from '../../packages/content/src/mission-audio-samples.ts';
import { compileMissionAudioPolicy } from '../../packages/content/src/mission-audio-policy.ts';
import { compileMissionBindings, prepareMissionBindings } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionInitialFlags } from '../../packages/sim/src/mission-initial-flags.ts';
import { compileMissionWorld } from '../../packages/sim/src/mission-world.ts';
import { missionTeamActionSourceContext, type MissionTeamActionSource } from '../../packages/sim/src/mission-team-action-source.ts';
export const soundAction = '19,7,Alert,0,0,0,0,A';
export const evaAction = '21,6,Notice,0,0,0,0,A';
export const textAction = '11,4,MSG,0,0,0,0,A';
export function audioMission(actions = [soundAction, textAction, evaAction], repeat = false, event = '8,0,0') {
  return `[Triggers]\nStart=Blue,<none>,Start,0,1,1,1,0\n[Tags]\nShared=${repeat ? 2 : 0},Shared,Start\n[Events]\nStart=1,${event}\n[Actions]\nStart=${actions.length},${actions.join(',')}`;
}
export async function audioSource(f: ReturnType<typeof missionBindingsFixture>, sound?: string, side: 0 | 1 | 2 = 0) {
  const profile = f.world.model.contentIdentity.profile, source = audioFixture(profile), strings = cueCsf([{ label: 'MSG', text: 'Original 提示' }]);
  const cues = compileMissionCues({ profile, mission: { ...f.mission, path: 'fixture.map' },
    strings: { path: profile === 'ra2' ? 'ra2.csf' : 'ra2md.csf', sha256: hashCueFixture(strings), bytes: strings } });
  const soundPath = profile === 'ra2' ? 'sound.ini' : 'soundmd.ini';
  const sources = sound === undefined ? source.input.sources : source.input.sources.map(s => s.path === soundPath ? source.source(soundPath, sound) : s);
  const plan = compileMissionAudioPlan({ ...source.input, cues, sources, side });
  const samples = await prepareMissionAudioSamples(plan, planRoots(plan, source.roots));
  const audio = compileMissionAudioPolicy({ cues, audio: samples, initialization: 'fresh-process-audio-load' });
  return { cues, audio, samples };
}
export async function audioWorld(f: ReturnType<typeof missionBindingsFixture>, sound?: string, teams?: MissionTeamActionSource) {
  const { cues, audio, samples } = await audioSource(f, sound), bindings = teams ? missionTeamActionSourceContext(teams).bindings : compileMissionBindings(f);
  const prepared = await prepareMissionBindings(bindings, cues, undefined, undefined, teams, audio);
  const flags = compileMissionInitialFlags({ bindings, bytes: f.mission.bytes, initialization: 'new-campaign' });
  const model = prepared.authority ? compileMissionWorld({ world: f.world.model, bindings: prepared.authority, flags }) : null;
  return { f, cues, audio, samples, bindings, prepared, flags, model };
}
export async function audioWorldFixture(profile: 'ra2' | 'yr' = 'ra2', options: {
  actions?: string[]; repeat?: boolean; event?: string; extraMap?: string; sound?: string
} = {}) {
  const f = missionBindingsFixture({ profile, extraMap: options.extraMap ?? audioMission(options.actions, options.repeat, options.event) });
  return audioWorld(f, options.sound);
}
