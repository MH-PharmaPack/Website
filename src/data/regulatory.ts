// Regulatory requirements a buyer can name on the quote form (CONTENT-SPEC
// 7.3, "Regulatory requirement"). The field suggests from this list as the
// buyer types, and shows the whole list, grouped, when it is empty. Anything
// not on the list can still be typed and added as free text.
//
// These describe what the BUYER needs from a plant or a product. They are not
// claims about MH or its partners (guardrail 2): nothing here is presented as
// an approval anyone holds.
//
// `also` holds other ways people write the same thing, so "usfda", "FDA" and
// "America" all find US FDA. Matching ignores case, spaces and punctuation.
//
// Each row carries a small typographic tile, never an official logo (client
// asked for logos, 2026-09-23). The marks are off limits: the FDA logo is
// "for the official use of FDA and not for use on private sector
// materials"; the WHO emblem needs the Director-General's written
// permission; ISO lets nobody use its logo in connection with certification.
// They would also read as endorsements, which guardrail 2 forbids. So:
//   code   the jurisdiction, as a region code (US, EU, BR ...)
//   none   the group's icon (shield, document, book, box, rosette)

export interface RegOption {
  label: string;
  /** Short explanation shown under the label in the list. */
  note?: string;
  also?: string[];
  /** Jurisdiction shown in the row's tile, e.g. "US". */
  code?: string;
}

export interface RegGroup {
  name: string;
  /** SVG path data (24px grid, stroked) for rows without a code. */
  icon: string;
  options: RegOption[];
}

const ICON = {
  shield: 'M12 3 5 6v5.5c0 4.2 2.9 7.9 7 9 4.1-1.1 7-4.8 7-9V6l-7-3ZM9 12l2 2 4-4',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z',
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  book: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15ZM5 19.5A1.5 1.5 0 0 0 6.5 21H19',
  box: 'M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9ZM4 7.5l8 4.5 8-4.5M12 12v9',
  rosette: 'M12 3a6 6 0 1 1 0 12 6 6 0 0 1 0-12ZM9 14.5 8 21l4-2 4 2-1-6.5',
};

