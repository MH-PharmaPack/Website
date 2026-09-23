// The quote form on /contact (CONTENT-SPEC 7.3, CLAUDE.md contact wiring).
//
// Arriving: the form opens with whatever the visitor brought with them.
//   ?items=a,b   the enquiry list (quantities, market and timeline included)
//   ?item=a      one catalogue item, asked about on its own
//   ?q=text      a search that found nothing, as the product
//   ?line=api    a line, ticked
// Items are named from the enquiry list when it holds them, else from
// /search-index.json (a link opened on another device). Once applied, the
// query is dropped from the address so a reload does not undo later edits.
//
// Draft: everything typed is kept in this browser (localStorage, 30 days)
// until the enquiry is sent, so going back or reloading loses nothing.
//
// Sending:
//   FORM_ENDPOINT set    POST to the backend (tools/rfq-backend), which emails
//                        the sales desk and sends the buyer a confirmation;
//                        success replaces the form with a summary
//   FORM_ENDPOINT empty  opens the buyer's email app with the same enquiry
//                        written out, addressed to the sales desk
// If a send fails, the same enquiry is one tap away by email, and nothing
// typed is lost.

import { load as loadList, clear as clearList, qtyText, type EnquiryItem } from './enquiry-list';
import { numericOnly, formatQuantity, isQuantity } from './numeric';
import { toText, mailtoFor, GAP, type Pair } from './rfq-message';
import { initChipField } from './chip-field';
import { REGULATORY, CUSTOM_ICON } from '../data/regulatory';
import { COUNTRY_GROUPS } from '../data/countries';
import { UNITS, DEFAULT_UNIT, LINE_HINTS } from '../data/rfq';
import { withBase } from '../config';

type LineId = keyof typeof DEFAULT_UNIT;
type Item = EnquiryItem;

const DRAFT_KEY = 'mh-rfq-draft';
const DRAFT_DAYS = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Draft {
  v: 1;
  t: number;
  f: Record<string, string>;
  lines: string[];
  timeline: string;
  reg: string[];
  market?: string[];
  items: Item[];
  fromList: boolean;
  unitTouched: boolean;
}

class SendError extends Error {}

