// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors.
import { createWorkerInspector } from './import-bridge.ts';
import { ImportController } from './controller.ts';
import { localeFromLanguage } from './i18n.ts';
import { mountShell } from './view.ts';
import { PracticeController } from './practice-controller.ts';
import { mountPractice } from './practice-view.ts';
import './style.css';
const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing application root');
let release: (() => void) | null = null;
let navigate: (() => void) | null = null;
function start() {
  const controller = new ImportController(createWorkerInspector(), localeFromLanguage(navigator.language));
  const practice = new PracticeController(localeFromLanguage(navigator.language));
  let unmount: (() => void) | null = null, active = '';
  navigate = () => {
    const next = location.hash.startsWith('#practice') ? 'practice' : 'installation';
    if (next === active) return;
    unmount?.(); active = next;
    if (next === 'practice') { practice.setLocale(controller.snapshot().locale); controller.cancel(); unmount = mountPractice(root!, practice); }
    else { controller.setLocale(practice.state.locale); practice.hidden(); unmount = mountShell(root!, controller); }
  };
  navigate();
  release = () => { controller.dispose(); practice.dispose(); unmount?.(); release = null; navigate = null; };
}
start();
// Release local handles on departure; a back/forward-cache return gets a fresh session.
window.addEventListener('pagehide', () => release?.());
window.addEventListener('pageshow', () => { if (!release) start(); });
window.addEventListener('hashchange', () => navigate?.());
