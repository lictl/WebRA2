# Verified local source ranges for analysis

Issue [#24](https://github.com/lictl/WebRA2/issues/24). This Node-only adapter supports
the profile/campaign investigations under [#18](https://github.com/lictl/WebRA2/issues/18).
It is original MIT code and introduces no dependency or browser runtime component.
Game payloads remain local; the adapter returns bytes to a local caller, not a server.

```ts
import { createVerifiedSourceReader } from '../../tools/analysis/verified-source.ts';

const reader = await createVerifiedSourceReader('/path/to/game');
try {
  // Identity comes from a pinned census record, including absolute root-file offset.
  const bytes = await reader.read({
    rootFile, rootSha256, absoluteOffset, size, sha256,
  });
  // Parse locally. Publish reviewed factual metadata, never this byte buffer.
} finally {
  await reader.close();
}
```

The identity matches `source` records in the campaign census. Every root is hashed
with streaming SHA-256 before its first member is returned. The requested range is
bounded against the actual file and hashed separately. Names must be single root
filenames; slash/backslash/drive/path traversal and control bytes are rejected.
Leaf symlinks and non-regular files are rejected. The supplied directory is resolved
once, so an explicitly supplied directory symlink denotes its resolved target.

Successful root hashes are cached with device/inode, size, nanosecond modification
and change times. Each read opens/closes its own handle and compares those fields
before/after use. A replaced or changed cached root requires a new reader and census
identity. Read errors close the handle and do not leave a permanent busy state.
This detects ordinary local source changes; it is not a publisher authenticity check
or a defense against an adversary controlling the filesystem and its metadata.
Callers must keep the source directory stable while analyzing it.

Reads are sequential: a concurrent request rejects with `reader-busy`. `close()`
prevents new reads, waits for an active operation and clears cached identities; it
does not cancel a read in progress. Returned buffers belong to the caller and are
not retained. Callers remain responsible for limiting retained decoded documents.

| Option | Default | Supported bound |
| --- | ---: | ---: |
| `maxMemberBytes` | 16 MiB | 0–64 MiB |
| `maxRootBytes` | 4,296,000,000 bytes | 0–4,296,000,000 bytes |
| `maxRoots` | 128 verified roots | 1–512 |
| `chunkBytes` | 1 MiB | 1 byte–8 MiB |

Memory for active byte buffers is bounded by one member and one hash chunk; full
root archives are never retained. Errors expose stable codes and generic messages,
without byte payloads or absolute filesystem paths. SHA-256 pins the chosen input
revision; it is separate from the legacy MIX trailer SHA-1 policy in #11.

Original synthetic tests exercise unaligned/empty ranges, hash and source changes,
traversal/symlinks, limits, concurrent calls, close/drain behavior and recovery after
failed reads. Run `node tools/run-tests.mjs tests/analysis` with the pinned Node
version. Actual profile/campaign private reads are validated by their consumer PRs.
