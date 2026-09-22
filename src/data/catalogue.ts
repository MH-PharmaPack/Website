// The sourcing catalogue: packaging items MH can source through partner plants.
// Data supplied by the manufacturing partner with permission; the partner is
// deliberately not named anywhere on the site or in this repo, and their
// internal product codes are not carried over. Entries marked `illustrative`
// have no partner photograph yet and use a line drawing (same filename stem
// convention, .svg) that is representative of the item type, not a photo.
//
// To add products later: append entries here and drop the image into
// src/assets/catalogue/ under the same filename. `keywords` are extra
// search-only terms (industry synonyms), never displayed.

export interface CatalogueItem {
  name: string;
  category: CatalogueCategory;
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
}

export const CATALOGUE_CATEGORIES = [
  'Caps & Closures',
  'Spray Bottles',
  'Ophthalmic Bottles',
  'Pharmaceutical Bottles',
] as const;

export type CatalogueCategory = (typeof CATALOGUE_CATEGORIES)[number];

export const CATALOGUE: CatalogueItem[] = [
  {
    name: '25 mm Screw Cap - Thin Knurling',
    category: 'Caps & Closures',
    image: '25-mm-screw-cap-thin-knurling.jpg',
    material: 'PP',
    weight: '1.80 gm',
    keywords: 'knurled'
  },
  {
    name: '25 mm Pilfer Proof Cap - Thin Knurling (Half)',
    category: 'Caps & Closures',
    image: '25-mm-pilfer-proof-cap-thin-knurling-half.jpg',
    material: 'PP',
    weight: '2.10 gm',
    keywords: 'tamper evident knurled'
  },
  {
    name: '25 mm Pilfer Proof Cap - Thin Knurling (Full)',
    category: 'Caps & Closures',
    image: '25-mm-pilfer-proof-cap-thin-knurling-full.jpg',
    material: 'PP',
    weight: '2.10 gm',
    keywords: 'tamper evident knurled'
  },
  {
    name: '25 mm CRC Inner',
    category: 'Caps & Closures',
    image: 'arch-crc-inner.svg',
    illustrative: true,
    material: 'PP',
    weight: '1.50 gm',
    keywords: 'child resistant closure'
  },
  {
    name: '25 mm CRC Outer',
    category: 'Caps & Closures',
    image: '25-mm-crc-outer.jpg',
    material: 'HDPE',
    weight: '2.00 gm',
    keywords: 'child resistant closure'
  },
  {
    name: '28 mm Screw Cap - Thin Knurling',
    category: 'Caps & Closures',
    image: '28-mm-screw-cap-thin-knurling.jpg',
    material: 'PP',
    weight: '2.40 gm',
    keywords: 'knurled'
  },
  {
    name: '28 mm Pilfer Proof Cap - Thick Knurling',
    category: 'Caps & Closures',
    image: '28-mm-pilfer-proof-cap-thick-knurling.jpg',
    material: 'PP',
    weight: '3.00 gm',
    keywords: 'tamper evident knurled'
  },
  {
    name: '28 mm Pilfer Proof Cap - Thin Knurling',
    category: 'Caps & Closures',
    image: '28-mm-pilfer-proof-cap-thin-knurling.jpg',
    material: 'PP',
    weight: '2.50 gm',
    keywords: 'tamper evident knurled'
  },
  {
    name: '25 mm Ring',
    category: 'Caps & Closures',
    image: 'arch-ring.svg',
    illustrative: true,
    material: 'LDPE + HDPE',
    weight: '0.70 gm'
  },
  {
    name: '28 mm Ring',
    category: 'Caps & Closures',
    image: 'arch-ring.svg',
    illustrative: true,
    material: 'LDPE + HDPE',
    weight: '0.80 gm'
  },
  {
    name: '10 ml Measuring Cup',
    category: 'Caps & Closures',
    image: 'arch-measuring-cup.svg',
    illustrative: true,
    material: 'PP',
    weight: '1.80 gm'
  },
  {
    name: 'Cap for 30 Gm Dusting Container',
    category: 'Caps & Closures',
    image: 'cap-for-30-gm-dusting-container.jpg',
    material: 'HDPE',
    weight: '6.40 gm'
  },
  {
    name: 'Cap for 100 gm Dusting Container',
    category: 'Caps & Closures',
    image: 'cap-for-100-gm-dusting-container.jpg',
    material: 'HDPE',
    weight: '4.70 gm'
  },
  {
    name: 'Stopper for 30 gm and 100 gm Round',
    category: 'Caps & Closures',
    image: 'stopper-for-30-gm-and-100-gm-round.jpg',
    material: 'LDPE',
    weight: '1.80 gm'
  },
  {
    name: '15 ml Measuring Cup - CE Marking',
    category: 'Caps & Closures',
    image: '15-ml-measuring-cup-ce-marking.jpg',
    material: 'PP',
    weight: '3.00 gm'
  },
  {
    name: '20 ml Measuring Cup',
    category: 'Caps & Closures',
    image: 'arch-measuring-cup.svg',
    illustrative: true,
    material: 'PP',
    weight: '4.00 gm'
  },
  {
    name: '28 mm CRC Inner',
    category: 'Caps & Closures',
    image: 'arch-crc-inner.svg',
    illustrative: true,
    material: 'PP',
    weight: '2.50 gm',
    keywords: 'child resistant closure'
  },
  {
    name: '28 mm CRC Outer',
    category: 'Caps & Closures',
    image: '28-mm-crc-outer.jpg',
    material: 'HDPE',
    weight: '3.40 gm',
    keywords: 'child resistant closure'
  },
  {
    name: '32 mm CRC Inner',
    category: 'Caps & Closures',
    image: 'arch-crc-inner.svg',
    illustrative: true,
    material: 'PP',
    weight: '2.50 gm',
    keywords: 'child resistant closure'
  },
  {
    name: '32 mm CRC Outer',
    category: 'Caps & Closures',
    image: '32-mm-crc-outer.jpg',
    material: 'HDPE',
    weight: '3.50 gm',
    keywords: 'child resistant closure'
  },
  {
    name: '38 mm CRC Inner',
    category: 'Caps & Closures',
    image: 'arch-crc-inner.svg',
    illustrative: true,
    material: 'PP',
    weight: '2.90 gm',
    keywords: 'child resistant closure'
  },
  {
    name: '38 mm CRC Outer',
    category: 'Caps & Closures',
    image: '38-mm-crc-outer.jpg',
    material: 'HDPE',
    weight: '3.20 gm',
    keywords: 'child resistant closure'
  },
  {
    name: '75 ml Measuring Cup',
    category: 'Caps & Closures',
    image: 'arch-measuring-cup.svg',
    illustrative: true,
    material: 'PP',
    weight: '8.20 gm'
  },
  {
    name: '15 ml Measuring Cup (28 mm Thick Knurling Cap)',
    category: 'Caps & Closures',
    image: '15-ml-measuring-cup-28-mm-thick-knurling-cap.jpg',
    material: 'PP',
    weight: '2.20 gm',
    keywords: 'knurled'
  },
  {
    name: '22 mm PP Cap',
    category: 'Caps & Closures',
    image: 'arch-screw-cap.svg',
    illustrative: true,
    material: 'PP',
    weight: '1.60 gm'
  },
  {
    name: '22 mm Ring',
    category: 'Caps & Closures',
    image: 'arch-ring.svg',
    illustrative: true,
    material: 'LDPE + HDPE',
    weight: '0.45 gm'
  },
  {
    name: 'Flip Top Cap (Lens Cleaner Bottle)',
    category: 'Caps & Closures',
    image: 'flip-top-cap-lens-cleaner-bottle.jpg',
    material: 'PP',
    weight: '2.80 gm'
  },
  {
    name: 'Flip Top Cap (550 ml Shower Gel Bottle)',
    category: 'Caps & Closures',
    image: 'flip-top-cap-550-ml-shower-gel-bottle.jpg'
  },
  {
    name: 'Razor Cap',
    category: 'Caps & Closures',
    image: 'arch-screw-cap.svg',
    illustrative: true,
    material: 'PP',
    weight: '8.20 gm'
  },
  {
    name: '15 ml Spray Bottle',
    category: 'Spray Bottles',
    image: '15-ml-spray-bottle.jpg',
    material: 'LDPE + HDPE',
    weight: '6.20 gm',
    keywords: 'atomizer mist'
  },
  {
    name: '50 ml Spray Bottle',
    category: 'Spray Bottles',
    image: '50-ml-spray-bottle.jpg',
    material: 'LDPE + HDPE',
    weight: '11.00 gm',
    keywords: 'atomizer mist'
  },
  {
    name: '25 ml Pocket Spray',
    category: 'Spray Bottles',
    image: '25-ml-pocket-spray.jpg',
    material: 'PP',
    weight: '8.00 gm',
    keywords: 'atomizer mist'
  },
  {
    name: '15 ml Nasal Spray',
    category: 'Spray Bottles',
    image: '15-ml-nasal-spray.jpg',
    material: 'LDPE',
    weight: '4.50 gm',
    keywords: 'atomizer mist'
  },
  {
    name: '15 ml Round Nasal Spray Bottle',
    category: 'Spray Bottles',
    image: '15-ml-round-nasal-spray-bottle.jpg',
    material: 'HDPE',
    weight: '4.50 gm',
    keywords: 'atomizer mist'
  },
  {
    name: '30 ml Spray Bottle',
    category: 'Spray Bottles',
    image: '30-ml-spray-bottle.png',
    material: 'HDPE',
    weight: '6.00 gm',
    keywords: 'atomizer mist'
  },
  {
    name: '60 ml Round Spray Bottle',
    category: 'Spray Bottles',
    image: 'arch-spray-bottle.svg',
    illustrative: true,
    material: 'HDPE',
    keywords: 'atomizer mist'
  },
  {
    name: '100 ml Round Spray Bottle',
    category: 'Spray Bottles',
    image: 'arch-spray-bottle.svg',
    illustrative: true,
    material: 'LDPE',
    keywords: 'atomizer mist'
  },
  {
    name: '200 ml Round Spray Bottle',
    category: 'Spray Bottles',
    image: 'arch-spray-bottle.svg',
    illustrative: true,
    material: 'HDPE',
    keywords: 'atomizer mist'
  },
  {
    name: 'Seal Cap For Dropper Bottle',
    category: 'Ophthalmic Bottles',
    image: 'seal-cap-for-dropper-bottle.jpg',
    material: 'HDPE',
    weight: '1.40 gm',
    keywords: 'eye drop'
  },
  {
    name: 'Plug For Dropper - EBM',
    category: 'Ophthalmic Bottles',
    image: 'plug-for-dropper-ebm.jpg',
    material: 'LDPE',
    weight: '0.50 gm',
    keywords: 'eye drop'
  },
  {
    name: 'Plug For Dropper - IBM',
    category: 'Ophthalmic Bottles',
    image: 'plug-for-dropper-ibm.jpg',
    material: 'LDPE',
    weight: '0.50 gm',
    keywords: 'eye drop'
  },
  {
    name: '2 ml Plug',
    category: 'Ophthalmic Bottles',
    image: '2-ml-plug.jpg',
    material: 'LDPE',
    weight: '0.50 gm',
    keywords: 'eye drop'
  },
  {
    name: '2 ml Dropper Bottle',
    category: 'Ophthalmic Bottles',
    image: '2-ml-dropper-bottle.jpg',
    material: 'LDPE',
    weight: '1.20 gm',
    keywords: 'eye drop'
  },
  {
    name: '5 ml Dropper Bottle (Light Weight)',
    category: 'Ophthalmic Bottles',
    image: '5-ml-dropper-bottle-light-weight.jpg',
    material: 'LDPE',
    weight: '2.80 gm',
    keywords: 'eye drop'
  },
  {
    name: '5 ml Dropper Bottle (Heavy Weight)',
    category: 'Ophthalmic Bottles',
    image: 'arch-dropper-bottle.svg',
    illustrative: true,
    material: 'LDPE',
    weight: '3.00 gm',
    keywords: 'eye drop'
  },
  {
    name: '10 ml Dropper Bottle',
    category: 'Ophthalmic Bottles',
    image: '10-ml-dropper-bottle.jpg',
    material: 'LDPE',
    weight: '3.20 gm',
    keywords: 'eye drop'
  },
  {
    name: '10 ml Dropper Bottle (New)',
    category: 'Ophthalmic Bottles',
    image: '10-ml-dropper-bottle-new.jpg',
    material: 'LDPE',
    weight: '3.20 gm',
    keywords: 'eye drop'
  },
  {
    name: '30 ml Round Dropper Bottle (Round Shoulder)',
    category: 'Ophthalmic Bottles',
    image: '30-ml-round-dropper-bottle-round-shoulder.jpg',
    material: 'LDPE',
    weight: '6.60 gm',
    keywords: 'eye drop'
  },
  {
    name: '30 ml Round Dropper Bottle (Flat Shoulder - Exp)',
    category: 'Ophthalmic Bottles',
    image: '30-ml-round-dropper-bottle-flat-shoulder-exp.jpg',
    material: 'LDPE',
    weight: '6.60 gm',
    keywords: 'eye drop'
  },
  {
    name: '20 ml Round Dropper Bottle',
    category: 'Ophthalmic Bottles',
    image: '20-ml-round-dropper-bottle.jpg',
    material: 'HDPE',
    weight: '5.00 gm',
    keywords: 'eye drop'
  },
  {
    name: '15 ml Dropper Bottle',
    category: 'Ophthalmic Bottles',
    image: '15-ml-dropper-bottle.jpg',
    material: 'LDPE',
    weight: '4.00 gm',
    keywords: 'eye drop'
  },
  {
    name: '30 ml DSB Round Bottle - 25 mm Neck (Marked)',
    category: 'Pharmaceutical Bottles',
    image: '30-ml-dsb-round-bottle-25-mm-neck-marked.jpg',
    material: 'HDPE',
    weight: '10.50 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '60 ml Lens Cleaner Bottle',
    category: 'Pharmaceutical Bottles',
    image: '60-ml-lens-cleaner-bottle.jpg',
    material: 'LDPE + HDPE',
    weight: '10.00 gm'
  },
  {
    name: '120 ml Lens Cleaner Bottle',
    category: 'Pharmaceutical Bottles',
    image: '120-ml-lens-cleaner-bottle.jpg',
    material: 'LDPE + HDPE',
    weight: '16.00 gm'
  },
  {
    name: '360 ml Lens Cleaner Bottle',
    category: 'Pharmaceutical Bottles',
    image: '360-ml-lens-cleaner-bottle.jpg',
    material: 'LDPE + HDPE',
    weight: '34.00 gm'
  },
  {
    name: '120 ml Iodine Bottle',
    category: 'Pharmaceutical Bottles',
    image: '120-ml-iodine-bottle.jpg',
    material: 'HDPE',
    weight: '17.50 gm'
  },
  {
    name: '60 ml DSB Round Bottle (30 ml Mark)',
    category: 'Pharmaceutical Bottles',
    image: 'arch-round-bottle.svg',
    illustrative: true,
    material: 'HDPE',
    weight: '11.00 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '100 ml DSB Round Bottle',
    category: 'Pharmaceutical Bottles',
    image: '100-ml-dsb-round-bottle.jpg',
    material: 'HDPE',
    weight: '15.50 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '150 ml DSB Conical Bottle',
    category: 'Pharmaceutical Bottles',
    image: '150-ml-dsb-conical-bottle.jpg',
    material: 'HDPE',
    weight: '22.00 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '100 ml DSB Round Bottle - 28 mm Neck',
    category: 'Pharmaceutical Bottles',
    image: '100-ml-dsb-round-bottle-28-mm-neck.jpg',
    material: 'HDPE',
    weight: '15.50 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '100 ml DSB Conical Bottle (Without Marking)',
    category: 'Pharmaceutical Bottles',
    image: 'arch-conical-bottle.svg',
    illustrative: true,
    material: 'HDPE',
    weight: '22.00 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '100 ml DSB Conical Bottle (Half Marking)',
    category: 'Pharmaceutical Bottles',
    image: '100-ml-dsb-conical-bottle-half-marking.jpg',
    material: 'HDPE',
    weight: '22.00 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '70 ml DSB Conical Bottle (Half Marking)',
    category: 'Pharmaceutical Bottles',
    image: '70-ml-dsb-conical-bottle-half-marking.jpg',
    material: 'HDPE',
    weight: '22.00 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '60 ml DSB Conical Bottle (Half Marking)',
    category: 'Pharmaceutical Bottles',
    image: '60-ml-dsb-conical-bottle-half-marking.jpg',
    material: 'HDPE',
    weight: '19.00 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '60 ml DSB Round Bottle - 28 mm Neck',
    category: 'Pharmaceutical Bottles',
    image: '60-ml-dsb-round-bottle-28-mm-neck.jpg',
    material: 'HDPE',
    weight: '14.00 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '30 ml DSB Round Bottle - 28 mm Neck',
    category: 'Pharmaceutical Bottles',
    image: '30-ml-dsb-round-bottle-28-mm-neck.jpg',
    material: 'HDPE',
    weight: '8.60 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '60 ml DSB Round Bottle - 25 mm Neck (Full Mark)',
    category: 'Pharmaceutical Bottles',
    image: '60-ml-dsb-round-bottle-25-mm-neck-full-mark.jpg',
    material: 'HDPE',
    weight: '10.00 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '30 ml DSB Round Bottle - 25 mm Neck',
    category: 'Pharmaceutical Bottles',
    image: 'arch-round-bottle.svg',
    illustrative: true,
    material: 'HDPE',
    weight: '8.60 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '40 ml Tablet Container',
    category: 'Pharmaceutical Bottles',
    image: 'arch-tablet-jar.svg',
    illustrative: true,
    material: 'HDPE',
    weight: '10.00 gm'
  },
  {
    name: '30 ml DSB Round Bottle - 28 mm Neck (Half Mark)',
    category: 'Pharmaceutical Bottles',
    image: 'arch-round-bottle.svg',
    illustrative: true,
    material: 'HDPE',
    weight: '8.60 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '60 ml DSB Round Bottle - 28 mm Neck (30 and 15 ml Marks)',
    category: 'Pharmaceutical Bottles',
    image: 'arch-round-bottle.svg',
    illustrative: true,
    material: 'HDPE',
    weight: '14.00 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '150 ml DSB Conical Bottle - CRC Neck (Without Marking)',
    category: 'Pharmaceutical Bottles',
    image: 'arch-conical-bottle.svg',
    illustrative: true,
    material: 'HDPE',
    weight: '22.50 gm',
    keywords: 'child resistant closure dry syrup bottle'
  },
  {
    name: '500 ml Hand Wash Bottle',
    category: 'Pharmaceutical Bottles',
    image: '500-ml-hand-wash-bottle.jpg',
    material: 'HDPE',
    weight: '48.00 gm'
  },
  {
    name: '500 ml Round Bottle',
    category: 'Pharmaceutical Bottles',
    image: '500-ml-round-bottle.jpg',
    material: 'HDPE',
    weight: '50.00 gm'
  },
  {
    name: '500 ml Square Bottle',
    category: 'Pharmaceutical Bottles',
    image: '500-ml-square-bottle.jpg',
    material: 'HDPE',
    weight: '60.00 gm'
  },
  {
    name: '300 ml HDPE Round Bottle',
    category: 'Pharmaceutical Bottles',
    image: '300-ml-hdpe-round-bottle.jpg',
    material: 'HDPE',
    weight: '27.00 gm'
  },
  {
    name: '150 ml DSB Conical Bottle (Without Marking)',
    category: 'Pharmaceutical Bottles',
    image: 'arch-conical-bottle.svg',
    illustrative: true,
    material: 'HDPE',
    weight: '22.50 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '100 ml DSB Conical Bottle (Full Marking)',
    category: 'Pharmaceutical Bottles',
    image: 'arch-conical-bottle.svg',
    illustrative: true,
    material: 'HDPE',
    weight: '22.00 gm',
    keywords: 'dry syrup bottle'
  },
  {
    name: '150 ml Tablet Bottle',
    category: 'Pharmaceutical Bottles',
    image: '150-ml-tablet-bottle.jpg',
    material: 'HDPE',
    weight: '24.80 gm'
  },
  {
    name: '100 ml Tablet Bottle Set',
    category: 'Pharmaceutical Bottles',
    image: '100-ml-tablet-bottle-set.jpg',
    material: 'HDPE',
    weight: '11.00 gm'
  }
];
