# Verified profile content assembly

[Issue #62](https://github.com/lictl/WebRA2/issues/62) composes the
[verified browser reader](browser-verified.md), [runtime INI compiler](runtime-ini.md)
and [CSF catalog](../packages/content/src/csf-decode.ts) in
[`assembleProfileContent`](../packages/content/src/profile-content.ts).
It accepts an explicit, profile-specific ordered plan; it does not infer archive
precedence, discover filenames or choose between ambiguous source candidates.

The output covers definitions and one selected opening mission. It always reports
`canStartCampaign: false`: geometry, objects, runtime assets, mission interpretation
and playable mechanics remain separate work. The `ContentIdentity` envelope has
this limited scope until a later policy incorporates the full runtime dependency
manifest. It must not be used to claim that an installation is campaign-ready.

## Input and composition policy

Each file supplies profile, normalized logical path, role, globally unique order,
explicit layer kind and a pinned root/member identity. Required roles are rules,
art, AI, battle selection, map selection, mission briefing, sound definitions,
mission map, strings and font. Mission, strings and font have exactly one source;
other roles may have ordered layers. Every rules layer precedes the mission layer.
The policy treats the map as the last rules override. These are versioned engine
choices, not a universal claim about every native mod or archive loader.

Rules and map INI compile together. The standalone mission and the six other INI
namespaces compile independently, preventing art or sound sections from replacing
rules with matching names. CSF text remains in an immutable catalog with duplicate
labels surfaced as ambiguity. The font is read and verified for its content
identity but is not parsed or retained by this component.

Before asynchronous work, the assembler validates and detaches the plan. It caps
128 files, 32 MiB aggregate member bytes, 16 MiB per member and 32 ordered mods.
INI layer limits also apply. Cross-profile sources, conflicting role/path choices,
duplicate orders, unsafe paths and missing roles fail before reads. These are
input-byte limits, not a claim about total process memory.

Reads are sequential. The supplied reader verifies pinned root/member identities;
the assembler checks returned length, rejects shared buffers, snapshots returned
bytes and independently hashes that snapshot before compilation. A faulty adapter
cannot substitute bytes merely by returning matching metadata. The caller owns
reader lifetime and should share one AbortSignal with both reader and assembler
for prompt I/O cancellation. Callback exceptions or abort yield no partial result.
Bounded synchronous INI/CSF compilation should run in the application worker.

## Identity and provenance

The policy is `webra2-profile-content-1`. SHA-256 fingerprints encode JSON with
explicit stable key order: policy, INI policy, CSF policy, engine compatibility
version, profile, ordered mod hashes, and files sorted by declared order. Each
semantic file contains path, role, order, kind, member size and member SHA-256.
The manifest fingerprint covers every selected role; the rules fingerprint covers
rules plus the selected mission. Changing semantic choices changes the identity.

Opaque picker IDs, physical root hashes and archive offsets remain in output
provenance but are excluded from semantic fingerprints. Equivalent loose and
archived member bytes can therefore share compatibility identity. This is verified
with genuinely different root bytes/offsets, not just renamed IDs. Engine consumers
must retain the policy and scope and expand them when new runtime inputs matter.

## Validation

With Node 24.20.0 and `npm ci`:

```sh
node --import tsx --test tests/content/profile-content.test.ts
npm run check
git diff --check
```

Original synthetic Blob/CSF fixtures cover namespace isolation and map overrides,
Traditional Chinese lookup, independent Node SHA-256 calculation, equivalent
physical representations, order/profile/mod changes, detached plans, malformed
plans, substituted bytes, cancellation and realms without SharedArrayBuffer.

A separate private probe read the ten selected definition groups in each
[M0 reference profile](analysis/m0-reference-profile.json) through genuine Node
`fs.openAsBlob` and the verified browser-session API. It used roles in the order
rules, art, AI, battle, mapsel, briefing, sound, strings, font, mission; map kind for
the mission, base kind for other RA2 files and expansion kind for other YR files;
engine version `webra2-m1-content-1`, no mods, and the first equivalent source per
group. No retail strings or bytes are published. This is a Node component probe,
not evidence of browser timing or native mission behavior.

| Aggregate | RA2 | Yuri's Revenge |
| --- | --- | --- |
| Verified selected members | 10 | 10 |
| Member bytes | 2,968,655 | 3,549,265 |
| Session bytes including complete root verification | 341,594,395 | 583,842,395 |
| Rules plus mission entries | 21,919 | 32,226 |
| Standalone mission entries | 4,583 | 8,974 |
| CSF records | 4,479 | 5,211 |

Manifest fingerprints for that explicit plan are RA2
`9b438f71a503d13c8e678f0b723afc7f2055f21116e5c3d12c28f7f9f5d9303d`
and YR `b822fc49daccba5b7d91d7fb453bb6c497c9a89dd8a1f6947a63d5036939a116`.
Rules fingerprints are RA2
`19463ac092c0ce8c229ed0194149d5475761c042c37761bd43687e2efd5c6623`
and YR `1955d7570080eed19f46f3b804190d921756b845665ca2287a4b7ceaf691e980`.
Private reproduction and aggregate results remain under the worker checkout's
ignored `local/probe-profile-content.mjs` and `local/profile-content-facts.json`.
Missing retail assets skip the private gate, not pass it.

This original composition module and its tests are GPL-3.0-or-later because they
compose the existing GPL VFS/content modules; see [licensing](licensing.md).
No new dependency, copied external implementation or bundled retail data is added.
