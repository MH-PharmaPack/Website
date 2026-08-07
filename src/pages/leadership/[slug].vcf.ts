import type { APIRoute } from 'astro';
import { PARTNERS } from '../../data/leadership';
import { SALES_EMAIL, SITE_URL, SITE_TITLE, OFFICE_ADDRESS_PARTS } from '../../config';

// Emits /leadership/<slug>.vcf at build time, one per partner.
//
// This is the payload behind the profile page's "Save to contacts" button, and
// the reason an NFC tap is worth anything: one press and the partner is in the
// phonebook, rather than the visitor retyping a number they will get wrong.

export function getStaticPaths() {
  return PARTNERS.map((p) => ({ params: { slug: p.slug } }));
}

/**
 * Escapes a vCard text value. Commas, semicolons, and backslashes are field
 * separators in vCard, so an unescaped comma in a street address silently
 * splits it into two values and the contact imports with a mangled address.
 */
function esc(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

export const GET: APIRoute = ({ params }) => {
  const partner = PARTNERS.find((p) => p.slug === params.slug);
  if (!partner) return new Response('Not found', { status: 404 });

  // Surname last in FN, but N takes them the other way round: Family;Given.
  const [given, ...rest] = partner.name.split(' ');
  const family = rest.join(' ');

  const a = OFFICE_ADDRESS_PARTS;
  const adr = [
    '', // post office box
    '', // extended address
    esc(a.street),
    esc(a.city),
    esc(a.region),
    esc(a.postcode),
    esc(a.country),
  ].join(';');

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(family)};${esc(given)};;;`,
    `FN:${esc(partner.name)}`,
    `ORG:${esc(SITE_TITLE)}`,
    `TITLE:${esc(partner.title)}`,
    `TEL;TYPE=CELL,VOICE:${partner.phone}`,
    `EMAIL;TYPE=INTERNET,WORK:${SALES_EMAIL}`,
    `ADR;TYPE=WORK:${adr}`,
    `URL:${SITE_URL}/leadership/${partner.slug}`,
    ...(partner.linkedin ? [`X-SOCIALPROFILE;TYPE=linkedin:${partner.linkedin}`] : []),
    'END:VCARD',
  ];

  // vCard requires CRLF line endings (RFC 6350 section 3.2). Some Android
  // importers are forgiving about LF; iOS is not, and silently fails.
  const body = lines.join('\r\n') + '\r\n';

  return new Response(body, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      // Without the filename the download lands as an extensionless blob that
      // the OS will not hand to the contacts app.
      'Content-Disposition': `attachment; filename="${partner.slug}.vcf"`,
    },
  });
};
