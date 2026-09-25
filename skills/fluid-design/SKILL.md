---
name: fluid-design
description: >-
  Build or convert a website onto a viewport-fluid design scale: layout, type, spacing and sizes
  scale from both viewport axes off one measured unit, so desktop stays a proportional copy of the
  design frame (one screen tall, pixel-exact at the reference, right on a 5K display) and phone,
  tablet and landscape bands scale their own design. Use for "scale with the viewport", "fit one
  screen", "match the Figma at every size", fluid type, clamp()/vw/svh sizing, fluid Tailwind, CSS,
  SCSS or StyleX tokens, iOS Safari viewport bugs, media sizing, browser zoom, or a page that looks
  broken after a CSS edit and a dev-server restart (a stale stylesheet), even if nobody says
  "fluid". Not for animation.
---

# Fluid design

## Mission and boundary

A method for turning a fixed design (a desktop artboard, usually 1440×900, and a 390 phone
artboard) into a site whose composition **scales as one drawing**. There is one measured unit,
`--fluid`: 1px at the artboard, moving with whichever viewport axis is tighter on desktop and with
the width on phones. Type roles derive from it and shrink more gently. Each device band (phone,
tablet, landscape phone, desktop) scales its own design; authors write each drawn number once.

This skill is extracted from a production marketing site. Most of its rules were paid for by a real
bug, and the reference files say which one. When a rule seems fussy, read its why before bending
it; the cheap-looking alternative has usually already been tried and removed.

This skill contains no animation: it makes the page the right size. Motion code in the project
reads three things from it, all owned here ([contract.md](references/contract.md) §7):

- **The desktop breakpoint.** `bands.desktop.minWidth`, emitted as `DESKTOP_QUERY` in the generated
  `fluid.ts`. Motion code imports it rather than keeping its own number.
- **`--fluid-header-h`.** The fixed header's resting height (header settings). Anchor offsets, sticky
  tops and header-ink probes read it (`--header-h` is its v1 name, emitted only with `aliases: true`).
- **The `translate` property.** `fluid-translate-*` writes `translate`, so Motion's per-frame
  `transform` composes with it. GSAP folds `translate` into its own transform and freezes a
  px/`calc()` value, so with GSAP the offset goes on a child GSAP never tweens (`fluid-scale.md`
  §11). Drawn travel scales through `fluidPx()` from `fluid.ts`.

## Route before acting

1. Inspect the request and the project (see workflow step 1) before reading anything else.
2. Always start with preflight; then add only the references the task touches.
3. Read every selected reference completely before producing the affected change.
4. Do not load unrelated references.

| User intent | Read or run | Expected contribution |
|---|---|---|
| Any fluid-design task, first | [preflight.md](references/preflight.md) | the decision list, detection hints, how to phrase each question |
| The exact name and default of a structure key or setting | [config.md](references/config.md) (generated) | the key or `--fluid-*` setting to write, and its default |
| Touching units or settings; the model, the maths, bands, zoom, adding a role | [fluid-scale.md](references/fluid-scale.md) | the reasoning behind every number, scopes and limits |
| The container, a row that will not fit, grids that re-flow on big screens | [frame-and-gutter.md](references/frame-and-gutter.md) | one container per section, the content budget, `cqw` escapes |
| Every section, greenfield or converted | [section-recipe.md](references/section-recipe.md) | the per-section checklist and shipped anatomy |
| Choosing type units and roles, line boxes, hard breaks, fonts | [typography.md](references/typography.md) | the type unit per text element |
| Colour and semantic tokens, stack traps | [tokens-and-theming.md](references/tokens-and-theming.md) | tokens in `globals.css`, the traps that compile clean and render wrong |
| Converting an existing site, or a v1 fluid-design project | [brownfield-migration.md](references/brownfield-migration.md) | `fluid migrate`, route-by-route conversion, an existing `cn` |
| Tailwind v4 vs CSS, SCSS, StyleX and CSS Modules | [stacks.md](references/stacks.md) | the authoring surface per stack |
| Browser floor per stack; exact emitted names, utilities, variants, `fluid.ts` exports, `data-*` attributes, what motion code reads | [contract.md](references/contract.md) | the checked vocabulary |
| Any image, SVG or `<video>` element: sizing, reserving, Safari SVG rules, posters | [media.md](references/media.md) | media sized and reserved in fluid units |
| Anything mobile, Safari, full-height, sticky, or the toolbar tint | [ios-safari.md](references/ios-safari.md) | iOS render fixes and the device-only checks |
| Before shipping: image `sizes` on a growing page, fonts, budgets | [performance.md](references/performance.md) | the render budget |
| Proving it works; the stale-stylesheet diagnosis | [verification.md](references/verification.md) | the tiers, the matrix, the stale-CSS check |

