// The enquiry list: items a buyer shortlists while browsing, sent to the
// sales desk as one message. There is no backend, so the list lives in the
// visitor's own browser (localStorage) and leaves it only when they press
// Email, WhatsApp or the quote form themselves.
//
// Storage is a convenience, not a dependency: private modes and blocked
// storage throw, and then the list still works for the current page from
// memory, it just does not survive a reload.

import { SALES_EMAIL, WHATSAPP, withBase } from '../config';

export interface EnquiryItem {
  slug: string;
  name: string;
  /** "Bottles / Dry Syrup Bottles" */
  category: string;
  /** "Packaging" */
  line: string;
  /** "HDPE, 15.50 gm", or empty */
  detail: string;
  /** Absolute URL of the item page */
  url: string;
  /** Small image for the list, or empty */
  thumb: string;
  /** Free text the buyer types, e.g. "50,000 pcs" */
  qty: string;
}

export interface EnquiryState {
  items: EnquiryItem[];
  market: string;
  timeline: string;
}

const KEY = 'mh-enquiry-list';
const EVENT = 'mh-enquiry-change';
const blank = (): EnquiryState => ({ items: [], market: '', timeline: '' });
let memory: EnquiryState = blank();

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function load(): EnquiryState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const s = JSON.parse(raw);
    const items = Array.isArray(s?.items) ? s.items : [];
    return {
      items: items
        .filter((i: unknown) => typeof (i as EnquiryItem)?.slug === 'string' && typeof (i as EnquiryItem)?.name === 'string')
        .map((i: EnquiryItem) => ({
          slug: i.slug,
          name: i.name,
          category: str(i.category),
          line: str(i.line),
          detail: str(i.detail),
          url: str(i.url),
          thumb: str(i.thumb),
          qty: str(i.qty),
        })),
      market: str(s?.market),
      timeline: str(s?.timeline),
    };
  } catch {
    return memory;
  }
}

export function save(state: EnquiryState): void {
  memory = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* memory copy above still serves this page */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Runs `fn` whenever the list changes: here, in another tab, or when a page
 *  comes back from the back-forward cache holding a stale copy. */
export function onChange(fn: () => void): void {
  window.addEventListener(EVENT, fn);
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) fn();
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) fn();
  });
}

export const has = (state: EnquiryState, slug: string) => state.items.some((i) => i.slug === slug);

export function toggle(item: Omit<EnquiryItem, 'qty'>): boolean {
  const s = load();
  const added = !has(s, item.slug);
  s.items = added ? [...s.items, { ...item, qty: '' }] : s.items.filter((i) => i.slug !== item.slug);
  save(s);
  return added;
}

export function remove(slug: string): void {
  const s = load();
  s.items = s.items.filter((i) => i.slug !== slug);
  save(s);
}

export function setQty(slug: string, qty: string): void {
  const s = load();
  const it = s.items.find((i) => i.slug === slug);
  if (it) it.qty = qty;
  save(s);
}

export function setField(field: 'market' | 'timeline', value: string): void {
  const s = load();
  s[field] = value;
  save(s);
}

export function clear(): void {
  save(blank());
}

// ---- The message ---------------------------------------------------------
//
// Key: value lines, one fact per line, with numbered item keys ("Item 2
// quantity"), so a list enquiry parses the same way as the RFQ form and the
// single-item enquiries (CONTENT-SPEC 7.3, CLAUDE.md contact wiring).

function lines(s: EnquiryState, withUrls: boolean): string[] {
  const linesOfInterest = [...new Set(s.items.map((i) => i.line).filter(Boolean))];
  return [
    `Line of interest: ${linesOfInterest.join(', ')}`,
    `Items requested: ${s.items.length}`,
    '',
    ...s.items.flatMap((it, n) => {
      const k = `Item ${n + 1}`;
      return [
        `${k}: ${it.name}`,
        `${k} category: ${it.category}`,
        ...(it.detail ? [`${k} detail: ${it.detail}`] : []),
        `${k} quantity: ${it.qty}`,
        ...(withUrls && it.url ? [`${k} page: ${it.url}`] : []),
        '',
      ];
    }),
    `Destination market / country: ${s.market}`,
    `Required timeline: ${s.timeline}`,
    'Specification details: ',
    '',
    'Name: ',
    'Company: ',
    'Phone / WhatsApp: ',
  ];
}

/** Plain text of the whole enquiry, for the Copy button. */
export const plainText = (s: EnquiryState) => lines(s, true).join('\n');

// Some mail handlers truncate or refuse very long mailto: URLs. Past this
// length the item page links are dropped; the names and quantities, which
// are what the desk needs, always stay.
const MAILTO_SOFT_LIMIT = 1900;

export function mailtoHref(s: EnquiryState): string {
  const subject =
    s.items.length === 1 ? `Enquiry: ${s.items[0].name}` : `Enquiry: ${s.items.length} items`;
  const build = (withUrls: boolean) =>
    `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines(s, withUrls).join('\r\n'))}`;
  const full = build(true);
  return full.length > MAILTO_SOFT_LIMIT ? build(false) : full;
}

export function whatsappHref(s: EnquiryState): string {
  if (!WHATSAPP) return '#';
  const list = s.items.map((it, n) => `${n + 1}. ${it.name}${it.qty ? ` (quantity: ${it.qty})` : ''}`).join('\n');
  const text =
    `Hello MH PharmaPack, I would like a quote for these items:\n\n${list}\n\n` +
    `Destination market: ${s.market}\nRequired timeline: ${s.timeline}`;
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
}

/** The RFQ form, with the items named in the query so it can prefill them. */
export function rfqHref(s: EnquiryState): string {
  return `${withBase('/contact')}?items=${encodeURIComponent(s.items.map((i) => i.slug).join(','))}`;
}
