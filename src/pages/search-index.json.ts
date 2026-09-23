// The search suggestions' data, built once per deploy as a static file
// (/search-index.json) and fetched only when a visitor reaches for the
// search, so pages that never search pay nothing for it.
//
//   cats:  every group and type that holds items, with its count and the
//          catalogue link that opens it
//   items: every item, with its page, a short category line, a detail line,
//          a 96px thumbnail, and the same normalised search text the
//          catalogue filters on (so counts agree)
//
// Only words already printed on the site go in here.

import type { APIRoute } from 'astro';
import { TAXONOMY } from '../data/catalogue';
import { ITEMS, placeOf, itemPath, searchText, scopeHref, enquiryAttrs } from '../lib/catalogue';
import { normalizeSearch } from '../scripts/search-normalize';

export const GET: APIRoute = async ({ site }) => {
  const items = await Promise.all(
    ITEMS.map(async (item) => {
      const p = placeOf(item);
      const enq = await enquiryAttrs(item, site);
      return {
        n: item.name,
        h: itemPath(item),
        c: [p.group.name, p.type?.short].filter(Boolean).join(' · '),
        d: [item.material, item.weight].filter(Boolean).join(' · '),
        t: enq['data-enq-thumb'],
        s: searchText(item),
      };
    }),
  );

  const cats: { l: string; u: string; h: string; n: number; s: string; top: boolean }[] = [];
  for (const line of TAXONOMY) {
    for (const g of line.groups) {
      const n = ITEMS.filter((i) => placeOf(i).group.id === g.id).length;
      if (!n) continue;
      cats.push({
        l: g.name,
        u: line.name,
        h: scopeHref({ line: line.id, group: g.id }),
        n,
        s: normalizeSearch(`${g.name} ${line.name}`),
        top: true,
      });
      for (const t of g.types ?? []) {
        const tn = ITEMS.filter((i) => placeOf(i).type?.id === t.id).length;
        if (!tn) continue;
        cats.push({
          l: t.name,
          u: g.name,
          h: scopeHref({ line: line.id, group: g.id, type: t.id }),
          n: tn,
          s: normalizeSearch(`${t.name} ${g.name}`),
          top: false,
        });
      }
    }
  }

  return new Response(JSON.stringify({ cats, items }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
