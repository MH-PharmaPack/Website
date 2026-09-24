// Product analytics: PostHog, loaded late and consent-aware.
//
// What a visitor gets depends on their answer to the consent banner
// (src/components/ConsentBanner.astro):
//   - no answer yet, or "No thanks": counted without cookies. PostHog's
//     cookieless mode keeps nothing in the browser; its servers derive a
//     one-way daily hash from IP, browser and a salt deleted each day. No
//     recordings, and PostHog adds no country (the IP is dropped first), so
//     the page adds the market from the browser's time zone instead.
//   - "Allow": normal PostHog. Cookies, session recordings (form fields are
//     masked; blocks marked ph-no-capture are not recorded at all), GeoIP.
// This is cookieless_mode 'on_reject' with opt_out_capturing_by_default:
// with that pair, a visitor who never answers is treated as having declined
// and is still counted, instead of being dropped until they answer (checked
// in posthog-js: isRejected() is true for pending consent when
// opt_out_capturing_by_default is set).
//
// Performance: nothing heavy loads with the page. posthog-js and the time
// zone table are fetched after the load event, when the browser is idle, so
// the first paint and PageSpeed are untouched. Events raised before then
// (a click on WhatsApp in the first second) wait in a small queue.
//
// Off switches: no POSTHOG_KEY in src/config.ts means nothing at all runs.
// Opening any page with ?analytics=off stops analytics in that browser for
// good (for the team's own devices, so their visits do not swamp a small
// site's numbers); ?analytics=on undoes it. Outside mhpharmapack.com it
// stays off unless ?analytics=test.
//
// Every event name and property is listed in the privacy page's terms: page
// views and clicks, searches typed into the catalogue, the enquiry actions.
// Nothing typed into the quote form's fields is ever sent.

import { POSTHOG_KEY, POSTHOG_HOST } from '../config';
import type { PostHog } from 'posthog-js';

type Props = Record<string, unknown>;

const queue: [string, Props][] = [];
let ph: PostHog | null = null;
let off = false;
let started = false;

/** Record an event. Safe to call at any time, from any script: before
 *  PostHog has loaded it is queued, and when analytics are off it is a no-op. */
export function track(event: string, props: Props = {}): void {
  if (off) return;
  if (ph) ph.capture(event, props);
  else if (queue.length < 200) queue.push([event, props]);
}

export type Consent = 'granted' | 'denied' | 'pending';

/** The visitor's answer so far, once PostHog has loaded; null before. */
export function consentStatus(): Consent | null {
  return ph ? (ph.get_explicit_consent_status() as Consent) : null;
}

/** Record the visitor's answer from the banner. */
export function setConsent(granted: boolean): void {
  if (!ph) return;
  if (granted) ph.opt_in_capturing();
  else ph.opt_out_capturing();
  track('consent_answered', { granted });
}

// ---- Switches ----------------------------------------------------------

const OFF_KEY = 'mh-analytics-off';
// Read when this module is first evaluated, which is before any page script
// that imports it runs, so a page that tidies its own address later cannot
// swallow the switch.
const FLAG = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('analytics');

function switchedOff(): boolean {
  const flag = FLAG;
  let stored = false;
  try {
    if (flag === 'off') localStorage.setItem(OFF_KEY, '1');
    if (flag === 'on') localStorage.removeItem(OFF_KEY);
    stored = localStorage.getItem(OFF_KEY) === '1';
  } catch {
    stored = flag === 'off';
  }
  if (stored) return true;
  const live = /(^|\.)mhpharmapack\.com$/.test(location.hostname);
  return !live && flag !== 'test';
}

// ---- Page context --------------------------------------------------------

/** What kind of page this is, and on an item page which item, sent with
 *  every event so any insight can be broken down by it. */
function pageContext(): Props {
  const seg = location.pathname.split('/').filter(Boolean);
  const [a] = seg;
  const deep = seg.length > 1;
  const page_type = !a
    ? 'home'
    : a === 'catalogue'
      ? deep ? 'catalogue_item' : 'catalogue'
      : a === 'capabilities'
        ? deep ? 'line_page' : 'what_we_source'
        : a === 'services'
          ? 'what_we_do'
          : a === 'contact'
            ? 'quote_form'
            : a === 'leadership'
              ? deep ? 'partner_profile' : 'leadership'
              : a === 'privacy'
                ? 'privacy'
                : 'other';
  const ctx: Props = { page_type };
  if (page_type === 'catalogue_item') {
    // The item page's own "Add to enquiry list" button carries its facts.
    const b = document.querySelector<HTMLElement>('#enquire [data-enq-add]');
    if (b) {
      ctx.item = b.dataset.enqSlug;
      ctx.item_line = b.dataset.enqLine;
      ctx.item_category = b.dataset.enqCategory;
    }
  }
  if (page_type === 'line_page') ctx.line_page = seg[1];
  return ctx;
}

