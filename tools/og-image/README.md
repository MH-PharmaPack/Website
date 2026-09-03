# Social preview and schema logo, how they are made

Two PNGs in `public/` are generated, not hand-drawn. If the hero headline changes, or
the logo is ever regenerated from the pipeline, these have to be rebuilt or the link
preview will quote copy the site no longer uses.

| File | Size | What consumes it |
| --- | --- | --- |
| `public/og-image.png` | 1200x630 | `og:image` and `twitter:image`. WhatsApp, LinkedIn, Slack, Teams, X. This is what a cold-email recipient sees when they paste the link into a chat. |
| `public/logo-512.png` | 512x512 | `Organization.logo` in the JSON-LD graph. Google requires a raster format it can index (it does not take the brand SVG) that reads correctly on a plain white ground. |

## Rebuilding

Both are screenshots of a local HTML file, taken with headless Edge. There is no
build step and no dependency: the sources are `og.html` and `logo-512.html` in this
folder, and they reference the real logo asset and the real Inter file out of
`node_modules`, so what you see is the shipping font and the shipping mark.

```powershell
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$here = "<absolute path to this folder>"

& $edge --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files `
  --virtual-time-budget=8000 --window-size=1200,630 `
  --screenshot="$here\og-image.raw.png" "file:///$($here.Replace('\','/'))/og.html"

& $edge --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files `
  --virtual-time-budget=8000 --window-size=512,512 `
  --screenshot="$here\logo-512.raw.png" "file:///$($here.Replace('\','/'))/logo-512.html"
```

The raw screenshots come out around 210 KB and 130 KB, which is more than a link
preview should cost. Run them through the palette quantiser before committing; it
takes both under 50 KB with no visible loss, and unlike JPEG it leaves the type
edges clean:

```powershell
node tools/og-image/squeeze.mjs <folder with the .raw.png files> public
```

## Rules the images have to keep

- **Light ground only.** The brand mark is a textured raster keyed to alpha and is
  built for near-white backgrounds. On a dark ground it breaks. The steel-deep band
  at the foot of the OG image carries no mark for exactly this reason.
- **The headline in `og.html` must match the site's H1.** A preview that promises
  different copy than the page is the one thing worse than no preview.
- **No certification marks.** WHO GMP, EU GMP, ISO, PIC/S and MHRA belong to the
  partner plants, and a badge row under the MH lockup reads as MH's own
  accreditation. CONTENT-SPEC guardrail 2 applies to the social card as much as to
  the page.
- **1200x630 exactly.** Every platform crops from this ratio. Changing it means
  changing `OG_IMAGE_WIDTH` and `OG_IMAGE_HEIGHT` in `src/lib/seo.ts` too, because
  those are declared in the meta tags.
- Keep the filenames stable. Platforms cache aggressively by URL; a new filename is
  the reliable way to force a re-scrape if a preview goes stale.
