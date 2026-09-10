// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Imported names and diagnostics use textContent only.
import type { BrowserImportReport } from '../../../packages/vfs/src/browser-types.ts';
import { displayDiagnostics } from './report.ts';
import { ImportController, type ShellState } from './controller.ts';
import { translate, diagnosticText, formatBytes, type Locale, type TextKey } from './i18n.ts';
const template = `
<a href="#setup" class="skip" data-i18n="skip"></a>
<div class="layout">
 <aside class="sidebar"><div><a class="brand" href="#setup" aria-label="WebRA2"><span class="brand-mark" aria-hidden="true">W</span><span class="brand-word">WEB<span>RA2</span></span></a><p class="brand-sub" data-i18n="projectTagline"></p></div>
 <div><p class="nav-label" data-i18n="local"></p><nav class="navigation" aria-label="Workspace"><a href="#setup" class="current"><span class="nav-symbol" aria-hidden="true">▤</span><span data-i18n="setupNav"></span></a><a href="#inspection"><span class="nav-symbol" aria-hidden="true">⌕</span><span data-i18n="inspectNav"></span></a><a href="#practice"><span class="nav-symbol" aria-hidden="true">◇</span><span data-i18n="practiceNav"></span></a><a href="#campaign"><span class="nav-symbol" aria-hidden="true">▧</span><span data-i18n="terrainNav"></span></a><a href="#about"><span class="nav-symbol" aria-hidden="true">◈</span><span data-i18n="aboutNav"></span></a></nav></div>
 <div class="sidebar-footer"><div class="connection"><span class="dot" aria-hidden="true"></span><span data-i18n="safeStatus"></span></div><p data-i18n="noCampaign"></p></div></aside>
 <div class="content"><header class="topbar"><div class="topbar-left"><span data-i18n="shellStage"></span><b data-i18n="deviceOnly"></b></div><label class="language-field"><span data-i18n="language"></span><select id="locale" aria-label="Language / 語言"><option value="en">English</option><option value="zh-Hant">繁體中文</option></select></label></header>
 <main id="setup" tabindex="-1"><section class="hero"><div class="eyebrow" data-i18n="kicker"></div><h1 data-i18n="title"></h1><p class="intro" data-i18n="intro"></p></section>
 <div class="setup-grid"><section aria-labelledby="source-title">
 <fieldset class="profile-fieldset"><legend data-i18n="profileLegend"></legend><div class="profile-options"><label class="profile-card"><input type="radio" name="profile" value="ra2" checked><span><strong data-i18n="ra2"></strong><small data-i18n="ra2Sub"></small></span></label><label class="profile-card"><input type="radio" name="profile" value="yr"><span><strong data-i18n="yr"></strong><small data-i18n="yrSub"></small></span></label></div></fieldset>
 <div class="source-panel"><div class="source-icon" aria-hidden="true"></div><h2 id="source-title" data-i18n="sourceTitle"></h2><p class="source-help" data-i18n="sourceHelp"></p>
 <input id="folder-input" class="file-input" type="file" multiple webkitdirectory tabindex="-1" aria-hidden="true"><input id="file-input" class="file-input" type="file" multiple tabindex="-1" aria-hidden="true">
 <div class="picker-actions"><button id="choose-folder" class="primary"><span data-i18n="chooseFolder"></span><span aria-hidden="true">↗</span></button><button id="choose-files" data-i18n="chooseFiles"></button></div><p id="folder-fallback" class="fallback" data-i18n="folderFallback" hidden></p>
 <div class="selection-strip"><span class="selection-icon" aria-hidden="true">↳</span><div class="selection-text"><strong id="selection-title"></strong><p id="selection-detail"></p></div><button id="clear" class="quiet" data-i18n="clear" hidden></button></div>
 </div><details class="options"><summary data-i18n="validation"></summary><div class="options-inner"><label for="policy" data-i18n="policy"></label><select id="policy"><option value="tolerant" data-i18n="tolerant"></option><option value="strict" data-i18n="strict"></option></select><p data-i18n="policyHelp"></p></div></details>
 <div class="inspect-actions"><button id="inspect" class="primary" data-i18n="inspect" disabled></button><button id="cancel" data-i18n="cancel" hidden></button><span id="selection-hint" class="inline-note" data-i18n="selectionHint"></span></div><div id="error-note" class="error-note" role="alert" hidden></div>
 </section>
 <aside class="session-panel" aria-labelledby="session-title"><div class="session-heading"><span class="eyebrow" data-i18n="workspace"></span><span class="session-number">/ 01</span></div><div class="session-icon" aria-hidden="true">↳</div><h3 id="session-title"></h3><p id="session-copy" class="session-copy"></p><dl class="metrics"><div><dt data-i18n="selected"></dt><dd id="file-count">0</dd></div><div><dt data-i18n="size"></dt><dd id="selected-size">—</dd></div><div><dt data-i18n="archiveCount"></dt><dd id="archive-count">—</dd></div><div><dt data-i18n="memberCount"></dt><dd id="member-count">—</dd></div></dl><p class="session-bottom" data-i18n="limitNote"></p>
 <div id="progress-box" class="progress-box" hidden><div class="progress-top"><span id="progress-phase"></span><span id="progress-count"></span></div><progress id="progress" value="0" max="1"></progress><p id="current-path" class="current-path"></p><p id="bytes-read" class="current-path"></p></div></aside></div>
 <section id="inspection" class="results" aria-labelledby="results-title"><div class="results-head"><div><div class="eyebrow" data-i18n="resultsKicker"></div><h2 id="results-title" data-i18n="resultsTitle"></h2></div></div><div id="results-placeholder" class="results-placeholder"><span class="empty-grid" aria-hidden="true"></span><span data-i18n="resultsEmpty"></span></div><div id="report" hidden></div></section>
 <footer id="about" class="about"><div><h3 data-i18n="privacyTitle"></h3><p data-i18n="privacyBody"></p></div><div><h3 data-i18n="buildTitle"></h3><p data-i18n="buildBody"></p></div></footer><p class="copyright" data-i18n="footerTagline"></p>
 </main></div></div><div id="announcement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>`;
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
}
export function mountShell(root: HTMLElement, controller: ImportController): () => void {
  root.innerHTML = template;
  const get = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const file = get<HTMLInputElement>('file-input'), folder = get<HTMLInputElement>('folder-input');
  const canFolder = 'webkitdirectory' in folder;
  get('choose-folder').hidden = !canFolder; get('folder-fallback').hidden = canFolder;
  get('choose-files').addEventListener('click', () => file.click()); get('choose-folder').addEventListener('click', () => folder.click());
  for (const input of [file, folder]) input.addEventListener('change', () => { if (input.files?.length) controller.select(input.files); input.value = ''; });
  get('clear').addEventListener('click', () => controller.clear());
  get('inspect').addEventListener('click', () => { void controller.inspect(); });
  get('cancel').addEventListener('click', () => { controller.cancel(); get('inspect').focus(); });
  get<HTMLSelectElement>('locale').addEventListener('change', event => controller.setLocale((event.target as HTMLSelectElement).value as Locale));
  get<HTMLSelectElement>('policy').addEventListener('change', event => controller.setPolicy((event.target as HTMLSelectElement).value as 'tolerant' | 'strict'));
  root.querySelectorAll<HTMLInputElement>('input[name="profile"]').forEach(input => input.addEventListener('change', () => { if (input.checked) controller.setProfile(input.value as 'ra2' | 'yr'); }));
  let previousLocale: Locale | null = null, previousReport: BrowserImportReport | null = null, lastAnnouncement = '';
  let page = 0;
  function renderReport(report: BrowserImportReport, locale: Locale) {
    const t = (key: TextKey) => translate(locale, key), target = get('report'); target.replaceChildren();
    target.append(element('p', t('resultScope'), 'scope-note'));
    const stats = element('div', undefined, 'result-stats');
    for (const [key, value] of [['accepted', report.summary.acceptedFiles], ['ignored', report.summary.ignoredFiles], ['named', report.summary.namedMembers]] as const) { const stat = element('span'); stat.append(element('b', value.toLocaleString(locale)), document.createTextNode(t(key))); stats.append(stat); } target.append(stats); const readStat = element('span'); readStat.append(element('b', formatBytes(report.summary.bytesRead, locale)), document.createTextNode(t('read'))); readStat.title = `${report.summary.bytesRead} B`; readStat.id = 'report-read-bytes'; stats.append(readStat);
    function block(title: TextKey, help?: TextKey) { const box = element('section', undefined, 'report-block'), head = element('div', undefined, 'report-block-header'); head.append(element('h3', t(title))); if (help) head.append(element('p', t(help))); box.append(head); target.append(box); return box; }
    const sourceById = new Map(report.files.map(source => [source.id, source.path]));
    const archiveById = new Map(report.archives.map(archive => [archive.id, archive]));
    const requirements = block('requirements', 'requirementHelp'), wrap = element('div', undefined, 'table-wrap'), table = element('table');
    table.setAttribute('aria-label', t('requirements'));
    const head = element('thead'), headings = element('tr'); for (const key of ['filename', 'condition', 'origins'] as const) { const th = element('th', t(key)); th.scope = 'col'; headings.append(th); } head.append(headings); table.append(head);
    const body = element('tbody');
    for (const row of report.requirements) {
      const tr = element('tr'); tr.append(element('td', row.path, 'file-cell'));
      const state = element('td'); state.append(element('span', t(row.status), `status-badge status-${row.status}`)); tr.append(state);
      const origins = element('td', undefined, 'source-count');
      if (!row.matches.length) origins.textContent = '—';
      else {
        const details = element('details'), summary = element('summary', `${row.matches.length} ${t('matchesUnit')}`); details.append(summary);
        for (const match of row.matches.slice(0, 20)) { const archive = match.archiveId ? archiveById.get(match.archiveId) : null;
          details.append(element('p', `${sourceById.get(match.sourceId) ?? match.sourceId}${archive ? ` → ${archive.nameCandidates.join(' / ') || archive.id}` : ''}${match.ordinal === null ? '' : ` · #${match.ordinal}`}`)); }
        if (row.matches.length > 20) details.append(element('p', `20 / ${row.matches.length} ${t('shown')}`)); origins.append(details);
      }
      tr.append(origins); body.append(tr);
    }
    table.append(body); wrap.append(table); requirements.append(wrap);
    const diagnosticBox = block('diagnostics');
    if (!report.diagnostics.length) diagnosticBox.append(element('p', t('noDiagnostics'), 'no-diagnostics'));
    else {
      const list = element('ul', undefined, 'diagnostics-list');
      for (const diagnostic of displayDiagnostics(report.diagnostics)) { const li = element('li'), top = element('div', undefined, 'diagnostic-top'); top.append(element('span', t(diagnostic.severity), `severity-${diagnostic.severity}`), element('span', diagnostic.code, 'diagnostic-code')); li.append(element('p', diagnosticText(locale, diagnostic.code), 'diagnostic-explanation'), top); if (diagnostic.path || diagnostic.sourceId) li.append(element('p', diagnostic.path ?? sourceById.get(diagnostic.sourceId!) ?? diagnostic.sourceId, 'diagnostic-path')); list.append(li); }
      diagnosticBox.append(list); if (report.diagnostics.length > 100) diagnosticBox.append(element('p', `100 / ${report.diagnostics.length} ${t('shown')}`, 'no-diagnostics'));
    }
    const sources = block('sourcesTitle', 'sourcesHelp'), sourcesWrap = element('div', undefined, 'table-wrap'), sourceTable = element('table');
    sourceTable.setAttribute('aria-label', t('sourcesTitle'));
    const sourceHead = element('thead'), sourceTitles = element('tr'); for (const key of ['filename', 'type', 'bytes', 'condition'] as const) { const th = element('th', t(key)); th.scope = 'col'; sourceTitles.append(th); } sourceHead.append(sourceTitles); sourceTable.append(sourceHead);
    const sourceBody = element('tbody'); page = Math.max(0, Math.min(page, Math.ceil(report.files.length / 25) - 1));
    for (const source of report.files.slice(page * 25, page * 25 + 25)) { const row = element('tr'); row.append(element('td', source.path, 'file-cell'), element('td', t(({ archive: 'kindArchive', loose: 'kindLoose', program: 'kindProgram', unsupported: 'kindUnsupported' } as const)[source.kind])), element('td', formatBytes(source.size, locale)), element('td', `${t(({ accepted: 'statusAccepted', ignored: 'statusIgnored', invalid: 'statusInvalid', duplicate: 'statusDuplicate' } as const)[source.status])} · ${t(({ eligible: 'profileEligible', excluded: 'profileExcluded', unassigned: 'profileUnassigned' } as const)[source.profileStatus])}`)); sourceBody.append(row); }
    sourceTable.append(sourceBody); sourcesWrap.append(sourceTable); sources.append(sourcesWrap);
    if (report.files.length > 25) { const bar = element('div', undefined, 'pagination'), label = element('span', `${t('page')} ${page + 1} ${t('of')} ${Math.ceil(report.files.length / 25)}`), buttons = element('div', undefined, 'pagination-buttons');
      const previous = element('button', t('previous')), next = element('button', t('next')); previous.disabled = page === 0; next.disabled = (page + 1) * 25 >= report.files.length;
      previous.dataset.pageDirection = 'previous'; next.dataset.pageDirection = 'next';
      function changePage(delta: number) { page += delta; renderReport(report, locale); const direction = delta > 0 ? 'next' : 'previous'; const preferred = target.querySelector<HTMLButtonElement>(`[data-page-direction="${direction}"]:not(:disabled)`); (preferred ?? target.querySelector<HTMLButtonElement>('[data-page-direction]:not(:disabled)'))?.focus(); }
      previous.addEventListener('click', () => changePage(-1)); next.addEventListener('click', () => changePage(1)); buttons.append(previous, next); bar.append(label, buttons); sources.append(bar); }
  }
  function render(state: ShellState) {
    const t = (key: TextKey) => translate(state.locale, key), busy = state.phase === 'inspecting';
    const changedLocale = previousLocale !== state.locale;
    if (changedLocale) { root.querySelectorAll<HTMLElement>('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n as TextKey); }); document.documentElement.lang = state.locale; root.querySelector('nav')?.setAttribute('aria-label', t('navLabel')); get<HTMLSelectElement>('locale').value = state.locale; get('progress').setAttribute('aria-label', t('progress')); previousLocale = state.locale; }
    for (const id of ['choose-folder', 'choose-files', 'clear', 'policy']) (get(id) as HTMLButtonElement | HTMLSelectElement).disabled = busy;
    file.disabled = folder.disabled = busy;
    root.querySelectorAll<HTMLInputElement>('input[name="profile"]').forEach(input => { input.disabled = busy; input.checked = input.value === state.profile; });
    get<HTMLSelectElement>('policy').value = state.policy;
    const inspect = get<HTMLButtonElement>('inspect'); inspect.disabled = busy || !state.selection.count; inspect.textContent = t(busy ? 'inspecting' : 'inspect');
    get('cancel').hidden = !busy; get('selection-hint').hidden = busy; get('clear').hidden = !state.selection.count;
    get('selection-title').textContent = state.selection.count ? `${state.selection.count.toLocaleString(state.locale)} ${t('filesUnit')} · ${formatBytes(state.selection.bytes, state.locale)}` : t('selectionEmpty');
    get('selection-detail').textContent = state.selection.count ? state.selection.preview.join(' · ') + (state.selection.count > 3 ? ' …' : '') : t('selectionHint');
    const titles: Record<ShellState['phase'], TextKey> = { empty: 'readyTitle', selected: 'selectedTitle', inspecting: 'runningTitle', cancelled: 'cancelledTitle', failed: 'failedTitle', complete: state.report?.status === 'limited' ? 'limitedTitle' : 'inspectedTitle' };
    const descriptions: Record<ShellState['phase'], TextKey> = { empty: 'readyBody', selected: 'selectedBody', inspecting: 'selectedBody', cancelled: 'cancelledBody', failed: 'failedBody', complete: 'inspectedBody' };
    get('session-title').textContent = t(titles[state.phase]); get('session-copy').textContent = t(descriptions[state.phase]);
    get('file-count').textContent = state.selection.count.toLocaleString(state.locale); get('selected-size').textContent = state.selection.count ? formatBytes(state.selection.bytes, state.locale) : '—';
    get('archive-count').textContent = (state.report?.summary.archives ?? state.progress?.archives)?.toLocaleString(state.locale) ?? '—'; get('member-count').textContent = (state.report?.summary.members ?? state.progress?.members)?.toLocaleString(state.locale) ?? '—';
    get('progress-box').hidden = !busy;
    const phaseKeys = { validate: 'phaseValidate', archives: 'phaseArchives', requirements: 'phaseRequirements' } as const;
    get('progress-phase').textContent = t(state.progress ? phaseKeys[state.progress.phase] : 'phaseValidate');
    get('progress-count').textContent = `${state.progress?.filesProcessed ?? 0} / ${state.progress?.totalFiles ?? state.selection.count}`;
    const progress = get<HTMLProgressElement>('progress'); progress.max = Math.max(1, state.progress?.totalFiles ?? state.selection.count); progress.value = Math.min(progress.max, Math.max(0, state.progress?.filesProcessed ?? 0));
    get('current-path').textContent = state.progress?.currentPath ?? ''; get('bytes-read').textContent = `${t('read')}: ${formatBytes(state.progress?.bytesRead ?? 0, state.locale)}`;
    get('error-note').hidden = !state.error; get('error-note').textContent = state.error ? t(state.error) : '';
    get('results-placeholder').hidden = Boolean(state.report); get('report').hidden = !state.report;
    if (state.report && (state.report !== previousReport || changedLocale)) { if (state.report !== previousReport) page = 0; renderReport(state.report, state.locale); }
    if (!state.report && previousReport) get('report').replaceChildren(); previousReport = state.report;
    const announcement = `${t(titles[state.phase])}${busy ? ` · ${get('progress-phase').textContent}` : ''}`;
    if (announcement !== lastAnnouncement) { get('announcement').textContent = announcement; lastAnnouncement = announcement; }
  }
  const unsubscribe = controller.subscribe(render);
  return () => { unsubscribe(); root.replaceChildren(); };
}
