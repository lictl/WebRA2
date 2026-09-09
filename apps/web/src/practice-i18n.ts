// SPDX-License-Identifier: GPL-3.0-or-later
import type { Locale } from './i18n.ts';
const en = {
  terrain: 'Terrain', nav: 'Practice', installation: 'Installation', workspace: 'Workspace', device: 'ON-DEVICE', stage: 'PRACTICE FIELD',
  kicker: '02 / ORIGINAL PRACTICE SCENARIOS', title: 'Take command.', intro: 'Try movement, delayed combat and local saves on an original training grid. Game files are not needed. These scenarios use synthetic rules; RA2 and Yuri’s Revenge campaigns remain in development.',
  scenario: 'Scenario', relay: 'Relay yard', crossfire: 'Crossfire · reinforcements', begin: 'Start scenario', restart: 'Restart scenario',
  resume: 'Resume', pause: 'Pause', step: 'Step one tick', paused: 'Paused', running: 'Running', active: 'Eliminate the opposing units.', victory: 'Practice complete · victory', defeat: 'Practice ended · defeat', draw: 'Practice ended · draw', limit: 'Practice tick limit reached. Restart or load an earlier save.',
  field: 'Practice grid', instructions: 'Select a friendly unit, then choose an empty cell to move or an enemy to attack. Arrow keys move grid focus; Enter issues the order. Attacks need a distance of four cells or less and land two ticks later. Movement goes horizontally first; blocked units retain their order.',
  friendly: 'Friendly', enemy: 'Opponent', unit: 'Unit', hp: 'HP', cell: 'Cell', obstacle: 'Obstacle', emptyCell: 'Empty', selected: 'Selected unit', none: 'None', tick: 'Tick', pending: 'Pending orders / events',
  saves: 'Local saves', saveHelp: 'Three slots in this browser, on this device and origin. Saving pauses the practice. Browser data can be cleared or evicted; export a file to keep another copy.',
  slot: 'Save slot', save: 'Save slot', load: 'Load slot', remove: 'Delete slot', export: 'Export save', import: 'Import save', cancel: 'Cancel operation', verify: 'Verify replay', busy: 'Working…',
  ready: 'Ready for orders.', saved: 'Saved in this browser.', loaded: 'Save restored and paused.', deleted: 'Save slot deleted.', empty: 'This slot is empty. Choose another slot or import an exported save.', cancelled: 'Operation cancelled. The last acknowledged checkpoint is retained.', verified: 'Replay verified: the recorded trajectory reaches the same canonical state.', invalid: 'The operation or save is invalid, too large, or uses a different scenario/policy. Your last checkpoint is retained.', quota: 'Browser storage is full. Delete a slot or export your save.', storage: 'Browser storage is unavailable or blocked. Try again or export a save file.', unavailable: 'The simulation worker is unavailable. Retry or restart the scenario.', hidden: 'Paused while this page was hidden. Resume when ready.',
  diagnostics: 'Determinism details', hash: 'Canonical state SHA-256', hashHelp: 'This identifies the synthetic state, including queued commands, scheduled work and RNG. Loading a save starts a new replay segment from that checkpoint.', trace: 'Recent events', noEvents: 'No recent events.',
  'move-accepted': 'Move order accepted', 'attack-scheduled': 'Attack launched', 'attack-out-of-range': 'Attack out of range', 'invalid-target': 'Invalid target', 'not-owner': 'Unit is not yours', 'missing-entity': 'Unit no longer exists', damage: 'Damage resolved', destroyed: 'Unit destroyed', 'impact-target-missing': 'Impact target no longer exists', reinforced: 'Reinforcement arrived', 'reinforcement-blocked': 'Reinforcement blocked', arrived: 'Destination reached', blocked: 'Movement blocked', moved: 'Unit moved', unknown: 'Simulation event',
  footer: 'Original WebRA2 practice · no retail content', skip: 'Skip to practice'
} as const;
export type PracticeText = keyof typeof en;
const zh: Record<PracticeText, string> = {
  terrain: '地形', nav: '練習', installation: '遊戲檔案', workspace: '工作區', device: '僅限此裝置', stage: '練習場',
  kicker: '02 / 原創練習場景', title: '開始指揮。', intro: '在原創訓練方格上嘗試移動、延遲戰鬥與本機存檔。不需要遊戲檔案。這些場景採用模擬規則；《紅色警戒 2》與《尤里的復仇》戰役仍在開發中。',
  scenario: '場景', relay: '中繼站', crossfire: '交叉火線・含增援', begin: '開始場景', restart: '重新開始', resume: '繼續', pause: '暫停', step: '前進一步', paused: '已暫停', running: '進行中', active: '消滅所有敵方單位。', victory: '練習完成・勝利', defeat: '練習結束・失敗', draw: '練習結束・平手', limit: '已達練習步數上限。請重新開始或載入較早的存檔。',
  field: '練習方格', instructions: '選擇友軍單位，再選空格移動或選敵軍攻擊。方向鍵移動焦點，Enter 下達命令。攻擊距離最多四格，兩步後命中。移動先走水平方向；受阻單位會保留原命令。',
  friendly: '友軍', enemy: '敵軍', unit: '單位', hp: '生命', cell: '座標', obstacle: '障礙物', emptyCell: '空格', selected: '已選單位', none: '無', tick: '步數', pending: '待執行命令／事件',
  saves: '本機存檔', saveHelp: '此瀏覽器、裝置與網址共有三個存檔欄位。存檔時會暫停練習。瀏覽器資料可能被清除或回收；請匯出檔案保留另一份副本。',
  slot: '存檔欄位', save: '儲存至欄位', load: '載入欄位', remove: '刪除欄位', export: '匯出存檔', import: '匯入存檔', cancel: '取消作業', verify: '驗證重播', busy: '處理中…',
  ready: '可以下達命令。', saved: '已儲存在此瀏覽器。', loaded: '已還原存檔並暫停。', deleted: '已刪除存檔欄位。', empty: '此欄位沒有存檔。請選其他欄位或匯入已匯出的存檔。', cancelled: '已取消作業，保留最後確認的狀態。', verified: '重播驗證成功：記錄的過程到達相同的標準狀態。', invalid: '作業或存檔無效、過大，或使用不同的場景／規則。已保留最後確認的狀態。', quota: '瀏覽器儲存空間已滿。請刪除存檔欄位或匯出存檔。', storage: '瀏覽器儲存空間無法使用或受阻。請重試或匯出存檔檔案。', unavailable: '模擬工作執行緒無法使用。請重試或重新開始場景。', hidden: '頁面隱藏時已暫停。準備好後可繼續。',
  diagnostics: '確定性詳細資料', hash: '標準狀態 SHA-256', hashHelp: '此值識別模擬狀態，包含待執行命令、排程事件與隨機數狀態。載入存檔後會從該狀態開始新的重播片段。', trace: '最近事件', noEvents: '尚無最近事件。',
  'move-accepted': '已接受移動命令', 'attack-scheduled': '已發動攻擊', 'attack-out-of-range': '超出攻擊距離', 'invalid-target': '目標無效', 'not-owner': '非己方單位', 'missing-entity': '單位已不存在', damage: '已結算傷害', destroyed: '單位已摧毀', 'impact-target-missing': '命中目標已不存在', reinforced: '增援抵達', 'reinforcement-blocked': '增援受阻', arrived: '已抵達目的地', blocked: '移動受阻', moved: '單位已移動', unknown: '模擬事件',
  footer: 'WebRA2 原創練習・不含零售遊戲內容', skip: '跳至練習'
};
export function practiceText(locale: Locale, key: PracticeText): string { return (locale === 'zh-Hant' ? zh : en)[key]; }
export function practiceEvent(locale: Locale, key: string): string { return practiceText(locale, Object.hasOwn(en, key) ? key as PracticeText : 'unknown'); }
