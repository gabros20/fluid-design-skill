# The fluid scale: one measured unit

Purpose: The model and the maths of the base unit: the problem it solves, drawn number × unit, the
two axes and the ×1000 precision form, the design frame as reference, the ceiling, settings vs
structure, animation interop, limitations and the traps.

Read when: setting up the scale, changing a frame size or `fluid.config.json`, or explaining why a
number resolves the way it does.
Skip when: you are only building a section (`section-recipe.md`). The other units, the bands,
scopes and limits, and browser zoom have their own references (below).
Inputs: `fluid.config.json`, the settings the project sets in its `:root`, and the design frames.
Produces: a unit or setting decision with its reasoning, or the explanation of a resolved value.

The rest of the model lives next door: `units.md` (the type units, `--fluid-ui`, the header height,
the container units, adding a role), `bands.md` (phone, tablet, landscape, desktop),
`limits-and-scopes.md` (one scale per page, scopes, limits) and `browser-zoom.md` (WCAG 1.4.4).

## Contents
1. The problem it solves
2. The model: drawn number × unit
3. The base unit and its two axes
4. The reference is the design frame, not the container
5. No ceiling (and when to set one)
6. Settings and structure
7. Interop with animation (if any)
8. Limitations
9. Traps

Words used here: the **design frame** (artboard) is the frame the designer draws in; `--fluid` is
1px at the design frame's size and moves with the window; a **band** is a range of window sizes
with its own design; a **type role** is a size curve that shrinks more gently than the layout;
**damping** is how much a role shrinks with the layout (1 = as much, 0 = never below its drawn
size); a **limit** stops scaling past or below a window width; a **scope** is part of the page
with its own settings.

---

## 1. The problem it solves

A section built at the numbers of a 1680×900 frame is that size on every screen, and fails on both axes:

- **Height.** A 900px section runs 160px past the bottom of a 1440×740 window; a pinned scene's last
  act ends below the fold.
- **Width.** At 900 tall, where a height-only scale does nothing, the drawn three-line heading holds
  only down to 1440 wide. Below that the copy column narrows against a fixed 512px stat grid: four
  lines at 1280, **seven** at 1100 and 1024.

Heading line counts per strategy, measured on the reference build:

| Window | Height only | **Both axes** | Width on type only |
|---|---|---|---|
| 1440×900 | 64px · 3 | 64px · **3** | 64px · 3 |
| 1280×900 | 64px · **4** | 59.6px · **3** | 59.6px · 4 |
| 1100×900 | 64px · **7** | 54.6px · **4** | 54.6px · 6 |
| 1024×900 | 64px · **7** | 52.5px · **4** | 52.5px · 7 |

Scaling type alone is not enough: the *layout* has to follow the width too, or the column never gets
its room back.

## 2. The model: drawn number × unit

Each unit is **exactly 1px at the design frame's size**, so a Figma number is written as itself
times the unit:

```
64px in the frame  →  calc(64 * var(--fluid-display))  →  lg:fluid-display-64
```

At 1440×900 that is 64px; at 1440×700 the unit is about 0.78 and the result 49.8px. Everything
shrinks by one shared factor, so the frame's proportions hold by construction, with no table of
per-property min/max pairs to keep in sync (the failure of per-property `clamp()` systems).

**The multiplied number has no unit.** `24 * var(--fluid)` is valid; `24px * var(--fluid)` is a
length times a length, which `calc()` rejects with no error: the custom property becomes invalid,
everything reading it resolves to nothing, and the element falls back to `auto`. On the reference
build a whole row of certification marks sprang to their intrinsic sizes. It bites hardest through
a variable:

```
'--mark-h': '64px'                    // a length
calc(var(--mark-h) * var(--fluid))    // INVALID, silently kills the rule
'--mark-h-n': '64'                    // a number
calc(var(--mark-h-n) * var(--fluid))  // correct
```

A value that is a plain length below a breakpoint and scaled above it needs two tokens.
`fluid audit` flags this (`length-times-unit`); the SCSS functions `@error` on it.

## 3. The base unit and its two axes

Every band computes `--fluid` in one shape: the smaller of a width term and (desktop only, with
`fit-height` on) a height term, held between a minimum and a maximum. Each band reads its own
settings (`--fluid-<band>-base-width`, `-base-height`, `-scale-min`, `-scale-max`; `config.md`), but
the formula is written once, on `:root` and every scope (`limits-and-scopes.md`); only the parameters change per band.

The desktop band at the defaults (base 1440×900, `scale-min` 0.58, no `scale-max`):

```css
--fluid: max(0.58px, min(100svh / 900, 100vw / 1440));          /* the maths */
--fluid: calc(max(580px, min(calc(100svh * 1000 / 900),
                             calc(100vw * 1000 / 1440))) / 1000);  /* what the generator emits */
```

