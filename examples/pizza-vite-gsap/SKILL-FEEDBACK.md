# SKILL-FEEDBACK — fluid-design, from a fresh Vite + SCSS + GSAP build

Findings from test build B: Forno Aurelia on Vite 8, vanilla TS, `sass` and GSAP 3.15. The config
is deliberately non-default: canvas 1600/64, reference 1440×900, engageAt 1024, ceiling 1.6. Each
finding says what happened, the evidence, and a suggested fix. Severity: **P0** means the build is
wrong without a workaround; **P1** means wrong output or misleading guidance; **P2** means friction
or docs.

## Generator (`scripts/generate-fluid.mjs`)

### 1. P0: the SCSS emitter ignores `ceiling`
`buildScss()` hand-writes the unit expressions instead of calling `cssUnits(cfg)`. With
`"ceiling": 1.6`, the css, tailwind-v4 and stylex stacks emit
`--fluid: min(1.6px, max(0.58px, …))`, but the scss stack emits `max(0.58px, …)` uncapped.
Nothing in the output says so: the file header even prints `ceiling 1.6`.
- Evidence: `verify-out/negative-no-ceiling-patch/report.json`, a build without the local
  workaround. It passes at 2560×1440 and 3840×1440, and fails at 2560×2160 (`--fluid` 1.78,
  expected 1.6) and at 3840×2160 (2.4, expected 1.6).
- Fix: build the SCSS `fluid-units` mixin from `cssUnits(cfg)` as the other stacks do. Extend
  `--check` beyond the default config. It only compares against the defaults, which is how this
  slipped through; a small non-default fixture config per stack would have caught it.
- Workaround in this build: `:root { @include fd.fluid-up { --fluid: min(1.6px, …) } }` in
  `main.scss`.

### 2. P1: the SCSS emitter emits `--fluid-fluid` when chrome is disabled
With `units.chrome.enabled: false`, `--header-h` becomes `… + 48 * var(--fluid-fluid)`. That
property is undefined, so the whole `--header-h` is invalid. The vanilla emitter correctly
falls back to `var(--fluid)`. Checked by regenerating with chrome disabled.

### 3. P1: the `fluid-frame` mixin is unsafe outside `fluid-up`, and the docs disagree on where it goes
- The mixin sets `padding-inline: fluid(64)`. Below the breakpoint that is 64px of gutter on a
  phone, and there is no mobile gutter. The SCSS example in `section-recipe.md` includes it
  unconditionally (`&__inner { @include fluid-frame; }`), which does exactly that.
- The mixin's own comment says to apply it "to the page's single outermost content wrapper, not
  to every section". `SKILL.md` §3, `section-recipe.md` and `frame-and-gutter.md` all say one frame
  per section, with full-bleed colour on the section.
- Fix: give the mixin the mobile half (`max-width: <canvas>px; padding-inline: 24px;` then
  `@include fluid-up { … }`) or rename it `fluid-frame-up`. Make the comment agree with the recipe.

### 4. P1: nothing tells a non-Tailwind build that it needs `box-sizing: border-box`
`base.css` says to include it "after your reset/preflight", and the SCSS and vanilla READMEs never
mention a reset. Without border-box, `max-width: max(1600px, …)` caps the content box, so the
frame renders at 1600 + 2·64 = 1728. My first 1440×900 screenshot had the header CTA and the
right-hand hero copy cut off. Fix: ship the border-box rule in `base.css`, or state the
requirement in the SCSS and CSS READMEs.

### 5. P2: output layout and discoverability
- `--out src/styles/fluid` writes to `src/styles/fluid/scss/_fluid.scss` and
  `src/styles/fluid/shared/base.css`. The stack name is nested under `--out`, and `shared/base.css`
  and a `README.md` are always written. The SCSS README's usage (`@use 'fluid-design/fluid'`)
  matches neither path. I needed `loadPaths: ['src/styles']` and `@use 'fluid/scss/fluid'`.
- `generate-fluid.mjs --help` and `verify-matrix.mjs --help` both crash or exit with "unrecognised
  argument", yet `verification.md` §7 says to "check each script's own `--help`". Only
  `probe.mjs` has one.
- `prefix` is documented in the schema as renaming every `--fluid*` custom property. No stack
  does that: with `"prefix": "fx"`, the css and scss output still say `--fluid`. CONTRACT says
  the names are fixed. Pick one and fix the schema text.

## Frame and scale model

