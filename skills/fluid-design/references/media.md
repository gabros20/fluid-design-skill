# Media: images, SVG and the video element

**Purpose:** Sizing and reserving images, inline SVG and `<video>` in fluid units, Safari's SVG
rendering rules, and posters.
**Read when:** placing an image, inline SVG, logo, icon set, carousel or `<video>` on a fluid page,
or a graphic renders empty, clipped, at the wrong size or soft in one engine only.
**Skip when:** the question is how a video *plays* (scrubbing, loops, preload tiers, autoplay,
tab-sleep, encoding). That is outside this skill.
**Inputs:** the media elements, their intrinsic sizes, and how the stack imports SVG.
**Produces:** media sized in fluid units with reserved boxes, Safari-safe SVG, and video markup with
a poster.
**Depends on:** `performance.md` §3 for image `sizes` on a page that grows; `ios-safari.md` for the
viewport units a full-bleed picture uses.

## Contents

1. [Size media in fluid units; CSS owns the box](#1-size-media-in-fluid-units-css-owns-the-box)
2. [Reserve the box against layout shift](#2-reserve-the-box-against-layout-shift)
3. [Images](#3-images)
4. [SVG](#4-svg)
5. [The video element: rendering only](#5-the-video-element-rendering-only)
6. [Traps](#traps)

## 1. Size media in fluid units; CSS owns the box

Media in the design is drawn geometry like anything else: write the drawn number through a fluid
utility (`lg:fluid-w-512`, `lg:fluid-h-46`, `lg:fluid-size-24`) or give it a fraction of a scaling
box. A logo or photo frozen at its px size while the gaps around it scale changes the drawing's
proportions (`section-recipe.md` checklist item 6).

**Carousels and strips that run to the window edge** sit inside the `fluid-container` with
`fluid-bleed-x` (CSS: `.fluid-bleed-x`; SCSS: `@include fd.fluid-bleed-x`). It reaches both window
edges and pads back in by the same amount, so the first slide still lines up with the container's
content. Don't size the track in `100vw` by hand.

**CSS owns the box; transforms are only for motion.** Size the element with `width`/`height` (or
`aspect-ratio` plus one of them) and let `object-fit`/`object-position` crop the pixels inside. A
later scale or pan uses `transform` on top of that box, so it never triggers layout. Never write
`width`/`height` from script.

## 2. Reserve the box against layout shift

Every image and video gets its box before its pixels arrive, or the page jumps when they do (CLS
budget ≤ 0.1, `performance.md` §6) and a one-screen section's fit changes under the reader.

- `<img>` and `<video>`: give the intrinsic `width` and `height` attributes (they supply the aspect
  ratio before load) **and** size it in CSS, or put `aspect-[W/H]` on the element or its box.
- Inline SVG is the exception: strip `width`/`height` and use `aspect-[W/H]` matching the `viewBox`
  (§4.4).
- A full-bleed picture fills a sized parent (`fill` + `object-cover`); the parent carries the size:
  `min-h-[100lvh]` on a phone hero, `lg:fluid-h-900` on desktop (`ios-safari.md` §1, §5).

## 3. Images

- `sizes` must allow for growth above the reference and cannot read `var(--fluid)`: write it in
  `vw`. Worked numbers are in `performance.md` §3 (a half-width image at f = 1.6 is about 1344px).
- Ship candidates up to about twice the largest slot, or set `--fluid-desktop-scale-max`
  (`fluid-scale.md` §5). A 1920-wide raster upscales about 1.3× on a 27" 5K.
- Art direction (a different crop per breakpoint) is `<picture>` with `<source media>`; it
  re-evaluates on resize, unlike a video's `<source media>`.
- Modern formats, sized to the display slot, never the source's native resolution.
- Check the contrast of a photo carrying text or a mark at both ends of the scale: the type on it
  scales on a gentler curve than the photo (`typography.md`).

## 4. SVG

Safari/WebKit has four SVG failures Chromium does not share, so an SVG that looks right in Chrome
proves nothing. All four were real, and all four render as *missing* or *wrong-sized*, never as an
error.

### 4.1 Inline SVG, not `<img>`

Safari unreliably paints an external SVG loaded through `<img src="…svg">` when it carries
`clip-path="url(#…)"`; Chromium renders the same file. Inline the SVG as a component (an
SVG-to-component import). That avoids the clip-path quirk and Safari's aggressive SVG cache.
`scripts/tools/audit.mjs` flags `<img src="….svg">` (`img-svg`).

**When cleaning an export, the `<rect fill="white">` inside a `<clipPath>` is the clip shape, not a
background.** Deleting it clips the graphic to nothing: an empty `<svg>`. Keep the `<defs>` intact,
or remove **both** the `clip-path` attribute **and** the `<defs>`, which is safe when the clip rect
equals the full viewBox (the usual design-tool export, where the clip does no work).

### 4.2 Duplicate `clipPath` ids

One SVG inlined twice on a page (header and footer logo) puts two identical `id`s in the DOM when
the export wraps its paths in `<g clip-path="url(#some-id)">`. Chromium resolves each `url(#…)`
locally; **Safari resolves it to the first occurrence in the document**, in the other `<svg>`. The
second instance paints **completely empty**, while nearby text still shows, so it looks like a
missing image rather than an id collision.

Fix: drop the `clipPath` when it is a full-viewBox no-op (§4.1), so each instance needs no id. If the
clip does real work, give each instance a unique id at build time (an SVGO `prefixIds`-style pass).

### 4.3 The `<g transform>` paint bug

WebKit (macOS/iOS 26 included) can lay out SVG content inside `<g transform="…">` (geometry present,
hit-testing works) and never **paint** it. For any reused SVG (logo, wordmark, icon set) use a flat
list of `<path>` elements with absolute coordinates: no `<g>` wrapper, no `transform`. Flatten an
export (bake transforms into the path data) before it lands in the codebase.

### 4.4 Presentation attributes beat layered utilities

An SVG's own `width`/`height` **attributes** are unlayered author styles in WebKit's cascade, and
they beat a utility class inside `@layer`, whatever the specificity. An inlined SVG sized `h-8 w-auto`
renders at its full intrinsic size in Safari if the source still has `width`/`height`. Strip them at
import and size from CSS with an `aspect-[W/H]` matching the `viewBox`, so `h-* w-auto` resolves in
every engine.

## 5. The video element: rendering only

How a video plays (scrubbing, loops, preload tiers, IntersectionObserver gating, autoplay policy,
tab-sleep, encoding) is outside this skill. This section is how the element renders and sizes.

### 5.1 Inline playback on iOS

A video that plays without a click needs `muted` and `playsInline` (`playsinline` in HTML). Without
`playsInline`, iOS goes fullscreen on play; without `muted`, no browser starts it. Set a deliberate
`preload` too.

### 5.2 Size it like any other media

Its box is CSS (§1), reserved before load (§2). An oversized video (larger than its container, so it
can pan or zoom without exposing an edge) takes width and height from the same custom property or
utility, and needs the fix below.

### 5.3 The Preflight `max-width` trap

Most resets (Tailwind's Preflight included) set `video { max-width: 100% }`, which silently clamps a
deliberately oversized video. It reads as a mis-cropped video, not a broken one: the height (from the
same custom property) stays right while the width clamps to the container, so `offsetWidth` equals
the container's width and the aspect only looks off. Fix: `max-w-none` on the video, at the
breakpoint the oversized treatment applies.

### 5.4 The `translateZ(0)` anchor

A `translateZ(0)` (or `translate3d(…)`) in a video's transform is a load-bearing Safari compositing
anchor that keeps the video's layer from being demoted. It is the one exception to "no
`will-change`, no forced compositing" and is permanent: don't "clean it up" in an unrelated
refactor. When a scene writes the transform per frame, the anchor lives in that same string.

### 5.5 Posters

A JPEG poster and the video's *decoded first frame* are almost never pixel-identical (different
colour pipeline and artefacts), and the difference flashes when decoding starts, worse under a blend
mode (`mix-blend-mode: lighten` amplifies small colour deltas).

- **Export the poster from the encoded file, not the master**:
  `ffmpeg -ss T -i encoded.mp4 -frames:v 1 poster.jpg`, so both go through the same pipeline.
- **A poster can only be a frame of its video.** A different, art-directed still is a separate
  `<picture>` (with its own `media` tiers) under the video, in the same sized box (§1) so the two
  register at every scale.
- Where the flash matters most (mobile, slower decode), consider no poster and fade the video in once
  its first frame has decoded.

## Traps

- ★ `<img src="….svg">` with a `clip-path` paints unreliably in Safari: inline it (§4.1).
- ★ A duplicate `clipPath` id across two inlined instances renders the second one empty, Safari only
  (§4.2).
- ★ SVG inside `<g transform>` can lay out without painting on WebKit: flatten it (§4.3).
- ★ A reset's `video { max-width: 100% }` clamps a deliberately oversized video: `max-w-none` (§5.3).
- Deleting the clip rect inside `<clipPath>` as a "redundant background" clips the graphic to
  nothing (§4.1).
- An SVG's `width`/`height` attributes beat a layered utility in Safari: strip them (§4.4).
- A `sizes` px cap written against the container: soft images above the reference (§3).
- Media with no reserved box: layout shift, and a one-screen section that overflows until it loads
  (§2).
- A carousel track sized in `100vw` by hand instead of `fluid-bleed-x`: it loses alignment with the
  container (§1).
- A video without `muted playsInline` goes fullscreen or won't start on iOS (§5.1).
- A poster pulled from the master, not the delivered file, mismatches the first frame (§5.5).
- Media sized by script, or its box animated through `width`/`height`: CSS owns the box (§1).
