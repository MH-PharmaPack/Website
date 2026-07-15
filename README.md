# MH PharmaPack Website

Marketing site for MH PharmaPack, a pharmaceutical sourcing and supply intermediary.
Built with Astro and Tailwind CSS, fully static output, hosted on GitHub Pages at
`mhpharmapack.com`.

## Commands

| Command           | Action                                       |
| :---------------- | :------------------------------------------- |
| `npm install`     | Install dependencies                         |
| `npm run dev`     | Start the dev server at `localhost:4321`     |
| `npm run build`   | Build the production site to `./dist/`       |
| `npm run preview` | Preview the production build locally         |

## Structure

- `src/config.ts`: site facts, contact endpoints, and nav in one place. Values pending
  from the client are empty strings; components render clearly marked placeholders.
- `src/styles/global.css`: the design tokens (steel/copper/ink palette, tracking, content
  width) as a Tailwind theme, plus shared button and eyebrow styles.
- `src/layouts/Base.astro`: head metadata, favicon set, header, footer, mobile sticky bar.
- `src/components/`: `Header`, `Footer`, `StickyBar`.
- `src/pages/`: one `.astro` file per route.
- `src/assets/logo/`: brand marks. The SVG geometry is machine-generated; do not hand-edit.
