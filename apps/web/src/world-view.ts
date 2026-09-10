// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. No timers or rendered positions enter simulation state.
import type { TerrainController } from './terrain-controller.ts';
import type { SaveSlot } from './world-storage.ts';
import { worldText, worldEventText } from './world-i18n.ts';
import { worldShortcut } from './terrain-gestures.ts';
import { WorldTickSchedule } from './world-scheduler.ts';
import './world.css';
const template = `<section class="world-panel" hidden><div class="world-heading"><h2 data-world="title"></h2><span id="world-clock"></span></div><div class="world-orders"><button id="world-run" class="primary"></button><button id="world-step" data-world="step"></button><button id="world-stop" data-world="stop"></button><button id="world-clear" data-world="clearSelection"></button><button id="world-focus" data-world="focus"></button></div><p id="world-selection-status" role="status" aria-live="polite"></p><ul id="world-hud" class="world-hud"></ul><p id="world-hud-omitted" class="scope-note"></p><p id="world-notice" role="status" aria-live="polite"></p><p class="scope-note" data-world="directControls"></p><details class="world-development"><summary data-world="development"></summary><p class="scope-note" data-world="scope"></p><div class="world-selectors"><label><span data-world="house"></span><select id="world-house"></select></label><label><span data-world="unit"></span><select id="world-unit" multiple size="5"></select></label></div><p class="scope-note" data-world="keyboardSelection"></p><div class="world-orders"><button id="world-picked" data-world="picked"></button><form id="world-target"><label><span data-world="targetX"></span><input id="world-x" type="number" min="0" max="511" step="1" required value="1"></label><label><span data-world="targetY"></span><input id="world-y" type="number" min="0" max="511" step="1" required value="1"></label><button id="world-move" data-world="move"></button></form></div><p class="scope-note" data-world="timing"></p><div class="world-state"><div><h3 data-world="selected"></h3><dl id="world-entity"></dl></div><div><h3 data-world="trace"></h3><pre id="world-events"></pre></div></div></details><details><summary data-world="persistence"></summary><p class="scope-note" data-world="storage"></p><div class="world-storage"><label><span data-world="slot"></span> <select id="world-slot"><option>1</option><option>2</option><option>3</option></select></label><button id="world-save" data-world="save"></button><button id="world-load" data-world="load"></button><button id="world-delete" data-world="remove"></button><button id="world-export-save" data-world="exportSave"></button><button id="world-import-save" data-world="importSave"></button><button id="world-export-replay" data-world="exportReplay"></button><button id="world-import-replay" data-world="importReplay"></button><button id="world-verify" data-world="verify"></button><input id="world-save-file" type="file" accept=".json,application/json" class="file-input" tabindex="-1" aria-hidden="true"><input id="world-replay-file" type="file" accept=".json,application/json" class="file-input" tabindex="-1" aria-hidden="true"></div><dl id="world-identities"></dl><p data-world="remaining"></p><pre id="world-limitations"></pre></details><p id="world-error"></p></section>`;
export function mountWorld(root: HTMLElement, controller: TerrainController): () => void {
  const holder = document.createElement('div'); holder.innerHTML = template; const panel = holder.firstElementChild as HTMLElement;
  root.querySelector('.terrain-stage')!.before(panel);
  const get = <T extends HTMLElement = HTMLElement>(id: string) => panel.querySelector<T>('#world-' + id)!;
  const click = (id: string, action: () => void) => get(id).addEventListener('click', action);
  const toggleRunning = () => { if (document.hidden) controller.hidden(); else controller.setRunning(!controller.state.running); };
  get<HTMLSelectElement>('house').addEventListener('change', () => controller.setPlayer(get<HTMLSelectElement>('house').value === '' ? null : Number(get<HTMLSelectElement>('house').value)));
  get<HTMLSelectElement>('unit').addEventListener('change', () => { controller.selectEntities(Array.from(get<HTMLSelectElement>('unit').selectedOptions, option => Number(option.value))); });
  get<HTMLSelectElement>('slot').addEventListener('change', () => controller.setSlot(Number(get<HTMLSelectElement>('slot').value) as SaveSlot));
  click('clear', () => controller.clearSelection());
  click('focus', () => { void controller.focusEntity(); }); click('run', toggleRunning); click('step', () => { controller.setRunning(false); void controller.step(); }); click('stop', () => { void controller.order(); });
  const movePicked = () => { const p = controller.state.selection; if (p?.kind === 'terrain') void controller.order(p.cell.x, p.cell.y); };
  click('picked', movePicked);
  get<HTMLFormElement>('target').addEventListener('submit', event => { event.preventDefault(); if (get<HTMLFormElement>('target').reportValidity()) void controller.order(get<HTMLInputElement>('x').valueAsNumber, get<HTMLInputElement>('y').valueAsNumber); });
  click('save', () => { void controller.saveWorld(); }); click('load', () => { void controller.loadWorld(); }); click('delete', () => { void controller.deleteWorld(); }); click('verify', () => { void controller.verifyWorld(); });
  const urls = new Map<string, ReturnType<typeof setTimeout>>(); let mounted = true;
  for (const kind of ['save', 'replay'] as const) {
    click('import-' + kind, () => get<HTMLInputElement>(kind + '-file').click());
    get<HTMLInputElement>(kind + '-file').addEventListener('change', () => { const input = get<HTMLInputElement>(kind + '-file'), file = input.files?.[0]; input.value = ''; if (file) void controller.importWorld(file, kind); });
    click('export-' + kind, () => { void controller.exportWorld(kind).then(result => {
      if (!mounted || !result) return;
      for (const [url, timer] of urls) { clearTimeout(timer); URL.revokeObjectURL(url); } urls.clear();
      const url = URL.createObjectURL(new Blob([result.text], { type: 'application/json' })), link = document.createElement('a'); link.href = url; link.download = result.name; link.click();
      urls.set(url, setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url); }, 30_000));
    }); });
  }
  const canvas = root.querySelector<HTMLCanvasElement>('#terrain-canvas')!;
  const key = (event: KeyboardEvent) => {
    const action = worldShortcut(event.key, event.target === canvas, event); if (!action || event.repeat) return;
    event.preventDefault(); controller.cancelInteraction();
    if (action === 'run') toggleRunning(); else if (action === 'stop') void controller.order(); else if (action === 'clear') controller.clearSelection(); else movePicked();
  };
  canvas.addEventListener('keydown', key);
  const option = (value: string, text: string) => { const o = document.createElement('option'); o.value = value; o.textContent = text; return o; };
  const details = (element: HTMLElement, values: [string, string][]) => { element.replaceChildren(); for (const [name, value] of values) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = name; dd.textContent = value; element.append(dt, dd); } };
  let locale = '', selectKey = '', priorEntity = -1;
  const unsubscribe = controller.subscribe(state => {
    const t = (key: string) => worldText(state.locale, key), summary = state.frame?.summary.world, world = state.frame?.world;
    panel.hidden = !summary || !world;
    if (locale !== state.locale) { locale = state.locale; for (const el of panel.querySelectorAll<HTMLElement>('[data-world]')) el.textContent = t(el.dataset.world!); }
    if (!summary || !world) { selectKey = ''; priorEntity = -1; return; }
    const selectionKey = `${summary.modelHash}:${state.playerId}:${state.locale}`;
    if (selectionKey !== selectKey) {
      selectKey = selectionKey;
      get('house').replaceChildren(option('', t('chooseHouse')), ...summary.players.map(p => option(String(p.id), p.name))); get<HTMLSelectElement>('house').value = state.playerId === null ? '' : String(state.playerId);
      const ownerName = (id: number | null) => summary.players.find(p => p.id === id)?.name ?? t('unknown');
      get('unit').replaceChildren(...summary.actors.filter(a => a.owner === state.playerId && a.movable).map(a => option(String(a.id), `${a.id} · ${a.typeId} · ${ownerName(a.owner)}`)));
    }
    for (const option of get<HTMLSelectElement>('unit').options) { option.selected = state.selectedEntities.includes(Number(option.value)); const actor = world.actors.find(a => a.id === Number(option.value)); option.disabled = actor?.health === null || actor?.health === undefined || actor.health <= 0; }
    get('selection-status').textContent = `${t('selectionCount')}: ${state.selectedEntities.length} / 64`;
    const hud = get('hud'); hud.replaceChildren();
    for (const id of state.selectedEntities.slice(0, 8)) {
      const actor = world.actors.find(a => a.id === id)!, info = summary.actors.find(a => a.id === id)!;
      const item = document.createElement('li'), name = document.createElement('strong'), health = document.createElement('span'), bar = document.createElement('progress'), order = document.createElement('span');
      name.textContent = `${t("kind-"+info.kind)} #${id}`; health.textContent = `${t('health')}: ${actor.health} / ${info.maximumHealth}`;
      bar.max = info.maximumHealth ?? 1; bar.value = actor.health ?? 0; bar.setAttribute('aria-label', `${name.textContent} ${health.textContent}`);
      order.textContent = actor.goalX === null ? t('idle') : `${t(actor.waitTicks ? 'waiting' : 'moving')} → ${actor.goalX}, ${actor.goalY}`;
      item.append(name, health, bar, order); hud.append(item);
    }
    get('hud-omitted').textContent = state.selectedEntities.length > 8 ? `${t('additionalSelected')}: ${state.selectedEntities.length - 8}` : '';
    get<HTMLButtonElement>('clear').disabled = state.selectedEntities.length === 0;
    const actor = world.actors.find(a => a.id === state.selectedEntity), info = summary.actors.find(a => a.id === state.selectedEntity);
    if (actor && actor.id !== priorEntity) { priorEntity = actor.id; get<HTMLInputElement>('x').value = String(actor.x); get<HTMLInputElement>('y').value = String(actor.y); }
    get('clock').textContent = `${t('tick')} ${world.nextTick} · ${t('queued')} ${world.queuedCommands}`;
    get('run').textContent = t(state.running ? 'pause' : 'run'); get('notice').textContent = t(state.worldNotice);
    for (const id of ['step', 'house', 'unit', 'slot', 'save', 'load', 'delete', 'export-save', 'import-save', 'export-replay', 'import-replay', 'verify']) (get(id) as HTMLButtonElement).disabled = state.busy;
    get<HTMLButtonElement>('run').disabled = state.busy && !state.running; get<HTMLButtonElement>('focus').disabled = state.busy || !actor;
    for (const id of ['move', 'stop']) get<HTMLButtonElement>(id).disabled = !controller.canOrder(); get<HTMLButtonElement>('picked').disabled = !controller.canOrder() || state.selection?.kind !== 'terrain';
    get<HTMLSelectElement>('slot').value = String(state.slot);
    details(get('entity'), actor && info ? [[t('entity'), String(actor.id)], [t('source'), info.rowId], [t('owner'), summary.players.find(p => p.id === info.owner)?.name ?? t('unknown')], [t('position'), `${actor.x}, ${actor.y}`], [t('health'), actor.health === null ? t('unknown') : `${actor.health} / ${info.maximumHealth}`], [t('movement'), t(info.movable ? 'supported' : 'unsupported')], [t('destination'), actor.goalX === null ? t('idle') : `${actor.goalX}, ${actor.goalY}`], [t('route'), String(actor.routeLength)], [t('credit'), `${actor.progress} / ${actor.edgeCost ?? '—'}`], [t('reasons'), info.reasons.join(', ') || '—'], [t('omittedReasons'), String(info.omittedReasons)]] : [[t('selected'), t('noUnit')]]);
    get('events').textContent = world.events.map(e => `${e.tick} · #${e.entityId} · ${worldEventText(state.locale,e.kind)} (${e.kind})${e.cell === null ? '' : ` · ${e.cell % 512}, ${Math.floor(e.cell / 512)}`}`).join('\n') + (world.omittedEvents ? `\n${t('omitted')}: ${world.omittedEvents}` : '');
    details(get('identities'), [[t('model'), summary.modelHash], [t('state'), world.stateHash], [t('verifiedHash'), state.replayHash ?? '—']]);
    get('limitations').textContent = summary.limitations.join('\n') + (summary.omittedLimitations ? `\n+${summary.omittedLimitations}` : ''); get('error').textContent = state.error ?? '';
  });
  const schedule = new WorldTickSchedule(), timer = setInterval(() => { const state = controller.state, ticks = schedule.advance(performance.now(), state.running && !document.hidden, state.busy || state.interacting); if (ticks) void controller.step(ticks); }, 1000 / 15);
  const hidden = () => { if (document.hidden) controller.hidden(); }; document.addEventListener('visibilitychange', hidden); hidden();
  return () => { mounted = false; clearInterval(timer); unsubscribe(); canvas.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', hidden); for (const [url, timer] of urls) { clearTimeout(timer); URL.revokeObjectURL(url); } urls.clear(); panel.remove(); };
}
