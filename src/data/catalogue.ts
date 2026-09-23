// The sourcing catalogue: packaging items MH can source through partner plants.
// Data supplied by the manufacturing partners with permission; no partner is
// named anywhere on the site or in this repo, and their internal product
// codes are not carried over. The PET bottle range and its two caps come from
// a second partner's catalogue (colour to requirement, 25 mm neck unless the
// name says otherwise); the vial seals from a third (their published size
// tables); the flexible packaging from a fourth (their own product images
// and format lists); the bottles, caps, droppers and sprays from the first.
// The pallet range is the client's own list; its photographs are openly
// licensed (Wikimedia Commons, CC BY-SA 4.0) and carry a `credit`, which the
// item page prints. Entries marked `illustrative`
// have no partner photograph yet and use a line drawing (same filename stem
// convention, .svg) that is representative of the item type, not a photo.
//
// Structure: three lines (Packaging, API, Finished Formulations), each split
// into groups (Bottles, Caps & Closures, ...), and a group may be split again
// into types (Dry Syrup, PET, Ophthalmic & Dropper, ...). Every item names its
// `group`, and its `type` whenever the group has types; the line follows from
// the group. TAXONOMY below is the single source of that structure: the
// catalogue's filter rows, the item pages' breadcrumbs and the page's
// structured data all read it. src/lib/catalogue.ts refuses to build if an
// item names a group or type that is not in it.
//
// To add products later: append entries here and drop the image into
// src/assets/catalogue/ under the same filename. `keywords` are extra
// search-only terms (industry synonyms), never displayed. API and Finished
// Formulations have their groups defined and no items yet; the catalogue
// shows them as "coming soon" until the first item names one of their groups.

export interface CatalogueType {
  id: string;
  /** Full name, as used on item pages and in breadcrumbs */
  name: string;
  /** Short label for the filter chip, where the group name makes the rest obvious */
  short: string;
}

export interface CatalogueGroup {
  id: string;
  name: string;
  /** Omitted when the group is not subdivided */
  types?: CatalogueType[];
}

export interface CatalogueLine {
  id: string;
  name: string;
  /** One line under the line's name, verbatim from CONTENT-SPEC 5.2 */
  summary: string;
  groups: CatalogueGroup[];
}

export const TAXONOMY: CatalogueLine[] = [
  {
    id: 'packaging',
    name: 'Packaging',
    summary: 'Primary and secondary packaging, sourced to specification.',
    groups: [
      {
        id: 'bottles',
        name: 'Bottles',
        types: [
          { id: 'dry-syrup-bottles', name: 'Dry Syrup Bottles', short: 'Dry Syrup' },
          { id: 'pet-bottles', name: 'PET Bottles', short: 'PET' },
          { id: 'dropper-bottles', name: 'Ophthalmic & Dropper Bottles', short: 'Ophthalmic & Dropper' },
          { id: 'spray-bottles', name: 'Spray & Nasal Bottles', short: 'Spray & Nasal' },
          { id: 'liquid-bottles', name: 'Liquid & Solution Bottles', short: 'Liquid & Solution' },
          { id: 'tablet-containers', name: 'Tablet Containers', short: 'Tablet Containers' },
        ],
      },
      {
        id: 'closures',
        name: 'Caps & Closures',
        types: [
          { id: 'screw-caps', name: 'Screw & Pilfer-Proof Caps', short: 'Screw & Pilfer-Proof' },
          { id: 'crc', name: 'Child-Resistant Closures', short: 'Child-Resistant' },
          { id: 'measuring-cups', name: 'Measuring Cups', short: 'Measuring Cups' },
          { id: 'flip-top-caps', name: 'Flip-Top & Specialty Caps', short: 'Flip-Top & Specialty' },
          { id: 'dropper-plugs', name: 'Dropper Plugs & Seal Caps', short: 'Dropper Plugs' },
          { id: 'rings-stoppers', name: 'Rings & Stoppers', short: 'Rings & Stoppers' },
        ],
      },
      { id: 'vial-seals', name: 'Vial Seals' },
      {
        id: 'flexible',
        name: 'Flexible Packaging',
        types: [
          { id: 'roll-stock', name: 'Roll Stock', short: 'Roll Stock' },
          { id: 'pouches', name: 'Pouches', short: 'Pouches' },
          { id: 'sleeves', name: 'Shrink Sleeves', short: 'Shrink Sleeves' },
        ],
      },
      { id: 'pallets', name: 'Pallets' },
    ],
  },
  {
    id: 'api',
    name: 'API',
    summary: 'Active pharmaceutical ingredients across therapeutic categories.',
    // CONTENT-SPEC 5.2: corticosteroids, anticancer, antidepressants, and
    // most major API categories. More groups get added as listings arrive.
    groups: [
      { id: 'corticosteroids', name: 'Corticosteroids' },
      { id: 'anticancer', name: 'Anticancer' },
      { id: 'antidepressants', name: 'Antidepressants' },
    ],
  },
  {
    id: 'finished',
    name: 'Finished Formulations',
    summary: 'Finished dosage forms, ready for your market.',
    // CONTENT-SPEC 5.2, finished goods: injectables, tablets and capsules,
    // liquids, and dry powders.
    groups: [
      { id: 'injectables', name: 'Injectables' },
      { id: 'tablets-capsules', name: 'Tablets & Capsules' },
      { id: 'liquids', name: 'Liquids' },
      { id: 'dry-powders', name: 'Dry Powders' },
    ],
  },
];

