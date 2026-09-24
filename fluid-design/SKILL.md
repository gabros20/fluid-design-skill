---
name: fluid-design
description: Build or convert a website onto a viewport-fluid design system where layout, type, spacing and element sizes scale from BOTH viewport axes off one measured unit, so desktop stays a proportional copy of the design frame at every size (one screen tall when height binds, pixel-exact at the reference), and phones, tablets and landscape phones scale the mobile design in bands of their own. Use it when a site should "scale with the viewport", "fit one screen", "match the Figma at every size" or look the same on a laptop and a 5K display; for fluid typography, clamp()/vw/svh sizing, one-screen sections, converting container layouts to fluid, or Tailwind/SCSS/CSS/StyleX tokens for it; for tuning how much type or layout shrinks per device band; for iOS/Safari viewport and render bugs (svh/lvh/dvh, toolbar tint, safe areas, dead sticky, empty SVGs); for image, SVG and video element sizing; for making fluid type follow browser zoom (WCAG 1.4.4); and for debugging sections losing height, type jumping mid-scroll, grids re-flowing on big screens, or a stale stylesheet (a page or scroll scene that looks broken right after a CSS edit and a dev-server restart is almost always this — check it here before debugging animation code). Use it even if nobody says "fluid". Not for animation (entrances, scroll scenes, video playback, GSAP, Lenis): use the companion `scroll-animation` skill.
---

# Fluid design

A method for turning a fixed design (a desktop artboard, usually 1440×900, and a 390 phone
artboard) into a site whose composition **scales as one drawing**. There is one measured unit,
`--fluid`: 1px at the artboard, moving with whichever viewport axis is tighter on desktop and with
the width on phones. Type roles derive from it and shrink more gently. Each device band (phone,
tablet, landscape phone, desktop) scales its own design; authors write each drawn number once.

This skill is extracted from a production marketing site. Most of its rules were paid for by a real
bug, and the reference files say which one. When a rule seems fussy, read its why before bending
it; the cheap-looking alternative has usually already been tried and removed.

This skill contains no animation. For entrances, scroll scenes and video playback, see
§Companion skill below.

## How it is organised: structure vs settings

| | What | Where | Change it with |
|---|---|---|---|
| **Structure** | which bands exist and their breakpoints, type role names, prefix, `ui`/zoom on or off, output stack and folder | `fluid.config.json` (≈15 lines, JSON Schema) | edit, then `fluid generate` |
| **Settings** | every number: artboard widths, scale min/max, per-band per-role damping, container width and padding, header heights, zoom text range | CSS variables `--fluid-<band>-<setting>`, registered with their defaults | set it in your own `:root` (next to your tokens). Live, no regenerate |

`references/config.md` lists every key and every setting with its default. It is generated from
`scripts/lib/spec.mjs`, the one place any name or default lives.

## What you get

| Piece | Where |
|---|---|
| The CLI: `init`, `generate`, `check`, `settings`, `explain`, `migrate`, `calc`, `probe`, `verify`, `audit` | `bin/fluid` (run it as `node <skill>/bin/fluid …` or put `bin/` on PATH) |
| Everything a project needs, generated into ONE folder (`output.dir`, default `src/styles/fluid/`) | `fluid.css` (the one import), `base.css`, `settings.reference.css`, `fluid.ts`, `cn.ts` / `_index.scss` / `fluid.stylex.ts`, `runtime/`, `integrations/`, `README.md` |
| Reference output per stack, at the defaults | `assets/styles/{tailwind-v4,css,scss,stylex}/` |
| The method, rules and the reasons behind them | `references/*.md` (read on demand, see the map below) |

