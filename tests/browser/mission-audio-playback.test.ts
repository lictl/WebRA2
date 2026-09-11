// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserPcmPlayback, BrowserPcmPlaybackError, BROWSER_PCM_PLAYBACK_LIMITS } from '../../packages/audio/src/browser-pcm-playback.ts';
import { copyMissionAudioPcm } from '../../packages/formats/src/mission-audio-decode.ts';
import { originalPcm, registration, deferred, FakeContext, fakeEnvironment } from './mission-audio-playback.fixture.ts';
const error = (code: string) => (e: unknown) => e instanceof BrowserPcmPlaybackError && e.code === code;
function fixture(cap = {}) {
  const fake = fakeEnvironment(), player = new BrowserPcmPlayback({ sessionId: 1, profile: 'ra2' }, cap, fake.environment);
  return { ...fake, player };
}
const request = (requestId = 1, sessionId = 1, sampleId = 'tone') => ({ requestId, sessionId, sampleId });

test('genuine registered PCM copies become exact normalized stereo channels; context requires a gesture', async () => {
  const { player, contexts, control } = fixture();
  const pcm = originalPcm([-32768, 32767, 16384, -16384], 2);
  player.register(registration(pcm)); copyMissionAudioPcm(pcm).fill(123);
  assert.throws(() => player.play(request()), error('playback-unavailable'));
  control.activated = false; assert.throws(() => player.activate(1), error('user-activation-required'));
  assert.equal(contexts.length, 0); control.activated = true; await player.activate(1);
  player.play(request());
  assert.deepEqual(contexts[0]!.buffers[0]!.channels.map(c => [...c]), [[-1, .5], [32767 / 32768, -.5]]);
  assert.deepEqual(contexts[0]!.sources[0]!.starts, [0]);
  assert.equal(player.snapshot().activeSampleBytes, 16);
  assert.equal(player.snapshot().cachedPcmBytes, 8);
  await player.dispose();
});

test('same-realm brand, exact source hashes, profiles, sessions and descriptor snapshots are mandatory', async () => {
  const { player } = fixture(), input = registration();
  for (const pcm of [{ ...input.pcm }, new Proxy(input.pcm, {})]) assert.throws(() => player.register({ ...input, pcm }), error('pcm-brand'));
  assert.throws(() => player.register({ ...input, expectedEncodedSha256: '0'.repeat(64) }), error('source-mismatch'));
  assert.throws(() => player.register({ ...input, expectedPcmSha256: '0'.repeat(64) }), error('source-mismatch'));
  assert.throws(() => player.register({ ...input, expectedDecodeSha256: '0'.repeat(64) }), error('source-mismatch'));
  assert.throws(() => player.register({ ...input, profile: 'yr' }), error('profile-mismatch'));
  assert.throws(() => player.register({ ...input, sessionId: 2 }), error('stale-session'));
  const hostile = new Proxy(input, { get() { throw Error('must use descriptors'); } });
  player.register(hostile);
  assert.throws(() => player.register(input), error('sample-exists'));
  const getter = { ...input }; Object.defineProperty(getter, 'sampleId', { get() { throw Error('getter'); } });
  assert.throws(() => player.register(getter), error('input-shape'));
  await player.activate(1);
  player.play(new Proxy(request(), { get() { return -1; } }));
  assert.equal(player.snapshot().lastAcceptedRequestId, 1);
  await player.dispose();
});

test('lower-only exact cache and active buffer caps refuse before allocation, including paused voices', async () => {
  const { player, contexts } = fixture({ samples: 1, pcmBytes: 8, voices: 1, voiceBytes: 16 });
  player.register(registration());
  assert.throws(() => player.register(registration(undefined, 1, 'ra2', 'other')), error('cache-limit'));
  await player.activate(1); player.play(request());
  assert.throws(() => player.play(request(2)), error('voice-limit')); assert.equal(contexts[0]!.buffers.length, 1);
  await player.pause(1); assert.equal(player.snapshot().activeSampleBytes, 16);
  assert.throws(() => player.play(request(2)), error('playback-unavailable'));
  assert.equal(player.snapshot().lastAcceptedRequestId, 1);
  await player.activate(1); player.stopAll(1); player.play(request(2));
  assert.equal(player.snapshot().lastAcceptedRequestId, 2);
  await player.dispose();
  for (const [key, value] of Object.entries(BROWSER_PCM_PLAYBACK_LIMITS)) {
    assert.throws(() => fixture({ [key]: value + 1 }), error('input-integer'));
    const lower = fixture({ [key]: 0 });
    if (key === 'samples' || key === 'pcmBytes') assert.throws(() => lower.player.register(registration()), error('cache-limit'));
    else { lower.player.register(registration()); await lower.player.activate(1); assert.throws(() => lower.player.play(request()), error('voice-limit')); }
    await lower.player.dispose();
  }
  const short = fixture({ pcmBytes: 7 }); assert.throws(() => short.player.register(registration()), error('cache-limit'));
  const shortVoice = fixture({ voiceBytes: 15 }); shortVoice.player.register(registration()); await shortVoice.player.activate(1);
  assert.throws(() => shortVoice.player.play(request()), error('voice-limit')); assert.equal(shortVoice.contexts[0]!.buffers.length, 0);
  await shortVoice.player.dispose();
});

