// Everything the catalogue pages share: image lookup, item URLs, where each
// item sits in the line / group / type taxonomy, the facts an item's detail
// view lists, materials, and the prefilled enquiry links.
//
// The facts are deliberately derived, not authored. Beyond material and unit
// weight (the partner's own figures) and any `specs` carried in the data file,
// every line here is read out of the item's name: a "30 ml DSB Round Bottle -
// 28 mm Neck (Half Mark)" states its capacity, its neck size, its type and its
// graduation in that string, and the detail view just lays those out. Nothing
// is inferred that the partner did not write down.

import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import {
  CATALOGUE,
  TAXONOMY,
  type CatalogueItem,
  type CatalogueLine,
  type CatalogueGroup,
  type CatalogueType,
} from '../data/catalogue';
import { SALES_EMAIL, WHATSAPP, withBase } from '../config';
import { normalizeSearch } from '../scripts/search-normalize';

// Images live in src/assets/catalogue/ and are looked up by the filename each
// entry carries. A missing file fails the build here, loudly, rather than
// shipping a card with a broken image.
const catalogueImages = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/catalogue/*.{jpg,png,svg}',
  { eager: true },
);

export function imageFor(file: string): ImageMetadata {
  const mod = catalogueImages[`../assets/catalogue/${file}`];
  if (!mod) throw new Error(`catalogue image missing: ${file}`);
  return mod.default;
}

/** URL-safe form of an item name: "30 ml DSB Round Bottle - 28 mm Neck" ->
 *  "30-ml-dsb-round-bottle-28-mm-neck". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const itemSlug = (item: CatalogueItem): string => slugify(item.name);

/** Root-relative page path for an item, trailing slash included. */
export const itemPath = (item: CatalogueItem): string => withBase(`/catalogue/${itemSlug(item)}`);

// Two items whose names collapse to one slug would silently overwrite each
// other's page. Refuse to build instead.
{
  const seen = new Map<string, string>();
  for (const item of CATALOGUE) {
    const slug = itemSlug(item);
    const other = seen.get(slug);
    if (other) {
      throw new Error(`catalogue slug collision: "${other}" and "${item.name}" both map to /catalogue/${slug}/`);
    }
    seen.set(slug, item.name);
  }
}

// ---- Taxonomy ------------------------------------------------------------

export interface ItemPlace {
  line: CatalogueLine;
  group: CatalogueGroup;
  type?: CatalogueType;
  /** Position in taxonomy order, for sorting */
  rank: [number, number, number];
}

const groupIndex = new Map<string, { line: CatalogueLine; group: CatalogueGroup; li: number; gi: number }>();
TAXONOMY.forEach((line, li) =>
  line.groups.forEach((group, gi) => {
    if (groupIndex.has(group.id)) throw new Error(`taxonomy: duplicate group id "${group.id}"`);
    groupIndex.set(group.id, { line, group, li, gi });
  }),
);

const places = new Map<CatalogueItem, ItemPlace>();
for (const item of CATALOGUE) {
  const g = groupIndex.get(item.group);
  if (!g) throw new Error(`catalogue: "${item.name}" names unknown group "${item.group}"`);
  let type: CatalogueType | undefined;
  let ti = 0;
  if (g.group.types) {
    ti = g.group.types.findIndex((t) => t.id === item.type);
    if (ti < 0) {
      throw new Error(`catalogue: "${item.name}" needs a type from group "${g.group.id}" (got "${item.type}")`);
    }
    type = g.group.types[ti];
  } else if (item.type) {
    throw new Error(`catalogue: "${item.name}" has type "${item.type}" but group "${g.group.id}" has no types`);
  }
  places.set(item, { line: g.line, group: g.group, type, rank: [g.li, g.gi, ti] });
}

export const placeOf = (item: CatalogueItem): ItemPlace => places.get(item)!;

/** Most specific name for the item's place: the type's, else the group's. */
export const categoryName = (item: CatalogueItem): string => {
  const p = placeOf(item);
  return p.type?.name ?? p.group.name;
};

/** Every item in taxonomy order (line, group, type), stable within a type. */
export const ITEMS: CatalogueItem[] = CATALOGUE.map((item, i) => ({ item, i }))
  .sort((a, b) => {
    const ra = placeOf(a.item).rank;
    const rb = placeOf(b.item).rank;
    return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2] || a.i - b.i;
  })
  .map((x) => x.item);

/** Link to the catalogue opened at a line, group or type. */
export function scopeHref(scope: { line?: string; group?: string; type?: string }): string {
  const p = new URLSearchParams();
  if (scope.line) p.set('line', scope.line);
  if (scope.group) p.set('group', scope.group);
  if (scope.type) p.set('type', scope.type);
  const qs = p.toString();
  return `${withBase('/catalogue')}${qs ? `?${qs}` : ''}`;
}

