// Draws one structure tile per API and writes the catalogue entries for them.
//
//   cd tools/api-art && npm install     (once; RDKit's WebAssembly build)
//   node tools/api-art/fetch.mjs        (from the Website folder; registry data)
//   node tools/api-art/render.mjs       (from the Website folder)
//
// In:  apis.json (the listings) and gsrs.json (structure, formula, weight and
//      CAS from the FDA/NCATS substance registry, public domain).
// Out: src/assets/catalogue/api-<slug>.svg, one tile per API, and
//      src/data/api-items.json, which src/data/catalogue.ts appends to the
//      catalogue.
//
// Why drawings and not photographs: nearly every API is a white or off-white
// powder, so photographs would make 35 identical cards, and the ones online
// are other companies' copyright. The skeletal formula is what a buyer
// actually recognises, it is a fact rather than anyone's artwork, and drawing
// it here from public-domain registry data keeps every tile legally clean and
// in one style.
//
// Colour: every tile gets its own hue from its class's family (greens and
// teals for corticosteroids, ambers for androgens, roses for progestogens,
// red for the cobalamin, which really is red), spread evenly across the
// family so neighbours never match. The structure is drawn in a deep shade of
// the same hue on a pale tint of it; small print overlaid by the card uses
// the same pair (tone.ink on tone.bg), so it is checked for contrast below.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('./', import.meta.url));
const initRDKitModule = require('@rdkit/rdkit');

const DIR = 'tools/api-art';
const { items } = JSON.parse(readFileSync(`${DIR}/apis.json`, 'utf8'));
const gsrs = JSON.parse(readFileSync(`${DIR}/gsrs.json`, 'utf8'));
const OUT_IMG = 'src/assets/catalogue';
const OUT_DATA = 'src/data/api-items.json';
mkdirSync(OUT_IMG, { recursive: true });

const RDKit = await initRDKitModule();
RDKit.prefer_coordgen(true);

// ---- colour ---------------------------------------------------------------

// Hue range per class; items are spread across it in list order.
// Wide ranges on purpose: the first pass (corticosteroids 148 to 198) opened
// the API view on a screen of near-identical greens.
const FAMILY = {
  vitamins: [352, 352],
  'hormones/progestogens': [308, 348],
  'hormones/androgens': [14, 48],
  corticosteroids: [118, 202],
  urology: [258, 282],
  cardiovascular: [218, 218],
  'anti-infectives': [70, 70],
};
const familyOf = (it) => (it.type ? `${it.group}/${it.type}` : it.group);

