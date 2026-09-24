// Builds the two email logos in public/email/. Email clients cannot show SVG
// or WebP reliably, so both are PNG, trimmed to the mark, at 3x the size they
// are displayed at. Resizing and alpha only; the logo's geometry is untouched.
//
// mh-logo.png        on white, 156px, shown at 52px in the quote form's
//                    emails (tools/rfq-backend/Code.gs).
// mh-logo-clear.png  transparent, 144px, shown at 48px in the email
//                    signatures (../email-signature), so dark-mode mail apps
//                    do not draw a white tile around it.
//
// Why the clear one is not just the source file resized: the source webp was
// white-keyed, which also cut out the white detail INSIDE the mark (the vial
// label, the carton faces). On a dark background those show as holes. So
// clear regions the border flood cannot reach are found, and those on the
// steel (left) half, which are all icon detail, get their white back. The
// enclosed regions on the copper half are gaps between the molecule bonds and
// stay clear, so the background shows through them evenly. Position, not size,
// is the test: bond gaps of 1,458 and 1,584 px sit next to a 1,663 px label.
//
// Run from the Website folder:  node tools/email/make-logo.mjs

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('public/email', { recursive: true });
const trimmed = await sharp('src/assets/logo/mh-pharmapack-logo.webp').trim().toBuffer();

// ---- on white ----
const SIZE = 156;
await sharp(trimmed)
  .resize({ width: SIZE - 12, height: SIZE - 12, fit: 'contain', background: '#ffffff' })
  .extend({ top: 6, bottom: 6, left: 6, right: 6, background: '#ffffff' })
  .flatten({ background: '#ffffff' })
  .png({ compressionLevel: 9, palette: false })
  .toFile('public/email/mh-logo.png');

// ---- transparent, icon detail restored ----
const CLEAR_SIZE = 144;
const { data, info } = await sharp(trimmed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const isClear = (i) => data[i * 4 + 3] < 128;
const label = new Int32Array(W * H).fill(-1);
const regions = []; // { enclosed, centreX }
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
for (let s = 0; s < W * H; s++) {
  if (!isClear(s) || label[s] !== -1) continue;
  const id = regions.length;
  const stack = [s];
  label[s] = id;
  let n = 0, sumX = 0, edge = false;
  while (stack.length) {
    const i = stack.pop();
    const x = i % W, y = (i / W) | 0;
    n++; sumX += x;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
    for (const [dx, dy] of STEPS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (isClear(j) && label[j] === -1) { label[j] = id; stack.push(j); }
    }
  }
  regions.push({ enclosed: !edge, centreX: sumX / n });
}
const refill = (id) => id >= 0 && regions[id].enclosed && regions[id].centreX < W / 2;

let restored = 0;
for (let i = 0; i < W * H; i++) {
  const a = data[i * 4 + 3];
  let target = isClear(i) && refill(label[i]);
  // A partly transparent pixel beside a refilled region was anti-aliased
  // against white; composite it over white too, or it leaves a dark seam.
  if (!target && a >= 128 && a < 255) {
    const x = i % W, y = (i / W) | 0;
    target = STEPS.some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < W && ny < H && refill(label[ny * W + nx]);
    });
  }
  if (!target) continue;
  const f = a / 255;
  for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.round(data[i * 4 + c] * f + 255 * (1 - f));
  data[i * 4 + 3] = 255;
  restored++;
}
const enclosedCount = regions.filter((r) => r.enclosed).length;
const refilledCount = regions.filter((r, id) => refill(id)).length;

await sharp(await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer())
  .resize({ width: CLEAR_SIZE, height: CLEAR_SIZE, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile('public/email/mh-logo-clear.png');

for (const f of ['mh-logo.png', 'mh-logo-clear.png']) {
  const m = await sharp(`public/email/${f}`).metadata();
  console.log(`public/email/${f}`, m.width, 'x', m.height, m.hasAlpha ? '(alpha)' : '');
}
console.log(`clear logo: ${refilledCount} of ${enclosedCount} enclosed regions refilled white, ${restored} px`);
