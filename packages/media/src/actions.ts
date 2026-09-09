// SPDX-License-Identifier: MIT
/** Captured resource scope: callers must compare both generation and resource identity. */
export interface AudioResource { suspend(): Promise<void>; resume(): Promise<void>; close(): Promise<void>; readonly state: string; }
export interface ActionScope { readonly audio: AudioResource; current(): boolean; }
export async function pauseMedia(scope: ActionScope, paused: () => void, failed: (error: unknown) => void): Promise<void> {
  try { if (!scope.current()) return; await scope.audio.suspend(); if (scope.current()) paused(); }
  catch (error) { if (scope.current()) failed(error); }
}
export async function resumeMedia(scope: ActionScope, resumed: () => void, failed: (error: unknown) => void): Promise<void> {
  try { if (!scope.current()) return; await scope.audio.resume(); if (scope.current()) resumed(); }
  catch (error) { if (scope.current()) failed(error); }
}
export async function seekMedia(scope: ActionScope, waitIdle: () => Promise<void>, reset: () => void, seek: () => Promise<unknown>, ready: () => void, failed: (error: unknown) => void): Promise<void> {
  try {
    if (!scope.current()) return;
    await waitIdle(); if (!scope.current()) return;
    reset(); await scope.audio.resume(); if (!scope.current()) return;
    await seek(); if (scope.current()) ready();
  } catch (error) { if (scope.current()) failed(error); }
}
export async function closeMedia(scope: ActionScope, closed: () => void, failed: (error: unknown) => void): Promise<void> {
  // Close the captured old resource even if a new generation has begun; only its UI completion is guarded.
  try { if (scope.audio.state !== 'closed') await scope.audio.close(); if (scope.current()) closed(); }
  catch (error) { if (scope.current()) failed(error); }
}
