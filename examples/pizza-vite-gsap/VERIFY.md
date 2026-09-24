# VERIFY — evidence for the definition of done

Run on 2026-09-23 against `npx vite preview --port 4320`, a production build that I started and
stopped myself. Raw outputs are in `verify-out/`. The PNGs and contact sheets are git-ignored
because they are large and reproducible.

## 1. Build and types: PASS
- `npx tsc --noEmit`: clean, with `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals` and
  `verbatimModuleSyntax` on TypeScript 7.0.2.
- `npm run build` (`tsc --noEmit && vite build`): built. Output is 17.1 kB of HTML, 14.8 kB of CSS
  and 96.4 kB of JS (37.5 kB gzip, mostly GSAP).

## 2. Audit: 1 error, a false positive in the skill's generated file (see SKILL-FEEDBACK #10)
`node ../../fluid-design/scripts/audit.mjs src` → `verify-out/audit-src.txt`:
one `length-times-unit` error at `src/styles/fluid/scss/_fluid.scss:39`. That line is the
generator's own `@error "…64px * var(--fluid)…"` message string, in a do-not-edit generated
file. No hand-written file has a finding. Scanning the project root (which adds `index.html`)
gives the same single finding. Caveat: on the SCSS stack the audit's main rule cannot see fixed
px values in SCSS at all (SKILL-FEEDBACK #11), so this result is weak evidence.

## 3. Viewport matrix: PASS
- **The brief's exact command** (`--reveal --screens --fit-selector '[data-fit=screen]'`):
  PASS on all 20 cells, 1024–2560 × 640–900. Output in `verify-out/brief-command.txt`. It
  never visits 2560×1440 or a phone, because those are not in the defaults (SKILL-FEEDBACK #12).
- **Extended**: `--widths 1024,1440,1680,2560,3840 --heights 700,900,1440,2160 --mobile 390x844,375x667`.
  PASS on all 22 cells: overflow, units, fit and reveal. Output in `verify-out/extended.txt`.
- **Non-default units confirmed** by the verifier's own maths from `fluid.config.json`:
  1024×700 → 0.7111, 1440×900 → 1.000, 1680×1440 → 1.1667, **2560×1440 → 1.600 (capped)**,
  2560×2160 → 1.600, 3840×2160 → 1.600. The raw expression is
  `min(1.6px, max(.58px, min(calc(100svh / 900), calc(100vw / 1440))))`.
- **The ceiling actually binds.** At 2560×1440 the uncapped value is also 1.6, so that cell
  cannot tell a capped build from an uncapped one. The negative control
  (`verify-out/negative-no-ceiling-patch/report.json`) is the generator's raw SCSS without the
  local ceiling re-declaration. It FAILS at 2560×2160 (`--fluid` 1.778) and at 3840×2160 (2.4).
  The patched build passes both at 1.6.
- `probe.mjs` at 1440×900: FRESH. All four units are 1.0000.
- Hero fit: `height / innerHeight` is 1.0 wherever height binds (1440×700, 2560×1440,
  3840×1440) and ≤ 1 everywhere else.

## 4. Scrub modes: PASS
`node scripts/scrub-modes.mjs` drives `#forno` by scene progress in 20 steps, then waits 2.5 s
for the glide:

| progress | 1440×900 mode / frame | 390×844 mode / frame |
|---|---|---|
| 0 | head / 9 (loop 1–60) | head / 9 |
| 0.5 | scrub / 169, paused | scrub / 171, paused |
| 1 | tail / 253 (loop 241–298) | tail / 253 |
| 0.5 (back) | scrub / 170 | scrub / 172 |
| 0 (back) | head / 2 | head / 2 |

The expected frame at progress 0.5 is 169: headExit 0.0067 and tailEnter 0.822 on an 1800px
range give t = 0.60 → 61 + 0.60·180. `scripts/scrub-jitter.mjs`, parked at 0.5: 0 frames
presented in 3 s, paused. Before the local `scrubStage.ts` patch it presented 121 frames in 2 s,
alternating 171 and 172 (SKILL-FEEDBACK #14). `data-motion-state="head"` at progress 0 relies on
the markup seed (SKILL-FEEDBACK #15).

## 5. Screenshots I looked at
- **1440×900**: the header rail sits on the 64 gutter, "Pinsa romana" is at 200px, the peel is
  centred on the sand arc, the flanking copy is on the gutters and the vertical Réservation pill
  is on the right rail. Nothing is clipped. This is the calibration point: the frame is 1440 with
  1312 of content.
- **1024×700**: the same composition at 0.711, the whole hero is within 640px, and the headline
  fits the frame.
- **2560×1440**: the same composition at 1.6, and the header is on the scaled rail.
- **390×844**: plain mobile: stacked hero, pill as a horizontal button, a 2-up menu, 2-up stats,
  acts over the pinned video, and a stacked footer.
- 1680×700 (height binds on a wide window): the hero's flanking copy spreads to the 1600px
  frame's gutters while the centre shrinks. That is expected from the grow-only cap, but it
  contradicts `frame-and-gutter.md` §1 (SKILL-FEEDBACK #6). The menu grid was 6 columns there
  before its own width went on the scale; it is now 4 at every viewport
  (`scripts/grid-cols.mjs`).

## Extra checks (`scripts/misc-checks.mjs` → `verify-out/misc-checks.txt`)
Header ink: no attribute over the hero (light is the base), `dark` over the numbers, the scene
and the footer, and `light` again back over the menu. The count-ups end at 72, 450, 90 and 3. The
FadeOnExit group reads opacity 1 on arrival, 0 once 75% of the way out, and 1 again when
scrolled back.

## Who did the work
All of it was done in this session by lead-8 directly. No sub-workers were dispatched: the
page is one `index.html` plus one stylesheet that every section shares, so there were no
disjoint files to split.

> Note on `screenshots/screenshot-1440x900.jpg`: it is a full-page capture, so the pinned scrub scene
> appears as a long dark band. The video only paints inside the sticky viewport-sized pin while you
> scroll; see `screenshots/scrub-*.jpg` for the scene at progress 0, 0.5 and 1.

## Browser zoom (WCAG 1.4.4), added 2026-09-23

Brought onto the post-review system (`docs/REVIEW-2026-09.md`):
- `fluid.config.json`: `zoomCompensation: true`, `zoomTextRange: [24, 48]`; `src/styles/fluid/`
  regenerated (SCSS layer and the render-only `shared/base.css`).
- `src/motion/motion-base.css` (from the `scroll-animation` skill) carries the motion half the old
  `base.css` held; imported right after it in `src/main.ts`.
- `src/lib/fluid-zoom.js` (+ `.d.ts`) inlined at the top of `<head>` by a small Vite plugin in
  `vite.config.ts` (`transformIndexHtml`), because a `<script type="module">` is deferred and a
  zoomed page would paint small type first.

`verify-matrix.mjs` on `vite preview`: full matrix PASS (including the ceiling viewport), zoom row
with `--zoom-selector 'main p'` (the hero copy, `fluid-type(16, 22, text)`):

| Window | 125% | 150% | 200% |
|---|--:|--:|--:|
| 1440×900 | 125% | 156% (mobile) | 208% (mobile) |
| 1920×1080 | 125% | 150% | 170% (mobile handover) |
| 2560×1440 | 125% | 150% | 200% |

Before the size-weighted `fluid-text` rule, this build did not zoom at all on the desktop layout
(100% at every level on 1920 and 2560), because 8 of its 14 type styles are `fluid-text`. Zooming
`fluid-text` fully instead broke the hero at 2560×1440 and 200%: the 200px "Pinsa romana" wrapped onto
two lines over the copy. By size, the title holds one line and the copy doubles. Known cosmetic
issue: at 200% the fixed "Réservation" tab sits over the end of the right-hand hero copy.
Captures: `verify/zoom/zoom-<window>-<pct>.jpg`.

### Try it yourself

```
npm run build && npm run preview   # http://localhost:4320
```

Chrome on a wide window, Cmd/Ctrl + to 125, 150, 200%.
`getComputedStyle(document.documentElement).getPropertyValue('--fluid-zoom')` shows what the
runtime detected.

## Scaled travel (GSAP), added 2026-09-23

`src/main.ts` + `src/styles/main.scss`: as the hero scrolls away the peel drifts 240 drawn px right
and turns 8°. GSAP tweens only a unitless `--scene-p` (ScrollTrigger scrub, desktop and
no-reduced-motion via `gsap.matchMedia`); CSS turns it into
`translate: calc(var(--scene-p) * 240 * var(--fluid)) 0` (scroll-animation's `fluid-interop.md`
§3, pattern 1). Same measurements as the Next build: 120.00 / 192.00 / 93.33 px at
1440×900 / 2560×1440 / 1280×700, exact, through in-place resizes.

**What this found.** The drift first sat at 0. GSAP folds an element's CSS `translate`/`rotate`/
`scale` into its own transform on its first transform tween (inline `translate: none`), and the
entrance tweens `.hero__pizza`. A plain % survives (the `-40%` centring), but a `calc()` does not.
The drift now lives on the `<img>` inside, which GSAP never tweens. Both skills' docs are corrected
(`motion-architecture.md` §7, `fluid-interop.md` §3, `fluid-scale.md` §11), and the
scroll-animation smoke test carries a canary that fails if GSAP ever stops folding.

## Mobile arm, added 2026-09-24

`fluid.config.json`: `mobile: { enabled: true, reference: 390, min: 0.85, max: 1.25 }`. Every
base-level (mobile) length in `src/styles/main.scss` now goes through the unit functions with the
390 frame's numbers (`padding-block: fd.fluid(96)`, `@include fd.fluid-type(56, 56, display)`,
header and footer on `fd.fluid-chrome()`); the frame mixin's gutter is a scaled 24 instead of
24 → 32px at 640. `(width >= 640px)` tablet steps stay px. The menu tile radius scales with the tile
(`border-radius: fd.fluid(20)`, `utilities.rounded` on by default).

- **No-op at the reference:** geometry of all 194 elements at 390×844, before vs after: 0 changed.
- **Matrix:** PASS on every desktop cell and at 360×780, 390×844, 430×932, 768×1024.
- **Zoom row:** every cell PASS; 1920×1080 at 200% went from 170% (flat mobile) to 212%.
- **Motion:** `verify-motion --reveal --scenes` PASS at 1440×900, 390×844, 360×780, 768×1024; the
  peel drift is still exact (120 / 192 / 93.33px).
- Captures: `verify/mobile-arm/`.

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

Migrated with `fluid migrate --write`, then `fluid generate --stack scss`. `fluid.config.json` is
now the v2 shape (`version: 2`, `bands`, `output: { stack: "scss", integration: "vite" }`); the
three non-default numbers this build carries (container width/padding, growth ceiling) moved from
`fluid.config.json` (`canvas`, `ceiling`) to three `--fluid-desktop-*` CSS variables set in
`main.scss`'s own `:root`. The generated SCSS layer moved from `src/styles/fluid/scss/_fluid.scss`
(`@use 'fluid/scss/fluid' as fd`) plus a hand-copied `shared/base.css` to one generated folder,
`src/styles/fluid/` (`@use 'fluid' as fd`, with `src/styles` on the Sass `loadPaths`), imported
once from `main.ts` (`import './styles/fluid/fluid.css'`). `fd.fluid-up` is now `fd.fluid-desktop`
(`fluid-up` still works as an alias). Browser-zoom inlining moved from a hand-written Vite plugin
reading `src/lib/fluid-zoom.js` to `fluidPlugin()` (`src/styles/fluid/integrations/vite`). No
visual or behavioural change was intended by the migration; the checks below confirm none
happened.

- **verify-matrix:** PASS in Chromium, WebKit and Firefox, including the real-zoom row.
- **Geometry:** identical to the pre-migration (v1) build at 9 of 10 verified viewports. The
  exception is 320×568, where type differs by 0.3% — v1 rounded its phone floor to 2 decimals,
  v2's knee computes it exactly (`fluid-design/references/config.md`, "The engine"). Not a
  regression; the more precise number is v2's.
- **verify-motion:** `--reveal --scenes --anchors` PASS.
