// Looks every API in apis.json up in the FDA/NCATS Global Substance
// Registration System (gsrs.ncats.nih.gov) and caches what the catalogue
// needs in gsrs.json: the registry's own name and UNII, the structure
// (SMILES), formula, molecular weight, and the PRIMARY CAS code. US
// government data, public domain; the site has no robots.txt (checked
// 2026-09-24), and requests go out one at a time, a second apart.
//
// Only names missing from gsrs.json are fetched, so a rebuild never
// re-queries the registry. Delete an entry to refresh it.
//
// Run from the Website folder:  node tools/api-art/fetch.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DIR = 'tools/api-art';
const { items } = JSON.parse(readFileSync(`${DIR}/apis.json`, 'utf8'));
const CACHE = `${DIR}/gsrs.json`;
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
const API = 'https://gsrs.ncats.nih.gov/api/v1';
const HEADERS = { 'User-Agent': 'MH PharmaPack catalogue build (sales@mhpharmapack.com)', Accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  await sleep(1000);
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

// A mixture (polymyxin B sulphate) has no single structure; its entry in
// apis.json names the main component to draw instead (`drawAs`), which is
// looked up the same way and cached under its own name.
const names = [...new Set(items.flatMap((it) => [it.gsrs, it.drawAs].filter(Boolean)))];

for (const name of names) {
  if (cache[name]) continue;
  // "^...$" anchors the name: a plain query for TESTOSTERONE returns its
  // dozens of esters first and the parent can fall outside the page.
  let hit;
  for (const q of [`root_names_name:"^${name}$"`, `root_names_name:"${name}"`]) {
    const found = await get(`${API}/substances/search?q=${encodeURIComponent(q)}&top=25`);
    hit = (found.content ?? []).find((s) => (s._name ?? '').toUpperCase() === name);
    if (hit) break;
  }
  if (!hit) {
    console.log(`NO EXACT MATCH  ${name}`);
    continue;
  }
  const it = { gsrs: name };
  const full = await get(`${API}/substances(${hit.uuid})?view=full`);
  const cas = (full.codes ?? []).filter((c) => c.codeSystem === 'CAS');
  const primary = cas.filter((c) => c.type === 'PRIMARY').map((c) => c.code);
  const s = full.structure ?? null;
  cache[it.gsrs] = {
    name: full._name,
    uuid: full.uuid,
    unii: full.approvalID ?? null,
    class: full.substanceClass,
    smiles: s?.smiles ?? null,
    formula: s?.formula ?? null,
    mw: s?.mwt ?? null,
    casPrimary: primary,
    casOther: cas.filter((c) => c.type !== 'PRIMARY').map((c) => `${c.code} (${c.type})`),
    mixture: full.mixture?.components?.map((c) => c.substance?.refPname ?? c.substance?.name) ?? null,
  };
  writeFileSync(CACHE, JSON.stringify(cache, null, 2) + '\n');
  console.log(`${it.gsrs.padEnd(34)} ${full.substanceClass.padEnd(9)} ${String(s?.formula ?? '-').padEnd(26)} CAS ${primary.join(', ') || '-'}`);
}
console.log(`cached: ${Object.keys(cache).length} of ${items.length}`);
