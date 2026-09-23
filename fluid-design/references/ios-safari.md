# iOS Safari

**Read when:** anything full-height, sticky, pinned, or SVG is about to ship, or a device report
says "it looks wrong on iPhone."
**Skip when:** the change is desktop-only or doesn't touch layout, motion, or inline assets.
**Depends on:** `scroll-scenes.md` §1 for the `svh`/`lvh` split as it applies inside a pin;
`performance.md` for the general no-forced-compositing rule this document's one exception lives in.

Chrome DevTools' device emulation **cannot** reproduce most of what's in this document — several of
these are Safari/WebKit sampling and rendering behaviours with no emulated equivalent. Verify on a
real device or the matching iOS Simulator; see `verification.md` §Tier 3.

## Contents

1. [`svh` vs `lvh` vs `dvh`](#1-svh-vs-lvh-vs-dvh)
2. [`--browser-bar` and safe areas](#2---browser-bar-and-safe-areas)
3. [The iOS 26 toolbar tint — current policy and what's superseded](#3-the-ios-26-toolbar-tint--current-policy-and-whats-superseded)
4. [No body background, no forced theme-color](#4-no-body-background-no-forced-theme-color)
5. [The hero overshoot](#5-the-hero-overshoot)
6. [`overflow-x: hidden` kills sticky](#6-overflow-x-hidden-kills-sticky)
7. [`maximumScale` vs. the 16px input rule](#7-maximumscale-vs-the-16px-input-rule)
8. [Inline SVG vs. `<img>`](#8-inline-svg-vs-img)
9. [Duplicate `clipPath` ids](#9-duplicate-clippath-ids)
10. [The `<g transform>` paint bug](#10-the-g-transform-paint-bug)
11. [Presentation attributes beat layered utilities](#11-presentation-attributes-beat-layered-utilities)
12. [`@property` for a mask sweep](#12-property-for-a-mask-sweep)
13. [Video play watchdog and toolbar-collapse feedback](#13-video-play-watchdog-and-toolbar-collapse-feedback)
14. [Overscroll / rubber-band](#14-overscroll--rubber-band)
15. [The stale stylesheet](#15-the-stale-stylesheet)
16. [Verification discipline](#16-verification-discipline)
17. [Traps](#traps)

## 1. `svh` vs `lvh` vs `dvh`

| Unit | Meaning | Use for |
| --- | --- | --- |
| `svh` | **Small** viewport — toolbar expanded | ordinary full-height sections; the default choice |
| `lvh` | **Large** viewport — toolbar collapsed | a pin's sticky box (see below) |
| `dvh` | tracks the *current* toolbar state live | almost nothing here — it resizes mid-scroll |
| `vh` | legacy; behaves like `lvh` on iOS | avoid for anything full-height |

`100vh` (and any percentage height resolved against the initial containing block) on iOS includes
the area behind the collapsible URL bar, so a full-height section sized with it visibly jumps as the
bar collapses and expands on scroll.

**Why a pin and its sections deliberately use *different* units, even inside one scene:** a scrubbed
scene's sticky box wants `lvh` — see `scroll-scenes.md` §1 for the full reasoning (`svh` is the
toolbar-*shown* viewport, and a scrub scene is read precisely while scrolling, which is when the
toolbar collapses; measured in `svh` the pin ends up shorter than the physical screen and the page
background shows as a band along the bottom). Ordinary one-screen sections outside a pin, and the
fluid scale's own height arm (`fluid-scale.md` §2), stay on `svh` — a scroll mid-gesture must not
resize their type. `dvh` is right for almost nothing in this system: it tracks the toolbar
animation live, which is a layout thrash on exactly the surfaces (a scrubbed video, a pinned type
scale) that can least afford one.

**A full-bleed picture is a third case, distinct from a layout container.** `100svh` on a
picture/video hero ends exactly where the toolbar begins, so the band behind the toolbar shows
whatever comes *next* — not the hero. The fix is not "use `lvh` and accept content hiding behind the
bar" — it's sizing the **box** and the **content** separately: the section (the art) takes `100lvh`
so it covers the whole physical screen, while the content wrapper *inside* it pads by the toolbar's
own height so copy still lands in the visible area:

```css
:root { --browser-bar: calc(100lvh - 100svh); }   /* 0 on desktop — every rule below is then a no-op */
```

```tsx
<section className="relative min-h-[100lvh] overflow-hidden">
  <Image fill className="object-cover" … />
  <div className="relative z-10 flex h-full flex-col
                  pt-[calc(58px+var(--safe-top))]
                  pb-[calc(24px+var(--browser-bar)+var(--safe-bottom))]">
    …
  </div>
</section>
```

## 2. `--browser-bar` and safe areas

```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --browser-bar: calc(100lvh - 100svh);
}
```

**`env()` needs a fallback inside `calc()`, always.** An `env()` reference the engine doesn't
recognise, with no second argument, resolves to *nothing* — not `0px` — which makes the whole
`calc()` **invalid**, and the entire declaration is dropped rather than degrading gracefully.
Measured: `calc(10px + env(safe-area-inset-top))` computes fine (Safari knows this token, resolves
absent insets to 0), but `calc(10px + env(unknown-token))` drops the declaration entirely and
`calc(10px + env(unknown-token, 0px))` correctly falls back to `10px`. Any engine new enough to
support `env()` at all ships `safe-area-inset-*` alongside it, so this specifically bites engines
with no `env()` support at all — where the padding silently disappears rather than degrading.

**Safe-area insets describe the screen (notch, home indicator), not the browser chrome.** The
collapsible toolbar is not a safe-area inset, so `env(safe-area-inset-bottom)` alone does not clear
it — content that must sit above the URL bar needs `--browser-bar` too. A footer padded only by
`safe-area-inset-bottom` still sits its last line under the URL bar on a phone.

A `position: fixed` element inset from an edge (a header at `top: 24px`) is 24px from the
**physical** screen edge once `viewport-fit: cover` is active — inside the status bar, not below it.
The inset wanted is *below the chrome*: `top: calc(24px + var(--safe-top))`. If that element carries
a full-bleed backdrop, pull the backdrop up by the same term so it still reaches the physical top, or
page content shows through the gap above it.

## 3. The iOS 26 toolbar tint — current policy and what's superseded

Pre-iOS-26, `<meta name="theme-color">` tinted the status bar and URL bar directly. **Safari 26
("Liquid Glass") ignores `theme-color`** for this purpose and instead **samples the background
colour of `position: fixed`/`sticky` elements near the viewport edges** (falling back to `<body>`,
then an opaque OS default — white). The sampling heuristic: the sampled element must be **100% wide
and at least 6px tall**.

**This is where an earlier, plausible-looking playbook gets superseded, so read this part
carefully.** The historically documented fix — two invisible 12px fixed edge strips feeding the
sampler, plus a forced dark `<body>` background and a forced `theme-color` — genuinely works to
force a tint, and it is preserved below because it remains the *only* correct pattern for one
narrower case (§3b). But **the reference build's current, shipped policy is the opposite: no forced
tint, anywhere, on ordinary pages.**

**Why it was reverted.** Forcing a single tint assumes one colour is right for the whole page. It
isn't, on any page whose top and bottom aren't the same colour — a light-hero page under a
globally-forced dark strip gets a hard, wrong-coloured bar above a light hero. Rather than
special-case every route or reintroduce per-section edge strips for ordinary scrolling, the current
policy removes the forced tint entirely and lets Safari's native sampler read whatever is actually
painted at the edges — which, for a page with no `body` background and no `theme-color`, is the
page's own content glassing naturally through the translucent chrome.

**The two removals travel together — this is the part that's easy to get half-right.** `theme-color`
and the forced `body`/`html` background steer the exact same outcome from two different code paths.
Removing only one leaves the survivor still steering the colour (the `body` background alone still
feeds the sampler's fallback), so the fix is not "delete the strips" — it's deleting `theme-color`
**and** the body background **in the same change**.

### 3a. Current policy (do this)

- No `theme-color` meta / `viewport.themeColor` export.
- No `body`/`html` `background-color`.
- `viewport-fit: cover` **stays** — it's what gives Safari real page pixels at the edges to sample,
  independent of whether anything forces a colour.
- Each section paints its own surface as normal; nothing needs to "reach" the chrome.

### 3b. The strips pattern is still correct — but only for a full-viewport overlay

A **full-viewport `fixed`/`sticky` element** (a full-screen menu sheet, a modal) changes what the
sampler sees the instant it mounts, and native-glass-everywhere breaks down here in a way the
policy above doesn't cover:

- Safari samples the background **declared on the overlay element itself**. A transparent fixed
  wrapper around an opaque child samples as transparent → the sampler falls through to an opaque OS
  default (a solid white slab) — it does **not** fall through to glass-over-content the way a small
  partial-edge element would.
- **Children are invisible to the sampler.** Painting colour on a child of the fixed/sticky element
  does nothing; the colour must be on the element the sampler is actually measuring.
- **An element animated in from `scaleY(0)` cannot feed the sampler.** At the moment Safari
  evaluates a newly-mounted overlay it has zero rendered height at the edges, and the tint latches
  before the animation lands — declaring the colour on the animating panel itself does not work;
  this was tried and failed on a real device.
- The sampler re-evaluates on overlay mount/unmount, so a tint can be scoped to exactly the overlay's
  open lifetime.

**Device-verified fix for this one case:** two 12px, never-transformed, `aria-hidden`,
`pointer-events: none` edge strips mounted *inside the overlay's own subtree* (so they mount and
unmount with it), plus setting `document.body.style.backgroundColor` inline for the open duration
and clearing it symmetrically on close:

```tsx
{/* inside the menu sheet's own subtree, not the root layout */}
<div aria-hidden style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 12, background: SHEET_COLOR, pointerEvents: 'none', zIndex: 0 }} />
<div aria-hidden style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 12, background: SHEET_COLOR, pointerEvents: 'none', zIndex: 0 }} />
```

```ts
useEffect(() => {
  if (!open) return
  document.body.style.backgroundColor = SHEET_COLOR
  return () => { document.body.style.backgroundColor = '' }
}, [open])
```

Fastest way to prove the mechanism is wired correctly before trusting it: temporarily set the strips
to `height: 40px; background: red`, confirm red shows in the actual chrome on a device, then revert.

**Negative result — do not re-chase this.** A full-viewport `position: sticky` *pinned scrub scene*
(as opposed to a modal sheet) was found to lose tab-bar transparency on a real device no matter what
was tried: a declared background on the pin, a scroll-tracked background, and a restructure to a
zero-height sticky hook with the full-screen box as a child all failed identically. This is likely
related to a WebKit bug in fixed-overlay tint sampling that was fixed in a later iOS 26 point release
— check the test device's exact iOS version before spending more time on it. The pragmatic options
if this resurfaces: accept the opaque bar during the pinned scene, or tint the strips to match the
scene's own edge colours rather than chasing native glass through it.

## 4. No body background, no forced theme-color

Restated as a standalone rule because it's easy to reintroduce by accident while fixing something
unrelated: under the current policy (§3a), **nothing** paints a global `body`/`html` background and
**nothing** sets a global `theme-color`. If a future change needs the toolbar tinted for a specific
route or section again, reach for the scoped overlay pattern (§3b) or a per-route/per-section CSS
variable driven by whatever already resolves the page's dominant colour (the header-theme probe in
`scroll-scenes.md` §9 is a natural signal to reuse, if one already exists) — never reintroduce a
blanket global background as the first move.

## 5. The hero overshoot

Even with the box/content split in §1, **iOS 26 measures `100lvh` short of the physical screen** on
some devices — the large-viewport unit stops at the toolbar's *resting* edge rather than the true
screen edge, so a full-bleed hero sized `min-h-[100lvh]` still ends above the bottom chrome, and the
next section shows through as a band behind the toolbar. No viewport unit alone fixes this — `svh`,
`dvh`, `lvh` and `-webkit-fill-available` all miss one state or another.

**Device-verified fix: overshoot the section by a fixed slack, and pay the exact same slack back
inside the content box**, scoped to iOS WebKit only via `@supports (-webkit-touch-callout: none)` —
that property exists only on iOS WebKit, so desktop Safari, Chrome and Firefox all skip the rule
entirely:

```tsx
<section className="relative min-h-[100lvh] overflow-hidden
    max-lg:supports-[-webkit-touch-callout:none]:min-h-[calc(100lvh+60px)]">
  <Image fill className="object-cover" … />
  <div className="… pb-[calc(24px+var(--browser-bar)+var(--safe-bottom))]
      max-lg:supports-[-webkit-touch-callout:none]:pb-[calc(24px+var(--browser-bar)+var(--safe-bottom)+60px)]">
    …
  </div>
</section>
```

- The +60px is deliberate slack, not a measured-to-the-pixel constant — for a full-bleed
  photo/video hero it's just more artwork below the fold, invisible in normal use. Don't try to
  compute the exact shortfall; it varies by device and toolbar state, which is precisely how this
  bug survives "correct" units in the first place.
- **The content box must pad back the same 60px**, or bottom-anchored copy slides down into the
  chrome — this is the visible failure mode of applying the overshoot to the section without the
  matching padback.
- Scope with `max-lg:` (or the equivalent) — this is a phone-chrome problem; leaving it unscoped
  costs desktop and iPad nothing but also gains them nothing.
- Only apply this to sections that are **pictures**. A plain layout container that overshoots by 60px
  gains 60px of real, scrollable empty space for no reason.

## 6. `overflow-x: hidden` kills sticky

Covered fully in `scroll-scenes.md` §1 — restated here because it's specifically an iOS-flavoured
trap in practice (sticky sidebars, sticky rails on content pages are where it's usually discovered).
`overflow-x: hidden` on an *ancestor* of a sticky element makes that ancestor a scroll container with
zero scroll range on the visible axis, and the sticky element resolves against that zero-range
container instead of the real one — it behaves as `static`. Use `overflow-x: clip` on ancestors; a
root-level `overflow-x: hidden` on `<html>` itself is safe, because nothing sits above it to be
turned into an intermediate scroll container.

## 7. `maximumScale` vs. the 16px input rule

iOS Safari auto-zooms the page when a focused form input's font-size is under 16px, and leaves the
page zoomed after blur. Two fixes, and they trade against each other — pick deliberately and record
which one, because it's easy for a later change to "fix" one regression by reintroducing the other:

- **`maximumScale: 1`** in the viewport meta. One line, stops the auto-zoom — but **disables pinch
  zoom entirely**, a WCAG 1.4.4 failure: a visitor who needs to magnify the page cannot, at all,
  anywhere on the site. This is sometimes chosen deliberately for a tightly-controlled app UI (it's
  a known, precedented trade some production sites make on purpose), but it's an accessibility cost,
  not a neutral default.
- **Input `font-size: 16px`** on every input/select/textarea. Removes auto-zoom at its actual source
  and **preserves pinch-zoom** for the rest of the page. Preferred when the input styling allows it.

Do not silently flip an existing choice either direction without confirming which trade-off it was
solving for.

## 8. Inline SVG vs. `<img>`

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

## 9. Duplicate `clipPath` ids

A single SVG source inlined at two places on one page (a header logo and a footer logo from the same
export) produces two elements with the **same static `id`** in the DOM if the export wraps its paths
in `<g clip-path="url(#some-id)">`. Chromium tolerates the duplicate and resolves each `url(#…)`
locally; **Safari resolves `url(#…)` to the first occurrence in the document**, which is a different
`<svg>` root than the second instance's own `<defs>`. The cross-root reference fails, and the second
instance paints as **completely empty** — invisible, not merely mis-clipped — while the first
instance renders fine and any plain HTML/text near it (a tagline, alt text) still shows, making the
bug look like a missing-image issue rather than an id collision.

Fix: prefer dropping the redundant `clipPath` entirely when the clip rect is a full-viewBox no-op
(§8) — every instance then becomes self-contained with no id reference at all. If a clip is genuinely
doing work, give each instance a unique id at build time (an SVGO `prefixIds`-style pass).

## 10. The `<g transform>` paint bug

WebKit (including macOS/iOS 26) has a class of bugs where SVG content nested inside a
`<g transform="...">` lays out correctly — geometry present, hit-testing works — but never actually
**paints**. The safe pattern for any hand-maintained or frequently-reused SVG (a logo, a wordmark,
an icon set) is a **flat list of `<path>` elements with absolute coordinates**, no `<g>` wrapper and
no `transform` attribute anywhere in the tree. If a design-tool export arrives with groups and
transforms, flatten it (bake every transform into the path data) before it lands in the codebase —
don't paste a grouped export in and assume Chromium's correctness generalises.

## 11. Presentation attributes beat layered utilities

An SVG's own `width`/`height` **attributes** (as opposed to CSS) are unlayered author styles in
WebKit's cascade, and they beat a utility-framework class that lives inside a `@layer` block —
regardless of specificity math that would otherwise make the class win. Concretely: a component that
sizes an inlined SVG with `h-8 w-auto` (or similar) can render at its full intrinsic size in Safari
if the source SVG still carries literal `width`/`height` attributes, even though the same markup
sizes correctly in Chromium. Drop `width`/`height` attributes from the SVG source at import time and
size it from a CSS class (paired with an `aspect-[W/H]` utility matching the `viewBox`, so
`h-* w-auto` resolves the width correctly in every engine) rather than fighting layer order.

## 12. `@property` for a mask sweep

A custom property that drives a continuously-interpolating paint input (a `mask-image` gradient
stop, for instance) needs to be **registered** via `@property` with a numeric `syntax` — a plain,
unregistered custom property written repeatedly via `style.setProperty()` is treated by WebKit as a
**discrete restyle** rather than an animatable, interpolating value: the gradient's stops jump on
each recalculation instead of sweeping smoothly, so the effect visibly "pops" instead of wiping.
Chromium interpolates a plain custom property either way — this is specifically a WebKit gap.

```css
@property --fill {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}
```

`syntax: '<number>'` (matched to whatever type the value actually is) is what makes the browser treat
updates to it as a typed, animatable value instead of an opaque string token.

## 13. Video play watchdog and toolbar-collapse feedback

Safari/WebKit can silently **demote a video's GPU compositing layer** — and pause it — around events
like a window/viewport resize, without the pause arriving through any event a framework's own state
would normally react to. The result is a machine that believes a loop is running while the decoder
is actually paused: a frozen frame with a healthy `readyState` and a "playing" mode. The fix is a
watchdog, not a one-time `play()` call — something that runs regardless of state (a tick inside an
already-gated rAF loop, or a periodic imperative check) and re-issues `play()` whenever the tracked
"should be playing" intent disagrees with the element's actual `paused` state. See `video.md`'s
imperative controller pattern for the full shape (`ensurePlaying()`), including throttling the
re-issue so a `play()` promise that's still resolving isn't spammed every frame.

**iOS's toolbar collapse feeds back into scroll geometry**, not just viewport height — a
`ResizeObserver`/`resize` handler that reads and caches scroll-scene geometry (`scroll-scenes.md`
§2's range measurement) should defer its read by one animation frame on resize. Safari can service a
`resize` event carrying the *new* `innerHeight` while layout still holds `svh`-sized children at
their *old* size, and reading geometry synchronously inside that event reads back a range far
shorter than reality. One `requestAnimationFrame` deferral (coalesced, so a drag produces one
measurement per frame rather than one per event) puts the read after layout has actually settled to
the new toolbar state.

## 14. Overscroll / rubber-band

`overscroll-behavior: none` on the root element kills the rubber-band/elastic overscroll effect at
scroll boundaries — worth setting deliberately on any page with a scroll-driven scene, because
momentum bouncing past a scroll boundary otherwise feeds jitter directly into whatever reads scroll
position for a pin or a latch (`scroll-scenes.md` §3, §5). This is a global layout decision, not a
per-component one — set it once on the document root.

## 15. The stale stylesheet

**This is almost always the actual cause of "the scroll-driven video/pin is broken" reports, and
it's worth checking before touching any scrub code.** A dev server pushes CSS over its HMR socket;
restarting the server kills that socket, and a tab that was already open does **not** reliably
re-fetch the stylesheet on reconnect — it keeps serving the previous one from memory. **Safari holds
this hardest of any engine:** a plain reload (⌘R-equivalent) often re-runs the page against the
*cached* CSS, so the reload appears not to work, while simply closing the tab and opening a new one
fixes it instantly.

**The trigger is always the same pair:** the stylesheet changed on disk **and** the server restarted
while a tab stayed open.

**Why the symptom looks exactly like a motion/pin bug rather than a stylesheet bug:** any
framework-specific utility class defined via an at-rule (Tailwind v4's `@utility`, for instance) is
still present in the rendered HTML with no rule behind it once the stylesheet goes stale — the class
name is there, the CSS that gives it meaning isn't. A missing size/height utility on a pinned scene's
frame produces exactly the symptom "the pin holds the first frame, then snaps to the last" (near-zero
travel because the section collapsed to `height: auto`), which reads like a scroll-math bug and sends
a debugging session into the wrong file entirely.

**The check**, before reading any scroll-math code: read back a CSS custom property from the fluid
scale (or any similarly recently-touched stylesheet variable) via `getComputedStyle` in the console.
A fresh, correctly-formed value (matching the current source) means keep debugging elsewhere; an
empty string or an older/different form of the same expression means stop — the stylesheet is stale,
not the code.

**The fix:** close the tab, open a fresh one. If the symptom survives that, `rm -rf .next` (or the
framework's equivalent build cache) and restart the dev server. **Closing the tab fixing it is proof
the underlying code was fine all along** — a genuine logic bug doesn't care which tab is open.

**After any change to a global stylesheet:** restart the dev server and open a fresh tab before
judging what's on screen. Utility definitions declared via at-rules specifically only exist in a
freshly rebuilt stylesheet — there's no partial-HMR path for them the way there sometimes is for
plain property values.

## 16. Verification discipline

- **Only a real device verifies tint.** Chrome DevTools' device emulation cannot reproduce iOS 26's
  Liquid Glass sampling — not "reproduces it imperfectly," genuinely does not attempt it. A build
  that "looks right" in emulation says nothing about the actual chrome tint.
- **Confirm the deployed chunk contains the fix before asking for a device test.** A CDN/build
  propagation delay of even a minute is enough for a device test to run against the *previous*
  deployment and produce a false negative — this specific failure mode (testing a build that didn't
  yet contain the fix) has cost real cycles. Check the deployed asset hash or a visible marker before
  handing a device over for testing.
- Run the viewport matrix in `verification.md` (including the well-above-reference width, e.g.
  2560px) on any change to the fluid scale or a pinned scene's geometry — several of the bugs in this
  document are invisible at or below the design reference width and only appear once a viewport
  exceeds it.

## Traps

- ★ Forcing `theme-color` + a body background is the *superseded* iOS 26 tint fix for an ordinary
  page — the current policy is no forced tint at all (§3, §4). The strips pattern is still correct,
  but scoped to full-viewport overlays only (§3b).
- ★ `100svh` on a full-bleed picture/video hero ends at the toolbar, not the physical screen —
  size the box in `lvh`, pad the content back (§1, §5).
- ★ `overflow-x: hidden` on an ancestor of a sticky element kills its stickiness (§6).
- ★ A duplicate SVG `clipPath` id across two inlined instances renders the second instance
  completely empty on Safari only (§9).
- ★ SVG content inside a `<g transform>` can lay out without ever painting on WebKit — flatten
  transforms into path data (§10).
- Deleting a clip rect inside `<clipPath>` because it "looks like a redundant background" clips the
  whole graphic to nothing (§8).
- An SVG's own `width`/`height` attributes beat a layered utility class sizing it in Safari — strip
  them at import time (§11).
- An unregistered custom property driving a `mask-image` gradient pops instead of sweeping on WebKit
  — register it with `@property` (§12).
- Reading scroll-scene geometry synchronously inside a `resize` handler can read stale `svh`-derived
  layout mid-toolbar-collapse — defer one animation frame (§13).
- `env()` inside `calc()` with no fallback drops the whole declaration on an engine that doesn't
  recognise the token — always write the fallback (§2).
- A restarted dev server plus an already-open tab is stale CSS, not a scroll-math bug — check
  `getComputedStyle` before debugging pin logic (§15).