## Universal invariants

Break one and the system stops working:

1. `--fluid` is purely proportional on both arms, with no intercept, so `900 × --fluid = 100svh` whenever height binds.
2. The axes combine with `min()` (contain), never `max()` (cover).
3. Use `svh` for sizing. `dvh` resizes type while the reader scrolls. Pinned layers use `lvh`, and their cancelling negative margin must use the same unit.
4. The artboard is the design frame, not the container. Base width × height = the desktop frame the designer draws on (1440×900 by default, 1680×1050 if that is the frame); the container width is the content box. Only a canvas wider than a screen (1680×900) takes the screen it was composed for (1440×900) as its base.
5. One scale per page. Change how a part scales with a limit or its settings (a scope), never by redeclaring `--fluid`: custom properties resolve where they are declared, so the type units would not follow.
6. The number multiplied by a unit is unitless. `64px * var(--fluid)` is invalid and drops the declaration silently; settings are unitless too.
7. The container's max width and padding sit on one box. A text measure sits inside it and never replaces it.
8. Never put `transform` or `overflow-x: hidden` on a sticky ancestor. Either one silently turns sticky into static ([ios-safari.md](references/ios-safari.md) §6); use `overflow-x: clip`, and keep the horizontal guard on `html` only.
9. Never edit the generated folder. Structure goes in `fluid.config.json`, numbers in settings.