### 6. P1: `fluid-cap` is grow-only, so the frame does NOT shrink when height binds, and the auto-fill fix breaks there
`frame-and-gutter.md` §1 says that when the height arm binds, "the frame is `1680·f`, narrower
than the window". It is not: `max(1600px, 1600·f)` stays 1600px whenever f < 1. At 1680×700
(f = 0.78), the page frame was 1600 wide while every drawn element inside was at 0.78.
Consequences:
- **The §3 auto-fill fix fails here.** With `minmax(min(fluid(296), 100%), 1fr)` in the frame,
  the menu measured **6 columns at 1680×700**. It was 4 everywhere else. The frame's content box
  (1500) is not on the scale, but the minimum (230) is. Fixed by also stating the grid's own
  width on the scale (`width: fluid(1472); max-width: 100%`). Now 4 columns at every viewport
  from 1024×640 to 3840×2160 (`scripts/grid-cols.mjs`).
- Absolutely positioned flanking copy, pinned to the frame's gutters, drifts away from a centred
  composition on short, wide windows (see the 1680×700 hero).
- Fix: correct §1's claim. In §3, say that a comparison box inside a grow-only cap must itself
  be on `--fluid` for the fix to hold when height binds. The verifier could also report the
  grid-column count per viewport, which is how I found this.

### 7. P1: `ceiling` does not cap `--fluid-chrome`
By design (the schema says chrome is "independent of floor/ceiling"), but the effect on a page is
surprising. At 3840×2160 with ceiling 1.6, the hero headline is 320px and the footer wordmark on
`fluid-chrome(200)` is **480px**. The chrome grows 1.5× past everything the ceiling holds, on the
screens that set the ceiling for their assets. Suggestion: cap chrome with the ceiling, or say in
`fluid-scale.md` §7 that chrome keeps growing.

### 8. P2: the brief's ceiling check at 2560×1440 cannot fail
At 2560×1440 with a 1440×900 reference, the natural `--fluid` is exactly 1.6: both arms give 1.6.
Capped and uncapped builds pass identically. That is how bug #1 hides from the obvious check. To
exercise a ceiling, the matrix needs a viewport where the natural factor is above it (2560×2160
or 3840×2160). `verify-matrix` could add one automatically when `ceiling` is set. Also,
`calc.mjs table` labels a ceiling-bound row as arm `height`.

## Verifier and audit

### 9. P1: `verify-matrix` misdiagnoses a generator bug as a stale stylesheet
The drift in #1 was reported with "classic stale stylesheet: close the tab and open a fresh
one, or rm -rf the build cache". This was a fresh `vite preview` of a fresh build. The verifier
could print the `raw` expression next to the expected one (it has both in `report.json`). A
missing `min(<ceiling>px` is diagnosable on the spot.

### 10. P1: `audit.mjs src` reports an error in the skill's own generated file
`length-times-unit` fires on `_fluid.scss:39`. That is the text of the generator's own `@error`
message ("`64px * var(--fluid)` is invalid…"). Comments are stripped before scanning, but string
literals are not. Any SCSS project that generates into `src/` fails the DoD's "zero errors" out of
the box. It is the only finding on this project, whether scanning `src` or the root. Fix: strip
string literals too, or skip files with the `GENERATED by fluid-design` header.

### 11. P1: for SCSS and vanilla stacks, the audit is close to blind
`fixed-px-at-engage`, the rule that catches the core mistake, only matches Tailwind class
strings (`lg:py-[120px]`). A fixed `padding-block: 120px` inside `@include fd.fluid-up { }` is
invisible to it. On this stack, "0 errors" says little about the thing the skill most wants
checked. Also, in a Vite layout the markup lives in the root `index.html`, which `audit.mjs src`
does not scan. Suggestion: scan `.scss` blocks nested in `fluid-up`, or in the engage media
query, for bare px lengths on the families in the rule.

