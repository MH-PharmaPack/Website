// Generates src/data/countries.ts from countries-list@3.4.1 (MIT,
// github.com/annexare/Countries).
//
// Usage, from the Website folder:
//   download https://cdn.jsdelivr.net/npm/countries-list@3.4.1/countries.min.json
//   node tools/countries/gen-countries.cjs <path to countries.min.json> src/data/countries.ts
const fs = require('fs');
const [, , countriesPath, outPath] = process.argv;
const all = require(countriesPath);

const CONTINENT_ORDER = [
  ['AF', 'Africa'],
  ['AS', 'Asia and the Middle East'],
  ['EU', 'Europe'],
  ['NA', 'North and Central America, Caribbean'],
  ['SA', 'South America'],
  ['OC', 'Oceania'],
];

// Other names buyers commonly type, beyond the dataset's own aliases.
const EXTRA = {
  GB: ['UK', 'Britain', 'Great Britain', 'England', 'Scotland', 'Wales'],
  US: ['USA', 'US', 'America'],
  AE: ['UAE', 'Emirates', 'Dubai', 'Abu Dhabi'],
  SA: ['KSA', 'Saudi'],
  CI: ["Cote d'Ivoire", 'Ivory Coast'],
  CZ: ['Czechia', 'Czech'],
  TR: ['Turkiye', 'Türkiye'],
  CD: ['DRC', 'DR Congo', 'Congo Kinshasa', 'Democratic Republic of the Congo'],
  CG: ['Congo Brazzaville', 'Republic of the Congo'],
  KR: ['Korea', 'South Korea'],
  KP: ['North Korea'],
  MM: ['Burma'],
  SZ: ['Swaziland', 'Eswatini'],
  MK: ['North Macedonia', 'Macedonia'],
  NL: ['Holland'],
  RU: ['Russia'],
  VN: ['Viet Nam'],
  LA: ['Laos'],
  IR: ['Iran'],
  SY: ['Syria'],
  BO: ['Bolivia'],
  VE: ['Venezuela'],
  TZ: ['Tanzania'],
  MD: ['Moldova'],
  PS: ['Palestine'],
  CV: ['Cape Verde', 'Cabo Verde'],
  TL: ['East Timor', 'Timor-Leste'],
};

const latin = (s) => /^[\p{Script=Latin}\s'’\-.,()]+$/u.test(s);
const out = {};
for (const [code, c] of Object.entries(all)) {
  if (c.continent === 'AN') continue; // Antarctic territories: not a market
  const also = new Set([...(c.alias ?? []), ...(EXTRA[code] ?? [])]);
  if (c.native && c.native !== c.name && latin(c.native)) also.add(c.native);
  also.delete(c.name);
  (out[c.continent] ??= []).push({ code, name: c.name, also: [...also] });
}
for (const list of Object.values(out)) list.sort((a, b) => a.name.localeCompare(b.name, 'en'));
out.EU.unshift({ code: 'EU', name: 'European Union', also: ['EU', 'Europe'] });

const q = (s) => JSON.stringify(s);
let ts = `// Destination markets for the quote form and the enquiry list: countries
// and territories grouped by region, plus the European Union as one market.
// Buyers must pick from this list (client, 2026-09-23), so every enquiry
// names its market the same way.
//
// GENERATED from countries-list@3.4.1 (MIT, github.com/annexare/Countries),
// with Antarctic territories left out and common alternative names added.
// Regenerate with tools/countries/gen-countries.cjs rather than hand-editing.

import type { RegGroup } from './regulatory';

export const COUNTRY_GROUPS: RegGroup[] = [\n`;
let n = 0;
for (const [cont, label] of CONTINENT_ORDER) {
  ts += `  {\n    name: ${q(label)},\n    icon: '',\n    options: [\n`;
  for (const c of out[cont]) {
    n++;
    ts += `      { label: ${q(c.name)}, code: ${q(c.code)}${c.also.length ? `, also: ${q(c.also)}` : ''} },\n`;
  }
  ts += `    ],\n  },\n`;
}
ts += `];\n`;
fs.writeFileSync(outPath, ts);
console.log('written', n, 'entries');
