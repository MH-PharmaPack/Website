// Single place for site facts, contact endpoints, and navigation.
// Values marked [NEEDS: ...] are pending from the client. Never invent them;
// leave them empty and let the components render a clearly marked placeholder.

export const SITE_TITLE = 'MH PharmaPack';
export const SITE_DESCRIPTOR = 'Pharmaceutical Sourcing & Supply';
export const SITE_URL = 'https://mhpharmapack.com';

export const SALES_EMAIL = 'sales@mhpharmapack.com';

// [NEEDS: phone number] E.164 format, e.g. +911234567890, no spaces.
export const PHONE = '';

// [NEEDS: WhatsApp business number] digits only, country code included, no plus sign.
export const WHATSAPP = '';

// [NEEDS: office address]
export const OFFICE_ADDRESS = '';

// RFQ form backend endpoint (Web3Forms or equivalent). Wired in a later pass;
// keep the key here so swapping providers is a one-line change.
export const FORM_ENDPOINT = '';

// Prefixes a root-relative path with Astro's configured base. Needed while the site
// serves from the github.io project subpath; a no-op once the custom domain (base '/')
// is live. Use for every internal link and every public/ asset reference.
export function withBase(path: string): string {
  return import.meta.env.BASE_URL.replace(/\/$/, '') + path;
}

export const NAV = [
  { label: 'Home', href: withBase('/') },
  { label: 'What We Do', href: withBase('/services') },
  { label: 'What We Source', href: withBase('/capabilities') },
  { label: 'Leadership', href: withBase('/leadership') },
  { label: 'Contact', href: withBase('/contact') },
];

// Contact affordance hrefs. While a number is pending these resolve to '#'
// so the layout is final and the real value drops in via the constants above.
export const TEL_HREF = PHONE ? `tel:${PHONE}` : '#';
export const WHATSAPP_HREF = WHATSAPP
  ? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hello MH PharmaPack, I have a sourcing enquiry.')}`
  : '#';
export const MAILTO_HREF = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent('Enquiry via mhpharmapack.com')}`;
