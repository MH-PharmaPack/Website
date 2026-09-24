// Draws one tile per finished formulation and writes the catalogue entries.
//
//   cd tools/api-art && npm install     (once; the RDKit WebAssembly build is shared)
//   node tools/ff-art/fetch.mjs         (from the Website folder; registry data)
//   node tools/ff-art/render.mjs        (from the Website folder)
//
// In:  products.json (the curated list: generic names, strengths, dosage form)
//      gsrs.json     (per ingredient: structure, WHO ATC codes; FDA/NCATS
//                     registry, public domain)
// Out: src/assets/catalogue/ff-<slug>.svg, src/data/ff-items.json and
//      src/data/ff-taxonomy.json (the Finished Formulations groups and types,
//      read by src/data/catalogue.ts).
//
// products.json holds generic names only. It was curated from partner price
// lists; no partner, brand or product code is carried into it, and nothing
// here may add one.
//
// Where a product goes: the main ingredient's WHO ATC code decides. Its
// cephalosporins (J01D B/C/D/E/I) and carbapenems and penicillins (J01DH,
// J01C) go to their own groups, because they come from segregated plant
// lines; everything else goes by dosage form. Inside Injectables and Tablets &
// Capsules, the ATC code also gives the therapy area used as the filter type.
//
// The tile: the main ingredient's skeletal formula, in a colour from its
// therapy area's family, with the dosage form drawn small in the corner. When
// the registry has no structure (enzymes, botanicals, "multivitamin", a
// protein), the dosage form is drawn large instead.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../api-art/', import.meta.url));
const initRDKitModule = require('@rdkit/rdkit');

const DIR = 'tools/ff-art';
const { items } = JSON.parse(readFileSync(`${DIR}/products.json`, 'utf8'));
const gsrs = JSON.parse(readFileSync(`${DIR}/gsrs.json`, 'utf8'));
const OUT_IMG = 'src/assets/catalogue';
mkdirSync(OUT_IMG, { recursive: true });

const RDKit = await initRDKitModule();
RDKit.prefer_coordgen(true);

// ---- therapy areas ------------------------------------------------------------

// `label` names the filter; `tile` is the short form printed on the tile,
// which has to fit one line beside the dosage form icon on a 344 px phone.
// Hue ranges are wide on purpose, and a family's members are spread across
// theirs by the golden ratio rather than in order, so neighbouring tiles in a
// group never match: the first pass (anti-infectives 160 to 182, in order)
// opened the line on a screen of one teal, the mistake the API tiles made.
const THERAPY = {
  'anti-infectives': { label: 'Anti-infectives', tile: 'Infections', hue: [138, 206] },
  pain: { label: 'Pain & Inflammation', tile: 'Pain', hue: [10, 40] },
  gastro: { label: 'Gastrointestinal', tile: 'Gastro', hue: [62, 102] },
  cns: { label: 'CNS & Psychiatry', tile: 'CNS', hue: [268, 312] },
  critical: { label: 'Anaesthesia & Critical Care', tile: 'Critical care', hue: [-10, 12] },
  cardio: { label: 'Cardiovascular', tile: 'Cardio', hue: [210, 242] },
  diabetes: { label: 'Diabetes', tile: 'Diabetes', hue: [98, 132] },
  blood: { label: 'Blood & Iron', tile: 'Blood & iron', hue: [328, 352] },
  vitamins: { label: 'Vitamins & Minerals', tile: 'Vitamins', hue: [34, 54] },
  nutrition: { label: 'Nutrition', tile: 'Nutrition', hue: [46, 64] },
  respiratory: { label: 'Respiratory & Allergy', tile: 'Respiratory', hue: [118, 156] },
  hormones: { label: 'Hormones & Steroids', tile: 'Hormones', hue: [258, 292] },
  urology: { label: 'Urology', tile: 'Urology', hue: [182, 202] },
  oncology: { label: 'Oncology', tile: 'Oncology', hue: [310, 330] },
  veterinary: { label: 'Veterinary', tile: 'Veterinary', hue: [90, 100] },
  cephalosporins: { label: 'Cephalosporins', tile: 'Cephalosporin', hue: [192, 236] },
  'beta-lactams': { label: 'Beta-lactams', tile: 'Beta-lactam', hue: [238, 272] },
  dermatology: { label: 'Dermatology', tile: 'Skin', hue: [150, 184] },
};
const THERAPY_ORDER = ['anti-infectives', 'pain', 'gastro', 'cns', 'critical', 'cardio', 'diabetes', 'blood', 'vitamins',
  'respiratory', 'hormones', 'urology', 'oncology', 'dermatology', 'nutrition', 'veterinary'];