// ---- Materials -----------------------------------------------------------
//
// An item's material string is split into tokens, so "LDPE + HDPE" (a
// two-part item) sits under both. Every token needs a label here; an unknown
// one fails the build rather than appearing as a stray filter option.

export const MATERIAL_LABELS: Record<string, string> = {
  pp: 'PP',
  hdpe: 'HDPE',
  ldpe: 'LDPE',
  pet: 'PET',
  aluminium: 'Aluminium',
};

export function materialTokens(item: CatalogueItem): string[] {
  if (!item.material) return [];
  const tokens = item.material
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  for (const t of tokens) {
    if (!MATERIAL_LABELS[t]) {
      throw new Error(`catalogue: "${item.name}" has material "${item.material}"; add a label for "${t}" to MATERIAL_LABELS`);
    }
  }
  return tokens;
}

/** The materials that actually occur, in MATERIAL_LABELS order. */
export const MATERIALS: string[] = Object.keys(MATERIAL_LABELS).filter((m) =>
  CATALOGUE.some((item) => materialTokens(item).includes(m)),
);

// ---- Facts ---------------------------------------------------------------

export interface Fact {
  label: string;
  value: string;
}

const CLOSURE_WORDS = /\b(cap|plug|stopper|ring|cup|closure)\b/i;

// Groups whose item names encode capacity, neck size and type in the bottle
// and closure idiom ("30 ml DSB Round Bottle - 28 mm Neck"). Elsewhere a
// number in the name means something else (a pallet's "150 mm" is its
// height), so those groups rely on their `specs` alone.
const NAME_PARSED = new Set<string>(['bottles', 'closures', 'vial-seals']);

export function itemFacts(item: CatalogueItem): Fact[] {
  const facts: Fact[] = [];
  const name = item.name;
  const isClosure = item.group === 'closures' || CLOSURE_WORDS.test(name);
  const specLabels = new Set((item.specs ?? []).map((s) => s.label.toLowerCase()));

  if (NAME_PARSED.has(item.group)) {
    // "Cap for 30 gm Dusting Container", "Flip Top Cap (Lens Cleaner Bottle)":
    // the size in the name belongs to the container the closure fits, so it
    // is reported as that rather than as the closure's own capacity.
    const fitsFor = name.match(/\bfor\s+([^()]+?)\s*(?:\(|$)/i);
    const fitsParen = name.match(/\(([^)]*\b(?:bottle|container|cap)\b[^)]*)\)/i);
    const fits = fitsFor?.[1] ?? fitsParen?.[1];
    if (fits) {
      facts.push({ label: 'Fits', value: fits.trim().replace(/\s+-\s+/g, ', ') });
    } else {
      const cap = name.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
      if (cap) facts.push({ label: isClosure ? 'Size' : 'Capacity', value: `${cap[1]} ml` });
    }

    // A closure sized in the name ("25 mm Screw Cap") fits that neck finish;
    // a bottle's "- 28 mm Neck" says the same thing from the other side.
    // When the Fits line already carries the size, it is not repeated here.
    const neck = name.match(/(\d+(?:\.\d+)?)\s*mm\b/i);
    if (neck && !specLabels.has('neck size') && !(fits && /\bmm\b/i.test(fits))) {
      facts.push({ label: 'Neck size', value: `${neck[1]} mm` });
    }

    if (/\bDSB\b/.test(name)) facts.push({ label: 'Type', value: 'Dry syrup bottle' });
    if (/\bCRC neck\b/i.test(name)) facts.push({ label: 'Neck', value: 'Child-resistant closure (CRC) finish' });
    else if (/\bCRC\b/.test(name)) facts.push({ label: 'Type', value: 'Child-resistant closure' });
    else if (/pilfer proof/i.test(name)) facts.push({ label: 'Type', value: 'Pilfer-proof (tamper-evident) cap' });

    const mark = name.match(/\(([^)]*\bmark(?:s|ed|ing)?\b[^)]*)\)/i);
    if (mark) facts.push({ label: 'Graduation', value: mark[1].trim() });
  }

  if (item.material) facts.push({ label: 'Material', value: item.material });
  if (item.weight) facts.push({ label: 'Unit weight', value: item.weight });
  facts.push(...(item.specs ?? []));
  return facts;
}

/** Capacity in ml, for the catalogue's size sort, read from the item's own
 *  facts (a closure's "Size" counts). Undefined when the item states none;
 *  those sort after everything that does. */