export function initRfqForm(form: HTMLFormElement): void {
  const q = <T extends Element>(sel: string, root: ParentNode = form) => root.querySelector<T>(sel);
  const page = form.closest<HTMLElement>('[data-rfq-page]') ?? document.body;

  const endpoint = form.dataset.endpoint ?? '';
  const sitekey = form.dataset.sitekey ?? '';

  // ---- Fields ----------------------------------------------------------------
  const text = {
    product: q<HTMLInputElement>('#rfq-product')!,
    quantity: q<HTMLInputElement>('#rfq-qty')!,
    name: q<HTMLInputElement>('#rfq-name')!,
    company: q<HTMLInputElement>('#rfq-company')!,
    email: q<HTMLInputElement>('#rfq-email')!,
    phone: q<HTMLInputElement>('#rfq-phone')!,
    spec: q<HTMLTextAreaElement>('#rfq-spec')!,
    notes: q<HTMLTextAreaElement>('#rfq-notes')!,
  };
  const unit = q<HTMLSelectElement>('#rfq-unit')!;
  const consent = q<HTMLInputElement>('#rfq-consent')!;
  const hp = q<HTMLInputElement>('[data-rfq-hp]')!;
  const lineBoxes = [...form.querySelectorAll<HTMLInputElement>('input[name="line"]')];
  const timelineRadios = [...form.querySelectorAll<HTMLInputElement>('input[name="timeline"]')];
  const reg = initChipField(q<HTMLElement>('[data-cf="regulatory"]')!, { groups: REGULATORY, customIcon: CUSTOM_ICON });
  // Markets must come from the list (client, 2026-09-23).
  const market = initChipField(q<HTMLElement>('[data-cf="country"]')!, {
    groups: COUNTRY_GROUPS,
    strict: true,
    strictMessage: 'Choose a country from the list, or clear what you typed.',
  });
  const listMarkets = (s: string) => s.split(/\s*;\s*/).filter(Boolean);

  const itemsWrap = q<HTMLElement>('[data-rfq-items-wrap]')!;
  const itemsList = q<HTMLUListElement>('[data-rfq-items]')!;
  const qtyWrap = q<HTMLElement>('[data-rfq-qty-wrap]')!;
  const productLabel = q<HTMLElement>('[data-product-label]')!;
  const productOpt = q<HTMLElement>('[data-product-opt]')!;
  const listPrompt = q<HTMLElement>('[data-rfq-listprompt]')!;
  const submitBtn = q<HTMLButtonElement>('[data-rfq-submit]')!;
  const errorBox = q<HTMLElement>('[data-rfq-error]')!;
  const handoffBox = q<HTMLElement>('[data-rfq-handoff]')!;
  const captchaEl = q<HTMLElement>('[data-rfq-captcha]')!;
  const resetBtn = q<HTMLButtonElement>('[data-rfq-reset]')!;

  const done = q<HTMLElement>('[data-rfq-done]', page)!;
  const formCard = q<HTMLElement>('[data-rfq-card]', page)!;

  numericOnly(text.quantity, 'quantity');
  numericOnly(text.phone, 'phone');

  let items: Item[] = [];
  let fromList = false;
  let unitTouched = false;
  let attempted = false;

  const lineIdOfName = (name: string) => lineBoxes.find((b) => b.dataset.name === name)?.value as LineId | undefined;
  const chosenLines = () => lineBoxes.filter((b) => b.checked);
  const chosenTimeline = () => timelineRadios.find((r) => r.checked)?.value ?? '';

  // ---- Line-aware hints and units ---------------------------------------------
  function applyLineHints() {
    const ids = chosenLines().map((b) => b.value as LineId);
    const hints = LINE_HINTS[ids.length === 1 ? ids[0] : 'none'];
    text.product.placeholder = items.length ? 'Anything not in the list above' : hints.product;
    text.spec.placeholder = hints.spec;
    if (!unitTouched) unit.value = ids.length ? DEFAULT_UNIT[ids[0]] : 'pieces';
  }
  unit.addEventListener('change', () => (unitTouched = true));

  // ---- Items -------------------------------------------------------------------
  const svg = (d: string) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="${d}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  function renderItems() {
    itemsWrap.hidden = items.length === 0;
    qtyWrap.hidden = items.length > 0;
    productLabel.textContent = items.length ? 'Anything else to source?' : 'Product / molecule / item';
    productOpt.hidden = items.length === 0;
    itemsList.replaceChildren(
      ...items.map((it) => {
        const li = document.createElement('li');
        li.className = 'rfq-item';
        li.dataset.slug = it.slug;
        const th = document.createElement(it.thumb ? 'img' : 'span');
        th.className = 'rfq-item-th';
        if (th instanceof HTMLImageElement) {
          th.src = it.thumb;
          th.alt = '';
          th.loading = 'lazy';
          th.addEventListener('error', () => (th.style.visibility = 'hidden'));
        }
        const name = document.createElement('div');
        name.className = 'rfq-item-name';
        const a = document.createElement('a');
        a.href = it.url || '#';
        a.textContent = it.name;
        const cat = document.createElement('span');
        cat.textContent = [it.category, it.detail].filter(Boolean).join(' · ');
        name.append(a, cat);

        const qw = document.createElement('div');
        qw.className = 'rfq-item-q';
        const qty = document.createElement('input');
        qty.type = 'text';
        qty.className = 'rfq-input';
        qty.placeholder = 'Quantity';
        qty.value = formatQuantity(it.qty);
        qty.setAttribute('aria-label', `Quantity for ${it.name}`);
        numericOnly(qty, 'quantity');
        const u = document.createElement('select');
        u.className = 'rfq-input rfq-unit';
        u.setAttribute('aria-label', `Unit for ${it.name}`);
        for (const x of UNITS) u.add(new Option(x, x));
        u.value = it.unit || 'pieces';
        qty.addEventListener('input', () => {
          it.qty = qty.value.trim();
          if (attempted) validateItem(li, it);
          saveDraft();
        });
        u.addEventListener('change', () => {
          it.unit = u.value;
          saveDraft();
        });
        qw.append(qty, u);

        const err = document.createElement('p');
        err.className = 'rfq-err rfq-item-err';
        err.id = `rfq-item-err-${it.slug}`;
        err.hidden = true;

        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'rfq-item-rm';
        rm.setAttribute('aria-label', `Remove ${it.name} from this enquiry`);
        rm.innerHTML = svg('M6 6l12 12M18 6 6 18');
        rm.addEventListener('click', () => {
          items = items.filter((x) => x.slug !== it.slug);
          renderItems();
          applyLineHints();
          saveDraft();
          (itemsList.querySelector<HTMLInputElement>('.rfq-input') ?? text.product).focus();
        });

        li.append(th, name, rm, qw, err);
        return li;
      }),
    );
    updateListPrompt();
  }

  function setItems(next: Item[], viaList: boolean) {
    items = next;
    fromList = viaList;
    // The items' lines are ticked for the buyer; they can still change them.
    for (const it of items) {
      const id = lineIdOfName(it.line);
      const box = lineBoxes.find((b) => b.value === id);
      if (box) box.checked = true;
    }
    renderItems();
    applyLineHints();
  }

  // "You have 3 items in your enquiry list": offered, never added unasked.
  function updateListPrompt() {
    const list = loadList();
    const n = list.items.length;
    listPrompt.hidden = n === 0 || items.length > 0;
    const count = q<HTMLElement>('[data-rfq-listcount]');
    if (count) count.textContent = `${n} item${n === 1 ? '' : 's'}`;
  }
  q<HTMLButtonElement>('[data-rfq-uselist]')?.addEventListener('click', () => {
    const list = loadList();
    setItems(list.items.map((i) => ({ ...i })), true);
    if (!market.get().length && list.market) market.set(listMarkets(list.market));
    if (!chosenTimeline() && list.timeline) setTimeline(list.timeline);
    saveDraft();
    itemsList.querySelector<HTMLInputElement>('.rfq-input')?.focus();
  });

  function setTimeline(v: string) {
    for (const r of timelineRadios) r.checked = r.value === v;
  }

  // ---- Draft ---------------------------------------------------------------------
  let saveTimer = 0;
  function saveDraft() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      const d: Draft = {
        v: 1,
        t: Date.now(),
        f: Object.fromEntries(Object.entries(text).map(([k, el]) => [k, el.value])),
        lines: chosenLines().map((b) => b.value),
        timeline: chosenTimeline(),
        reg: reg.get(),
        market: market.get(),
        items,
        fromList,
        unitTouched,
      };
      d.f.unit = unit.value;
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
      } catch {
        /* no storage: the form still works, it just forgets on reload */
      }
    }, 300);
  }
  function loadDraft(): Draft | null {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null;
      if (!d || d.v !== 1 || Date.now() - d.t > DRAFT_DAYS * 864e5) return null;
      return d;
    } catch {
      return null;
    }
  }
  function clearDraft() {
    window.clearTimeout(saveTimer);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* nothing stored */
    }
  }
  function applyDraft(d: Draft) {
    for (const [k, el] of Object.entries(text)) {
      const v = d.f?.[k];
      if (typeof v === 'string') el.value = v;
    }
    unitTouched = !!d.unitTouched;
    if (typeof d.f?.unit === 'string' && (UNITS as readonly string[]).includes(d.f.unit)) unit.value = d.f.unit;
    for (const b of lineBoxes) b.checked = Array.isArray(d.lines) && d.lines.includes(b.value);
    setTimeline(typeof d.timeline === 'string' ? d.timeline : '');
    reg.set(Array.isArray(d.reg) ? d.reg.filter((x) => typeof x === 'string') : []);
    // Drafts from before the market became a list held it as free text; the
    // field keeps only what matches the list.
    const oldMarket = typeof d.f?.market === 'string' ? listMarkets(d.f.market) : [];
    market.set(Array.isArray(d.market) ? d.market.filter((x) => typeof x === 'string') : oldMarket);
    const good = Array.isArray(d.items)
      ? d.items.filter((i) => i && typeof i.slug === 'string' && typeof i.name === 'string')
      : [];
    items = good.map((i) => ({
      slug: i.slug,
      name: i.name,
      category: String(i.category ?? ''),
      line: String(i.line ?? ''),
      detail: String(i.detail ?? ''),
      url: String(i.url ?? ''),
      thumb: String(i.thumb ?? ''),
      qty: String(i.qty ?? ''),
      unit: String(i.unit ?? ''),
    }));
    fromList = !!d.fromList;
  }
  form.addEventListener('input', saveDraft);
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLInputElement && t.name === 'line') applyLineHints();
    saveDraft();
  });

  // ---- Arriving: apply the query -------------------------------------------------------
  async function resolveSlugs(slugs: string[]): Promise<Item[]> {
    const list = loadList();
    const found = new Map(list.items.map((i) => [i.slug, i]));
    const missing = slugs.filter((s) => !found.has(s));
    if (missing.length) {
      try {
        const idx = (await (await fetch(withBase('/search-index.json'))).json()) as {
          items: { k: string; l: string; n: string; h: string; c: string; d: string; t: string }[];
        };
        for (const it of idx.items) {
          if (!missing.includes(it.k)) continue;
          found.set(it.k, {
            slug: it.k,
            name: it.n,
            category: it.c.replace(/ · /g, ' / '),
            line: it.l,
            detail: it.d.replace(/ · /g, ', '),
            url: new URL(it.h, location.origin).href,
            thumb: it.t,
            qty: '',
            unit: '',
          });
        }
      } catch {
        /* offline or blocked: unknown slugs are simply left out */
      }
    }
    return slugs.flatMap((s) => (found.has(s) ? [{ ...found.get(s)! }] : []));
  }

  async function arrive() {
    const draft = loadDraft();
    if (draft) applyDraft(draft);

    const params = new URLSearchParams(location.search);
    const many = params.get('items');
    const one = params.get('item');
    const search = params.get('q');
    const line = params.get('line');

    if (line) {
      const box = lineBoxes.find((b) => b.value === line);
      if (box) box.checked = true;
    }
    if (search) text.product.value = search.slice(0, 200);
    if (many || one) {
      const slugs = (many ?? one ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 60);
      const resolved = await resolveSlugs(slugs);
      if (resolved.length) setItems(resolved, !!many);
      if (many) {
        const list = loadList();
        if (!market.get().length && list.market) market.set(listMarkets(list.market));
        if (!chosenTimeline() && list.timeline) setTimeline(list.timeline);
      }
    }
    if (many || one || search || line) {
      history.replaceState(history.state, '', location.pathname + location.hash);
      saveDraft();
    }
    renderItems();
    applyLineHints();
  }

  // ---- Validation ------------------------------------------------------------------
  function setErr(wrap: HTMLElement, msg: string | null) {
    const err = wrap.querySelector<HTMLElement>('.rfq-err, .cf-msg');
    const controls = [...wrap.querySelectorAll<HTMLElement>('input:not([type="hidden"]), textarea')];
    wrap.classList.toggle('has-err', !!msg);
    if (err) {
      err.hidden = !msg;
      err.textContent = msg ?? '';
    }
    for (const c of controls) {
      if (msg) {
        c.setAttribute('aria-invalid', 'true');
        if (err) c.setAttribute('aria-describedby', [c.dataset.describedby, err.id].filter(Boolean).join(' '));
      } else {
        c.removeAttribute('aria-invalid');
        if (c.dataset.describedby) c.setAttribute('aria-describedby', c.dataset.describedby);
        else c.removeAttribute('aria-describedby');
      }
    }
  }
  const wrapOf = (key: string) => q<HTMLElement>(`[data-f="${key}"]`)!;

  function validateItem(li: HTMLElement, it: Item): boolean {
    const ok = isQuantity(it.qty);
    const err = li.querySelector<HTMLElement>('.rfq-item-err');
    const input = li.querySelector<HTMLInputElement>('.rfq-input');
    li.classList.toggle('has-err', !ok);
    if (err) {
      err.hidden = ok;
      err.textContent = ok ? '' : 'Add a quantity, in numbers.';
    }
    if (input) {
      if (ok) {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
      } else {
        input.setAttribute('aria-invalid', 'true');
        if (err) input.setAttribute('aria-describedby', err.id);
      }
    }
    return ok;
  }

  /** Marks every problem and returns the first control to fix, or null. */
  function validate(): HTMLElement | null {
    const found: { first: HTMLElement | null } = { first: null };
    const check = (key: string, msg: string | null, focusEl: HTMLElement) => {
      setErr(wrapOf(key), msg);
      if (msg && !found.first) found.first = focusEl;
    };
    check('lines', chosenLines().length ? null : 'Choose at least one line.', lineBoxes[0]);
    if (items.length) {
      for (const li of itemsList.querySelectorAll<HTMLElement>('.rfq-item')) {
        const it = items.find((x) => x.slug === li.dataset.slug);
        if (it && !validateItem(li, it) && !found.first) found.first = li.querySelector<HTMLInputElement>('.rfq-input');
      }
      setErr(wrapOf('product'), null);
      setErr(wrapOf('quantity'), null);
    } else {
      check('product', text.product.value.trim() ? null : 'Tell us what you need.', text.product);
      check('quantity', isQuantity(text.quantity.value) ? null : 'Add a quantity, in numbers.', text.quantity);
    }
    check('name', text.name.value.trim() ? null : 'Add your name.', text.name);
    check('company', text.company.value.trim() ? null : 'Add your company.', text.company);
    const email = text.email.value.trim();
    check(
      'email',
      !email
        ? 'Add an email address we can reply to.'
        : EMAIL_RE.test(email)
          ? null
          : 'Check the email address, for example name@company.com.',
      text.email,
    );
    const digits = text.phone.value.replace(/\D/g, '').length;
    check('phone', !text.phone.value.trim() || digits >= 7 ? null : 'Check the number, with the country code.', text.phone);
    // Optional, but whatever is in it must come from the list. Not flagged
    // while the buyer is still typing in it.
    const marketInput = q<HTMLInputElement>('#rfq-market')!;
    check(
      'market',
      market.pending() && document.activeElement !== marketInput
        ? 'Choose a country from the list, or clear what you typed.'
        : null,
      marketInput,
    );
    check('consent', consent.checked ? null : 'Please tick this so we can contact you about the enquiry.', consent);
    return found.first;
  }
  form.addEventListener('input', () => attempted && validate());
  form.addEventListener('change', () => attempted && validate());

  // ---- The message -----------------------------------------------------------------
  function pairs(source: string): Pair[] {
    const v = (el: HTMLInputElement | HTMLTextAreaElement) => el.value.trim();
    const out: Pair[] = [
      ['Source', source],
      ['Line of interest', chosenLines().map((b) => b.dataset.name).join(', ')],
    ];
    if (items.length) {
      if (v(text.product)) out.push(['Product / molecule / item', v(text.product)]);
      out.push(['Items requested', String(items.length)], GAP);
      items.forEach((it, n) => {
        const k = `Item ${n + 1}`;
        out.push([k, it.name], [`${k} category`, it.category]);
        if (it.detail) out.push([`${k} detail`, it.detail]);
        out.push([`${k} quantity`, qtyText({ qty: formatQuantity(it.qty), unit: it.unit })]);
        if (it.url) out.push([`${k} page`, it.url]);
        out.push(GAP);
      });
    } else {
      out.push(
        ['Product / molecule / item', v(text.product)],
        ['Quantity / volume', `${formatQuantity(v(text.quantity))} ${unit.value}`],
        GAP,
      );
    }
    const optional: Pair[] = [
      ['Specification details', v(text.spec)],
      ['Destination market / country', market.get().join('; ')],
      ['Required timeline', chosenTimeline()],
      ['Regulatory requirement', reg.get().join('; ')],
      ['Anything else', v(text.notes)],
    ];
    const filled = optional.filter(([, x]) => x);
    if (filled.length) out.push(...filled, GAP);
    out.push(['Name', v(text.name)], ['Company', v(text.company)], ['Email', v(text.email)]);
    if (v(text.phone)) out.push(['Phone / WhatsApp', v(text.phone)]);
    out.push(['Consent to contact', 'Yes']);
    return out;
  }
  const subject = () => `RFQ: ${text.company.value.trim()}`;

  // ---- Spam check (Cloudflare Turnstile) --------------------------------------------
  // Loaded on the first touch of the form, never with the page, and run only
  // when Send is pressed: most people never see it at all.
  type TS = {
    render: (el: HTMLElement, o: Record<string, unknown>) => string;
    execute: (el: HTMLElement) => void;
    reset: (id?: string) => void;
  };
  let tsLoad: Promise<TS> | null = null;
  let widgetId: string | undefined;
  let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null;
  const loadTurnstile = () =>
    (tsLoad ??= new Promise<TS>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => resolve((window as unknown as { turnstile: TS }).turnstile);
      s.onerror = () => {
        tsLoad = null;
        reject(new SendError('captcha'));
      };
      document.head.append(s);
    }));
  if (sitekey) form.addEventListener('focusin', () => void loadTurnstile().catch(() => {}), { once: true });

  async function captchaToken(): Promise<string> {
    const ts = await loadTurnstile();
    return new Promise<string>((resolve, reject) => {
      pending = { resolve, reject };
      const settle = (fn: () => void) => {
        fn();
        pending = null;
      };
      if (widgetId === undefined) {
        widgetId = ts.render(captchaEl, {
          sitekey,
          action: 'rfq',
          execution: 'execute',
          appearance: 'interaction-only',
          theme: 'light',
          size: 'flexible',
          callback: (t: string) => pending && settle(() => pending!.resolve(t)),
          'error-callback': () => pending && settle(() => pending!.reject(new SendError('captcha'))),
          'expired-callback': () => ts.reset(widgetId),
        });
      } else ts.reset(widgetId);
      ts.execute(captchaEl);
      window.setTimeout(() => pending && settle(() => pending!.reject(new SendError('captcha'))), 90_000);
    });
  }

  // ---- Sending -------------------------------------------------------------------------
  async function post(ps: Pair[], token: string): Promise<{ confirmation: boolean }> {
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), 30_000);
    try {
      // text/plain keeps this a "simple" request: no CORS preflight, which
      // Apps Script web apps cannot answer.
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ v: 1, fields: ps.filter(([k]) => k), token, website: hp.value }),
        signal: ctl.signal,
      });
      // Google answers every POST with a redirect to its own response page,
      // issued only after the script has run. That page can briefly fail to
      // load (seen right after a deployment). The emails have gone by then,
      // so count it as sent rather than inviting a duplicate second send.
      if (!res.ok && res.url.startsWith('https://script.googleusercontent.com/')) return { confirmation: false };
      const data = (await res.json()) as { ok?: boolean; error?: string; confirmation?: boolean };
      if (!data.ok) throw new SendError(data.error || 'failed');
      return { confirmation: data.confirmation === true };
    } catch (e) {
      throw e instanceof SendError ? e : new SendError('network');
    } finally {
      window.clearTimeout(timer);
    }
  }

  const MESSAGES: Record<string, string> = {
    captcha: 'The spam check could not finish. Please try again.',
    rate: 'We have just received several enquiries from this address. Please wait a few minutes and try again.',
    invalid: 'Part of the form did not go through. Please check it and try again.',
  };
  function showError(code: string, ps: Pair[]) {
    const msg = q<HTMLElement>('[data-rfq-error-msg]', errorBox);
    if (msg) msg.textContent = MESSAGES[code] ?? 'We could not send your enquiry just now.';
    const mail = q<HTMLAnchorElement>('[data-rfq-error-mail]', errorBox);
    if (mail) mail.href = mailtoFor(subject(), withSource(ps, 'Website quote form (by email)'));
    errorBox.hidden = false;
    errorBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  const withSource = (ps: Pair[], source: string): Pair[] =>
    ps.map(([k, v]) => (k === 'Source' ? [k, source] : [k, v]));

  function busy(on: boolean) {
    submitBtn.disabled = on;
    submitBtn.setAttribute('aria-busy', String(on));
    submitBtn.textContent = on ? 'Sending…' : 'Send enquiry';
  }

  let lastPairs: Pair[] = [];
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    attempted = true;
    errorBox.hidden = true;
    handoffBox.hidden = true;
    const bad = validate();
    if (bad) {
      bad.focus({ preventScroll: true });
      bad.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const ps = pairs('Website quote form');
    lastPairs = ps;

    // Something filled the field people cannot see: a bot. Look done, send nothing.
    if (hp.value) {
      showDone(ps, false);
      return;
    }

    if (!endpoint) {
      const href = mailtoFor(subject(), withSource(ps, 'Website quote form (by email)'));
      const again = q<HTMLAnchorElement>('[data-rfq-handoff-mail]', handoffBox);
      if (again) again.href = href;
      handoffBox.hidden = false;
      window.location.href = href;
      return;
    }

    busy(true);
    try {
      const token = sitekey ? await captchaToken() : '';
      const res = await post(ps, token);
      clearDraft();
      showDone(ps, res.confirmation);
    } catch (err) {
      showError(err instanceof SendError ? err.message : 'network', ps);
      if (widgetId !== undefined) void loadTurnstile().then((ts) => ts.reset(widgetId));
    } finally {
      busy(false);
    }
  });

  // Copy buttons (in the error box and the email hand-off).
  for (const b of page.querySelectorAll<HTMLButtonElement>('[data-rfq-copy]')) {
    b.addEventListener('click', async () => {
      const label = b.textContent;
      try {
        await navigator.clipboard.writeText(toText(withSource(lastPairs, 'Website quote form (copied)')));
        b.textContent = 'Copied';
      } catch {
        b.textContent = 'Copy failed';
      }
      window.setTimeout(() => (b.textContent = label), 2200);
    });
  }

  // ---- Done ------------------------------------------------------------------------------
  const HIDDEN_IN_SUMMARY = new Set(['Source', 'Consent to contact']);
  function showDone(ps: Pair[], confirmation: boolean) {
    const dl = q<HTMLDListElement>('[data-rfq-summary]', done)!;
    dl.replaceChildren(
      ...ps
        .filter(([k]) => k && !HIDDEN_IN_SUMMARY.has(k))
        .flatMap(([k, v]) => {
          const dt = document.createElement('dt');
          dt.textContent = k;
          const dd = document.createElement('dd');
          dd.textContent = v;
          return [dt, dd];
        }),
    );
    const conf = q<HTMLElement>('[data-rfq-done-conf]', done)!;
    conf.hidden = !confirmation;
    const to = q<HTMLElement>('[data-rfq-done-email]', done);
    if (to) to.textContent = text.email.value.trim();

    // Offer, never assume: the list is theirs to clear.
    const offer = q<HTMLElement>('[data-rfq-listoffer]', done)!;
    const n = loadList().items.length;
    offer.hidden = !(fromList && n > 0);
    const offerN = q<HTMLElement>('[data-rfq-listoffer-n]', done);
    if (offerN) offerN.textContent = `${n} item${n === 1 ? '' : 's'}`;
    const offerMsg = q<HTMLElement>('[data-rfq-listoffer-msg]', done);
    if (offerMsg) offerMsg.hidden = true;
    const offerBtn = q<HTMLButtonElement>('[data-rfq-clearlist]', done);
    if (offerBtn) offerBtn.hidden = false;

    formCard.hidden = true;
    done.hidden = false;
    const title = q<HTMLElement>('[data-rfq-done-title]', done);
    title?.focus({ preventScroll: true });
    done.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  q<HTMLButtonElement>('[data-rfq-clearlist]', done)?.addEventListener('click', (e) => {
    clearList();
    (e.currentTarget as HTMLElement).hidden = true;
    const msg = q<HTMLElement>('[data-rfq-listoffer-msg]', done);
    if (msg) msg.hidden = false;
  });

  function resetAll() {
    form.reset();
    reg.set([]);
    market.set([]);
    items = [];
    fromList = false;
    unitTouched = false;
    attempted = false;
    for (const w of form.querySelectorAll<HTMLElement>('[data-f]')) setErr(w, null);
    errorBox.hidden = true;
    handoffBox.hidden = true;
    clearDraft();
    renderItems();
    applyLineHints();
  }

  q<HTMLButtonElement>('[data-rfq-again]', done)?.addEventListener('click', () => {
    resetAll();
    done.hidden = true;
    formCard.hidden = false;
    formCard.scrollIntoView({ block: 'start', behavior: 'smooth' });
    lineBoxes[0]?.focus({ preventScroll: true });
  });

  // Two taps to clear, so one stray tap cannot throw away a long enquiry.
  let armed = false;
  resetBtn.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      resetBtn.textContent = 'Tap again to clear everything';
      window.setTimeout(() => {
        armed = false;
        resetBtn.textContent = 'Clear the form';
      }, 3000);
      return;
    }
    armed = false;
    resetBtn.textContent = 'Clear the form';
    resetAll();
  });

  // The list can change in another tab while this one is open.
  window.addEventListener('storage', (e) => {
    if (e.key === 'mh-enquiry-list') updateListPrompt();
  });

  void arrive();
}
