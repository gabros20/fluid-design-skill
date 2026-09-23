---
name: fluid-design
description: Build or convert a website onto a viewport-fluid design system, where layout, type, spacing and element sizes scale from BOTH viewport axes off one measured unit, so a desktop composition is a faithful proportional copy of the design frame at every screen size (one screen tall when height binds, never overflowing, and pixel-exact at the reference). It also ships the motion system and scroll-driven scenes (triggered entrances, pinned scrubbed video, scroll wells) and the hard-won iOS 26 Safari, video and animation-performance fixes that go with it. Use this skill whenever someone wants a site to "scale with the viewport", "fit one screen", "match the Figma at every size", "look the same on a 13-inch laptop and a 5K display", or wants fluid/responsive typography, clamp()/vw/svh sizing, container-based layouts converted to fluid, an editorial or marketing landing page with scroll animation, a pinned or scrubbed video section, or a Tailwind, SCSS, vanilla-CSS or StyleX token setup for any of this. Also use it when debugging symptoms of such a system: a scroll video stuck on its first frame, sections losing their height, type that jumps size mid-scroll, broken sticky, blank reveals on mobile, or Safari-only rendering bugs. Use it even if the user never says "fluid".
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

## What you get

| Piece | Where |
|---|---|
| The method, rules and the reasons behind them | `references/*.md` (read on demand, see the map below) |
| Deterministic token generator + config | `scripts/generate-fluid.mjs`, `assets/fluid.config.json` |
| Ready unit/utility layers per styling stack | `assets/styles/{tailwind-v4,css,scss,stylex,shared}/` |
| Motion primitives, React + Motion | `assets/motion/react-motion/` |
| Motion primitives, GSAP (any framework) | `assets/motion/gsap/` |
| Static audit, viewport-matrix verifier, calculator, stale-CSS probe | `scripts/{audit,verify-matrix,calc,probe}.mjs` |

Copy the prepared artifacts; do not regenerate them from memory. They encode measured numbers and
comment trails that a from-scratch rewrite loses, which is the whole reason they are on disk.

## Workflow

### 1. Preflight: inspect first, then ask only what you cannot infer

Read the project before asking anything: `package.json`, the CSS entry, any Tailwind config or
`@theme`, existing breakpoints and container widths, the animation libraries already installed, the
framework and router, and whether the work is greenfield or brownfield. Then settle the decisions
in `references/preflight.md`. Each one has a default. Ask the user only where the codebase does not
already answer it and the choice matters.

- **Styling stack**: Tailwind v4 (default), vanilla CSS, SCSS, StyleX, or CSS Modules (which uses the vanilla layer).
- **Animation engine**: Motion for React (default in React projects) or GSAP (default outside React,
  or when the user wants timeline/SplitText-class choreography). Use one engine per element, never both on the same element.
- **Design frame**: the canvas width and height of the design (for example 1680×900) and the
  **reference viewport** (default 1440×900). These differ on purpose; see `references/fluid-scale.md` §Reference.
- **Engage breakpoint**: where the scale switches on (default 1024). Below it every unit is 1px.
- **Height axis**: on by default. Turn it off only for document-like sites with no one-screen sections.
- **Growth ceiling**: none by default. Set one if assets cannot survive upscaling.
- **Scope**: the whole site from the breakpoint up (default), or specific routes first during a brownfield migration.
- **Scroll-driven scene**: none, or one per page. The default is triggered entrances only.

Record the answers in `fluid.config.json` at the project root, together with a short `FLUID.md`
decision log. A later agent or a later you will need both.

### 2. Install the foundation

1. `node <skill>/scripts/generate-fluid.mjs --config fluid.config.json --stack <stack> --out <styles dir>`
   generates the units and utilities for the configured numbers. With defaults you can copy the
   pre-generated files directly.
2. Add `assets/styles/shared/base.css`, which holds the iOS and sticky-safe base layer. Read its comments; several
   rules are deliberate absences (no body background, no `theme-color`, no `overflow-x` on body).
3. Put the `<noscript>` reveal safety net in the document head (see `base.css`).
4. Set the engage breakpoint to the same value everywhere: the Tailwind `--breakpoint-lg`, SCSS
   `$engage`, JS `ENGAGE_QUERY`. Three copies of one number drift; that is why the config exists.
5. Tailwind only: register the fluid families with tailwind-merge (`assets/styles/tailwind-v4/cn.ts`),
   or `cn('lg:fluid-p-40', 'lg:fluid-p-24')` ships both classes and stylesheet order picks the winner.
6. Copy the motion primitives for the chosen engine (step 5).
7. **Restart the dev server and open a fresh tab**, then run `node <skill>/scripts/probe.mjs <url>`.
   A stale stylesheet looks exactly like broken code; see `references/verification.md`.

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
- Leave these off the scale: border widths, radii, `em` tracking, text measures.