/** The ATC code that describes this ingredient itself (its own level-5
 *  entry), from the part of the index that fits the dosage form:
 *  dermatological codes (and rubs, for gels) for creams, gels and soaps, stomatological ones for a
 *  mouthwash, and no dermatological or sensory-organ codes for anything
 *  taken or injected. */
const PREFER = {
  topical: (c) => /^(D|M02)/.test(c),
  soap: (c) => /^D/.test(c),
  mouthwash: (c) => /^A01/.test(c),
};
// Codes for local use, never the right class for something swallowed or
// injected: skin, eyes and ears, mouth, haemorrhoids, vaginal, nasal, throat,
// rubs, and intestinal-only corticosteroids.
const LOCAL = /^(D|S|A01|A07EA|C05|G01|G02CC|M02|R01|R02)/;
// Molecules the WHO index files in more than one systemic class: the class
// that fits these products. Used only when the code is in the pool above.
const PREFERRED_ATC = {
  lidocaine: 'N01BB02', // local anaesthetic, not the antiarrhythmic
  buprenorphine: 'N02AE01', // analgesic injection, not opioid dependence
  ketoconazole: 'J02AB02', // antifungal, not the anticorticosteroid
  clonidine: 'C02AC01', // antihypertensive, not the migraine code
  aspirin: 'B01AC06', // gastro-resistant low dose: antiplatelet
  cholecalciferol: 'A11CC05',
  'iron sucrose': 'B03AC02', // parenteral iron, not the oral code
  diclofenac: 'M02AA15', // a gel is a pain rub (systemic forms never see M02)
  'fusidic acid': 'D06AX01', // topical antibiotic, not a medicated dressing
  dextrose: 'V06DC01', // a nutrient, not the glucose tolerance test
};
const picks = [];
function pickAtc(active, form) {
  const rec = gsrs[active];
  if (!rec || rec.miss || !rec.atc?.length) return null;
  const own = (a) => (a.path.at(-1) ?? '').toLowerCase();
  let pool = rec.atc;
  const fits = PREFER[form] ?? ((c) => !LOCAL.test(c));
  const preferred = pool.filter((a) => fits(a.code));
  if (preferred.length) pool = preferred;
  const chosen = pool.find((a) => a.code === PREFERRED_ATC[active]);
  if (chosen) return chosen;
  const names = [active.toLowerCase(), (rec.name ?? '').toLowerCase()];
  const byName = pool.find((a) => names.includes(own(a))) ?? pool.find((a) => names.some((n) => own(a).startsWith(n)));
  // No code named for the molecule itself: the first one is taken, and
  // listed at the end of the run for a look.
  if (!byName) picks.push(`${active}: ${pool[0].code} ${pool[0].path.at(-1)} (of ${pool.map((a) => a.code).join(', ')})`);
  return byName ?? pool[0];
}

function therapyFromAtc(code) {
  const c = code.toUpperCase();
  if (/^J01D[BCDEI]/.test(c)) return 'cephalosporins';
  if (/^J01DH|^J01C/.test(c)) return 'beta-lactams';
  if (/^[JP]/.test(c)) return 'anti-infectives';
  if (/^A10/.test(c)) return 'diabetes';
  if (/^A1[12]/.test(c)) return 'vitamins';
  if (/^A/.test(c)) return 'gastro';
  if (/^B05/.test(c)) return 'critical';
  if (/^B/.test(c)) return 'blood';
  if (/^C01C/.test(c)) return 'critical';
  if (/^C/.test(c)) return 'cardio';
  if (/^D01B/.test(c)) return 'anti-infectives';
  if (/^D/.test(c)) return 'dermatology';
  if (/^G04/.test(c)) return 'urology';
  if (/^[GH]/.test(c)) return 'hormones';
  if (/^L/.test(c)) return 'oncology';
  if (/^M03A[ABC]/.test(c)) return 'critical';
  if (/^M/.test(c)) return 'pain';
  if (/^N01/.test(c)) return 'critical';
  if (/^N02/.test(c)) return 'pain';
  if (/^N/.test(c)) return 'cns';
  if (/^R/.test(c)) return 'respiratory';
  if (/^V03/.test(c)) return 'critical';
  return null;
}

