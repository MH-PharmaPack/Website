/**
 * MH PharmaPack quote form backend (Google Apps Script web app).
 *
 * Receives the /contact form, then:
 *   1. checks it (spam trap, Cloudflare Turnstile when configured, rate
 *      limits, an allowlist of field names, required fields, lengths)
 *   2. emails the enquiry to the sales desk: an at-a-glance HTML layout to
 *      read, plus a plain-text part of stable "key: value" lines for
 *      anything that parses enquiries. Reply-To is the buyer, the sender
 *      name is the buyer's name.
 *   3. emails the buyer a branded confirmation with a summary of what they
 *      sent
 *
 * Both emails are sent by the Google Workspace account that deploys this
 * script, so deploy it FROM the sales@mhpharmapack.com account: the
 * confirmation then comes from sales@ itself, signed by the domain's own
 * Google DKIM, and replies to it land in the same inbox.
 *
 * sendSamples() (run it from the editor) sends one example of each email,
 * for two sample enquiries, to the sales desk only.
 *
 * Setup and redeploy steps: README.md in this folder.
 *
 * Script properties (Project settings > Script properties):
 *   TURNSTILE_SECRET   Cloudflare Turnstile secret key. Optional; when set,
 *                      every submission must carry a valid token.
 *   SALES_EMAIL        Optional override of where enquiries go.
 *
 * The field names below must match src/scripts/rfq-form.ts on the site.
 */

var SALES_EMAIL_DEFAULT = 'sales@mhpharmapack.com';
var SENDER_NAME = 'MH PharmaPack';
var SITE = 'https://mhpharmapack.com';
var PHONE_DISPLAY = '+91 98250 12519';
var PHONE_TEL = '+919825012519';
var WHATSAPP = '919825012519';
var ADDRESS = 'C-303, Siddhivinayak Business Towers, Makarba, Ahmedabad, Gujarat, 380051';
var LOGO = SITE + '/email/mh-logo.png';
var TIMEZONE = 'Asia/Kolkata';

// Every key the form may send. Anything else is refused.
var KEYS = [
  'Source',
  'Line of interest',
  'Product / molecule / item',
  'Quantity / volume',
  'Items requested',
  'Specification details',
  'Destination market / country',
  'Required timeline',
  'Regulatory requirement',
  'Anything else',
  'Name',
  'Company',
  'Email',
  'Phone / WhatsApp',
  'Consent to contact',
];
var ITEM_KEY = /^Item \d{1,2}( category| detail| quantity| page)?$/;
var LONG_KEYS = ['Specification details', 'Anything else'];
var HIDDEN_FROM_BUYER = ['Source', 'Consent to contact'];

var MAX_PAIRS = 400;
var MAX_SHORT = 300;
var MAX_LONG = 2000;

// Rate limits: per sender address, and for the whole form.
var PER_EMAIL = { count: 3, seconds: 600 };
var PER_HOUR = { count: 40, seconds: 3600 };

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // The field people never see. A bot filled it: report success, send nothing.
    if (body.website) return reply({ ok: true, confirmation: false });

    var pairs = cleanPairs(body.fields);
    if (!pairs) return reply({ ok: false, error: 'invalid' });
    var f = {};
    pairs.forEach(function (p) {
      if (p[0]) f[p[0]] = p[1];
    });

    var email = String(f['Email'] || '').trim();
    var ok =
      f['Name'] &&
      f['Company'] &&
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) &&
      f['Line of interest'] &&
      (f['Product / molecule / item'] || f['Item 1']) &&
      (f['Quantity / volume'] || f['Item 1 quantity']) &&
      f['Consent to contact'] === 'Yes';
    if (!ok) return reply({ ok: false, error: 'invalid' });

    var secret = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET');
    if (secret && !turnstileOk(secret, body.token)) return reply({ ok: false, error: 'captcha' });

    if (!allow('rl:' + email.toLowerCase(), PER_EMAIL) || !allow('rl:all', PER_HOUR)) {
      return reply({ ok: false, error: 'rate' });
    }

    var confirmation = sendBoth(pairs, email, salesAddress(), MailApp.getRemainingDailyQuota() > 5);
    return reply({ ok: true, confirmation: confirmation });
  } catch (err) {
    console.error(err);
    return reply({ ok: false, error: 'server' });
  }
}

