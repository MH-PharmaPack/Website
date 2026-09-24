// Looks every active ingredient in products.json up in the FDA/NCATS Global
// Substance Registration System (gsrs.ncats.nih.gov; public domain, no
// robots.txt) and caches, per ingredient: the registry name, SMILES (for the
// structure tile), formula, CAS, and the WHO ATC codes with their class names
// (for the therapy area). One request at a time, a second apart; anything
// already in gsrs.json is not fetched again. Ingredients the registry does not
// know (enzyme blends, botanicals, "multivitamin") are recorded as misses and
// the tile falls back to the dosage form.
//
// Run from the Website folder:  node tools/ff-art/fetch.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DIR = 'tools/ff-art';
const { items } = JSON.parse(readFileSync(`${DIR}/products.json`, 'utf8'));
const CACHE = `${DIR}/gsrs.json`;
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
const API = 'https://gsrs.ncats.nih.gov/api/v1';
const HEADERS = { 'User-Agent': 'MH PharmaPack catalogue build (sales@mhpharmapack.com)', Accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const save = () => writeFileSync(CACHE, JSON.stringify(cache, null, 1) + '\n');

async function get(url) {
  await sleep(1000);
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

// One name can match several records. The chemical one is preferred: the
// first pass took the first hit and got a "concept" record for azithromycin
// (no structure, no codes). A mixture (gentamicin, the two isomers of
// phytonadione) keeps its own ATC codes and is drawn as its first required
// component; the drawn record's name is kept as `drawnAs`.
const CLASS_RANK = { chemical: 0, mixture: 1, structurallyDiverse: 2, protein: 2, polymer: 2, nucleicAcid: 2, concept: 3 };

// Where the rules above draw the wrong thing, the record to draw instead:
// azithromycin's own record is only an umbrella ("concept") over its forms,
// and neomycin's first listed component is neamine, a fragment, not the drug.
const DRAW_AS = { azithromycin: 'AZITHROMYCIN ANHYDROUS', neomycin: 'NEOMYCIN B' };

async function best(name) {
  const q = encodeURIComponent(`root_names_name:"^${name.toUpperCase()}$"`);
  const found = await get(`${API}/substances/search?q=${q}&top=10`);
  const hits = [...(found.content ?? [])].sort(
    (a, b) => (CLASS_RANK[a.substanceClass] ?? 2) - (CLASS_RANK[b.substanceClass] ?? 2),
  );
  return hits.length ? get(`${API}/substances(${hits[0].uuid})?view=full`) : null;
}

async function lookup(name) {
  const full = await best(name);
  if (!full) return { miss: true };
  const codes = full.codes ?? [];
  const atc = codes
    .filter((c) => c.codeSystem === 'WHO-ATC')
    .map((c) => ({ code: c.code, path: (c.comments ?? '').split('|').slice(1) }));
  let s = full.structure ?? null;
  let drawnAs = null;
  const parts = full.mixture?.components ?? [];
  if (DRAW_AS[name]) {
    const sub = await best(DRAW_AS[name]);
    if (!sub?.structure?.smiles) throw new Error(`no structure for ${DRAW_AS[name]}`);
    s = sub.structure;
    drawnAs = sub._name;
  } else if (!s?.smiles && parts.length) {
    const part = parts.find((c) => c.type === 'MUST_BE_PRESENT') ?? parts[0];
    if (part.substance?.refuuid) {
      const sub = await get(`${API}/substances(${part.substance.refuuid})?view=full`);
      if (sub.structure?.smiles) {
        s = sub.structure;
        drawnAs = sub._name;
      }
    }
  }
  return {
    name: full._name,
    uuid: full.uuid,
    class: full.substanceClass,
    smiles: s?.smiles ?? null,
    formula: s?.formula ?? null,
    mw: s?.mwt ?? null,
    cas: codes.filter((c) => c.codeSystem === 'CAS' && c.type === 'PRIMARY').map((c) => c.code)[0] ?? null,
    atc,
    ...(drawnAs ? { drawnAs } : {}),
    ...(DRAW_AS[name] ? { drawAsQuery: DRAW_AS[name] } : {}),
    looked: 2,
  };
}

// Records from the first pass that came back without a structure are looked
// up again with the rules above, as is any entry whose DRAW_AS changed;
// everything else stays cached.
const stale = (name, r) => (!r.miss && !r.smiles && !r.looked) || (DRAW_AS[name] ?? null) !== (r.drawAsQuery ?? null);

const actives = [...new Set(items.flatMap((p) => p.actives))];
let n = 0;
for (const name of actives) {
  if (cache[name] && !stale(name, cache[name])) continue;
  n++;
  try {
    const rec = await lookup(name);
    cache[name] = rec;
    save();
    if (rec.miss) {
      console.log(`miss   ${name}`);
      continue;
    }
    console.log(
      `ok     ${name.padEnd(28)} -> ${rec.name} (${rec.class}) | ATC ${rec.atc.map((a) => a.code).slice(0, 3).join(',') || '-'} | ` +
        (rec.smiles ? `structure${rec.drawnAs ? ` of ${rec.drawnAs}` : ''}` : 'no structure'),
    );
  } catch (e) {
    console.log(`error  ${name}: ${e.message}`);
  }
}
console.log(`fetched ${n}; cached ${Object.keys(cache).length} of ${actives.length} ingredients`);
