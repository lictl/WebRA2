# Local installation shell

Issue [#27](https://github.com/lictl/WebRA2/issues/27) adds the first original
application UI under `apps/web/`. It composes the
[browser importer](browser-import.md); campaign play is explicitly unavailable.
The coordinator-owned build/localhost launcher in
[PR #46](https://github.com/lictl/WebRA2/pull/46) provides `npm run build` and
`npm run preview` after integration. The entry is `apps/web/src/main.ts` and CSS
is bundled locally. No remote font, artwork, runtime import or asset endpoint is used.

The shell supports English and original Traditional Chinese interface text, explicit
RA2/YR selection, folder selection with individual-file fallback, tolerant/strict
inspection, bounded progress, cancellation, replacement, clearing and reinspection.
Strict-mode text explains that this index-only pass does not verify advertised
checksums. Reports distinguish literal files, archive candidates, ambiguity, missing
and blocked requirements; identities and campaign readiness remain unverified.
Source tables are paginated at 25 rows; diagnostics put errors and warnings first; diagnostic and provenance lists disclose
when presentation is truncated. Imported names and technical codes use `textContent`.

The DOM-independent controller owns selected handles and a monotonically increasing
job generation. Cancellation/replacement/profile or policy changes abort old jobs
and prevent stale progress, errors or results from replacing current state. Selection
rejects more than 4,096 files before copying handles. Progress updates preserve the
main controls; pagination restores keyboard focus. Page departure releases handles;
a back/forward-cache return creates a fresh session. No local storage is used.

[Application provenance](../apps/web/PROVENANCE.md) records original WebRA2
attribution and GPL-3.0-or-later composition with the importer/reader. No retail
content is present in app files, fixtures or build outputs.

## Validation in progress

`node --import tsx --test tests/web-ui/controller.test.ts` passes nine synthetic
state/job tests, including cancellation races, profile isolation, malformed adapter
results, unreadable files, selection caps and localization. Two further synthetic tests cover actionable diagnostic ordering and translated recovery.
Explicit strict app TypeScript checking passes. Browser checks use privately selected retail files;
these are separate from public synthetic checks and are not campaign tests.

Current actual Firefox 151.0.1 full-folder YR inspection completed: 438 selected
files, 118 archives, 14,912 entries, 158 accepted / 280 ignored files, 91 named
entries and 1,149,148 bytes read. Traditional Chinese report text was inspected.
Chrome completed an earlier full-folder pass; final-bundle totals are being checked.
Safari selected the full folder and cancellation worked; completion of its retry
remains pending. Edge selected the folder, replaced it with a real `ra2.mix` file,
and reached archive progress; final completion remains pending.

Native browser windows can return stale accessibility/screenshot state; fresh windows
were needed. Do not treat attempted clicks or intermediate progress as completed
imports. Chrome's extension file chooser lacks file-URL permission; native dialogs
work without changing that permission. Private request observations are retained
under ignored `local/import-shell/`; final browser/network evidence will replace
these provisional notes before readiness is claimed.
