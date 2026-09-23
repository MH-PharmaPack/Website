// LinkedIn Page images, sized to LinkedIn's own recommendations:
//   logo  400 x 400  (the mark on white, padded so LinkedIn's rounded crop
//                     never clips it)
//   cover 1512 x 256, delivered at 2x (3024 x 512) so it stays sharp on
//                     high-density screens; LinkedIn scales it down
//
// The cover is a headless Edge screenshot of cover.html (see README.md in
// ../og-image for why screenshots). Run from the Website folder:
//   1. screenshot cover.html to tools/linkedin/cover.raw.png (command in
//      the comment at the end of this file)
//   2. node tools/linkedin/make.mjs
// Output goes to tools/linkedin/out/ (not public/: these are uploaded to
// LinkedIn by hand, not served by the site).

import sharp from 'sharp';
import { mkdirSync, existsSync } from 'node:fs';

const OUT = 'tools/linkedin/out';
mkdirSync(OUT, { recursive: true });

const mark = await sharp('src/assets/logo/mh-pharmapack-logo.webp').trim().toBuffer();
await sharp(mark)
  .resize({ width: 300, height: 300, fit: 'contain', background: '#ffffff' })
  .extend({ top: 50, bottom: 50, left: 50, right: 50, background: '#ffffff' })
  .flatten({ background: '#ffffff' })
  .png({ compressionLevel: 9 })
  .toFile(`${OUT}/mh-pharmapack-linkedin-logo-400.png`);
console.log('logo written');

if (existsSync('tools/linkedin/cover.raw.png')) {
  await sharp('tools/linkedin/cover.raw.png')
    .extract({ left: 0, top: 0, width: 3024, height: 512 })
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/mh-pharmapack-linkedin-cover-3024x512.png`);
  console.log('cover written');
} else {
  console.log('no cover.raw.png yet: take the screenshot first');
}

// Screenshot (PowerShell, from the Website folder):
//   & "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new `
//     --disable-gpu --hide-scrollbars --allow-file-access-from-files `
//     --force-device-scale-factor=2 --virtual-time-budget=6000 --window-size=1512,600 `
//     --screenshot="$PWD\tools\linkedin\cover.raw.png" "file:///$($PWD.Path.Replace('\','/'))/tools/linkedin/cover.html"
