// Site favicons from the full MH mark (client decision 2026-09-30, replacing the links-only set).
// The textured mark only holds up on light grounds, so each icon sits on a white rounded tile:
// that keeps it whole on dark browser tabs too.
// Writes into public/: favicon.ico (16, 32, 48), favicon-32.png, icon-192.png, apple-touch-icon.png
// and a comparison sheet to tools/favicon/out/preview.png. Run from the Website folder:
//   node tools/favicon/make.mjs
import sharp from 'sharp';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';

const SRC = process.env.MH_LOGO_MASTER || 'src/assets/logo/mh-pharmapack-logo.webp';
mkdirSync('tools/favicon/out', { recursive: true });
const mark = await sharp(SRC).flatten({ background: '#ffffff' }).trim({ threshold: 12 }).png().toBuffer();

// One icon: a white tile (rounded unless opaque) with the mark centred at `fill` of the width.
async function icon(size, { fill = 0.9, radius = 0.2, opaque = false } = {}) {
  const m = await sharp(mark).resize({ width: Math.round(size * fill), kernel: 'lanczos3' }).toBuffer({ resolveWithObject: true });
  const r = opaque ? 0 : Math.max(2, Math.round(size * radius));
  const tile = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#ffffff"/></svg>`);
  const left = Math.round((size - m.info.width) / 2), top = Math.round((size - m.info.height) / 2);
  const base = opaque
    ? sharp({ create: { width: size, height: size, channels: 3, background: '#ffffff' } })
    : sharp(tile);
  return base.composite([{ input: m.data, left, top }]).png({ compressionLevel: 9 }).toBuffer();
}

// ICO with PNG-compressed entries (supported by every current browser).
function ico(entries) {
  const head = Buffer.alloc(6 + 16 * entries.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(entries.length, 4);
  let offset = head.length;
  entries.forEach(({ size, buf }, i) => {
    const o = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, o); head.writeUInt8(size >= 256 ? 0 : size, o + 1);
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(buf.length, o + 8); head.writeUInt32LE(offset, o + 12);
    offset += buf.length;
  });
  return Buffer.concat([head, ...entries.map(e => e.buf)]);
}

const i16 = await icon(16, { fill: 0.94, radius: 0.19 });
const i32 = await icon(32, { fill: 0.92 });
const i48 = await icon(48, { fill: 0.9 });
const i192 = await icon(192, { fill: 0.86 });
const apple = await icon(180, { fill: 0.8, opaque: true });
writeFileSync('public/favicon.ico', ico([{ size: 16, buf: i16 }, { size: 32, buf: i32 }, { size: 48, buf: i48 }]));
writeFileSync('public/favicon-32.png', i32);
writeFileSync('public/icon-192.png', i192);
writeFileSync('public/apple-touch-icon.png', apple);
console.log('icons written: favicon.ico (16, 32, 48), favicon-32.png, icon-192.png, apple-touch-icon.png');

// Comparison sheet: old links-only icon (if still on disk as a backup) and the new one,
// at 1x on light and dark tab colours, plus an 8x enlargement of the 16 and 32 px versions.
const OLD32 = 'tools/favicon/out/old-favicon-32.png';
const rows = [];
if (existsSync(OLD32)) rows.push({ label: 'old', b32: await sharp(OLD32).toBuffer(), b16: await sharp(OLD32).resize(16, 16).toBuffer() });
rows.push({ label: 'new', b32: i32, b16: i16 });
const W = 560, H = 120 * rows.length, tiles = [];
rows.forEach((row, ri) => {
  const y = ri * 120;
  tiles.push({ input: row.b16, left: 20, top: y + 20 }, { input: row.b32, left: 48, top: y + 12 });
  tiles.push({ input: row.b16, left: 110, top: y + 20 }, { input: row.b32, left: 138, top: y + 12 });
});
for (const [ri, row] of rows.entries()) {
  tiles.push({ input: await sharp(row.b16).resize(96, 96, { kernel: 'nearest' }).toBuffer(), left: 220, top: ri * 120 + 12 });
  tiles.push({ input: await sharp(row.b32).resize(96, 96, { kernel: 'nearest' }).toBuffer(), left: 340, top: ri * 120 + 12 });
  tiles.push({ input: await sharp(apple).resize(96, 96).toBuffer(), left: 450, top: ri * 120 + 12 });
}
const bg = Buffer.from(`<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#e8eaed"/><rect x="90" width="90" height="${H}" fill="#202124"/></svg>`);
await sharp(bg).composite(tiles).png().toFile('tools/favicon/out/preview.png');
console.log('preview written (rows:', rows.map(r => r.label).join(', ') + ')');
