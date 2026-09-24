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
| INFO `fixed-px-at-engage` Header.tsx:79, `lg:tracking-[0.08em]` | Tracking in `em` is deliberately off the scale (typography.md). The line also carries `fluid-ui-*` utilities, which is the documented way to spend the `ui` unit. |

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

Follow-up the same day, after the skill moved on:
- `fluid-text-*` now zooms by size (`zoomTextRange: [24, 48]`), so this build's small
  `fluid-text-14/18` … `fluid-text-18/24` copy zooms fully and `fluid-text-112/112` holds its box.
- `src/styles/base.css` is the post-split, render-only file; its motion half (smooth scrolling,
  reduced-motion collapse, `--fill`, noscript) is now `src/styles/animation/animation.css` from the
  `scroll-animation` skill, imported right after it in `globals.css`.
- Re-verified on a fresh production build: full matrix PASS, zoom row PASS except the 1920×1080
  200% mobile handover (166%). Real-zoom captures: `verify/zoom/zoom-<window>-<pct>.jpg`.

### Try it yourself

```
pnpm build && pnpm start          # or npm
```

Open http://localhost:3000 in Chrome on a wide window, then Cmd/Ctrl + to 125, 150, 200%. Body
copy should grow with every step while the desktop layout holds; the big display lines wrap inside
their columns. In DevTools, `getComputedStyle(document.documentElement).getPropertyValue('--fluid-zoom')`
shows the detected zoom. Compare with `zoomCompensation: false` (regenerate `src/styles/fluid.css`)
to see the old behaviour: text that barely moves until the page falls to its mobile layout.

## Scaled travel (Motion), added 2026-09-23

`src/components/sections/HeroPeelDrift.tsx`: as the hero scrolls away the peel drifts 240 drawn px
right and turns 8°, with `x = progress × 240 × useFluidUnit()` (scroll-animation's
`fluid-interop.md` §3, pattern 3). Desktop only; off under reduced motion. Measured at half the
hero scrolled, resizing in place without a reload:

| Viewport | `--fluid` | Drift | Expected (0.5 × 240 × unit) |
|---|--:|--:|--:|
| 1440×900 | 1.000 | 120.00 | 120.00 |
| 2560×1440 | 1.600 | 192.00 | 192.00 |
| 1280×700 | 0.778 | 93.33 | 93.33 |

No console errors or warnings. `verify-motion --reveal --scenes`: PASS at 1440×900 and 390×844.
To see it: scroll the hero on a 1440 window, then on a 2560 one (or zoom the window out); the
peel ends the same fraction of the way across the composition.

## Mobile arm, added 2026-09-23

`fluid.config.json`: `mobile: { enabled: true, reference: 390, min: 0.85, max: 1.25 }`. The mobile
half of every section is now written in fluid utilities with the 390 frame's numbers
(`fluid-py-96 lg:fluid-py-120`, `fluid-display-44 leading-[1.02] … lg:fluid-display-112/112`). Kept
fixed on purpose: `sm:` tablet overrides, text measures, tracking, radii, entrance offsets.

- **No-op at the reference.** Geometry of all 247 elements at 390×844 before vs after: 0 changed.
- **Matrix:** PASS on every desktop cell and at 360×780, 390×844, 430×932 and 768×1024.
- **Zoom row:** every cell PASS. The mobile handover at 1920×1080 and 200% went from 166% to 212%,
  because the mobile type is at 1.25× on that wide CSS viewport.
- **Motion:** `verify-motion --reveal --scenes` PASS at 1440×900, 390×844, 360×780 and 768×1024.
- Captures: `verify/mobile-arm/` (360 and 768).

To see it: open the page in a responsive devtools view and drag between 340 and 1000 wide. The
phone layout now scales as one drawing between 331 and 488 and holds at 1.25× beyond.

## Mobile bands, added 2026-09-24

The mobile arm now runs the phone design in three bands (`fluid-scale.md` §13): phone (0.82–1.10
off 390), portrait tablet (1.10–1.30, centred column) and landscape phone (1.00–1.20, centred
column); landscape tablets (1024+) take the desktop design. `fluid.config.json` is just
`"mobile": { "enabled": true }` (defaults).

- **No-op at the reference:** 390×844 geometry identical to the pre-arm build.
- **Matrix:** PASS on every desktop cell and at 320×568, 375×812, 390×844, 430×932, 844×390,
  932×430, 820×1180 and 834×1194 (Chromium).
- **Motion:** `verify-motion --reveal --scenes` PASS at 390×844, 844×390, 820×1180 and 1180×820.
- **Zoom row:** every cell PASS.

See it: DevTools device mode, then iPhone SE → 15 → Pro Max (same composition, slightly larger),
rotate to landscape (a touch larger, centred), iPad Air portrait (larger still, centred column),
iPad landscape (the desktop design).

## fluid-design v2, added 2026-09-24

Migrated with `fluid migrate --write`, then `fluid generate`: `fluid.config.json` is now the
11-line v2 shape (`version: 2`, `bands`, `output.integration: "next"`); every tuning number that
used to live in that file is now a registered CSS variable, left at its default in
`src/app/globals.css`'s `:root`. The generated output moved from three hand-copied files
(`src/styles/fluid.css`, `src/styles/base.css`, `src/styles/tokens.css`) plus `src/lib/cn.ts` and
`src/lib/frame.ts` to one generated folder, `src/styles/fluid/`, with a single import
(`@import '../styles/fluid/fluid.css'`). Browser-zoom inlining moved from a hand-imported
`FLUID_ZOOM_INLINE` script to `<FluidHead />` (`src/styles/fluid/integrations/next`). No visual or
behavioural change was intended by the migration; the checks below confirm none happened.

- **verify-matrix:** PASS in Chromium, WebKit and Firefox, including the real-zoom row.
- **Geometry:** identical to the pre-migration (v1) build at 9 of 10 verified viewports. The
  exception is 320×568, where type differs by 0.3% — v1 rounded its phone floor to 2 decimals,
  v2's knee computes it exactly (`fluid-design/references/config.md`, "The engine"). Not a
  regression; the more precise number is v2's.
- **verify-motion:** `--reveal --scenes --anchors` PASS.
