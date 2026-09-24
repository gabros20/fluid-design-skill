---
name: fluid-design
description: Build or convert a website onto a viewport-fluid design system where layout, type, spacing and element sizes scale from BOTH viewport axes off one measured unit, so desktop stays a proportional copy of the design frame at every size (one screen tall when height binds, pixel-exact at the reference). Use it when a site should "scale with the viewport", "fit one screen", "match the Figma at every size" or look the same on a laptop and a 5K display; for fluid typography, clamp()/vw/svh sizing, one-screen sections, converting container layouts to fluid, or Tailwind/SCSS/CSS/StyleX tokens for it; for iOS/Safari viewport and render bugs (svh/lvh/dvh, toolbar tint, safe areas, dead sticky, empty SVGs); for image, SVG and video element sizing; for making fluid type follow browser zoom (WCAG 1.4.4); and for debugging sections losing height, type jumping mid-scroll, grids re-flowing on big screens, or a stale stylesheet (a page or scroll scene that looks broken right after a CSS edit and a dev-server restart is almost always this — check it here before debugging animation code). Use it even if nobody says "fluid". Not for animation (entrances, scroll scenes, video playback, GSAP, Lenis): use the companion `scroll-animation` skill.
---

# Fluid design

A method for turning a fixed design frame (usually Figma at 1440 to 1680 wide) into a site whose
desktop composition **scales as one drawing**. There is one measured unit, `--fluid`, which is 1px at
the reference viewport and moves with whichever viewport axis is tighter. Two type units derive from
it and shrink more gently than the layout. Everything below the engage breakpoint stays ordinary
mobile CSS.

This skill is extracted from a production marketing site. Most of its rules were paid for by a real bug, and the reference
files say which one. When a rule seems fussy, read its why before bending it; the cheap-looking
alternative has usually already been tried and removed.

This skill contains no animation. For entrances, scroll scenes and video playback, see
§Companion skill below.

## What you get

| Piece | Where |
|---|---|
| The method, rules and the reasons behind them | `references/*.md` (read on demand, see the map below) |
| Deterministic token generator + config | `scripts/generate-fluid.mjs`, `assets/fluid.config.json` |
| Ready unit/utility layers per styling stack | `assets/styles/{tailwind-v4,css,scss,stylex,ts,shared}/` |
| Browser-zoom compensation for the type units | `assets/runtime/fluid-zoom.{js,d.ts}` |
| The units as numbers for script (`fluidPx`, `onFluidChange`) | `assets/runtime/fluid-units.{js,d.ts}` |
| Static audit, viewport-matrix verifier, calculator, stale-CSS probe | `scripts/{audit,verify-matrix,calc,probe}.mjs` |

Copy the prepared artifacts; do not regenerate them from memory. They encode measured numbers and
comment trails that a from-scratch rewrite loses, which is the whole reason they are on disk.

## Workflow

### 1. Preflight: inspect first, then ask only what you cannot infer

Read the project before asking anything: `package.json`, the CSS entry, any Tailwind config or
`@theme`, existing breakpoints and container widths, the framework and router, and whether the work
is greenfield or brownfield. Then settle the decisions in `references/preflight.md`. Each one has a
default. Ask the user only where the codebase does not already answer it and the choice matters.

- **Styling stack**: Tailwind v4 (default), vanilla CSS, SCSS, StyleX, or CSS Modules (which uses the vanilla layer).
- **Design frame**: the canvas width and height of the design (for example 1680×900) and the
  **reference viewport** (default 1440×900). These differ on purpose; see `references/fluid-scale.md` §4.
- **Engage breakpoint**: where the scale switches on (default 1024). Below it every unit is 1px.
- **Height axis**: on by default. Turn it off only for document-like sites with no one-screen sections.
- **Growth ceiling**: none by default. Set one if assets cannot survive upscaling.
- **Scope**: the whole site from the breakpoint up (default), or specific routes first during a brownfield migration.
- **Mobile**: flat, authored per breakpoint (default), or the optional mobile arm: the phone design scales off its own 390 frame on phones, and is shown slightly larger in a centred column on portrait tablets and landscape phones, while landscape tablets get the desktop design scaled down. `fluid-py-48 lg:fluid-py-120` takes both numbers from their frames (`references/fluid-scale.md` §13).
- **Browser zoom**: compensated (default). Ask only if the site carries a legal accessibility obligation.

Installed motion libraries (Motion, GSAP, Lenis, a header script) are noted in `FLUID.md` for the
`scroll-animation` skill and left alone here.

Record the answers in `fluid.config.json` at the project root, together with a short `FLUID.md`
decision log. A later agent or a later you will need both.

### 2. Install the foundation

