---
name: fluid-design
description: >-
  Build or convert a website onto a viewport-fluid scale: one measured unit sizes layout, type and
  spacing from the window, so desktop stays a proportional copy of the design frame (one screen
  tall, pixel-exact at its size) and phone, tablet and landscape bands scale
  their own design. Use for "scale with the viewport", "fit one screen", "match the Figma at every
  size", fluid type, clamp()/vw/svh sizing, fluid Tailwind, CSS, SCSS or StyleX tokens, iOS Safari
  viewport bugs, media sizing, browser zoom, or a stale stylesheet after a CSS edit, even if nobody
  says "fluid". Not for animation.
---

# Fluid design

## Mission and boundary

This skill turns a fixed design into a site that **scales as one drawing**. The **design frame**
(the artboard) is the frame the designer draws in: desktop 1440×900 and phone 390 wide by default.
One unit, `--fluid`, is 1px at the design frame's size and grows and shrinks with the window (on
desktop with whichever axis is tighter, on phones with the width). Type roles derive from it and
shrink more gently. Each **band** (phone, tablet, landscape = a phone on its side, desktop) scales
its own design, so authors write each drawn number once.

Most rules record the production bug that paid for them. Read a rule's reason before bending it:
the cheap alternative has usually been tried and removed.

The skill adds no animation. Motion code reads three things from it ([contract.md](references/contract.md) §7):

- **The desktop breakpoint**: `bands.desktop.minWidth`, exported as `DESKTOP_QUERY` from the
  generated `fluid.ts`. Never hand-type the number.
- **`--fluid-header-h`**: the fixed header's resting height, for anchor offsets and sticky tops
  (`--header-h` is its v1 name, emitted only with `aliases: true`).
- **The `translate` property**: `fluid-translate-*` writes `translate`, so Motion's `transform`
  composes with it. GSAP folds `translate` into its own transform and freezes it, so with GSAP put
  the offset on a child GSAP never tweens ([fluid-scale.md](references/fluid-scale.md) §7). Drawn
  travel scales through `fluidPx()`.

## Route before acting

1. Inspect the project (workflow step 1) before reading anything else.
2. Always start with preflight, then read only the references the task touches, each one completely.

| Task | Read |
|---|---|
| Any task, first: the decisions, how to detect and ask | [preflight.md](references/preflight.md) |
| The exact name and default of a structure key or `--fluid-*` setting | [config.md](references/config.md) (generated) |
| The model and the maths of the base unit: axes, precision, the design frame, the ceiling, settings vs structure, animation interop | [fluid-scale.md](references/fluid-scale.md) |
| Type roles and damping (where type holds its size), the ui unit, the header height, the container units, adding a role | [units.md](references/units.md) |
| The phone, tablet, landscape and desktop bands: switches, continuity, full width, a designed tablet | [bands.md](references/bands.md) |
| A part that stops scaling (limits), a part with its own settings (scopes), why a section never re-anchors the scale | [limits-and-scopes.md](references/limits-and-scopes.md) |
| Browser zoom (WCAG 1.4.4): the head script, CSP, detection, the mobile handover | [browser-zoom.md](references/browser-zoom.md) |
| The container, the content budget, a row that will not fit, an edge-to-edge strip (`fluid-bleed-x`), grids that re-flow | [frame-and-gutter.md](references/frame-and-gutter.md) |
| Every section, new or converted: the checklist | [section-recipe.md](references/section-recipe.md) |
| Type units, roles, line boxes, named type styles, buttons around a label, fonts | [typography.md](references/typography.md) |
| Colour and semantic tokens; traps that compile clean and render wrong | [tokens-and-theming.md](references/tokens-and-theming.md) |
| Converting an existing site or a v1 project: `fluid migrate`, route by route, legacy tokens, an existing `cn` | [brownfield-migration.md](references/brownfield-migration.md) |
| Tailwind v4 vs CSS, SCSS, StyleX, CSS Modules | [stacks.md](references/stacks.md) |
| Browser floor per stack; exact utilities, variants, `fluid.ts` exports, `data-*` attributes | [contract.md](references/contract.md) |
| Any image, SVG or `<video>`: sizing, reserving, Safari SVG rules, posters | [media.md](references/media.md) |
| Mobile, Safari, full height, sticky, the toolbar tint, hydration | [ios-safari.md](references/ios-safari.md) |
| Before shipping: image `sizes` on a growing page, fonts, budgets | [performance.md](references/performance.md) |
| Proving it works: the tiers, the viewport matrix, a stale stylesheet | [verification.md](references/verification.md) |

