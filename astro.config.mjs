// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

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
  vite: {
    plugins: [tailwindcss()]
  }
});