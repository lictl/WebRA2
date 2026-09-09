# Verified browser source sessions

[Issue #53](https://github.com/lictl/WebRA2/issues/53) adds the verified-byte layer
after [index inspection](browser-import.md). The session computes complete SHA-256
root identities incrementally and verifies pinned member ranges before returning
bytes. It performs no network, filesystem or persistence operation. Its caller must
keep returned asset bytes local; these are runtime buffers, not public metadata.

## API

The API and readonly types are exported from
[browser-verified.ts](../packages/vfs/src/browser-verified.ts):

```ts
const session = createBrowserVerifiedSession([
  { sourceId: 'file:0', blob: selectedFile },
], { signal, onProgress });

const calculatedRoot = await session.identify('file:0');
const member = await session.discover({
  root: calculatedRoot, absoluteOffset: offset, size,
});
const bytes = await session.read(expectedMemberIdentity);
await session.dispose();
```

`BrowserRootIdentity` is `{ sourceId, size, sha256 }`. `BrowserMemberRange` contains
that `root`, `absoluteOffset` and member `size`; `BrowserMemberIdentity` adds the
member `sha256`. `read()` requires complete expected root and member identities.
`discover()` verifies its expected root, then returns `{ bytes, identity }` with a
calculated member hash. If the caller has an expected member hash, it must use
`read()`: discovery rejects a `sha256` field even when inherited or explicitly
undefined. An existing expectation cannot silently become a newly computed answer.

`identify()` computes a root identity for an unpinned user-selected file. A matching
digest establishes consistency with the supplied expected bytes, not publisher
authenticity, installation completeness, native load order or campaign compatibility.
Calculated identities do not upgrade the index inspector's advertised MIX SHA-1
checksum state. The session has no implicit RA2/YR selection; callers preserve
explicit profiles and map their importer source IDs into the selected roots.

Source IDs are bounded case-sensitive opaque IDs, with ASCII letters/digits and
`_.:-`; they are never resolved as paths. Root count, duplicate IDs and all selected
Blob brands/sizes are checked before snapshots are created. Native Blob slices
capture immutable roots without reading/copying entire files. Caller arrays, option
objects, replacements and overridden Blob `size`/`slice` methods cannot redirect
an existing session. The selection supplies actual Blob/File bytes, not arbitrary
ByteSource implementations. A new selection needs a new session.

The root cache stores a calculated identity per private snapshot, never full root
or member buffers. Expected root size/hash are checked on every member operation,
including when the root identity is cached. Member bytes are read and hashed again
for every call, then returned in an independent caller-owned buffer. An empty root
or EOF member has the normal SHA-256 empty digest. Identities are projected to known
fields, detached before asynchronous reads and frozen; arbitrary extra input fields
do not become returned metadata.

## Cancellation, disposal and bounds

Operations are sequential. The session reserves its busy state before input getters
or progress callbacks can re-enter. Concurrent/reentrant calls reject with
`session-busy`; callback errors reject the current operation without a partial
digest. The progress payload identifies `root`/`member`, the source ID, current hash
bytes/chunks, successful session bytes read and member attempts. It contains no
payload or file handles. In contrast, the read budget accounts for **reserved range
bytes**, including a range whose I/O later fails; the successful progress count can
therefore be smaller than the budget consumed.

External cancellation is terminal and rejects active/future work with `AbortError`.
`dispose()` closes the session, aborts active work, removes its external listener,
clears snapshot/identity maps and awaits the active operation's settlement. Future
calls reject with `session-disposed`. Cancellation/disposal cannot return a partial
root or member. Native `Blob.arrayBuffer()` itself cannot be stopped: a pending
range retains its underlying adapter slot until native I/O settles, even after the
session's operation has rejected. Repeated disposal cannot free slots prematurely.

| Limit | Default | Hard maximum |
| --- | --- | --- |
| Selected roots | 128 | 512 |
| One complete root | 4,296,000,000 bytes | Same |
| One returned member | 16 MiB | Same |
| Member attempts after identity/range validation | 4,096 | 16,384 |
| Aggregate reserved read bytes | 8 GiB | 16 GiB |
| Hash/read chunk | 64 KiB | 1 MiB |
| Concurrent operations per session/root adapter | One | One |
| Pending native range operations across the adapter module | Four | Four |

`options.limits` can lower the listed limits and explicitly raise defaults only up
to the hard maxima. Invalid declarations are rejected. Failed member/root pins
still consume their attempted reads; valid-range member failures also consume
member-attempt budget. Budget exhaustion does not cache a partial root. Member
output allocation waits until its complete root pin has matched and its complete
range fits the remaining budget. There is no unbounded member cache.

The 8-GiB default is a **separate explicit verification budget**, not an increase to
the inspector's 64-MiB index budget. Constructing the session performs no reads;
the UI must begin verification through a distinct user action and display its
progress/cancellation. At most one 16-MiB returned-member allocation plus bounded
hash/read buffers is owned by an active session. That statement excludes buffers
already returned to callers, browser-internal storage and total process RSS.
The existing incremental hashing yields cooperatively; actual browser foreground
timing and installation-wide throughput remain integration measurements.

## Validation and private reference gate

With Node 24.20.0 and `npm ci` in this checkout:

```sh
node --import tsx --test tests/vfs/browser-verified.test.ts
npm run check
git diff --check
```

Twelve original synthetic tests compare digests against Node crypto and exercise
root/member pins, discovery downgrade rejection, cached-root consistency, detached
inputs, native Blob snapshot behavior, range/allocation/attempt/read caps,
reentrancy, callback failures, abort/disposal and retention of all four pending
native range slots. A synthetic file-backed Node Blob additionally rejects reads
after its backing file changes; browser File snapshots and OS change reporting
remain platform behavior, and cached identity alone does not promise future read
availability. No mutable arbitrary source is accepted into this session.

A separate private Node `fs.openAsBlob` probe verified both selected first campaign
source identities from the [M0 reference manifest](analysis/m0-reference-profile.json).
For each opening it verified the complete root, read the pinned member, retrieved
the cached root identity and independently discovered the same member range again:

| Opening | Root bytes hashed once | Member bytes per read | Total source bytes read | Pins |
| --- | --- | --- | --- | --- |
| RA2 `all01t.map` | 3,823,604 | 146,240 | 4,116,084 | Root and member match |
| YR `all01umd.map` | 4,419,780 | 301,077 | 5,021,934 | Root and member match |

Each probe used two member attempts and 64-KiB chunks. The ignored script and
metadata-only facts are `local/browser-verified-opening-probe.mjs` and
`local/browser-verified-opening-facts.json` in the developer's repository. No asset
payload was logged, saved, executed or published. These are Node component results;
they do not establish actual browser UI behavior or campaign playability.

## Provenance

The new adapter and original tests are GPL-3.0-or-later and compose the existing
browser source, MIX range checks and incremental hash module. No new dependency or
algorithm copy is introduced. Exact inherited dependencies/notices remain in
[hash provenance](../packages/vfs/HASH_PROVENANCE.md),
[format provenance](../packages/formats/PROVENANCE.md) and
[project licensing](licensing.md).
