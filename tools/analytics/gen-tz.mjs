// Builds src/data/tz-country.json: IANA time zone -> ISO country code.
//
// Why: analytics run cookieless (src/scripts/analytics.ts), and in PostHog's
// cookieless mode the IP address is stripped before GeoIP runs, so events
// carry no country. The browser's time zone ("Africa/Lagos", "America/Lima")
// is already sent with every event and names a country without identifying
// anyone; this table turns it into the market the visitor is browsing from.
//
// Source: the tz database's zone.tab (canonical zones) and backward (old
// names, which some browsers still report, e.g. "Asia/Calcutta"), from the
// database's own GitHub mirror. Public domain.
//
// Run from the Website folder:  node tools/analytics/gen-tz.mjs

import { writeFileSync } from 'node:fs';

const BASE = 'https://raw.githubusercontent.com/eggert/tz/main';
const get = async (f) => {
  const res = await fetch(`${BASE}/${f}`, { headers: { 'User-Agent': 'MH PharmaPack site build (sales@mhpharmapack.com)' } });
  if (!res.ok) throw new Error(`${res.status} for ${f}`);
  return res.text();
};

const map = {};
for (const line of (await get('zone.tab')).split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [cc, , zone] = line.split('\t');
  if (cc && zone) map[zone] = cc;
}
const canonical = Object.keys(map).length;

// "Link  TARGET  LINK-NAME": the old name resolves to its target's country.
let aliases = 0;
for (const line of (await get('backward')).split('\n')) {
  const m = line.match(/^Link\s+(\S+)\s+(\S+)/);
  if (m && map[m[1]] && !map[m[2]]) {
    map[m[2]] = map[m[1]];
    aliases++;
  }
}

const sorted = Object.fromEntries(Object.keys(map).sort().map((k) => [k, map[k]]));
writeFileSync('src/data/tz-country.json', JSON.stringify(sorted) + '\n');
const names = new Intl.DisplayNames(['en'], { type: 'region' });
console.log(`${canonical} zones + ${aliases} old names -> src/data/tz-country.json`);
for (const z of ['Asia/Kolkata', 'Asia/Calcutta', 'Africa/Lagos', 'America/Lima', 'America/Sao_Paulo', 'Africa/Johannesburg']) {
  console.log(`  ${z.padEnd(20)} ${sorted[z]} ${names.of(sorted[z])}`);
}
