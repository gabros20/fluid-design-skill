# Media: images, SVG and the video element

**Read when:** placing any image, inline SVG, logo, icon set or `<video>` on a fluid page, or a
graphic renders empty, clipped, at the wrong size or soft in one engine only.
**Skip when:** the question is how a video *plays* (scrubbing, loops, preload tiers, autoplay,
tab-sleep, encoding for scrub or loops). That is the `scroll-animation` skill, `references/video.md`.
**Depends on:** `performance.md` §3 for image `sizes` on a page that grows; `ios-safari.md` for the
viewport units a full-bleed picture uses.

## Contents

1. [Size media in fluid units; CSS owns width and height](#1-size-media-in-fluid-units-css-owns-width-and-height)
2. [Reserve dimensions against layout shift](#2-reserve-dimensions-against-layout-shift)
3. [Images](#3-images)
4. [SVG](#4-svg)
5. [The video element: rendering only](#5-the-video-element-rendering-only)
6. [Traps](#traps)

## 1. Size media in fluid units; CSS owns width and height

Media drawn in the container is drawn geometry like anything else: write the drawn number through a
fluid utility (`lg:fluid-w-512`, `lg:fluid-h-46`, `lg:fluid-size-24`), or give it a fraction of a
scaling box. A logo, icon or photo frozen at its px size while the gaps around it scale changes the
drawing's proportions (`section-recipe.md` checklist item 6).

**CSS owns the box; transforms are only for motion.** Size the element with `width`/`height` (or
`aspect-ratio` plus one of them) in CSS, and let `object-fit`/`object-position` crop the pixels
inside it. If something later scales or pans the media per frame, it does so with `transform` on top
of that CSS box, so the operation never triggers a layout-invalidating write, no matter how large
the multiplier. Never size media by writing `width`/`height` from script.

## 2. Reserve dimensions against layout shift

Every image and video gets its box before its pixels arrive, or the page jumps when they do (CLS
budget ≤ 0.1, `performance.md` §6), and a one-screen section's fit changes under the reader.

- `<img>` and `<video>`: give the intrinsic `width` and `height` attributes (they supply the aspect
  ratio before load) **and** size it in CSS. Or put an `aspect-[W/H]` utility on the element or its box.
- Inline SVG is the exception: strip its `width`/`height` attributes and use `aspect-[W/H]` matched to
  the `viewBox` (§4.4).
- A full-bleed picture fills a sized parent (`fill` + `object-cover`), and the parent carries the
  size: `min-h-[100lvh]` on a phone hero, `lg:fluid-h-900` on desktop (`ios-safari.md` §1, §5).

## 3. Images

- `sizes` must allow for growth above the reference, and cannot read `var(--fluid)`: write it in
  `vw`. Worked numbers are in `performance.md` §3 (a half-width image at f = 1.6 is about 1344px wide).
- Ship candidates up to about twice the largest slot, or set `--fluid-desktop-scale-max` (`fluid-scale.md` §7). A
  1920-wide raster upscales about 1.3× on a 27" 5K.
- Art direction (a different crop per breakpoint) is `<picture>` with `<source media>`; it
  re-evaluates on resize, unlike a video's `<source media>`.
- Modern formats, sized to the display slot, never the source's native resolution.
- A photo that carries text or a brand mark needs its contrast checked at both ends of the scale;
  the type on it scales on a gentler curve than the photo (`typography.md`).

## 4. SVG

Safari/WebKit has four separate SVG failures that Chromium does not share, so an SVG that looks right
in Chrome proves nothing. All four were real, and all four render as *missing* or *wrong-sized*, not
as an error.

### 4.1 Inline SVG vs. `<img>`

Safari/WebKit unreliably paints an external SVG loaded via `<img src="…svg">` when that SVG carries
`clip-path="url(#…)"` — Chromium renders the identical file correctly. Always inline the SVG as a
component (import it via an SVG-to-component pipeline) rather than serving it from a static path
through `<img>`; inline `<svg>` markup in the actual HTML sidesteps both the clip-path quirk and
Safari's aggressive SVG cache.

**Cleaning an export before inlining it: the `<rect fill="white">` inside a `<clipPath>` is the CLIP
SHAPE, not a background layer.** Deleting it — a natural-looking cleanup move — clips the entire
graphic to nothing, and the result silently renders as an empty `<svg>`. Either keep the `<defs>`
intact, or remove **both** the `clip-path` attribute on the path **and** the `<defs>` block together
— safe specifically when the clip rect equals the full viewBox, which is the common case for a
straight design-tool export where the clip was never doing real work.

### 4.2 Duplicate `clipPath` ids

A single SVG source inlined at two places on one page (a header logo and a footer logo from the same
export) produces two elements with the **same static `id`** in the DOM if the export wraps its paths
in `<g clip-path="url(#some-id)">`. Chromium tolerates the duplicate and resolves each `url(#…)`
locally; **Safari resolves `url(#…)` to the first occurrence in the document**, which is a different
`<svg>` root than the second instance's own `<defs>`. The cross-root reference fails, and the second
instance paints as **completely empty** — invisible, not merely mis-clipped — while the first
instance renders fine and any plain HTML/text near it (a tagline, alt text) still shows, making the
bug look like a missing-image issue rather than an id collision.

Fix: prefer dropping the redundant `clipPath` entirely when the clip rect is a full-viewBox no-op
(§4.1) — every instance then becomes self-contained with no id reference at all. If a clip is genuinely
doing work, give each instance a unique id at build time (an SVGO `prefixIds`-style pass).

### 4.3 The `<g transform>` paint bug

WebKit (including macOS/iOS 26) has a class of bugs where SVG content nested inside a
`<g transform="...">` lays out correctly — geometry present, hit-testing works — but never actually
**paints**. The safe pattern for any hand-maintained or frequently-reused SVG (a logo, a wordmark,
an icon set) is a **flat list of `<path>` elements with absolute coordinates**, no `<g>` wrapper and
no `transform` attribute anywhere in the tree. If a design-tool export arrives with groups and
transforms, flatten it (bake every transform into the path data) before it lands in the codebase —
don't paste a grouped export in and assume Chromium's correctness generalises.

### 4.4 Presentation attributes beat layered utilities

An SVG's own `width`/`height` **attributes** (as opposed to CSS) are unlayered author styles in
WebKit's cascade, and they beat a utility-framework class that lives inside a `@layer` block —
regardless of specificity math that would otherwise make the class win. Concretely: a component that
sizes an inlined SVG with `h-8 w-auto` (or similar) can render at its full intrinsic size in Safari
if the source SVG still carries literal `width`/`height` attributes, even though the same markup
sizes correctly in Chromium. Drop `width`/`height` attributes from the SVG source at import time and
size it from a CSS class (paired with an `aspect-[W/H]` utility matching the `viewBox`, so
`h-* w-auto` resolves the width correctly in every engine) rather than fighting layer order.

`scripts/audit.mjs` flags `<img src="….svg">` (`img-svg`).

## 5. The video element: rendering only

How a video plays (scrubbing, loops, preload tiers, IntersectionObserver gating, autoplay policy,
tab-sleep rehydrate, all-intra and loop encoding) is the `scroll-animation` skill,
`references/video.md`. What stays here is how the element renders and sizes on a fluid page.

### 5.1 Inline playback on iOS

Any video that plays without a click needs `muted` and `playsInline` (`playsinline` in HTML). Without
`playsInline`, iOS Safari takes the video fullscreen on play; without `muted`, no browser will start
it. Give it a deliberate `preload` too; the tiers are the `scroll-animation` skill's.

### 5.2 Size it like any other media

A video's box is CSS (§1), reserved before load (§2). An oversized video (larger than its container,
so something can pan or zoom it without exposing an edge) gets its width and height from the same
custom property or utility, and needs the reset fix below.

### 5.3 The Preflight `max-width` trap

Most CSS resets (Tailwind's Preflight among them) set `video { max-width: 100% }`. That silently
clamps a video that's *deliberately* oversized relative to its container — the common case for a
scrub scene's camera, which needs the asset larger than the viewport so it can pan and zoom without
exposing an edge.

The symptom reads as a mis-cropped video, not a broken one, which is what makes it slow to diagnose:
because the video's **height** is usually derived from the same custom property as its width, the
height stays correct while the width silently clamps to the container — `offsetWidth` equals the
container's width exactly where it should be much larger, while the aspect ratio looks merely wrong
rather than obviously broken. Fix: `max-w-none` on the video element, scoped to whichever breakpoint
the oversized camera treatment applies at.

### 5.4 The `translateZ(0)` anchor (short)

A `translateZ(0)` (or `translate3d(...)`) inside a video's transform is a load-bearing Safari
compositing anchor that keeps the video's own layer from being demoted. It is the one standing
exception to "no `will-change`, no forced compositing", and it is deliberately permanent: do not
"clean it up" as part of an unrelated refactor. When a scene writes the video's transform per frame,
the anchor lives inside that same composed string, not as a separate declaration: see the
`scroll-animation` skill, `references/video.md`.

### 5.5 Posters

A JPEG poster export and the *decoded first frame* of the video it covers are almost never
pixel-identical — different colour pipeline, different compression artefacts — and the mismatch
shows as a visible flash the instant the video starts decoding over a static poster, especially
under any blend mode (`mix-blend-mode: lighten` and similar amplify small colour deltas). Two
consequences:

- **Export the poster from the encoded output, not from the source master.** A poster pulled from
  the pre-encode master will not match what the codec actually produces on decode; pull it from the
  delivered file (`ffmpeg -ss T -i encoded.mp4 -frames:v 1 poster.jpg`) so the two are the same
  pixels through the same pipeline.
- **The poster cannot be art-directed independently of the video** — it has to be a specific frame
  of the same asset. If the design wants a genuinely different, art-directed still (a different crop
  or composition than any frame the video passes through), that's a job for a separate `<picture>`
  element with its own `media` tiers underneath the video, not for the `poster` attribute — `poster`
  can only ever be a frame of the video it's attached to.

Where the flash matters most (mobile, where decode is slower and the effect more visible), consider
dropping the poster attribute entirely and fading the video element in once its first frame is
confirmed decoded, rather than fighting a poster/frame mismatch.

Where the design wants a still under the video, the `<picture>` sits in the same sized box as the
video (§1), so the two register exactly at every scale.

## Traps

- ★ `<img src="….svg">` with a `clip-path` paints unreliably in Safari — inline it (§4.1).
- ★ A duplicate SVG `clipPath` id across two inlined instances renders the second instance
  completely empty on Safari only (§4.2).
- ★ SVG content inside a `<g transform>` can lay out without ever painting on WebKit — flatten
  transforms into path data (§4.3).
- ★ A CSS reset's `video { max-width: 100% }` silently clamps a deliberately oversized video —
  `max-w-none` (§5.3).
- Deleting a clip rect inside `<clipPath>` because it "looks like a redundant background" clips the
  whole graphic to nothing (§4.1).
- An SVG's own `width`/`height` attributes beat a layered utility class sizing it in Safari — strip
  them at import time (§4.4).
- A `sizes` px cap written against the container: the image renders soft above the reference (§3).
- Media with no reserved box: layout shift, and a one-screen section that overflows until it loads (§2).
- A video without `muted playsInline` goes fullscreen or refuses to start on iOS (§5.1).
- A poster pulled from the pre-encode master, not the delivered file, visibly mismatches the decoded
  first frame (§5.5).
- Media sized by script, or its box animated through `width`/`height`: CSS owns the box (§1).
