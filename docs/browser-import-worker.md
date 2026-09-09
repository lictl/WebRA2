# Bounded file reads in an import worker

[Issue #64](https://github.com/lictl/WebRA2/issues/64) adds a dedicated-worker path
to [`createBrowserByteSource`](../packages/vfs/src/browser-source.ts). Its public
API and the [installation inspection API](browser-import.md) stay unchanged.
The adapter captures `FileReaderSync` only when the current global is a
`DedicatedWorkerGlobalScope` and the reader constructor is available. It constructs
one reader lazily on the first nonempty range and reuses it for that adapter.
Main-window use, shared/service workers and dedicated workers without the
capability retain the existing asynchronous `Blob.arrayBuffer()` path.

The motivation is measured request shape: one private 438-file inspection made
36,923 range calls, including 36,574 calls of at most 16 bytes, and returned 118
archives, 14,912 member records and 1,149,148 bytes read. This does not measure
individual Safari call latency or establish a speedup. The integrated app's worker
entry, progress bridge, termination and actual four-browser observations are
coordinated under [app issue #27](https://github.com/lictl/WebRA2/issues/27).
This source component does not itself start a worker.

## Read ownership and cancellation

Both paths validate integer ranges and retain the 1 MiB maximum per read, one
active read per adapter and four underlying reads per loaded module. These are
module limits, not a cross-worker process quota. Inspection's separate 64 MiB
attempted-read budget remains unchanged. A read reserves its adapter and module
slot before `beforeRead`, so a callback cannot reenter the same adapter to bypass
ownership. An empty EOF range invokes `beforeRead(0)` without constructing a reader
or invoking `onRead`.

The worker path reads only the requested Blob slice. Exact returned length is
checked before `onRead`; a short result rejects with `browser-short-read`.
Construction, slicing, native read and callback failures release the reservation
and remain visible to the caller. A failed native reader does not cause an
automatic asynchronous retry. A subsequent explicit caller read may try again.
Successful reads return independent native ArrayBuffers through Uint8Array views.
No range cache, larger read-ahead allocation, new dependency or permission is added.

Abort is checked before reserving a range, after `beforeRead`, after constructing
the reader, after slicing and after `onRead`. A synchronous native read cannot
process a posted worker cancellation message while it runs. It returns before
that worker can handle another event-loop task. The importer still yields at its
existing [cooperative checkpoints](browser-yield.md); the app bridge must terminate
a cancelled/replaced worker and reject stale generations. The main-window async
path still rejects abort promptly while retaining its slot until the underlying
bounded Blob read settles. Neither path promises execution in a suspended tab.

Selected File handles may be structured-cloned into the explicit application
worker. The bridge should return bounded metadata/progress only, execute no
imported code and transfer no asset data to a server. Those application boundaries
require their own worker lifecycle and actual browser checks; the component tests
below do not establish them.

## Verification and provenance

With Node 24.20.0 and `npm ci`:

```sh
node --import tsx --test tests/vfs/browser-source.test.ts
npm run check
git diff --check
```

The 14 original source tests include six worker-path cases using explicitly fake
worker capabilities in Node. They cover exact and independent range results,
empty EOF, bounds and caps, lazy reuse and constructor capture, main-window and
unavailable-worker fallback, construction/native/short-read failures, callback
errors, reentrancy, cancellation and shared ownership with pending async reads.
These tests verify control flow and resource accounting; they do not run native
FileReaderSync or measure browser performance. Real File/folder import, cancellation,
retry, metadata equivalence and timing remain integrated browser gates in #27/#64.

The [File API's synchronous worker reader](https://w3c.github.io/FileAPI/#FileReaderSync)
defines the native operation. Platform references describe
[readAsArrayBuffer and its errors](https://developer.mozilla.org/en-US/docs/Web/API/FileReaderSync/readAsArrayBuffer)
and [DedicatedWorkerGlobalScope](https://developer.mozilla.org/en-US/docs/Web/API/DedicatedWorkerGlobalScope).
These primary references were checked on 2026-09-10; no implementation code was
copied. The source and original synthetic tests remain GPL-3.0-or-later with the
existing VFS/MIX composition. See [project licensing](licensing.md). No retail
fixture, payload, binary or private recording is included.
