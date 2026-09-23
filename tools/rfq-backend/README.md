# Quote form backend

The `/contact` form posts here. `Code.gs` is a Google Apps Script web app that
runs on the company's own Google Workspace account. It emails each enquiry to
the sales desk and sends the buyer a confirmation from sales@mhpharmapack.com.
It is free, and no third-party form service ever sees the buyer's data.

Why not Web3Forms (the original default in CLAUDE.md): its free tier cannot
send the buyer a confirmation email. Autoresponders are a paid feature there.

## What happens when someone presses Send

1. The browser checks the form, then runs the Cloudflare Turnstile spam check
   (invisible for most people) if a site key is configured.
2. It POSTs the enquiry as JSON to this script.
3. The script checks it: the hidden spam-trap field, the Turnstile token,
   rate limits (3 per address per 10 minutes, 40 per hour overall), the
   allowed field names, required fields and lengths.
4. It sends **the enquiry to sales@**, as `key: value` lines, subject
   `RFQ: <Company>`, **Reply-To set to the buyer**, so pressing Reply answers
   them directly.
5. It sends **the buyer a confirmation**, from sales@, with a summary of what
   they sent. Their reply to it lands in the sales@ inbox.
6. The page shows the success state.

If anything fails, the page keeps everything typed and offers the same
enquiry by email (a prefilled `mailto:`).

## One-time setup (about 10 minutes)

Do all of this signed in as **sales@mhpharmapack.com**. The emails are sent
by whichever account deploys the script.

1. Go to <https://script.google.com> and create a **New project**. Name it
   "MH quote form".
2. Replace the contents of `Code.gs` with this folder's `Code.gs`. Save.
3. **Deploy > New deployment**. Type: **Web app**.
   - Execute as: **Me (sales@mhpharmapack.com)**
   - Who has access: **Anyone**
4. Authorize when Google asks. It requests "send email as you" and "connect
   to an external service" (the second is only the Turnstile check).
5. Copy the **Web app URL** (it ends in `/exec`) and send it to whoever builds
   the site. It goes into `FORM_ENDPOINT` in `src/config.ts`.

### Spam check (Cloudflare Turnstile, free)

1. In a Cloudflare account, open **Turnstile** and add a widget for
   `mhpharmapack.com` (mode: Managed).
2. The **site key** goes into `TURNSTILE_SITE_KEY` in `src/config.ts`.
3. The **secret key** goes into this script: **Project settings > Script
   properties > Add property**, name `TURNSTILE_SECRET`. It never goes in
   the website's code.

Set both keys or neither. With a secret here and no site key on the page,
every submission would be refused.

## Changing the script later

Edit, then **Deploy > Manage deployments > (edit) > Version: New version**.
Editing a deployment keeps the same URL. Making a new deployment creates a
new URL, which the site would then need.

## Limits

Google Workspace allows 1,500 email recipients a day from Apps Script. Each
enquiry uses two (sales@ and the buyer). If the day's quota is nearly spent,
the script still sends the enquiry to sales@ and skips only the confirmation.