// A plain GET (someone opening the URL) gets a one-line answer, not an error page.
function doGet() {
  return ContentService.createTextOutput('MH PharmaPack quote form endpoint. POST only.');
}

function salesAddress() {
  return PropertiesService.getScriptProperties().getProperty('SALES_EMAIL') || SALES_EMAIL_DEFAULT;
}

/** Sends the enquiry to the desk and, if allowed, the confirmation to
 *  `buyerTo`. Returns whether the confirmation went. */
function sendBoth(pairs, buyerTo, salesTo, withConfirmation) {
  var enq = parseEnquiry(pairs);
  var when = Utilities.formatDate(new Date(), TIMEZONE, "d MMM yyyy, HH:mm 'IST'");

  // 1. The enquiry, to the sales desk. It is sent by this account (the
  //    buyer's own address cannot be used as the sender: that would be
  //    spoofing, and their domain's DMARC would bounce or bin it), but the
  //    inbox shows the buyer's name as the sender and Reply goes to them,
  //    so it reads and answers like an email they sent.
  MailApp.sendEmail({
    to: salesTo,
    replyTo: enq.f['Email'],
    subject: salesSubject(enq),
    body: toText(pairs),
    htmlBody: salesHtml(enq, pairs, when),
    name: displayName(enq.f['Name'], enq.f['Company']),
  });

  if (!withConfirmation) return false;
  // 2. The confirmation, to the buyer.
  var summary = pairs.filter(function (p) {
    return HIDDEN_FROM_BUYER.indexOf(p[0]) < 0;
  });
  MailApp.sendEmail({
    to: buyerTo,
    replyTo: salesTo,
    subject: 'We have received your enquiry: MH PharmaPack',
    body: confirmationText(enq.f['Name'], summary),
    htmlBody: confirmationHtml(enq, when),
    name: SENDER_NAME,
  });
  return true;
}

/** Run from the editor: one example of each email for two sample
 *  enquiries (a single product, and catalogue items), all to the desk. */
function sendSamples() {
  var desk = salesAddress();
  var single = [
    ['Source', 'Website quote form (SAMPLE)'],
    ['Line of interest', 'API'],
    ['Product / molecule / item', 'Betamethasone valerate'],
    ['Quantity / volume', '250 kg'],
    ['Specification details', 'Grade: BP\nParticle size: micronised, D90 under 10 micron\nCoA and DMF copy with the quote'],
    ['Destination market / country', 'Kenya; Uganda'],
    ['Required timeline', '1 to 3 months'],
    ['Regulatory requirement', 'WHO GMP; CEP'],
    ['Anything else', 'Please quote CIF Mombasa.'],
    ['Name', 'Sample Buyer'],
    ['Company', 'Sample Pharma Ltd (SAMPLE)'],
    ['Email', desk],
    ['Phone / WhatsApp', '+254 700 000000'],
    ['Consent to contact', 'Yes'],
  ];
  var items = [
    ['Source', 'Website quote form (SAMPLE)'],
    ['Line of interest', 'Packaging'],
    ['Items requested', '3'],
    ['Item 1', '30 ml DSB Round Bottle, 25 mm Neck (Marked)'],
    ['Item 1 category', 'Bottles / Dry Syrup Bottles'],
    ['Item 1 detail', 'HDPE, 10.50 gm'],
    ['Item 1 quantity', '50,000 pieces'],
    ['Item 1 page', SITE + '/catalogue/'],
    ['Item 2', '25 mm CRC Cap'],
    ['Item 2 category', 'Caps and Closures / Child-Resistant Caps'],
    ['Item 2 quantity', '50,000 pieces'],
    ['Item 3', 'Flip Off Seal, 20 mm'],
    ['Item 3 category', 'Vial Seals'],
    ['Item 3 detail', 'Aluminium'],
    ['Item 3 quantity', '120,000 pieces'],
    ['Destination market / country', 'Nigeria'],
    ['Required timeline', 'Within 1 month'],
    ['Regulatory requirement', 'USP <661>; ISO 15378'],
    ['Name', 'Sample Buyer'],
    ['Company', 'Sample Packaging Co (SAMPLE)'],
    ['Email', desk],
    ['Consent to contact', 'Yes'],
  ];
  sendBoth(single, desk, desk, true);
  sendBoth(items, desk, desk, true);
}

