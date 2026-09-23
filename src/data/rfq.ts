// Fixed choices shared by the quote form (/contact) and the enquiry list, so
// an enquiry from either reads the same way at the sales desk and in the
// future phone-agent intake (CLAUDE.md, contact wiring).

import type { SourcingLine } from './lines';

type LineId = SourcingLine['id'];

/** Required timeline: a short fixed set, not free text, so every enquiry
 *  states it in the same words. */
export const TIMELINES = [
  'As soon as possible',
  'Within 1 month',
  '1 to 3 months',
  '3 to 6 months',
  'More than 6 months',
  'No fixed date yet',
] as const;

/** Units for a quantity. Quantities themselves are numbers only (client,
 *  2026-09-23); the unit travels beside them. */
export const UNITS = ['pieces', 'units', 'packs', 'cartons', 'rolls', 'kg', 'g', 'tonnes', 'litres', 'metres'] as const;

/** The unit a quantity starts in, by line. The buyer can change it. */
export const DEFAULT_UNIT: Record<LineId, (typeof UNITS)[number]> = {
  api: 'kg',
  finished: 'units',
  packaging: 'pieces',
};

/** Examples in the product and specification fields, by line. Placeholders
 *  only: they show the kind of detail that gets a quote, and never appear in
 *  the enquiry itself. */
export const LINE_HINTS: Record<LineId | 'none', { product: string; spec: string }> = {
  none: {
    product: 'Molecule, product or item',
    spec: 'Size, material, grade, strength, pack style, whatever applies',
  },
  api: {
    product: 'For example, betamethasone valerate',
    spec: 'Grade (IP, BP, USP, Ph. Eur.), particle size, whether a DMF or CEP is needed',
  },
  finished: {
    product: 'For example, amoxicillin 500 mg capsules',
    spec: 'Dosage form, strength, pack size and pack style',
  },
  packaging: {
    product: 'For example, 100 ml amber PET bottle with a CRC cap',
    spec: 'Size, material, neck finish, colour, printing',
  },
};