**Why ×1000.** Firefox keeps lengths in 1/60px steps and rounds the result of `min()`, `max()` and
`clamp()` to that grid. On a unit of about 0.71px that loses up to 1.6%, multiplied by every drawn
number. Measured in Firefox 155 at 1024×640: `calc(900 * var(--fluid))` came out 630px in a 640px
window, a 10px gap under a one-screen section. Comparing lengths 1000 times larger and dividing once
leaves 0.017px. Chromium and WebKit were exact either way. Every generated unit uses this form, and a
hand-written one must too. The engine uses only `min()`/`max()`/`calc()` (no `clamp()`, no
`round()`), so every comparison stays on the ×1000 lengths.

- **`min()` means fit.** It is `object-fit: contain` as a scale factor: the composition can never
  outgrow either axis. `max()` would be cover and let text overflow. Separate units per axis distort
  anything with an aspect ratio and mean nothing for `font-size`, which is one number.
- **Purely proportional, no added constant.** That is what makes `900 * var(--fluid) === 100svh`
  whenever height is the tighter axis. When width is tighter, the section is shorter than the window
  (800 in 1280×900, 640 in 1024×900). The guarantee: **never taller than the window, and exactly one
  screen whenever height binds.**
- **`svh`, not `dvh`.** The small viewport does not move when a mobile toolbar collapses; with `dvh`
  type would resize mid-scroll, which thrashes layout over a scrubbed video. (A pinned scene's sticky
  layer uses `lvh`; `ios-safari.md` §1.)
- **`100vw` includes a classic scrollbar.** Harmless with hidden or overlay scrollbars. If it bites:
  `calc((100vw - var(--scrollbar-width)) / 1440)`.
