// SPDX-License-Identifier: GPL-3.0-or-later
import { PracticeModel } from './practice-model.ts';
import { fields, integer, validAction, type PracticeReply } from './practice-protocol.ts';
const model = new PracticeModel(async bytes => {
  const hash = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes));
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
});
let busy = false, previous = 0;
self.onmessage = event => {
  const input: unknown = event.data;
  if (!fields(input, ['version', 'id', 'action']) || input.version !== 1 || !integer(input.id, 1) || input.id <= previous || !validAction(input.action) || busy) return;
  const id = input.id; previous = id; busy = true;
  void model.act(input.action).then(result => {
    self.postMessage({ version: 1, id, ok: true, ...result } satisfies PracticeReply);
  }, error => {
    const code = error instanceof Error && /limit/.test(error.message) ? 'limit' : 'invalid';
    self.postMessage({ version: 1, id, ok: false, error: code } satisfies PracticeReply);
  }).finally(() => { busy = false; });
};