Generate; never hand-write or hand-copy the output. It encodes measured numbers (the ×1000
precision form, the knee, the zoom runtime's detection thresholds) that a rewrite from memory loses.
`fluid generate` refuses to overwrite a hand-edited generated file.

## Core workflow

The CLI is `bin/fluid`: `init`, `generate`, `check`, `settings`, `explain`, `migrate`, `calc`,
`verify`, `audit`. Run it as `node <skill>/bin/fluid …` or put `bin/` on PATH. The same CLI ships as
`npx fluid-design-cli@2` and as a standalone binary for people without an agent (documented in the
repository's by-hand guide); a project may already use one of those, so don't install a second.

### 1. Preflight: inspect first, then ask only what you cannot infer

Read the project before asking anything: `package.json`, the CSS entry, any `@theme`, existing
breakpoints and container widths, the framework and router, and whether the work is greenfield or
brownfield. Then settle the decisions in [preflight.md](references/preflight.md). Each has a
default; ask only where the codebase does not already answer it and the choice matters.

- **Stack**: Tailwind v4 (default), CSS, SCSS, StyleX (CSS Modules use the CSS stack). `fluid init` detects it
  (Tailwind 3 gets the CSS stack). Browser floor: Tailwind v4's own; Safari 15.4 on the others
  ([contract.md](references/contract.md) §0).
- **Artboards**: the desktop frame's width × height from the design file (default 1440×900) and the
  phone frame's width (390). Read them off the frames, don't assume the defaults. These are settings.
- **Bands**: phone, tablet (≥600), landscape phone (≤500 tall), desktop (≥1024). All on by default.
  `bands.phone: false` keeps a flat 1px below desktop (a separately authored mobile layout).
- **Container**: the centred page wrapper's max width and side padding per band (default 1680/80 desktop, 560/24 mobile).
- **Type roles**: `display` and `copy` by default; add e.g. `caption` for a third damped curve.
- **Growth ceiling**: none by default (`--fluid-desktop-scale-max`). Set one if assets cannot survive upscaling.
- **Browser zoom**: compensated (default). Needs one head script (`output.integration: next | vite` generates it).

Installed motion libraries (Motion, GSAP, Lenis, a header script) are noted in `FLUID.md` and left
alone. Record the decisions in `fluid.config.json` and a
short `FLUID.md` decision log.

### 2. Install

```bash
node <skill>/bin/fluid init            # greenfield: writes fluid.config.json, generates, wires globals.css
node <skill>/bin/fluid init --brownfield   # existing site: base layer off, prints the import instead of editing
node <skill>/bin/fluid migrate --write     # a v1 fluid-design project (see references/brownfield-migration.md)
```

Pass the preflight answers as flags rather than editing files after: `--desktop 1600x1000`
(the design frame), `--desktop-at 1200`, `--phone 375`, `--no-mobile` (flat below desktop),
`--max-width 1920`, and any setting as `--set --fluid-desktop-scale-max=1.4` (repeatable,
validated). Setting answers land as real declarations in the project's `:root`; structure answers
in `fluid.config.json`. Your shell is not a terminal, so init never prompts you; a human running it
by hand gets the same decisions as questions.

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
  `plugins: [fluidPlugin()]` from `integrations/vite`; anything else
  `<script src="…/runtime/zoom.classic.js">` first in `<head>` (or `FLUID_ZOOM_INLINE` pasted into
  it). Under a strict CSP pass `nonce` to `FluidHead`/`fluidPlugin`, or allow `FLUID_ZOOM_SHA256`.
  Viewport-derived type does not grow under browser zoom on its own ([fluid-scale.md](references/fluid-scale.md) §12).
- **Tailwind `cn`**: every component that takes `className` needs a `cn` that knows the fluid
  classes, or two fluid classes for one property both ship and stylesheet order picks the winner.
  **If the project already has one** (shadcn's `src/lib/utils.ts`, any file importing
  `tailwind-merge`), keep it and its callers, and change only how it builds `twMerge`: pass the
  generated `withFluid` to `extendTailwindMerge` (the exact lines:
  [preflight.md](references/preflight.md) §13). Never add a second `cn`.
  No `cn` at all: import the generated one. `fluid init` prints the lines for the file it finds.
- **Script**: import `DESKTOP_QUERY`, `MEDIA`, `fluidPx` from the generated `fluid.ts`; never
  hand-type the breakpoint.
- **SCSS**: import `fluid/fluid.css` once from the entry; `@use 'fluid' as fd;` for the functions
  and band mixins.
- Run `fluid check`, then **restart the dev server and open a fresh tab**, then
  `fluid explain 1440x900 --url <url> --brief` (verdict OK / STALE / MISMATCH / V1 / MISSING). A
  stale stylesheet looks exactly like broken code ([verification.md](references/verification.md) §6).

### 3. Build or convert sections, one at a time

Follow [section-recipe.md](references/section-recipe.md). The core:

- One container per section, on its inner wrapper: `fluid-container` (max width and padding follow
  the band; [frame-and-gutter.md](references/frame-and-gutter.md)).
- Check the **content budget** before building: the widest drawn desktop row has to fit the
  container at the artboard (1440 − 2 × 80 = 1280 at the defaults). `fluid calc budget --widths …`.
  A row over budget is a drawing problem or a `cqw` problem; a smaller padding never fixes it.
- Write every drawn number through a fluid utility: `lg:py-[120px]` becomes `lg:fluid-py-120`, and
  the phone number beside it: `fluid-py-48 lg:fluid-py-120`. Write the drawn number, never a converted one.
  Bare numbers in 0.25 steps, anything else bracketed (`fluid-p-[8.3]`). The `/lh` modifier is drawn px
  too (`fluid-copy-18/26`); for a ratio use `leading-[1.2]`.
- Pick each type unit by what its container does ([typography.md](references/typography.md)):
  `fluid-display-*` in a fixed column, `fluid-text-*` in a box that scales, `fluid-copy-*` for small
  labels and controls, `fluid-ui-*` in the header, nav and footer.
- A section drawn at the artboard height fits one screen with `lg:fluid-h-900`; taller ones take
  `lg:fluid-min-h-<drawn>`. One scale per page; no section re-anchors it.
- Off the scale on purpose: border and stroke widths, `em` tracking, text measures. Radii scale with
  their box (`fluid-rounded-*`).
- Need a band-only tweak? `fluid-tablet:`, `fluid-landscape:` (exclusive band variants), or a
  setting. The desktop band is `lg:`. Never put a band variant and `sm:`/`md:`/`max-*:` on the same
  property: band variants sort after every breakpoint, so they always win ([contract.md](references/contract.md) §3).
- Need part of the page to stop scaling? A **limit**, in window px, on its wrapper:
  `fluid-grow-until-1680` (holds its size above a 1680 window), `fluid-shrink-until-1280`,
  `fluid-off` (no scaling inside). Everything inside follows. For the site header use
  `:root { --fluid-ui-grow-until: 1680; }` so `--fluid-header-h` follows too ([fluid-scale.md](references/fluid-scale.md) §10).
  Any other setting for one section: `class="fluid-scope"` plus the setting on it. A limit behind
  `*:` or `[&_…]:` makes nothing a scope; put it on the element itself.

### 4. Tune with settings, not code

Tuning is editing numbers in `:root`: how small phones get (`--fluid-phone-scale-min`), how much
headings shrink on desktop (`--fluid-desktop-display-damping`), where growth stops
(`--fluid-desktop-scale-max`, or in window px `--fluid-grow-until: 1920`), the container
(`--fluid-desktop-container-width`). Settings, utilities and variants all autocomplete: Tailwind
IntelliSense lists every `fluid-*` class, and `fluid.css-data.json` completes settings in CSS files. `fluid explain
390x844` prints the band, every unit, and which default or `file:line` each value came from;
`--set --fluid-grow-until=1680` answers a what-if without editing; `--url <dev server>` reads the
live page and lists every limited subtree with what inside follows the scale (a limit with nothing
fluid inside is flagged), and `--at 'header'` explains one element. An
invalid value falls back to its default; `fluid check` flags typos with a suggestion.

### 5. Tokens, media

Semantic tokens (surface, text, border, icon roles) alias a brand ramp, inline in `globals.css`;
components use the roles, never the ramp. [tokens-and-theming.md](references/tokens-and-theming.md)
has the traps that compile cleanly and render wrong. Media: [media.md](references/media.md) (Safari
SVG rules, reserving boxes, posters) and [performance.md](references/performance.md) (`sizes` on a
page that grows past the artboard). How a video *plays* is out of scope.

### 6. Verify at a matrix of viewports, never one

Run every gate under **Completion and handoff** below before calling the work done.

## Artifact contract

### Structure vs settings

| | What | Where | Change it with |
|---|---|---|---|
| **Structure** | which bands exist and their breakpoints, type role names, prefix, `ui`/zoom on or off, output stack and folder | `fluid.config.json` (≈15 lines, JSON Schema) | edit, then `fluid generate` |
| **Settings** | every number: artboard widths, scale min/max, per-band per-role damping, container width and padding, header heights, zoom text range | CSS variables `--fluid-<band>-<setting>`, registered with their defaults | set it in your own `:root` (next to your tokens). Live, no regenerate |

[config.md](references/config.md) lists every key and every setting with its default. It is
generated from `scripts/lib/spec.mjs`, the one place any name or default lives.

### What the project ends up with

| Piece | Where |
|---|---|
| The decisions | `fluid.config.json` (structure) and a short `FLUID.md` decision log at the project root |
| Everything a project needs, generated into ONE folder (`output.dir`, default `src/styles/fluid/`) | `fluid.css` (the one import), `base.css`, `settings.reference.css`, `fluid.ts`, `cn.ts` / `_index.scss` / `fluid.stylex.ts`, `runtime/`, `integrations/`, `README.md` |
| The settings the project changes | real declarations in the project's own `:root`, next to its tokens |
| Sections | one `fluid-container` per section on its inner wrapper, every drawn number through a fluid utility |

### What this pack ships

| Piece | Where |
|---|---|
| The CLI | `bin/fluid` (runs `scripts/cli/index.mjs`; the tools are `scripts/tools/`) |
| Reference output per stack, at the defaults | `assets/styles/{tailwind-v4,css,scss,stylex}/` |
| The example config and its JSON Schema | `assets/fluid.config.json`, `assets/fluid.config.schema.json` |
| The method, rules and the reasons behind them | `references/*.md` (read on demand, see the routes above) |

## Completion and handoff

Verify at a matrix of viewports, never one:

- `fluid check` — config, generated files, settings lint, and the audit's source rules (a `cn` without
  `withFluid`, a limit class on `<header>`, a band variant mixed with a breakpoint, a limit on
  children, a `/1.5` line-height ratio). Resolve every error **and every warning** before calling
  the work done; put it in CI. `--verbose` adds info notes (your own `--fluid-*` tokens).
- `fluid audit src` — a static scan for the silent failure modes. Fix every error.
- `fluid verify <url> --screens --fit-selector '[data-fit=screen]'` — widths 1024–2560 × heights
  640–1440 plus the phone/tablet/landscape set: horizontal overflow, every unit against the maths
  (computed from the page's own settings), one-screen fit, grid column counts, and a real browser
  zoom row. Run it again with `--browser webkit` and `--browser firefox`.
- At 1440×900 the page must match the design pixel for pixel. That point is the calibration check.
- iOS toolbar tint, `lvh` shortfall and safe areas can only be verified on a real device.

Before completion, report which gates ran and which remain (a real device, a design sign-off), and
record decisions and open questions in `FLUID.md`. When motion work follows, point it at
`fluid.config.json`, `FLUID.md` and the three points above (`DESKTOP_QUERY`, `--fluid-header-h`,
the `translate` property) rather than restating them.
