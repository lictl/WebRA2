// SPDX-License-Identifier: GPL-3.0-or-later
import { PracticeController, type PracticeState } from './practice-controller.ts';
import { practiceText, practiceEvent, type PracticeText } from './practice-i18n.ts';
import type { PracticeId } from './practice-protocol.ts';
import type { SaveSlot } from './practice-storage.ts';
import './practice.css';
const template = `<a href="#practice-main" class="skip" data-practice-text="skip"></a><div class="layout">
<aside class="sidebar"><a class="brand" href="#setup" aria-label="WebRA2"><span class="brand-mark" aria-hidden="true">W</span><span class="brand-word">WEB<span>RA2</span></span></a><nav class="navigation"><a href="#setup" data-practice-text="installation"></a><a href="#practice" class="current" data-practice-text="nav"></a></nav><p class="sidebar-footer" data-practice-text="footer"></p></aside>
<div class="content"><header class="topbar"><div class="topbar-left"><span data-practice-text="stage"></span><b data-practice-text="device"></b></div><select id="practice-locale" aria-label="Language / 語言"><option value="en">English</option><option value="zh-Hant">繁體中文</option></select></header>
<main id="practice-main" tabindex="-1"><section class="hero"><div class="eyebrow" data-practice-text="kicker"></div><h1 data-practice-text="title"></h1><p class="intro" data-practice-text="intro"></p></section>
<div class="practice-toolbar"><label><span data-practice-text="scenario"></span> <select id="practice-scenario"><option value="relay" data-practice-text="relay"></option><option value="crossfire" data-practice-text="crossfire"></option></select></label><button id="practice-start" class="primary" data-practice-text="begin"></button><button id="practice-run" data-practice-text="resume"></button><button id="practice-step" data-practice-text="step"></button></div>
<div class="practice-layout"><section><div class="practice-status"><strong id="practice-outcome"></strong><span id="practice-clock"></span></div><div id="practice-grid" class="practice-grid" role="group" aria-describedby="practice-help"></div><p id="practice-help" class="scope-note" data-practice-text="instructions"></p><div class="practice-selection"><span id="practice-selected"></span><span id="practice-pending"></span></div><details class="practice-details"><summary data-practice-text="diagnostics"></summary><p data-practice-text="hashHelp"></p><label data-practice-text="hash"></label><output id="practice-hash"></output><p data-practice-text="trace"></p><p id="practice-events"></p><button id="practice-verify" data-practice-text="verify"></button></details></section>
<section class="session-panel practice-saves"><h2 data-practice-text="saves"></h2><p class="session-copy" data-practice-text="saveHelp"></p><label for="practice-slot" data-practice-text="slot"></label><select id="practice-slot"><option value="1">1</option><option value="2">2</option><option value="3">3</option></select><div class="practice-save-buttons"><button id="practice-save" class="primary" data-practice-text="save"></button><button id="practice-load" data-practice-text="load"></button><button id="practice-delete" data-practice-text="remove"></button><button id="practice-export" data-practice-text="export"></button><button id="practice-import" data-practice-text="import"></button></div><input id="practice-file" type="file" accept=".json,application/json" class="file-input" tabindex="-1" aria-hidden="true"><p id="practice-notice" role="status" aria-live="polite"></p><button id="practice-cancel" data-practice-text="cancel"></button></section></div></main></div></div>`;
export function mountPractice(root: HTMLElement, controller: PracticeController): () => void {
  root.innerHTML = template;
  const get = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const click = (id: string, fn: () => void) => get(id).addEventListener('click', fn);
  let focusCell = 0, lastLocale = '', lastScenario = '', timer: ReturnType<typeof setTimeout> | null = null, alive = true;
  const grid = get('practice-grid'), cells: HTMLButtonElement[] = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) {
    const index = cells.length, button = document.createElement('button'); button.className = 'practice-cell'; button.type = 'button'; button.tabIndex = index ? -1 : 0;
    button.addEventListener('focus', () => { cells[focusCell]!.tabIndex = -1; focusCell = index; button.tabIndex = 0; });
    button.addEventListener('keydown', event => { const delta = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -12, ArrowDown: 12 } as Record<string, number>)[event.key]; if (delta === undefined) return; event.preventDefault(); cells[Math.max(0, Math.min(95, index + delta))]!.focus(); });
    button.addEventListener('click', () => {
      const state = controller.state, snapshot = state.snapshot; if (!snapshot || state.busy) return;
      const unit = snapshot.units.find(u => u.x === x && u.y === y);
      if (unit?.owner === 0) controller.select(unit.id);
      else if (state.selected !== null && snapshot.outcome === 'active') void controller.order(unit ? { type: 'attack', entityId: state.selected, targetId: unit.id } : { type: 'move', entityId: state.selected, x, y });
    }); cells.push(button); grid.append(button);
  }
  click('practice-start', () => { void controller.start(get<HTMLSelectElement>('practice-scenario').value as PracticeId); });
  click('practice-run', () => controller.setRunning(!controller.state.running));
  click('practice-step', () => { controller.setRunning(false); void controller.step(); });
  click('practice-save', () => { void controller.save(); }); click('practice-load', () => { void controller.load(); }); click('practice-delete', () => { void controller.remove(); }); click('practice-verify', () => { void controller.verify(); }); click('practice-cancel', () => controller.cancel());
  const file = get<HTMLInputElement>('practice-file');
  click('practice-import', () => file.click()); file.addEventListener('change', () => { const selected = file.files?.[0]; file.value = ''; if (selected) void controller.importFile(selected); });
  click('practice-export', () => { const exported = controller.export(); if (!exported) return; const url = URL.createObjectURL(new Blob([exported.text], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = exported.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
  get('practice-locale').addEventListener('change', () => controller.setLocale(get<HTMLSelectElement>('practice-locale').value === 'zh-Hant' ? 'zh-Hant' : 'en'));
  get('practice-slot').addEventListener('change', () => controller.setSlot(Number(get<HTMLSelectElement>('practice-slot').value) as SaveSlot));
  function schedule(state: PracticeState) {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    // Scheduling only: one explicit tick, no accumulated catch-up debt or frame-derived state.
    if (alive && state.running && !state.busy && !document.hidden) timer = setTimeout(() => { timer = null; void controller.step(); }, 250);
  }
  function render(state: PracticeState) {
    const t = (key: PracticeText) => practiceText(state.locale, key), snapshot = state.snapshot;
    if (lastLocale !== state.locale) { root.querySelectorAll<HTMLElement>('[data-practice-text]').forEach(el => { el.textContent = t(el.dataset.practiceText as PracticeText); }); document.documentElement.lang = state.locale; get<HTMLSelectElement>('practice-locale').value = state.locale; root.querySelector('nav')?.setAttribute('aria-label', t('workspace')); grid.setAttribute('aria-label', t('field')); lastLocale = state.locale; }
    get('practice-start').textContent = t(snapshot ? 'restart' : 'begin'); get<HTMLButtonElement>('practice-start').disabled = state.busy;
    get('practice-run').textContent = t(state.running ? 'pause' : 'resume');
    for (const id of ['practice-run', 'practice-step']) get<HTMLButtonElement>(id).disabled = state.busy || snapshot?.outcome !== 'active';
    for (const id of ['practice-save', 'practice-export', 'practice-verify']) get<HTMLButtonElement>(id).disabled = state.busy || !snapshot;
    for (const id of ['practice-load', 'practice-delete', 'practice-import', 'practice-slot', 'practice-scenario']) (get(id) as HTMLButtonElement | HTMLSelectElement).disabled = state.busy;
    get<HTMLButtonElement>('practice-cancel').disabled = !state.busy;
    get<HTMLSelectElement>('practice-slot').value = String(state.slot);
    if (snapshot && snapshot.scenario !== lastScenario) { get<HTMLSelectElement>('practice-scenario').value = snapshot.scenario; lastScenario = snapshot.scenario; }
    get('practice-outcome').textContent = snapshot ? t(snapshot.outcome) : t('begin');
    get('practice-clock').textContent = `${t(state.running ? 'running' : 'paused')} · ${t('tick')} ${snapshot?.nextTick ?? 0}`;
    get('practice-pending').textContent = `${t('pending')}: ${snapshot?.pending ?? 0}`;
    get('practice-selected').textContent = `${t('selected')}: ${state.selected ?? t('none')}`;
    get('practice-hash').textContent = snapshot?.hash ?? '—';
    get('practice-events').textContent = snapshot?.events.length ? snapshot.events.map(e => practiceEvent(state.locale, e)).join(' · ') : t('noEvents');
    get('practice-notice').textContent = t(state.busy ? 'busy' : state.notice);
    for (let i = 0; i < cells.length; i++) {
      const x = i % 12, y = Math.floor(i / 12), cell = cells[i]!, unit = snapshot?.units.find(u => u.x === x && u.y === y), blocked = snapshot?.blocked.some(p => p.x === x && p.y === y);
      cell.className = `practice-cell${blocked ? ' obstacle' : ''}${unit ? unit.owner === 0 ? ' friendly' : ' enemy' : ''}${unit?.id === state.selected ? ' selected' : ''}`;
      cell.textContent = unit ? `${unit.owner === 0 ? '◆' : '◇'}${unit.id}\n${unit.hp}` : blocked ? '▧' : '';
      cell.setAttribute('aria-label', `${t('cell')} ${x}, ${y} · ${unit ? `${t(unit.owner === 0 ? 'friendly' : 'enemy')} ${t('unit')} ${unit.id}, ${t('hp')} ${unit.hp}` : t(blocked ? 'obstacle' : 'emptyCell')}`);
      cell.setAttribute('aria-pressed', String(Boolean(unit && unit.id === state.selected))); cell.setAttribute('aria-disabled', String(state.busy || !snapshot));
    }
    schedule(state);
  }
  const visibility = () => { if (document.hidden) controller.hidden(); }; document.addEventListener('visibilitychange', visibility);
  const unsubscribe = controller.subscribe(render);
  return () => { alive = false; if (timer !== null) clearTimeout(timer); controller.setRunning(false); unsubscribe(); document.removeEventListener('visibilitychange', visibility); root.replaceChildren(); };
}
