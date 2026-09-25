# Performance: render budget

**Purpose:** The render budget of a page on the scale: units that recompute on resize only, no `dvh`
thrash, image `sizes` on a page that grows past the artboard, fonts, `content-visibility`, and
bundle and asset budgets.
**Read when:** you're shipping a page on the scale and want it fast to load and cheap to lay out:
image `sizes`, fonts, below-fold content, asset and bundle budgets.
**Skip when:** the question is about frame rate while something moves (per-frame writes, springs,
concurrent scenes, `will-change`, blur, library weight). That is motion performance: see the
`scroll-animation` skill, `references/performance.md`.
**Inputs:** the page's images, fonts and below-fold content, and the growth ceiling setting.
**Produces:** correct `sizes` attributes, font-loading choices, and budget checks to pass before
shipping.
**Depends on:** `media.md` for how media is sized and reserved; `fluid-scale.md` §7 for the growth
ceiling; `ios-safari.md` §1 for why the scale is on `svh`.

## Contents

1. [The units recompute on resize only](#1-the-units-recompute-on-resize-only)
2. [No `dvh` thrash](#2-no-dvh-thrash)
3. [Image `sizes` on a page that grows](#3-image-sizes-on-a-page-that-grows)
4. [Fonts](#4-fonts)
5. [`content-visibility`](#5-content-visibility)
6. [Bundle and asset budgets](#6-bundle-and-asset-budgets)
7. [Traps](#traps)

## 1. The units recompute on resize only

The fluid units are plain CSS: viewport units inside `min()`/`max()`. The browser re-resolves them
when the viewport changes size and at no other time: never per frame, never during a scroll. That is
the whole render cost of the scale, and it should stay that way.

- **Do not mirror `--fluid` into JavaScript on scroll.** A script that needs the factor (a canvas, a
  measured offset) reads it once on `resize`, coalesced to one read per animation frame, and caches
  it. Reading `getComputedStyle` on every scroll event forces style resolution the page otherwise
  never pays for.
- **Do not write the units from JavaScript.** A `resize` listener that sets `--fluid` inline replaces
  one CSS recompute with a script, a style write and the same recompute.
- A resize still reflows type and remaps any pin. Scrolling never does (`fluid-scale.md` §12).

**Spend the units through shared classes.** Measured in Chromium (1500 elements, 4 sizing
declarations each, a 21-step window resize, main-thread time per step against a 16.6ms frame):

| How the unit is spent | Width resize | Height resize |
|---|--:|--:|
| Literal px (no viewport awareness) | 0.56 ms | 0.14 ms |
| **Shared utility classes (30 classes reused)** | **5.07 ms** | **4.72 ms** |
| Per-declaration `clamp(…vw…)`, shared classes | 9.22 ms | 0.69 ms |
| One unique `calc(N * var(--fluid))` rule per element | 16.06 ms | 14.05 ms |

A small set of reused `fluid-*` classes (or SCSS/CSS rules shared across elements) costs about a
third of a frame per resize step, less than per-declaration `clamp()`. The same unit written as a
unique rule per element (CSS-in-JS generating one class per instance, inline styles) costs about
nine times more style recalculation, a whole frame per step. Scrolling costs nothing either way.
Evidence and harness: the repository's `docs/designs/review-2026-09/`.

**WebKit, and why the unit mirrors don't inherit.** `fluidPx(n, unit, el)` reads a unit at an
element through a registered `<length>` mirror (`--_fluid-m-<unit>`) that the engine sets on
`:root` and every scope. Its value depends on the viewport. Registered with `inherits: true`, it
made WebKit re-resolve it on every element on every resize. Measured on a 2,000-element page with
50 limit scopes, main-thread time per resize step:

| Mirrors | WebKit (width / height) | Chromium |
|---|--:|--:|
| inherited (before) | 44.9 / 58.9 ms | about 5 ms |
| not inherited (now) | 11.3 / 9.5 ms | about 5 ms |
| none at all | 10.3 / 8.6 ms | about 5 ms |

A non-inherited property costs nothing on elements that don't declare it, so the mirrors are
`inherits: false` with `initial-value: 0px`, and `fluidPx` walks up from `el` to the first ancestor
whose mirror is non-zero: one `getComputedStyle` per ancestor, on that call path only. Cache the
result per frame, not per tween tick.

**Registered intermediates.** Every private parameter that doesn't depend on the viewport is
registered as a `<number>`: the band mapping (`--_fluid-base-w`, `--_fluid-min`, the dampings, the
knee…) and the limit and `off` arithmetic (`--_fluid-min-x`, `--_fluid-max-x`…). Each one computes
once to a plain number where it's declared, on `:root` or a scope. The long unit formulas then carry
numbers instead of re-expanding every parameter on every element that spends a unit. It's the
opposite of the mirrors: these never change on resize, so being inherited costs nothing. The page
is the same 2,000 elements (30 classes × 4 declarations), timed per resize step:

| Intermediates | WebKit | Chromium |
|---|--:|--:|
| unregistered | 9.8–10.2 ms | 7.7–7.9 ms |
| registered `<number>` (now) | 7.8–8.4 ms | 5.0–5.1 ms |

The repository's `tests/resize-perf.mjs` guards both findings in WebKit and Chromium. It checks that 50 limit
scopes cost at most 1.6× the same page without them (the inherited mirrors measured 2.2× there), and
it runs in `npm run test:browsers` and CI.

## 2. No `dvh` thrash

`dvh` tracks the mobile toolbar's collapse animation live. Anything sized or scaled in `dvh`
re-lays-out on every frame of that animation, and if the scale itself were on `dvh`, every
`fluid-*` value on the page (type included) would resize while the reader scrolls. The scale is on
`svh` for exactly this reason (`fluid-scale.md` §3, invariant 3). Full-height boxes use `svh`, or
`lvh` for a full-bleed picture (`ios-safari.md` §1). `scripts/tools/audit.mjs` flags `dvh-on-scaled`.

## 3. Image `sizes` on a page that grows

A fixed-width site can describe an image slot with a px cap. A fluid page cannot: above the
reference the container grows as `max(1680px, 1680·f)` (`frame-and-gutter.md` §1), so every slot inside
it grows too. A `sizes` value written against the drawn container tells the browser the slot is smaller
than it is, the browser picks a smaller candidate, and the image renders upscaled and soft on
exactly the large displays the scale was built for.

Worked numbers at the defaults (container 1680, padding 80, reference 1440×900, no ceiling), for an
image drawn at half the container:

| Viewport | f | Container (≤ viewport) | Half-container slot | `sizes` of `840px` says | `50vw` says |
|---|---|---|---|---|---|
| 1440×900 | 1.00 | 1440 | 720 | 840 (fine) | 720 |
| 1680×900 | 1.00 | 1680 | 840 | 840 | 840 |
| 2560×1440 | 1.60 | 2560 | 1280 | 840: **1.5× short** | 1280 |
| a window wide enough to hold the grown container, f = 1.6 | 1.60 | 2688 (1680·1.6) | **1344** | 840: **1.6× short** | ≥ 1344 |
| 2560×700 (short, wide) | 0.78 | 1680 (the max-width never shrinks) | 840 | 840 | 1280 (over, costs bytes only) |

So a half-width image at f = 1.6 is about **1344px** wide in CSS pixels, and about 2688 device
pixels on a 2× display. That is where the "re-export at about 3000 wide" advice in
`preflight.md` §5 comes from.

- **Write `sizes` in `vw` above the desktop band's breakpoint**, as the fraction of the viewport the slot
  occupies when width binds: `sizes="(min-width: 1024px) 50vw, 100vw"`. The container is never wider than
  the viewport, so `vw` is always at least the slot; it overestimates only when height binds,
  which costs bytes, never sharpness. Subtract the padding only if the bytes matter
  (`calc(50vw - 80px)` is safe at every f ≥ 1 because the scaled padding is `80·f`).
- **`sizes` cannot read `var(--fluid)`.** It is parsed before any stylesheet, so custom properties
  and the `fluid-*` utilities mean nothing there. Express the slot in `vw` and `px` only.
- **Ship candidates up to twice the largest slot**, or set `--fluid-desktop-scale-max`
  (`fluid-scale.md` §7). At 1.5 the half-container slot stops at 1260.
- Framework image components (`next/image` and friends) take the same `sizes` string; the default
  `100vw` is only correct for a full-bleed image.
- Reserve every image's box so the scale's own resize never shifts content: see `media.md` §2.

## 4. Fonts

The type rules (units, line boxes, faces as tokens) are in `typography.md` §Fonts. The loading side:

- Load through the framework's font pipeline (`next/font/local`, or `@font-face` with
  `font-display: swap`). Ship only the weights actually used; a display face used only at 800 ships
  one file.
- Preload only the face the first screen renders (usually the display face of the hero heading).
- Measure fallback metrics if CLS matters: `size-adjust` on a fallback `@font-face` keeps the swap
  still. A swap that changes line count also changes a one-screen section's fit.

## 5. `content-visibility`

`content-visibility: auto` (paired with `contain-intrinsic-size` to avoid layout jump on reveal) is
correct **only on below-fold, flow-only content sections**. It replaces the section's real height
with the browser's placeholder estimate until it nears the viewport, which **zeroes the measured
geometry** of anything that reads `offsetHeight`. This is a strict either/or: a section is either a
`content-visibility` candidate (ordinary flow content, nothing measuring it) or part of something
measured, never both. Never apply it inside, or wrapping, a pinned scene's runway or a triggered
reveal group: the full reason is in the `scroll-animation` skill, `references/performance.md`.

## 6. Bundle and asset budgets

Enforceable numeric targets, worth wiring into CI rather than trusting review to catch:

- **Core Web Vitals at p75:** LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1.
- **Image and video formats:** modern, well-compressed formats sized to their actual display
  dimensions — never ship a source asset's native resolution to a container a fraction of its size.
  On this system "actual display dimensions" includes growth above the reference (§3).
- **A scrub-encoded (all-intra) video re-pays its background texture on every frame.** Its size
  budget and the measured 37MB → 9MB case live in the `scroll-animation` skill (`references/video.md`,
  `references/performance.md`).
- **A stray large asset is a permanent cost in version control**, not just a one-time download —
  most VCS systems keep every blob forever, so an oversized commit's clone-time cost never comes back
  once someone "fixes" it later by re-encoding. Catch it before the commit, not after.
- A CI budget script (asset sizes, bundle size deltas) plus a Lighthouse-class check on preview
  deployments is the concrete enforcement mechanism worth having; `verification.md` describes the
  companion runtime checks this doesn't cover. JavaScript weight from animation libraries is the
  `scroll-animation` skill's budget.

## Traps

- ★ A `sizes` px cap written against the drawn container: the slot is 1.5–1.6× larger at 2560 and the
  image renders soft (§3).
- ★ `content-visibility: auto` on anything that is measured zeroes its geometry (§5).
- `var(--fluid)` inside `sizes`: it is never resolved there (§3).
- `dvh` anywhere near the scale: type and layout resize on every frame of the toolbar animation (§2).
- Reading or writing `--fluid` from JavaScript on scroll (§1).
- A font swap that changes a heading's line count also breaks a one-screen section's fit (§4).
- An oversized asset committed "for now": version control keeps it forever (§6).
