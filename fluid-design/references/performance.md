# Performance

**Read when:** you're adding a scroll-driven effect, reviewing whether a page's motion budget still
holds, or diagnosing dropped frames on a real device.
**Skip when:** the work is a single triggered reveal with no scroll binding — `motion-architecture.md`
§3's triage already keeps that case cheap by construction.
**Depends on:** `scroll-scenes.md` for what makes a scene expensive in the first place;
`ios-safari.md` for the compositing quirks this budget has to survive on WebKit specifically.

Subscription count is the wrong metric to optimise — a scroll-position hook typically shares its
underlying measurement per container regardless of how many things read it. What actually costs, in
order, is below.

## Contents

1. [The cost order](#1-the-cost-order)
2. [Per-frame budgets](#2-per-frame-budgets)
3. [Concurrent scroll scenes](#3-concurrent-scroll-scenes)
4. [Transform shorthands are not accelerated](#4-transform-shorthands-are-not-accelerated)
5. [No layout properties on scroll](#5-no-layout-properties-on-scroll)
6. [IO-gate every rAF and video](#6-io-gate-every-raf-and-video)
7. [`content-visibility`](#7-content-visibility)
8. [No parent custom property for children](#8-no-parent-custom-property-for-children)
9. [CSS over JS for predetermined motion](#9-css-over-js-for-predetermined-motion)
10. [`will-change` policy](#10-will-change-policy)
11. [Filter blur limits](#11-filter-blur-limits)
12. [Library weight: strict feature sets](#12-library-weight-strict-feature-sets)
13. [Bundle and asset budgets](#13-bundle-and-asset-budgets)
14. [Traps](#traps)

## 1. The cost order

1. **Per-frame style writes.** Budget the *elements* hot in any given frame, not the number of
   effects defined in source: roughly **≤2 active springs, ≤25–30 written DOM nodes** touched per
   frame across the whole page. Phones die on paint and composite, not on interpolation math — the
   arithmetic is nearly free; writing it to the DOM is not.
2. **Springs that never sleep.** An unclamped spring (or scroll-derived value) keeps computing even
   once its visible effect is imperceptible. Clamp every derived value's domain so it goes quiescent
   once the input leaves the range that can change its output.
3. **Main-thread contention.** Scroll-linked values that live on the main thread hitch *all at once*
   whenever anything else blocks it — a long framework commit, an image decode, a font swap. This is
   why the concurrency budget in §3 matters more than any single scene's own efficiency.

## 2. Per-frame budgets

The ≤2 springs / ≤25–30 nodes figures above are the two numbers worth keeping fixed in mind while
building a new scene, because they're easy to blow through by accretion — five sections each adding
"just one more" scroll-linked element compounds past the budget with no single commit looking
expensive on its own. Treat them as a running total across whatever can be on screen simultaneously,
not per-component.

## 3. Concurrent scroll scenes

> **Only 1–3 scroll-driven scenes should intersect the viewport at once.**

This is `motion-architecture.md` §3's triage restated as a hard number: at dozens of animated
sections on one page, this ceiling *is* the performance budget. It's enforced by IO-gating (§6) —
each scene's decoder/rAF loop only runs while genuinely near the viewport — but the ceiling itself is
a design constraint, not just an implementation detail: stacking more than a handful of full-screen
pinned panels, each with its own filters or video decode, costs more than forty small opacity
triggers combined. Layer count and pixel area dominate the cost, not element count.

## 4. Transform shorthands are not accelerated

A declarative animation library's `x`/`y`/`scale` convenience props are frequently implemented as
individually-interpolated values applied via the main thread on every frame — **not** as a single
hardware-accelerated `transform`. On any full-screen or pinned path this is measurable frame loss
under load. Write the full composed transform string instead:

```tsx
<AnimatedEl style={{ x }} />                                                    // main thread
<AnimatedEl style={{ transform: template`translateX(${x}px)` }} />              // accelerated
```

A hand-written transform string (the direct-write pattern in `scroll-scenes.md` §6) gets this for
free by construction, and should keep a `translateZ(0)`/`translate3d(...)` term inside that same
string rather than as a separate rule — that anchor is load-bearing for Safari's compositing
specifically (`video.md` §6, `ios-safari.md`).

## 5. No layout properties on scroll

`width`, `height`, `top`, `padding` and similar trigger layout, paint *and* composite on every write
— `transform`, `opacity` and `filter` trigger composite only (and `filter` is more expensive than
the other two — see §11). This is why a growing/filling bar animates `scaleY`/`scaleX` rather than
`height`/`width` — on a plain filled rect with nothing else inside it, the two are pixel-identical,
and one is free while the other reflows.

**The one sanctioned exception is an accordion disclosure.** There is genuinely no transform that
expresses "the content below me moves down by exactly the height of what just appeared" — a `scaleY`
squashes the type inside and leaves the document flow behind it teleporting into place anyway. A
short, capped duration (roughly 150–250ms) keeps the layout cost bounded to a single user-triggered
event rather than a per-frame scroll cost, which is the actual distinction that matters: this
exception is for a *discrete, infrequent, user-initiated* transition, never for anything scroll-linked.

Related: size media with CSS, transform it with JS. A responsive camera crop (`scroll-scenes.md` §7)
should scale a video via a per-frame `transform` write while its box dimensions stay entirely CSS —
letting CSS own `width`/`height` means the scaling operation never triggers a layout-invalidating
write, no matter how large the multiplier.

## 6. IO-gate every rAF and video

Every `requestAnimationFrame` loop and every video's decode/playback state must be gated on an
`IntersectionObserver`, with two different margins for two different jobs (`video.md` §5): a wide
margin that starts *warming* (network fetch, decoder handshake) well before arrival, and a tight
margin that starts *running* (the rAF tick, actual playback) only once genuinely on or near screen.
An ungated rAF loop measured at roughly 120 iterations/second with its owning scene three screens
away from the viewport — each iteration performing layout reads that cost nothing individually but
compound relentlessly when the loop never stops. This gating is what makes even one scrubbed video
scene affordable at all; without it, "decode only what's on screen" is a principle with no
enforcement.

## 7. `content-visibility`

`content-visibility: auto` (paired with `contain-intrinsic-size` to avoid layout jump on reveal) is
correct **only on below-fold, flow-only content sections** — never inside, or wrapping, a scroll
scene's runway or a triggered reveal group. Applied inside a scene it **zeroes the measured
geometry** the scene depends on (its own height collapses to the browser's placeholder estimate),
which corrupts every downstream calculation that assumes the real rendered height — the pin's own
progress math, a reveal's trigger line, anything derived from `offsetHeight`. This is a strict
either/or: a section is either a `content-visibility` candidate (ordinary flow content, no scroll
binding) or part of a scene's measured geometry — never both.

## 8. No parent custom property for children

Setting a custom property on a **parent** element for descendants to read via `var()` forces a style
recalculation of every descendant on every write, because the browser cannot know in advance which
descendants consume the property — it has to re-evaluate the whole subtree. Set the property **on
the element that's actually animated**, driven by a static class rather than a JS write to an
ancestor. This is the same rule `fluid-scale.md` states for its own responsive-value convention
(`--hero-lift` lives on the animated element itself, set by a Tailwind breakpoint utility, never
written to a shared ancestor).

## 9. CSS over JS for predetermined motion

CSS animations and transitions run off the main thread; anything whose values are known ahead of
time (not a function of live scroll position or live user input) should be CSS, not a per-frame JS
write, specifically because CSS survives main-thread contention that would otherwise hitch a JS-driven
equivalent (§1's third cost tier). Reach for JS only when the value genuinely depends on something
CSS cannot read — live scroll offset, a decoder's playhead, a measured DOM rect.

As decoration only, and never for coordination: native CSS `animation-timeline`/`view()` scroll
timelines run entirely off the main thread on supporting engines, behind `@supports`, for
flow-only triggered reveals with no state to coordinate. This buys real free performance on the
boring majority of sections, but it is never a substitute for the JS-driven mechanisms in
`scroll-scenes.md` — and note that its browser-native view range is exactly the thing that
disagreed with JS scroll math in the WAAPI-promotion bug (`scroll-scenes.md` §6); the same caution
about a native timeline's range not matching a hand-computed one applies here too.

## 10. `will-change` policy

Do not scatter manual `will-change` declarations. A capable declarative animation library already
promotes an element to its own compositing layer while actively animating it and demotes it
afterward — a permanent `will-change` instead pins the promotion (and its memory cost) for the
element's entire lifetime, for no benefit once the animation is idle.

**The one standing, documented exception:** a video's `translateZ(0)`/`translate3d(...)` compositing
anchor (`video.md` §6). This is a Safari-specific requirement to keep the video's own compositing
layer from being demoted, and it is deliberately permanent — do not "clean it up" as part of an
unrelated refactor. Every other `will-change`-shaped optimization should be justified the same way:
a specific, documented, measured requirement, not a defensive default.

## 11. Filter blur limits

`filter: blur()` is allowed but genuinely expensive, especially over a large painted surface — keep
it under roughly 20px and specifically measure its cost on Safari, which handles large blurred
surfaces worse than Chromium in practice. A blurred backdrop behind a floating nav bar (a common use)
is a reasonable size to budget for; a blur applied to a large hero-scale surface is not, without
measuring first.

## 12. Library weight: strict feature sets

Where the chosen animation library offers a reduced/strict feature-set import (Motion's
`domAnimation` under `LazyMotion` `strict` mode is the reference example — roughly 6KB against the
full library's ~34KB), default to the strict subset and add only the specific feature you need when
you need it (e.g. `domMax` only once layout animations or drag are genuinely required). `strict`
mode additionally throwing on the non-lazy component API (rather than silently working) is a feature,
not friction — it's what stops a future contributor from quietly reintroducing the full bundle one
import at a time.

## 13. Bundle and asset budgets

Enforceable numeric targets, worth wiring into CI rather than trusting review to catch:

- **Core Web Vitals at p75:** LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1.
- **Image and video formats:** modern, well-compressed formats sized to their actual display
  dimensions — never ship a source asset's native resolution to a container a fraction of its size.
  `video.md` §13 has the specific encode recipes and the SSIM-before-upscaling check.
- **All-intra re-pays background texture every frame — budget for it before shooting/rendering, not
  after.** Inter-frame compression is what normally makes a mostly-static background nearly free; an
  all-intra scrub asset (`video.md` §1) has none of that, so a textured, high-frequency background
  (flour on slate, visible film grain, a busy procedural pattern) is encoded from scratch on every
  single frame and the file size follows directly. Measured: a textured ground cost 37MB at CRF 22 /
  1600×900; softening the texture and dropping to 1440×676 brought the same shot to 9MB — the
  softening did more than the resolution cut. Prefer a flatter, less textured background for anything
  that will be scrub-encoded, and treat "the background looks a little too clean" as a deliberate
  trade against file size rather than a rendering mistake.
- **A stray large asset is a permanent cost in version control**, not just a one-time download —
  most VCS systems keep every blob forever, so an oversized commit's clone-time cost never comes back
  once someone "fixes" it later by re-encoding. Catch it before the commit, not after.
- A CI budget script (asset sizes, bundle size deltas) plus a Lighthouse-class check on preview
  deployments is the concrete enforcement mechanism worth having; `verification.md` describes the
  companion runtime-behaviour checks this doesn't cover (a value that "looks right" in a Lighthouse
  score but is measurably wrong mid-scroll).

## Traps

- ★ A scroll-linked value bound through a declarative `x`/`y`/`scale` shorthand runs on the main
  thread, uncomposited — write the full `transform` string (§4).
- ★ `content-visibility: auto` inside a scroll scene zeroes the geometry the scene measures (§7).
- ★ An ungated rAF loop or video runs from mount to unmount regardless of scroll position — gate on
  IntersectionObserver with two margins (§6).
- Animating `width`/`height`/`top`/`padding` on any scroll-linked path costs layout every frame —
  `transform`/`opacity`/`filter` only, accordion disclosure excepted (§5).
- A custom property written to a parent for children to read recalculates the whole subtree on every
  write — set it on the animated element itself (§8).
- A permanent `will-change` pins a compositing layer's memory cost for an element's whole lifetime —
  the video `translateZ(0)` anchor is the only standing exception (§10).
- `filter: blur()` over a large surface is measurably worse on Safari than the same value on
  Chromium — keep it small and measure on-device (§11).
- More than roughly three scroll-driven scenes intersecting the viewport at once is a design
  problem the IO gating cannot fully absorb — it's a ceiling, not a suggestion (§3).
