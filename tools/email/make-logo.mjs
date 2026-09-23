// Builds public/email/mh-logo.png, the mark shown in the quote form's
// emails (tools/rfq-backend/Code.gs). Email clients cannot show SVG or
// WebP reliably, so this is a PNG: trimmed to the mark, on white (Outlook
// and some dark-mode clients do odd things with transparency), 3x the
// 52px it is displayed at. Resizing only; the logo's geometry is untouched.
//
// Run from the Website folder:  node tools/email/make-logo.mjs

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SIZE = 156;
mkdirSync('public/email', { recursive: true });

const trimmed = await sharp('src/assets/logo/mh-pharmapack-logo.webp').trim().toBuffer();
await sharp(trimmed)
  .resize({ width: SIZE - 12, height: SIZE - 12, fit: 'contain', background: '#ffffff' })
  .extend({ top: 6, bottom: 6, left: 6, right: 6, background: '#ffffff' })
  .flatten({ background: '#ffffff' })
  .png({ compressionLevel: 9, palette: false })
  .toFile('public/email/mh-logo.png');

const meta = await sharp('public/email/mh-logo.png').metadata();
console.log('public/email/mh-logo.png', meta.width, 'x', meta.height);