1. `node <skill>/scripts/generate-fluid.mjs --config fluid.config.json --stack <stack> --out <styles dir>`
   generates the units and utilities for the configured numbers. With defaults you can copy the
   pre-generated files directly. `--out` is a DIRECTORY, not the stylesheet path: each stack writes
   into its own `<out>/<stack>/` subfolder (`fluid.css`, plus `tokens.example.css`/`cn.ts`/`README.md`
   for `tailwind-v4`), and `<out>/shared/base.css` is always (re)written alongside it regardless of
   which `--stack` you asked for — see `scripts/generate-fluid.mjs --help` for the full layout.
   `--stack ts` also emits `fluid.config.ts` (`ENGAGE_PX`, `ENGAGE_QUERY`) for any script that needs
   the breakpoint.
2. Add `assets/styles/shared/base.css`, which holds the iOS and sticky-safe base layer. Read its comments; several
   rules are deliberate absences (no body background, no `theme-color`, no `overflow-x` on body).
   **Tailwind v4 only: import it with `@import '.../shared/base.css' layer(base);`.** An unlayered
   import beats every declaration inside Tailwind's own `@layer` blocks regardless of specificity or
   source order, so `base.css`'s `:focus-visible` outline and `button { cursor: pointer }` would
   silently override utilities meant to win. See `assets/styles/tailwind-v4/README.md`.
3. Set the engage breakpoint to the same value everywhere: the Tailwind `--breakpoint-lg`, SCSS
   `$fluid-engage-at`, and any JS query (import `ENGAGE_QUERY` from the generated `fluid.config.ts`).
   Three copies of one number drift; that is why the config exists.
4. Tailwind only: register the fluid families with tailwind-merge (`assets/styles/tailwind-v4/cn.ts`),
   or `cn('lg:fluid-p-40', 'lg:fluid-p-24')` ships both classes and stylesheet order picks the winner.
5. Inline `assets/runtime/fluid-zoom.js` in `<head>` (copy it with its `.d.ts`; in Next,
   `<script dangerouslySetInnerHTML={{ __html: FLUID_ZOOM_INLINE }} />`). Viewport-derived type does
   not grow under browser zoom on its own; with this script and `zoomCompensation` on, it zooms 1:1.
   See `references/fluid-scale.md` §12, Browser zoom.
6. **Restart the dev server and open a fresh tab**, then run `node <skill>/scripts/probe.mjs <url>`.
   A stale stylesheet looks exactly like broken code; see `references/verification.md` §6.

### 3. Build or convert sections, one at a time

Follow `references/section-recipe.md`. It is the checklist that keeps a section on the system. The
core of it:

- One frame per section: `lg:fluid-cap-<canvas> lg:fluid-px-<gutter> mx-auto max-w-[<canvas>px] px-6`.
  The cap and the gutter always sit on the same box (`references/frame-and-gutter.md`).
- Check the **content budget** before building: the widest drawn row has to fit
  `reference.width − 2 × gutter` (1280 at the defaults). Run `node scripts/calc.mjs budget --widths …`.
  A row over budget is a drawing problem or a `cqw` problem. A smaller gutter never fixes it.
- Write every drawn number through a fluid utility: `lg:py-[120px]` becomes `lg:fluid-py-120`.
  Write the drawn number itself, never a converted one.
- Pick each type unit by asking what its container does (`references/typography.md`). Display type
  in a fixed column uses `fluid-display-*`. Type in a box that itself scales uses `fluid-text-*`.
  Small labels and controls use `fluid-copy-*`.
- A section drawn at the reference height fits exactly one screen with `lg:fluid-h-900`. A section
  drawn taller takes `lg:fluid-min-h-<drawn>`. There is one scale for the whole page; no section
  re-anchors it.
- Leave these off the scale: border and stroke widths, `em` tracking, text measures. Radii scale with
  their box (`fluid-rounded-*`); `rounded-full` and % radii already do.

### 4. Tokens and theming

Use semantic tokens (surface, text, border, icon roles) that alias a brand ramp. Components should
use the semantic tokens, never the ramp. Read `references/tokens-and-theming.md` for the traps
that compile cleanly and render wrong: a radius token of 0 does not stop `rounded-*`; `dark:`
without a custom variant fires on the OS setting; a missing token emits nothing; a token name
shared with another codebase can mean something different there; and a px `--breakpoint-lg` among
rem defaults reorders every variant.

### 5. Media

Images, video and SVG each have Safari-specific rules (`references/media.md`). Summary:
- Size media in fluid units with CSS owning width and height; reserve every box against layout shift.
- Image `sizes` must allow for growth above the reference: the frame grows to `1680·f`, so a
  half-width image at f = 1.6 is about 1344px wide (`references/performance.md` §3). Write `sizes` in `vw`.
- Inline SVG (via svgr or equivalent) rather than `<img src=*.svg>`; strip its `width`/`height`.
- Every video that plays without a click gets `muted playsInline`, and `max-w-none` if it is
  deliberately oversized.
