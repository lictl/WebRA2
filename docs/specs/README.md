# M0 behavior specifications and probes

Issue: [M0-03 / #6](https://github.com/lictl/WebRA2/issues/6). Revision: `m0-specs-1`.
Status: evidence and proposed interfaces; no simulation implementation or original
runtime comparison is included. These documents do not close campaign release gates.

- [Evidence record schema](evidence.md) distinguishes observations, interpretations,
  proposed WebRA2 policy and original-game verification.
- [Deterministic boundaries](determinism.md) defines checkpoint meaning, ordering,
  serializable work, content identity and the tests the first simulation must pass.
- [Mission interpreter](mission-interpreter.md) records source-backed format facts,
  the capability inventory shape and unresolved runtime alternatives.
- [Original-game comparison recipes](reference-recipes.md) turns unknown behavior
  into small future observations without asking the owner to run them now.
- [Evidence records](../../tests/fixtures/behavior/evidence-records.json) and
  [synthetic probes](../../tests/fixtures/behavior/probes.json) are original,
  metadata-only inputs for later test implementations. A probe is an abstract test
  design, not a current wire schema, passing engine test or original mission.

The coordinator owns `packages/contracts/` in [#8](https://github.com/lictl/WebRA2/issues/8).
Treat field proposals here as review input; consumers use the accepted contract
revision. Original timing, RNG, interpreter phase order and opcode effects remain
unverified. No dependency or external source code is adopted by this slice.

## Next use

1. M0-02 attaches actual archive/member hashes and opcode occurrences to the
   capability inventory after bounded archive decoding.
2. The coordinator reconciles these proposals with shared contracts. M1 implements
   and executes WebRA2 invariants using the synthetic probes.
3. Before each mechanic, choose its smallest comparison recipe. Prepare an original
   diagnostic map only after the real parameter framing/profile has been checked.
4. Record original-game observations separately from WebRA2 traces, including
   negative results and counterexamples. Promote only the claim actually tested.

## Fixture validation

This documentation slice uses JSON data, not a fixture interpreter. From the
repository root, the following standard-library check verifies record shape,
cross-references, explicit alternatives and original-only fixture provenance:

```sh
python3 - <<'PY'
import json
from pathlib import Path
root = Path('tests/fixtures/behavior')
evidence = json.loads((root / 'evidence-records.json').read_text())
probes = json.loads((root / 'probes.json').read_text())
assert evidence['schemaVersion'] == probes['schemaVersion'] == 1
assert probes['origin'] == 'original-webra2-synthetic'
assert probes['representation'] == 'abstract-research-probes-not-wire-schemas'
assert probes['runtimeExecuted'] is False
ids = [p['id'] for p in probes['probes']]
assert len(ids) == len(set(ids))
record_ids = [r['id'] for r in evidence['records']]
assert len(record_ids) == len(set(record_ids))
for r in evidence['records']:
    assert r['status'] == 'OBSERVED' and r['kind'] == 'format'
    assert r['source']['revision'] and r['source']['locator']
    assert r['observation'] and r['interpretation'] and r['limitations']
    assert r['runtimeVerification']['status'] == 'NOT_RUN'
    assert set(r['probeIds']) <= set(ids)
for p in probes['probes']:
    assert p['basis'] in ('proposed-webra2-policy', 'unresolved-original', 'editor-format')
    assert p['input'] and p['acceptance'] and p['limits']
    if p['basis'] == 'unresolved-original':
        assert len(p['candidateOutcomes']) >= 2
    assert p['referenceRecipe'].startswith('OBS-')
print(f"Validated {len(record_ids)} evidence records and {len(ids)} probe definitions; no engine executed")
PY
```

JSON syntax/shape checks do not establish the expected semantics. Later engine
tests must consume these inputs, observe real state transitions and fail when the
invariant breaks. Private original-game runs are currently **NOT_RUN**.
