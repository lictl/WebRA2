# Verified browser asset catalog

[Issue #71](https://github.com/lictl/WebRA2/issues/71) connects
[installation inspection](browser-import.md) to [verified reads](browser-verified.md).
[`inspectBrowserCatalog`](../packages/vfs/src/browser-catalog.ts) accepts selected
Files and an explicit RA2/YR profile and integrity policy. It returns an immutable
inspection report plus logical filename lookup, explicit candidate discovery/read
and terminal disposal. It does not accept a caller-invented report as authority.

The catalog constructs owned native File/Blob snapshots before asynchronous work,
preserving folder-path metadata and ignoring overridden read methods. Inspection
runs once on those same snapshots. The original selection can change without
replacing catalog sources. File handles stay on-device, and no executable, imported
script or asset-network operation is invoked.

## Lookup and byte identity

`lookup(path)` normalizes a logical asset path, searches literal loose names and
both supported MIX filename hashes, and retains every candidate. New ASCII names
can find numeric members absent from the inspector's initial dictionary. Unicode
loose names use literal lookup without inventing a legacy filename encoding.
Candidate rows carry source/physical range/name evidence and integrity eligibility;
returned order is deterministic by root path and physical range, not mount priority.

Excluded roots and known opposite-profile definition names are unavailable, using
the inspector's shared classification policy. Unknown numeric members inherit the
explicit archive scope; this does not infer their semantic game version. Duplicate
loose names and blocked archive ancestors cannot authorize a read. Different
candidate names or byte sources remain ambiguous. There is no first-found winner,
guessed patch precedence or automatic conflict collapse, even after equal bytes
are discovered. Those choices belong to an explicit content/mount plan.

`discover(candidateId)` hashes the complete selected root and the bounded member,
returning caller-owned bytes and a frozen identity. This establishes byte identity,
not publisher authenticity or proof that a hashed filename is correct.
`read(candidateId, expectedSha256)` additionally enforces that required member hash;
an absent or invalid hash fails instead of downgrading to discovery. No partial
verified bytes escape on failure. Expected/observed identities can feed the
[profile assembler](profile-content.md) once candidate selection is resolved.

The original report remains index-only and `canStartCampaign: false`. Lookup does
not change that report into verified content or claim complete dependencies. Full
campaign UI, runtime asset closure, mount/mod choices and rendering are downstream
tasks. Cinematics need a streaming range/decoder path; this bounded member API is
for definitions and individual render assets.

## Budgets and lifecycle

The inspector retains its 4,096-file, 250,000-member, 512-archive and 64 MiB read
limits. This first catalog supports at most 512 eligible accepted root Files and
4,096 matches per lookup. Larger loose-asset sets require a later catalog/session
extension; an exceeded cap rejects explicitly. The verified session retains its
8 GiB aggregate read budget, 4,096 member attempts and 16 MiB/member limit. Oversized
members reject before expensive root hashing. Complete roots use 1 MiB chunks,
within the existing byte-source maximum, to limit native request count. These are
bounded read/allocation policies, not total process-memory measurements.

Only one catalog verification operation runs at a time, including the interval
between root identification and member reading. Progress callbacks cannot reenter
it. The caller's AbortSignal cancels inspection/verification, clears candidate and
handle maps, and makes the catalog terminal. `dispose()` removes listeners, cancels
pending work and awaits settlement. The already-returned report is ordinary bounded
metadata; caller-held copies or returned byte buffers remain the caller's property.
The application should own one worker/catalog lifecycle per selection.

## Verification

Use Node 24.20.0 and `npm ci`, then:

```sh
node --import tsx --test tests/vfs/browser-catalog.test.ts
npm run check
git diff --check
```

Eight original synthetic tests cover genuine Files/Blobs, independent SHA-256
oracles, unseeded numeric names and nested ranges, equivalent but unresolved copies,
literal CJK paths, explicit profile/strict/duplicate blocking, detached selections,
overridden methods, required-hash failures, reentrancy, abort/disposal and caps.

A separate private Node `fs.openAsBlob` probe inspected all 438 recursively selected
files, looked up every required definition group and discovered each candidate.
Every selected M0 equivalent root/member range and SHA-256 matched independently
pinned [reference identities](analysis/m0-reference-profile.json):

| Aggregate | RA2 | Yuri's Revenge |
| --- | --- | --- |
| Required groups | 10 | 10 |
| Discovered candidate reads | 11 | 12 |
| Inspection bytes | 866,848 | 1,020,238 |
| Verified bytes including complete roots | 344,910,959 | 584,684,645 |

RA2's two equivalent opening-map sources remain visible; YR's differing rules and
sound candidates remain unresolved by the catalog. No retail text or bytes are
published. This is a Node component probe, not browser performance or a campaign
playthrough. Private reproduction and aggregate results remain in the browser-catalog
worktree's ignored `local/probe-catalog.mjs` and `local/catalog-facts.json`.

This original composition and its synthetic tests are GPL-3.0-or-later with the
existing importer/reader; [licensing](licensing.md) and inherited VFS/format notices
apply. No new dependency or copied external implementation is introduced.
