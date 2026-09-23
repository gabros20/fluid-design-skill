# REVALIDATION — pizza-vite-gsap against the patched skill

This build re-syncs the example to the current `fluid-design/` artifacts, removes the local
workarounds listed in `SKILL-FEEDBACK.md`, and checks that the upstream fixes hold in a real
build. Nothing under `fluid-design/` was edited, and the revalidation agent itself committed nothing (the controller committed the result). The config is
unchanged: canvas 1600/64, reference 1440×900, engageAt 1024, ceiling 1.6.

## Summary

| Step | Result |
|---|---|
| 1. Regenerate the SCSS layer, remove workarounds | done |
| 2. Re-copy the GSAP modules and `motion.css`, remove markup seeds | done |
| 3. `npm run build`, `tsc --noEmit` | **PASS**, PASS |
| 4. `audit.mjs .` | **PASS**: no findings. Seeded negative probe: 3 errors and 1 warning, as expected |
| 5. `verify-matrix` (`--reveal`, fit on `[data-fit=screen]`) | **PASS**: 28/28 viewports, including the auto-added ceiling viewport 2880×1800 |
| 6. `scrub-jitter.mjs` parked at progress 0.5 | **PASS**: 0 presented frames, `paused: true`, on two runs |
| 7. Hero screenshot at 1440×900 | `screenshots/revalidation-hero-1440x900.jpg` (91 KB) |
| 8. Stop `vite preview --port 4320` | stopped. Nothing is listening on 4320 |

## Commands

```
# from the repo root
node fluid-design/scripts/generate-fluid.mjs --config examples/pizza-vite-gsap/fluid.config.json \
  --stack scss --out examples/pizza-vite-gsap/src/styles/fluid
cp fluid-design/assets/motion/gsap/src/*.ts examples/pizza-vite-gsap/src/motion/
cp fluid-design/assets/motion/gsap/motion.css examples/pizza-vite-gsap/src/motion/motion.css

# from examples/pizza-vite-gsap
npm run build                  # tsc --noEmit && vite build
npx tsc --noEmit
node ../../fluid-design/scripts/audit.mjs .
npx vite preview --port 4320 --strictPort          # backgrounded, then killed
node ../../fluid-design/scripts/verify-matrix.mjs http://localhost:4320 --config fluid.config.json \
  --reveal --fit-selector '[data-fit=screen]'
node scripts/scrub-jitter.mjs
node scripts/scrub-modes.mjs
```

Before regenerating, I sent the generator's output to a scratch directory and diffed it against
the files on disk. The only changes are the ones listed below.

## What changed in the example

**Generated layer (`src/styles/fluid/`)**
- `_fluid.scss`: `--fluid` is now `min(1.6px, max(0.58px, …))`, and `--fluid-chrome` is now
  `min(1.6px, …)`. Both come verbatim from `cssUnits(cfg)`. `fluid-frame` now has its own mobile
  half: a 1600px cap and a 24px gutter, 32px from 640, with the scaled cap and gutter only inside
  `fluid-up`. Its comment now says "once per section", which matches the recipe.
- `shared/base.css` now ships `*, *::before, *::after { box-sizing: border-box }`. Its
  reduced-motion block targets `[data-scrub-pin]`, `[data-scrub-content]` and
  `[data-scrub-spacer]`. It no longer targets `[data-motion-scene-viewport]`.
- `scss/README.md` documents the `--out` layout and the real `@use` path
  (`@use 'fluid/scss/fluid' as fd`), and has a box-sizing section.

**Removed workarounds**
- `main.scss`: removed the hand-written `:root { @include fd.fluid-up { --fluid: min(1.6px, …) } }`.
  Before deleting it, I confirmed that `min(1.6px` appears in the regenerated `_fluid.scss` (line
  151) and in `dist/assets/*.css`.
- `main.scss`: `.frame` is now just `@include fd.fluid-frame`. The guarded copy is gone.
- `main.scss`: removed the local border-box reset. `main.ts` imports `base.css` before
  `main.scss`, and `.frame` measures `box-sizing: border-box` with a width of 1440 at 1440×900.
- `index.html`: removed `data-motion-state="head"` from `<video data-scrub-video>` and updated the
  comment. At load, the mounted module writes `head` itself.
- `src/motion/scrubStage.ts`: the `LOCAL PATCH` is gone because the whole file was overwritten.
  The upstream copy has `if (next === 'scrub') video.pause()` at line 459. After the copy, every
  file in `src/motion` is byte-identical to upstream.
- Header theme: there was no markup workaround. I only updated the comment in `main.scss`. At load
  the header now has `data-theme="light"`.
- `FLUID.md`: the "Local deviations" section now says there are none.

**One intended visual change:** from 640px to 1023px, the gutter is now 32px (the mixin's
default). The old local `.frame` used 24px. It is still 24px below 640.

## Key numbers

- **Build:** `tsc --noEmit && vite build` both pass. CSS is 14.98 kB (3.62 kB gzip), JS is
  97.69 kB (37.93 kB gzip).
- **Audit:** `audit: no findings.` (exit 0) on the project root, which includes `index.html`. The
  generated `_fluid.scss` no longer trips `length-times-unit`.
- **Matrix:** all 28 viewports pass: 25 desktop, the ceiling viewport and 2 phones. Every check
  passes: overflow, units, fit and reveal. `gridCols` is empty because no element carries
  `data-verify-grid`.

| viewport | `--fluid` | display | copy | `--fluid-chrome` |
|---|---|---|---|---|
| 1440×900 | 1.0 | 1.0 | 1.0 | 1.0 |
| 2560×1440 | 1.6 | 1.6 | 1.6 | 1.6 |
| **2880×1800** (auto-added, natural factor 2.0 = 1.6 × 1.25) | **1.6** | **1.6** | **1.6** | **1.6** |
| 390×844, 375×667 | 1 | 1 | 1 | 1 |

