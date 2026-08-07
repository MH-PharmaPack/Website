// Single place for site facts, contact endpoints, and navigation.
// Values marked [NEEDS: ...] are pending from the client. Never invent them;
// leave them empty and let the components render a clearly marked placeholder.

export const SITE_TITLE = 'MH PharmaPack';
export const SITE_DESCRIPTOR = 'Pharmaceutical Sourcing & Supply';
export const SITE_URL = 'https://mhpharmapack.com';

export const SALES_EMAIL = 'sales@mhpharmapack.com';

// E.164 format, no spaces. This is what tel: dials, so it must stay unpunctuated.
export const PHONE = '+919825012519';
// Human-readable form for display only. Never put this in a tel: or wa.me URL.
export const PHONE_DISPLAY = '+91 98250 12519';

// Digits only, country code included, no plus sign (wa.me rejects the plus).
export const WHATSAPP = '919825012519';

// The printed address, unit number included. Display only.
export const OFFICE_ADDRESS =
  'C-303, Siddhivinayak Business Towers, Makarba, Ahmedabad, Gujarat, 380051';

// What the map and the directions link geocode against. Deliberately WITHOUT
// the "C-303" unit: with it, Google resolves to the wrong building, because it
// treats the unit as part of the street match rather than as an interior
// address. Keep these two constants separate; merging them back into one
// breaks either the printed address or the pin.
//
// [PIN NOT INDEPENDENTLY VERIFIED] The building name is the client's own.
// OpenStreetMap has no "Siddhivinayak Business Towers" anywhere in Makarba.
// The only nearby match is "B Wing, Siddhivinayak Towers, NH147, Makarba,
// Sarkhej, Ahmedabad 380051" at 22.9938, 72.4986 (checked 2026-08-08).
// Google's POI coverage of Indian commercial buildings is far better than
// OSM's, so this most likely resolves correctly there, but that has not been
// confirmed. If the embed ever lands on the wrong spot, fall back to the
// OSM-known name:
//   'Siddhivinayak Towers, Makarba, Ahmedabad, Gujarat, 380051'
export const OFFICE_MAP_QUERY =
  'Siddhivinayak Business Towers, Makarba, Ahmedabad, Gujarat, 380051';

// The same address broken into vCard ADR components. A .vcf cannot take one
// flat string: it needs street, locality, region, postcode, and country as
// separate fields or phones file the contact with a blank city. Keep in step
// with OFFICE_ADDRESS above.
export const OFFICE_ADDRESS_PARTS = {
  street: 'C-303, Siddhivinayak Business Towers, Makarba',
  city: 'Ahmedabad',
  region: 'Gujarat',
  postcode: '380051',
  country: 'India',
};

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

// Maps. Both are built from OFFICE_MAP_QUERY, not OFFICE_ADDRESS: the printed
// address carries the unit number and the geocoder does not want it (see above).
// Google geocodes the query string server side, which is deliberate; hardcoding
// latitude and longitude would mean shipping coordinates as magic numbers.
const MAPS_QUERY = encodeURIComponent(OFFICE_MAP_QUERY);
// Opens the native Maps app on mobile and google.com/maps on desktop.
export const MAPS_HREF = `https://www.google.com/maps/search/?api=1&query=${MAPS_QUERY}`;
// Keyless embed endpoint. The /maps/embed?pb= form needs a Cloud API key;
// this one does not, so there is no key to leak or rotate.
export const MAP_EMBED_SRC = `https://maps.google.com/maps?q=${MAPS_QUERY}&z=16&output=embed`;