## Universal invariants

Break one and the system stops working:

1. `--fluid` is purely proportional on both axes, with no added constant, so `900 × --fluid = 100svh` whenever height is the tighter axis.
2. Combine the axes with `min()` (fit inside), never `max()` (cover).
3. Size with `svh`. `dvh` resizes type while the reader scrolls. Pinned layers use `lvh`, and their cancelling negative margin uses the same unit.
4. The reference is the design frame, not the container. Base width × height = the desktop frame the designer draws on (read it off the design); the container width is the content box. Only a canvas wider than a screen (1680×900) takes the screen it was composed for (1440×900) as its base.
5. One scale per page. Change how a part scales with a limit or a scope's settings, never by redeclaring `--fluid`: custom properties resolve where they are declared, so the type units would not follow.
6. The number multiplied by a unit has no unit. `64px * var(--fluid)` is invalid and drops the declaration silently; settings have no units either.
7. The container's max width and padding sit on one box. A text measure sits inside it and never replaces it.
8. Never put `transform` or `overflow-x: hidden` on a sticky element's ancestor: either one silently turns sticky into static ([ios-safari.md](references/ios-safari.md) §6). Use `overflow-x: clip`, and keep the horizontal guard on `html` only.
9. Never edit the generated folder. Structure goes in `fluid.config.json`, numbers in settings.

Generate the output; never hand-write or copy it. It holds measured numbers (the ×1000 precision
form, where type holds its size, the zoom detection thresholds) that a rewrite from memory loses.
`fluid generate` refuses to overwrite a hand-edited generated file.

## Core workflow

The CLI is `bin/fluid` (`node <skill>/bin/fluid --help` lists the commands). It also ships as
`npx fluid-design-cli@2` and a standalone binary; `fluid init` adds a `fluid` script to
`package.json`, so the team and CI run `npm run fluid -- check` without the skill. Use what the
project already has.

### 1. Preflight: inspect first, then ask only what you cannot infer

Read `package.json`, the CSS entry, any `@theme`, existing breakpoints and container widths, the
framework and router, and whether the site is new or existing. Then settle the decisions in
[preflight.md](references/preflight.md). Each has a default; ask only when the code does not answer
it and the answer changes the output.

- **Stack**: Tailwind v4 (default), CSS, SCSS, StyleX (CSS Modules use the CSS stack). `fluid init`
  detects it; Tailwind 3 gets the CSS stack.
- **Design frames**: read every band's frame size off the design. The defaults (desktop 1440×900,
  phone 390) are fallbacks only; phone frames are often 402 wide (iPhone 16 Pro), not 390.
- **Bands**: phone, tablet (≥600), landscape (≤500 tall), desktop (≥1024), all on. Tablet and
  landscape usually have no frame: they run the phone design full width with a 32px gutter (the
  default). `bands.phone: false` keeps a flat 1px below desktop (a hand-built mobile layout).
- **Container**: max width and side padding per band: desktop 1680/80, phone 560/24, tablet and
  landscape full width/32. The padding never drops below the safe-area inset.
- **Type roles**: `display` and `copy`; add a role (e.g. `caption`) for a third type curve.
- **Growth ceiling**: none (`--fluid-desktop-scale-max`). Set one if raster assets cannot be upscaled.
- **Browser floor**: Tailwind v4's own, Safari 15.4 on the other stacks ([contract.md](references/contract.md) §0).
  If the team avoids newer CSS (`cqw`, the `lh` unit), the references give a plain alternative.
- **Browser zoom**: compensated (default); needs one head script.

Note installed motion libraries in `FLUID.md` and leave them alone. Record the decisions in
`fluid.config.json` and a short `FLUID.md` decision log.

### 2. Install

```bash
node <skill>/bin/fluid init                # new site: writes fluid.config.json, generates, wires globals.css
node <skill>/bin/fluid init --brownfield   # existing site: base layer off, prints the import instead of editing
node <skill>/bin/fluid migrate --write     # a v1 fluid-design project (brownfield-migration.md)
```

