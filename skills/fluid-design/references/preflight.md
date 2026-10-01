# Preflight: settle the decisions before any code

Purpose: The decisions to settle before any code (stack and browser floor, design frames, bands,
container, type roles, growth ceiling, browser zoom, the team's CLI), each with its default, how to
detect it and when to ask.

Read when: starting any fluid-design task, on a new or an existing site.
Skip when: `fluid.config.json` and `FLUID.md` already exist and the task stays inside their decisions.
Inputs: the project (`package.json`, CSS entry, `@theme`, breakpoints, container widths, framework
and router) and the design frames.
Produces: the answers as `fluid init` flags and settings, `fluid.config.json`, and a `FLUID.md`
decision log.

## Contents

- Detection pass
- The decisions (§1–§14)
- Writing the result, phrasing the questions
- Traps

Inspect first, ask second. Ask only when detection is inconclusive **and** the answer changes the
output, all open questions in one batch, each with its default. Then run `fluid init` (or
`--brownfield`) and write `FLUID.md`. **Structure** (which CSS rules exist) goes in
`fluid.config.json` and needs `fluid generate`; **settings** (numbers) are `--fluid-*` variables in
the project's `:root`, live, never in the config (`config.md`). No animation decisions here.

## Detection pass (read-only, about two minutes)

| Look at | Tells you |
|---|---|
| `package.json` deps | framework, `tailwindcss` version, `sass`, `@stylexjs/*`; motion libraries (note them in `FLUID.md`, change nothing) |
| CSS entry | `@import 'tailwindcss'` = v4, `@tailwind base` = v3; `@theme`, custom breakpoints, `clamp()`/`vw` type (an earlier fluid attempt: inventory it, `brownfield-migration.md`) |
| `fluid.config.json` without `"version": 2` | a v1 project: go to `brownfield-migration.md` §"From fluid-design v1" instead |
| container classes and gutter tokens (`max-w-7xl mx-auto px-*`, `--spacing-gutter`, `lg:px-18`) | the current container (§8) |
| breakpoints in use | where desktop starts (§3). Custom `--breakpoint-*`: init keeps them (`tailwind.breakpoints: "none"`) and `--breakpoint-lg` must equal the desktop band |
| the design file | every band's frame size (§2, §7) |
| a `cn` importing `tailwind-merge` | keep it, add `withFluid` (§13) |
| a header kept at a fixed width on big screens | a limit (§5) |
| `browserslist`, a support statement | the browser floor (§1) |

## The decisions

### 1. Stack and browser floor (structure: `output.stack`)
Default: **Tailwind v4** when present or on a new site; else the project's stack.
- Tailwind v3 has no functional `@utility`: recommend upgrading, or `"css"` with
  `lg:py-[calc(120*var(--fluid))]` (init picks `"css"` for v3). `"css"` also covers CSS Modules.
- Floor: Tailwind v4's own (Safari 16.4); css, scss, stylex reach Safari 15.4 / Chrome 108 /
  Firefox 101 (`contract.md` §0).
- **Ask whether the team avoids newer CSS** such as `cqw` and the `lh` unit. Record it in
  `FLUID.md`; `frame-and-gutter.md` and `typography.md` give a plain alternative for each.
- Ask when: nothing is installed, two systems coexist, or the client names older browsers.

### 2. Desktop design frame and container (settings: `--fluid-desktop-base-width/-height`, `--fluid-desktop-container-width/-padding`)
Default: frame **1440 × 900**, container **1680 wide, 80 padding**.
- **Read the frame off the design**; the default is a fallback. A 1680×1050 frame sets 1680 and
  1050. A wrong base raises no error: 1680-frame numbers on a 1440 base render 17% too big everywhere.
- A canvas wider than any screen (1680×900) with content composed in 1440 takes 1440×900 as its base
  and 1680 as the container; a 1680 base breaks the one-screen guarantee (`fluid-scale.md` §4).
- Typing 1680-frame numbers on a 1440 base on purpose makes the site 17% larger than drawn: confirm
  and record it.
- Drawn content must fit `base-width − 2 × padding` (1280 at the defaults); tell the designer early.
- Ask when: the frame size is not visible (ask, never assume), or the container differs from 1680/80.

### 3. Desktop breakpoint (structure: `bands.desktop.minWidth`)
Default: **1024** (`lg`). It must be where the desktop composition begins; a second number makes a
band where the desktop layout runs at mobile sizes. Motion code imports it (`DESKTOP_QUERY`). Ask
when the desktop layout starts elsewhere (768, 1280).

### 4. Height axis (setting: `--fluid-desktop-fit-height`)
Default: **1** (what makes "one screen tall" possible). `0` when no section is designed to fill one
screen (marketing pages without a one-screen hero, docs, blogs, dashboards): there the height axis
only shrinks things on a short window without buying a fit, and on a wide, short monitor it shrinks
the page to the height and leaves empty side margins (a 1680×1050 frame at 2000×1013 renders 0.96×
instead of 1.19×). `--fluid-ui` then follows width only too.
- Height never squashes text: font size and line height share the unit. Cramped lines after a
  change are usually a stale stylesheet; hard-reload before touching this setting.
- Ask when: the design has no one-screen section, or the user reports side margins on wide screens.

### 5. Growth ceiling and limits (setting: `--fluid-desktop-scale-max`)
Default: **no ceiling**. The real limit is asset resolution: a 1920-wide render upscales about 1.3×
on a 27" 5K, so re-export at about 3000 wide or set a ceiling (1.5).
- **Limits** stop one part at a window width: the header with `:root { --fluid-ui-grow-until: 1680; }`
  (keeps `--fluid-header-h` in step; never a limit class on `<header>`), any other part with
  `fluid-grow-until-1680` / `fluid-shrink-until-1280` / `fluid-off` on its wrapper, the whole site
  with `--fluid-grow-until: 1920` (`limits-and-scopes.md` §2).
- Ask when: raster hero art is under about 2400 wide, or the design keeps a part fixed on big screens.

### 6. Rollout
Default: **the whole site**. On an existing site, migrate one route as the reference, then the rest;
shared atoms take an opt-in `fluid` prop so both kinds of route coexist.

### 7. Mobile bands and their frames (structure: `bands.phone`/`.tablet`/`.landscape`)
Default: **on** (tablet from 600 wide, landscape up to 500 tall). Unprefixed `fluid-*` utilities
take the phone frame's numbers; tablet and landscape run the phone design at their own scale.
- **Read the phone frame's width.** 390 is a fallback; frames are often **402** (iPhone 16 Pro):
  `--phone 402`.
- **No tablet or landscape frame is the normal case.** Keep the defaults: full width, 32px gutter
  (a 560 column read as a phone floating on a tablet; `frame-and-gutter.md` §1 restores it). A real
  tablet frame: `--fluid-tablet-base-width: 834`, numbers authored with `md:` (never mixed with
  `fluid-tablet:` on one property, `contract.md` §3).
- **Continuity:** keep `--fluid-tablet-scale-min` equal to `--fluid-phone-scale-max` (1.10), or the
  page jumps at 600px.
- `bands.phone: false`: a flat 1px below desktop, plain responsive CSS.
- Converting mobile px is a no-op at the phone frame's width: go file by file, diff geometry there.

### 8. Container (settings: `--fluid-<band>-container-width` / `-container-padding`)
Default: desktop **1680 / 80** (grows, never narrows below 1680 CSS px); phone **560 / 24**; tablet
and landscape **full width / 32**. The padding never drops below the safe-area inset (notch clearance).
- `fluid-container` goes once per section, on its inner wrapper.
- Existing site: read its container into these settings (`brownfield-migration.md` §"Converting a
  container"). **Bridge old gutter tokens**: a fixed `--spacing-gutter: 72px` or `lg:px-18` ignores a
  later change of `--fluid-desktop-container-padding`. Set `--spacing-gutter: var(--fluid-container-padding)`
  in `@theme` while routes migrate; replace hard-coded gutters route by route.

### 9. UI unit (structure: `ui`)
Default: **on**: `--fluid-ui` for header, nav and footer follows width and never shrinks for a short
window. Off only if they should scale like everything else.

### 10. Type roles (structure: `roles`)
Default: **`["display", "copy"]`**. Add one (`"eyebrow"`) for a third type curve; it starts with
copy's damping. Names may not collide with a unit, utility or setting word (`ui`, `text`,
`container`, band names, `p`/`w`/`min`/`gap`…), first word included (`min-w` is rejected).

### 11. Browser zoom (structure: `zoom`)
Default: **on**. Viewport-based type does not grow under browser zoom on its own, which fails WCAG
1.4.4 on displays wider than about 1440 (`browser-zoom.md`). The runtime restores 1:1 text zoom in
Chromium and Safari; Firefox stays uncompensated.
- Legal accessibility duty (public sector, the EU Accessibility Act, WCAG AA): say compliance must be
  checked in the target browsers, and draw mobile body copy no smaller than desktop.
- Off only with the client's informed agreement, recorded in `FLUID.md`.

### 12. Framework integration (structure: `output.integration`)
Default: **detected** (`next`, `vite`, else `none`). The zoom script must run before first paint, or
a page opened at a remembered zoom paints type at the wrong size and jumps. Next: `<FluidHead />`;
Vite: `fluidPlugin()`; other: `runtime/zoom.classic.js` as the first `<script src>` in `<head>`
(the team adds it). Strict CSP: pass `nonce`, or allow `FLUID_ZOOM_SHA256`.

### 13. Class merging (Tailwind): an existing `cn`
Reuse the project's `cn`; the generated one only when none exists. Edit the file that builds `twMerge`:

```ts
import { extendTailwindMerge } from 'tailwind-merge'
import { withFluid } from '@/styles/fluid/cn'      // the generated cn.ts in output.dir
const twMerge = extendTailwindMerge(withFluid)       // replaces: import { twMerge } from 'tailwind-merge'
```

If it already calls `extendTailwindMerge({ extend: … })`, pass `withFluid` as the next argument;
keep every caller. Not a question: init prints the lines, `fluid check` warns until done.

### 14. The CLI for the team and CI
Init adds `"fluid": "npx fluid-design-cli@2"` to `package.json` scripts (when absent): a CLI that
lives only in the skill folder is one teammates cannot run. Recommend `npm run fluid -- check` in CI.

## Writing the result, phrasing the questions

`fluid.config.json` holds the structure (`$schema` points at the published schema). `FLUID.md`
holds the reasons, a few lines each: stack and browser floor, every frame and container number,
departures from the defaults, routes in scope, bridged legacy tokens, motion libraries found.

> Before I set this up: (1) Tailwind v4 (you have it) or SCSS? Browsers to support, or newer CSS to
> avoid? (2) is the desktop frame 1440×900 and the phone frame 390 or 402? Container 1680/80?
> (3) does desktop start at 1024? (4) is there a tablet or landscape design, or should they run the
> phone design full width? Otherwise I'll use the defaults.

## Traps

- Keeping a default frame size without reading the design.
- A setting in `fluid.config.json`, or the desktop breakpoint typed twice.
- Treating "ignores the browser font-size setting" as covering zoom: they differ; zoom must work.
- Removing or rewiring a motion library here.
- Assuming mobile is flat: the bands are on by default; ask before turning them off.