// Main ingredients the registry gives no WHO ATC code (a salt or ester whose
// parent has one, a molecule not in the WHO index, an enzyme): their therapy
// area, from the parent molecule's code or the ingredient's use.
const NO_ATC = {
  ramosetron: 'gastro',
  dimenhydrinate: 'gastro',
  'haloperidol decanoate': 'cns',
  'zuclopenthixol decanoate': 'cns',
  'betamethasone dipropionate': 'dermatology',
  'menadione sodium bisulfite': 'blood',
  'iron dextran': 'blood',
  'ferric carboxymaltose': 'blood',
  serrapeptase: 'pain',
  levalbuterol: 'respiratory',
  'methyl salicylate': 'pain',
  menthol: 'respiratory',
  simethicone: 'gastro',
  diastase: 'gastro',
  'chondroitin sulfate': 'pain',
};

// Context the ATC code cannot see: what the combination is actually for.
const THERAPY_OVERRIDE = {
  'Doxylamine, Pyridoxine and Folic Acid Tablets': 'gastro',
  'Paracetamol, Phenylephrine and Chlorpheniramine Tablets': 'respiratory',
  'Paracetamol, Caffeine, Phenylephrine and Diphenhydramine Tablets': 'respiratory',
  'Griseofulvin Tablets': 'anti-infectives',
  'Glucose Injection': 'critical',
};

// ---- groups -----------------------------------------------------------------------

const FORM_GROUP = {
  inj: 'injectables', injp: 'injectables', tablet: 'tablets-capsules', capsule: 'tablets-capsules',
  softgel: 'tablets-capsules', liquid: 'liquids', mouthwash: 'liquids', powder: 'dry-powders', topical: 'topicals', soap: 'topicals',
};
const INJECTION = new Set(['inj', 'injp']);
const GROUPS = [
  { id: 'injectables', name: 'Injectables', typed: 'inj' },
  { id: 'tablets-capsules', name: 'Tablets & Capsules', typed: 'osd' },
  { id: 'liquids', name: 'Liquids' },
  { id: 'dry-powders', name: 'Dry Powders' },
  { id: 'cephalosporins', name: 'Cephalosporins', split: true },
  { id: 'beta-lactams', name: 'Beta-lactams', split: true },
  { id: 'topicals', name: 'Topicals' },
];

function formLabel(p) {
  const n = p.name;
  switch (p.form) {
    case 'injp': return /Infusion/.test(n) ? 'Powder for infusion' : /Suspension/.test(n) ? 'Powder for injectable suspension' : 'Powder for injection';
    case 'inj': return /Suspension/.test(n) ? 'Injectable suspension' : /Emulsion/.test(n) ? 'Injectable emulsion' : /Concentrate/.test(n) ? 'Concentrate for injection' : 'Injection';
    case 'tablet': return /Dispersible/.test(n) ? 'Dispersible tablets' : /Orally Disintegrating/.test(n) ? 'Orally disintegrating tablets'
      : /Gastro-resistant/.test(n) ? 'Gastro-resistant tablets' : /Extended-release/.test(n) ? 'Extended-release tablets'
      : /Prolonged-release/.test(n) ? 'Prolonged-release tablets' : 'Tablets';
    case 'capsule': return /Gastro-resistant/.test(n) ? 'Gastro-resistant capsules' : 'Capsules';
    case 'softgel': return 'Softgel capsules';
    case 'liquid': return /Suspension/.test(n) ? 'Oral suspension' : 'Syrup';
    case 'mouthwash': return 'Mouthwash';
    case 'powder': return 'Oral powder';
    case 'topical': return /Gel$/.test(n) ? 'Gel' : 'Cream';
    case 'soap': return 'Medicated soap';
  }
  throw new Error(`unknown form ${p.form}`);
}