- A poster cannot be art-directed, so put a `<picture>` underneath the video instead.

How a video *plays* (scrubbing, loops, preload tiers, encoding) is the `scroll-animation` skill.

### 6. Verify: at a matrix of viewports, never one

- `node scripts/audit.mjs src` is a static scan for the silent failure modes. Fix every error.
- `node scripts/verify-matrix.mjs <url> --screens --fit-selector '[data-fit=screen]'`
  covers widths 1024/1280/1440/1680/2560 × heights 640/700/800/900/1440, plus phones. It checks
  for horizontal overflow, compares the unit values against the maths, checks one-screen fit, and
  reports grid column counts (`data-verify-grid`). Keep 2560 in the matrix: frame drift and grid
  re-flow bugs only appear above the reference. Its zoom row loads the page under real browser zoom
  and checks that text grows with it (point `--zoom-selector` at body copy). Run it once more with
  `--browser webkit` and `--browser firefox`: an engine difference passes every Chromium check.
- At 1440×900 the page must match the design pixel for pixel. That point is the calibration check.
- iOS toolbar tint, `lvh` shortfall and safe-area padding can only be verified on a real device.
  Before asking for a device test, confirm the deployed build actually contains the fix.
- Reveal, scene and anchor-jump checks are the `scroll-animation` skill's `verify-motion` script.

## Invariants: break one and the system stops working

1. `--fluid` is purely proportional on both arms, with no intercept, so `900 × --fluid = 100svh` whenever height binds.
2. The axes combine with `min()` (contain), never `max()` (cover).
3. Use `svh` for sizing. `dvh` resizes type while the reader scrolls. Pinned layers use `lvh`, and their cancelling negative margin must use the same unit.
4. The reference is a viewport, not the canvas. The design can be drawn at 1680; the reference is 1440.
5. There is one scale per page. Custom properties resolve where they are declared, so overriding `--fluid` on a section does not re-derive the type units.
6. The number multiplied by a unit must be unitless. `64px * var(--fluid)` is invalid and drops the declaration without any error.
7. Frame and gutter sit on one box. A text measure sits inside the frame and never replaces it.
8. Never put `transform` or `overflow-x: hidden` on a sticky ancestor. Either one silently turns
   sticky into static (`references/ios-safari.md` §6); use `overflow-x: clip`, and keep the
   horizontal guard on `html` only.

## Companion skill: `scroll-animation`

This skill makes the page the right size. The `scroll-animation` skill makes it move: triggered
entrances, pinned and scrubbed scenes, scroll wells, looping and scrubbed video playback, header ink
that follows the section underneath, motion performance and motion verification, and coexistence
with existing GSAP, Lenis and header scripts. Each skill works alone. When both are installed they
meet at three points, all owned here (`references/contract.md` §4):

- **The engage constant.** `engageAt` in `fluid.config.json`, emitted as `ENGAGE_QUERY` in
  `fluid.config.ts` by `--stack ts`. `scroll-animation` reads it rather than keeping its own number.
- **`--header-h`.** The fixed header's resting height. Anchor offsets, sticky tops and header-ink
  probes read it.
- **The `translate` property.** `fluid-translate-*` writes `translate`, so Motion's per-frame
  `transform` composes with it. GSAP folds `translate` into its own transform and freezes a
  px/`calc()` value, so with GSAP the offset goes on a child GSAP never tweens (`fluid-scale.md`
  §11). Small entrance offsets stay fixed px; drawn travel scales (`fluidPx()`,
  `assets/runtime/fluid-units.js`).

## Reference map

| Read | When |
|---|---|
| `references/preflight.md` | always, first: the decision list, detection hints, and how to phrase each question |
| `references/fluid-scale.md` | before touching units or config: the model, the maths, the knobs, extending with a new role |
| `references/frame-and-gutter.md` | building any section frame, a row that will not fit, or grids that re-flow on big screens |
| `references/section-recipe.md` | every section, greenfield or converted |
| `references/typography.md` | choosing type units, line boxes, hard breaks, fonts |
| `references/tokens-and-theming.md` | colour and semantic tokens, stack traps |
| `references/brownfield-migration.md` | converting an existing container-based site |
| `references/stacks.md` | the differences between Tailwind v4, vanilla CSS, SCSS, StyleX and CSS Modules |
| `references/contract.md` | the exact name of a config key, emitted custom property, utility or `data-*` attribute, and the interface with `scroll-animation` |
| `references/media.md` | any image, SVG or `<video>` element: sizing, reserving, Safari SVG rules, posters |
| `references/ios-safari.md` | anything mobile, Safari, full-height, sticky, or the toolbar/tint |
| `references/performance.md` | before shipping: image `sizes` on a growing page, fonts, `content-visibility`, budgets |
| `references/verification.md` | how to prove it works; the stale-stylesheet diagnosis |
