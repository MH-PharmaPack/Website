import type { APIRoute } from 'astro';
import { SITE_URL } from '../config';

// robots.txt as an endpoint rather than a file in public/, for one reason: the
// same codebase builds twice. CI can deploy to the github.io project subpath by
// setting BASE_PATH, and a crawlable copy of the whole site on a second domain
// is a genuine duplicate-content problem, not a theoretical one. A static file
// cannot tell the two builds apart. This can, and slams the door on the staging
// copy automatically, so nobody has to remember.
//
// In static output this runs once at build time and emits a real /robots.txt.

const STAGING = (import.meta.env.BASE_URL ?? '/') !== '/';

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL(SITE_URL);

  if (STAGING) {
    return text(
      [
        '# Staging build served from a project subpath. Not the canonical site.',
        `# The live site is ${SITE_URL}`,
        'User-agent: *',
        'Disallow: /',
        '',
      ].join('\n'),
    );
  }

  const sitemap = new URL('sitemap-index.xml', origin).href;

  const body = `# MH PharmaPack, ${SITE_URL}
# Pharmaceutical sourcing and supply intermediary, Ahmedabad, Gujarat, India.

# Everything here is public marketing content. There is nothing to protect, and
# the whole point of the site is to be found, quoted, and contacted, so every
# crawler gets the whole site.
User-agent: *
Allow: /

# Deliberately NOT blocked, and worth naming so a future edit is a decision
# rather than an accident. Answer engines are how a growing share of
# procurement research starts, and a site absent from them is invisible to it.
#
#   Live retrieval, fetches a page because a person just asked about it.
#   Blocking any of these breaks citation even for a model that already knows
#   the site exists:
#     ChatGPT-User, OAI-SearchBot   (OpenAI)
#     Claude-User, Claude-SearchBot (Anthropic)
#     PerplexityBot, Perplexity-User
#     Googlebot, bingbot, Applebot
#
#   Model training. Blocking these costs nothing in citations today, so it is
#   purely the client's call and the answer here is currently "allow":
#     GPTBot (OpenAI), ClaudeBot (Anthropic), Google-Extended,
#     Applebot-Extended, CCBot, meta-externalagent, Amazonbot
#
# NOTE for whoever edits this next: robots.txt matching is most-specific-group
# wins. If you ever add a Disallow below, add it to THIS group. Giving a bot
# its own User-agent block makes it ignore the group above entirely, which is
# how sites accidentally exempt the exact crawler they meant to restrict.

Sitemap: ${sitemap}
`;

  return text(body);
};

function text(body: string) {
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