test('failed starts/allocations consume no request or partial voice state; accepted IDs are monotonic', async () => {
  const { player, contexts } = fixture(); player.register(registration()); await player.activate(1);
  const context = contexts[0]!; context.failBuffer = true;
  assert.throws(() => player.play(request(7)), error('voice-start-failed'));
  assert.equal(player.snapshot().lastAcceptedRequestId, 0); assert.equal(player.snapshot().activeVoices, 0);
  context.failBuffer = false; context.failStart = true;
  assert.throws(() => player.play(request(7)), error('voice-start-failed'));
  assert.equal(player.snapshot().activeVoices, 0); assert.equal(player.snapshot().activeSampleBytes, 0);
  assert.equal(context.sources[0]!.buffer, null); assert.equal(context.sources[0]!.disconnected, true);
  context.failStart = false; player.play(request(7));
  for (const id of [1, 6, 7]) assert.throws(() => player.play(request(id)), error('obsolete-request'));
  player.stopAll(1); assert.throws(() => player.play(request(7)), error('obsolete-request'));
  player.play(request(8)); await player.dispose();
});

test('suspend/resume keeps existing voice and clock offset; gain/mute is applied only when active', async () => {
  const { player, contexts } = fixture(); player.register(registration()); await player.activate(1); player.play(request());
  const context = contexts[0]!, source = context.sources[0]!; context.advance(.25);
  player.setOutput({ sessionId: 1, gain: .3, muted: true }); assert.equal(context.gain.gain.value, 0);
  player.setOutput({ sessionId: 1, gain: .3, muted: false }); assert.equal(context.gain.gain.value, .3);
  await player.pause(1); context.advance(10); assert.equal(context.currentTime, .25); assert.equal(source.stops, 0);
  player.setOutput({ sessionId: 1, gain: .5, muted: false }); assert.equal(context.gain.gain.value, 0);
  await player.activate(1); context.advance(.25); assert.equal(context.currentTime, .5);
  assert.equal(context.gain.gain.value, .5); assert.deepEqual(source.starts, [0]);
  source.end(); assert.equal(player.snapshot().activeVoices, 0); assert.equal(source.buffer, null);
  await player.dispose();
});

test('pending lifecycle refuses play/overlap immediately; resume and suspend rejection stay muted', async () => {
  const { player, control } = fixture(); const context = new FakeContext(); control.next = context;
  context.resumeDeferred = deferred(); player.register(registration()); const activation = player.activate(1);
  assert.throws(() => player.play(request()), error('playback-unavailable'));
  assert.throws(() => player.activate(1), error('lifecycle-busy'));
  assert.throws(() => player.pause(1), error('lifecycle-busy'));
  context.resumeDeferred.reject(Error('original denial')); await assert.rejects(activation, error('resume-failed'));
  assert.equal(context.gain.gain.value, 0); assert.equal(player.snapshot().activated, false);
  context.resumeDeferred = null; await player.activate(1); player.play(request());
  context.suspendDeferred = deferred(); const pause = player.pause(1); assert.equal(context.gain.gain.value, 0);
  context.suspendDeferred.reject(); await assert.rejects(pause, error('suspend-failed'));
  assert.equal(player.snapshot().activated, false); assert.equal(player.snapshot().activeVoices, 1);
  assert.equal(context.gain.gain.value, 0); await player.dispose();
});

for (const operation of ['activate', 'pause'] as const) test(`replacement during pending ${operation} cancels caller and stale native completion cannot alter the next session`, async () => {
  const { player, contexts, control } = fixture(); const old = new FakeContext(); control.next = old;
  player.register(registration()); let pending: Promise<void>;
  if (operation === 'activate') { old.resumeDeferred = deferred(); pending = player.activate(1); }
  else { await player.activate(1); player.play(request()); old.suspendDeferred = deferred(); pending = player.pause(1); }
  const cancelled = assert.rejects(pending, error('operation-cancelled'));
  old.closeDeferred = deferred(); const closing = player.replaceSession({ sessionId: 2, profile: 'yr' });
  await cancelled;
  assert.equal(player.snapshot().cachedPcmBytes, 0); assert.equal(player.snapshot().activeVoices, 0);
  assert.throws(() => player.activate(2), error('context-closing'));
  assert.throws(() => player.play(request(2)), error('stale-session'));
  old.closeDeferred.resolve(); await closing;
  player.register(registration(undefined, 2, 'yr')); await player.activate(2); player.play(request(1, 2));
  const before = player.snapshot(); (operation === 'activate' ? old.resumeDeferred : old.suspendDeferred)!.resolve();
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(player.snapshot(), before); assert.equal(contexts.length, 2); assert.equal(old.gain.gain.value, 0);
  await player.dispose();
});

