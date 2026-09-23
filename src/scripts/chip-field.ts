// A field of chips chosen from a suggestion list (src/components/ChipField.astro).
// Used for "Regulatory requirement" and "Destination market / country".
//
//   empty field, focused   the whole list, grouped
//   typing                 the closest matches first
//   Enter / tap            toggles the highlighted row; the list stays open
//                          for another pick
//   comma or semicolon     finishes what was typed
//   Backspace, empty field removes the last chip
//
// Two modes:
//   open    (regulatory)  anything typed can be added as it is
//   strict  (countries)   only list entries can be chosen (client,
//                         2026-09-23). Typed text that exactly names an
//                         entry, or one of its other names, is accepted;
//                         anything else stays in the box, is flagged, and
//                         blocks the form until it is chosen or cleared.
//
// ARIA: a combobox input controlling a multi-select listbox; the highlighted
// row is announced through aria-activedescendant, selection by aria-selected.

import type { RegGroup, RegOption } from '../data/regulatory';

export interface ChipField {
  get(): string[];
  set(values: string[]): void;
  /** Text typed but not turned into a chip (strict mode leaves it there). */
  pending(): string;
}

export interface ChipFieldConfig {
  groups: RegGroup[];
  strict?: boolean;
  /** Icon for the "add what I typed" row (open mode). */
  customIcon?: string;
  /** Shown in strict mode when typed text is not on the list. */
  strictMessage?: string;
}

// Lowercase, accents folded ("México" finds Mexico), punctuation to spaces.
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const squash = (s: string) => norm(s).replace(/ /g, '');

interface Entry {
  opt: RegOption;
  group: string;
  icon: string;
  order: number;
  labelN: string;
  labelS: string;
  words: string[];
  alsoN: string[];
}

/** 0 means no match; higher is closer. An exact label wins, then an exact
 *  alias (so "fda" means US FDA before FDA Ghana), then label prefixes,
 *  then aliases and notes. */
function score(e: Entry, qn: string, qs: string): number {
  if (e.labelN === qn || e.labelS === qs) return 100;
  if (e.alsoN.includes(qn)) return 90;
  if (e.labelN.startsWith(qn) || e.labelS.startsWith(qs)) return 80;
  if (e.labelN.split(' ').some((w) => w.startsWith(qn))) return 65;
  if (e.alsoN.some((a) => a.startsWith(qn) || a.split(' ').some((w) => w.startsWith(qn)))) return 40;
  if (qs.length > 1 && e.labelS.includes(qs)) return 30;
  const toks = qn.split(' ');
  const pool = [...e.words, ...e.alsoN.flatMap((a) => a.split(' '))];
  if (toks.every((t) => pool.some((w) => w.startsWith(t)))) return 20;
  return 0;
}

const ICON_TICK = 'M5 12.5 10 17l9-10';
const svg = (d: string, w = 2.2) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" aria-hidden="true"><path d="${d}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** The row's leading tile: a region code, or the group's icon. Typographic
 *  on purpose, never an official logo (see src/data/regulatory.ts). */
function tile(code: string | undefined, icon: string): HTMLElement | null {
  if (!code && !icon) return null;
  const t = document.createElement('span');
  t.setAttribute('aria-hidden', 'true');
  if (code) {
    t.className = 'cf-tile cf-tile-code';
    t.textContent = code;
  } else {
    t.className = 'cf-tile';
    t.innerHTML = svg(icon, 1.7);
  }
  return t;
}