function hsl(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}
const hex = (rgb) => '#' + rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
const lum = (rgb) => {
  const c = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const members = {};
for (const it of items) (members[familyOf(it)] ??= []).push(it);
function toneFor(it) {
  const fam = familyOf(it);
  const range = FAMILY[fam];
  if (!range) throw new Error(`no colour family for ${fam}`);
  const list = members[fam];
  const i = list.indexOf(it);
  const h = list.length > 1 ? range[0] + ((range[1] - range[0]) * i) / (list.length - 1) : range[0];
  // A glow behind the molecule (glow) fading to the tile's edge colour (bg).
  // The first pass at 93% lightness read as one off-white across the grid,
  // so the tint is deliberately stronger: the colour has to be the first
  // thing a buyer sees.
  const glow = hsl(h, 62, 93);
  const bg = hsl(h, 56, 84);
  // Darker for greens: they are brighter than reds at equal lightness, and at
  // 25% the corticosteroid inks fell below 7:1.
  const ink = hsl(h, 62, 19);
  const mid = hsl(h, 42, 55);
  const ratio = contrast(bg, ink);
  if (ratio < 7) throw new Error(`${it.name}: ink on tint is only ${ratio.toFixed(2)}:1`);
  return { h, glow, bg, ink, mid, ratio };
}

// ---- formula ----------------------------------------------------------------

// The registry writes salts and complexes as dotted parts ("C22H28FO8P.2Na",
// "C62H88N13O14P.CH3.Co"); the catalogue shows the single Hill formula
// (carbon, hydrogen, then the rest alphabetically): C22H28FNa2O8P.
function hill(formula) {
  const total = {};
  for (const part of formula.split('.')) {
    const m = part.match(/^(\d*)(.*)$/);
    const mult = m[1] ? parseInt(m[1], 10) : 1;
    for (const [, el, n] of m[2].matchAll(/([A-Z][a-z]?)(\d*)/g)) {
      total[el] = (total[el] ?? 0) + (n ? parseInt(n, 10) : 1) * mult;
    }
  }
  const order = ['C', 'H', ...Object.keys(total).filter((e) => e !== 'C' && e !== 'H').sort()];
  return order.filter((e) => total[e]).map((e) => e + (total[e] > 1 ? total[e] : '')).join('');
}

// ---- drawing ----------------------------------------------------------------

const SIZE = 600;
const ELEMENTS = [1, 5, 6, 7, 8, 9, 11, 15, 16, 17, 27, 35];

function draw(smiles, tone) {
  const mol = RDKit.get_mol(smiles, JSON.stringify({ removeHs: true }));
  if (!mol || !mol.is_valid()) throw new Error(`RDKit could not read ${smiles.slice(0, 40)}`);
  const ink = tone.ink.map((v) => +v.toFixed(4));
  const palette = Object.fromEntries(ELEMENTS.map((z) => [z, ink]));
  const svg = mol.get_svg_with_highlights(JSON.stringify({
    width: SIZE,
    height: SIZE,
    clearBackground: false,
    bondLineWidth: 3.6,
    // Constant bond length, so a steroid is drawn at the same scale on every
    // tile; long molecules (the undecanoate ester, the cobalamin) shrink to fit.
    fixedBondLength: 52,
    padding: 0.1,
    addStereoAnnotation: false,
    atomColourPalette: palette,
    multipleBondOffset: 0.18,
    minFontSize: 13,
    maxFontSize: 22,
  }));
  mol.delete();
  // Keep RDKit's drawing, drop its XML prolog and its own <svg> wrapper so the
  // tile controls the canvas, the background and the metadata.
  const body = svg
    .replace(/<\?xml[^>]*>\s*/, '')
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<rect[^>]*style='opacity:1\.0;fill:#FFFFFF[^>]*\/>/i, '')
    // Round ends and joins read softer and survive downscaling better.
    .replace(/stroke-linecap:butt/g, 'stroke-linecap:round')
    .replace(/stroke-linejoin:miter/g, 'stroke-linejoin:round');
  return body;
}

function tile(body, tone, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" role="img" aria-label="${title}">
<title>${title}</title>
<defs><radialGradient id="g" cx="50%" cy="46%" r="62%"><stop offset="0" stop-color="${hex(tone.glow)}"/><stop offset="1" stop-color="${hex(tone.bg)}"/></radialGradient></defs>
<rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
<g>${body}</g>
</svg>
`;
}

// ---- entries ----------------------------------------------------------------

const slugify = (s) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const entries = [];
const report = [];

for (const it of items) {
  const rec = gsrs[it.gsrs];
  if (!rec) throw new Error(`${it.name}: not in gsrs.json; run fetch.mjs`);
  const drawRec = it.drawAs ? gsrs[it.drawAs] : rec;
  if (!drawRec?.smiles) throw new Error(`${it.name}: no structure to draw`);
  const tone = toneFor(it);
  const file = `api-${slugify(it.name)}.svg`;
  const title = it.drawAs
    ? `Structure of ${drawRec.name.toLowerCase()}, the main component of ${it.name}`
    : `Structure of ${it.name}`;
  writeFileSync(`${OUT_IMG}/${file}`, tile(draw(drawRec.smiles, tone), tone, title));

  const specs = [];
  if (rec.casPrimary?.length) specs.push({ label: 'CAS number', value: rec.casPrimary[0] });
  if (rec.formula) specs.push({ label: 'Molecular formula', value: hill(rec.formula) });
  if (rec.mw) specs.push({ label: 'Molecular weight', value: `${Number(rec.mw).toFixed(2)} g/mol` });
  if (rec.class === 'mixture' && rec.mixture?.length) {
    const parts = rec.mixture
      .map((m) => m.replace(/ SULFATE$/i, '').replace(/^POLYMYXIN /i, ''))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
      .join(', ');
    specs.push({ label: 'Composition', value: `Mixture of polymyxins ${parts}, as sulphates` });
  }
  if (rec.unii) specs.push({ label: 'FDA UNII', value: rec.unii });

  entries.push({
    name: it.name,
    group: it.group,
    ...(it.type ? { type: it.type } : {}),
    image: file,
    structure: true,
    ...(it.restricted ? { restricted: true } : {}),
    // "POLYMYXIN B1" -> "polymyxin B1", for the item page's note.
    ...(it.drawAs ? { structureOf: drawRec.name.toLowerCase().replace(/\bb(\d)\b/g, 'B$1') } : {}),
    tone: { bg: hex(tone.bg), glow: hex(tone.glow), ink: hex(tone.ink), mid: hex(tone.mid) },
    keywords: it.keywords,
    specs,
  });
  report.push(`${it.name.padEnd(32)} h${String(Math.round(tone.h)).padStart(3)} ${tone.ratio.toFixed(1)}:1  ${specs.map((s) => s.value).join(' | ')}`);
}

writeFileSync(OUT_DATA, JSON.stringify(entries, null, 2) + '\n');
console.log(report.join('\n'));
console.log(`\n${entries.length} tiles -> ${OUT_IMG}/api-*.svg, entries -> ${OUT_DATA}`);