Pass the preflight answers as flags: `--desktop 1600x1000` (the design frame), `--desktop-at 1200`,
`--phone 402`, `--no-mobile`, `--max-width 1920` (the desktop container), any setting as
`--set --fluid-desktop-scale-max=1.4` (repeatable). Settings land in the project's `:root`, structure
in `fluid.config.json`. Init never prompts an agent; in a terminal a person gets the same questions.

The result, for Tailwind:

```css
/* globals.css */
@import 'tailwindcss';
@import '../styles/fluid/fluid.css';   /* units, settings, base layer, breakpoints, band variants, utilities */

:root {
  /* your tokens, and only the fluid settings you change */
  --fluid-phone-base-width: 402;
}
```

- **Browser zoom**: Next `<head><FluidHead /></head>` from `integrations/next`; Vite
  `plugins: [fluidPlugin()]` from `integrations/vite`; anything else
  `<script src="…/runtime/zoom.classic.js">` first in `<head>`. Under a strict CSP pass `nonce`, or
  allow `FLUID_ZOOM_SHA256` ([browser-zoom.md](references/browser-zoom.md) §3).
- **Tailwind `cn`**: every component that takes `className` needs a `cn` that knows the fluid
  classes, or two fluid classes for one property both ship and stylesheet order picks the winner.
  If the project has one (any file importing `tailwind-merge`), keep it and pass the generated
  `withFluid` to `extendTailwindMerge` ([preflight.md](references/preflight.md) §13). Never add a
  second `cn`. No `cn` at all: import the generated one.
- Script imports `DESKTOP_QUERY`, `MEDIA`, `fluidPx` from `fluid.ts`. SCSS imports `fluid/fluid.css`
  once and `@use 'fluid' as fd;`.
- Run `fluid check`, then **restart the dev server and open a fresh tab**, then
  `fluid explain 1440x900 --url <url> --brief` (verdict OK / STALE / MISMATCH / V1 / MISSING). A
  stale stylesheet looks exactly like broken code ([verification.md](references/verification.md) §6).

### 3. Build or convert sections, one at a time

Follow [section-recipe.md](references/section-recipe.md). The core:

- One `fluid-container` per section, on its inner wrapper. Its width and padding follow the band
  ([frame-and-gutter.md](references/frame-and-gutter.md)).
- Check the **content budget** first: the widest drawn desktop row must fit the container at the
  design frame (1440 − 2 × 80 = 1280 at the defaults; `fluid calc budget --widths …`). A row over
  budget is a drawing problem or a `cqw` problem; a smaller padding never fixes it.
- Write every drawn number through a fluid utility, unconverted: `fluid-py-48 lg:fluid-py-120`.
  Bare numbers in 0.25 steps, anything else bracketed (`fluid-p-[8.3]`). The `/lh` modifier is drawn
  px too (`fluid-copy-18/26`); for a ratio use `leading-[1.2]`.
- Pick each type unit by what its box does ([typography.md](references/typography.md)):
  `fluid-display-*` in a fixed column, `fluid-text-*` in a box that scales, `fluid-copy-*` for small
  text and labels, `fluid-ui-*` in the header, nav and footer.
- A control sizes on its label's unit: `fluid-copy-14/20` text in a `fluid-copy-h-56 fluid-copy-px-24`
  button (role box utilities `fluid-<role>-h/w/size/p/px/py/gap-*`).
- A strip that runs to the window edges but keeps its content on the container's line (a carousel
  track): `fluid-bleed-x` inside the container.
- A section drawn at the design frame's height fits one screen with `lg:fluid-h-900`; taller ones
  take `lg:fluid-min-h-<drawn>`.
- Keep off the scale on purpose: border and stroke widths, `em` tracking, text measures. Radii scale
  with their box (`fluid-rounded-*`).
- A band-only tweak: `fluid-tablet:`, `fluid-landscape:`, or a setting; desktop is `lg:`. Never put a
  band variant and `sm:`/`md:`/`max-*:` on the same property: band variants always win
  ([contract.md](references/contract.md) §3).
