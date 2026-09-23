# Preflight: settle the decisions before any code

Read when: starting any fluid-design task, greenfield or brownfield.
Skip when: `fluid.config.json` and `FLUID.md` already exist and the task stays inside their decisions.

Inspect the project first and ask second. Every question below has a default and a detection
hint. Ask only when detection is inconclusive **and** the answer changes the output. Put all the open
questions into one short batch; never ask one per turn. Once they are answered, write
`fluid.config.json` and a `FLUID.md` decision log at the project root.

## Detection pass (about two minutes, read-only)

| Look at | Tells you |
|---|---|
| `package.json` deps | framework (next, astro, vite, remix, sveltekit, nuxt), `tailwindcss` version, `sass`, `@stylexjs/*`, `motion` / `framer-motion`, `gsap`, `lenis`, `locomotive-scroll` |
| CSS entry (`globals.css`, `app.css`, `main.scss`) | `@import 'tailwindcss'` means v4; `@tailwind base` means v3; an existing `@theme`, custom breakpoints, `clamp()` / `vw` type |
| `tailwind.config.*` | v3 (see the v3 note in `stacks.md`) |
| container classes | `.container`, `max-w-7xl mx-auto px-*`, a hand-rolled wrapper: that is your current frame and gutter |
| breakpoints in use | the one where the desktop layout starts is your `engageAt` candidate |
| existing `vw`/`clamp` type | a prior fluid attempt; inventory it before replacing it (`brownfield-migration.md`) |
| `<video>` count, sticky/pinned sections | the size of the motion and scene work |
| Figma links or exported frames in the repo | canvas width and height |

## The decisions

### 1. Styling stack
Default: **Tailwind v4** if it is present or the project is greenfield. Otherwise use the stack the project already has.
- Tailwind v4 gets the richest artifact: arbitrary-number `@utility` families (`lg:fluid-py-120`).
- On Tailwind v3, recommend upgrading. If that is not possible, use the vanilla layer plus arbitrary values
  `lg:py-[calc(120*var(--fluid))]`. v3 has no functional `@utility`.
- SCSS, vanilla CSS, CSS Modules and StyleX all use the same units, through functions or `calc()` inside the engage media query.
- Ask when: nothing is installed yet, or two systems coexist.

### 2. Animation engine
Default: **Motion (`motion/react`)** in React projects; **GSAP** otherwise, or when the user needs
timeline-heavy choreography, SplitText-quality line reveals, or already runs GSAP.
- Both engines ship the same primitives, attribute contract and measured curves.
- There is one engine per element. GSAP may enter a Motion site as a scoped island for one section.
- Never add Lenis or any smooth-scroll hijack. Its lerp reshapes the native velocity curve that
  scroll-linked effects read, it breaks programmatic scroll locks, and on iOS it gains nothing.
  Smoothing belongs on effect outputs (a spring on the transform), never on the scrollbar. Tell the user this
  if they ask for it.
- Ask when: React is present and GSAP is also installed, or the user mentions timelines.

### 3. Design frame and reference viewport
Default: canvas **1680 × 900**, gutter **80**, reference **1440 × 900**.
- The canvas is the width the designer drew. The reference is the viewport where one unit is exactly
  1px. Keep the reference at the most common laptop viewport, 1440. Anchoring it to a 1680 canvas
  shrinks every rendering at 1440 by 14% and breaks the one-screen guarantee whenever width binds.
  This option was modelled and rejected twice (`fluid-scale.md` §Reference).
- The consequence: drawn content has to fit `reference.width − 2 × gutter`. Tell the designer early.
- Ask when: the frame size is not visible anywhere, or frames are not 900 tall.

### 4. Engage breakpoint
Default: **1024** (Tailwind `lg`). Below it the units are a flat 1px and mobile is plain responsive CSS.
- It must equal the breakpoint where the desktop composition begins. Two separate numbers here
  produce a band where desktop layout runs at mobile sizes.
- Ask when: the desktop layout starts somewhere else (768, 1280).

### 5. Height axis
Default: **on**. The height arm is what makes "one screen tall" possible.
- Turn it off (`heightAxis:false`) for document-style sites such as docs, blogs or dashboards. On those,
  scaling on a short window only shrinks things without buying any fit.
- Ask when: the design has no full-viewport sections.

### 6. Growth ceiling
Default: **none**. Above the reference the whole composition grows as one piece.
- The real limit is asset resolution: a 1920-wide render upscales about 1.3× on a 27" 5K. Either
  re-export the assets at about 3000 wide, or set `ceiling` (for example 1.5).
- Ask when: the hero art or video is raster and below about 2400px wide.

### 7. Scope
Default: **the whole site from the engage breakpoint up**, including chrome (header and footer on `--fluid-chrome`).
- For brownfield work, migrate one route as the reference implementation, then queue the rest.
- The shared elements (buttons, chips, CTAs) take an opt-in `fluid` prop, so migrated and
  unmigrated routes can coexist.

### 8. Scroll-driven scene
Default: **none**. Triggered entrances only.
- One per page at most. It needs an all-intra video (or a canvas/image sequence) and an act
  structure. Ask only if the design shows pinned or scrubbed content.

### 9. Header behaviour
Default: a fixed, transparent header whose ink follows the section beneath it (`data-header-theme`).
- Ask when: the design shows an opaque header bar, or no header at all.

### 10. Mobile
Default: **flat**. Mobile stays authored per breakpoint and is not scaled.
- A mobile fluid arm is possible (a second media block with a 390-wide reference), but it is not the
  default and was never validated in production. Offer it only if asked, and say so.

## Writing the result

`fluid.config.json` (schema: `assets/fluid.config.schema.json`) holds the numbers. `FLUID.md` holds
the reasons: the stack, engine, canvas and reference, anything that differs from the defaults and why,
the routes in scope, and the one scene if there is one. A few lines each. Both files are the handoff to
the next session.

## Phrasing the questions

Batch the questions, give each one its default, and let the user answer only the ones they care about:

> Before I set this up: (1) styling: Tailwind v4 (you have it) or SCSS? (2) animation: Motion (React
> default) or GSAP? (3) your Figma frames: 1680×900? I'll keep the reference at 1440×900. (4) any
> pinned or scrubbed video section? If you don't mind, I'll go with the defaults.
