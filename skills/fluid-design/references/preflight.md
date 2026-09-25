# Preflight: settle the decisions before any code

Purpose: The decisions to settle before any code (stack, artboards, bands, container, type roles,
growth ceiling, browser zoom), each with its default, a detection hint and how to phrase the
question.

Read when: starting any fluid-design task, greenfield or brownfield.
Skip when: `fluid.config.json` and `FLUID.md` already exist and the task stays inside their decisions.
Inputs: the project (`package.json`, CSS entry, `@theme`, breakpoints, container widths, framework
and router) and the design frames.
Produces: the answers as `fluid init` flags and settings, `fluid.config.json`, and a `FLUID.md`
decision log.

## Contents

- Detection pass (about two minutes, read-only)
- The decisions
- Writing the result
- Phrasing the questions
- Traps

Inspect the project first and ask second. Every question below has a default and a detection
hint. Ask only when detection is inconclusive **and** the answer changes the output. Put all the open
questions into one short batch; never ask one per turn. Once they are answered, run
`fluid init` (or `fluid init --brownfield`) to write `fluid.config.json`, and write a `FLUID.md`
decision log at the project root.

Each decision below lands in one of two places, and the split is the one rule the whole skill
runs on (`config.md`, `contract.md` §1):

- **Structure** — changes which CSS rules exist. Goes in `fluid.config.json`, needs
  `fluid generate` (which `fluid init` runs for you the first time).
- **Settings** — a number inside those rules. Goes in the project's own `:root`, next to its
  tokens, as a `--fluid-*` CSS variable. Live, no regenerate. `fluid.config.json` never holds one.

This skill makes no animation decisions: engine choice, scroll-driven scenes, header behaviour on
scroll and what to do with existing motion code are outside it.

## Detection pass (about two minutes, read-only)

| Look at | Tells you |
|---|---|
| `package.json` deps | framework (next, astro, vite, remix, sveltekit, nuxt), `tailwindcss` version, `sass`, `@stylexjs/*` |
| `package.json` motion deps: `motion` / `framer-motion`, `gsap`, `lenis`, `locomotive-scroll` | nothing for this skill. Note them in `FLUID.md`; do not remove or rewire them here |
| CSS entry (`globals.css`, `app.css`, `main.scss`) | `@import 'tailwindcss'` means v4; `@tailwind base` means v3; an existing `@theme`, custom breakpoints, `clamp()` / `vw` type |
| `tailwind.config.*` | v3 (see the v3 note in `stacks.md`) |
| an existing `fluid.config.json` with no `"version": 2"` | a v1 project — route to `brownfield-migration.md` §"From fluid-design v1" instead of this preflight |
| container classes | `.container`, `max-w-7xl mx-auto px-*`, a hand-rolled wrapper: that is your current container width and padding |
| breakpoints in use | the one where the desktop layout starts is your `bands.desktop.minWidth` candidate. Custom `--breakpoint-*` in `@theme`: `fluid init` keeps them (`tailwind.breakpoints: "none"`), and `--breakpoint-lg` must then equal the desktop band |
| existing `vw`/`clamp` type | a prior fluid attempt; inventory it before replacing it (`brownfield-migration.md`) |
| `<video>` count, sticky/pinned sections | the media rendering work (`media.md`); any scene or playback work is outside this skill |
| Figma links or exported frames in the repo | the artboard's width and height |
| a phone frame in Figma | whether the mobile bands should stay on at their default 390 width, or be re-tuned |
| a `cn` / `twMerge` of the project's own (shadcn's `src/lib/utils.ts`, `lib/cn.ts`: any file importing `tailwind-merge`) | keep it; after install, add `withFluid` to it (§13). Never generate a second `cn` beside it or rewrite it |
| a header, nav or sidebar with a fixed max width, or a design note like "the header stays 1680 wide on big screens" | a limit (§5) |

## The decisions

### 1. Styling stack (structure: `output.stack`)
Default: **Tailwind v4** (`"tailwind-v4"`) if it is present or the project is greenfield. Otherwise use the stack the project already has.
- Tailwind v4 gets the richest artifact: arbitrary-number `@utility` families (`lg:fluid-py-120`).
- On Tailwind v3, recommend upgrading. If that is not possible, use `"css"` plus arbitrary values
  `lg:py-[calc(120*var(--fluid))]`. v3 has no functional `@utility`. `fluid init` detects v3 and
  picks `"css"` itself, with a note.
