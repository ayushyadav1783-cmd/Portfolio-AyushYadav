# Match Day: Ayush Yadav's portfolio

**Live:** https://ayushyadav1783-cmd.github.io/Portfolio-AyushYadav/

The whole site is one match day: tunnel walkout, warm-up, a Starting VII of projects, power-ups, a Training Ground of live AI demos, the Fan Zone, and a full-time penalty shootout.

Built with Astro + TypeScript, GSAP (ScrollTrigger, SplitText, Flip), Lenis, OGL (WebGL) and matter-js.

## Run it

```sh
npm install
npm run dev        # http://localhost:4321/Portfolio-AyushYadav/
npm run build      # type-check + static build into dist/
npm run preview    # serve the production build
```

Node 22.12 or newer.

## Where things live

| Path | What |
|---|---|
| `src/content/content.json` | Projects, power-ups, stickers, highlights. The single source of truth for every number. |
| `src/content/copy.json` | Section copy, Training Ground text, shootout and transfer-bid copy |
| `src/content/repos.json` | "View the code" link for each project |
| `src/components/` | One Astro component per section, plus overlays (match reports, highlights, scouting report, SIUUU) |
| `src/motion/` | All motion: scroll, intro, broadcast bar, sections, cursor, magnetic buttons, easter eggs |
| `src/motion/training/` | The five live Training Ground drills (each lazy-loaded) |
| `src/motion/gl/sky.ts` | WebGL starfield and planet |
| `assets/` | Original resume PDF and portrait (the build copies the resume to `/resume.pdf`) |
| `MATCH_DAY_BUILD_SPEC.md` | The build spec, including every change agreed during the build |
| `design/` | The exported design canvas |

## Editing content

Change text or numbers in `src/content/*.json`, then rebuild. To swap the resume, replace `assets/resume.pdf`.

## Deploying

Every push to `main` runs `.github/workflows/deploy.yml`, which builds the site and publishes `dist/` to GitHub Pages. The site is served under `/Portfolio-AyushYadav/`; `astro.config.mjs` sets that as `base`. Use `withBase()` from `src/content` for any root path.

## SEO and metadata

`src/layouts/Base.astro` carries the meta tags: description, robots, canonical, Open Graph and Twitter cards (preview image `public/og.png`, 1200x630, a still of the hero), mobile web-app tags, and schema.org `Person` JSON-LD (public details only, never a phone number). Also in `public/`: `site.webmanifest` (installable, with maskable icon), `humans.txt`, `robots.txt`, `sitemap.xml`.

Note: GitHub Pages project sites serve under `/Portfolio-AyushYadav/`, and crawlers only read `robots.txt` at the host root, so on a custom domain move these to the domain root.

## TODO

- Real project visuals (splat fly-through, query heatmap, tracks GIF, registration overlay, pipeline diagram, UMAP plot, Optuna plot) to replace the animated illustrations
- Optional: a `.ply` / `.splat` export of the real lab capture for the Splat Lab drill
- Phase 11: sound toggle, Lighthouse pass
