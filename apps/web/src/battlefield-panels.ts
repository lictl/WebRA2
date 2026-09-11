// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Presentation state only; no simulation authority.
export type BattlefieldPane = 'orders' | 'saves' | 'diagnostics';
export function mountBattlefieldPanels(host: HTMLElement, canvas: HTMLCanvasElement | (() => HTMLCanvasElement), pause: () => void) {
  const panes: BattlefieldPane[] = ['orders', 'saves', 'diagnostics'];
  const button = (pane: BattlefieldPane) => host.querySelector<HTMLButtonElement>('#world-open-' + pane)!;
  const region = (pane: BattlefieldPane) => host.querySelector<HTMLElement>('#world-' + pane + '-panel')!;
  const body = host.querySelector<HTMLElement>('.world-panel-body')!;
  let current: BattlefieldPane = 'orders';
  const show = (next: BattlefieldPane) => {
    if (next !== 'orders') pause();
    const changed = next !== current;
    current = next;
    for (const pane of panes) { region(pane).hidden = pane !== next; button(pane).setAttribute('aria-expanded', String(pane === next)); }
    if (changed) body.scrollTop = 0;
  };
  const back = () => { show('orders'); (typeof canvas==='function'?canvas():canvas).focus({ preventScroll: true }); };
  const handlers = panes.map(pane => { const fn = () => show(pane); button(pane).addEventListener('click', fn); return [button(pane), fn] as const; });
  for (const pane of ['saves', 'diagnostics'] as const) { const el = host.querySelector<HTMLButtonElement>('#world-return-' + pane)!; el.addEventListener('click', back); handlers.push([el, back]); }
  const escape = (event: KeyboardEvent) => { if (current !== 'orders' && event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); back(); } };
  host.addEventListener('keydown', escape);
  show('orders');
  return () => { for (const [el, fn] of handlers) el.removeEventListener('click', fn); host.removeEventListener('keydown', escape); };
}
