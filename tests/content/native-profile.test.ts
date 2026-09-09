// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. All fixtures are original synthetic text.
import assert from 'node:assert/strict';
import test from 'node:test';
import { scanIni } from '../../packages/content/src/ini.ts';
import { censusNativeCampaignControls, censusNativeMapSelection } from '../../packages/content/src/native-profile.ts';
const ini = (text: string) => scanIni(new TextEncoder().encode(text));

test('choice edges follow explicit section targets, not filename or section order', () => {
  const result = censusNativeMapSelection(ini('[second]\nScenario=z.map\n[first]\nScenario=a.map\n7=second\n'), ['a.map', 'z.map']);
  assert.deepEqual(result.edges, [{ from: 1, to: [0], choice: 7, line: 5, ambiguous: false }]);
  assert.equal(result.diagnostics.length, 0);
});
test('duplicate target sections and numbered choices remain ambiguous', () => {
  const result = censusNativeMapSelection(ini('[one]\nScenario=a.map\n1=two\n01=two\n[two]\nScenario=b.map\n[TWO]\nScenario=c.map\n'), ['a.map', 'b.map', 'c.map']);
  assert.equal(result.edges.length, 2);
  assert.ok(result.edges.every(edge => edge.ambiguous && edge.to.length === 2));
});
test('unresolved and invalid choices cannot fabricate a target', () => {
  const result = censusNativeMapSelection(ini('[one]\nScenario=a.map\n0=one\n256=one\n2=missing\n'), ['a.map']);
  assert.deepEqual(result.edges[0]?.to, []);
  assert.equal(result.diagnostics.length, 3);
});
test('projection excludes arbitrary text, legacy names and unknown filenames', () => {
  const doc = ini('[private-stage]\nScenario=private.map\nDescription=retail-string\n[Basic]\nNextScenario=private-next.map\n');
  const text = JSON.stringify([censusNativeMapSelection(doc, ['a.map']), censusNativeCampaignControls(doc)]);
  assert.ok(!/private|retail-string/.test(text));
});
test('duplicate or unsupported controls have no invented default', () => {
  const result = censusNativeCampaignControls(ini('[Basic]\nEndOfGame=yes\nSkipMapSelect=perhaps\nEndOfGame=no\n'));
  assert.deepEqual(result.controls.map(row => [row.status, row.value]), [['ambiguous', null], ['unsupported', null], ['absent', null]]);
});
test('booleans, empty stages, comments and prototype-shaped sections are explicit', () => {
  const doc = ini('[constructor]\nScenario=a.map ; note\n1=__proto__\n[__proto__]\nScenario=\n[Basic]\nEndOfGame=yes\nSkipMapSelect=no\nOneTimeOnly=0\n');
  assert.deepEqual(censusNativeCampaignControls(doc).controls.map(row => row.value), [true, false, false]);
  assert.deepEqual(censusNativeMapSelection(doc, ['a.map']).edges[0]?.to, [1]);
});
test('bounded inputs reject excessive records and invalid filename allowlists', () => {
  const doc = ini('[one]\nScenario=a.map');
  assert.throws(() => censusNativeMapSelection(doc, ['../a.map']), /filename-limit/);
  doc.sections = Array.from({ length: 4097 }, () => ({ name: 'x', occurrence: 0, line: 1 }));
  assert.throws(() => censusNativeCampaignControls(doc), /record-limit/);
});