export function initChipField(root: HTMLElement, config: ChipFieldConfig): ChipField {
  const strict = !!config.strict;
  const input = root.querySelector<HTMLInputElement>('[data-cf-input]')!;
  const box = root.querySelector<HTMLElement>('[data-cf-box]')!;
  const chips = root.querySelector<HTMLUListElement>('[data-cf-chips]')!;
  const pop = root.querySelector<HTMLElement>('[data-cf-pop]')!;
  const list = root.querySelector<HTMLElement>('[role="listbox"]')!;
  const hidden = root.querySelector<HTMLInputElement>('[data-cf-value]')!;
  const live = root.querySelector<HTMLElement>('[data-cf-live]');
  const msg = root.querySelector<HTMLElement>('[data-cf-msg]');
  const placeholder = input.placeholder;

  let order = 0;
  const entries: Entry[] = config.groups.flatMap((g) =>
    g.options.map((opt) => ({
      opt,
      group: g.name,
      icon: g.icon,
      order: order++,
      labelN: norm(opt.label),
      labelS: squash(opt.label),
      words: norm(`${opt.label} ${opt.note ?? ''}`).split(' '),
      alsoN: (opt.also ?? []).map(norm),
    })),
  );

  let values: string[] = [];
  let active = -1;
  let seq = 0;

  const isOpen = () => !pop.hidden;
  const options = () => [...list.querySelectorAll<HTMLElement>('[role="option"]')];

  /** The list entry typed text names exactly, by label or other name. */
  const exact = (text: string): string | null => {
    const qn = norm(text);
    if (!qn) return null;
    const hit = entries.find((e) => e.labelN === qn || e.labelS === qn.replace(/ /g, '') || e.alsoN.includes(qn));
    return hit ? hit.opt.label : null;
  };

  // ---- Value ---------------------------------------------------------------
  const emit = () => {
    hidden.value = values.join('; ');
    hidden.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const say = (text: string) => {
    if (live) live.textContent = text;
  };
  const showMsg = (on: boolean) => {
    if (!msg) return;
    msg.hidden = !on;
    if (on) msg.textContent = config.strictMessage ?? 'Choose from the list.';
    root.classList.toggle('has-err', on);
    if (on) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  };
  const renderChips = () => {
    chips.replaceChildren(
      ...values.map((v) => {
        const li = document.createElement('li');
        li.className = 'cf-chip';
        const t = document.createElement('span');
        t.textContent = v;
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'cf-chip-x';
        x.setAttribute('aria-label', `Remove ${v}`);
        x.innerHTML = svg('M7 7l10 10M17 7 7 17');
        x.addEventListener('click', () => {
          remove(v);
          input.focus();
        });
        li.append(t, x);
        return li;
      }),
    );
    input.placeholder = values.length ? 'Add another' : placeholder;
  };
  const has = (v: string) => values.some((x) => x.toLowerCase() === v.toLowerCase());
  const add = (v: string) => {
    const clean = v.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!clean || has(clean)) return;
    values = [...values, clean];
    renderChips();
    emit();
    say(`${clean} added. ${values.length} selected.`);
  };
  const remove = (v: string) => {
    values = values.filter((x) => x.toLowerCase() !== v.toLowerCase());
    renderChips();
    emit();
    say(`${v} removed. ${values.length} selected.`);
    if (isOpen()) render();
  };
  const toggle = (v: string) => (has(v) ? remove(v) : add(v));

  // Typed text becomes a chip: as typed (open mode), or only when it names a
  // list entry (strict). Returns true if it was taken.
  const commit = (text: string): boolean => {
    const t = text.trim();
    if (!t) return true;
    if (!strict) {
      add(t);
      return true;
    }
    const hit = exact(t);
    if (hit) add(hit);
    return !!hit;
  };

  // ---- List ----------------------------------------------------------------
  const highlight = (text: string, q: string): DocumentFragment => {
    const frag = document.createDocumentFragment();
    const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
    if (i < 0) {
      frag.append(text);
      return frag;
    }
    const mk = document.createElement('mark');
    mk.textContent = text.slice(i, i + q.length);
    frag.append(text.slice(0, i), mk, text.slice(i + q.length));
    return frag;
  };
  const row = (label: string, sub: string, q: string, lead: HTMLElement | null, custom = false) => {
    const o = document.createElement('div');
    o.className = custom ? 'cf-opt cf-opt-add' : 'cf-opt';
    o.id = `${input.id}-opt-${++seq}`;
    o.setAttribute('role', 'option');
    o.dataset.value = label;
    o.setAttribute('aria-selected', String(!custom && has(label)));
    if (lead) o.append(lead);
    const main = document.createElement('span');
    main.className = 'cf-opt-main';
    const l = document.createElement('span');
    l.className = 'cf-opt-label';
    l.append(custom ? `Add “${label}”` : highlight(label, q));
    main.append(l);
    if (sub) {
      const s = document.createElement('span');
      s.className = 'cf-opt-sub';
      s.textContent = sub;
      main.append(s);
    }
    o.append(main);
    if (!custom) {
      const mark = document.createElement('span');
      mark.className = 'cf-opt-mark';
      mark.innerHTML = svg(ICON_TICK);
      o.append(mark);
    }
    // Keep focus in the input while picking with a mouse or finger.
    o.addEventListener('pointerdown', (e) => e.preventDefault());
    o.addEventListener('click', () => pick(o));
    return o;
  };
  const heading = (text: string) => {
    const h = document.createElement('p');
    h.className = 'cf-h';
    h.setAttribute('role', 'presentation');
    h.textContent = text;
    return h;
  };

  function render() {
    const q = input.value.trim();
    const qn = norm(q);
    list.replaceChildren();
    active = -1;
    input.removeAttribute('aria-activedescendant');
    if (!qn) {
      for (const g of config.groups) {
        list.append(heading(g.name));
        for (const o of g.options) list.append(row(o.label, o.note ?? '', '', tile(o.code, g.icon)));
      }
      return;
    }
    const qs = squash(q);
    const hits = entries
      .map((e) => ({ e, s: score(e, qn, qs) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.e.labelN.length - b.e.labelN.length || a.e.order - b.e.order);
    for (const { e } of hits) list.append(row(e.opt.label, e.opt.note ?? e.group, q, tile(e.opt.code, e.icon)));
    if (!hits.length) {
      const p = document.createElement('p');
      p.className = 'cf-empty';
      p.textContent = strict
        ? `Nothing on the list matches “${q}”. Check the spelling, or clear it to see the full list.`
        : 'Not in our list. You can still add it as you typed it.';
      list.append(p);
    }
    if (!strict && !hits.some((x) => x.s === 100) && !has(q)) {
      list.append(row(q, '', q, tile(undefined, config.customIcon ?? ''), true));
    }
    // Typing highlights the best match, so Enter picks it.
    if (options().length) setActive(0, false);
  }

  function setActive(i: number, scroll = true) {
    const opts = options();
    opts.forEach((o, j) => o.classList.toggle('is-active', j === i));
    active = i;
    if (i >= 0 && opts[i]) {
      input.setAttribute('aria-activedescendant', opts[i].id);
      if (scroll) opts[i].scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }

  function pick(o: HTMLElement) {
    const v = o.dataset.value ?? '';
    if (o.classList.contains('cf-opt-add')) add(v);
    else toggle(v);
    showMsg(false);
    if (input.value) {
      input.value = '';
      render();
    } else {
      // Picking from the full list: keep the highlight where it was.
      const i = options().indexOf(o);
      for (const el of options()) {
        el.setAttribute('aria-selected', String(!el.classList.contains('cf-opt-add') && has(el.dataset.value ?? '')));
      }
      setActive(i, false);
    }
  }

  // ---- Placement -------------------------------------------------------------
  // The list hangs under the field and never runs under a phone's keyboard:
  // its height is whatever is left of the visible viewport.
  function place() {
    if (!isOpen()) return;
    const vv = window.visualViewport;
    const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    const room = visibleBottom - box.getBoundingClientRect().bottom - 12;
    pop.style.maxHeight = `${Math.max(150, Math.min(room, 360))}px`;
  }
  function open() {
    if (isOpen()) return;
    render();
    pop.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    place();
    // On a small screen, bring the field up so the list has room to show.
    const vv = window.visualViewport;
    if (window.matchMedia('(max-width: 767px)').matches) {
      window.setTimeout(() => {
        const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
        if (visibleBottom - box.getBoundingClientRect().bottom < 240) {
          box.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
      }, 320);
    }
  }
  function close() {
    if (!isOpen()) return;
    pop.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  // ---- Events ----------------------------------------------------------------
  input.addEventListener('focus', open);
  input.addEventListener('click', open);
  box.addEventListener('click', (e) => {
    if (e.target === box || e.target === chips) input.focus();
  });
  input.addEventListener('input', () => {
    const v = input.value;
    // A typed separator finishes what came before it.
    if (/[;,]/.test(v)) {
      const parts = v.split(/[;,]/);
      const rest = parts.pop() ?? '';
      const kept = parts.filter((p) => !commit(p)).map((p) => p.trim());
      input.value = [...kept, rest.trimStart()].filter(Boolean).join(', ');
    }
    if (msg && !msg.hidden && !input.value.trim()) showMsg(false);
    if (!isOpen()) open();
    else render();
  });
  input.addEventListener('keydown', (e) => {
    const opts = options();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen()) open();
      else setActive(active < opts.length - 1 ? active + 1 : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen()) setActive(active > 0 ? active - 1 : opts.length - 1);
    } else if (e.key === 'Enter') {
      // Enter in this field never submits the form.
      e.preventDefault();
      if (isOpen() && active >= 0 && opts[active]) pick(opts[active]);
      else if (input.value.trim() && commit(input.value)) {
        input.value = '';
        if (isOpen()) render();
      }
    } else if (e.key === 'Escape') {
      if (isOpen()) {
        e.preventDefault();
        e.stopPropagation(); // inside a dialog, close the list, not the dialog
        close();
      }
    } else if (e.key === 'Backspace' && !input.value && values.length) {
      remove(values[values.length - 1]);
    }
  });
  // Leaving the field: close the list and keep what was typed, if it can be kept.
  root.addEventListener('focusout', (e) => {
    if (root.contains(e.relatedTarget as Node | null)) return;
    close();
    const t = input.value.trim();
    if (!t) return;
    if (strict) {
      if (commit(t)) input.value = '';
      else showMsg(true);
    } else if (t.length > 1) {
      add(t);
      input.value = '';
    }
  });
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, { passive: true });
  window.visualViewport?.addEventListener('resize', place);
  window.visualViewport?.addEventListener('scroll', place);

  renderChips();

  return {
    get: () => [...values],
    pending: () => input.value.trim(),
    set(next: string[]) {
      values = [];
      for (const v of next) {
        const clean = v.replace(/\s+/g, ' ').trim().slice(0, 80);
        if (!clean) continue;
        // Strict fields only ever hold list entries, whatever is handed in.
        const val = strict ? exact(clean) : clean;
        if (val && !has(val)) values.push(val);
      }
      hidden.value = values.join('; ');
      input.value = '';
      showMsg(false);
      renderChips();
      if (isOpen()) render();
    },
  };
}
