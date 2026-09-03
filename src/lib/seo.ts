// Structured data and page metadata, in one place.
//
// Two rules govern everything in this file, and both come from outside SEO:
//
// 1. CONTENT-SPEC.md section 1. Nothing here may claim MH PharmaPack is a
//    registered entity, holds a certification, or manufactures anything. Every
//    approval belongs to a partner plant. Google documents NO required property
//    on Organization, and no rich result is gated on taxID / vatID / leiCode /
//    duns / iso6523Code / naics, so omitting all of them costs exactly nothing.
//
// 2. Google's own structured-data policy: markup must describe content that is
//    actually visible on the page. Every string emitted below is either a fact
//    already rendered in the header, footer, or body copy, or a direct
//    restatement of one. Do not add a property here without adding the fact to
//    the page.
//
// The site emits ONE <script type="application/ld+json"> per page containing a
// single @graph, with stable @id fragments so nodes reference each other by id
// instead of repeating themselves. The Organization and WebSite nodes are
// defined once, here, and every page's own node hangs off them.

import {
  SITE_TITLE,
  SITE_URL,
  SALES_EMAIL,
  PHONE,
  OFFICE_ADDRESS_PARTS,
  ORG_SAME_AS,
  withBase,
} from '../config';

/** Absolute URL for a root-relative path. Structured data, og:image, and
 *  canonical all require absolute URLs; relative ones are silently dropped. */
export function abs(path: string, site: URL | undefined = undefined): string {
  return new URL(withBase(path), site ?? SITE_URL).href;
}

// Stable graph identifiers. These are graph-local names, not fetchable URLs,
// but conventionally they are the canonical URL plus a fragment. Changing one
// breaks every reference to it, so treat them as fixed.
export const ORG_ID = `${SITE_URL}/#organization`;
export const SITE_ID = `${SITE_URL}/#website`;

/** The og:image. 1200x630 is the size every major platform crops from. */
export const OG_IMAGE = '/og-image.png';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_ALT =
  'MH PharmaPack, pharmaceutical sourcing and supply. Packaging, formulation, finished goods, and API.';

/** Google's logo requirements: crawlable, at least 112x112, a raster format
 *  Google Images supports, and legible on a plain white background. The
 *  textured brand SVG fails the last two, so a flat PNG export ships alongside
 *  it purely for this. */
export const ORG_LOGO = '/logo-512.png';

export interface Crumb {
  name: string;
  /** Root-relative path. Omit on the final crumb: Google treats a trailing
   *  ListItem without `item` as the current page, which is correct. */
  path?: string;
}

export interface GraphOptions {
  /** Canonical URL of the page the graph is being emitted on. */
  url: string;
  /** The <title> minus the brand suffix reads better here than the raw title. */
  name: string;
  description: string;
  /** ContactPage / AboutPage / CollectionPage carry no rich result, but they
   *  are the semantically correct node type and cost one word. */
  pageType?: string;
  breadcrumbs?: Crumb[];
  /** Extra nodes (Person, Service, ItemList) merged into the same graph. */
  nodes?: Record<string, unknown>[];
  /** @id of the node this page is primarily about, when that is something more
   *  specific than the organisation (a partner, on a profile page). */
  mainEntityId?: string;
  site?: URL;
}

/**
 * The Organization node. Referenced by @id from every other node on every page,
 * and emitted in full on all of them so that any single page is a complete
 * description of the entity for a crawler that only ever fetches one URL.
 */
function organization(site?: URL): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_TITLE,
    // No alternateName. The property is for a genuine second trading name or a
    // widely used acronym, and this company has neither. Stuffing the
    // descriptor in there would offer Google a 45-character string as a
    // candidate for the site name printed above the URL, which is the opposite
    // of what it is for.
    url: abs('/', site),
    logo: {
      '@type': 'ImageObject',
      '@id': `${SITE_URL}/#logo`,
      url: abs(ORG_LOGO, site),
      contentUrl: abs(ORG_LOGO, site),
      caption: SITE_TITLE,
    },
    image: abs(OG_IMAGE, site),
    // Verbatim from the footer's visible one-line description.
    description:
      'A sourcing and supply intermediary connecting pharmaceutical buyers with approved manufacturers, and coordinating each engagement end to end.',
    email: SALES_EMAIL,
    telephone: PHONE,
    address: {
      '@type': 'PostalAddress',
      streetAddress: OFFICE_ADDRESS_PARTS.street,
      addressLocality: OFFICE_ADDRESS_PARTS.city,
      addressRegion: OFFICE_ADDRESS_PARTS.region,
      postalCode: OFFICE_ADDRESS_PARTS.postcode,
      addressCountry: 'IN',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: SALES_EMAIL,
      telephone: PHONE,
      availableLanguage: ['English', 'Hindi', 'Gujarati'],
    },
    // Topic signals. Every one of these is a phrase the site actually uses
    // about itself. This is entity understanding, not a rich result.
    knowsAbout: [
      'Pharmaceutical sourcing',
      'Active pharmaceutical ingredients',
      'Pharmaceutical packaging',
      'Pharmaceutical formulation development',
      'Finished dosage forms',
      'WHO GMP and EU GMP approved manufacturing',
      'Supplier qualification and audit support',
      'Pharmaceutical dossier coordination',
    ],
    // Deliberately absent, and this is not an oversight:
    //   legalName, taxID, vatID, iso6523Code, duns, leiCode, naics
    //     -> registration is in progress. CONTENT-SPEC guardrail 1.
    //   hasCredential, award
    //     -> WHO GMP, EU GMP, ISO, PIC/S and MHRA belong to partner plants.
    //        CONTENT-SPEC guardrail 2.
    //   hasMerchantReturnPolicy, hasShippingService, makesOffer
    //     -> MH does not take title to goods. CONTENT-SPEC guardrail 5.
  };

  // sameAs is the strongest entity-resolution signal a new company has, and it
  // is the one thing here that cannot be authored: it needs real profiles that
  // already exist. Emitting an empty array would be worse than emitting
  // nothing, so the key only appears once ORG_SAME_AS has entries.
  if (ORG_SAME_AS.length > 0) node.sameAs = ORG_SAME_AS;

  return node;
}