/** The market a visitor browses from, from their browser's time zone
 *  ("Africa/Lagos" -> Nigeria). A time zone names a country, not a person. */
function marketContext(tzCountry: Record<string, string>): Props {
  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    /* very old browser */
  }
  const code = tzCountry[tz];
  let country: string | undefined;
  if (code) {
    try {
      country = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
    } catch {
      country = code;
    }
  }
  return {
    visitor_timezone: tz || undefined,
    visitor_region: tz.includes('/') ? tz.split('/')[0] : undefined,
    visitor_country_code: code,
    visitor_country: country,
    visitor_language: navigator.language,
  };
}

// ---- Clicks tracked site-wide -------------------------------------------

/** Where on the page a click happened. */
function placeOf(el: Element): string {
  const marked = el.closest<HTMLElement>('[data-track-place]')?.dataset.trackPlace;
  if (marked) return marked;
  if (el.closest('[data-quick-actions]')) return 'sticky_bar';
  if (el.closest('header')) return 'header';
  if (el.closest('footer')) return 'footer';
  if (el.closest('dialog')) return 'dialog';
  return 'page';
}

function onClick(e: MouseEvent): void {
  const el = (e.target as Element | null)?.closest?.('a[href], button');
  if (!el) return;
  const href = el.getAttribute('href') ?? '';
  const place = placeOf(el);

  // A search suggestion (hero search, desktop dropdown or phone sheet).
  if (el.matches('[role="option"][href]')) {
    const input = document.querySelector<HTMLInputElement>('input[aria-controls="ss-drop-list"]');
    track('search_suggestion_clicked', {
      query: (input?.value ?? '').trim().slice(0, 80),
      suggestion: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
      kind: /\/catalogue\/[^/?#]+\/?$/.test(new URL(href, location.href).pathname) ? 'item' : 'category',
    });
    return;
  }

  // The enquiry list's own buttons are tracked by the enquiry list; do not
  // count its WhatsApp and email links a second time below.
  if (el.closest('[data-enq-dialog]') && el.matches('[data-enq-mail], [data-enq-wa], [data-enq-rfq]')) return;

  if (href.startsWith('https://wa.me/')) track('contact_clicked', { channel: 'whatsapp', place });
  else if (href.startsWith('tel:')) track('contact_clicked', { channel: 'call', place });
  else if (href.startsWith('mailto:')) {
    const channel = /subject=RFQ/i.test(href) ? 'spec_email' : /subject=Enquiry%3A/i.test(href) ? 'item_email' : 'email';
    track('contact_clicked', { channel, place });
  } else if (href.endsWith('.vcf')) {
    track('contact_saved', { partner: href.split('/').pop()?.replace(/\.vcf$/, '') });
  } else if (href) {
    const url = new URL(href, location.href);
    if (url.origin === location.origin && /^\/contact\/?$/.test(url.pathname)) {
      track('quote_cta_clicked', { place, with_items: url.searchParams.has('items') || url.searchParams.has('item') });
    }
  }
}

// ---- Start ----------------------------------------------------------------

/** Called once per page from src/layouts/Base.astro. */
export function startAnalytics(): void {
  if (started) return;
  started = true;
  if (!POSTHOG_KEY || switchedOff()) {
    off = true;
    queue.length = 0;
    return;
  }
  document.addEventListener('click', onClick, { capture: true });

  const boot = async () => {
    const [{ default: posthog }, { default: tzCountry }] = await Promise.all([
      import('posthog-js'),
      import('../data/tz-country.json'),
    ]);
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      defaults: '2026-08-30',
      cookieless_mode: 'on_reject',
      opt_out_capturing_by_default: true,
      // Sent below, once the page context is registered, so the first
      // pageview carries it too.
      capture_pageview: false,
      capture_pageleave: true,
      enable_heatmaps: true,
      capture_dead_clicks: true,
      capture_performance: { web_vitals: true },
      disable_surveys: true,
      // Recording only ever runs after "Allow", and never shows what is
      // typed: every input is masked, and blocks carrying ph-no-capture (the
      // quote form's summary, which repeats the buyer's details) are left
      // out of the recording entirely.
      session_recording: { maskAllInputs: true, blockClass: 'ph-no-capture' },
      loaded: (instance) => {
        ph = instance;
        instance.register({ ...pageContext(), ...marketContext(tzCountry as Record<string, string>) });
        instance.capture('$pageview');
        for (const [event, props] of queue.splice(0)) instance.capture(event, props);
        dispatchEvent(new CustomEvent('mh:analytics-ready'));
      },
    });
  };

  const whenIdle = () => {
    const run = () => void boot().catch(() => (off = true));
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 4000 });
    else setTimeout(run, 1500);
  };
  if (document.readyState === 'complete') whenIdle();
  else addEventListener('load', whenIdle, { once: true });
}
