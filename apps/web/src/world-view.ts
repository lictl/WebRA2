// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. No timers or rendered positions enter simulation state.
import type { TerrainController } from './terrain-controller.ts';
import type { SaveSlot } from './world-storage.ts';
import { worldText, worldEventText } from './world-i18n.ts';
import { worldShortcut } from './terrain-gestures.ts';
import { WorldTickSchedule } from './world-scheduler.ts';
import './world.css';
import { worldTemplate } from './world-template.ts';
import { mountBattlefieldPanels } from './battlefield-panels.ts';

export function mountWorld(root: HTMLElement, controller: TerrainController): () => void {
  const holder = document.createElement('div'); holder.innerHTML = worldTemplate; const panel = holder.firstElementChild as HTMLElement;
  const stage = root.querySelector('.terrain-stage')!;
  const sidebar = root.querySelector<HTMLElement>('#battlefield-sidebar');
  if (sidebar) sidebar.append(panel); else stage.before(panel);
  const get = <T extends HTMLElement = HTMLElement>(id: string) => panel.querySelector<T>('#world-' + id)!;
  const click = (id: string, action: () => void) => get(id).addEventListener('click', action);
  const toggleRunning = () => { if (document.hidden) controller.hidden(); else controller.setRunning(!controller.state.running); };
  get<HTMLSelectElement>('house').addEventListener('change', () => controller.setPlayer(get<HTMLSelectElement>('house').value === '' ? null : Number(get<HTMLSelectElement>('house').value)));
  get<HTMLSelectElement>('unit').addEventListener('change', () => { controller.selectEntities(Array.from(get<HTMLSelectElement>('unit').selectedOptions, option => Number(option.value))); });
  get<HTMLSelectElement>('slot').addEventListener('change', () => controller.setSlot(Number(get<HTMLSelectElement>('slot').value) as SaveSlot));
  click('cancel-replay',()=>controller.cancel());
  click('clear', () => controller.clearSelection());
  click('attack', () => { const value=get<HTMLSelectElement>('attack-target').value;if(value)void controller.attack(Number(value)); });
  get<HTMLSelectElement>('attack-target').addEventListener('change',()=>controller.selectEntities(controller.state.selectedEntities));
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
  const releasePanels = mountBattlefieldPanels(panel, canvas, () => controller.setRunning(false));
  const sourceDetails = root.querySelector<HTMLElement>('.terrain-details');
  const cameraHelp = root.querySelector<HTMLElement>('#terrain-controls');
  const scope = root.querySelector<HTMLElement>('#terrain-scope');
  const artwork = root.querySelector<HTMLElement>('#terrain-artwork');
  const sourceHome = root.querySelector<HTMLElement>('#terrain-static-details');
  const place = (parent: Element | null, child: Element | null) => { if (parent && child && child.parentElement !== parent) parent.append(child); };
  const key = (event: KeyboardEvent) => {
    const action = worldShortcut(event.key, event.target === canvas, event); if (!action || event.repeat) return;
    event.preventDefault(); controller.cancelInteraction();
    if (action === 'run') toggleRunning(); else if (action === 'stop') void controller.order(); else if (action === 'clear') controller.clearSelection(); else movePicked();
  };
  canvas.addEventListener('keydown', key);
  const option = (value: string, text: string) => { const o = document.createElement('option'); o.value = value; o.textContent = text; return o; };
  const details = (element: HTMLElement, values: [string, string][]) => { element.replaceChildren(); for (const [name, value] of values) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = name; dd.textContent = value; element.append(dt, dd); } };
  let locale = '', selectKey = '', priorEntity = -1, priorPick: object|null = null;
  const unsubscribe = controller.subscribe(state => {
    const t = (key: string) => worldText(state.locale, key), summary = state.frame?.summary.world, world = state.frame?.world;
    panel.hidden = !summary || !world;
    if (sidebar) sidebar.hidden = panel.hidden;
    const destination = panel.hidden ? sourceHome : get('source-diagnostics');
    for (const element of [artwork, scope, sourceDetails]) place(destination, element);
    place(panel.hidden ? sourceHome : get('camera-help'), cameraHelp);
    if (locale !== state.locale) { locale = state.locale; for (const el of panel.querySelectorAll<HTMLElement>('[data-world]')) el.textContent = t(el.dataset.world!); }
    if (!summary || !world) { selectKey = ''; priorEntity = -1; return; }
    const selectionKey = `${summary.modelHash}:${state.playerId}:${state.locale}`;
    if (selectionKey !== selectKey) {
      selectKey = selectionKey;
      get('house').replaceChildren(option('', t('chooseHouse')), ...summary.players.map(p => option(String(p.id), p.name))); get<HTMLSelectElement>('house').value = state.playerId === null ? '' : String(state.playerId);
      const ownerName = (id: number | null) => summary.players.find(p => p.id === id)?.name ?? t('unknown');
      const target=get<HTMLSelectElement>('attack-target'), prior=target.value;
      target.replaceChildren(option('',t('chooseTarget')),...summary.actors.filter(a=>a.owner!==state.playerId&&(a.combatRole==='attacker'||a.combatRole==='target-only')).map(a=>option(String(a.id),`${a.id} · ${a.typeId} · ${ownerName(a.owner)}`)));
      if(Array.from(target.options).some(o=>o.value===prior))target.value=prior;
      get('unit').replaceChildren(...summary.actors.filter(a => a.owner === state.playerId && a.movable).map(a => option(String(a.id), `${a.id} · ${a.typeId} · ${ownerName(a.owner)}`)));
    }
    for (const option of get<HTMLSelectElement>('unit').options) { option.selected = state.selectedEntities.includes(Number(option.value)); const actor = world.actors.find(a => a.id === Number(option.value)); option.disabled = actor?.health === null || actor?.health === undefined || actor.health <= 0; }
    get('combat-controls').hidden=!summary.combatPolicy;
    const attackTarget=get<HTMLSelectElement>('attack-target');
    const picked=state.selection?.kind==='object'?summary.actors.find(a=>a.objectId===(state.selection?.kind==='object'?state.selection.object.id:'')):undefined;
    const changedPick=state.selection!==priorPick;priorPick=state.selection;
    if(changedPick&&picked&&picked.owner!==state.playerId&&Array.from(attackTarget.options).some(o=>o.value===String(picked.id)))attackTarget.value=String(picked.id);
    const targetState=world.actors.find(a=>String(a.id)===attackTarget.value);
    for(const option of attackTarget.options){const a=world.actors.find(a=>String(a.id)===option.value);option.disabled=!!a&&(a.health===null||a.health<=0);}
    attackTarget.disabled=state.busy;get<HTMLButtonElement>('attack').disabled=!attackTarget.value||!controller.canAttack(Number(attackTarget.value));
    get('attack-status').textContent=targetState?`${t('health')}: ${targetState.health} · ${t(targetState.health===0?(targetState.combat?.corpseIndex===null?'dying':'destroyed'):'alive')}`:'';
    get('selection-help').hidden = state.selectedEntities.length > 0;
    get('selection-status').textContent = `${t('selectionCount')}: ${state.selectedEntities.length} / 64`;
    const hud = get('hud'); hud.replaceChildren();
    for (const id of state.selectedEntities.slice(0, 8)) {
      const actor = world.actors.find(a => a.id === id)!, info = summary.actors.find(a => a.id === id)!;
      const item = document.createElement('li'), name = document.createElement('strong'), health = document.createElement('span'), bar = document.createElement('progress'), order = document.createElement('span');
      name.textContent = `${t("kind-"+info.kind)} #${id}`; health.textContent = `${t('health')}: ${actor.health} / ${info.maximumHealth}`;
      bar.max = info.maximumHealth ?? 1; bar.value = actor.health ?? 0; bar.setAttribute('aria-label', `${name.textContent} ${health.textContent}`);
      order.textContent = actor.combat?.windupUntil!==null&&actor.combat?.windupUntil!==undefined ? `${t('firing')} → #${actor.combat.targetId}` : actor.combat?.targetId!==null&&actor.combat?.targetId!==undefined ? `${t('attacking')} → #${actor.combat.targetId}` : actor.goalX === null ? t('idle') : `${t(actor.waitTicks ? 'waiting' : 'moving')} → ${actor.goalX}, ${actor.goalY}`;
      item.append(name, health, bar, order); hud.append(item);
    }
    get('hud-omitted').textContent = state.selectedEntities.length > 8 ? `${t('additionalSelected')}: ${state.selectedEntities.length - 8}` : '';
    get<HTMLButtonElement>('clear').disabled = state.selectedEntities.length === 0;
    const actor = world.actors.find(a => a.id === state.selectedEntity), info = summary.actors.find(a => a.id === state.selectedEntity);
    if (actor && actor.id !== priorEntity) { priorEntity = actor.id; get<HTMLInputElement>('x').value = String(actor.x); get<HTMLInputElement>('y').value = String(actor.y); }
    get('playback').textContent = t(state.running ? 'runningState' : 'pausedState');
    get('playback').dataset.running = String(state.running);
    get('clock').textContent = `${t('tick')} ${world.nextTick} · ${t('queued')} ${world.queuedCommands}`;
    get('cancel-replay').hidden=!(state.busy&&state.verifyingReplay);
    get('run').textContent = t(state.running ? 'pause' : 'run'); get('notice').textContent = t(state.verifyingReplay?'worldVerifying':state.worldNotice);
    for (const id of ['step', 'house', 'unit', 'slot', 'save', 'load', 'delete', 'export-save', 'import-save', 'export-replay', 'import-replay', 'verify']) (get(id) as HTMLButtonElement).disabled = state.busy;
    get<HTMLButtonElement>('run').disabled = state.busy && !state.running; get<HTMLButtonElement>('focus').disabled = state.busy || !actor;
    for (const id of ['move', 'stop']) get<HTMLButtonElement>(id).disabled = !controller.canOrder(); get<HTMLButtonElement>('picked').disabled = !controller.canOrder() || state.selection?.kind !== 'terrain';
    get<HTMLSelectElement>('slot').value = String(state.slot);
    details(get('entity'), actor && info ? [[t('entity'), String(actor.id)], [t('source'), info.rowId], [t('owner'), summary.players.find(p => p.id === info.owner)?.name ?? t('unknown')], [t('position'), `${actor.x}, ${actor.y}`], ...(actor.subcell===undefined?[]:[[t('settledSlot'),actor.subcell===null?'—':String(actor.subcell)],[t('reservedSlot'),actor.reservedSubcell===null?'—':String(actor.reservedSubcell)]] as [string,string][]), [t('health'), actor.health === null ? t('unknown') : `${actor.health} / ${info.maximumHealth}`], [t('movement'), t(info.movable ? 'supported' : 'unsupported')], [t('attack'),t(info.combatRole==='attacker'?'supported':'unsupported')], [t('destination'), actor.goalX === null ? t('idle') : `${actor.goalX}, ${actor.goalY}`], [t('route'), String(actor.routeLength)], [t('credit'), `${actor.progress} / ${actor.edgeCost ?? '—'}`], [t('reasons'), info.reasons.join(', ') || '—'], [t('omittedReasons'), String(info.omittedReasons)]] : [[t('selected'), t('noUnit')]]);
    get('events').textContent = world.events.map(e => `${e.tick} · #${e.entityId} · ${worldEventText(state.locale,e.kind)} (${e.kind})${e.cell === null ? '' : ` · ${e.cell % 512}, ${Math.floor(e.cell / 512)}`}`).join('\n') + (world.omittedEvents ? `\n${t('omitted')}: ${world.omittedEvents}` : '');
    details(get('identities'), [[t('model'), summary.modelHash], [t('state'), world.stateHash], [t('verifiedHash'), state.replayHash ?? '—']]);
    get('limitations').textContent = summary.limitations.join('\n') + (summary.omittedLimitations ? `\n+${summary.omittedLimitations}` : ''); get('error').textContent = state.error ?? '';
  });
  const schedule = new WorldTickSchedule(), timer = setInterval(() => { const state = controller.state, ticks = schedule.advance(performance.now(), state.running && !document.hidden, state.busy || state.interacting); if (ticks) void controller.step(ticks); }, 1000 / 15);
  const hidden = () => { if (document.hidden) controller.hidden(); }; document.addEventListener('visibilitychange', hidden); hidden();
  return () => { mounted = false; releasePanels(); clearInterval(timer); unsubscribe(); canvas.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', hidden); for (const [url, timer] of urls) { clearTimeout(timer); URL.revokeObjectURL(url); } urls.clear(); panel.remove(); };
}
