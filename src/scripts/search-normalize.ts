// One definition of "does this item match what was typed", shared by the
// catalogue's live filter, the search suggestions and the build-time search
// text, so a suggestion count and the catalogue it opens never disagree.
//
// Typing is forgiving: case is ignored, "60ml" matches "60 ml", punctuation
// is ignored, and the words can come in any order ("pet 100" finds
// "100 ml Round PET Bottle"). Every typed word must appear somewhere in the
// item's search text.

export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/×/g, ' x ')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const searchTokens = (q: string): string[] =>
  normalizeSearch(q)
    .split(' ')
    .map((t) => t.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean);

export const matchesTokens = (haystack: string, tokens: string[]): boolean =>
  tokens.every((t) => haystack.includes(t));