// ---- colour -----------------------------------------------------------------------

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

// ---- dosage form icons (drawn in a 100 x 100 box) ------------------------------

const ICON = {
  vial: '<rect x="36" y="8" width="28" height="12" rx="3"/><path d="M40 20v8c-8 3-12 8-12 15v39a10 10 0 0 0 10 10h24a10 10 0 0 0 10-10V43c0-7-4-12-12-15v-8"/><path d="M28 56h44"/>',
  tablet: '<circle cx="42" cy="48" r="26"/><path d="M24 30l36 36"/><ellipse cx="74" cy="72" rx="16" ry="10" transform="rotate(-30 74 72)"/>',
  capsule: '<rect x="18" y="36" width="64" height="30" rx="15" transform="rotate(-35 50 51)"/><path d="M50 36v30" transform="rotate(-35 50 51)"/>',
  softgel: '<ellipse cx="50" cy="50" rx="34" ry="20" transform="rotate(-35 50 50)"/><path d="M34 44c6-6 16-9 24-8" transform="rotate(-35 50 50)"/>',
  bottle: '<rect x="38" y="6" width="24" height="12" rx="2"/><path d="M40 18v8c-10 4-16 11-16 21v36a10 10 0 0 0 10 10h32a10 10 0 0 0 10-10V47c0-10-6-17-16-21v-8"/><rect x="34" y="52" width="32" height="22" rx="2"/>',
  sachet: '<path d="M22 14h56v72H22z"/><path d="M22 24h56M22 76h56"/><path d="M34 14l-4-6M66 14l4-6"/><circle cx="50" cy="50" r="10"/>',
  tube: '<path d="M30 20h40l-6 64H36z"/><rect x="42" y="6" width="16" height="14" rx="2"/><path d="M34 70h32"/>',
  soap: '<rect x="14" y="34" width="72" height="40" rx="14"/><circle cx="30" cy="22" r="6"/><circle cx="46" cy="16" r="4"/><circle cx="60" cy="24" r="5"/>',
};
const ICON_OF = { inj: 'vial', injp: 'vial', tablet: 'tablet', capsule: 'capsule', softgel: 'softgel', liquid: 'bottle', mouthwash: 'bottle', powder: 'sachet', topical: 'tube', soap: 'soap' };

// ---- drawing -----------------------------------------------------------------------

const SIZE = 600;
const ELEMENTS = [1, 5, 6, 7, 8, 9, 11, 12, 13, 15, 16, 17, 19, 20, 26, 27, 30, 35, 53];

