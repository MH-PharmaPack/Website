// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// Until the custom domain is wired, CI deploys to the github.io project subpath by
// setting SITE_URL and BASE_PATH (see .github/workflows/deploy.yml). Once DNS for
// mhpharmapack.com is live, remove those env vars from the workflow and the defaults
// below take over.
const site = process.env.SITE_URL ?? 'https://mhpharmapack.com';
const base = process.env.BASE_PATH ?? '/';

// https://astro.build/config
export default defineConfig({
  site,
  base,

  // ONE canonical URL shape, everywhere. GitHub Pages serves a directory-format
  // build (/leadership/index.html) and 301-redirects /leadership to /leadership/,
  // so the trailing-slash form is the one that actually resolves without a hop.
  // Astro already emits canonical/sitemap URLs with the slash; withBase() in
  // src/config.ts now adds it to internal links too, so nothing on the site
  // points at a URL that redirects. Mixed forms are the single most common way a
  // small site splits its own signals across two URLs per page.
  trailingSlash: 'always',
  build: { format: 'directory' },

  integrations: [
    sitemap({
      // The build emits more than pages. The vCard endpoints are downloads for
      // NFC taps, not documents anyone should land on from a search result, and
      // 404 is not a destination. Everything else is a real page.
      filter: (page) => !page.endsWith('.vcf') && !/\/404\/?$/.test(page),
      // No changefreq and no priority: Google ignores both (confirmed in its own
      // sitemap docs), and emitting them just adds bytes and a false impression
      // of control. lastmod is likewise omitted rather than stamped with the
      // build time, because Google only trusts lastmod it can verify against
      // real content changes and distrusts a file that redates every page on
      // every deploy.
    }),
  ],

  vite: {
    plugins: [tailwindcss()]
  }
});