function website(site?: URL): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: abs('/', site),
    // Google's Site Names feature reads this to decide what to print above the
    // URL in a result. Without it, it guesses from the title and often shows
    // the bare domain instead. Name only, no alternateName, for the reason in
    // the Organization node above.
    name: SITE_TITLE,
    publisher: { '@id': ORG_ID },
    inLanguage: 'en',
    // No potentialAction/SearchAction: the sitelinks searchbox was retired in
    // November 2024 and there is no site search to describe anyway.
  };
}

function breadcrumbList(crumbs: Crumb[], url: string, site?: URL) {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      // The last crumb intentionally carries no `item`.
      ...(c.path ? { item: abs(c.path, site) } : {}),
    })),
  };
}

/**
 * Assemble the page's whole graph. One script tag, one @context, every node
 * cross-referenced by @id.
 */
export function buildGraph(opts: GraphOptions): Record<string, unknown> {
  const {
    url,
    name,
    description,
    pageType = 'WebPage',
    breadcrumbs,
    nodes = [],
    mainEntityId,
    site,
  } = opts;

  const page: Record<string, unknown> = {
    '@type': pageType,
    '@id': `${url}#webpage`,
    url,
    name,
    description,
    isPartOf: { '@id': SITE_ID },
    about: { '@id': ORG_ID },
    inLanguage: 'en',
    primaryImageOfPage: { '@id': `${SITE_URL}/#logo` },
  };

  if (breadcrumbs && breadcrumbs.length > 1) {
    page.breadcrumb = { '@id': `${url}#breadcrumb` };
  }

  if (mainEntityId) page.mainEntity = { '@id': mainEntityId };

  const graph: Record<string, unknown>[] = [organization(site), website(site), page];

  if (breadcrumbs && breadcrumbs.length > 1) {
    graph.push(breadcrumbList(breadcrumbs, url, site));
  }

  graph.push(...nodes);

  return { '@context': 'https://schema.org', '@graph': graph };
}

/**
 * The five sourcing lines, as a Service with an OfferCatalog of categories.
 *
 * Deliberately NOT Product schema. Product implies MH is the seller of record
 * for each item, which is exactly the "our products" framing CONTENT-SPEC
 * guardrail 5 forbids, and it is untrue: contracts of sale run between the
 * buyer and the plant. Service with a category catalogue says what is actually
 * on offer, which is the sourcing, not the goods.
 */
export function sourcingService(
  lines: { name: string; items?: string[] }[],
  pageUrl: string,
  site?: URL,
): Record<string, unknown> {
  return {
    '@type': 'Service',
    '@id': `${pageUrl}#service`,
    name: 'Pharmaceutical sourcing and supply',
    serviceType: 'Pharmaceutical sourcing and supply intermediary',
    provider: { '@id': ORG_ID },
    description:
      'Sourcing across packaging, formulation, finished goods, and API from WHO GMP and EU GMP approved manufacturers, with the deal coordinated end to end.',
    areaServed: [
      { '@type': 'Country', name: 'India' },
      { '@type': 'Place', name: 'Latin America' },
      { '@type': 'Country', name: 'South Africa' },
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'What we source',
      itemListElement: lines.map((line) => ({
        '@type': 'OfferCatalog',
        name: line.name,
        ...(line.items && line.items.length
          ? {
              itemListElement: line.items.map((item) => ({
                '@type': 'OfferCatalog',
                name: item,
              })),
            }
          : {}),
      })),
    },
  };
}