// ---- Checks ------------------------------------------------------------------

function cleanPairs(fields) {
  if (!Array.isArray(fields) || fields.length === 0 || fields.length > MAX_PAIRS) return null;
  var out = [];
  for (var i = 0; i < fields.length; i++) {
    var p = fields[i];
    if (!Array.isArray(p) || p.length !== 2) return null;
    var k = String(p[0]);
    var v = String(p[1]);
    if (KEYS.indexOf(k) < 0 && !ITEM_KEY.test(k)) return null;
    var max = LONG_KEYS.indexOf(k) >= 0 ? MAX_LONG : MAX_SHORT;
    if (v.length > max) return null;
    out.push([k, v]);
  }
  return out;
}

function turnstileOk(secret, token) {
  if (!token || String(token).length > 2048) return false;
  var res = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'post',
    payload: { secret: secret, response: String(token) },
    muteHttpExceptions: true,
  });
  try {
    var data = JSON.parse(res.getContentText());
    return data.success === true;
  } catch (e) {
    return false;
  }
}

function allow(key, limit) {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get(key) || 0);
  if (n >= limit.count) return false;
  cache.put(key, String(n + 1), limit.seconds);
  return true;
}

// ---- Reading an enquiry ---------------------------------------------------------

/** Splits the pairs into plain fields and the list of catalogue items. */
function parseEnquiry(pairs) {
  var f = {};
  var items = [];
  pairs.forEach(function (p) {
    var m = /^Item (\d+)(?: (category|detail|quantity|page))?$/.exec(p[0]);
    if (m) {
      var i = Number(m[1]) - 1;
      items[i] = items[i] || {};
      items[i][m[2] || 'name'] = p[1];
    } else {
      f[p[0]] = p[1];
    }
  });
  return { f: f, items: items.filter(Boolean) };
}

