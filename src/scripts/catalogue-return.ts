// Remembering where the reader was in the catalogue, so "Back to the
// catalogue" on an item page returns to the exact view they left: the same
// line, group, type, search and materials (all carried in the catalogue's
// URL), whether "Show all" was pressed, and the card they opened.
//
// One record per tab, in sessionStorage. Every access is guarded: private
// modes and blocked storage throw, and then the back link simply keeps its
// plain fallback href.

const KEY = 'mh-catalogue-return';

export interface CatalogueReturn {
  /** Catalogue path plus query, exactly as it stood when a card was opened */
  url: string;
  /** Whether "Show all" had been pressed */
  expanded: boolean;
  /** The card that was opened, to scroll back to */
  slug: string;
  /** Page scroll at the time, used if the card is no longer in view */
  y: number;
  /** Set by the back link, consumed by the catalogue on arrival */
  returning: boolean;
}

export function readReturn(): CatalogueReturn | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CatalogueReturn) : null;
  } catch {
    return null;
  }
}

export function writeReturn(state: CatalogueReturn): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: the back link falls back to its plain href */
  }
}