test('repeated replacement during close has one counted context; failed close blocks creation until explicit retry', async () => {
  const { player, contexts } = fixture(); await player.activate(1); const old = contexts[0]!;
  old.closeDeferred = deferred(); const closing = player.replaceSession({ sessionId: 2, profile: 'yr' });
  const second = player.replaceSession({ sessionId: 3, profile: 'ra2' });
  assert.equal(closing, second); assert.equal(old.closes, 1); assert.equal(player.snapshot().retiringContexts, 1);
  const rejected = assert.rejects(closing, error('context-close-failed')); old.closeDeferred.reject(); await rejected;
  assert.equal(player.snapshot().closeFailed, true); assert.throws(() => player.activate(3), error('context-close-failed'));
  assert.equal(contexts.length, 1); old.closeDeferred = null; await player.retryClose();
  assert.equal(player.snapshot().retiringContexts, 0); await player.activate(3); assert.equal(contexts.length, 2);
  await player.dispose();
});

test('stale ended callbacks and unregister cannot release a replacement voice or cache', async () => {
  const { player, contexts } = fixture(); player.register(registration()); await player.activate(1); player.play(request());
  const oldSource = contexts[0]!.sources[0]!, ended = oldSource.onended!;
  assert.equal(player.unregister({ sessionId: 1, sampleId: 'tone' }), true);
  assert.equal(player.snapshot().cachedPcmBytes, 0); assert.equal(player.snapshot().activeVoices, 1);
  await player.replaceSession({ sessionId: 2, profile: 'ra2' });
  player.register(registration(undefined, 2)); await player.activate(2); player.play(request(1, 2));
  const before = player.snapshot(); ended(); assert.deepEqual(player.snapshot(), before);
  player.stop({ sessionId: 2, requestId: 1 }); contexts[1]!.sources[0]!.end();
  assert.equal(player.snapshot().activeVoices, 0); assert.equal(player.snapshot().cachedPcmBytes, 8);
  await player.dispose();
});

test('dispose cancels unfulfilled activation promptly, remains idempotent, and retains failed close accounting', async () => {
  const { player, control } = fixture(), context = new FakeContext(); control.next = context;
  context.resumeDeferred = deferred(); context.closeDeferred = deferred();
  const activation = assert.rejects(player.activate(1), error('operation-cancelled'));
  const close = player.dispose(); assert.equal(close, player.dispose()); await activation;
  assert.throws(() => player.activate(1), error('disposed')); assert.throws(() => player.replaceSession({ sessionId: 2, profile: 'yr' }), error('disposed'));
  const rejection = assert.rejects(close, error('context-close-failed')); context.closeDeferred.reject(); await rejection;
  assert.equal(player.snapshot().retiringContexts, 1); context.closeDeferred = null; await player.retryClose();
  assert.equal(player.snapshot().retiringContexts, 0); context.resumeDeferred.resolve();
  await Promise.resolve(); assert.equal(player.snapshot().disposed, true);
});

test('partial context setup failure is retired and all integer/string/output boundaries reject without mutation', async () => {
  const { player, control, contexts } = fixture(), context = new FakeContext(); context.failGain = true;
  context.closeDeferred = deferred(); control.next = context;
  assert.throws(() => player.activate(1), /original gain failure/);
  assert.equal(player.snapshot().retiringContexts, 1); assert.throws(() => player.activate(1), error('context-closing'));
  context.closeDeferred.resolve(); await player.retryClose(); await player.activate(1); assert.equal(contexts.length, 2);
  player.register(registration());
  const before = player.snapshot();
  for (const requestId of [0, -0, -1, NaN, Infinity, 1.1, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => player.play(request(requestId)));
  for (const id of ['', 'x'.repeat(129), '../tone', '__proto__']) assert.throws(() => player.play(request(1, 1, id)));
  for (const gain of [-1, -0, NaN, Infinity, 1.01]) assert.throws(() => player.setOutput({ sessionId: 1, gain, muted: false }));
  assert.throws(() => player.replaceSession({ sessionId: 1, profile: 'yr' }), error('obsolete-session'));
  assert.deepEqual(player.snapshot(), before); await player.dispose();
});
