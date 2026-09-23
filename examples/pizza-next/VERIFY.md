# VERIFY — Forno Aurelia (pizza-next)

All runs were against a production build (`pnpm build` → `next start -p 4310`), which I started and
stopped myself. The last full run followed the final code change. Compact evidence is in `verify/`
(committed). Full-size captures are in `verify-out/` (gitignored, 166 MB).

## 1. Build and typecheck — PASS

- `npx tsc --noEmit` → clean.
- `pnpm build` (Next 16.3.6, Turbopack) → `✓ Compiled`, `/` prerendered static.

## 2. Audit — PASS (0 errors, 0 warnings, 1 info)

`node ../../fluid-design/scripts/audit.mjs src` (script re-read before running; mtime 13:41) → `verify/audit.txt`

| Finding | Kept because |
|---|---|
| INFO `fixed-px-at-engage` Header.tsx:79, `lg:tracking-[0.08em]` | Tracking in `em` is deliberately off the scale (typography.md). The line also carries `--fluid-chrome` arbitrary values, which is the documented way to spend chrome. |

## 3. Viewport matrix — PASS, 27/27

`node ../../fluid-design/scripts/verify-matrix.mjs http://localhost:4310 --reveal --screens --fit-selector '[data-fit=screen]'`
→ `verify/matrix-summary.txt`, `verify/matrix-report.json`

The run covers widths 1024/1280/1440/1680/2560 × heights 640/700/800/900/1440, plus 390×844 and
375×667. Every cell passes on overflow, units, fit and reveal (54/54 stage items visible).

Hero (`data-fit="screen"`) height / window height:

| | 640 | 700 | 800 | 900 | 1440 |
|---|---|---|---|---|---|
| 1024 | 1.00 | 0.91 | 0.80 | 0.71 | 0.44 |
| 1280 | 1.00 | 1.00 | 1.00 | 0.89 | 0.56 |
| 1440 | 1.00 | 1.00 | 1.00 | **1.00** | 0.63 |
| 1680 | 1.00 | 1.00 | 1.00 | 1.00 | 0.73 |
| 2560 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |

This is the expected shape: exactly one screen wherever height binds, and shorter where width
binds. It is never taller than the window.

**The first matrix run FAILED reveal in every cell (30/54 hidden, everything after the dough
scene).** Cause: base.css sets `html { scroll-behavior: smooth }`, and the scroll well's per-frame
`scrollTo({behavior:'instant'})` cancels any smooth scroll passing through act 3. The harness's
`scrollTo` and a real header "Menu" anchor click both stalled at y=4263 against a target of
5164. Fixed page-side (globals.css sets `scroll-behavior: auto`). After the fix the anchor lands
at 5164/5164. See SKILL-FEEDBACK #18.

## 4. ScrubStage sweep — PASS (head → scrub → tail)

`node scripts/scrub-check.mjs <url> verify-out/scrub <WxH>` scrolls to scene PROGRESS (never raw px)
and waits 2.5 s per step. `window.__scrub()` is dev-only, so the production run reads
`video[data-motion-state]` and `currentTime`. A `next dev` run of the same sweep confirmed
`__scrub()` agreed (targetTime 0 / 3.4 / 4.825 / 6.25 / 7.0; travel 2700 = 3 viewports, as N = 4
predicts).

| progress | 1440×900 mode | frame | camera transform | 390×844 mode | frame |
|---|---|---|---|---|---|
| 0 | head (playing) | 24 (in loop 0–59) | `translate3d(0,-29px,0) scale(1.065)` | head | 19 |
| 0.25 | scrub (paused) | 102 | `translate3d(-87px,0,0)` | scrub | 102 |
| 0.5 | scrub | 144 | `translate3d(-239px,0,0)` | scrub | 145 |
| 0.75 | scrub | 187 | `translate3d(-391px,0,0)` | scrub | 188 |
| 1 | tail (playing) | 210 (loop 210–269) | `translate3d(-470px,0,0)` | tail | 210 |