function drawMolecule(smiles, tone) {
  // A salt or hydrate is recorded as dotted parts; only the drug itself (the
  // largest part) is drawn, so a sodium salt does not float a stray Na+.
  // When the metal is the point (iron, calcium, zinc salts) the largest part
  // is only the carrier (citrate, gluconate), so those show the dosage form.
  const [main, ...rest] = smiles.split('.').sort((a, b) => b.length - a.length);
  if (rest.some((f) => /\[?(Fe|Zn|Ca|Mg|Al|Cu|Mn|Cr|Se|Li)[+\]\d]/.test(f)) && !/Fe|Zn|Ca|Mg|Al|Cu|Mn|Cr|Se|Li/.test(main)) {
    return null;
  }
  const mol = RDKit.get_mol(main, JSON.stringify({ removeHs: true }));
  if (!mol || !mol.is_valid()) return null;
  // A bare ion or a tiny molecule (the sulfate of zinc sulfate) says nothing
  // about the product; those tiles show the dosage form instead.
  const heavy = JSON.parse(mol.get_descriptors()).NumHeavyAtoms;
  if (!(heavy >= 6)) {
    mol.delete();
    return null;
  }
  const ink = tone.ink.map((v) => +v.toFixed(4));
  const svg = mol.get_svg_with_highlights(JSON.stringify({
    width: SIZE, height: SIZE, clearBackground: false, bondLineWidth: 3.6, fixedBondLength: 52, padding: 0.14,
    addStereoAnnotation: false, atomColourPalette: Object.fromEntries(ELEMENTS.map((z) => [z, ink])),
    multipleBondOffset: 0.18, minFontSize: 13, maxFontSize: 22,
  }));
  mol.delete();
  return svg
    .replace(/<\?xml[^>]*>\s*/, '').replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
    .replace(/<!--[\s\S]*?-->/g, '').replace(/<rect[^>]*style='opacity:1\.0;fill:#FFFFFF[^>]*\/>/i, '')
    .replace(/stroke-linecap:butt/g, 'stroke-linecap:round').replace(/stroke-linejoin:miter/g, 'stroke-linejoin:round');
}

function icon(name, x, y, size, color, width) {
  const s = size / 100;
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${color}" stroke-width="${width / s}" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</g>`;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function tile(body, tone, title, iconName, big) {
  const ink = hex(tone.ink);
  const corner = big ? '' : icon(iconName, SIZE - 98, 24, 72, hex(tone.mid), 4.5);
  const centre = big ? icon(iconName, 170, 150, 260, ink, 5) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<defs><radialGradient id="g" cx="50%" cy="46%" r="62%"><stop offset="0" stop-color="${hex(tone.glow)}"/><stop offset="1" stop-color="${hex(tone.bg)}"/></radialGradient></defs>
<rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
${corner}${centre}<g>${body ?? ''}</g>
</svg>
`;
}

// ---- entries --------------------------------------------------------------------------

const slugify = (s) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

// First pass: where each product goes and its therapy, so colours can be
// spread across each family.
// Veterinary-only molecules (ceftiofur) have no human ATC code; their name
// still says which antibiotic line they run on.
const lineByName = (active) =>
  /^cef|^ceph/.test(active) ? 'cephalosporins' : /penem$|cillin$|bactam$/.test(active) ? 'beta-lactams' : null;

const unplaced = [];
const placed = items.map((p) => {
  const atc = pickAtc(p.actives[0], p.form);
  const fromAtc = atc ? therapyFromAtc(atc.code) : lineByName(p.actives[0]) ?? NO_ATC[p.actives[0]] ?? null;
  let group = FORM_GROUP[p.form];
  if (fromAtc === 'cephalosporins' || fromAtc === 'beta-lactams') group = fromAtc;
  let therapy = THERAPY_OVERRIDE[p.name] ?? p.therapy ?? (fromAtc === 'cephalosporins' || fromAtc === 'beta-lactams' ? null : fromAtc);
  if (p.vet && group !== 'cephalosporins' && group !== 'beta-lactams') therapy = 'veterinary';
  if (group === 'cephalosporins' || group === 'beta-lactams') therapy = group;
  if (!therapy) {
    unplaced.push(`${p.name} (${p.actives[0]})`);
    return null;
  }
  let type;
  const g = GROUPS.find((x) => x.id === group);
  if (g.typed) type = `${g.typed}-${therapy}`;
  if (g.split) type = `${group === 'cephalosporins' ? 'ceph' : 'bl'}-${INJECTION.has(p.form) ? 'injections' : 'oral'}`;
  return { p, atc, group, therapy, type };
});
if (unplaced.length) {
  throw new Error(`no therapy area for ${unplaced.length}; add the main ingredient to NO_ATC or a therapy to products.json:\n  ${unplaced.join('\n  ')}`);
}

const family = {};
for (const x of placed) (family[x.therapy] ??= []).push(x);
const entries = [];
const report = [];
let drawn = 0;

for (const x of placed) {
  const { p, atc, group, therapy, type } = x;
  const fam = THERAPY[therapy];
  const list = family[therapy];
  const i = list.indexOf(x);
  const [h0, h1] = fam.hue;
  const h = (h0 + (h1 - h0) * ((i * 0.618034) % 1) + 360) % 360;
  const tone = { glow: hsl(h, 62, 93), bg: hsl(h, 56, 84), ink: hsl(h, 62, 19), mid: hsl(h, 42, 50) };
  const ratio = contrast(tone.bg, tone.ink);
  if (ratio < 7) throw new Error(`${p.name}: ink on tint only ${ratio.toFixed(2)}:1`);

  const main = gsrs[p.actives[0]];
  const smiles = main && !main.miss && main.smiles ? main.smiles : null;
  const body = smiles ? drawMolecule(smiles, tone) : null;
  if (body) drawn++;
  const iconName = ICON_OF[p.form];
  const file = `ff-${slugify(p.name)}.svg`;
  const title = body ? `Structure of ${p.actives[0]}, the main ingredient of ${p.name}` : `${formLabel(p)}: ${p.name}`;
  writeFileSync(`${OUT_IMG}/${file}`, tile(body, tone, title, iconName, !body));

  const form = formLabel(p);
  const specs = [{ label: 'Dosage form', value: form }];
  if (p.strengths.length) specs.push({ label: p.strengths.length > 1 ? 'Strengths' : 'Strength', value: p.strengths.join(', ') });
  if (p.rel) specs.push({ label: 'Release', value: p.rel });
  if (p.note) specs.push({ label: 'Composition', value: p.note });
  if (p.also) specs.push({ label: 'Also supplied as', value: p.also });
  if (p.vet) specs.push({ label: 'Use', value: 'Veterinary' });
  if (atc) {
    // The class is the ATC level above the substance. The index writes most
    // in sentence case ("ACE inhibitors, plain"); an all-capitals one is
    // brought down to match.
    const cls = atc.path.at(-2) ?? '';
    specs.push({
      label: p.actives.length > 1 ? 'WHO ATC (main ingredient)' : 'WHO ATC',
      value: cls ? `${atc.code}, ${cls === cls.toUpperCase() ? sentence(cls) : cls}` : atc.code,
    });
  }

  // The catalogue splits the strengths list on ", " (src/lib/catalogue.ts).
  for (const s of p.strengths) if (s.includes(', ')) throw new Error(`${p.name}: strength "${s}" contains ", "`);
  entries.push({
    name: p.name,
    group,
    ...(type ? { type } : {}),
    image: file,
    ...(body ? { structure: true, structureOf: p.actives[0] } : {}),
    dosageForm: form,
    therapy: fam.tile,
    ...(p.restricted ? { restricted: true } : {}),
    tone: { bg: hex(tone.bg), glow: hex(tone.glow), ink: hex(tone.ink), mid: hex(tone.mid) },
    keywords: [p.kw, p.actives.join(' '), fam.label, p.vet ? 'veterinary' : ''].filter(Boolean).join(' '),
    specs,
  });
  report.push(`${group.padEnd(16)} ${(type ?? '').padEnd(22)} ${body ? 'mol ' : 'form'} ${p.name}`);
}

// Groups and types, in a fixed order, only where there are items.
const taxonomy = GROUPS.map((g) => {
  const inG = entries.filter((e) => e.group === g.id);
  if (!inG.length) return null;
  let types;
  if (g.typed) {
    types = THERAPY_ORDER.filter((t) => inG.some((e) => e.type === `${g.typed}-${t}`))
      .map((t) => ({ id: `${g.typed}-${t}`, name: `${g.name}: ${THERAPY[t].label}`, short: THERAPY[t].label }));
  }
  if (g.split) {
    const pre = g.id === 'cephalosporins' ? 'ceph' : 'bl';
    const one = g.id === 'cephalosporins' ? 'Cephalosporin' : 'Beta-lactam';
    types = ['injections', 'oral'].filter((k) => inG.some((e) => e.type === `${pre}-${k}`))
      .map((k) => ({
        id: `${pre}-${k}`,
        name: k === 'injections' ? `${one} Injections` : `Oral ${g.name}`,
        short: k === 'injections' ? 'Injections' : 'Oral',
      }));
  }
  return { id: g.id, name: g.name, ...(types ? { types } : {}) };
}).filter(Boolean);

writeFileSync('src/data/ff-items.json', JSON.stringify(entries, null, 1) + '\n');
writeFileSync('src/data/ff-taxonomy.json', JSON.stringify(taxonomy, null, 1) + '\n');
console.log(report.join('\n'));
const byGroup = {};
for (const e of entries) byGroup[e.group] = (byGroup[e.group] ?? 0) + 1;
console.log('\n', byGroup, `\n${entries.length} tiles, ${drawn} with a structure, ${entries.length - drawn} with the dosage form`);
if (picks.length) console.log(`\nATC taken without a name match (check these):\n  ${[...new Set(picks)].join('\n  ')}`);