- Browser floor: Tailwind v4's own (Safari 16.4); the css, scss and stylex stacks go down to Safari
  15.4 / Chrome 108 / Firefox 101 (`contract.md` §0). Ask only if the client names older browsers.
- `"scss"`, `"css"` (also covers CSS Modules and plain CSS) and `"stylex"` all use the same units,
  through functions or `calc()` inside each band's rules.
- Ask when: nothing is installed yet, or two systems coexist.

### 2. Desktop artboard and desktop container (settings: `--fluid-desktop-base-width/-height`, `--fluid-desktop-container-width/-padding`)
Default: artboard **1440 × 900** (the viewport where 1 drawn px = 1 CSS px), container **1680 wide,
80 padding**.
- The artboard is the desktop frame the designer draws on. Read its width and height off the design
  file: a 1680×1050 frame means `--fluid-desktop-base-width: 1680; --fluid-desktop-base-height: 1050;`.
  A base that doesn't match the frame raises no error; the page is just the wrong size everywhere
  (1680-frame numbers on a 1440 base render 17% too big).
- Exception: a canvas wider than any screen (1680×900, 1.87:1) with the content composed in a
  1440 column. Its base is the screen the content was composed for (1440×900), and the canvas width
  goes in the container width. Anchoring such a canvas at 1680 breaks the one-screen guarantee
  (`fluid-scale.md` §4). The defaults describe this case.
- Some teams type 1680-frame numbers 1:1 on a 1440 laptop on purpose. That is a 1440 base with the
  design 17% larger than drawn; confirm it's intended and record it in `FLUID.md`.
- The container is the content box's widest size, side margins included: the frame's width, or
  less if the design caps its content. Drawn content has to fit
  `base-width − 2 × container-padding` (1440 − 160 = 1280 at the defaults). Tell the designer early.
- These four numbers are **settings**, not structure — they go in the project's `:root`
  (`--fluid-desktop-base-width: 1440;` etc.), not in `fluid.config.json`. Only the *existence* of
  the desktop band is structure (§3).
- Ask when: the frame size is not visible anywhere (always ask rather than assume 1440×900), or the
  frame is wider than a screen, or the designer's content box differs from 1680/80.

### 3. Desktop breakpoint (structure: `bands.desktop.minWidth`)
Default: **1024** (Tailwind `lg`). Below it, either the mobile bands scale a phone design (§7,
default in v2) or, with them off, every unit is a flat 1px and mobile is plain responsive CSS.
- It must equal the breakpoint where the desktop composition begins. Two separate numbers here
  produce a band where desktop layout runs at mobile sizes.
- Motion code reads this same number from the generated `fluid.ts` (`DESKTOP_PX`/`DESKTOP_QUERY`),
  so record it only here.
- Ask when: the desktop layout starts somewhere else (768, 1280).

### 4. Height axis (setting: `--fluid-desktop-fit-height`, 1 or 0)
Default: **on** (`1`). The height arm is what makes "one screen tall" possible.
- Turn it off (`--fluid-desktop-fit-height: 0;`) for document-style sites such as docs, blogs or
  dashboards. On those, scaling on a short window only shrinks things without buying any fit.
- With it off, `--fluid-ui` also scales by width only.
- Ask when: the design has no full-viewport sections.

### 5. Growth ceiling (setting: `--fluid-desktop-scale-max`)
Default: **unset** (no ceiling). Above the artboard the whole composition grows as one piece.
- The real limit is asset resolution: a 1920-wide render upscales about 1.3× on a 27" 5K. Either
  re-export the assets at about 3000 wide, or set `--fluid-desktop-scale-max` (for example 1.5).
- Ask when: the hero art or video is raster and below about 2400px wide.
- **Limits** are the finer tool: one part of the page stops scaling at a window width while the rest
  keeps growing. Site header or nav held at its 1680 size: `:root { --fluid-ui-grow-until: 1680; }`
  (keeps `--fluid-header-h` in step; never a limit class on `<header>`). Any other part: a utility on its
  wrapper (`fluid-grow-until-1680`, `fluid-shrink-until-1280`, `fluid-off`). Whole site stops at a
  width: `:root { --fluid-grow-until: 1920; }`. `fluid-scale.md` §10.
