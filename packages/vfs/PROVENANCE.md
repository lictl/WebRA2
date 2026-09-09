# VFS resolver provenance

`src/profile.ts`, `tests/vfs/`, and `tools/analysis/profile-census.ts` are original
WebRA2 code under the repository's [MIT license](../../LICENSE). The resolver
imports only the original `ProfileId` TypeScript type. No runtime dependency,
vendored decoder, third-party loader algorithm or game code was adopted here.

The adapter consumes reviewed factual census metadata as JSON. It does not import
the GPL MIX/content implementations or copy their parsing code. The census tools
themselves retain their existing GPL notices; this component does not relicense
them. Any combined distribution including those GPL components remains subject to
the [existing distribution obligations](../../docs/licensing.md).

[Profile evidence](../../docs/analysis/profile-resolution.md) separately records
observations from the GPL-3.0 EA editor at a pinned revision. Its lookup algorithm
was inspected to bound compatibility claims, not translated or implemented as our
rank policy. The report distinguishes editor behavior, retail filename metadata,
explicit WebRA2 policy and unresolved original runtime behavior. No retail payload
or source-code listing is published in this component.
