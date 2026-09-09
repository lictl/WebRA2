# Load a selected mission's definition profile

[Issue #79](https://github.com/lictl/WebRA2/issues/79) connects the
[browser catalog](browser-catalog.md) to [profile assembly](profile-content.md).
It selects and verifies the ten definition roles for an explicit RA2/YR profile and
caller-selected `.map`/`.mpr` path. It does not require executables or use a hardcoded
mission script. Every result still has `canStartCampaign: false`.

```ts
const result = await loadInstallationProfile(catalog, {
  profile: 'yr', engineVersion: 'webra2-m1-content-1', missionPath: 'example.map',
}, { signal, onProgress });
```

The catalog must come from `inspectBrowserCatalog`; arbitrary deserialized catalog
reports are not readers. Keep the catalog alive while loading, and give both APIs
the same AbortSignal for prompt cancellation of pending native reads. The caller
owns catalog disposal. A second loader on the same catalog fails as busy, including
reentrant progress callbacks. Other direct catalog operations must be coordinated
by its owner. Request strings and options are captured before the first await.

## Versioned source selection

`webra2-standard-definitions-1` implements a conservative ordinary-definition policy
based on [the pinned native source-selection evidence](analysis/native-profile-evidence.md).
It is a WebRA2 policy with explicit limits, not proof of all native mount classes or
specialized media, theater, localization or dynamic mod lookup behavior.

| Source | Priority | Behavior |
| --- | --- | --- |
| Eligible literal loose path | 200 | Overrides the supported archive candidates |
| RA2 `expand00.mix` through `expand99.mix`, or YR `expandmd00.mix` through `expandmd99.mix` | 1 through 100 | Higher numeric suffix overrides lower suffix |
| Known standard definition/map archive roots | 0 | Tied, with no guessed wildcard enumeration order |
| Other mount classes or unrecognized nested ancestry | none | Unresolved; no guessed rank |

The standard roots are RA2, language, local, cache and numbered maps archives;
YR additionally allows their explicit `md` counterparts. The exact finite patterns
are in [the implementation](../packages/content/src/installation-profile.ts).
Nested definitions require a single recognized local/cache/language name at every
ancestor. Their priority derives from their outer root. Unnamed nested archives,
`ecache`/`elocal` families and custom paths are not assigned an inferred priority.
Only catalog-eligible paths participate; an ignored or unassigned file in the import
report does not become a mount merely because this loader exists.

The ten roles are rules, art, AI, battle, map selection, briefing, sound, strings,
font and mission, in that order. RA2 uses the conventional base filenames; YR uses
the `md` definitions/CSF plus shared `game.fnt`. The mission is supplied by the caller.
Non-mission roles use `base` for RA2 and `expansion` for YR in the composition plan;
these are semantic profile categories, not the chosen file's physical storage.
Mission overrides use `map`. Equivalent loose/archived bytes therefore produce
the same semantic identity as an explicit #62 plan. An explicit ordered mod-layer
policy and complete runtime dependency manifest remain separate work.

Every lookup candidate remains in `definitions`, including verified shadowed
alternatives. A highest-priority content conflict remains unresolved even if the
picker order is stable. Equivalent top copies all remain in `selected`; a stable
path/offset/ID sort chooses only which identical physical buffer to compile. Hash
name candidates remain candidates, not recovered literal names. Known name
collisions, one physical member matching different required paths, blocked ancestry,
missing roles and unsupported mount ranks prevent profile assembly. Structural
failures return before any complete-root hashing. Unaffected roles are then marked
`pending`; that status is not a partially loaded game. A read or parser failure
rejects the operation rather than returning a partial profile.

## Bounds and ownership

Before verifying any root, the complete request must fit 256 candidate references,
16 MiB per member, 32 MiB of unique candidate bytes and 1 GiB of unique full root
bytes. Callers can lower each limit, never raise it. This bounds the hashing work
even though the underlying session permits more aggregate reads. All candidates,
including shadowed alternatives, count toward the budgets. Repeated references to
one physical candidate are counted individually for the reference cap and once for
byte/root caps; they become explicit name collisions when logical paths differ.

Reads are sequential. Full root/member identities come from the verified catalog;
returned ranges/sizes must match the candidate metadata. The loader independently
checks each returned member SHA-256 before comparing equivalents. It retains owned
candidate buffers only for this compilation operation. The assembler reads only
the exact selected identities from this cache, receives detached buffers, and
checks their bytes again. No decoded payload or File handle is included in the
candidate report; compiled INI/CSF data stays on the user's device. The cache is
released on success, unresolved conflict, cancellation and exception.

These caps describe candidate source bytes and verification work, not total process
RSS. Compilation has its own bounded snapshots and decoded strings, and the browser
retains File backing storage. Progress reports expose phase, completed/total count
and logical path; callback errors propagate. Cancellation never authorizes further
work or silently changes an expected byte identity.

## Verification

Original synthetic tests cover full loose/MIX assembly and hash equivalence,
separate namespaces, patch ordering and loose overrides, conflicting/equivalent map
copies, caller-selected missions and explicit profile mismatch, missing/blocked/
unknown ancestry, duplicate paths, preflight byte/root/count caps, immutable results,
request capture, busy/reentrant calls, callback/abort recovery and invalid adapter
bytes/identities. They ship no retail data.

Private Node 24.20.0 tests use the actual 438-file selection as file-backed native
Blobs, with the tolerant inspection policy. The reference is the committed metadata
in [the M0 profile](analysis/m0-reference-profile.json), not filenames alone.

| Profile / caller-selected opening | Verified candidates | Definition groups | Complete root/member bytes read |
| --- | --- | --- | --- |
| RA2 / `all01t.map` | 11 | 10 | 344,910,959 |
| YR / `all01umd.map` | 12 | 10 | 584,684,645 |

Every selected root SHA, range, member SHA and equivalent-source count matches M0.
RA2 retains both equivalent opening-map copies. YR selects the numbered-patch rules
and sound definitions and retains their differing base alternatives. The resulting
manifest and rules fingerprints exactly reproduce the independently assembled #62
profiles with engine version `webra2-m1-content-1`:

| Profile | Manifest SHA-256 | Rules SHA-256 |
| --- | --- | --- |
| RA2 | `9b438f71a503d13c8e678f0b723afc7f2055f21116e5c3d12c28f7f9f5d9303d` | `19463ac092c0ce8c229ed0194149d5475761c042c37761bd43687e2efd5c6623` |
| YR | `b822fc49daccba5b7d91d7fb453bb6c497c9a89dd8a1f6947a63d5036939a116` | `1955d7570080eed19f46f3b804190d921756b845665ca2287a4b7ceaf691e980` |

Reproduce with `npm ci`, then `node --import tsx --test
tests/content/installation-profile.test.ts` and `npm run check`. The private script
in the author's ignored `local/worktrees/installation-profile/local/probe-installation.mjs`
recursively enumerates the read-only game directory, wraps each native `openAsBlob`
in a File with `game/<relative path>`, and calls the catalog/loader once per profile.
It compares every selected identity to `equivalentSourceChoices`, and writes only
counts/fingerprints to private `installation-facts.json`. Run it from that worktree
with `node --import tsx local/probe-installation.mjs`. A missing retail installation
skips this separate private gate; it does not pass it. No browser timing, rendered
map or original gameplay claim follows from this Node component check.

The new composition and original tests are GPL-3.0-or-later under the existing
[content provenance](../packages/content/PROVENANCE.md). No dependency, executable
code translation, copied retail definition or upstream implementation was added.
