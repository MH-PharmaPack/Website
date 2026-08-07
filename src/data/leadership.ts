// The two partners.
//
// SOURCE OF TRUTH WARNING: the printed visiting cards are generated from
// ../../../visiting-card/card-data.json, which lives outside this Astro project
// and cannot be imported across the package boundary. Names, titles, and mobile
// numbers are therefore duplicated here by hand. If a number or title changes,
// change it in BOTH places or the printed card and the NFC profile will
// disagree, which is exactly the failure this page exists to avoid.
//
// CONTENT-SPEC section 9: two profiles, deliberately not padded. Direct phone
// per person; everything else routes to the shared sales@ address.

export interface Partner {
  /** URL segment. This is encoded into physical NFC cards and can NEVER change. */
  slug: string;
  name: string;
  /** Fallback portrait until a headshot exists. */
  initials: string;
  title: string;
  /** E.164, unpunctuated. Dialled by tel: and used to build the wa.me link. */
  phone: string;
  /** Display only. Never put this in a tel: or wa.me URL. */
  phoneDisplay: string;
  /** Digits only, no plus sign; wa.me rejects the plus. */
  whatsapp: string;
  /** One line for the index page. */
  lead: string;
  /** Full bio. Empty renders a clearly marked placeholder rather than nothing. */
  bio: string;
  /** [NEEDS: per person, optional] */
  linkedin: string;
  /** [NEEDS: the two headshots] Path under public/ once they arrive. */
  photo: string;
}

export const PARTNERS: Partner[] = [
  {
    slug: 'mittal-shah',
    name: 'Mittal Shah',
    initials: 'MS',
    title: 'Partner',
    phone: '+919825012519',
    phoneDisplay: '+91 98250 12519',
    whatsapp: '919825012519',
    lead: 'Sourcing across API, packaging, and finished goods.',
    // [NEEDS: bio] Years in the trade, prior companies, what they personally
    // do in the business, languages spoken.
    bio: '',
    linkedin: 'https://www.linkedin.com/in/mittal-shah-a05836b2/',
    photo: '',
  },
  {
    slug: 'himanshu-shah',
    name: 'Himanshu Shah',
    initials: 'HS',
    title: 'Partner',
    phone: '+918169155801',
    phoneDisplay: '+91 81691 55801',
    whatsapp: '918169155801',
    lead: 'Manufacturer relationships and deal coordination.',
    // [NEEDS: bio]
    bio: '',
    linkedin: '',
    photo: '',
  },
];

export function getPartner(slug: string): Partner | undefined {
  return PARTNERS.find((p) => p.slug === slug);
}

/** Prefilled WhatsApp link for a specific partner. */
export function partnerWhatsApp(p: Partner): string {
  const text = encodeURIComponent(`Hello ${p.name.split(' ')[0]}, I have a sourcing enquiry.`);
  return `https://wa.me/${p.whatsapp}?text=${text}`;
}