- A part that should stop scaling gets a **limit** on its wrapper, in window px:
  `fluid-grow-until-1680`, `fluid-shrink-until-1280`, `fluid-off`. For the site header use
  `:root { --fluid-ui-grow-until: 1680; }` so `--fluid-header-h` follows ([limits-and-scopes.md](references/limits-and-scopes.md) §2).
  Any other setting for one part: a **scope** (`class="fluid-scope"` plus the setting on it). A
  limit behind `*:` or `[&_…]:` scopes nothing; put it on the element itself.

### 4. Tune with settings, not code

Tuning is editing numbers in `:root`, live: how small phones get (`--fluid-phone-scale-min`), how
much headings shrink (`--fluid-desktop-display-damping`), where growth stops
(`--fluid-grow-until: 1920`), the page gutter (`--fluid-desktop-container-padding: 108` moves every
section at once). `fluid settings` lists every setting with its default; Tailwind IntelliSense
completes every `fluid-*` class (`output.editor: true` adds settings autocomplete for VS Code).
`fluid explain 390x844` prints the band, every unit and where each value came from (`--set` for a
what-if, `--url` for the live page, `--at 'header'` for one element). An invalid value falls back to
its default; `fluid check` flags typos.

### 5. Tokens, media, then verify

Semantic tokens alias a brand ramp in `globals.css`; components use the roles
([tokens-and-theming.md](references/tokens-and-theming.md)). Media: [media.md](references/media.md),
[performance.md](references/performance.md). Then run every gate under **Completion and handoff**,
at a matrix of viewports, never one.

## Artifact contract

### Structure vs settings

| | What | Where | Change it with |
|---|---|---|---|
| **Structure** | which rules exist: bands and breakpoints, type roles, prefix, `ui`/zoom on or off, output stack and folder | `fluid.config.json` | edit, then `fluid generate` |
| **Settings** | every number: frame sizes, scale min/max, damping, container width and padding, header heights, limits | CSS variables `--fluid-<band>-<setting>` with registered defaults | set in your own `:root`; live, no regenerate |

[config.md](references/config.md) lists every key and setting with its default.

### What the project ends up with

| Piece | Where |
|---|---|
| The decisions | `fluid.config.json` (its `$schema` points at the published schema) and `FLUID.md` at the project root |
| The CLI for the team and CI | a `fluid` script in `package.json`: `npm run fluid -- check` |
| One generated folder (`output.dir`, default `src/styles/fluid/`) | `fluid.css` (the one import), `base.css`, `fluid.ts`, `cn.ts` / `_index.scss` / `fluid.stylex.ts`, `runtime/`, `integrations/`, `README.md`; with `output.editor: true` also `settings.reference.css` and `fluid.css-data.json` |
| The settings the project changes | declarations in the project's own `:root`, next to its tokens |
| Sections | one `fluid-container` each, every drawn number through a fluid utility |

### What this pack ships

| Piece | Where |
|---|---|
| The CLI | `bin/fluid` (runs `scripts/cli/index.mjs`; the tools are `scripts/tools/`) |
| Reference output per stack, at the defaults | `assets/styles/{tailwind-v4,css,scss,stylex}/` |
| The example config and its JSON Schema | `assets/fluid.config.json`, `assets/fluid.config.schema.json` |
| The method and the reasons | `references/*.md` (see the routes above) |

## Completion and handoff

- `fluid check`: config, generated files, settings lint and source rules. Resolve every error **and
  every warning**; run it in CI as `npm run fluid -- check`.
- `fluid audit src`: a static scan for the silent failures. Fix every error.
- `fluid verify <url> --screens --fit-selector '[data-fit=screen]'`: 1024–2560 wide × 640–1440 tall
  plus the phone, tablet and landscape set: overflow, every unit against the maths, one-screen fit,
  grid column counts, real browser zoom. Run it again with `--browser webkit` and `--browser firefox`.
- At the design frame's size (1440×900 by default) the page matches the design pixel for pixel.
- The iOS toolbar tint, the `lvh` shortfall and safe areas need a real device.

Report which gates ran and which remain (a real device, a design sign-off), and record decisions and
open questions in `FLUID.md`. When motion work follows, point it at `fluid.config.json`, `FLUID.md`
and the three points above rather than restating them.