function oneLine(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function clip(s, n) {
  var t = oneLine(s);
  return t.length > n ? t.slice(0, n - 1).trim() + '…' : t;
}

// "Asha Mehta at Example Pharma via mhpharmapack.com": the sender name shown
// in the sales inbox. Characters that could break an address header go.
function displayName(name, company) {
  var clean = function (s) {
    return oneLine(s).replace(/["<>@\\,;:()]/g, '').slice(0, 60);
  };
  var who = [clean(name), clean(company)].filter(Boolean).join(' at ');
  return (who || 'Website enquiry') + ' via mhpharmapack.com';
}

/** "RFQ: Example Pharma | 100 ml amber PET bottle, 50,000 pieces | Kenya":
 *  who, what and where, readable in the inbox list without opening it. */
function salesSubject(enq) {
  var f = enq.f;
  var what = enq.items.length
    ? enq.items.length + (enq.items.length === 1 ? ' catalogue item' : ' catalogue items')
    : clip(f['Product / molecule / item'], 60) + (f['Quantity / volume'] ? ', ' + oneLine(f['Quantity / volume']) : '');
  var parts = ['RFQ: ' + clip(f['Company'], 60), what];
  if (f['Destination market / country']) parts.push(clip(f['Destination market / country'], 40));
  return parts.join(' | ');
}

// "key: value" lines; multi-line answers continue on lines starting with two
// spaces; a group ends at the next "Item n" key or before Name.
function toText(pairs) {
  var lines = [];
  pairs.forEach(function (p, i) {
    var k = p[0];
    var v = String(p[1]).replace(/\r\n?/g, '\n').trim().split('\n');
    var breakBefore =
      i > 0 && (/^Item \d+$/.test(k) || k === 'Specification details' || k === 'Name' || k === 'Destination market / country');
    if (breakBefore && lines[lines.length - 1] !== '') lines.push('');
    lines.push(k + ': ' + v[0]);
    for (var j = 1; j < v.length; j++) lines.push('  ' + v[j]);
  });
  return lines.join('\n');
}

// ---- HTML building blocks ---------------------------------------------------------
//
// Email clients ignore stylesheets and most modern CSS, so everything is
// tables and inline styles. Colours are the site's own tokens.

var C = {
  steel: '#4e6076',
  steelDeep: '#37475b',
  copper: '#a9663f',
  copperDeep: '#7f4526',
  copperSoft: '#e0b087',
  copperTint: '#f6ede7',
  ink: '#26303d',
  muted: '#717d8b',
  line: '#d3dae2',
  paper: '#f4f6f8',
  paperWarm: '#e7ebf0',
  band: '#1c2634',
  mist: '#aebccd',
};
var FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escLines(s) {
  return esc(String(s || '').trim()).replace(/\r\n?|\n/g, '<br>');
}
/** An address that may wrap on a phone: before the "@", not mid-word. */
function escEmail(s) {
  return esc(s).replace('@', '<wbr>@');
}

function page(title, preheader, inner) {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">' +
    '<title>' + esc(title) + '</title></head>' +
    '<body style="margin:0;padding:0;background:' + C.paper + ';">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">' + esc(preheader) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + C.paper + ';">' +
    '<tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid ' + C.line + ';border-radius:10px;border-collapse:separate;overflow:hidden;">' +
    inner +
    '</table></td></tr></table></body></html>'
  );
}

function eyebrow(text, color) {
  return (
    '<div style="font:600 11px/1.4 ' + FONT + ';letter-spacing:0.16em;text-transform:uppercase;color:' +
    (color || C.copperDeep) + ';">' + esc(text) + '</div>'
  );
}

function button(href, label, filled) {
  var style = filled
    ? 'background:' + C.copper + ';border:1px solid ' + C.copper + ';color:#ffffff;'
    : 'background:transparent;border:1px solid ' + C.steel + ';color:' + C.steelDeep + ';';
  return (
    '<a href="' + esc(href) + '" style="display:inline-block;margin:0 8px 8px 0;padding:11px 18px;border-radius:6px;' +
    style + 'font:600 14px/1.2 ' + FONT + ';text-decoration:none;">' + esc(label) + '</a>'
  );
}
function buttonOnDark(href, label, filled) {
  var style = filled
    ? 'background:' + C.copper + ';border:1px solid ' + C.copper + ';color:#ffffff;'
    : 'background:transparent;border:1px solid rgba(255,255,255,0.55);color:#ffffff;';
  return (
    '<a href="' + esc(href) + '" style="display:inline-block;margin:0 8px 8px 0;padding:10px 16px;border-radius:6px;' +
    style + 'font:600 14px/1.2 ' + FONT + ';text-decoration:none;">' + esc(label) + '</a>'
  );
}

function notGiven() {
  return '<span style="color:' + C.muted + ';font-weight:400;">Not given</span>';
}

/** "+254 700 000000" to "254700000000" for wa.me, only when it carries a
 *  country code (a leading +); a local number cannot be addressed. */
function waDigits(phone) {
  var p = String(phone || '').trim();
  return p.charAt(0) === '+' ? p.replace(/\D/g, '') : '';
}

// ---- The enquiry, to the sales desk ----------------------------------------------

function salesHtml(enq, pairs, when) {
  var f = enq.f;
  var name = oneLine(f['Name']);
  var phone = oneLine(f['Phone / WhatsApp']);
  var subject = salesSubject(enq);

  // Header: who, and the three ways to answer them.
  var contactLine = [esc(name), '<a href="mailto:' + esc(f['Email']) + '" style="color:' + C.copperSoft + ';text-decoration:none;">' + esc(f['Email']) + '</a>'];
  if (phone) contactLine.push(esc(phone));
  var actions = buttonOnDark('mailto:' + f['Email'] + '?subject=' + encodeURIComponent('Re: ' + subject), 'Reply by email', true);
  if (waDigits(phone)) actions += buttonOnDark('https://wa.me/' + waDigits(phone), 'WhatsApp', false);
  if (phone) actions += buttonOnDark('tel:' + phone.replace(/[^\d+]/g, ''), 'Call', false);

  var header =
    '<tr><td style="background:' + C.band + ';padding:22px 24px 16px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td>' + eyebrow('New enquiry', C.copperSoft) + '</td>' +
    '<td align="right" style="font:12px/1.4 ' + FONT + ';color:' + C.mist + ';">' + esc(when) + '</td>' +
    '</tr></table>' +
    '<div style="margin-top:10px;font:700 24px/1.25 ' + FONT + ';color:#ffffff;">' + esc(f['Company']) + '</div>' +
    '<div style="margin-top:6px;font:14px/1.6 ' + FONT + ';color:' + C.mist + ';">' + contactLine.join(' &nbsp;·&nbsp; ') + '</div>' +
    '<div style="margin-top:16px;">' + actions + '</div>' +
    '</td></tr>';

  // What they need: the product, or the catalogue items.
  var need;
  if (enq.items.length) {
    var rows = enq.items
      .map(function (it, i) {
        var nameCell = it.page
          ? '<a href="' + esc(it.page) + '" style="color:' + C.ink + ';text-decoration:none;">' + esc(it.name) + '</a>'
          : esc(it.name);
        var sub = [it.category, it.detail].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ');
        return (
          '<tr>' +
          '<td valign="top" style="padding:12px 10px 12px 0;border-top:1px solid ' + C.line + ';width:26px;">' +
          '<div style="width:24px;height:24px;border-radius:12px;background:' + C.steelDeep + ';color:#ffffff;text-align:center;font:700 12px/24px ' + FONT + ';">' + (i + 1) + '</div></td>' +
          '<td valign="top" style="padding:12px 12px 12px 0;border-top:1px solid ' + C.line + ';">' +
          '<div style="font:600 15px/1.35 ' + FONT + ';color:' + C.ink + ';">' + nameCell + '</div>' +
          (sub ? '<div style="margin-top:3px;font:13px/1.45 ' + FONT + ';color:' + C.steelDeep + ';">' + sub + '</div>' : '') +
          '</td>' +
          '<td valign="top" align="right" style="padding:12px 0;border-top:1px solid ' + C.line + ';white-space:nowrap;font:700 15px/1.35 ' + FONT + ';color:' + C.copperDeep + ';">' +
          (it.quantity ? esc(it.quantity) : notGiven()) +
          '</td></tr>'
        );
      })
      .join('');
    need =
      '<tr><td style="padding:24px 24px 4px;">' +
      eyebrow(enq.items.length + (enq.items.length === 1 ? ' item from the catalogue' : ' items from the catalogue')) +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;border-bottom:1px solid ' + C.line + ';">' +
      rows +
      '</table>' +
      (f['Product / molecule / item']
        ? '<div style="margin-top:12px;font:14px/1.5 ' + FONT + ';color:' + C.ink + ';"><span style="color:' + C.steelDeep + ';">Also asked about:</span> ' + esc(f['Product / molecule / item']) + '</div>'
        : '') +
      '</td></tr>';
  } else {
    need =
      '<tr><td style="padding:24px 24px 4px;">' +
      eyebrow('What they need') +
      '<div style="margin-top:8px;font:700 21px/1.3 ' + FONT + ';color:' + C.ink + ';">' + esc(f['Product / molecule / item']) + '</div>' +
      '<div style="margin-top:10px;"><span style="display:inline-block;padding:6px 12px;border-radius:6px;background:' + C.copperTint + ';color:' + C.copperDeep + ';font:700 15px/1.2 ' + FONT + ';">' +
      esc(f['Quantity / volume']) + '</span></div>' +
      '</td></tr>';
  }

  // At a glance: the four facts that decide who to ask and how fast.
  var cell = function (label, value) {
    return (
      '<td valign="top" width="50%" style="padding:12px 12px 12px 0;border-top:1px solid ' + C.line + ';">' +
      '<div style="font:600 11px/1.4 ' + FONT + ';letter-spacing:0.12em;text-transform:uppercase;color:' + C.steel + ';">' + esc(label) + '</div>' +
      '<div style="margin-top:4px;font:600 15px/1.4 ' + FONT + ';color:' + C.ink + ';">' + (value ? esc(value) : notGiven()) + '</div>' +
      '</td>'
    );
  };
  var glance =
    '<tr><td style="padding:20px 24px 4px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
    '<tr>' + cell('Line of interest', f['Line of interest']) + cell('Destination market', f['Destination market / country']) + '</tr>' +
    '<tr>' + cell('Required timeline', f['Required timeline']) + cell('Regulatory requirement', f['Regulatory requirement']) + '</tr>' +
    '</table></td></tr>';

  // Longer answers, only when given.
  var block = function (label, value) {
    if (!value) return '';
    return (
      '<div style="margin-top:14px;">' +
      '<div style="font:600 11px/1.4 ' + FONT + ';letter-spacing:0.12em;text-transform:uppercase;color:' + C.steel + ';">' + esc(label) + '</div>' +
      '<div style="margin-top:6px;padding:12px 14px;border-left:3px solid ' + C.copper + ';background:' + C.paper + ';font:14px/1.6 ' + FONT + ';color:' + C.ink + ';">' + escLines(value) + '</div>' +
      '</div>'
    );
  };
  var longer = block('Specification details', f['Specification details']) + block('Anything else', f['Anything else']);
  var details = longer ? '<tr><td style="padding:6px 24px 4px;">' + longer + '</td></tr>' : '';

  // Contact card.
  var crow = function (label, value) {
    return (
      '<tr><td valign="top" style="padding:6px 12px 6px 0;font:13px/1.5 ' + FONT + ';color:' + C.steelDeep + ';width:36%;">' + esc(label) + '</td>' +
      '<td valign="top" style="padding:6px 0;font:600 14px/1.5 ' + FONT + ';color:' + C.ink + ';overflow-wrap:anywhere;">' + value + '</td></tr>'
    );
  };
  var contact =
    '<tr><td style="padding:22px 24px 6px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + C.paper + ';border-radius:8px;">' +
    '<tr><td style="padding:14px 18px;">' +
    eyebrow('Contact', C.steel) +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">' +
    crow('Name', esc(name)) +
    crow('Company', esc(f['Company'])) +
    crow('Email', '<a href="mailto:' + esc(f['Email']) + '" style="color:' + C.copperDeep + ';">' + escEmail(f['Email']) + '</a>') +
    crow('Phone / WhatsApp', phone ? '<a href="tel:' + esc(phone.replace(/[^\d+]/g, '')) + '" style="color:' + C.copperDeep + ';">' + esc(phone) + '</a>' : notGiven()) +
    crow('Consent to contact', esc(f['Consent to contact'] || '')) +
    '</table></td></tr></table></td></tr>';

  // Footer: where it came from, and the same details as plain lines.
  var footer =
    '<tr><td style="padding:22px 24px 26px;">' +
    '<div style="font:13px/1.55 ' + FONT + ';color:' + C.steelDeep + ';">Sent from the quote form on mhpharmapack.com (' + esc(f['Source'] || 'website') + '). Replying to this email writes to ' + esc(name || 'the buyer') + ' directly.</div>' +
    '<div style="margin-top:14px;font:600 11px/1.4 ' + FONT + ';letter-spacing:0.12em;text-transform:uppercase;color:' + C.steel + ';">Plain text, for copying</div>' +
    '<pre style="margin:6px 0 0;padding:12px 14px;border:1px solid ' + C.line + ';border-radius:6px;background:#fbfcfd;white-space:pre-wrap;word-break:break-word;font:12px/1.55 Consolas,Menlo,monospace;color:' + C.ink + ';">' + esc(toText(pairs)) + '</pre>' +
    '</td></tr>';

  var pre = [f['Line of interest'], enq.items.length ? enq.items.length + ' items' : f['Quantity / volume'], f['Destination market / country'], f['Required timeline'], name]
    .filter(Boolean)
    .join(' · ');
  return page(subject, pre, header + need + glance + details + contact + footer);
}

// ---- The confirmation, to the buyer ----------------------------------------------

function confirmationText(name, summary) {
  return [
    'Dear ' + oneLine(name) + ',',
    '',
    'Thank you for your enquiry. It has reached our sales desk, and we will review your requirement and respond at the earliest opportunity.',
    '',
    'A summary of what you sent is below. If anything changes, or you have a specification sheet to share, simply reply to this email.',
    '',
    toText(summary),
    '',
    'Regards,',
    'Sales Desk',
    'MH PharmaPack',
    'Pharmaceutical Sourcing & Supply',
    SALES_EMAIL_DEFAULT + ' | ' + PHONE_DISPLAY,
    SITE,
  ].join('\n');
}

function confirmationHtml(enq, when) {
  var f = enq.f;
  var date = String(when).split(',')[0];

  var header =
    '<tr><td style="padding:22px 24px 18px;border-bottom:3px solid ' + C.copper + ';">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td valign="middle" style="width:52px;"><img src="' + LOGO + '" width="52" height="52" alt="MH PharmaPack" style="display:block;border:0;width:52px;height:52px;"></td>' +
    '<td valign="middle" style="padding-left:12px;">' +
    '<div style="font:700 15px/1.2 ' + FONT + ';letter-spacing:0.14em;color:' + C.ink + ';">MH PHARMAPACK</div>' +
    '<div style="margin-top:4px;font:600 9px/1.3 ' + FONT + ';letter-spacing:0.18em;color:' + C.steelDeep + ';">PHARMACEUTICAL SOURCING &amp; SUPPLY</div>' +
    '</td></tr></table></td></tr>';

  var intro =
    '<tr><td style="padding:30px 24px 6px;">' +
    eyebrow('Enquiry received') +
    '<div style="margin-top:10px;font:700 25px/1.25 ' + FONT + ';color:' + C.ink + ';">Thank you for your enquiry.</div>' +
    '<p style="margin:16px 0 0;font:16px/1.6 ' + FONT + ';color:' + C.ink + ';">Dear ' + esc(oneLine(f['Name'])) + ',</p>' +
    '<p style="margin:10px 0 0;font:16px/1.6 ' + FONT + ';color:' + C.steelDeep + ';">It has reached our sales desk, and we will review your requirement and respond at the earliest opportunity.</p>' +
    '</td></tr>';

  // The summary card.
  var row = function (label, value, first) {
    return (
      '<tr><td valign="top" style="padding:10px 14px 10px 0;' + (first ? '' : 'border-top:1px solid ' + C.line + ';') + 'font:13px/1.5 ' + FONT + ';color:' + C.steelDeep + ';width:38%;">' + esc(label) + '</td>' +
      '<td valign="top" style="padding:10px 0;' + (first ? '' : 'border-top:1px solid ' + C.line + ';') + 'font:600 14px/1.5 ' + FONT + ';color:' + C.ink + ';overflow-wrap:anywhere;">' + value + '</td></tr>'
    );
  };
  var rows = [];
  rows.push(row('Line of interest', esc(f['Line of interest']), true));
  if (enq.items.length) {
    var list = enq.items
      .map(function (it) {
        return (
          '<div style="padding:4px 0;">' + esc(it.name) +
          (it.quantity ? ' <span style="color:' + C.copperDeep + ';white-space:nowrap;">&nbsp;' + esc(it.quantity) + '</span>' : '') +
          '</div>'
        );
      })
      .join('');
    rows.push(row(enq.items.length === 1 ? 'Item' : 'Items', list));
    if (f['Product / molecule / item']) rows.push(row('Also asked about', esc(f['Product / molecule / item'])));
  } else {
    rows.push(row('Product / molecule / item', esc(f['Product / molecule / item'])));
    rows.push(row('Quantity / volume', esc(f['Quantity / volume'])));
  }
  [
    ['Specification details', f['Specification details']],
    ['Destination market', f['Destination market / country']],
    ['Required timeline', f['Required timeline']],
    ['Regulatory requirement', f['Regulatory requirement']],
    ['Anything else', f['Anything else']],
  ].forEach(function (r) {
    if (r[1]) rows.push(row(r[0], escLines(r[1])));
  });
  rows.push(row('Company', esc(f['Company'])));
  rows.push(row('Email', escEmail(f['Email'])));
  if (f['Phone / WhatsApp']) rows.push(row('Phone / WhatsApp', esc(f['Phone / WhatsApp'])));

  var card =
    '<tr><td style="padding:22px 24px 6px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ' + C.line + ';border-radius:8px;border-collapse:separate;overflow:hidden;">' +
    '<tr><td style="background:' + C.steelDeep + ';padding:12px 18px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td>' + eyebrow('Your enquiry', '#ffffff') + '</td>' +
    '<td align="right" style="font:12px/1.4 ' + FONT + ';color:' + C.mist + ';">' + esc(date) + '</td>' +
    '</tr></table></td></tr>' +
    '<tr><td style="padding:6px 18px 8px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + rows.join('') + '</table>' +
    '</td></tr></table></td></tr>';

  var next =
    '<tr><td style="padding:20px 24px 6px;">' +
    '<p style="margin:0;font:15px/1.6 ' + FONT + ';color:' + C.steelDeep + ';">Need to add something, or have a specification sheet? Simply reply to this email and it reaches the same desk.</p>' +
    '<div style="margin-top:16px;">' +
    button('https://wa.me/' + WHATSAPP, 'WhatsApp us', true) +
    button(SITE + '/catalogue/', 'Browse the catalogue', false) +
    '</div>' +
    '<p style="margin:18px 0 0;font:15px/1.6 ' + FONT + ';color:' + C.ink + ';">Regards,<br><strong>Sales Desk</strong><br>MH PharmaPack</p>' +
    '</td></tr>';

  var footer =
    '<tr><td style="padding:22px 24px 24px;background:' + C.paperWarm + ';border-top:1px solid ' + C.line + ';">' +
    '<div style="font:700 12px/1.4 ' + FONT + ';letter-spacing:0.14em;color:' + C.ink + ';">MH PHARMAPACK</div>' +
    '<div style="margin-top:6px;font:13px/1.6 ' + FONT + ';color:' + C.steelDeep + ';">' + esc(ADDRESS) + '</div>' +
    '<div style="margin-top:4px;font:13px/1.6 ' + FONT + ';color:' + C.steelDeep + ';">' +
    '<a href="mailto:' + SALES_EMAIL_DEFAULT + '" style="color:' + C.copperDeep + ';text-decoration:none;">' + SALES_EMAIL_DEFAULT + '</a> &nbsp;·&nbsp; ' +
    '<a href="tel:' + PHONE_TEL + '" style="color:' + C.copperDeep + ';text-decoration:none;">' + esc(PHONE_DISPLAY) + '</a> &nbsp;·&nbsp; ' +
    '<a href="' + SITE + '" style="color:' + C.copperDeep + ';text-decoration:none;">mhpharmapack.com</a></div>' +
    '<div style="margin-top:12px;font:12px/1.5 ' + FONT + ';color:' + C.muted + ';">You are receiving this email because you sent an enquiry through mhpharmapack.com.</div>' +
    '</td></tr>';

  return page(
    'We have received your enquiry',
    'Your enquiry has reached our sales desk. A summary of what you sent is inside.',
    header + intro + card + next + footer
  );
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
