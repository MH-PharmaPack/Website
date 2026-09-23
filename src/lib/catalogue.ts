// Everything the catalogue pages share: image lookup, item URLs, the facts an
// item's detail view lists, and the prefilled enquiry links.
//
// The facts are deliberately derived, not authored. Beyond material and unit
// weight (the partner's own figures) and any `specs` carried in the data file,
// every line here is read out of the item's name: a "30 ml DSB Round Bottle -
// 28 mm Neck (Half Mark)" states its capacity, its neck size, its type and its
// graduation in that string, and the detail view just lays those out. Nothing
// is inferred that the partner did not write down.

import type { ImageMetadata } from 'astro';
import { CATALOGUE, type CatalogueItem } from '../data/catalogue';
import { SALES_EMAIL, WHATSAPP, withBase } from '../config';

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

export interface Fact {
  label: string;
  value: string;
}

/** The facet chips offered for material. Matching is substring on purpose:
 *  an "LDPE + HDPE" item belongs under both. */
export const MATERIAL_FACETS = ['PP', 'HDPE', 'LDPE', 'PET'] as const;

const CLOSURE_WORDS = /\b(cap|plug|stopper|ring|cup|closure)\b/i;

export function itemFacts(item: CatalogueItem): Fact[] {
  const facts: Fact[] = [];
  const name = item.name;
  const isClosure = item.category === 'Caps & Closures' || CLOSURE_WORDS.test(name);
  const specLabels = new Set((item.specs ?? []).map((s) => s.label.toLowerCase()));

  // "Cap for 30 gm Dusting Container", "Flip Top Cap (Lens Cleaner Bottle)":
  // the size in the name belongs to the container the closure fits, so it is
  // reported as that rather than as the closure's own capacity.
  const fitsFor = name.match(/\bfor\s+([^()]+?)\s*(?:\(|$)/i);
  const fitsParen = name.match(/\(([^)]*\b(?:bottle|container|cap)\b[^)]*)\)/i);
  const fits = fitsFor?.[1] ?? fitsParen?.[1];
  if (fits) {
    facts.push({ label: 'Fits', value: fits.trim().replace(/\s+-\s+/g, ', ') });
  } else {
    const cap = name.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
    if (cap) facts.push({ label: isClosure ? 'Size' : 'Capacity', value: `${cap[1]} ml` });
  }

  // A closure sized in the name ("25 mm Screw Cap") fits that neck finish; a
  // bottle's "- 28 mm Neck" says the same thing from the other side. When the
  // Fits line already carries the size, it is not repeated here.
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

  if (item.material) facts.push({ label: 'Material', value: item.material });
  if (item.weight) facts.push({ label: 'Unit weight', value: item.weight });
  facts.push(...(item.specs ?? []));
  return facts;
}

/** Small print under the facts, when there is any. */
export function itemNote(item: CatalogueItem): string | undefined {
  return item.illustrative
    ? 'The drawing is representative of the item type; a photograph of the partner plant’s piece is available on request.'
    : undefined;
}

/** Everything the client-side search matches against, precomputed per card. */
export function searchText(item: CatalogueItem): string {
  return [
    item.name,
    item.category,
    item.material,
    item.weight,
    item.keywords,
    ...itemFacts(item).map((f) => f.value),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

// Enquiry links. All three land on the same sales desk; the email body uses
// the same key: value lines as the RFQ form (CONTENT-SPEC 7.3) so a product
// enquiry from this page parses like every other enquiry.

const crlf = (lines: (string | null)[]) => lines.filter((l): l is string => l !== null).join('\r\n');

export function enquiryMailto(item: CatalogueItem, itemUrl?: string): string {
  const subject = `Enquiry: ${item.name}`;
  const body = crlf([
    'Line of interest: Packaging',
    `Product / molecule / item: ${item.name}`,
    `Category: ${item.category}`,
    item.material ? `Material: ${item.material}` : null,
    item.weight ? `Unit weight: ${item.weight}` : null,
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
  const detail = [item.material, item.weight].filter(Boolean).join(', ');
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
