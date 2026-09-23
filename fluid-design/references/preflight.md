# Preflight: settle the decisions before any code

Read when: starting any fluid-design task, greenfield or brownfield.
Skip when: `fluid.config.json` and `FLUID.md` already exist and the task stays inside their decisions.

Inspect the project first and ask second. Every question below has a default and a detection
hint. Ask only when detection is inconclusive **and** the answer changes the output. Put all the open
questions into one short batch; never ask one per turn. Once they are answered, write
`fluid.config.json` and a `FLUID.md` decision log at the project root.

This skill makes no animation decisions. Engine choice, scroll-driven scenes, header behaviour on
scroll and what to do with existing motion code belong to the companion `scroll-animation` skill,
which has its own preflight.

## Detection pass (about two minutes, read-only)

| Look at | Tells you |
|---|---|
| `package.json` deps | framework (next, astro, vite, remix, sveltekit, nuxt), `tailwindcss` version, `sass`, `@stylexjs/*` |
| `package.json` motion deps: `motion` / `framer-motion`, `gsap`, `lenis`, `locomotive-scroll` | nothing for this skill. Note them in `FLUID.md` for the `scroll-animation` skill; do not remove or rewire them here |
| CSS entry (`globals.css`, `app.css`, `main.scss`) | `@import 'tailwindcss'` means v4; `@tailwind base` means v3; an existing `@theme`, custom breakpoints, `clamp()` / `vw` type |
| `tailwind.config.*` | v3 (see the v3 note in `stacks.md`) |
| container classes | `.container`, `max-w-7xl mx-auto px-*`, a hand-rolled wrapper: that is your current frame and gutter |
| breakpoints in use | the one where the desktop layout starts is your `engageAt` candidate |
| existing `vw`/`clamp` type | a prior fluid attempt; inventory it before replacing it (`brownfield-migration.md`) |
| `<video>` count, sticky/pinned sections | the media rendering work (`media.md`); any scene or playback work is for the `scroll-animation` skill |
| Figma links or exported frames in the repo | canvas width and height |

## The decisions

### 1. Styling stack
Default: **Tailwind v4** if it is present or the project is greenfield. Otherwise use the stack the project already has.
- Tailwind v4 gets the richest artifact: arbitrary-number `@utility` families (`lg:fluid-py-120`).
- On Tailwind v3, recommend upgrading. If that is not possible, use the vanilla layer plus arbitrary values
  `lg:py-[calc(120*var(--fluid))]`. v3 has no functional `@utility`.
- SCSS, vanilla CSS, CSS Modules and StyleX all use the same units, through functions or `calc()` inside the engage media query.
- Ask when: nothing is installed yet, or two systems coexist.

### 2. Design frame and reference viewport
Default: canvas **1680 × 900**, gutter **80**, reference **1440 × 900**.
- The canvas is the width the designer drew. The reference is the viewport where one unit is exactly
  1px. Keep the reference at the most common laptop viewport, 1440. Anchoring it to a 1680 canvas
  shrinks every rendering at 1440 by 14% and breaks the one-screen guarantee whenever width binds.
  This option was modelled and rejected twice (`fluid-scale.md` §4).
- The consequence: drawn content has to fit `reference.width − 2 × gutter`. Tell the designer early.
- Ask when: the frame size is not visible anywhere, or frames are not 900 tall.

### 3. Engage breakpoint
Default: **1024** (Tailwind `lg`). Below it the units are a flat 1px and mobile is plain responsive CSS.
- It must equal the breakpoint where the desktop composition begins. Two separate numbers here
  produce a band where desktop layout runs at mobile sizes.
- If the `scroll-animation` skill is also in use, it reads this same number from `fluid.config.json`,
  so record it there and nowhere else.
- Ask when: the desktop layout starts somewhere else (768, 1280).

### 4. Height axis
Default: **on**. The height arm is what makes "one screen tall" possible.
- Turn it off (`heightAxis:false`) for document-style sites such as docs, blogs or dashboards. On those,
  scaling on a short window only shrinks things without buying any fit.
- Ask when: the design has no full-viewport sections.

### 5. Growth ceiling
Default: **none**. Above the reference the whole composition grows as one piece.
- The real limit is asset resolution: a 1920-wide render upscales about 1.3× on a 27" 5K. Either
  re-export the assets at about 3000 wide, or set `ceiling` (for example 1.5).
- Ask when: the hero art or video is raster and below about 2400px wide.

### 6. Scope
Default: **the whole site from the engage breakpoint up**, including chrome (header and footer on `--fluid-chrome`).
- For brownfield work, migrate one route as the reference implementation, then queue the rest.
- The shared elements (buttons, chips, CTAs) take an opt-in `fluid` prop, so migrated and
  unmigrated routes can coexist.

### 7. Mobile
Default: **flat**. Mobile stays authored per breakpoint and is not scaled.
- A mobile fluid arm is possible (a second media block with a 390-wide reference), but it is not the
  default and was never validated in production. Offer it only if asked, and say so.

### 8. Browser zoom
Default: **compensated** (`zoomCompensation: true`, plus `assets/runtime/fluid-zoom.js` inlined in `<head>`).
- Viewport-derived type does not grow under browser zoom on its own, which fails WCAG 1.4.4 on
  displays wider than about 1440 (`fluid-scale.md` §12, Browser zoom). The runtime restores 1:1 text
  zoom in Chromium; Safari and Firefox are unverified.
- Ask when: the site has a legal accessibility obligation (public sector, the EU Accessibility Act,
  a WCAG AA contract). Then say plainly that compliance must be checked in the client's target
  browsers, and that mobile body copy should be drawn no smaller than the desktop size.
- Turn it off only with the client's informed agreement, recorded in `FLUID.md`.

## Writing the result

`fluid.config.json` (schema: `assets/fluid.config.schema.json`) holds the numbers. `FLUID.md` holds
the reasons: the stack, canvas and reference, anything that differs from the defaults and why,
the routes in scope, and any motion libraries found (noted for the `scroll-animation` skill). A few
lines each. Both files are the handoff to the next session.

## Phrasing the questions

Batch the questions, give each one its default, and let the user answer only the ones they care about:

> Before I set this up: (1) styling: Tailwind v4 (you have it) or SCSS? (2) your Figma frames:
> 1680×900? I'll keep the reference at 1440×900. (3) does the desktop layout start at 1024? If you
> don't mind, I'll go with the defaults.

## Traps

- Asking one question per turn. Batch them, each with its default.
- Anchoring the reference to the canvas width (1680) instead of the laptop viewport (1440).
- Recording the engage breakpoint in more than one place. Three copies of one number drift.
- Treating "ignores the browser font-size setting" as covering zoom. They are different; zoom must work.
- Removing or rewiring an installed motion library during preflight. That decision belongs to the
  `scroll-animation` skill; here you only note it.
