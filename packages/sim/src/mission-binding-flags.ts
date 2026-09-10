// SPDX-License-Identifier: GPL-3.0-or-later
// Original numeric classification from paired native dispatch evidence; not opcode execution.
import type { ProfileId } from '../../contracts/src/index.ts';
const object = new Set([0,1,4,8,24,25,26,31,53,54]);
const cell = new Set([0,1,2,4,6,7,8,29,33,34,35,38,39,40,41,42,43,44,48,49]);
const house = new Set([3,5,8,9,10,11,12,15,16,17,18,19,20,21,22,30,32,52,55,56,57]);
const scenario = new Set([8,13,14,23,27,28,36,37,45,46,47,50,51]);
const actionCell = new Set([14,32,60,61,62,91,111]);
/** Native GetFlags classification only. A zero result never certifies an unknown opcode's effects. */
export function missionEventAttachmentFlags(profile: ProfileId, opcode: number): number {
  if ((profile !== 'ra2' && profile !== 'yr') || !Number.isInteger(opcode)||Object.is(opcode,-0) || opcode < 0 || opcode > 0xffffffff) throw new Error('mission-binding-opcode');
  return (object.has(opcode) || profile === 'yr' && opcode === 59 ? 1 : 0) |
    (cell.has(opcode) ? 2 : 0) | (opcode === 8 || opcode === 24 ? 4 : 0) |
    (house.has(opcode) || profile === 'yr' && opcode === 58 ? 8 : 0) |
    (scenario.has(opcode) || profile === 'yr' && (opcode === 60 || opcode === 61) ? 16 : 0);
}
export function missionActionAttachmentFlags(opcode: number): number {
  if (!Number.isInteger(opcode)||Object.is(opcode,-0) || opcode < 0 || opcode > 0xffffffff) throw new Error('mission-binding-opcode');
  return actionCell.has(opcode) ? 2 : 0;
}