- Ask when: the design shows a component staying the same size on large screens, or the client asks
  for the header or nav not to grow.

### 6. Scope
Default: **the whole site from the desktop breakpoint up**, ui included (header and footer on `--fluid-ui`, §9).
- For brownfield work, migrate one route as the reference implementation, then queue the rest.
- The shared elements (buttons, chips, CTAs) take an opt-in `fluid` prop, so migrated and
  unmigrated routes can coexist.

### 7. Mobile bands (structure: `bands.phone` / `.tablet` / `.landscape`)
Default in v2: **on** (`bands.phone: true`, `tablet.minWidth: 600`, `landscape.maxHeight: 500`).
Unprefixed `fluid-*` utilities take the phone frame's numbers (390 wide by default), and three
bands hold it across phones and tablets: phones scale 0.82–1.10, portrait tablets show the phone
design at 1.10–1.30 in a centred container, landscape phones at 1.00–1.20, and landscape tablets
(desktop-breakpoint width and up) get the desktop design scaled down.
- Turn all three off (`bands.phone: false`) for a flat 1px below the desktop band — mobile then
  stays plain, hand-authored responsive CSS with no scaling at all.
- Ask: **is there a tablet design?** No (the usual case): keep the default three bands, or the
  defaults on their own settings. The container and header settings are set once on phone; tablet
  and landscape follow unless you set theirs. Yes: give `--fluid-tablet-base-width` the tablet
  frame's width and author `md:` values against it (not mixed with `fluid-tablet:` on the same
  property, `contract.md` §3).
- Detect: a mobile frame in Figma, or a brief that says the phone layout must look the same on
  every phone. Brownfield: converting the mobile px is a no-op at the artboard width, so it can be
  done file by file and checked by diffing geometry at 390×844.
- Ask when: the design has a phone frame and its width is not 390, or the team wants mobile to stay flat.

### 8. Container (settings: `--fluid-<band>-container-width` / `-container-padding`)
Default: mobile bands **560 wide, 24 padding**; desktop **1680 wide, 80 padding** (grows above
that, never narrows below it in CSS px).
- This is the centred page wrapper each section's content sits in (`fluid-container` /
  `.fluid-container` / `fd.fluid-container`), applied once per section to its inner wrapper — not a
  page-level frame.
- A brownfield site with an existing container: read its max-width and padding straight into these
  settings (`brownfield-migration.md` §"Converting a container").
- Ask when: the design's container differs from the defaults, or differs between mobile and desktop.

### 9. UI (structure: `ui`)
Default: **on**. Emits `--fluid-ui` — the header/nav/footer unit: follows width,
never shrinks for a short window, unlike the damped type roles or the plain layout unit.
- Turn it off only if the header and footer should scale on the plain `--fluid` unit like everything else.
- Ask when: the header design intentionally shrinks on a short, wide window (rare).

### 10. Roles (structure: `roles`)
Default: **`["display", "copy"]`**. Each role becomes its own `--fluid-<role>` unit, a
`fluid-<role>-*` utility and a `fluidPx(n, "<role>")` call.
- Add a role (e.g. `"caption"`, `"eyebrow"`) when the design has a third type curve that damps
  differently from display and copy — a custom role starts with copy's dampings
  (`--fluid-desktop-<role>-damping: 0.33`) and is tuned from there as a setting.
- Role names may not collide with a unit, utility or settings word already in use (`fluid`, `ui`,
  `text`, `container`, band names, and the utility families `p`/`m`/`w`/`h`/`min`/`gap`/… are
  reserved, as the first word too: `min-w` is rejected — `fluid check` and
  `fluid.config.schema.json` both reject a collision).
- Ask when: the design has more than two damped type curves.

### 11. Browser zoom (structure: `zoom`)
Default: **on** (`zoom: true`), which also emits the browser-zoom runtime
(`assets/runtime/fluid-zoom.js`, generated into `output.dir/runtime/zoom.js`).
- Viewport-derived type does not grow under browser zoom on its own, which fails WCAG 1.4.4 on
  displays wider than about 1440 (`fluid-scale.md` §12, Browser zoom). The runtime restores 1:1 text
  zoom in Chromium and Safari; Firefox exposes no reliable signal and stays uncompensated.