### 4. Tokens and theming

Use semantic tokens (surface, text, border, icon roles) that alias a brand ramp. Components should
use the semantic tokens, never the ramp. Read `references/tokens-and-theming.md` for four traps
that compile cleanly and render wrong: a radius token of 0 does not stop `rounded-*`; `dark:`
without a custom variant fires on the OS setting; a missing token emits nothing; and a token name
shared with another codebase can mean something different there. It also covers the header ink
that follows the section beneath it (`data-header-theme`).

### 5. Motion

Read `references/motion-architecture.md` before adding any animation. The decision order is:

1. **Who owns the clock?** Trigger is the default and is almost free. Scroll-driven is a deliberate
   decision with real cost. Media-driven is the most expensive. Allow at most one scroll-driven scene per
   page, and only 1 to 3 on screen at once.
2. Entrances use `Stage`/`StageItem`: translate plus opacity on the measured `entrance` curve, with distances in
   CSS variables and one stage per arrival.
3. Exits over a pinned render use `FadeOnExit` (a hand-written style write, never a bound value).
4. A pinned, scrubbed video uses `ScrubStage`. It needs an all-intra asset, so read `references/video.md` and
   `references/scroll-scenes.md` first.
5. Components are extracted at their **second** consumer, never their first.

Engine specifics: `assets/motion/react-motion/README.md` or `assets/motion/gsap/README.md`.

### 6. Media

Images, video and SVG each have Safari-specific rules. Summary:
- Inline SVG (via svgr or equivalent) rather than `<img src=*.svg>`.
- Give every video `muted playsInline` and a deliberate `preload`, plus IntersectionObserver gating.
- Use an all-intra encode only for scrubbing.
- A poster cannot be art-directed, so put a `<picture>` underneath the video instead.

Details are in `references/video.md` and `references/ios-safari.md`.

### 7. Verify: at a matrix of viewports, never one

- `node scripts/audit.mjs src` is a static scan for the silent failure modes. Fix every error.
- `node scripts/verify-matrix.mjs <url> --reveal --screens --fit-selector '[data-fit=screen]'`
  covers widths 1024/1280/1440/1680/2560 × heights 640/700/800/900/1440, plus phones. It checks
  for horizontal overflow, compares the unit values against the maths, checks one-screen fit, and
  checks that every reveal actually fired. Keep 2560 in the matrix: frame drift and grid re-flow
  bugs only appear above the reference.
- At 1440×900 the page must match the design pixel for pixel. That point is the calibration check.
- iOS toolbar tint, `lvh` shortfall and video compositing can only be verified on a real device.
  Before asking for a device test, confirm the deployed build actually contains the fix.

## Invariants: break one and the system stops working

1. `--fluid` is purely proportional on both arms, with no intercept, so `900 × --fluid = 100svh` whenever height binds.
2. The axes combine with `min()` (contain), never `max()` (cover).
3. Use `svh` for sizing. `dvh` resizes type while the reader scrolls. Pinned layers use `lvh`, and their cancelling negative margin must use the same unit.
4. The reference is a viewport, not the canvas. The design can be drawn at 1680; the reference is 1440.
5. There is one scale per page. Custom properties resolve where they are declared, so overriding `--fluid` on a section does not re-derive the type units.
6. The number multiplied by a unit must be unitless. `64px * var(--fluid)` is invalid and drops the declaration without any error.
7. Frame and gutter sit on one box. A text measure sits inside the frame and never replaces it.
8. Nothing animates a transform on a sticky ancestor, a scene wrapper or a video ancestor.

## Reference map

| Read | When |
|---|---|
| `references/preflight.md` | always, first: the decision list, detection hints, and how to phrase each question |
| `references/fluid-scale.md` | before touching units or config: the model, the maths, the knobs, extending with a new role |
| `references/frame-and-gutter.md` | building any section frame, a row that will not fit, or grids that re-flow on big screens |
| `references/section-recipe.md` | every section, greenfield or converted |
| `references/typography.md` | choosing type units, line boxes, hard breaks, fonts |
| `references/tokens-and-theming.md` | colour and semantic tokens, header theme, stack traps |
| `references/brownfield-migration.md` | converting an existing container-based site |
| `references/stacks.md` | the differences between Tailwind v4, vanilla CSS, SCSS, StyleX and CSS Modules |
| `references/motion-architecture.md` | any animation |
| `references/scroll-scenes.md` | pins, scrubbing, latches, scroll wells, header-theme probing |
| `references/video.md` | any `<video>`, especially scrubbed or looping |
| `references/ios-safari.md` | anything mobile, Safari, or the toolbar/tint |
| `references/performance.md` | before shipping motion; budgets |
| `references/verification.md` | how to prove it works; the stale-stylesheet diagnosis |