export interface CatalogueItem {
  name: string;
  /** A group id from TAXONOMY */
  group: string;
  /** A type id within that group; required when the group has types */
  type?: string;
  /** Filename inside src/assets/catalogue/ */
  image: string;
  /** True when the image is a representative line drawing, not a photograph */
  illustrative?: boolean;
  /** Material of construction, as supplied */
  material?: string;
  /** Unit weight, as supplied */
  weight?: string;
  /** Search-only synonyms, never rendered */
  keywords?: string;
  /** Further facts from the partner's own datasheet, shown on the item's detail view */
  specs?: { label: string; value: string }[];
  /** Photo attribution, printed under the image on the item page (openly
   *  licensed photographs only; partner images carry none) */
  credit?: string;
}

// Listed in the order they were added; src/lib/catalogue.ts sorts them into
// taxonomy order for display.
export const CATALOGUE: CatalogueItem[] = [
  {
    name: '25 mm Screw Cap - Thin Knurling',
    group: 'closures',
    type: 'screw-caps',
    image: '25-mm-screw-cap-thin-knurling.jpg',
    material: 'PP',
    weight: '1.80 gm',
    keywords: 'knurled'
  },
  {
    name: '25 mm Pilfer Proof Cap - Thin Knurling (Half)',
    group: 'closures',
    type: 'screw-caps',
    image: '25-mm-pilfer-proof-cap-thin-knurling-half.jpg',
    material: 'PP',
    weight: '2.10 gm',
    keywords: 'tamper evident knurled'
  },
  {
    name: '25 mm Pilfer Proof Cap - Thin Knurling (Full)',
    group: 'closures',
    type: 'screw-caps',
    image: '25-mm-pilfer-proof-cap-thin-knurling-full.jpg',
    material: 'PP',
    weight: '2.10 gm',
    keywords: 'tamper evident knurled'
  },
  {
    name: '25 mm CRC Inner',
    group: 'closures',
    type: 'crc',
    image: 'arch-crc-inner.svg',
    illustrative: true,
    material: 'PP',
    weight: '1.50 gm',
    keywords: 'child resistant closure'
  },
  {
    name: '25 mm CRC Outer',
    group: 'closures',
    type: 'crc',
    image: '25-mm-crc-outer.jpg',
    material: 'HDPE',
    weight: '2.00 gm',
    keywords: 'child resistant closure'
  },
  {
    name: '28 mm Screw Cap - Thin Knurling',
    group: 'closures',
    type: 'screw-caps',
    image: '28-mm-screw-cap-thin-knurling.jpg',
    material: 'PP',
    weight: '2.40 gm',
    keywords: 'knurled'
  },
  {
    name: '28 mm Pilfer Proof Cap - Thick Knurling',
    group: 'closures',
    type: 'screw-caps',
    image: '28-mm-pilfer-proof-cap-thick-knurling.jpg',
    material: 'PP',
    weight: '3.00 gm',
    keywords: 'tamper evident knurled'
  },
  {
    name: '28 mm Pilfer Proof Cap - Thin Knurling',
    group: 'closures',
    type: 'screw-caps',
    image: '28-mm-pilfer-proof-cap-thin-knurling.jpg',
    material: 'PP',
    weight: '2.50 gm',
    keywords: 'tamper evident knurled'
  },
  {
    name: '25 mm Ring',
    group: 'closures',
    type: 'rings-stoppers',
    image: 'arch-ring.svg',
    illustrative: true,
    material: 'LDPE + HDPE',
    weight: '0.70 gm'
  },
  {
    name: '28 mm Ring',
    group: 'closures',
    type: 'rings-stoppers',
    image: 'arch-ring.svg',
    illustrative: true,
    material: 'LDPE + HDPE',
    weight: '0.80 gm'
  },
  {
    name: '10 ml Measuring Cup',
    group: 'closures',
    type: 'measuring-cups',
    image: 'arch-measuring-cup.svg',
    illustrative: true,
    material: 'PP',
    weight: '1.80 gm'
  },
  {
    name: 'Cap for 30 Gm Dusting Container',
    group: 'closures',
    type: 'flip-top-caps',
    image: 'cap-for-30-gm-dusting-container.jpg',
    material: 'HDPE',
    weight: '6.40 gm'
  },
  {
    name: 'Cap for 100 gm Dusting Container',
    group: 'closures',
    type: 'flip-top-caps',
    image: 'cap-for-100-gm-dusting-container.jpg',
    material: 'HDPE',
    weight: '4.70 gm'
  },
  {
    name: 'Stopper for 30 gm and 100 gm Round',
    group: 'closures',
    type: 'rings-stoppers',
    image: 'stopper-for-30-gm-and-100-gm-round.jpg',
    material: 'LDPE',
    weight: '1.80 gm'
  },
  {
    name: '15 ml Measuring Cup - CE Marking',
    group: 'closures',
    type: 'measuring-cups',
    image: '15-ml-measuring-cup-ce-marking.jpg',
    material: 'PP',
    weight: '3.00 gm'
  },
  {
    name: '20 ml Measuring Cup',
    group: 'closures',
    type: 'measuring-cups',
    image: 'arch-measuring-cup.svg',
    illustrative: true,
    material: 'PP',
    weight: '4.00 gm'
  },
  {
    name: '28 mm CRC Inner',
    group: 'closures',
    type: 'crc',
    image: 'arch-crc-inner.svg',
    illustrative: true,
    material: 'PP',
    weight: '2.50 gm',
    keywords: 'child resistant closure'
  },
  {
    name: '28 mm CRC Outer',
    group: 'closures',
    type: 'crc',
    image: '28-mm-crc-outer.jpg',
    material: 'HDPE',
    weight: '3.40 gm',
    keywords: 'child resistant closure'
  },
  {
    name: '32 mm CRC Inner',
    group: 'closures',
    type: 'crc',
    image: 'arch-crc-inner.svg',
    illustrative: true,
    material: 'PP',
    weight: '2.50 gm',
    keywords: 'child resistant closure'
  },
  {
    name: '32 mm CRC Outer',
    group: 'closures',
    type: 'crc',
    image: '32-mm-crc-outer.jpg',
    material: 'HDPE',
    weight: '3.50 gm',
    keywords: 'child resistant closure'
  },
  {
    name: '38 mm CRC Inner',
    group: 'closures',
    type: 'crc',
    image: 'arch-crc-inner.svg',
    illustrative: true,
    material: 'PP',
    weight: '2.90 gm',
    keywords: 'child resistant closure'
  },
  {
    name: '38 mm CRC Outer',
    group: 'closures',
    type: 'crc',
    image: '38-mm-crc-outer.jpg',
    material: 'HDPE',
    weight: '3.20 gm',
    keywords: 'child resistant closure'
  },
  {
    name: '75 ml Measuring Cup',
    group: 'closures',
    type: 'measuring-cups',
    image: 'arch-measuring-cup.svg',
    illustrative: true,
    material: 'PP',
    weight: '8.20 gm'
  },
  {
    name: '15 ml Measuring Cup (28 mm Thick Knurling Cap)',
    group: 'closures',
    type: 'measuring-cups',
    image: '15-ml-measuring-cup-28-mm-thick-knurling-cap.jpg',
    material: 'PP',
    weight: '2.20 gm',
    keywords: 'knurled'
  },
  {
    name: '22 mm PP Cap',
    group: 'closures',
    type: 'screw-caps',
    image: 'arch-screw-cap.svg',
    illustrative: true,
    material: 'PP',
    weight: '1.60 gm'
  },
  {
    name: '22 mm Ring',
    group: 'closures',
    type: 'rings-stoppers',
    image: 'arch-ring.svg',
    illustrative: true,
    material: 'LDPE + HDPE',
    weight: '0.45 gm'
  },
  {
    name: 'Flip Top Cap (Lens Cleaner Bottle)',
    group: 'closures',
    type: 'flip-top-caps',
    image: 'flip-top-cap-lens-cleaner-bottle.jpg',
    material: 'PP',
    weight: '2.80 gm'
  },
  {
    name: 'Flip Top Cap (550 ml Shower Gel Bottle)',
    group: 'closures',
    type: 'flip-top-caps',
    image: 'flip-top-cap-550-ml-shower-gel-bottle.jpg'
  },
  {
    name: 'Razor Cap',
    group: 'closures',
    type: 'flip-top-caps',
    image: 'arch-screw-cap.svg',
    illustrative: true,
    material: 'PP',
    weight: '8.20 gm'
  },
  {
    name: '25 mm Flip Top Cap',
    group: 'closures',
    type: 'flip-top-caps',
    image: 'arch-flip-top-cap.svg',
    illustrative: true,
    weight: '3.75 gm',
    keywords: '25 mm neck flip cap dispensing screwing mould',
    specs: [
      { label: 'Outer diameter', value: '27.40 mm' },
      { label: 'Inner diameter', value: '24.86 mm' },
      { label: 'Mould', value: 'Screwing mould' },
      { label: 'Colour', value: 'To requirement' }
    ]
  },
  {
    name: '10 ml Measuring Cup (25 mm Neck)',
    group: 'closures',
    type: 'measuring-cups',
    image: 'arch-measuring-cup.svg',
    illustrative: true,
    weight: '1.15 gm',
    keywords: '25 mm neck dosing cup hot runner mould',
    specs: [
      { label: 'Outer diameter', value: '27.75 mm' },
      { label: 'Inner diameter', value: '26.75 mm' },
      { label: 'Height', value: '20 mm' },
      { label: 'Mould', value: 'Hot runner mould' },
      { label: 'Colour', value: 'To requirement' }
    ]
  },
  {
    name: '15 ml Spray Bottle',
    group: 'bottles',
    type: 'spray-bottles',
    image: '15-ml-spray-bottle.jpg',
    material: 'LDPE + HDPE',
    weight: '6.20 gm',
    keywords: 'atomizer mist'
  },
  {
    name: '50 ml Spray Bottle',
    group: 'bottles',
    type: 'spray-bottles',
    image: '50-ml-spray-bottle.jpg',
    material: 'LDPE + HDPE',
    weight: '11.00 gm',
    keywords: 'atomizer mist'
  },
  {
    name: '25 ml Pocket Spray',
    group: 'bottles',
    type: 'spray-bottles',
    image: '25-ml-pocket-spray.jpg',
    material: 'PP',
    weight: '8.00 gm',
    keywords: 'atomizer mist'
  },
  {
    name: '15 ml Nasal Spray',
    group: 'bottles',
    type: 'spray-bottles',
    image: '15-ml-nasal-spray.jpg',
    material: 'LDPE',
    weight: '4.50 gm',
    keywords: 'atomizer mist'
  },
  {
    name: '15 ml Round Nasal Spray Bottle',
    group: 'bottles',
    type: 'spray-bottles',
    image: '15-ml-round-nasal-spray-bottle.jpg',
    material: 'HDPE',
    weight: '4.50 gm',
    keywords: 'atomizer mist'
  },
  {
    name: '30 ml Spray Bottle',
    group: 'bottles',
    type: 'spray-bottles',
    image: '30-ml-spray-bottle.png',
    material: 'HDPE',
    weight: '6.00 gm',
    keywords: 'atomizer mist'
  },
  {
    name: '60 ml Round Spray Bottle',
    group: 'bottles',
    type: 'spray-bottles',
    image: 'arch-spray-bottle.svg',
    illustrative: true,
    material: 'HDPE',
    keywords: 'atomizer mist'
  },
  {
    name: '100 ml Round Spray Bottle',
    group: 'bottles',
    type: 'spray-bottles',
    image: 'arch-spray-bottle.svg',
    illustrative: true,
    material: 'LDPE',
    keywords: 'atomizer mist'
  },
  {
    name: '200 ml Round Spray Bottle',
    group: 'bottles',
    type: 'spray-bottles',
    image: 'arch-spray-bottle.svg',
    illustrative: true,
    material: 'HDPE',
    keywords: 'atomizer mist'
  },
  {
    name: 'Seal Cap For Dropper Bottle',
    group: 'closures',
    type: 'dropper-plugs',
    image: 'seal-cap-for-dropper-bottle.jpg',
    material: 'HDPE',
    weight: '1.40 gm',
    keywords: 'eye drop'
  },
  {
    name: 'Plug For Dropper - EBM',
    group: 'closures',
    type: 'dropper-plugs',
    image: 'plug-for-dropper-ebm.jpg',
    material: 'LDPE',
    weight: '0.50 gm',
    keywords: 'eye drop'
  },
  {
    name: 'Plug For Dropper - IBM',
    group: 'closures',
    type: 'dropper-plugs',
    image: 'plug-for-dropper-ibm.jpg',
    material: 'LDPE',
    weight: '0.50 gm',
    keywords: 'eye drop'
  },
  {
    name: '2 ml Plug',
    group: 'closures',
    type: 'dropper-plugs',
    image: '2-ml-plug.jpg',
    material: 'LDPE',
    weight: '0.50 gm',
    keywords: 'eye drop'
  },
  {
    name: '2 ml Dropper Bottle',
    group: 'bottles',
    type: 'dropper-bottles',
    image: '2-ml-dropper-bottle.jpg',
    material: 'LDPE',
    weight: '1.20 gm',
    keywords: 'eye drop'
  },
  {
    name: '5 ml Dropper Bottle (Light Weight)',
    group: 'bottles',
    type: 'dropper-bottles',
    image: '5-ml-dropper-bottle-light-weight.jpg',
    material: 'LDPE',
    weight: '2.80 gm',
    keywords: 'eye drop'
  },
  {
    name: '5 ml Dropper Bottle (Heavy Weight)',
    group: 'bottles',
    type: 'dropper-bottles',
    image: 'arch-dropper-bottle.svg',
    illustrative: true,
    material: 'LDPE',
    weight: '3.00 gm',
    keywords: 'eye drop'
  },
  {
    name: '10 ml Dropper Bottle',
    group: 'bottles',
    type: 'dropper-bottles',
    image: '10-ml-dropper-bottle.jpg',
    material: 'LDPE',
    weight: '3.20 gm',
    keywords: 'eye drop'
  },
  {
    name: '10 ml Dropper Bottle (New)',
    group: 'bottles',
    type: 'dropper-bottles',
    image: '10-ml-dropper-bottle-new.jpg',
    material: 'LDPE',
    weight: '3.20 gm',
    keywords: 'eye drop'
  },
  {
    name: '30 ml Round Dropper Bottle (Round Shoulder)',
    group: 'bottles',
    type: 'dropper-bottles',
    image: '30-ml-round-dropper-bottle-round-shoulder.jpg',
    material: 'LDPE',
    weight: '6.60 gm',
    keywords: 'eye drop'
  },
  {
    name: '30 ml Round Dropper Bottle (Flat Shoulder - Exp)',
    group: 'bottles',
    type: 'dropper-bottles',
    image: '30-ml-round-dropper-bottle-flat-shoulder-exp.jpg',
    material: 'LDPE',
    weight: '6.60 gm',
    keywords: 'eye drop'
  },
  {
    name: '20 ml Round Dropper Bottle',
    group: 'bottles',
    type: 'dropper-bottles',
    image: '20-ml-round-dropper-bottle.jpg',
    material: 'HDPE',
    weight: '5.00 gm',
    keywords: 'eye drop'
  },
  {
    name: '15 ml Dropper Bottle',
    group: 'bottles',
    type: 'dropper-bottles',
    image: '15-ml-dropper-bottle.jpg',
    material: 'LDPE',
    weight: '4.00 gm',
    keywords: 'eye drop'
  },
  {
    name: '30 ml DSB Round Bottle - 25 mm Neck (Marked)',
    group: 'bottles',
    type: 'dry-syrup-bottles',
    image: '30-ml-dsb-round-bottle-25-mm-neck-marked.jpg',
    material: 'HDPE',
    weight: '10.50 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '60 ml Lens Cleaner Bottle',
    group: 'bottles',
    type: 'liquid-bottles',
    image: '60-ml-lens-cleaner-bottle.jpg',
    material: 'LDPE + HDPE',
    weight: '10.00 gm'
  },
  {
    name: '120 ml Lens Cleaner Bottle',
    group: 'bottles',
    type: 'liquid-bottles',
    image: '120-ml-lens-cleaner-bottle.jpg',
    material: 'LDPE + HDPE',
    weight: '16.00 gm'
  },
  {
    name: '360 ml Lens Cleaner Bottle',
    group: 'bottles',
    type: 'liquid-bottles',
    image: '360-ml-lens-cleaner-bottle.jpg',
    material: 'LDPE + HDPE',
    weight: '34.00 gm'
  },
  {
    name: '120 ml Iodine Bottle',
    group: 'bottles',
    type: 'liquid-bottles',
    image: '120-ml-iodine-bottle.jpg',
    material: 'HDPE',
    weight: '17.50 gm'
  },
  {
    name: '60 ml DSB Round Bottle (30 ml Mark)',
    group: 'bottles',
    type: 'dry-syrup-bottles',
    image: 'arch-round-bottle.svg',
    illustrative: true,
    material: 'HDPE',
    weight: '11.00 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '100 ml DSB Round Bottle',
    group: 'bottles',
    type: 'dry-syrup-bottles',
    image: '100-ml-dsb-round-bottle.jpg',
    material: 'HDPE',
    weight: '15.50 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '150 ml DSB Conical Bottle',
    group: 'bottles',
    type: 'dry-syrup-bottles',
    image: '150-ml-dsb-conical-bottle.jpg',
    material: 'HDPE',
    weight: '22.00 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '100 ml DSB Round Bottle - 28 mm Neck',
    group: 'bottles',
    type: 'dry-syrup-bottles',
    image: '100-ml-dsb-round-bottle-28-mm-neck.jpg',
    material: 'HDPE',
    weight: '15.50 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '100 ml DSB Conical Bottle (Without Marking)',
    group: 'bottles',
    type: 'dry-syrup-bottles',
    image: 'arch-conical-bottle.svg',
    illustrative: true,
    material: 'HDPE',
    weight: '22.00 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '100 ml DSB Conical Bottle (Half Marking)',
    group: 'bottles',
    type: 'dry-syrup-bottles',
    image: '100-ml-dsb-conical-bottle-half-marking.jpg',
    material: 'HDPE',
    weight: '22.00 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '70 ml DSB Conical Bottle (Half Marking)',
    group: 'bottles',
    type: 'dry-syrup-bottles',
    image: '70-ml-dsb-conical-bottle-half-marking.jpg',
    material: 'HDPE',
    weight: '22.00 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '60 ml DSB Conical Bottle (Half Marking)',
    group: 'bottles',
    type: 'dry-syrup-bottles',
    image: '60-ml-dsb-conical-bottle-half-marking.jpg',
    material: 'HDPE',
    weight: '19.00 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '60 ml DSB Round Bottle - 28 mm Neck',
    group: 'bottles',
    type: 'dry-syrup-bottles',
    image: '60-ml-dsb-round-bottle-28-mm-neck.jpg',
    material: 'HDPE',
    weight: '14.00 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '30 ml DSB Round Bottle - 28 mm Neck',
    group: 'bottles',
    type: 'dry-syrup-bottles',
    image: '30-ml-dsb-round-bottle-28-mm-neck.jpg',
    material: 'HDPE',
    weight: '8.60 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '60 ml DSB Round Bottle - 25 mm Neck (Full Mark)',
    group: 'bottles',
    type: 'dry-syrup-bottles',
    image: '60-ml-dsb-round-bottle-25-mm-neck-full-mark.jpg',
    material: 'HDPE',
    weight: '10.00 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '30 ml DSB Round Bottle - 25 mm Neck',
    group: 'bottles',
    type: 'dry-syrup-bottles',
    image: 'arch-round-bottle.svg',
    illustrative: true,
    material: 'HDPE',
    weight: '8.60 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '40 ml Tablet Container',
    group: 'bottles',
    type: 'tablet-containers',
    image: 'arch-tablet-jar.svg',
    illustrative: true,
    material: 'HDPE',
    weight: '10.00 gm'
  },
  {
    name: '30 ml DSB Round Bottle - 28 mm Neck (Half Mark)',
    group: 'bottles',
    type: 'dry-syrup-bottles',
    image: 'arch-round-bottle.svg',
    illustrative: true,
    material: 'HDPE',
    weight: '8.60 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '60 ml DSB Round Bottle - 28 mm Neck (30 and 15 ml Marks)',
    group: 'bottles',
    type: 'dry-syrup-bottles',
    image: 'arch-round-bottle.svg',
    illustrative: true,
    material: 'HDPE',
    weight: '14.00 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '150 ml DSB Conical Bottle - CRC Neck (Without Marking)',
    group: 'bottles',
    type: 'dry-syrup-bottles',
    image: 'arch-conical-bottle.svg',
    illustrative: true,
    material: 'HDPE',
    weight: '22.50 gm',
    keywords: 'child resistant closure dry syrup bottle'
  },
  {
    name: '500 ml Hand Wash Bottle',
    group: 'bottles',
    type: 'liquid-bottles',
    image: '500-ml-hand-wash-bottle.jpg',
    material: 'HDPE',
    weight: '48.00 gm'
  },
  {
    name: '500 ml Round Bottle',
    group: 'bottles',
    type: 'liquid-bottles',
    image: '500-ml-round-bottle.jpg',
    material: 'HDPE',
    weight: '50.00 gm'
  },
  {
    name: '500 ml Square Bottle',
    group: 'bottles',
    type: 'liquid-bottles',
    image: '500-ml-square-bottle.jpg',
    material: 'HDPE',
    weight: '60.00 gm'
  },
  {
    name: '300 ml HDPE Round Bottle',
    group: 'bottles',
    type: 'liquid-bottles',
    image: '300-ml-hdpe-round-bottle.jpg',
    material: 'HDPE',
    weight: '27.00 gm'
  },
  {
    name: '150 ml DSB Conical Bottle (Without Marking)',
    group: 'bottles',
    type: 'dry-syrup-bottles',
    image: 'arch-conical-bottle.svg',
    illustrative: true,
    material: 'HDPE',
    weight: '22.50 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '100 ml DSB Conical Bottle (Full Marking)',
    group: 'bottles',
    type: 'dry-syrup-bottles',
    image: 'arch-conical-bottle.svg',
    illustrative: true,
    material: 'HDPE',
    weight: '22.00 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '150 ml Tablet Bottle',
    group: 'bottles',
    type: 'tablet-containers',
    image: '150-ml-tablet-bottle.jpg',
    material: 'HDPE',
    weight: '24.80 gm'
  },
  {
    name: '100 ml Tablet Bottle Set',
    group: 'bottles',
    type: 'tablet-containers',
    image: '100-ml-tablet-bottle-set.jpg',
    material: 'HDPE',
    weight: '11.00 gm'
  },
  // PET bottles: neck, body diameter, height and overflow capacity are the
  // partner's datasheet figures; colour is made to order on every one.
  {
    name: '15 ml Round PET Bottle',
    group: 'bottles',
    type: 'pet-bottles',
    image: '15-ml-round-pet-bottle.jpg',
    material: 'PET',
    weight: '7.70 gm',
    keywords: '25 mm neck syrup',
    specs: [
      { label: 'Neck size', value: '25 mm' },
      { label: 'Body diameter', value: '28 mm' },
      { label: 'Height', value: '60 mm' },
      { label: 'Overflow capacity', value: '20 ml' },
      { label: 'Colour', value: 'To requirement' }
    ]
  },
  {
    name: '30 ml Round PET Bottle',
    group: 'bottles',
    type: 'pet-bottles',
    image: '30-ml-round-pet-bottle.jpg',
    material: 'PET',
    weight: '7.70 gm',
    keywords: '25 mm neck syrup',
    specs: [
      { label: 'Neck size', value: '25 mm' },
      { label: 'Body diameter', value: '30.5 mm' },
      { label: 'Height', value: '76 mm' },
      { label: 'Overflow capacity', value: '35 ml' },
      { label: 'Colour', value: 'To requirement' }
    ]
  },
  {
    name: '60 ml Round PET Bottle',
    group: 'bottles',
    type: 'pet-bottles',
    image: '60-ml-round-pet-bottle.jpg',
    material: 'PET',
    weight: '10.00 gm',
    keywords: '25 mm neck syrup',
    specs: [
      { label: 'Neck size', value: '25 mm' },
      { label: 'Body diameter', value: '36 mm' },
      { label: 'Height', value: '92 mm' },
      { label: 'Overflow capacity', value: '70 ml' },
      { label: 'Colour', value: 'To requirement' }
    ]
  },
  {
    name: '60 ml Dome PET Bottle',
    group: 'bottles',
    type: 'pet-bottles',
    image: '60-ml-dome-pet-bottle.jpg',
    material: 'PET',
    weight: '10.00 gm',
    keywords: '25 mm neck syrup',
    specs: [
      { label: 'Neck size', value: '25 mm' },
      { label: 'Body diameter', value: '36 mm' },
      { label: 'Height', value: '92 mm' },
      { label: 'Overflow capacity', value: '70 ml' },
      { label: 'Colour', value: 'To requirement' }
    ]
  },
  {
    name: '100 ml Round PET Bottle',
    group: 'bottles',
    type: 'pet-bottles',
    image: '100-ml-round-pet-bottle.jpg',
    material: 'PET',
    weight: '12.76 gm',
    keywords: '25 mm neck syrup',
    specs: [
      { label: 'Neck size', value: '25 mm' },
      { label: 'Body diameter', value: '43.7 mm' },
      { label: 'Height', value: '107 mm' },
      { label: 'Overflow capacity', value: '120 ml' },
      { label: 'Colour', value: 'To requirement' }
    ]
  },
  {
    name: '100 ml Brute PET Bottle',
    group: 'bottles',
    type: 'pet-bottles',
    image: '100-ml-brute-pet-bottle.jpg',
    material: 'PET',
    weight: '12.76 gm',
    keywords: '25 mm neck syrup',
    specs: [
      { label: 'Neck size', value: '25 mm' },
      { label: 'Body diameter', value: '46.1 mm' },
      { label: 'Height', value: '127.5 mm' },
      { label: 'Overflow capacity', value: '115 ml' },
      { label: 'Colour', value: 'To requirement' }
    ]
  },
  {
    name: '100 ml Boston Round PET Bottle',
    group: 'bottles',
    type: 'pet-bottles',
    image: '100-ml-boston-round-pet-bottle.jpg',
    material: 'PET',
    weight: '12.76 gm',
    keywords: '25 mm neck syrup',
    specs: [
      { label: 'Neck size', value: '25 mm' },
      { label: 'Body diameter', value: '43.7 mm' },
      { label: 'Height', value: '109 mm' },
      { label: 'Overflow capacity', value: '115 ml' },
      { label: 'Colour', value: 'To requirement' }
    ]
  },
  {
    name: '150 ml Flat PET Bottle (Gripe Water)',
    group: 'bottles',
    type: 'pet-bottles',
    image: 'arch-flat-bottle.svg',
    illustrative: true,
    material: 'PET',
    weight: '16.50 gm',
    keywords: '25 mm neck flask',
    specs: [
      { label: 'Neck size', value: '25 mm' },
      { label: 'Body diameter', value: '57 mm' },
      { label: 'Height', value: '146 mm' },
      { label: 'Overflow capacity', value: '150 ml' },
      { label: 'Colour', value: 'To requirement' }
    ]
  },
  {
    // The partner's catalogue shows one photograph for the 170 ml and the
    // 200 ml round; both entries carry it.
    name: '170 ml Round PET Bottle',
    group: 'bottles',
    type: 'pet-bottles',
    image: '200-ml-round-pet-bottle.jpg',
    material: 'PET',
    weight: '16.50 gm',
    keywords: '25 mm neck syrup',
    specs: [
      { label: 'Neck size', value: '25 mm' },
      { label: 'Body diameter', value: '52 mm' },
      { label: 'Height', value: '123 mm' },
      { label: 'Overflow capacity', value: '187 ml' },
      { label: 'Colour', value: 'To requirement' }
    ]
  },
  {
    name: '200 ml Round PET Bottle',
    group: 'bottles',
    type: 'pet-bottles',
    image: '200-ml-round-pet-bottle.jpg',
    material: 'PET',
    weight: '18.30 gm',
    keywords: '25 mm neck syrup',
    specs: [
      { label: 'Neck size', value: '25 mm' },
      { label: 'Body diameter', value: '55 mm' },
      { label: 'Height', value: '133 mm' },
      { label: 'Overflow capacity', value: '220 ml' },
      { label: 'Colour', value: 'To requirement' }
    ]
  },
  {
    name: '200 ml Brute PET Bottle',
    group: 'bottles',
    type: 'pet-bottles',
    image: '200-ml-brute-pet-bottle.jpg',
    material: 'PET',
    weight: '18.30 gm',
    keywords: '25 mm neck syrup',
    specs: [
      { label: 'Neck size', value: '25 mm' },
      { label: 'Body diameter', value: '58 mm' },
      { label: 'Height', value: '153 mm' },
      { label: 'Overflow capacity', value: '225 ml' },
      { label: 'Colour', value: 'To requirement' }
    ]
  },
  {
    name: '200 ml Micro Brute PET Bottle',
    group: 'bottles',
    type: 'pet-bottles',
    image: '200-ml-micro-brute-pet-bottle.jpg',
    material: 'PET',
    weight: '19.00 gm',
    keywords: '25 mm neck syrup',
    specs: [
      { label: 'Neck size', value: '25 mm' },
      { label: 'Body diameter', value: '55 mm' },
      { label: 'Height', value: '185 mm' },
      { label: 'Overflow capacity', value: '220 ml' },
      { label: 'Colour', value: 'To requirement' }
    ]
  },
  {
    name: '500 ml Round PET Bottle',
    group: 'bottles',
    type: 'pet-bottles',
    image: 'arch-round-bottle.svg',
    illustrative: true,
    material: 'PET',
    weight: '38.00 gm',
    keywords: '25 mm neck 28 mm neck',
    specs: [
      { label: 'Neck size', value: '25 mm or 28 mm' },
      { label: 'Body diameter', value: '70 mm' },
      { label: 'Height', value: '177 mm' },
      { label: 'Overflow capacity', value: '530 ml' },
      { label: 'Colour', value: 'To requirement' }
    ]
  },

  // Vial seals: figures from the partner's published size tables.
  {
    name: 'Vial Seal',
    group: 'vial-seals',
    image: 'vial-seal.jpg',
    material: 'Aluminium',
    keywords: 'tear off tear down crimp cap injection vial 13 mm 20 mm 32 mm',
    specs: [
      { label: 'Type', value: 'Tear-off or tear-down aluminium seal' },
      { label: 'Sizes', value: '13 mm and 20 mm (tear-off); 20 mm and 32 mm (tear-down)' },
      { label: 'Height', value: '7.0 to 10.2 mm, by size' }
    ]
  },
  {
    name: 'Flip Off Seal',
    group: 'vial-seals',
    image: 'flip-off-seal.jpg',
    material: 'Aluminium',
    keywords: 'flip-off tear off vial seal injection 13 mm 20 mm button',
    specs: [
      { label: 'Type', value: 'Flip-off tear-off aluminium seal' },
      { label: 'Sizes', value: '13 mm and 20 mm' },
      { label: 'Outer diameter', value: '15.0 to 15.2 mm (13 mm); 22.5 to 23.0 mm (20 mm)' },
      { label: 'Height', value: '8.3 to 8.8 mm (13 mm); 9.0 to 9.5 mm (20 mm)' }
    ]
  },

  // Flexible packaging: the partner's product families and format lists.
  {
    name: 'Printed / Unprinted Roll Stock',
    group: 'flexible',
    type: 'roll-stock',
    image: 'printed-unprinted-roll-stock.jpg',
    keywords: 'laminate film reel lamination roll bopp pet foil pe flow wrap',
    specs: [
      {
        label: 'Formats',
        value:
          'Multi-layer adhesive lamination, co-extrusion lamination, stick pack lamination, wrap-around BOPP label rolls, HFFS / VFFS flow wrap, paper-based lamination, lidding lamination'
      }
    ]
  },
  {
    name: 'Standard Pouch',
    group: 'flexible',
    type: 'pouches',
    image: 'standard-pouch.jpg',
    keywords: 'pillow pouch three side seal stand up doy pack gusset quad seal penta seal',
    specs: [
      {
        label: 'Formats',
        value: 'Central seal / pillow, three side seal, stand-up / doy pack, side gusset central seal, quad seal, penta seal'
      }
    ]
  },
  {
    name: 'Speciality Application Pouch',
    group: 'flexible',
    type: 'pouches',
    image: 'speciality-application-pouch.jpg',
    keywords: 'retort spouted degassing valve flat bottom box vacuum shaped heavy duty bag',
    specs: [
      {
        label: 'Formats',
        value: 'Retort, spouted, de-gassing valve, flat-bottom, 4 side flat box, vacuum, shaped, heavy duty bags'
      }
    ]
  },
  {
    name: 'Cold Seal Packaging Roll',
    group: 'flexible',
    type: 'roll-stock',
    image: 'cold-seal-packaging-roll.jpg',
    keywords: 'cold seal film flow wrap bars chocolate heat sensitive',
    specs: [
      { label: 'Suited to', value: 'Heat-sensitive products: protein, breakfast and nutrition bars, chocolate, ice cream novelties' },
      { label: 'Seal', value: 'Cold seal, with strength and integrity equivalent to heat-seal structures' },
      { label: 'On the line', value: 'Faster line speeds, immediate start-up, no heat distortion of the pack' }
    ]
  },
  {
    name: 'Shrink Sleeves',
    group: 'flexible',
    type: 'sleeves',
    image: 'shrink-sleeves.jpg',
    keywords: 'shrink sleeve label full body sleeve bottle can tamper evident',
    specs: [
      { label: 'Type', value: 'Heat-shrunk full-body label that conforms to the container' },
      { label: 'Suited to', value: 'Bottles, cans and shaped containers' }
    ]
  },

  // Injection moulded pallets: the client's own size list. Three openly
  // licensed photographs stand in for the sizes (looser match, by design).
  {
    name: '1100 x 1100 x 150 mm Injection Moulded Pallet',
    group: 'pallets',
    image: 'pallet-rackable.jpg',
    keywords: 'plastic pallet injection moulding export',
    specs: [
      { label: 'Length', value: '1100 mm' },
      { label: 'Width', value: '1100 mm' },
      { label: 'Height', value: '150 mm' }
    ],
    credit: 'Photo: Cantons-de-l\'Est, CC BY-SA 4.0, via Wikimedia Commons'
  },
  {
    name: '1100 x 1100 x 120 mm Injection Moulded Pallet',
    group: 'pallets',
    image: 'pallet-stacked.jpg',
    keywords: 'plastic pallet injection moulding export',
    specs: [
      { label: 'Length', value: '1100 mm' },
      { label: 'Width', value: '1100 mm' },
      { label: 'Height', value: '120 mm' }
    ],
    credit: 'Photo: Cantons-de-l\'Est, CC BY-SA 4.0, via Wikimedia Commons'
  },
  {
    name: '1200 x 1000 x 150 mm Injection Moulded Pallet',
    group: 'pallets',
    image: 'pallet-rackable.jpg',
    keywords: 'plastic pallet injection moulding export',
    specs: [
      { label: 'Length', value: '1200 mm' },
      { label: 'Width', value: '1000 mm' },
      { label: 'Height', value: '150 mm' }
    ],
    credit: 'Photo: Cantons-de-l\'Est, CC BY-SA 4.0, via Wikimedia Commons'
  },
  {
    name: '1200 x 1000 x 120 mm Injection Moulded Pallet',
    group: 'pallets',
    image: 'pallet-stacked.jpg',
    keywords: 'plastic pallet injection moulding export',
    specs: [
      { label: 'Length', value: '1200 mm' },
      { label: 'Width', value: '1000 mm' },
      { label: 'Height', value: '120 mm' }
    ],
    credit: 'Photo: Cantons-de-l\'Est, CC BY-SA 4.0, via Wikimedia Commons'
  },
  {
    name: '1050 x 1050 x 120 mm Injection Moulded Pallet',
    group: 'pallets',
    image: 'pallet-stacked.jpg',
    keywords: 'plastic pallet injection moulding export',
    specs: [
      { label: 'Length', value: '1050 mm' },
      { label: 'Width', value: '1050 mm' },
      { label: 'Height', value: '120 mm' }
    ],
    credit: 'Photo: Cantons-de-l\'Est, CC BY-SA 4.0, via Wikimedia Commons'
  },
  {
    name: '1200 x 800 x 135 mm Nestable Injection Moulded Pallet',
    group: 'pallets',
    image: 'pallet-nestable.jpg',
    keywords: 'plastic pallet injection moulding export nesting',
    specs: [
      { label: 'Length', value: '1200 mm' },
      { label: 'Width', value: '800 mm' },
      { label: 'Height', value: '135 mm' },
      { label: 'Type', value: 'Nestable' }
    ],
    credit: 'Photo: Ser Amantio di Nicolao, CC BY-SA 4.0, via Wikimedia Commons'
  },
  {
    name: '1100 x 900 x 150 mm Injection Moulded Pallet',
    group: 'pallets',
    image: 'pallet-rackable.jpg',
    keywords: 'plastic pallet injection moulding export',
    specs: [
      { label: 'Length', value: '1100 mm' },
      { label: 'Width', value: '900 mm' },
      { label: 'Height', value: '150 mm' }
    ],
    credit: 'Photo: Cantons-de-l\'Est, CC BY-SA 4.0, via Wikimedia Commons'
  }
];
