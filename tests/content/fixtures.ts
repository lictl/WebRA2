// SPDX-License-Identifier: GPL-3.0-or-later
// Original synthetic CSF bytes; no retail content.
export function syntheticCsf(labels: { label: string; value?: string; extra?: string }[], languageId = 0): Uint8Array {
  const parts: Buffer[] = [];
  const u32 = (value: number) => { const bytes = Buffer.alloc(4); bytes.writeUInt32LE(value); parts.push(bytes); };
  parts.push(Buffer.from(' FSC')); u32(3); u32(labels.length); u32(labels.filter(l => l.value !== undefined).length); u32(0); u32(languageId);
  for (const label of labels) {
    parts.push(Buffer.from(' LBL')); u32(label.value === undefined ? 0 : 1); u32(label.label.length); parts.push(Buffer.from(label.label, 'ascii'));
    if (label.value === undefined) continue;
    parts.push(Buffer.from(label.extra === undefined ? ' RTS' : 'WRTS')); u32(label.value.length);
    const bytes = Buffer.alloc(label.value.length * 2);
    for (let at = 0; at < label.value.length; at++) bytes.writeUInt16LE(label.value.charCodeAt(at) ^ 0xffff, at * 2);
    parts.push(bytes);
    if (label.extra !== undefined) { u32(label.extra.length); parts.push(Buffer.from(label.extra, 'ascii')); }
  }
  return Buffer.concat(parts);
}

