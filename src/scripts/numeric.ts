// Numbers-only fields (client, 2026-09-23): quantities and phone numbers.
//
// type="number" is deliberately not used: it accepts "e", "+" and "-", adds
// a spinner, changes value when a mouse wheel passes over it, and hands back
// an empty string for anything it cannot parse. A text field with a numeric
// keyboard and a character filter behaves the way people expect.
//
//   quantity  digits, grouping commas and one decimal point; tidied to
//             "50,000" when the field is left
//   phone     digits and spaces, with an optional leading "+"

type Kind = 'quantity' | 'phone';

const ALLOWED: Record<Kind, RegExp> = {
  quantity: /[0-9.,]/,
  phone: /[0-9 +]/,
};

function clean(kind: Kind, v: string): string {
  if (kind === 'phone') {
    const plus = v.trimStart().startsWith('+');
    return (plus ? '+' : '') + v.replace(/[^0-9 ]/g, '').replace(/ {2,}/g, ' ').trimStart();
  }
  let out = v.replace(/[^0-9.,]/g, '');
  const dot = out.indexOf('.');
  if (dot >= 0) out = out.slice(0, dot + 1) + out.slice(dot + 1).replace(/\./g, '');
  return out;
}

/** "50,000" from "50000"; empty stays empty. */
export function formatQuantity(v: string): string {
  const n = Number(v.replace(/,/g, ''));
  if (!v.trim() || !Number.isFinite(n)) return v.trim();
  return n.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

/** True when a quantity field holds a number above zero. */
export const isQuantity = (v: string) => Number(v.replace(/,/g, '')) > 0;

export function numericOnly(input: HTMLInputElement, kind: Kind): void {
  input.inputMode = kind === 'phone' ? 'tel' : 'decimal';
  input.autocomplete = kind === 'phone' ? 'tel' : 'off';

  // Refuse a disallowed key before it lands, so nothing flickers in and out.
  input.addEventListener('beforeinput', (e) => {
    if (e.inputType !== 'insertText' || !e.data) return;
    if ([...e.data].some((ch) => !ALLOWED[kind].test(ch))) e.preventDefault();
  });
  // Paste, autofill and dictation arrive here: keep only what is allowed.
  input.addEventListener('input', () => {
    const next = clean(kind, input.value);
    if (next === input.value) return;
    const back = input.value.length - (input.selectionEnd ?? input.value.length);
    input.value = next;
    const at = Math.max(0, next.length - back);
    input.setSelectionRange(at, at);
  });
  if (kind === 'quantity') {
    input.addEventListener('blur', () => {
      const tidy = formatQuantity(input.value);
      if (tidy !== input.value) {
        input.value = tidy;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }
}
