# Fluid design system — browser support & performance research

Scope: the Eagle `--fluid` system as generated in
`/Users/tamas/Documents/Personal/Projects/fluid-design-skill/fluid-design/assets/styles/tailwind-v4/fluid.css`
and `shared/base.css`:

```css
:root { --fluid: 1px; }
@media (width >= 1024px) {
  :root {
    --fluid: max(0.58px, min(calc(100svh / 900), calc(100vw / 1440)));
    --fluid-display: max(0.82px, var(--fluid), calc(0.62 * var(--fluid) + 0.38px));
    --fluid-copy: max(0.9px, var(--fluid), calc(0.33 * var(--fluid) + 0.67px));
    --fluid-chrome: min(calc(100vw / 1440), max(1px, calc(100svh / 900)));
  }
}
```

Every consumer is `calc(N * var(--fluid))` inside a Tailwind v4 `@utility`. Below
`lg` (1024px) everything is a flat `1px` — mobile is untouched by any of this.
`cqw`/`container-type: inline-size` is used elsewhere for over-budget rows.

---

## 1. Browser support matrix

### ⚠ Verified finding, load-bearing for this whole system: `svh` did NOT reliably hold still on iOS Safari for about a year of the browsers this stack claims to support

The codebase's own rationale (`globals.css:392-395`, mirrored in
`fluid.css`'s docblock) for choosing `svh` over `dvh` is: *"svh is the
SMALLEST viewport height and does not move once the page has loaded"* — specifically
that it stays fixed when iOS Safari's toolbar collapses/expands on scroll.
That assumption was **false on shipping iOS Safari for roughly a year**:

