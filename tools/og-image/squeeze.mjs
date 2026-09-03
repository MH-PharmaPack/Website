// Palette-quantise the raw headless-Edge screenshots into shippable PNGs.
//
// Usage, from the Website/ root:
//   node tools/og-image/squeeze.mjs <folder holding the .raw.png files> public
//
// Palette quantisation rather than JPEG: the cards are mostly type, and JPEG
// ringing on letter edges is exactly what a link preview cannot afford. The
// brand gradients are gentle enough that 256 colours with a little dithering
// holds up, and it takes both files from ~200 KB to under 50 KB.
import sharp from 'sharp';
import { statSync } from 'node:fs';

const [, , SRC, OUT] = process.argv;

if (!SRC || !OUT) {
  console.error('usage: node tools/og-image/squeeze.mjs <src-dir> <out-dir>');
  process.exit(1);
}

async function run(inName, outName, opts) {
  const src = `${SRC}/${inName}`;
  const dst = `${OUT}/${outName}`;
  await sharp(src).png(opts).toFile(dst);
  const kb = (p) => (statSync(p).size / 1024).toFixed(1);
  console.log(`${outName}: ${kb(src)} KB -> ${kb(dst)} KB`);
}

await run('og-image.raw.png', 'og-image.png', {
  palette: true,
  quality: 90,
  effort: 10,
  dither: 0.6,
});

await run('logo-512.raw.png', 'logo-512.png', {
  palette: true,
  quality: 92,
  effort: 10,
  dither: 0.8,
});