### 12. P2: defaults differ from what SKILL.md says the matrix covers
SKILL.md §7 says heights 640/700/800/900/**1440**, "plus phones". The default `--heights` is
640,700,800,900 and the default `--mobile` is empty. The brief's exact command therefore never
visits 2560×1440 or any phone. I added `--heights … 1440,2160 --mobile 390x844,375x667`.

### 13. P2: `verification.md` §7 is out of date
It describes `audit.mjs` as scanning matrix screenshots for drift, but it is a static source
scanner. It also still says "These are being written by another worker in this skill", an
internal note that leaked into the reference.

## GSAP port (`assets/motion/gsap`)

### 14. P0: `scrubStage.ts` never pauses the decoder when scrub takes over
The React `ScrubStage` pauses on `mode === 'scrub'`; the GSAP `setMode` only writes the
attribute. When a reader arrives from the head loop, the video keeps playing under the glide.
Parked at progress 0.5, `requestVideoFrameCallback` recorded **121 presented frames in 2 s,
alternating 171 and 172**: a visible shimmer at rest, plus a busy decoder. With a one-line local
patch (`if (next === 'scrub') video.pause()` in `setMode`), the result is 0 presented frames and
`paused: true` (`scripts/scrub-jitter.mjs`). The attribute test alone could not see this: modes
were correct either way. Upstream fix: mirror the React effect. The React port also rehydrates
on the wake edge (`rehydrate('wake')`); the GSAP `wake()` only flips a flag.

### 15. P1: `data-motion-state` is absent until the first transition
`mode` starts as `'head'` and `setMode` returns early when nothing changes, so a page loaded
at progress 0 never gets `data-motion-state` at all. "Head at progress 0" is unverifiable, and
the marker CSS in `verification.md` §3 cannot show it. Workaround: seed
`data-motion-state="head"` in the markup. Fix: write the initial mode once in `mountOne`.

### 16. P1: the warm tier calls `video.load()`, which `video.md` §5 forbids
`video.md`: "Never call `.load()` on the warm tier … on phones this aborts an in-progress
`play()`." `scrubStage.ts`'s `warmObserver` runs `video.preload = 'auto'; video.load()`. Also
note that `pickTier` sets `video.src` directly, so there is no `<source media>` resync path. That
is fine, but `video.md` §8 reads as if there were one.

### 17. P2: three names for the pinned layer
`motion.css` and `scrubStage.ts` use `[data-scrub-pin]`. `base.css`'s reduced-motion block
targets `[data-motion-scene-viewport]`, and `scroll-scenes.md` §10 targets
`[data-scrub-stage-sticky]`. Only the first exists in the GSAP contract, so base.css's
structural collapse is dead CSS here; `motion.css` does the work. Also, `scroll-scenes.md` §10
and `verification.md` §3 point to "`SKILL.md` §3" for the attribute contract, but SKILL.md has no
attribute table.

### 18. P2: `headerTheme.ts` never writes the base theme at load
`current` is initialised to `base`, so on a page that starts over a light section the header
never gets `data-theme`, until the first flip. The CSS has to treat "no attribute" as the base
theme. Say so in the docblock, or write it once on mount.

### 19. P2: the engage breakpoint is hand-typed in two TS places the generator does not know about
`ENGAGE_QUERY = '(min-width: 1024px)'` in `eases.ts`, and a literal `'(min-width: 1024px)'` in
`scrubStage.ts` (not even `ENGAGE_QUERY`). SKILL.md §2.4 warns that "three copies of one number
drift; that is why the config exists", but the generator emits no TS constant. With
`engageAt ≠ 1024` this breaks silently. Suggestion: `--stack gsap` or a `fluid.config.ts` emit.

### 20. P2: small gaps in the GSAP README
- `motion.css` gives `[data-stage-veil]` no background. You must paint it, or the veil is an
  invisible fixed layer.
- The variant CSS owns `transform`, so any centring on a stage item has to use the individual
  `translate` property (`translate: -50% 0`). A `transform: translateX(-50%)` is overwritten by
  the hidden state and then by GSAP. Worth one line in the README; the hero pizza and arc here
  depend on it.

## What worked well
- The GSAP sources compile cleanly under `strict`, `noUncheckedIndexedAccess`,
  `noUnusedLocals`, `verbatimModuleSyntax` and TypeScript 7.
- The SCSS unit functions' `@error` on a unit-bearing argument is a real improvement over the
  Tailwind path.
- The typography container rule decided every type-unit call with no guesswork. It also caught
  the hero headline: on the display curve it would have overflowed at 1024×700.
- The scrub machine (hysteresis, glide, rVFC wrap) needed no tuning beyond seam frames. Modes
  read head, scrub, tail and back at progress 0, 0.5 and 1, at desktop and phone sizes.
- Building the loops to be periodic by construction (a generated clip) made the seam measurement
  trivial. `video.md` could offer that as the easy route for synthetic clips.