- [WebKit bug 261185 — "\[iOS\] `svh`/`dvh` units are unexpectedly equal when Safari tab bar is not visible"](https://bugs.webkit.org/show_bug.cgi?id=261185): reported against iOS 16.4.1. Both `svh`- and `dvh`-sized elements changed size together as the toolbar collapsed — i.e. on affected Safari versions, `svh` behaved exactly like `dvh`, the thing this system exists specifically to avoid. One WebKit engineer's comment on the bug confirms the *intended* behavior for contrast: "When the toolbar is automatically hidden due to scrolling, only the dvh sized bar changes. The svh sized bar stays unaffected. This is as expected" — i.e. that's the spec-correct behavior the bug was violating.
- Fixed via WebKit commits 270516@main (2023-11-10) and a follow-up regression fix 270652@main (2023-11-13).
- [WebKit's own "Features in Safari 17.4" post](https://webkit.org/blog/15063/webkit-features-in-safari-17-4/) confirms the fix **shipped in Safari 17.4** (released ~March 2024), alongside a related fix for viewport units after entering/exiting fullscreen.
- Independent confirmation with a live test case: [donald.au/bugs/svh](https://donald.au/bugs/svh/) — "Mobile Safari is not distinguishing between the CSS units svh and dvh... both the elements sized with svh and dvh change their size" during toolbar transitions.

**Concrete exposure window**: Tailwind v4's own stated baseline is Safari
16.4+ (see below) — meaning **every Safari version this stack officially
supports from 16.4 up to 17.3 has this bug**. On any of those (roughly a
year of shipping iOS Safari, 16.4 → 17.3, before the 17.4 fix), the whole
justification for this system's #1 invariant ("svh, never dvh — svh doesn't
move mid-scroll, dvh does") does not hold: `--fluid`'s height arm would in
fact move as the iOS toolbar collapses on those versions, degrading exactly
into the "layout thrash over a scroll-driven scene" scenario the docblock
says `svh` was chosen to prevent. This doesn't change the choice — `dvh`
would be strictly worse (moves on every version, not just buggy ones) — but
it means the invariant is safe in *practice* only for visitors on Safari
≥17.4 (iOS 17.4+, spring 2024+), not for the full stated Safari 16.4+
baseline. Worth checking current iOS Safari adoption numbers before treating
this as fully closed; iOS updates fast (Apple's own adoption dashboards
typically show >90% on the latest or second-latest major within a few
months of release), so by late 2026 this is likely a small and shrinking
slice of traffic, but it is not zero and it is not hypothetical — it shipped
broken for a real interval.

### Remaining matrix (features, first-supporting versions, global %)

| Feature | Chrome/Edge | Firefox | Safari | Global support | Source |
|---|---|---|---|---|---|
| `min()`/`max()`/`clamp()` comparison functions | 79+ | 75+ | 13.1+ (partial 11.1–13) | ~92% ("CSS math functions" score) | [caniuse: css-math-functions](https://caniuse.com/css-math-functions) |
| Custom properties (`var()`) as `calc()` operands | same as CSS custom properties generally (Chrome 49+, Firefox 31+, Safari 9.1+) — combining `var()` inside `calc()` has been supported essentially since both features shipped, no separate historical carve-out found; old Edge (pre-Chromium, EdgeHTML 15–18) had known bugs with `var()` inside shorthand properties and inside `calc()` in nested contexts, moot now that Edge is Chromium | — | — | — | general knowledge + [MDN var()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/var); no live source specifically pinned the legacy-Edge quirk, flagging as recalled-not-reverified |
| `svh`/`lvh`/`dvh` (small/large/dynamic viewport units) | 108+ | 101+ | 15.4+ | ~94% | [caniuse via search summary](https://caniuse.com/?search=svh) (direct caniuse page fetch failed in this pass; number corroborated by two independent secondary sources, not independently re-verified against the raw caniuse table) |
| Container queries (`container-type`) + `cqw`/`cqi`/etc. units | 105+ | 110+ | 16+ | ~90% | [caniuse: css-container-queries](https://caniuse.com/css-container-queries), [caniuse: css-container-query-units](https://caniuse.com/css-container-query-units) |
| `@property` (typed custom property registration) | **85+** | **128+** | **16.4+** | ~95% | [caniuse: mdn-css_at-rules_property](https://caniuse.com/mdn-css_at-rules_property) |
| Tailwind v4's own stated baseline | **111+** | **128+** | **16.4+** | — | [Tailwind docs: Compatibility](https://tailwindcss.com/docs/compatibility), confirmed via [Tailwind CSS v4.0 announcement](https://tailwindcss.com/blog/tailwindcss-v4) |

**What actually drives Tailwind v4's baseline** (confirmed, not assumed): Tailwind's
own blog post and compatibility docs name **`@property`, `color-mix()`, and
native cascade layers (`@layer`)** as the three load-bearing features. Lining
those up against the table above is informative: **Firefox 128 and Safari
16.4 are exactly `@property`'s first-supporting versions** for those two
engines — `@property` is very likely the actual pacing feature for Firefox
and Safari. Chrome's `@property` support arrived much earlier (85), so
Chrome's higher floor (111) is driven by something else in that trio —
most likely `color-mix()` (Chrome shipped it in 111) rather than cascade
layers (Chrome shipped `@layer` earlier, in 99). This is a useful sanity
check: it means **our own `@property --fill` usage in `globals.css:344`
rides on the same Firefox-128/Safari-16.4 floor Tailwind v4 already
requires** — it isn't adding a new constraint on top of Tailwind's, it's
using exactly the feature that already sets Tailwind's floor for those two
browsers.

**Effective baseline for the whole system**: take the strictest constraint
across every ingredient — Tailwind v4 itself (Safari 16.4 / Chrome 111 /
Firefox 128), plus this system's own `svh` (Safari 15.4+, already looser
than Tailwind's 16.4 floor — not a new constraint) and container queries
(Safari 16+, also looser than 16.4 — not a new constraint either). **Net
result: Tailwind v4's own baseline (Safari 16.4+, Chrome 111+, Firefox
128+) is already the binding constraint for this whole stack** — none of
this system's own CSS (min/max/clamp, svh, cqw, @property) requires
anything newer than what Tailwind v4 already demands. The one asterisk is
the `svh`/`dvh` WebKit bug documented above (§1 top): Safari 16.4–17.3
*parses and "supports"* `svh` (so nothing breaks or falls back), but the
value it computes was wrong for about a year — a correctness bug within the
supported baseline, not a support-detection problem.

### What actually happens on a browser that doesn't understand `svh` (or any token in the `--fluid` formula)

This needs CSS's two distinct error-handling phases, and they behave very
differently for a **custom property** than for an ordinary property — the
answer is more specific (and more forgiving, and less useful as a
"declaration order gives you a fallback" trick) than the intuitive answer:

1. **`--fluid` itself never fails to parse, on any browser, ever.** A
   custom property's value grammar (`<declaration-value>`) accepts almost
   any token sequence — units are not type-checked at the point the custom
   property is declared. So `--fluid: max(0.58px, min(calc(100svh / 900), calc(100vw / 1440)));`
   parses and is stored verbatim as a token stream **even on a browser with
   zero `svh` support** — this is exactly what my own Playwright test
   confirmed empirically: `getComputedStyle(document.documentElement).getPropertyValue('--fluid')`
   returned the literal string `"max(0.58px, min(calc(100svh / 900), calc(100vw / 1440)))"`,
   not a resolved pixel number, because that's what `getComputedStyle`
   reports for an **untyped** custom property regardless of whether any
   consumer can actually use it. Source: [MDN — CSS syntax error handling](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_syntax/Error_handling), [MDN — Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties).
2. **The failure happens downstream, per consumer, at each `var(--fluid)` call site.** Every `calc(N * var(--fluid))` in every `@utility fluid-*` rule substitutes `--fluid`'s raw token stream in, then the browser tries to parse the *result* as a `<length>` for that specific property (`padding`, `font-size`, `width`, …). On a browser without `svh`, that substitution contains an unrecognized unit, so **that one declaration** is "invalid at computed-value time." Per the CSS Custom Properties spec's guaranteed-invalid-value rule, the property falls to its **inherited value if the property inherits, otherwise its initial value** — `padding`/`margin`/`gap` initial is `0`, `width`/`height` initial is `auto`, `font-size` inherits (so a `fluid-text-*` heading would fall back to its parent's font-size, likely the browser default `16px` chain, not literally break). This resolves per-declaration, independently, everywhere `--fluid` is spent — not as one single "everything breaks" event, but as hundreds of small, silent reversions to `0`/`auto`/inherited across the whole page: every fluid gap collapses to 0, every fluid width becomes `auto`, every fluid padding disappears. In practice, on `lg`+ that would visually flatten most of the desktop-only fluid layer back toward an unstyled, un-padded, un-sized state — not a crash, but a real degradation, silent, with (per the user's original framing) genuinely no console warning. Source: [MDN — Using CSS custom properties, "invalid at computed value time"](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties), [W3C CSS Custom Properties spec, guaranteed-invalid value](https://drafts.csswg.org/css-variables-2/).
3. **Crucially, an earlier, plain-`vh` declaration of `--fluid` written *before* the `svh` one does NOT act as a fallback**, even though that pattern works perfectly for an *ordinary* property (`height: 100vh; height: 100svh;` — there, if `100svh` fails to parse for `height` specifically, that whole declaration is invalid at *parse* time and is dropped, leaving the earlier `height: 100vh` standing, per ordinary cascade rules). For a *custom* property this doesn't happen, because — per point 1 — the second `--fluid: ...svh...` declaration is **not invalid at parse time on any browser**; it always successfully overwrites the first in the cascade, unit support or not. This is a well-documented trap: Lea Verou, quoted via Matthias Ott's write-up, put it precisely: *"The browser doesn't know if your property value is valid until the variable is resolved, and by then it has already processed the cascade [and discarded the earlier declaration]."* Source: [Matthias Ott — "CSS Custom Properties Fail Without Fallback"](https://matthiasott.com/notes/css-custom-properties-fail-without-fallback).

### The concrete, correct fallback pattern: `@supports`, not declaration order

Gate the risky (`svh`-using) declaration behind a **feature query**, which —
unlike a plain second declaration of the same custom property — genuinely
tests whether *this* browser accepts `height: 100svh` as valid CSS before
including the block at all:

```css
@media (width >= 1024px) {
  :root {
    /* Safe, universally-supported fallback: ordinary vh. Applies on every
       browser that reaches this media query at all. */
    --fluid: max(0.58px, min(calc(100vh / 900), calc(100vw / 1440)));
  }

  /* Enhancement: only included where this engine genuinely understands
     svh — @supports performs a real support check, unlike a second
     --fluid declaration, which the cascade would always accept regardless
     of unit support (see above). */
  @supports (height: 100svh) {
    :root {
      --fluid: max(0.58px, min(calc(100svh / 900), calc(100vw / 1440)));
    }
  }
}
```

This is exactly the pattern Matthias Ott's write-up (and the general
"safe-default-then-`@supports`-override" idiom documented on
[web.dev — "Using @supports and CSS.supports()"](https://web.dev/articles/css-supports) style resources) recommends
for this class of problem, and it's a real fix here, not a theoretical one:
the plain-`vh` fallback is **not spec-fragile the way `svh` is** (no
known engine bug makes `vh` silently track the iOS toolbar — it has always
meant "the full, static viewport," at the cost of the classic iOS
"100vh is taller than what's visible" problem this whole system exists to
avoid). Practically, given the effective baseline established above (Safari
16.4+/Chrome 111+/Firefox 128+, all of which support `svh`), **this
fallback is not currently load-bearing** for this system's stated support
target — every browser Tailwind v4 already requires understands `svh`. It
would only start mattering if the project ever relaxed its Tailwind/Safari
floor below 15.4, or shipped this CSS somewhere Tailwind v4 itself can't
run (unlikely, since the whole stylesheet is Tailwind v4 output).

## 2. Performance, measured

### Method

Chromium 153.0.8010.12 (Playwright 1.63.0, headless=new), driven from
`playwright` installed under
`/Users/tamas/Documents/Personal/Projects/fluid-design-skill/examples/pizza-next/node_modules`
(symlinked into the scratchpad's own `node_modules/` — no eagle-website
dependency touched, no eagle-website dev server started).

Test pages generated by
`/private/.../scratchpad/perf/gen-pages.mjs`, served statically with
`python3 -m http.server 52567` (127.0.0.1 only, port picked free, **not** the
Eagle Next.js dev server), and measured by
`/private/.../scratchpad/perf/measure.mjs`.

**Page variants**, all 1500 `<div>`s in a `display:flex; flex-wrap:wrap`
container, each element carrying 4 sizing declarations (`padding`,
`font-size`, `width`, `margin-bottom`):

| Variant | How each declaration is written | Classes |
|---|---|---|
| `page-fluid.html` | `calc(N * var(--fluid))`, `--fluid` computed exactly as in production (`max(0.58px, min(100svh/900, 100vw/1440))`, gated behind the real `@media (width>=1024px)`) | 30 shared classes, cycled over 1500 elements (realistic — this is how Tailwind atomic classes actually get reused) |
| `page-px.html` | Literal `px`, the value each class resolves to at the 1440×900 reference (visually identical output at reference, zero viewport-unit indirection) | same 30 shared classes |
| `page-clamp.html` | Per-declaration `clamp(minPx, interceptPx + slopeVw, maxPx)`, Utopia-style, resolved directly against `vw` — **no custom property, no height/svh term** | same 30 shared classes |
| `page-fluid-unique.html` | Same as `page-fluid` but every one of the 1500 elements gets its **own** rule/class (no sharing) — worst case for Blink's matched-property-cache | 1500 unique classes |
| `page-clamp-unique.html` | Same as `page-clamp`, 1500 unique classes | 1500 unique classes |

**Measurement**: for each page, Chromium DevTools Protocol `Performance.enable`
+ `Performance.getMetrics` (cumulative counters `RecalcStyleDuration`,
`LayoutDuration`, `RecalcStyleCount`, `LayoutCount`, `TaskDuration`). A
21-step viewport sweep is driven via `page.setViewportSize`:
- **width sweep**: 1024px → 1920px at fixed height 900px
- **height sweep**: 700px → 1200px at fixed width 1440px (fresh metrics
  baseline taken right before, so it isn't polluted by the width sweep)

After every `setViewportSize` call, `document.body.getBoundingClientRect()` +
an `offsetWidth` read is forced in-page to make sure style/layout are
resolved synchronously rather than deferred to a frame that never gets
painted (headless has no compositor deadline forcing this). Each page was
measured once as a warm-up (fonts/GPU/caches) then **4 timed trials**;
reported numbers are medians. Trial-to-trial variance was small (<3% on all
recalc/layout numbers, see raw JSON), so the medians are trustworthy at this
scale.

Raw output: `perf/measure-out2.json.txt` (shared-class pages, 2 independent
runs, consistent), `perf/measure-unique.json.txt` (unique-class pages).

### ⚠ UNITS CORRECTION — the tables below were originally mislabeled

My first pass through this data labeled the CDP `Performance.getMetrics()`
duration fields (`RecalcStyleDuration`, `LayoutDuration`, `TaskDuration`) as
milliseconds. **They are documented to be in seconds** — Chrome DevTools
Protocol's `Performance` domain returns these as `base::TimeDelta`-derived
floats in seconds, not ms (confirmed against the CDP `Performance` domain
docs and community-reported example payloads at
[chromedevtools.github.io/devtools-protocol/tot/Performance](https://chromedevtools.github.io/devtools-protocol/tot/Performance/)
and a [google-chrome-developer-tools discussion thread](https://groups.google.com/d/topic/google-chrome-developer-tools/_I4NfZCOK80)
showing the same magnitude of raw values). A peer agent working on this same
file independently caught this by cross-checking against their own
wall-clock timings; I've since independently reproduced the same conclusion
two ways using **my own already-collected data**, without needing to trust
either the peer's numbers or a re-run:

1. **Internal wall-clock cross-check.** My `measure.mjs` also records plain
   `Date.now()` wall-clock time around each sweep (`widthWallMs_median` etc.),
   entirely independent of the CDP metrics. For the fluid/shared page, width
   sweep wall-clock was **120 ms** for 21 steps (5.71 ms/step). My original
   (mislabeled) cumulative `TaskDuration` for that same sweep was reported as
   "0.1065 ms" — if that were really milliseconds, wall-clock time would be
   **>99.9% something other than style/layout/script**, which is not
   plausible for a synchronous headless run doing nothing else. Multiplying
   by 1000 (i.e. treating the raw value as seconds) gives **106.5 ms**
   cumulative, 5.07 ms/step — matching the 120 ms / 5.71-ms/step wall-clock
   figure closely (the small residual is exactly the CDP/IPC round-trip
   overhead per `setViewportSize`+`evaluate` call, which wall-clock includes
   and `TaskDuration` doesn't). This pattern holds across every page tested
   (see corrected table below) — wall-clock is consistently ~10-25% above
   the ×1000-corrected `TaskDuration`, never off by orders of magnitude,
   which is exactly what you'd expect from "real work + harness overhead" and
   is inconsistent with the original mislabeled reading.
2. This matches, independently, the peer agent's own finding on this file
   (a separately-built test harness measuring 22.6–24.3 ms/step for a
   fluid/unique-class width sweep, in the same order of magnitude as my
   corrected 16.06 ms/step for the equivalent fluid-unique case — the
   remaining difference is expected given different element/declaration
   counts and sweep step sizes between the two harnesses, not a units issue).

**All figures below are corrected (raw CDP seconds × 1000 = ms).** This
changes the practical conclusion materially — see "Reading the numbers,
honestly" below; it is **not** the "negligible, sub-millisecond" story my
uncorrected first pass told.

### Results — shared classes (30 classes / 1500 elements, the realistic case)

Cumulative cost across the **entire 21-step sweep**, and per-step average
(cumulative ÷ 21) — the per-step number is what's comparable to a 16.6 ms
frame budget:

| Page | Sweep | RecalcStyleCount | RecalcStyleDuration (cum / step) | LayoutCount | LayoutDuration (cum / step) | TaskDuration (cum / step) |
|---|---|---:|---:|---:|---:|---:|
| fluid (`var()+calc()`) | width | 21 | 22.7 ms / 1.08 ms | 21 | 65.7 ms / 3.13 ms | 106.5 ms / **5.07 ms** |
| fluid (`var()+calc()`) | height | 21 | 21.1 ms / 1.00 ms | 21 | 52.4 ms / 2.50 ms | 99.1 ms / **4.72 ms** |
| px (literal) | width | **0** | 0.0 ms / 0.0 ms | 21 | 8.5 ms / 0.40 ms | 11.7 ms / **0.56 ms** |
| px (literal) | height | **0** | 0.0 ms / 0.0 ms | 21 | 0.12 ms / 0.01 ms | 2.9 ms / **0.14 ms** |
| clamp (vw-only, Utopia-style) | width | 21 | 25.5 ms / 1.21 ms | 21 | 126.0 ms / 6.00 ms | 193.7 ms / **9.22 ms** |
| clamp (vw-only, Utopia-style) | height | 21 | 12.7 ms / 0.60 ms | 21 | 0.2 ms / 0.01 ms | 14.5 ms / **0.69 ms** |

Wall-clock corroboration (independent of CDP, `Date.now()` around the whole
sweep, ÷21 for per-step): fluid width 5.71 ms/step, fluid height 5.19 ms/step,
px width 0.95 ms/step, px height 0.52 ms/step, clamp width 9.86 ms/step,
clamp height 1.10 ms/step — all consistently a little above the corrected
`TaskDuration`/step figures, as expected (harness overhead on top of real
render work), confirming the correction rather than the original numbers.

### Results — worst case: 1500 unique rules, no shared classes

| Page | Sweep | RecalcStyleDuration (cum / step) | LayoutDuration (cum / step) | TaskDuration (cum / step) |
|---|---|---:|---:|---:|
| fluid-unique | width | 208.3 ms / 9.92 ms | 74.4 ms / 3.54 ms | 337.3 ms / **16.06 ms** |
| fluid-unique | height | 205.4 ms / 9.78 ms | 51.6 ms / 2.46 ms | 295.0 ms / **14.05 ms** |
| clamp-unique | width | 77.0 ms / 3.67 ms | 129.6 ms / 6.17 ms | 258.2 ms / **12.30 ms** |
| clamp-unique | height | 54.1 ms / 2.58 ms | 0.03 ms / 0.001 ms | 62.5 ms / **2.98 ms** |

Wall-clock corroboration: fluid-unique width 16.52 ms/step, fluid-unique
height 14.43 ms/step, clamp-unique width 12.83 ms/step, clamp-unique height
3.40 ms/step — again closely tracking the corrected `TaskDuration`/step
figures.

### Reading the numbers, honestly (corrected)

- **This is no longer negligible in the worst case.** `fluid-unique`'s width
  sweep costs **~16.06 ms of main-thread task time per resize step** — that
  is *at* the 16.6 ms budget for a single 60fps frame. If a real page
  resembled this shape (1500 elements, each with its own unique
  `calc(var(--fluid))` declaration set, no shared classes) and a user
  drag-resized the window, this system would plausibly **drop frames**
  during the drag, on top of whatever else that frame needs to do (paint,
  compositing, any concurrent JS). This is the honest, corrected answer to
  "report numbers, be honest if differences are negligible" — in this one
  scenario, they are not.
- **The realistic (shared-class) case is comfortably inside budget but not
  free.** Production `fluid-*` usage is the 30-shared-class shape (Tailwind
  atomic classes reused across elements, not unique per-element rules): width
  sweep costs **5.07 ms/step** of task time — about **30% of a 16.6 ms frame
  budget**, leaving headroom for everything else the frame needs to do, but
  a real, measurable cost, not "microseconds." `clamp` in the same
  shared-class shape is *worse*, not better: **9.22 ms/step**, ~55% of a
  frame budget, driven by its ~1.9× higher `LayoutDuration`.
- **px (no viewport units) is the cheapest by a wide margin** and the only
  variant that skips style recalc entirely (`RecalcStyleCount: 0`) — 0.56
  ms/step on width, 0.14 ms/step on height. This is the "do nothing
  viewport-aware" baseline every other number should be read against.
- **Shared classes are dramatically cheaper than unique-per-element rules
  for `fluid`**: `RecalcStyleDuration`/step goes from 1.08 ms (30 shared
  classes) to 9.92 ms (1500 unique classes) — **~9× worse**. `clamp` only
  goes from 1.21 ms to 3.67 ms (~3×) over the same change. Layout duration
  also grows with uniqueness for `fluid` (3.13→9.92... consistent scaling)
  but far less dramatically for `clamp`. Plausible mechanism (not verified
  against Blink source in this pass): Blink's matched-property-cache lets a
  shared class's resolved `var(--fluid)`-derived values be reused across all
  ~50 elements that carry it, so only ~30 distinct style resolutions happen
  per recalc pass instead of 1500; a literal `clamp(...vw...)` benefits less
  from that cache, so it's relatively less punished when sharing disappears.
  **Practical takeaway, now more consequential than before**: this system
  MUST be spent through a small, fixed set of shared `@utility fluid-*`
  classes (which is how the real codebase already uses it) — spending it
  through unique per-element inline `calc()` expressions is not just
  "slightly worse," it is the difference between "30% of a frame budget" and
  "100% of a frame budget, dropping frames."
- **`clamp()`'s `LayoutDuration` is consistently ~1.9× `fluid`'s on the width
  sweep** in the realistic shared-class case (6.00 ms/step vs 3.13 ms/step)
  — now a real, frame-budget-relevant difference, not tenths of a
  millisecond. **On this measurement, the production `fluid`/`var()`
  approach is actually cheaper than a literal per-declaration `clamp()`
  would be at the same call-site density**, which argues against "just use
  clamp() instead of a custom property" as a performance-motivated
  simplification.
- **Time to first layout / initial load** is unaffected by any of this units
  bug (it was always plain wall-clock `Date.now()`, never CDP duration
  fields): fluid 25 ms, px 25.5 ms, clamp 26 ms, statistically
  indistinguishable, dominated by local-file fetch/parse overhead. This
  conclusion stands unchanged.

### (b) Height-only resize — is it really "free" or not, and does it matter on iOS

Confirmed **by measurement**, corrected: a height-only resize (700→1200px,
width pinned at 1440px) costs **4.72 ms/step of task time** on the `fluid`
page in the realistic shared-class case (9.78 ms/step in the unique-class
worst case) — `--fluid`'s `min(100svh/900, 100vw/1440)` genuinely changes
when height changes below the current binding point, so this is real,
frame-budget-relevant work, not free — same order of magnitude as the width
sweep, by design (the docblock in `fluid.css` calls this "the height axis").

Contrast with `clamp` (as tested — a **vw-only** Utopia-style clamp with no
height term, which is the typical real-world Utopia usage): on the height
sweep it still shows `RecalcStyleCount: 21` and a real recalc cost (0.60
ms/step) — Chromium re-runs style recalculation for **every** element that
uses *any* viewport-relative unit on **any** resize, even the axis that
provably can't change that element's computed value — but `LayoutDuration`
is ~0 (0.01 ms/step) because nothing actually changed, so layout has nothing
to do. This is the concrete, corrected answer to prompt item (c): **the
cost of "changing a custom property on `:root`" vs "clamp with vw directly"
is not meaningfully different at the recalc-trigger level** — Blink's
viewport-unit invalidation is coarse (fires on any resize, not just the
relevant axis) for both a custom-property chain and a raw `clamp(...vw...)`.
The difference that matters is whether the *value itself* actually changes
on that axis (a property of the formula — `svh` vs `vw`-only — not of
custom-property-vs-literal), and for `fluid` specifically, height changing
the value is a deliberate design choice with a real, now-measurable cost
(~4.7 ms/step realistic, ~9.8 ms/step worst-case) that a `vw`-only `clamp`
avoids entirely on that axis (0.01 ms/step, no real layout work).

**On why this specifically does *not* matter on iOS**: our system deliberately
uses `svh`, and by definition/spec `svh` is pinned to the *smallest* possible
viewport — it does not track the browser chrome collapsing/expanding on
scroll (that's what `dvh` is for, see §1's WebKit-bug caveat on when this
held true in practice). So the "height-only resize" cost measured here is a
proxy for a **desktop window resize** (dragging the corner, or
un-fullscreening), not for the iOS toolbar-collapse event during a scroll
gesture — the system is specifically built to be inert to the latter, and
this measured cost is a real desktop-drag-resize cost, not an iOS
scroll-gesture cost.

### Files

- `/private/tmp/claude-501/-Users-tamas-Documents-Work-Projects-Eagle-eagle-website/0c00d849-d42b-4a0d-802d-314e68d5bc18/scratchpad/perf/gen-pages.mjs`
- `/private/tmp/claude-501/-Users-tamas-Documents-Work-Projects-Eagle-eagle-website/0c00d849-d42b-4a0d-802d-314e68d5bc18/scratchpad/perf/measure.mjs`
- `/private/tmp/claude-501/-Users-tamas-Documents-Work-Projects-Eagle-eagle-website/0c00d849-d42b-4a0d-802d-314e68d5bc18/scratchpad/perf/measure-out2.json.txt` (shared-class, 2 runs)
- `/private/tmp/claude-501/-Users-tamas-Documents-Work-Projects-Eagle-eagle-website/0c00d849-d42b-4a0d-802d-314e68d5bc18/scratchpad/perf/measure-unique.json.txt` (unique-class)
- `/private/tmp/claude-501/-Users-tamas-Documents-Work-Projects-Eagle-eagle-website/0c00d849-d42b-4a0d-802d-314e68d5bc18/scratchpad/perf/page-*.html` (the 5 generated test pages)

No eagle-website dev server, and no eagle-website file, was touched or run
for this measurement. The static file server used to serve the generated
test pages was `python3 -m http.server` bound to `127.0.0.1` on an
OS-assigned free port, and has been stopped.

## 3. Font rendering / subpixel

### Empirical check: fractional-width tile seams (Chromium, headless, layout + paint)

Built `support-perf/seam.html`: 7 adjacent `display:flex` tiles, each
`width: calc(N * var(--fluid))` with distinct `N`s, no gap/border between
them, on a magenta backdrop (any 1px seam of backdrop showing through would
be trivially visible). `--fluid` was forced into the real production formula
so its resolved value is genuinely fractional at almost every viewport width
(e.g. at 1337px wide, tile widths resolve to 52.922px, 77.063px, 38.063px,
119.766px, 62.203px, 87.266px, 49.203px — all non-integer).

- **Layout-geometry check** (`support-perf/seam-check.mjs`, `getBoundingClientRect()`
  on each tile across 8 viewport widths 1024→1920px): `maxGeometryGap` and
  `maxGeometryOverlap` were **exactly 0.0000px at every width tested**.
  Chromium's flex layout keeps full floating-point (subpixel) precision for
  box edges — it does not round each box to the nearest integer pixel
  independently before positioning the next one, so fractional widths never
  open a geometric gap between flex siblings.
- **Paint/raster-level check** (`support-perf/seam-screenshot.mjs` +
  Pillow pixel scan, DPR 1 and DPR 2, at 1337px and 1501px viewport widths):
  scanned every pixel column at the tile row for the backdrop's magenta —
  **zero magenta pixels found between any two tiles**, at either DPR. The
  only magenta detected was past the last tile (expected — the row's total
  width is less than the clip width).
- **Conclusion (Chromium only, this test shape)**: for simple adjacent
  opaque flex boxes with fractional `calc(var())` widths, this system does
  **not** produce a visible 1px hairline seam in Chromium at DPR 1 or 2 —
  neither in layout geometry nor in the rasterized pixels. This is a
  genuine, reproducible measurement, not a citation — but it is narrow: it
  only covers Chromium, only flexbox-adjacent same-stacking-context boxes,
  and does not cover Safari/Firefox or cases where adjacent fractional-edged
  elements are promoted to separate compositor layers (e.g. one has a CSS
  `transform`/`will-change`/`filter` and its sibling doesn't) — that's the
  scenario where independent per-layer pixel-snapping during compositing is
  most commonly reported to cause seams in the wild, and it wasn't tested
  here. Where this system uses `translate`/`transform` alongside fluid
  sizing (the `fluid-translate-x/y` utilities, or anything animated with
  Motion) on an element adjacent to another non-transformed fluid-sized
  element, that untested seam risk applies.

### Research (citations)

- **Fractional font-size rounding differs by engine, historically.** Older
  cross-browser testing found browsers do not treat fractional font-sizes
  identically: some round at the value itself (>0.5px rounds up), others
  compute layout first and round the resulting dimensions afterward —
  meaning the same `calc()`-derived `57.37px` can rasterize to a visually
  different width in different engines even though the specified value is
  identical. This is old, frequently-recirculated testing (original threads
  trace to a 2010–2012 W3C CSS testsuite mailing-list discussion,
  [lists.w3.org/.../2010Jun/0000.html](https://lists.w3.org/Archives/Public/public-css-testsuite/2010Jun/0000.html)) —
  flagging the age: engines have iterated their text/layout pipelines
  substantially since (GPU-based text rendering, LCD-subpixel-AA removal,
  etc., below), so treat the *general claim* ("fractional sizes round
  differently across engines") as durable but the *specific old
  integer-vs-subpixel-positioning claims from that era* as unverified against
  current engines in this research pass.
- **Chrome removed subpixel (LCD) text anti-aliasing by default starting
  Chrome 115**, when hardware acceleration is enabled — this changes how
  fractional glyph edges resolve on-screen (grayscale AA instead of
  subpixel/LCD-striped AA), independent of any fractional-`font-size`
  question, but compounds it: on Chrome 115+, expect slightly softer/blurrier
  edges on any text (fractional size or not) versus pre-115 Chrome or
  current Firefox/Safari, which still support subpixel AA in more
  configurations.
- **Known Firefox regression class**: [Mozilla Bugzilla 1600472 — "WebRender breaks font subpixel AA on many sites on Nightly"](https://bugzilla.mozilla.org/show_bug.cgi?id=1600472) documents WebRender-era regressions specifically in subpixel/fractional text rendering, i.e. this is a real, recurring category of engine bug across Firefox's rendering-backend transitions, not a one-off.
- **Mitigations, general (not this-repo-specific)**: `text-rendering: optimizeLegibility`/`geometricPrecision` nudge some engines' hinting/kerning behavior but have no standardized effect on subpixel rounding and are broadly discouraged for body text due to performance cost on large pages (per [MDN text-rendering](https://developer.mozilla.org/en-US/docs/Web/CSS/text-rendering) guidance summarized from general web-perf literature); the practical mitigation used by fluid-type systems in general is simply **accepting fractional sizes as normal and not fighting the rasterizer** — rounding a fluid font-size to the nearest integer px at the CSS layer would reintroduce visible "stepping" as the viewport is dragged (the opposite of the smooth-scaling goal), so the fractional-size approach is the correct trade for this system's stated purpose, with the understood cost of sub-visible AA variance across engines, not layout bugs.
- **Hairline seams specifically**: no independent primary source was found in this pass describing "1px seam between two adjacent fractional-width boxes" as a distinct, separately-named browser bug class — the empirical test above (§3, Chromium only) found **no seam in this system's actual shape** (adjacent flex siblings, same stacking context). The theoretical risk that *is* well-documented in general web-perf writing is compositor-layer edge-snapping when adjacent elements are promoted to separate GPU layers (e.g. one has `transform`/`will-change`/`filter`, `translate` via the `fluid-translate-x/y` utilities, or is animated by Motion) — each layer's edges get device-pixel-snapped independently during compositing, which *can* produce a seam that pure layout-geometry math wouldn't predict. This wasn't independently re-confirmed with a fresh, current-dated primary source in this pass (general knowledge, not a specific citation) — flagging as the concrete follow-up test if a real seam is ever reported on a scroll-driven or `fluid-translate-*` composited element in the real site.

## 4. Resize behaviour caveats

- **`var()`+`calc()` vs literal `clamp()`: no documented difference in
  rounding, only in invalidation cost.** No source in this pass claims Chrome
  or Safari round a `var()`-derived fractional value differently than the
  same fractional number written as a literal `clamp()` — both go through
  the same length-resolution and layout code once the value is computed; the
  measured difference (§2 above) is in *how much work* the engine does to
  arrive at that computed value on a viewport change (style-recalc
  invalidation scope), not in the resulting pixel value's rounding.
- **Continuous drag-resize is throttled/coalesced by the browser, and the
  `resize` event does not fire once per pixel.** General web-perf guidance
  (not resize-specific, but directly applicable) confirms browsers batch
  high-frequency events like `resize` and dispatch relayout/repaint work
  against the animation-frame cadence rather than synchronously per input
  tick; the common, explicitly recommended pattern is to throttle any
  `resize`-driven JS via `requestAnimationFrame` specifically *because* the
  browser itself is already doing analogous frame-aligned batching for
  style/layout. Source: [web.dev — "Avoid large, complex layouts and layout thrashing"](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing), [Nolan Lawson — "High-performance input handling on the web"](https://nolanlawson.com/2019/08/11/high-performance-input-handling-on-the-web/). Both Safari and Firefox are separately documented to throttle `requestAnimationFrame` itself under some conditions (backgrounded tabs, etc.) per [Motion's "When browsers throttle requestAnimationFrame"](https://motion.dev/magazine/when-browsers-throttle-requestanimationframe) — relevant context, though that source is about background-tab throttling generally, not resize-drag specifically; **this pass did not find a primary browser-vendor source describing exact resize-drag-specific frame-coalescing behavior for Chrome/Safari**, so treat "throttled to frame cadence" as well-supported general behavior, not a chapter-and-verse spec citation. This is consistent with — and gives a plausible mechanism for — why the harness in §2 above explicitly notes that `setViewportSize` (a synchronous, unthrottled per-call resize) is a *stricter* test than a real native drag gesture: a live drag is very unlikely to actually invoke style+layout once per 8px the way the test harness forced.
- **Desktop Safari (macOS): `svh` equals `vh` equals the static window
  viewport height, confirmed.** Desktop browser chrome (toolbar, tab strip)
  doesn't collapse/expand the way iOS Safari's does, so there is no
  "smallest vs largest vs dynamic" distinction to make on desktop — `svh`,
  `lvh`, `dvh`, and plain `vh` all resolve to the same number there. This
  matters directly for this system: the "expensive height-only relayout"
  measured in §2 is a **desktop-resize-only** cost path in practice (dragging
  the window corner, entering/exiting fullscreen, or an external-display
  change) — it is inert on both `svh`'s intended mobile behavior (assuming
  the browser doesn't hit the WebKit 16.4–17.3 bug flagged in §1) and on
  desktop's non-collapsing chrome, so the only time real users actually pay
  the height-arm relayout cost is an actual, deliberate window-height
  change — a comparatively rare, non-scroll-linked event, not something that
  fires continuously during normal browsing. No single canonical spec
  citation nails "desktop Safari has no dynamic toolbar" as an explicit
  documented behavior (because there's nothing to document — it's the
  absence of a mobile-only feature), but it's corroborated by every general
  viewport-units explainer consulted in this pass agreeing without
  exception that mobile-chrome-collapse is the sole reason svh/lvh/dvh
  diverge from plain `vh` at all, and diverge from EACH OTHER only in that
  scenario, i.e. desktop necessarily collapses to a single value.