export function sortCapacity(item: CatalogueItem): number | undefined {
  const f = itemFacts(item).find((x) => x.label === 'Capacity' || x.label === 'Size');
  const m = f?.value.match(/(\d+(?:\.\d+)?)\s*ml/i);
  return m ? parseFloat(m[1]) : undefined;
}

/** Small print under the facts, when there is any. */
export function itemNote(item: CatalogueItem): string | undefined {
  if (item.structure) {
    const what = item.structureOf
      ? `The drawing shows ${item.structureOf}, the main component.`
      : 'The drawing is the molecule’s structural formula.';
    return `${what} The chemical data above is from the FDA’s public substance registry (UNII).`;
  }
  return item.illustrative
    ? 'The drawing is representative of the item type; a photograph of the partner plant’s piece is available on request.'
    : undefined;
}

/** One value from an item's specs, by label. */
export const specValue = (item: CatalogueItem, label: string): string | undefined =>
  item.specs?.find((s) => s.label === label)?.value;

/** The short detail line under a name on cards, in the search suggestions
 *  and the enquiry list: material and unit weight for packaging, the CAS
 *  number for an API. */
export function itemDetail(item: CatalogueItem, sep = ' · '): string {
  const cas = specValue(item, 'CAS number');
  if (cas) return `CAS ${cas}`;
  return [item.material, item.weight].filter(Boolean).join(sep);
}

/** Everything the client-side search matches against, precomputed per card
 *  and normalised the same way typed queries are (src/scripts/search-normalize.ts). */
export function searchText(item: CatalogueItem): string {
  const p = placeOf(item);
  return normalizeSearch(
    [
      item.name,
      p.line.name,
      p.group.name,
      p.type?.name,
      item.material,
      item.weight,
      item.keywords,
      ...itemFacts(item).map((f) => f.value),
    ]
      .filter(Boolean)
      .join(' '),
  );
}

// ---- Enquiry links -------------------------------------------------------
//
// All three land on the same sales desk; the email body uses the same
// key: value lines as the RFQ form (CONTENT-SPEC 7.3) so a product enquiry
// from this page parses like every other enquiry.

const crlf = (lines: (string | null)[]) => lines.filter((l): l is string => l !== null).join('\r\n');

export function enquiryMailto(item: CatalogueItem, itemUrl?: string): string {
  const p = placeOf(item);
  const subject = `Enquiry: ${item.name}`;
  const body = crlf([
    `Line of interest: ${p.line.name}`,
    `Product / molecule / item: ${item.name}`,
    `Category: ${[p.group.name, p.type?.name].filter(Boolean).join(' / ')}`,
    item.material ? `Material: ${item.material}` : null,
    item.weight ? `Unit weight: ${item.weight}` : null,
    specValue(item, 'CAS number') ? `CAS number: ${specValue(item, 'CAS number')}` : null,
    itemUrl ? `Item page: ${itemUrl}` : null,
    '',
    'Quantity / volume: ',
    'Destination market / country: ',
    'Required timeline: ',
    'Specification details: ',
    '',
    'Name: ',
    'Company: ',
    'Phone / WhatsApp: ',
  ]);
  return `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function enquiryWhatsApp(item: CatalogueItem): string {
  if (!WHATSAPP) return '#';
  const detail = itemDetail(item, ', ');
  const text =
    `Hello MH PharmaPack, I would like to enquire about: ${item.name}` +
    (detail ? ` (${detail})` : '') +
    '.\nQuantity / volume: \nDestination market: \nRequired timeline: ';
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
}

/** The RFQ form, with the item named in the query so the form can prefill it. */
export function enquiryRfq(item: CatalogueItem): string {
  return `${withBase('/contact')}?item=${encodeURIComponent(itemSlug(item))}`;
}

/** Everything an "Add to enquiry" button hands to the enquiry list
 *  (src/scripts/enquiry-list.ts), as data attributes. The thumbnail is a
 *  96px webp made at build time; drawings (line art, API structures) use
 *  their SVG as is. */
export async function enquiryAttrs(item: CatalogueItem, site: URL | undefined): Promise<Record<string, string>> {
  const p = placeOf(item);
  const img = imageFor(item.image);
  const thumb = item.illustrative || item.structure
    ? img.src
    : (await getImage({ src: img, width: 96, format: 'webp', quality: 70 })).src;
  return {
    'data-enq-slug': itemSlug(item),
    'data-enq-name': item.name,
    'data-enq-category': [p.group.name, p.type?.name].filter(Boolean).join(' / '),
    'data-enq-line': p.line.name,
    'data-enq-detail': itemDetail(item, ', '),
    'data-enq-url': site ? new URL(itemPath(item), site).href : itemPath(item),
    'data-enq-thumb': thumb,
  };
}