The header ink is `rgb(250,246,239)` (light) across the whole scene, so all three dark acts are
marked. The contact sheets are `verify/scrub-sheet-1440x900.webp` and
`verify/scrub-sheet-390x844.webp`. The desktop pinsa pans from the right third to the left
third, turning from horizontal to vertical. On the phone it rises from low in the frame to high.

Asset proof (`assets-src/VIDEO-NOTES.md`):
- Both tiers are all-intra: 270/270 frames `key_frame=1`.
- Desktop is 9.0 MB at 1440×676; mobile is 8.1 MB at 720×1280.
- Seams on the ENCODED files: 60 vs 0 and 269 vs 209 are pixel-identical (∞ dB). Neighbouring frames are ~29–30 dB. The loop moves: 0 vs 15 is 21.7 dB.
- Posters are frame 0 of the encoded files.

Reduced motion (Playwright `reducedMotion: 'reduce'`): the pin computes `position: static` and the
scene collapses from 3600 px to 1800 px. The spacer act is hidden by a page-level media query.

## 5. Screenshots, looked at — PASS

Files: `verify/hero-{1440x900,1280x800,1024x700,2560x1440,390x844}.webp`. Full-page captures are in
`verify-out/shots/`.

- 1440×900: the editorial composition as briefed.
  - A 112 px light Jost headline over a sand half-disc (diameter 1100, centred on the baseline).
  - The pinsa-on-peel cut-out overlaps the arc, with the two copy blocks flanking it.
  - The vertical black "Réservation" pill sits on the right edge.
  - The mascot is top-left, the live-type wordmark centred with its tagline, and the round black Menu button top-right.
- 1280×800 and 2560×1440 are the same drawing, scaled. The 2560 cell is height-bound at factor 1.6, with no drift in the gutter or grid.
- 1024×700: width-bound (factor 0.711), so the hero is 640 tall and the next section shows below it. This is by design.
- 390×844: stacked mobile, and nothing overflows.

Fixed after looking:
- The Tailwind breakpoint ordering bug (SKILL-FEEDBACK #0).
- The mobile hero spacing.
- The reservation heading wrapping to 3 lines (display 120 → 100).
- The ingredient cut-outs overlapping the stat labels (moved into the bottom padding, copy raised to `z-10`).

## 6. Server stopped

`lsof -i :4310` returns nothing. I also started a `next dev` on :4312 once, only to read `__scrub()`, and stopped it.

## Browser zoom (WCAG 1.4.4), added 2026-09-23

Added after the review in `docs/REVIEW-2026-09.md`. The build now inlines
`src/lib/fluid-zoom.js` in `<head>` (`FLUID_ZOOM_INLINE`, `src/app/layout.tsx`), and
`fluid.config.json` has `zoomCompensation: true` (regenerated `src/styles/fluid.css`).

`verify-matrix.mjs` zoom row, real Chromium zoom, production build (`next start -p 4317`):

| Window | Zoom | Before (text growth) | After (text growth) |
|---|---|---|---|
| 1440×900 | 125% | 117% | 125% |
| 1920×1080 | 125% | 109% | 125% |
| 1920×1080 | 150% | 124% | 150% |
| 1920×1080 | 200% (mobile) | 166% | 170% |
| 2560×1440 | 125% | 100% | 125% |
| 2560×1440 | 150% | 100% | 150% |
| 2560×1440 | 200% | 122% | 200% |

"Before" measured the first `main p` (an 11.6px label); "after" measured body copy
(`p[class*="fluid-copy-16"]`), with a 300% column added. Growth under the desktop layout is now
exactly proportional, with no horizontal overflow at any zoom level, and the full viewport matrix
still passes. The one remaining miss is the **mobile handover** at 1920×1080, 200%: the CSS
viewport (960) is below `engageAt`, so the page uses its mobile copy (15px), which is smaller than
the 17.65px the desktop copy had grown to on that window. 300% there reaches 255%. It is a property of
this page's mobile type sizes, not of the runtime (`fluid-scale.md` §12). Evidence:
`verify/zoom-before.json`, `verify/zoom-after.json`.
