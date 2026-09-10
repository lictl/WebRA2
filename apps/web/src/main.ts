// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors.
import { createWorkerInspector } from './import-bridge.ts';
import { ImportController } from './controller.ts';
import { localeFromLanguage } from './i18n.ts';
import { mountShell } from './view.ts';
import { PracticeController } from './practice-controller.ts';
import { mountPractice } from './practice-view.ts';
import { TerrainController } from './terrain-controller.ts';
import { mountCampaign } from './campaign-view.ts';
import { mountTerrain } from './terrain-view.ts';
import './style.css';
const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing application root');
let release: (() => void) | null = null;
let navigate: (() => void) | null = null;
function start() {
  const controller = new ImportController(createWorkerInspector(), localeFromLanguage(navigator.language));
  const practice = new PracticeController(localeFromLanguage(navigator.language));
  const terrain = new TerrainController(localeFromLanguage(navigator.language));
  let unmount: (() => void) | null = null, active = '';
  navigate = () => {
    const next = location.hash.startsWith('#campaign') ? 'campaign' : location.hash.startsWith('#practice') ? 'practice' : location.hash.startsWith('#terrain') ? 'terrain' : 'installation';
    if (next === active) return;
    const locale = (active === 'terrain'||active==='campaign') ? terrain.state.locale : active === 'practice' ? practice.state.locale : controller.snapshot().locale;
    unmount?.(); if (active === 'terrain'||active==='campaign') terrain.leave(); if (active === 'practice') practice.hidden();
    if (active === 'installation') controller.cancel(); active = next;
    controller.setLocale(locale); practice.setLocale(locale); terrain.setLocale(locale);
    if(next==='campaign') unmount=mountCampaign(root!,terrain);
    else if (next === 'practice') unmount = mountPractice(root!, practice);
    else if (next === 'terrain') unmount = mountTerrain(root!, terrain);
    else unmount = mountShell(root!, controller);
  };
  navigate();
  release = () => { controller.dispose(); practice.dispose(); terrain.dispose(); unmount?.(); release = null; navigate = null; };
}
start();
// Release local handles on departure; a back/forward-cache return gets a fresh session.
window.addEventListener('pagehide', () => release?.());
window.addEventListener('pageshow', () => { if (!release) start(); });
window.addEventListener('hashchange', () => navigate?.());