- **`--fluid-desktop-scale-min: 0.58`** was chosen ("structure stops compressing at a 522px-tall
  section"), not derived, and is nearly unreachable: at 1024 wide the width term is already 0.711.
- **`--fluid-desktop-fit-height: 0`** makes desktop width-only. The mobile bands are width-only by
  construction: a phone frame has no one-screen guarantee to keep. The trade: with height on, a
  wide, short window (2000×1013 on a 1680×1050 frame) scales to the height, 0.96×, and the page
  sits centred with side margins; with it off the page scales 1.19× and fills the width, and a
  one-screen section scrolls on a short window. Height scales font size and line height by the
  same factor, so it never changes line spacing.

Below the desktop breakpoint (`bands.desktop.minWidth`, 1024) the phone, tablet and landscape bands
each scale their own frame the same way (`bands.md`); with `bands.phone: false` the unit is a flat `1px` there.

## 4. The reference is the design frame, not the container

The reference (`--fluid-desktop-base-width` × `-base-height`) is the desktop frame the designer
draws on, read off the design file; at a window that size one drawn px is one CSS px. 1440×900 is
only the default; a 1680×1050 frame sets 1680 and 1050. A wrong reference raises no error: numbers
from a 1680 frame on a 1440 reference render 17% too big at every window. The container
(`--fluid-desktop-container-width`, `units.md` §2) is a separate number, the content box's widest size.

The one case where reference and frame differ is a canvas wider than any screen. The reference
build draws on 1680×900 (1.87:1 against a 1.60:1 screen) with content composed for 1440. A fit
inside has to letterbox one axis; there is no third answer:

| | Horizontal | Vertical |
|---|---|---|
| **1440×900 reference, 1680 container** | 240px of drawn canvas does not fit | sections fill the window exactly |
| 1680×900 reference | pixel-exact at every width | a 771px section in a 900px window |

The second was modelled and **rejected twice**: it shrinks everything already approved at 1440 by
14%, and breaks `900 × --fluid = 100svh` across most of the range. That guarantee is load-bearing:
it makes a four-act pinned scene exactly 4.00 screens long. A frame with a screen's shape
(1680×1050) has no conflict and is its own reference.

**On a wide canvas, the reference width is a content budget.** Drawn content must fit
`base-width − 2 × container-padding` (1280) at full size; the rest of the canvas is air a wide screen
gains. Check it with `fluid calc budget`. A row over budget is fixed in the drawing (with design
sign-off) or as fractions of the content box (`frame-and-gutter.md` §2), never by changing the divisor.

## 5. No ceiling (and when to set one)

Above the design frame the whole composition (layout, type, pinned render, wordmarks) scales as one,
so a large display shows the drawn frame larger instead of a fixed frame stranded in empty space.
CSS pixels are not device pixels, which keeps this tamer than it sounds:

| Display | `--fluid` | Section | Heading (64 drawn) | Body (16) |
|---|---|---|---|---|
| MacBook Pro 16" (1728×1117) | 1.10 | 990 | 70 | 18 |
| 27" 5K (2560×1440) | 1.50–1.60 | 1350–1440 | 96–102 | 24–26 |
| 32" Pro Display XDR | 1.78 | 1600 | 114 | 28 |

The real ceiling is asset resolution: inline SVG scales perfectly, a 1920-wide raster upscales.
Re-export at about 3000 wide, or set `--fluid-desktop-scale-max`; `--fluid`, `--fluid-ui` and the
type units all stop with it. Check a size with `fluid calc px 64 --unit display --at 3840x2160` or
`fluid explain 3840x2160`.

## 6. Settings and structure

**Structure** (`fluid.config.json`, then `fluid generate`) decides which CSS rules exist: bands and
breakpoints, roles, `ui`, `zoom`, output. **Settings** (CSS variables in your `:root`, live) are
every number inside them: frame sizes, scale min/max, dampings, containers, header heights, limits.
`config.md` lists each with its default; `fluid settings` prints the list for your own config.

`--fluid` must stay purely proportional on both axes. An added constant to "soften" it breaks §3's
fit guarantee, whether through a setting or a hand-written unit.

## 7. Interop with animation (if any)

The skill ships no animation. If motion code animates the page, these keep the two from fighting:

- **No property collides.** Animation writes `transform`/`opacity`; the scale writes sizes. The
  units recompute on resize only, never per frame or during a scroll.
- **`fluid-translate-*` writes the separate `translate` property**, so it composes with Motion's
  per-frame `transform`.
- **GSAP folds `translate` in.** On its first transform tween of an element, GSAP reads its CSS
  `translate`, `rotate` and `scale`, bakes them into its own `transform` and sets them to `none`
  inline. A percentage survives (as `xPercent`), so `translate: -50% 0` centring still works; a px or
  `calc()` value (every `fluid-translate-*`) is frozen at that moment's size. Measured on the Vite
  example (GSAP 3.15): every tweened element carried `translate: none`, and a `calc()` change never
  moved it. With GSAP, put scaled offsets on a child or wrapper GSAP never tweens.
- **Entrance offsets stay fixed px.** Engines resolve `var()` once at the start, so a scaled offset
  goes stale on resize; not worth it for 24–40px.
- **Travel scales.** A drawn distance in motion code (`x: 600`, `end: '+=1800'`) is right only at the
  design frame; at 2560×1440 it is 1.6× too short. Script reads the units through the generated
  `runtime/units.js` (re-exported by `fluid.ts`): `fluidPx(600)` is 600 drawn px in CSS px now,
  `fluidPx(24, 'ui')` reads the ui unit, `fluidUnits()` returns all, `onFluidChange(cb)` fires on
  change. It reads them through a hidden probe element (`getPropertyValue('--fluid')` returns the
  formula text), one layout read per change. GSAP: function values (`x: () => fluidPx(600)`) with
  `invalidateOnRefresh: true`; Motion: a MotionValue updated from `onFluidChange`.
- **A pin re-measures on `ResizeObserver` plus `resize`**, reads the desktop breakpoint from
  `fluid.ts` (`DESKTOP_PX`/`DESKTOP_QUERY`) and the header height from `--fluid-header-h`.

## 8. Limitations

1. When width binds, a one-screen section is shorter than the window. Fine over a pinned render, but
   a pinned scene's act maths changes: 3.42 screens at 1024×900 instead of 4.00.
2. **Type ignores the browser's font-size setting from the desktop breakpoint up**, on purpose: type
   is anchored to the window so the composition keeps its proportions. Do not add a rem-anchored
   twin. That setting is not browser zoom (`browser-zoom.md`).
3. Below the minimums both axes go flat and a `fluid-h-900` section stops matching the window.
   Windows that small are out of scope.
4. Resizing reflows type and remaps any pin; scrolling never does.

## 9. Traps

- `max()` instead of `min()` to combine the axes: cover, not fit, and text overflows.
- `dvh` in the unit: type resizes while the reader scrolls on mobile Safari.
- Anchoring the reference to the container width (1680) instead of the screen (1440), or keeping a
  default frame size without reading the design.
- An added constant in `--fluid` (`clamp(…, 1px)`, `a·vw + b`): `900 × --fluid` stops equalling
  `100svh`. (The mobile bands' min/max range has no added constant and no height promise to keep.)
- Declaring a unit (`--fluid`, `--fluid-display`, …) instead of the setting it is built from: it
  replaces the formula and the other units do not follow. `fluid check` warns (`limits-and-scopes.md`).
- A length times a unit (`64px * var(--fluid)`): invalid, dropped silently.
- A hand-written unit comparing sub-pixel lengths in `min()`/`max()`: Firefox rounds to 1/60px, up
  to 1.6% off (§3). Compare ×1000 lengths and divide once.
