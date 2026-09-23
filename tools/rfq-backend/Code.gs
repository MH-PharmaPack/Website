/**
 * MH PharmaPack quote form backend (Google Apps Script web app).
 *
 * Receives the /contact form, then:
 *   1. checks it (spam trap, Cloudflare Turnstile when configured, rate
 *      limits, an allowlist of field names, required fields, lengths)
 *   2. emails the enquiry to the sales desk as "key: value" lines, with
 *      Reply-To set to the buyer, subject "RFQ: <Company>", and the
 *      buyer's name shown as the sender name
 *   3. emails the buyer a confirmation with a summary of what they sent
 *
 * Both emails are sent by the Google Workspace account that deploys this
 * script, so deploy it FROM the sales@mhpharmapack.com account: the
 * confirmation then comes from sales@ itself, signed by the domain's own
 * Google DKIM, and replies to it land in the same inbox.
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

    var sales = PropertiesService.getScriptProperties().getProperty('SALES_EMAIL') || SALES_EMAIL_DEFAULT;

    // 1. The enquiry, to the sales desk. It is sent by this account (the
    //    buyer's own address cannot be used as the sender: that would be
    //    spoofing, and their domain's DMARC would bounce or bin it), but the
    //    inbox shows the buyer's name as the sender and Reply goes to them,
    //    so it reads and answers like an email they sent.
    MailApp.sendEmail({
      to: sales,
      replyTo: email,
      subject: 'RFQ: ' + oneLine(f['Company']),
      body: toText(pairs),
      name: displayName(f['Name'], f['Company']),
    });

    // 2. The confirmation, to the buyer. Skipped (never the enquiry) if the
    //    day's sending quota is nearly spent.
    var confirmation = false;
    if (MailApp.getRemainingDailyQuota() > 5) {
      var summary = pairs.filter(function (p) {
        return HIDDEN_FROM_BUYER.indexOf(p[0]) < 0;
      });
      MailApp.sendEmail({
        to: email,
        replyTo: sales,
        subject: 'We have received your enquiry: MH PharmaPack',
        body: confirmationText(f['Name'], summary),
        htmlBody: confirmationHtml(f['Name'], summary),
        name: SENDER_NAME,
      });
      confirmation = true;
    }

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

// ---- Writing the emails ---------------------------------------------------------

function oneLine(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 120);
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

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function confirmationHtml(name, summary) {
  var rows = summary
    .map(function (p) {
      var head = /^Item \d+$/.test(p[0]);
      return (
        '<tr>' +
        '<td style="padding:6px 16px 6px 0;vertical-align:top;color:#37475b;white-space:nowrap;' +
        (head ? 'padding-top:14px;' : '') +
        '">' +
        esc(p[0]) +
        '</td>' +
        '<td style="padding:6px 0;vertical-align:top;color:#26303d;' +
        (head ? 'padding-top:14px;font-weight:600;' : '') +
        '">' +
        esc(p[1]).replace(/\n/g, '<br>') +
        '</td>' +
        '</tr>'
      );
    })
    .join('');
  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#26303d;max-width:600px">' +
    '<p>Dear ' + esc(oneLine(name)) + ',</p>' +
    '<p>Thank you for your enquiry. It has reached our sales desk, and we will review your requirement and respond at the earliest opportunity.</p>' +
    '<p>A summary of what you sent is below. If anything changes, or you have a specification sheet to share, simply reply to this email.</p>' +
    '<table style="border-collapse:collapse;font-size:14px;margin:18px 0 22px;border-top:1px solid #d3dae2;border-bottom:1px solid #d3dae2">' +
    rows +
    '</table>' +
    '<p style="margin:0">Regards,<br>Sales Desk<br><strong>MH PharmaPack</strong><br>' +
    '<span style="color:#717d8b;font-size:12px;letter-spacing:0.12em;text-transform:uppercase">Pharmaceutical Sourcing &amp; Supply</span></p>' +
    '<p style="margin-top:10px;font-size:13px;color:#37475b">' +
    '<a href="mailto:' + SALES_EMAIL_DEFAULT + '" style="color:#7f4526">' + SALES_EMAIL_DEFAULT + '</a> | ' + esc(PHONE_DISPLAY) + ' | ' +
    '<a href="' + SITE + '" style="color:#7f4526">mhpharmapack.com</a></p>' +
    '</div>'
  );
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
