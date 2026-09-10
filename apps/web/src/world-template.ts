// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Original player interface; no imported HTML.
export const worldTemplate = `<section class="world-panel" hidden aria-labelledby="world-title">
  <div class="world-heading"><h2 id="world-title" data-world="title"></h2><span id="world-playback" role="status"></span></div>
  <div class="world-clock-row"><span id="world-clock"></span></div>
  <div class="world-primary-orders"><button id="world-run" class="primary"></button><button id="world-stop" data-world="stop" aria-describedby="world-order-timing"></button><button id="world-focus" data-world="focus"></button></div>
  <div class="world-operation"><p id="world-notice" role="status" aria-live="polite" aria-atomic="true"></p><button id="world-cancel-replay" data-world="cancelReplay" hidden></button></div>
  <p class="scope-note" id="world-order-timing" data-world="orderTiming"></p>
  <div class="world-panel-switch" role="group"><button id="world-open-orders" data-world="ordersPanel" aria-controls="world-orders-panel" aria-expanded="true"></button><button id="world-open-saves" data-world="savesPanel" aria-controls="world-saves-panel" aria-expanded="false"></button><button id="world-open-diagnostics" data-world="diagnosticsPanel" aria-controls="world-diagnostics-panel" aria-expanded="false"></button></div>
  <div class="world-panel-body">
    <section id="world-orders-panel" aria-labelledby="world-open-orders">
      <p class="scope-note" id="world-group-help" data-world="controlGroupsHelp"></p>
      <p id="world-group-notice" role="status" aria-live="polite" aria-atomic="true"></p>
      <div class="world-selection-heading"><p id="world-selection-status" role="status" aria-live="polite"></p><button id="world-clear" class="quiet" data-world="clearSelection"></button></div>
      <ul id="world-hud" class="world-hud"></ul><p id="world-hud-omitted" class="scope-note"></p>
      <p class="scope-note world-empty-selection" id="world-selection-help" data-world="selectionHelp"></p>
      <div id="world-combat-controls" class="world-combat-controls" hidden><label><span data-world="attackTarget"></span><select id="world-attack-target"></select></label><button id="world-attack" data-world="attack" aria-describedby="world-order-timing"></button><span id="world-attack-status" role="status" aria-live="polite"></span></div>
      <details class="world-keyboard"><summary data-world="keyboardOrders"></summary>
        <label><span data-world="unit"></span><select id="world-unit" multiple size="5"></select></label>
        <p class="scope-note" data-world="keyboardSelection"></p><button id="world-picked" data-world="picked" aria-describedby="world-order-timing"></button>
        <form id="world-target"><label><span data-world="targetX"></span><input id="world-x" type="number" min="0" max="511" step="1" required value="1"></label><label><span data-world="targetY"></span><input id="world-y" type="number" min="0" max="511" step="1" required value="1"></label><button id="world-move" data-world="move" aria-describedby="world-order-timing"></button></form>
      </details>
      <details class="world-help"><summary data-world="controlsHelp"></summary><p class="scope-note" data-world="directControls"></p><p class="scope-note" data-world="timing"></p><p class="scope-note" data-world="controlGroupsScope"></p><div id="world-camera-help"></div></details>
    </section>
    <section id="world-saves-panel" aria-labelledby="world-open-saves" hidden>
      <h3 data-world="persistence"></h3><p class="scope-note" data-world="storage"></p>
      <label><span data-world="slot"></span><select id="world-slot"><option>1</option><option>2</option><option>3</option></select></label>
      <div class="world-storage-actions"><button id="world-save" class="primary" data-world="save"></button><button id="world-load" data-world="load"></button><button id="world-delete" class="quiet" data-world="remove"></button></div>
      <h3 data-world="checkpointFiles"></h3><div class="world-storage-actions"><button id="world-export-save" data-world="exportSave"></button><button id="world-import-save" data-world="importSave"></button></div>
      <h3 data-world="replayFiles"></h3><div class="world-storage-actions"><button id="world-export-replay" data-world="exportReplay"></button><button id="world-import-replay" data-world="importReplay"></button><button id="world-verify" data-world="verify"></button></div>
      <input id="world-save-file" type="file" accept=".json,application/json" class="file-input" tabindex="-1" aria-hidden="true"><input id="world-replay-file" type="file" accept=".json,application/json" class="file-input" tabindex="-1" aria-hidden="true">
      <button id="world-return-saves" class="world-return" data-world="returnBattlefield"></button>
    </section>
    <section id="world-diagnostics-panel" aria-labelledby="world-open-diagnostics" hidden>
      <h3 data-world="development"></h3><p class="scope-note" data-world="scope"></p>
      <label><span data-world="house"></span><select id="world-house"></select></label><button id="world-step" data-world="step"></button>
      <h3 data-world="selected"></h3><dl id="world-entity"></dl><h3 data-world="trace"></h3><pre id="world-events"></pre>
      <h3 data-world="identities"></h3><dl id="world-identities"></dl><h3 data-world="remaining"></h3><pre id="world-limitations"></pre><p id="world-error"></p>
      <div id="world-source-diagnostics"></div><button id="world-return-diagnostics" class="world-return" data-world="returnBattlefield"></button>
    </section>
  </div>
</section>`;
