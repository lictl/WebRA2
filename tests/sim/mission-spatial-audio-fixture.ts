// SPDX-License-Identifier: GPL-3.0-or-later
// Original miniature source/audio fixture.
import { missionBindingsFixture } from './mission-bindings-fixture.ts';
import { audioFixture, planRoots } from '../content/mission-audio.fixture.ts';
import { compileMissionBindings } from '../../packages/sim/src/mission-bindings.ts';
import { compileMissionCues } from '../../packages/content/src/mission-cues.ts';
import { compileMissionAudioPlan } from '../../packages/content/src/mission-audio.ts';
import { prepareMissionAudioSamples } from '../../packages/content/src/mission-audio-samples.ts';
import { compileMissionAudioPolicy } from '../../packages/content/src/mission-audio-policy.ts';
import { compileMissionSpatialAudioSource } from '../../packages/sim/src/mission-spatial-audio-source.ts';

export async function spatialAudioFixture(profile: 'ra2' | 'yr', options: Parameters<typeof missionBindingsFixture>[0] = {}, script?: string, soundText?: string) {
  const f = missionBindingsFixture({ profile, ...options, extraMap: script ?? `[Triggers]
Start=Blue,<none>,Spatial,0,1,1,1,0
[Tags]
Shared=2,Spatial,Start
[Events]
Start=1,8,0,0
[Actions]
Start=2,99,7,Alert,0,0,0,0,A,116,0,688,0,0,0,0,A
${options.extraMap ?? ''}` });
  const bindings = compileMissionBindings(f), source = audioFixture(profile);
  const cues = compileMissionCues({ profile, spatialAudio: true, mission: { ...f.mission, path: 'original.map' }, strings: null });
  const path = profile === 'ra2' ? 'sound.ini' : 'soundmd.ini';
  const sources = soundText === undefined ? source.input.sources : source.input.sources.map(s => s.path === path ? source.source(path, soundText) : s);
  const plan = compileMissionAudioPlan({ ...source.input, sources, cues });
  const samples = await prepareMissionAudioSamples(plan, planRoots(plan, source.roots));
  const audio = compileMissionAudioPolicy({ cues, audio: samples, initialization: 'fresh-process-audio-load' });
  const input = { bindings, cues, audio }, spatial = compileMissionSpatialAudioSource(input);
  return { f, input, spatial, model: f.world.model };
}
