# FLUID.md — decision log (Forno Aurelia, Vite + SCSS + GSAP)

The numbers live in `fluid.config.json`. This file holds the reasons.

## Preflight answers

| Decision | Answer | Why |
|---|---|---|
| Styling stack | **SCSS** (`sass`), generated layer in `src/styles/fluid/` | Test build B exercises the non-default stack on purpose. |
| Animation engine | **GSAP 3.13+** (installed 3.15), primitives copied from `assets/motion/gsap/src` into `src/motion/` | Not a React project; the GSAP port is the default outside React. |
| Framework | Vite 8, vanilla TS, one multi-section `index.html` | Brief. |
| Design frame | canvas **1600 × 900**, gutter **64** | Non-default, to exercise the generator. |
| Reference viewport | **1440 × 900** | The reference stays at the common laptop viewport, not the canvas (fluid-scale.md §Reference). Content budget: 1440 − 2·64 = **1312**. |
| Engage breakpoint | **1024** | Same number in `$fluid-engage-at`, `ENGAGE_QUERY` (eases.ts) and scrubStage's `mobileBreakpoint` default. |
| Height axis | **on** | The hero is a one-screen section (`fluid(900)`, `data-fit="screen"`). |
| Growth ceiling | **1.6** | The hero pinsa is a 1460-wide raster, and the scrub clip is 1280×720. Uncapped, at 3840×2160 `--fluid` would be 2.4. |
| Scope | the whole page from 1024 up, header and footer on `--fluid-chrome` | Default. |
| Scroll-driven scene | **one**: `#forno`, a pinned all-intra clip with head loop, scrub band and tail loop | Brief. It is the page's only scroll-driven scene. Everything else is a triggered `[data-stage]`. |
| Header | fixed and transparent, ink from `data-header-theme` (`headerTheme.ts`) | Default. |
| Mobile | flat, authored plainly above each `fd.fluid-up` block | Default. |

## Local deviations from the prepared artifacts (each one is in SKILL-FEEDBACK.md)

1. **Ceiling re-declared by hand** in `src/styles/main.scss` (`:root` block). The generator's
   SCSS emitter drops `ceiling`. Delete the block once the generator is fixed.
2. **`.frame` is not `@include fd.fluid-frame` alone.** The mixin is included only inside
   `fd.fluid-up`, with a 24px mobile gutter and a px cap below it, because the bare mixin gives a
   phone 64px gutters.
3. **A `box-sizing: border-box` reset** has been added. base.css assumes a reset that the SCSS
   path does not provide.
4. **`data-motion-state="head"` is seeded in the markup.** `scrubStage.ts` only writes the
   attribute on a transition.
5. **`src/motion/scrubStage.ts` has one local patch.** It pauses the decoder on entry to scrub,
   as the React port does. It is marked `LOCAL PATCH`.

## Type-unit calls (typography.md's container question)

- Hero headline, hero copy: **`fluid-text`**. The hero is one fixed composition that scales as a
  drawing, so its box scales. On the display curve the 200px headline would be 985px at
  1024×700, wider than the 933px content box.
- Manifesto, menu title, act titles: **`fluid-display`**. The first two sit in a grow-only measure
  (`fluid-cap(1100)`); the act titles sit in `fluid-cap(640)`.
- Menu cards and the stats: **`fluid-text`**. The grid is `fluid(1472)` wide and the stats box is
  `fluid(1312)` wide. Both scale.
- Eyebrows, the Réservation pill, act body: **`fluid-copy`**. The pill's padding follows its line
  box.
- Header and footer: **`fluid-chrome`**.

## The scene

`public/video/oven-scrub.mp4` is built by `scripts/make-scrub-video.py` from one Unsplash still.
It is 1280×720, 30 fps, 300 frames, all-intra (`-g 1 -bf 0`, keyint 1), CRF 30, 7.8 MB. Its loops
are periodic by construction. The head loop has period 60, so frame 0 equals frame 60, which
gives `headLoop {fromFrame: 1, matchFrame: 61}`. The tail loop has period 58, so frame 240 equals
frame 298, which gives `tailLoop {fromFrame: 241}`. Measured seam cost: 5.60 on the head and 4.45
on the tail, against 5.5 to 6.0 for adjacent frames. Both are at the encode-noise floor. The
sibling build's scrub clip did not exist when this one was needed, so this build uses its own.