Generate; never hand-write or hand-copy the output. It encodes measured numbers (the ×1000
precision form, the knee, the zoom runtime's detection thresholds) that a rewrite from memory loses.
`fluid generate` refuses to overwrite a hand-edited generated file.

## Workflow

### 1. Preflight: inspect first, then ask only what you cannot infer

Read the project before asking anything: `package.json`, the CSS entry, any `@theme`, existing
breakpoints and container widths, the framework and router, and whether the work is greenfield or
brownfield. Then settle the decisions in `references/preflight.md`. Each has a default; ask only
where the codebase does not already answer it and the choice matters.

- **Stack**: Tailwind v4 (default), CSS, SCSS, StyleX (CSS Modules use the CSS stack). `fluid init` detects it.
- **Artboards**: desktop base width × height (default 1440×900) and the phone artboard (390). These
  are settings; set them only if the design differs.
- **Bands**: phone, tablet (≥600), landscape phone (≤500 tall), desktop (≥1024). All on by default.
  `bands.phone: false` keeps a flat 1px below desktop (a separately authored mobile layout).
- **Container**: the centred page wrapper's max width and side padding per band (default 1680/80 desktop, 560/24 mobile).
- **Type roles**: `display` and `copy` by default; add e.g. `caption` for a third damped curve.
- **Growth ceiling**: none by default (`--fluid-desktop-scale-max`). Set one if assets cannot survive upscaling.
- **Browser zoom**: compensated (default). Needs one head script (`output.integration: next | vite` generates it).

Installed motion libraries (Motion, GSAP, Lenis, a header script) are noted in `FLUID.md` for the
`scroll-animation` skill and left alone here. Record the decisions in `fluid.config.json` and a
short `FLUID.md` decision log.

### 2. Install

```bash
node <skill>/bin/fluid init            # greenfield: writes fluid.config.json, generates, wires globals.css
node <skill>/bin/fluid init --brownfield   # existing site: base layer off, prints the import instead of editing
node <skill>/bin/fluid migrate --write     # a v1 fluid-design project (see references/brownfield-migration.md)
```

The result, for Tailwind:

```css
/* globals.css */
@import 'tailwindcss';
@import '../styles/fluid/fluid.css';   /* units, settings, base layer, breakpoints, band variants, utilities */

@theme { /* your tokens */ }
:root {
  /* your tokens */
  --fluid-phone-scale-min: 0.8;        /* only the fluid settings you change */
}
```

- **Browser zoom**: Next `<head><FluidHead /></head>` from `integrations/next`; Vite
  `plugins: [fluidPlugin()]` from `integrations/vite`; otherwise inline `FLUID_ZOOM_INLINE` from
  `runtime/zoom.js` first in `<head>`. Viewport-derived type does not grow under browser zoom on its
  own (`references/fluid-scale.md` §12).
- **Tailwind**: use `cn` from the generated `cn.ts` on every component that takes `className`, or
  two fluid classes for one property both ship and stylesheet order picks the winner.
- **Script**: import `DESKTOP_QUERY`, `MEDIA`, `fluidPx` from the generated `fluid.ts`; never
  hand-type the breakpoint.
- **SCSS**: import `fluid/fluid.css` once from the entry; `@use 'fluid' as fd;` for the functions
  and band mixins.
- Run `fluid check`, then **restart the dev server and open a fresh tab**, then
  `fluid probe <url>`. A stale stylesheet looks exactly like broken code (`references/verification.md` §6).

### 3. Build or convert sections, one at a time

Follow `references/section-recipe.md`. The core:

- One container per section, on its inner wrapper: `fluid-container` (max width and padding follow
  the band; `references/frame-and-gutter.md`).
- Check the **content budget** before building: the widest drawn desktop row has to fit the
  container at the artboard (1440 − 2 × 80 = 1280 at the defaults). `fluid calc budget --widths …`.
  A row over budget is a drawing problem or a `cqw` problem; a smaller padding never fixes it.
- Write every drawn number through a fluid utility: `lg:py-[120px]` becomes `lg:fluid-py-120`, and
  the phone number beside it: `fluid-py-48 lg:fluid-py-120`. Write the drawn number, never a converted one.
- Pick each type unit by what its container does (`references/typography.md`): `fluid-display-*` in
  a fixed column, `fluid-text-*` in a box that scales, `fluid-copy-*` for small labels and controls,
  `fluid-ui-*` in the header, nav and footer.
- A section drawn at the artboard height fits one screen with `lg:fluid-h-900`; taller ones take
  `lg:fluid-min-h-<drawn>`. One scale per page; no section re-anchors it.
- Off the scale on purpose: border and stroke widths, `em` tracking, text measures. Radii scale with
  their box (`fluid-rounded-*`).
- Need a band-only tweak? `fluid-tablet:`, `fluid-landscape:` (exclusive band variants), or a
  setting.
- Need part of the page to stop scaling? A **limit**, in window px, on its wrapper:
  `fluid-grow-until-1680` (holds its size above a 1680 window), `fluid-shrink-until-1280`,
  `fluid-off` (no scaling inside). Everything inside follows. For the site header use
  `:root { --fluid-ui-grow-until: 1680; }` so `--header-h` follows too (`references/fluid-scale.md` §10).
  Any other setting for one section: `class="fluid-scope"` plus the setting on it.

### 4. Tune with settings, not code

Tuning is editing numbers in `:root`: how small phones get (`--fluid-phone-scale-min`), how much
headings shrink on desktop (`--fluid-desktop-display-damping`), where growth stops
(`--fluid-desktop-scale-max`, or in window px `--fluid-grow-until: 1920`), the container
(`--fluid-desktop-container-width`). Settings, utilities and variants all autocomplete: Tailwind
IntelliSense lists every `fluid-*` class, and `fluid.css-data.json` completes settings in CSS files. `fluid explain
390x844` prints the band, every unit, and which default or `file:line` each value came from. An
invalid value falls back to its default; `fluid check` flags typos with a suggestion.

### 5. Tokens, media

Semantic tokens (surface, text, border, icon roles) alias a brand ramp, inline in `globals.css`;
components use the roles, never the ramp. `references/tokens-and-theming.md` has the traps that
compile cleanly and render wrong. Media: `references/media.md` (Safari SVG rules, reserving boxes,
posters) and `references/performance.md` (`sizes` on a page that grows past the artboard). How a
video *plays* is the `scroll-animation` skill.

### 6. Verify: at a matrix of viewports, never one

- `fluid check` — config, generated files, settings lint. Put it in CI.
- `fluid audit src` — a static scan for the silent failure modes. Fix every error.
- `fluid verify <url> --screens --fit-selector '[data-fit=screen]'` — widths 1024–2560 × heights
  640–1440 plus the phone/tablet/landscape set: horizontal overflow, every unit against the maths
  (computed from the page's own settings), one-screen fit, grid column counts, and a real browser
  zoom row. Run it again with `--browser webkit` and `--browser firefox`.
- At 1440×900 the page must match the design pixel for pixel. That point is the calibration check.
- iOS toolbar tint, `lvh` shortfall and safe areas can only be verified on a real device.
- Reveal, scene and anchor checks are the `scroll-animation` skill's `verify-motion`.

## Invariants: break one and the system stops working

1. `--fluid` is purely proportional on both arms, with no intercept, so `900 × --fluid = 100svh` whenever height binds.
2. The axes combine with `min()` (contain), never `max()` (cover).
3. Use `svh` for sizing. `dvh` resizes type while the reader scrolls. Pinned layers use `lvh`, and their cancelling negative margin must use the same unit.
4. The artboard is a viewport, not the container. The design can be drawn 1680 wide; the desktop base width is 1440.
5. One scale per page. Change how a part scales with a limit or its settings (a scope), never by redeclaring `--fluid`: custom properties resolve where they are declared, so the type units would not follow.
6. The number multiplied by a unit is unitless. `64px * var(--fluid)` is invalid and drops the declaration silently; settings are unitless too.
7. The container's max width and padding sit on one box. A text measure sits inside it and never replaces it.
8. Never put `transform` or `overflow-x: hidden` on a sticky ancestor. Either one silently turns sticky into static (`references/ios-safari.md` §6); use `overflow-x: clip`, and keep the horizontal guard on `html` only.
9. Never edit the generated folder. Structure goes in `fluid.config.json`, numbers in settings.

## Companion skill: `scroll-animation`

This skill makes the page the right size. The `scroll-animation` skill makes it move: triggered
entrances, pinned and scrubbed scenes, scroll wells, video playback, header ink, motion performance
and verification, coexistence with GSAP, Lenis and header scripts. Each works alone. Together they
meet at three points, all owned here (`references/contract.md` §4):

- **The desktop breakpoint.** `bands.desktop.minWidth`, emitted as `DESKTOP_QUERY` (alias
  `ENGAGE_QUERY`) in the generated `fluid.ts`. `scroll-animation` imports it rather than keeping its own number.
- **`--header-h`.** The fixed header's resting height (header settings). Anchor offsets, sticky tops and header-ink probes read it.
- **The `translate` property.** `fluid-translate-*` writes `translate`, so Motion's per-frame
  `transform` composes with it. GSAP folds `translate` into its own transform and freezes a
  px/`calc()` value, so with GSAP the offset goes on a child GSAP never tweens (`fluid-scale.md`
  §11). Drawn travel scales through `fluidPx()` from `fluid.ts`.

## Reference map

| Read | When |
|---|---|
| `references/preflight.md` | always, first: the decision list, detection hints, how to phrase each question |
| `references/config.md` | the exact name and default of any structure key or setting (generated) |
| `references/fluid-scale.md` | before touching units or settings: the model, the maths, bands, zoom, adding a role |
| `references/frame-and-gutter.md` | the container, a row that will not fit, grids that re-flow on big screens |
| `references/section-recipe.md` | every section, greenfield or converted |
| `references/typography.md` | choosing type units and roles, line boxes, hard breaks, fonts |
| `references/tokens-and-theming.md` | colour and semantic tokens, stack traps |
| `references/brownfield-migration.md` | converting an existing site, or a v1 fluid-design project |
| `references/stacks.md` | the differences between Tailwind v4, CSS, SCSS, StyleX and CSS Modules |
| `references/contract.md` | exact names of emitted custom properties, utilities, variants, `fluid.ts` exports, `data-*` attributes, and the interface with `scroll-animation` |
| `references/media.md` | any image, SVG or `<video>` element: sizing, reserving, Safari SVG rules, posters |
| `references/ios-safari.md` | anything mobile, Safari, full-height, sticky, or the toolbar tint |
| `references/performance.md` | before shipping: image `sizes` on a growing page, fonts, budgets |
| `references/verification.md` | how to prove it works; the stale-stylesheet diagnosis |
