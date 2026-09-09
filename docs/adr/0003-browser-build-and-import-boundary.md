# ADR 0003 — Browser build and first import boundary

Status: accepted for M1 implementation, 2026-09-10. Work: [#27](https://github.com/lictl/WebRA2/issues/27),
[#44](https://github.com/lictl/WebRA2/issues/44), [#45](https://github.com/lictl/WebRA2/issues/45).
The owner now authorizes continued implementation toward playable UI and RA2/YR
campaigns; the earlier M0 stopping instruction is superseded.

The first app uses original HTML, CSS and TypeScript with a DOM shell. Promote
**esbuild 0.28.2** from the existing locked development tree to a direct exact
build dependency. Its npm metadata and installed MIT license were checked locally;
no new version or browser runtime library is introduced. The
[official build API](https://esbuild.github.io/api/) and
[browser bundling guide](https://esbuild.github.io/getting-started/#bundling-for-the-browser)
support explicit entrypoints, ESM output and build-input metadata. Framework and
full development-server adoption are deferred until there is a concrete need.

`npm run build` compiles `apps/web/src/main.ts` and the explicit
`apps/web/src/import-worker.ts` entry, plus their code imports, into ignored `dist/`.
`npm run preview` serves that build at `http://127.0.0.1:4173`;
`npm start` builds then starts it. `npm run check` builds the actual application
after public checks, so CI catches missing entries and forbidden dependencies.
Browser syntax targets ES2022; this is a compilation target, not a minimum
browser-support claim. Actual browser behavior evidence belongs in the
[application report](../import-shell.md).

Build input is restricted to app/package source and the adopted Blowfish and @noble/hashes runtime
packages, with explicit file extensions and per-input/output caps. Resolved symlinks
cannot bring in `game/`, `local/` or unrelated paths. The build creates a hash/size
manifest and carries license/provenance notices. The launcher validates all output
routes and hashes before listening, caches app code only, binds to loopback, validates
Host and serves GET/HEAD on exact manifest routes. It has no asset path or upload
handler. A CSP blocks network connections from app code; user file selection uses
File/Blob APIs. The allowlisted `/workers/import.js` is bundled application code,
not imported mod code. Each job clones File handles into one dedicated worker,
returns bounded/coalesced metadata and terminates on completion or cancellation.
The [worker byte-source path](../browser-import-worker.md) uses FileReaderSync only
in a supported dedicated worker, with asynchronous component fallback elsewhere.
These structural checks complement manual payload review and actual
browser network evidence; they do not identify copyrighted bytes copied into source.

This is a local development distribution. Combined GPL component source and notices
remain required before releasing a hosted/downloadable engine. The repository is
the corresponding source/build-instruction location for this build; production
release packaging and codec configuration need their own audit. No deployment,
CDN, analytics, storefront binary, runtime codec binary or game asset is introduced.

The first inspector is intentionally **index-only**: it reads bounded archive indexes
and supported loose-file metadata within the 64 MiB inspection budget. It must label
root/member hashes and advertised checksums unverified when it has not consumed
those bytes. Strict/tolerant behavior uses the existing integrity policy; it cannot
forge verified hashes to feed the pure profile resolver. Filename hashes identify
candidates, and conflicts/missing content remain visible. Native executables are
ignored and are never required or executed.

The importer owns `packages/vfs/src/browser-types.ts` and its inspection API; the shell
consumes that single contract. No File/Blob/asset bytes occur in public report fields.
Private handles remain within the import session. Incremental source hashing,
verified reader sessions, runtime INI and terrain compilation now exist as components;
their application integration, complete dependency resolution, ZIP support,
persistent storage and the asset-serving localhost path remain bounded M1/M2 tasks.
Index inspection does not close all of M1 or make a
campaign playable. The independent simulation foundation uses existing wire envelopes
and a separately versioned synthetic policy; it makes no native timing/RNG claim.