- **Scrub:**
  - `scrub-jitter.mjs` returned `{"paused":true,"presented":0}` twice. The original build measured
    121 frames in 2 s.
  - `scrub-modes.mjs` read these modes at progress 0 → 0.5 → 1 → 0.5 → 0: head (playing), scrub
    (paused), tail (playing), scrub (paused), head.
  - A fresh load at scrollY 0 has `data-motion-state="head"` with no markup seed, and the header
    has `data-theme="light"`.

## SKILL-FEEDBACK findings: status

| # | Finding | Status |
|---|---|---|
| 1 | SCSS emitter ignores `ceiling` | **Fixed.** Confirmed in the generated file, the built CSS and the matrix. `--check` now also covers fixtures (`canvas-gutter-ceiling`, `chrome-disabled`, `width-only`) and exits 0 |
| 2 | `--fluid-fluid` when chrome is disabled | **Fixed.** Regenerated with chrome disabled: `--header-h` falls back to `48 * var(--fluid)` |
| 3 | `fluid-frame` unsafe below the breakpoint, and docs disagree | **Fixed.** The mixin has a mobile half, and its comment, the SCSS README and the recipe all say one frame per section |
| 4 | No border-box for non-Tailwind stacks | **Fixed.** It ships in `base.css` and is stated in the SCSS README |
| 5 | `--out` layout, `--help`, `prefix` text | **Fixed.** The README shows the real layout and `@use` path. `generate-fluid.mjs --help` and `verify-matrix.mjs --help` both work. The schema says `prefix` does not rename `--fluid*`. `audit.mjs --help` still exits with "unknown flag" (minor) |
| 6 | `frame-and-gutter.md` §1 claimed the frame shrinks when height binds | **Fixed in docs.** §1 now says the grow-only cap stays constant, and §3 names the trap |
| 7 | `ceiling` doesn't cap `--fluid-chrome` | **Changed upstream.** Chrome is now capped too (see `fluid-scale.md` and the schema's `ceiling` text). It resolves to 1.6 at 2560×1440 and at 2880×1800. The floor still does not apply to chrome, by design |
| 8 | The ceiling check can't fail at 2560×1440 | **Fixed.** `verify-matrix` auto-adds 2880×1800, and `calc.mjs table` labels those rows `ceiling` |
| 9 | Generator drift misdiagnosed as a stale stylesheet | **Fixed.** Only known old signatures are called stale, and a failure prints the raw and expected expressions |
| 10 | Audit flags the generator's own `@error` string | **Fixed.** CSS/SCSS string contents are blanked and generated files are skipped |
| 11 | Audit blind on SCSS and `index.html` | **Fixed.** A seeded probe caught `fixed-px-at-engage-scss` twice (inside `fd.fluid-up`), `fixed-px-at-engage` in `index.html`, and `img-svg` |
| 12 | Matrix defaults vs SKILL.md | **Fixed.** Default heights include 1440, and two phones are the default mobile set |
| 13 | `verification.md` §7 out of date | **Fixed.** The leaked note and the claim about "scans screenshots" are gone |
| 14 | GSAP scrub never pauses the decoder, and `wake()` doesn't rehydrate | **Fixed.** 0 frames at rest. `wake(true)` now calls `rehydrate('wake')` |
| 15 | `data-motion-state` absent at progress 0 | **Fixed.** Written once at mount, and confirmed without the seed |
| 16 | Warm tier calls `video.load()` | **Fixed.** The warm observer only assigns `src`. `load()` remains only on the missing-metadata recovery paths |
| 17 | Three names for the pinned layer | **Fixed.** `base.css` and the references use `[data-scrub-pin]` |
| 18 | `headerTheme` never writes the base theme at load | **Fixed.** A sentinel `current` makes the first resolve always write, and the header reads `light` at load |
| 19 | Engage breakpoint hand-typed in TS | **Partly fixed, still open (P2).** `scrubStage.ts` now defaults to `ENGAGE_QUERY` instead of its own literal, and `--stack ts` emits `ENGAGE_PX`/`ENGAGE_QUERY` from the config. But `eases.ts` still declares `'(min-width: 1024px)'`, and `stage.ts`, `scrollPull.ts` and `scrubStage.ts` import it from there. A project with `engageAt ≠ 1024` has to hand-edit `eases.ts` to re-export the generated constant (its docblock says so). This does not affect this example (engageAt 1024), so it keeps the shipped literal |
| 20 | `motion.css` veil paint and `translate` gotchas | **Fixed.** Both are documented in `motion.css` and in the GSAP README's gotchas |

## New findings

1. **P2: `report.json` labels passing unit rows `diagnosis: "mismatch"`.** On every engaged
   viewport, the `fluid`, `display` and `copy` rows have `pass: true` and `drift: 0`, yet
   `diagnosis: "mismatch"`. `diagnoseUnitMismatch` compares strings exactly. The browser
   serialises `0.58px` as `.58px` and expands `var(--fluid)` inside display and copy, so the raw
   string never equals `cssUnits(cfg)`'s text. Only chrome, which has no leading-zero decimal and
   no `var()`, reads `match`. The console output is unaffected because the diagnosis is printed
   only for failing rows. Anyone reading the JSON would still see a false alarm. Fix: normalise
   leading zeros and resolve `var()` before comparing, or set the diagnosis only when `pass` is
   false.
2. **P2: `audit.mjs --help` is still an "unknown flag".** It is the one script left without
   `--help`.

`VERIFY.md` and the `verify-out/` evidence still describe the original build. This file supersedes
them for the current state.