- Ask when: the site has a legal accessibility obligation (public sector, the EU Accessibility Act,
  a WCAG AA contract). Then say plainly that compliance must be checked in the client's target
  browsers, and that mobile body copy should be drawn no smaller than the desktop size.
- Turn it off only with the client's informed agreement, recorded in `FLUID.md`.

### 12. Framework integration (structure: `output.integration`)
Default: **auto-detected** by `fluid init` from `package.json` (`next` → `"next"`, `vite` → `"vite"`,
else `"none"`).
- With `zoom: true`, the runtime script has to run before first paint, or a page opened at a
  remembered zoom level paints its type at the wrong size and then jumps. `"next"` generates
  `integrations/next.tsx`'s `<FluidHead />` for `app/layout.tsx`; `"vite"` generates
  `integrations/vite.ts`'s `fluidPlugin()` for `vite.config.ts`. `"none"` generates
  `runtime/zoom.classic.js`, loaded as the first `<script src>` in `<head>` (or its line pasted
  inline).
- A strict CSP: `<FluidHead nonce={…} />` / `fluidPlugin({ nonce })`, or allow
  `FLUID_ZOOM_SHA256` in `script-src` (`fluid-scale.md` §12). Not a question; note it in `FLUID.md`.
- Ask when: the framework is neither Next nor Vite and `zoom` is on — the team needs to add the
  script tag to their own head themselves.

### 13. Class merging (Tailwind): an existing `cn`
Default: **reuse the project's `cn`** when one exists; the generated `cn` only when none does.
- Edit the file that builds `twMerge` (shadcn: `src/lib/utils.ts`):
  ```ts
  import { extendTailwindMerge } from 'tailwind-merge'
  import { withFluid } from '@/styles/fluid/cn'      // the generated cn.ts in output.dir
  const twMerge = extendTailwindMerge(withFluid)       // replaces: import { twMerge } from 'tailwind-merge'
  ```
  If it already calls `extendTailwindMerge({ extend: … })`, pass `withFluid` as the next argument.
  Leave its `cn` signature and every caller unchanged.
- No `cn` anywhere: import `cn` from the generated `cn.ts`.
- Not a question to ask: `fluid init` prints the exact lines for the file it finds, and `fluid check`
  warns until it is done.

## Writing the result

`fluid.config.json` (schema: `assets/fluid.config.schema.json`, or the project's own generated
`fluid.config.schema.json` after `fluid init`) holds the structure. `FLUID.md` holds the reasons:
the stack, the artboard and container numbers (even though they live in `:root`, not the config,
`FLUID.md` is where the "why" for a setting belongs too), anything that differs from the defaults
and why, the routes in scope, and any motion libraries found. A few lines each. Both files are the handoff to the next session.

## Phrasing the questions

Batch the questions, give each one its default, and let the user answer only the ones they care about:

> Before I set this up: (1) styling: Tailwind v4 (you have it) or SCSS? (2) your Figma frames:
> is the desktop artboard 1440×900 and the container 1680/80? (3) does the desktop layout start at
> 1024? (4) is there a tablet design, or should the mobile bands hold the phone frame across every
> size below that? If you don't mind, I'll go with the defaults.

## Traps

- Asking one question per turn. Batch them, each with its default.
- Anchoring the artboard to a wider design canvas instead of the laptop viewport (1440).
- Writing a setting (an artboard number, a container number, a damping) into `fluid.config.json`.
  It belongs in `:root` as a `--fluid-*` variable; the config only holds structure (`config.md`).
- Recording the desktop breakpoint in more than one place. Two copies of one number drift — import
  `DESKTOP_QUERY`/`DESKTOP_PX` from the generated `fluid.ts` instead of hand-typing it again.
- Treating "ignores the browser font-size setting" as covering zoom. They are different; zoom must work.
- Removing or rewiring an installed motion library during preflight. That decision is outside this
  skill; here you only note it.
- Assuming mobile is flat by default. v2 defaults the mobile bands **on** — ask before turning them
  off, not before turning them on.
- Running this preflight against a project that already has a v1 `fluid.config.json`. Route to
  `brownfield-migration.md` §"From fluid-design v1" first.
