# FLUID.md — decision log (Forno Aurelia, pizza-next)

Numbers live in `fluid.config.json` (copied from the skill's defaults; they already match every
decision below). This file holds the reasons. Preflight answers were decided up front by the brief,
so no questions were asked.

| Decision | Value | Why |
|---|---|---|
| Stack | Next 16 App Router, React 19, Tailwind v4, pnpm | Greenfield; Tailwind v4 gets the richest artifact (functional `@utility` families). |
| Engine | Motion (`motion/react`, LazyMotion strict, `m.*`) | React project; no timeline-class choreography needed. No Lenis. |
| Canvas | 1680 × 900, gutter 80 | The drawn frame. Emitted as `lg:fluid-cap-1680 lg:fluid-px-80` on ONE box (`src/lib/frame.ts`). |
| Reference | 1440 × 900 | A viewport, not the canvas. Content budget = 1440 − 160 = 1280. |
| engageAt | 1024 | = Tailwind `--breakpoint-lg` (`src/styles/tokens.css`) = `ENGAGE_BREAKPOINT_PX` (`src/motion/lib/constants.ts`) = the hard-coded media query in `src/styles/fluid.css`. Four copies of one number; change all or none. |
| Height axis | on | The hero is a one-screen composition (`lg:fluid-h-900`, `data-fit="screen"`). |
| Ceiling | none | The largest raster (hero peel, 1404 px wide trimmed) is drawn at ~780 fluid px, so ~1250 px at 2560 (factor 1.6): it survives. The scrub video's desktop tier is 1600×900 cut from a 1920² master; on a 2560×1440 window it upscales 1.6×, accepted as a soft backdrop. |
| Scope | the whole page from `lg` up, chrome included | Header and footer spend `--fluid-chrome`. |
| Scroll scene | ONE: the dough act (`src/components/sections/DoughScene.tsx`) | `ScrubStage`, N = 4 viewports (1 + 2 + 1), head/tail loops, camera with two tiers. Everything else is a triggered `Stage`. |
| Header | fixed, transparent, ink from `data-header-theme` | Every dark band is marked: the three dough acts and the reservation/footer band. |
| Mobile | mobile arm: `clamp(0.85px, 100vw/390, 1.25px)` below 1024 | Converted 2026-09-23: unprefixed `fluid-*` take the 390 frame's numbers; `sm:` tablet overrides stay px. |

## Files taken from the skill (copied, not rewritten)

- `fluid.config.json`, `fluid.config.schema.json` ← `assets/`
- `src/styles/fluid.css` ← `assets/styles/tailwind-v4/fluid.css` (verified byte-identical to
  `generate-fluid.mjs --config fluid.config.json --stack tailwind-v4` output)
- `src/styles/base.css` ← `assets/styles/shared/base.css` (imported `layer(base)`, see globals.css)
- `src/lib/cn.ts` ← `assets/styles/tailwind-v4/cn.ts`
- `src/motion/{components,lib,hooks}` ← `assets/motion/react-motion/` (only change: `Stage.tsx`
  imports the fluid-aware `cn` instead of the bare `cx` joiner, as the README instructs)

## Section map

| Section | Height class | Header theme | Motion |
|---|---|---|---|
| Hero | `lg:fluid-h-900` (+ mobile `min-h-[max(640px,100svh)]`, `lg:min-h-0`) | light | `Stage trigger="mount"` + page-level `StageVeil`; header `drop` |
| Manifesto | content (`lg:fluid-py-180`) | light | liftFade per authored line, 0.067s |
| Dough scene | 4 viewports (pinned) | dark ×3 | `ScrubStage`, `FadeOnExit` (act 1), `PullToCentre clamp="[data-scrub-stage]"` (act 3) |
| Menu | content | light | one stage per card, column stagger 60ms; `auto-fill` min scaled (360) |
| Craft numbers | content | light | `CountUp` in a scaling box → `fluid-text-*`; decorations on `fluid-top/left/w-*` |
| Gallery | content | light | per-block stages; `InViewLoopVideo` outside any transformed ancestor |
| Reserve + footer | content | dark | footer stage on `PAGE_END_TRIGGER`; footer on `--fluid-chrome` |

## Page-level deviations from the copied artifacts (and why)

- `tokens.css` defines ALL Tailwind breakpoints in px (640/768/1024/1280/1536), not only `lg`.
  With only `lg` in px, Tailwind emitted the `lg:` block before `sm:`, and every `sm:` utility beat
  `lg:fluid-*` (SKILL-FEEDBACK #0).
- `globals.css` imports `base.css` into `layer(base)`, then sets `html { scroll-behavior: auto }`.
  Smooth scrolling plus the dough scene's scroll well stalled anchor jumps at act 3
  (SKILL-FEEDBACK #18).
- `globals.css` hides `[data-scrub-spacer]` under reduced motion (SKILL-FEEDBACK #19).
- `ScrubStage.tsx` and `base.css` were re-copied near the end, after the skill fixed the
  reduced-motion pin attribute upstream.
- The dough video's encode differs from `video.md`'s recipe: `qcomp=1`, CRF 33, and a wider
  2.13:1 desktop crop. See `assets-src/VIDEO-NOTES.md`.
