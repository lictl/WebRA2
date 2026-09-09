// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors.
import { inspectInstallation } from '../../../packages/vfs/src/browser-import.ts';
import { ImportController } from './controller.ts';
import { localeFromLanguage } from './i18n.ts';
import { mountShell } from './view.ts';
import './style.css';
const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing application root');
let release: (() => void) | null = null;
function start() {
  const controller = new ImportController(inspectInstallation, localeFromLanguage(navigator.language));
  const unmount = mountShell(root!, controller);
  release = () => { controller.dispose(); unmount(); release = null; };
}
start();
// Release local handles on departure; a back/forward-cache return gets a fresh session.
window.addEventListener('pagehide', () => release?.());
window.addEventListener('pageshow', () => { if (!release) start(); });