export const REGULATORY: RegGroup[] = [
  {
    name: 'GMP and quality approvals',
    icon: ICON.shield,
    options: [
      { label: 'WHO GMP', note: 'World Health Organization', also: ['who', 'good manufacturing practice'] },
      { label: 'WHO Prequalification', note: 'WHO PQ', also: ['who pq', 'prequalified', 'prequalification'] },
      { label: 'EU GMP', note: 'European Union', also: ['europe', 'ema', 'eu'], code: 'EU' },
      { label: 'US FDA cGMP', note: '21 CFR 210 and 211', also: ['usfda', 'fda', 'cgmp', 'usa', 'america'], code: 'US' },
      { label: 'UK MHRA', note: 'United Kingdom', also: ['mhra', 'uk', 'britain'], code: 'UK' },
      { label: 'PIC/S GMP', note: 'Pharmaceutical Inspection Co-operation Scheme', also: ['pics'] },
      { label: 'Schedule M', note: 'India, revised GMP', also: ['india', 'cdsco'], code: 'IN' },
      { label: 'GDP', note: 'Good Distribution Practice', also: ['good distribution practice', 'who gdp', 'eu gdp'] },
    ],
  },
  {
    name: 'Market approvals',
    icon: ICON.globe,
    options: [
      { label: 'US FDA', note: 'United States', also: ['usfda', 'fda', 'usa', 'america', 'united states'], code: 'US' },
      { label: 'EMA', note: 'European Union', also: ['eu', 'europe', 'european medicines agency'], code: 'EU' },
      { label: 'Health Canada', note: 'Canada', also: ['canada', 'hc'], code: 'CA' },
      { label: 'TGA', note: 'Australia', also: ['australia'], code: 'AU' },
      { label: 'Swissmedic', note: 'Switzerland', also: ['switzerland', 'swiss'], code: 'CH' },
      { label: 'PMDA', note: 'Japan', also: ['japan'], code: 'JP' },
      { label: 'NMPA', note: 'China', also: ['china', 'cfda'], code: 'CN' },
      { label: 'CDSCO', note: 'India', also: ['india', 'dcgi'], code: 'IN' },
      { label: 'ANVISA', note: 'Brazil', also: ['brazil', 'brasil'], code: 'BR' },
      { label: 'COFEPRIS', note: 'Mexico', also: ['mexico'], code: 'MX' },
      { label: 'INVIMA', note: 'Colombia', also: ['colombia'], code: 'CO' },
      { label: 'DIGEMID', note: 'Peru', also: ['peru'], code: 'PE' },
      { label: 'ANMAT', note: 'Argentina', also: ['argentina'], code: 'AR' },
      { label: 'ISP', note: 'Chile', also: ['chile'], code: 'CL' },
      { label: 'ARCSA', note: 'Ecuador', also: ['ecuador'], code: 'EC' },
      { label: 'SAHPRA', note: 'South Africa', also: ['south africa', 'mcc'], code: 'ZA' },
      { label: 'NAFDAC', note: 'Nigeria', also: ['nigeria'], code: 'NG' },
      { label: 'PPB', note: 'Kenya', also: ['kenya', 'pharmacy and poisons board'], code: 'KE' },
      { label: 'TMDA', note: 'Tanzania', also: ['tanzania', 'tfda'], code: 'TZ' },
      { label: 'NDA', note: 'Uganda', also: ['uganda'], code: 'UG' },
      { label: 'FDA Ghana', note: 'Ghana', also: ['ghana'], code: 'GH' },
      { label: 'ZAMRA', note: 'Zambia', also: ['zambia'], code: 'ZM' },
      { label: 'MCAZ', note: 'Zimbabwe', also: ['zimbabwe'], code: 'ZW' },
      { label: 'EDA', note: 'Egypt', also: ['egypt'], code: 'EG' },
      { label: 'SFDA', note: 'Saudi Arabia', also: ['saudi', 'ksa'], code: 'SA' },
      { label: 'UAE approval', note: 'United Arab Emirates', also: ['uae', 'emirates', 'mohap', 'dubai'], code: 'AE' },
      { label: 'DRAP', note: 'Pakistan', also: ['pakistan'], code: 'PK' },
      { label: 'DGDA', note: 'Bangladesh', also: ['bangladesh'], code: 'BD' },
      { label: 'NMRA', note: 'Sri Lanka', also: ['sri lanka'], code: 'LK' },
      { label: 'BPOM', note: 'Indonesia', also: ['indonesia'], code: 'ID' },
      { label: 'NPRA', note: 'Malaysia', also: ['malaysia'], code: 'MY' },
      { label: 'Thai FDA', note: 'Thailand', also: ['thailand'], code: 'TH' },
      { label: 'Philippines FDA', note: 'Philippines', also: ['philippines'], code: 'PH' },
      { label: 'DAV', note: 'Vietnam', also: ['vietnam', 'viet nam'], code: 'VN' },
      { label: 'HSA', note: 'Singapore', also: ['singapore'], code: 'SG' },
    ],
  },
  {
    name: 'Dossiers and filings',
    icon: ICON.doc,
    options: [
      { label: 'CEP', note: 'EDQM Certificate of Suitability', also: ['cos', 'edqm', 'certificate of suitability'], code: 'EU' },
      { label: 'US DMF Type II', note: 'Drug substance (API)', also: ['dmf', 'drug master file', 'usdmf'], code: 'US' },
      { label: 'US DMF Type III', note: 'Packaging material', also: ['dmf', 'drug master file', 'packaging dmf'], code: 'US' },
      { label: 'EU ASMF', note: 'Active Substance Master File', also: ['asmf', 'edmf'], code: 'EU' },
      { label: 'EU Written Confirmation', note: 'For API imports into the EU', also: ['written confirmation', 'wc'], code: 'EU' },
      { label: 'CTD dossier', note: 'Common Technical Document', also: ['ctd', 'ectd', 'dossier'] },
      { label: 'ACTD dossier', note: 'ASEAN Common Technical Dossier', also: ['actd', 'asean'] },
      { label: 'CoPP', note: 'Certificate of Pharmaceutical Product', also: ['copp', 'certificate of pharmaceutical product'] },
      { label: 'Free Sale Certificate', also: ['fsc', 'free sale'] },
    ],
  },
  {
    name: 'Pharmacopoeia grade',
    icon: ICON.book,
    options: [
      { label: 'IP', note: 'Indian Pharmacopoeia', also: ['indian pharmacopoeia'], code: 'IN' },
      { label: 'BP', note: 'British Pharmacopoeia', also: ['british pharmacopoeia'], code: 'UK' },
      { label: 'USP', note: 'United States Pharmacopeia', also: ['usp nf', 'us pharmacopeia'], code: 'US' },
      { label: 'Ph. Eur.', note: 'European Pharmacopoeia', also: ['ep', 'eur', 'european pharmacopoeia'], code: 'EU' },
      { label: 'JP', note: 'Japanese Pharmacopoeia', also: ['japanese pharmacopoeia'], code: 'JP' },
    ],
  },
  {
    name: 'Packaging standards',
    icon: ICON.box,
    options: [
      { label: 'ISO 15378', note: 'Primary packaging materials for medicinal products', also: ['iso'] },
      { label: 'USP <661>', note: 'Plastic packaging systems and materials', also: ['661', 'usp 661'], code: 'US' },
      { label: 'USP <671>', note: 'Container performance testing', also: ['671', 'usp 671'], code: 'US' },
      { label: 'USP <660>', note: 'Glass containers', also: ['660', 'usp 660', 'glass'], code: 'US' },
      { label: 'USP <381>', note: 'Elastomeric closures', also: ['381', 'usp 381', 'rubber', 'stopper'], code: 'US' },
      { label: 'Ph. Eur. 3.1 / 3.2', note: 'Container materials and containers', also: ['ep 3.1', 'ep 3.2', 'containers'], code: 'EU' },
      { label: 'EU 10/2011', note: 'Plastics in contact with food', also: ['food contact', 'food grade'], code: 'EU' },
      { label: 'US FDA food contact', note: '21 CFR 177', also: ['food contact', 'food grade', '21 cfr'], code: 'US' },
      { label: 'Child-resistant: ISO 8317', note: 'Reclosable packages', also: ['crc', 'child resistant', '8317'] },
      { label: 'Child-resistant: 16 CFR 1700', note: 'US poison prevention packaging', also: ['crc', 'child resistant', 'pppa', '1700'], code: 'US' },
    ],
  },
  {
    name: 'Management systems and other',
    icon: ICON.rosette,
    options: [
      { label: 'ISO 9001', note: 'Quality management', also: ['iso'] },
      { label: 'ISO 13485', note: 'Medical devices', also: ['iso', 'medical device'] },
      { label: 'ISO 14001', note: 'Environmental management', also: ['iso', 'environment'] },
      { label: 'BRCGS Packaging Materials', also: ['brc', 'brcgs'] },
      { label: 'Halal', also: ['halal'] },
      { label: 'Kosher', also: ['kosher'] },
    ],
  },
];

/** The tile's icon for a free-text entry. */
export const CUSTOM_ICON = 'M12 5v14M5 12h14';

// A label is what lands in the enquiry, so one label must mean one thing.
const seen = new Set<string>();
for (const g of REGULATORY) {
  for (const o of g.options) {
    if (seen.has(o.label)) throw new Error(`regulatory.ts: "${o.label}" is listed twice`);
    seen.add(o.label);
  }
}
