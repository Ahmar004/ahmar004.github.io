# Ahmar Ali — interactive portfolio

A portfolio built around a slingshot playfield. Six crates hang from an
overhead beam, each labelled with a section of the CV. Knock one down and its
section lights up below and the page scrolls to it.

Built with [three.js](https://threejs.org) for rendering and
[cannon-es](https://pmndrs.github.io/cannon-es/) for physics. No 3D model
files — every mesh and texture is generated procedurally at boot, so the whole
site is a few hundred kilobytes.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # → dist/
npm run preview    # serve dist/ on http://localhost:4173
```

## Editing the content

**Everything lives in `src/content.js`.** Both the crate labels and the HTML
sections are generated from it, so a CV update means editing one file. Adding a
section means adding an entry there *and* a crate position in
`LAYOUTS.landscape.crates` / `LAYOUTS.portrait.crates` in `src/game/world.js`.

## How it fits together

| File | Responsibility |
| --- | --- |
| `src/content.js` | Single source of truth for all portfolio content |
| `src/ui/sections.js` | Renders the content into HTML |
| `src/ui/app.js` | Nav, theme, scroll reveal, unlock choreography, persistence |
| `src/game/index.js` | Renderer, physics world, input, frame loop |
| `src/game/world.js` | Lighting, scenery, and the two crate layouts |
| `src/game/crates.js` | Hanging targets, breaking, debris |
| `src/game/slingshot.js` | Slingshot, bands, trajectory preview |
| `src/game/objects.js` | Procedural textures, birds, geometry helpers |
| `src/game/sound.js` | Synthesised sound effects (no audio files) |
| `src/game/quality.js` | Device tier detection and the perf watchdog |

The game is strictly additive. `src/main.js` renders the portfolio first, then
lazy-loads the playfield. If WebGL is unavailable, the import fails, or the
visitor prefers reduced motion, every section is revealed immediately and the
site behaves like an ordinary scrolling portfolio.

### Design rules worth keeping

- **The game is never a gate.** Sections also reveal on scroll, via nav links,
  and via the "Skip the game" button. Content is always in the DOM — "locked"
  is a visual state only, so search engines and screen readers see everything.
- **Content reveal and game progress are separate.** Scrolling reveals a
  section; only shooting marks a crate broken. A visitor who scrolled last time
  still finds a full board on their next visit.
- **Portrait gets its own layout.** Phones get smaller crates in three rows of
  two, with the bounds ratio matched to a phone screen. Crossing the
  orientation threshold rebuilds the scene.
- **The canvas renders with alpha.** The sky is the CSS gradient on
  `.playfield`, so the light/dark toggle recolours it with no WebGL work.
- **The render loop pauses when the playfield scrolls off screen**, so reading
  the portfolio costs no GPU time.

## Checking it

With `npm run preview` running in another terminal:

```bash
node tools/screenshots.mjs
```

Writes PNGs to `tools/shots/` for desktop, mobile, light theme and the
reduced-motion fallback, fires shots until a crate breaks, and reports any
console errors.

## Deploying

### GitHub Pages (current setup)

`.github/workflows/deploy.yml` builds on every push to `main` and publishes
`dist/`. One-time setup: **Settings → Pages → Source → GitHub Actions**.

`vite.config.js` uses `base: './'`, so the same build works on a user site
(`ahmar004.github.io`), a project site (`/portfolio/`), or anywhere else.

### Vercel

Works with no configuration — import the repo and accept the detected Vite
preset. Worth doing if you want preview deployments per branch, Brotli
compression, or a serverless contact endpoint later.

## Licence and artwork

The birds, crates and slingshot are original low-poly artwork generated in
code. This is a homage to the slingshot-physics genre and deliberately uses no
third-party characters, names, or assets.
