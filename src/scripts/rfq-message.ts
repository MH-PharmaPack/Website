// The quote form's message: an ordered list of [key, value] pairs, written
// out as "key: value" lines (CLAUDE.md, contact wiring). The same pairs go
// to the form backend, which checks every key against its own allowlist
// (tools/rfq-backend/Code.gs) and writes the sales-desk email from them, so
// a web RFQ, an email fallback and a future phone-agent RFQ all parse the
// same way. Key names are the ones the catalogue's enquiry emails already
// use. Keep them stable: changing one breaks whatever parses them.
//
// Multi-line answers are folded: continuation lines start with two spaces,
// so a line that does not start with a space always begins a new key.

import { SALES_EMAIL } from '../config';

export type Pair = [key: string, value: string];

/** A blank line between groups; carries no data. */
export const GAP: Pair = ['', ''];

export function toText(pairs: Pair[]): string {
  return pairs
    .map(([k, v]) => {
      if (!k) return '';
      const [first, ...rest] = v.replace(/\r\n?/g, '\n').trim().split('\n');
      return [`${k}: ${first ?? ''}`, ...rest.map((l) => `  ${l}`)].join('\n');
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

// Some mail handlers truncate or refuse very long mailto: URLs. Past this
// length the item page links are dropped; names and quantities always stay.
const MAILTO_SOFT_LIMIT = 1900;

export function mailtoFor(subject: string, pairs: Pair[]): string {
  const build = (ps: Pair[]) =>
    `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(toText(ps).replace(/\n/g, '\r\n'))}`;
  const full = build(pairs);
  return full.length > MAILTO_SOFT_LIMIT ? build(pairs.filter(([k]) => !/^Item \d+ page$/.test(k))) : full;
}
