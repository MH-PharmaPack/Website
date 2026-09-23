// The three sourcing lines, in one place (client decision 2026-09-23: five
// lines became three. Formulation and Finished Goods merged into Finished
// Formulations, and end-to-end Sourcing stopped being a line of its own and
// became the service that runs through every order; it lives on What We Do).
//
// Every page that lists the lines reads them from here: the home page's row,
// What We Source's tiles, What We Do's cards, the catalogue's line names and
// the structured data. Change a word here and it changes everywhere.
//
// Copy rules (CONTENT-SPEC section 1): these are lines MH SOURCES through
// approved partner plants, never lines it makes. Every category below is
// either from CONTENT-SPEC 5.2 or a packaging group listed in the catalogue.
// The merged Finished Formulations wording is new. [NEEDS: confirm copy]

export interface SourcingLine {
  /** Matches the catalogue TAXONOMY line id */
  id: 'api' | 'finished' | 'packaging';
  name: string;
  /** One line under the name */
  summary: string;
  /** The home page's single sentence for the line */
  blurb: string;
  /** Categories, as printed on What We Source and What We Do */
  categories: string[];
  /** Closing note after the categories, if any */
  note?: string;
  /** Inner markup of a 24x24 stroke icon */
  icon: string;
}

export const SOURCING_LINES: SourcingLine[] = [
  {
    id: 'api',
    name: 'API',
    summary: 'Active pharmaceutical ingredients across therapeutic categories.',
    blurb:
      'Active pharmaceutical ingredients across corticosteroid, anticancer, antidepressant, and most major therapeutic categories.',
    categories: ['Corticosteroids', 'Anticancer', 'Antidepressants'],
    note: 'And most major API categories.',
    icon: '<path d="M12 4 19 8v8l-7 4-7-4V8l7-4Z" stroke-linejoin="round"/><circle cx="12" cy="12" r="1.6"/>',
  },
  {
    id: 'finished',
    name: 'Finished Formulations',
    summary: 'Finished dosage forms, from formulation development to supply.',
    blurb:
      'Finished dosage forms, from formulation development to supply: injectables, tablets, capsules, liquids, and dry powders, across OSD, general, cephalosporin, and beta-lactam lines.',
    categories: [
      'Injectables',
      'Tablets and capsules (OSD)',
      'Liquids',
      'Dry powders',
      'Cephalosporins',
      'Beta-lactams',
      'General formulations',
    ],
    note: 'Across all major formulation types.',
    icon: '<path d="M7.3 7.3a3.9 3.9 0 0 1 5.5 0l3.9 3.9a3.9 3.9 0 1 1-5.5 5.5l-3.9-3.9a3.9 3.9 0 0 1 0-5.5Z" stroke-linejoin="round"/><path d="m10.05 10.05 3.9 3.9" stroke-linecap="round"/>',
  },
  {
    id: 'packaging',
    name: 'Packaging',
    summary: 'Primary and secondary pharmaceutical packaging, sourced to specification.',
    blurb:
      'Primary and secondary packaging sourced to your spec: bottles, caps and closures, vial seals, vials, ampoules, cartons, foils, labels, flexible packaging, and pallets.',
    categories: [
      'Bottles and droppers',
      'Caps and closures',
      'Vial seals',
      'Vials and ampoules',
      'Rubber stoppers',
      'Cartons and mono cartons',
      'Blister and alu-alu foils',
      'Labels and shrink sleeves',
      'Flexible pouches and laminates',
      'Pallets',
    ],
    icon: '<path d="M4.5 8 12 4.25 19.5 8v8L12 19.75 4.5 16V8Z" stroke-linejoin="round"/><path d="M4.5 8 12 11.75 19.5 8" stroke-linejoin="round"/><path d="M12 11.75v8" stroke-linecap="round"/>',
  },
];

export const lineById = (id: SourcingLine['id']) => SOURCING_LINES.find((l) => l.id === id)!;

/** "API, finished formulations and packaging", for running copy. */
export const LINES_IN_PROSE = 'API, finished formulations, and pharmaceutical packaging';
