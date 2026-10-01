# iOS Safari: render fixes

**Purpose:** iOS Safari render fixes for a fluid page: `svh`/`lvh`/`dvh`, `--fluid-browser-bar`,
safe areas and the notch, the iOS 26 toolbar tint, the hero overshoot, sticky killers, input zoom,
overscroll, hydration errors Safari causes, and what only a real device can check.
**Read when:** anything full-height, sticky or edge-to-edge is about to ship, or a report says "it
looks wrong on iPhone."
**Skip when:** the change is desktop-only and doesn't touch layout. SVG rules live in `media.md`;
anything that moves (a pin's scroll maths, video playback, a mask sweep) is outside this skill.
**Inputs:** the full-height, sticky or edge-to-edge elements, the viewport meta tag, any device
report.
**Produces:** unit and structure choices that render right on iPhone, and the device-only checks.
**Depends on:** `performance.md` for the render budget; `fluid-scale.md` §3 for why the scale's
height arm is `svh`.

Chrome DevTools' device emulation cannot reproduce most of this: they are WebKit sampling and
rendering behaviours with no emulated equivalent. Check on a real device or the iOS Simulator
(`verification.md` §3–§4).

## Contents

1. [`svh` vs `lvh` vs `dvh`](#1-svh-vs-lvh-vs-dvh)
2. [`--fluid-browser-bar`, safe areas and the notch](#2---fluid-browser-bar-safe-areas-and-the-notch)
3. [The iOS 26 toolbar tint](#3-the-ios-26-toolbar-tint)
4. [No global body background; per-page colour](#4-no-global-body-background-per-page-colour)
5. [The hero overshoot](#5-the-hero-overshoot)
6. [Sticky: `overflow-x: hidden` and `transform` on an ancestor](#6-sticky-overflow-x-hidden-and-transform-on-an-ancestor)
7. [`maximumScale` vs. the 16px input rule](#7-maximumscale-vs-the-16px-input-rule)
8. [Overscroll](#8-overscroll)
9. [Hydration errors from Safari](#9-hydration-errors-from-safari)
10. [When the bug is not the page](#10-when-the-bug-is-not-the-page)
11. [Verification](#11-verification)
12. [Traps](#traps)

## 1. `svh` vs `lvh` vs `dvh`

| Unit | Meaning | Use for |
| --- | --- | --- |
| `svh` | small viewport: toolbar expanded | ordinary full-height sections (the default) |
| `lvh` | large viewport: toolbar collapsed | a pin's sticky box (with a matching `lvh` negative margin); a full-bleed picture's box |
| `dvh` | follows the toolbar live | almost nothing: it resizes mid-scroll |
| `vh` | legacy; acts like `lvh` on iOS | avoid for anything full-height |

`100vh` on iOS includes the area behind the collapsible URL bar, so a section sized with it jumps as
the bar collapses and expands.

**Ordinary sections and the scale's own height arm stay on `svh`**: a scroll must not resize their
type. `dvh` re-lays-out on every frame of the toolbar animation, the worst cost for a pinned render
or a scaled type ramp.

**`svh` moved on iOS Safari 16.4–17.3** (WebKit bug 261185: with the tab bar hidden, `svh` computed
like `dvh`). Fixed in 17.4 (March 2024). `svh` is still right, since `dvh` moves on every version,
but "type resizes while I scroll" on an older iPhone is this bug, not the code. Check the iOS version
first.

**A full-bleed picture sizes the box and the content separately.** `100svh` on a photo or video hero
ends where the toolbar starts, so the band behind the toolbar shows the *next* section. Give the
section (the art) `100lvh` so it covers the screen, and pad the content inside by the toolbar's
height so copy lands in the visible area:

```tsx
<section className="relative min-h-[100lvh] overflow-hidden">
  <Image fill className="object-cover" … />
  <div className="relative z-10 flex h-full flex-col
                  pt-[calc(58px+var(--fluid-safe-top))]
                  pb-[calc(24px+var(--fluid-browser-bar)+var(--fluid-safe-bottom))]">…</div>
</section>
```

## 2. `--fluid-browser-bar`, safe areas and the notch

The engine sets these on `:root` and every scope (namespaced, so a site's own `--safe-top` is left
alone; the short names exist only with `aliases: true`):

```css
--fluid-safe-top: env(safe-area-inset-top, 0px);
--fluid-safe-bottom: env(safe-area-inset-bottom, 0px);
--fluid-browser-bar: calc(100lvh - 100svh);   /* 0 on desktop, so rules using it are no-ops there */
```

**Always give `env()` a fallback inside `calc()`.** An `env()` the engine doesn't know, with no
fallback, makes the whole `calc()` invalid and the declaration is dropped, not degraded. Measured:
`calc(10px + env(unknown-token))` drops the declaration; `calc(10px + env(unknown-token, 0px))` gives
`10px`. Safari knows `safe-area-inset-*` (absent insets are 0), so this bites engines with no `env()`
support, where the padding silently disappears.

**Safe-area insets describe the screen (notch, home indicator), not the browser toolbar.** A footer
padded only by `safe-area-inset-bottom` still sits its last line under the URL bar; add
`--fluid-browser-bar`.

**Fixed elements under `viewport-fit=cover`.** A header at `top: 24px` is 24px from the *physical*
edge, inside the status bar. Write `top: calc(24px + var(--fluid-safe-top))`. If it has a full-bleed
backdrop, pull the backdrop up by the same amount, or content shows through the gap above it.

**The notch in landscape is handled by the container.** `--fluid-container-padding` is
`max(drawn padding × unit, env(safe-area-inset-left, 0px), env(safe-area-inset-right, 0px))`. With
`viewport-fit=cover`, a phone on its side keeps content in `fluid-container` (and `fluid-bleed-x`,
which reads the same padding) clear of the notch, with no per-component `env()` rules. Elsewhere the
insets are 0 and nothing changes. Only elements outside the container need their own inset.

## 3. The iOS 26 toolbar tint

Before iOS 26, `<meta name="theme-color">` tinted the status and URL bars. **Safari 26 ("Liquid
Glass") ignores `theme-color`** and samples the background of `position: fixed`/`sticky` elements
near the top and bottom edges, falling back to `<body>`, then to an opaque OS default (white). A
sampled element must be **100% wide and at least 6px tall**.

**Policy: no forced tint on ordinary pages.** An older fix (two invisible 12px fixed edge strips, a
forced dark `body` background and a forced `theme-color`) does force a tint, and was reverted: one
colour is wrong on any page whose top and bottom differ (a light hero under a forced dark bar). With
no `body` background and no `theme-color`, Safari samples the page's own edges, which glass through
the toolbar naturally.

- No `theme-color` meta / `viewport.themeColor` export.
- No global `body`/`html` `background-color` (§4).
- Keep `viewport-fit: cover`: it gives Safari real page pixels at the edges to sample.
- Each section paints its own surface.

**Remove `theme-color` and the body background in the same change.** They steer the same outcome by
two paths; the survivor keeps steering it (the body background still feeds the sampler's fallback).

### 3b. Edge strips: only for a full-viewport overlay

A full-viewport `fixed`/`sticky` overlay (a menu sheet, a modal) changes what the sampler sees the
moment it mounts, and the policy above breaks down:

- Safari samples the background **declared on the overlay element itself**. A transparent fixed
  wrapper around an opaque child samples as transparent and falls through to the white OS default,
  not to glass over content.
- **Children are invisible to the sampler.** The colour must be on the measured element.
- **A panel animated in from `scaleY(0)` cannot feed the sampler**: it has no height at the edges
  when Safari samples, and the tint latches before the animation lands (tried, failed on device).
- The sampler re-evaluates on mount and unmount, so the tint can last exactly as long as the overlay.

**Device-verified fix:** two 12px, never-transformed, `aria-hidden`, `pointer-events: none` strips
inside the overlay's own subtree (so they mount and unmount with it), plus the body colour set for
the open duration and cleared on close:

```tsx
{/* inside the menu sheet's subtree, not the root layout */}
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

To prove the wiring first, set the strips to `height: 40px; background: red`, confirm red in the
toolbar on a device, then revert.

A full-viewport sticky **pinned scene** has a device-verified negative result: its toolbar tint is
accepted as it is. Do not re-chase it.

## 4. No global body background; per-page colour

Easy to reintroduce while fixing something else: **nothing** paints a global `body`/`html`
background and **nothing** sets a global `theme-color` (§3). When a route or section needs a colour
at the edges, use the overlay pattern (§3b) or a per-page signal, never a blanket background.

**The per-page path: overscroll on a page with a coloured header.** On a page whose header and hero
are coloured (say green), a bounce past the top shows the root background above the header, white
by default. Set an attribute on `<html>` only on those pages, plus which half of the page is in view,
and colour the root from both: top half → the header's colour, bottom half → the default under the
footer.

```ts
// in the header component, only when this page's header is green
useEffect(() => {
  if (!isGreenHeader) return
  const root = document.documentElement
  root.dataset.headerTone = 'green'
  const update = () => {
    root.dataset.scrollHalf = scrollY < (root.scrollHeight - innerHeight) / 2 ? 'top' : 'bottom'
  }
  update()
  addEventListener('scroll', update, { passive: true })
  return () => { removeEventListener('scroll', update); delete root.dataset.headerTone; delete root.dataset.scrollHalf }
}, [isGreenHeader])
```

```css
html[data-header-tone='green'][data-scroll-half='top'] { background-color: var(--color-green); }
```

Every other page keeps no root background, so the §3 policy holds.

## 5. The hero overshoot

Even with the box/content split (§1), **iOS 26 measures `100lvh` short of the physical screen** on
some devices: it stops at the toolbar's resting edge, so a `min-h-[100lvh]` hero ends above the
bottom chrome and the next section shows behind the toolbar. No viewport unit fixes it: `svh`,
`dvh`, `lvh` and `-webkit-fill-available` each miss one state.

**Device-verified fix: overshoot the section by a fixed slack and pad the same slack back inside**,
on iOS WebKit only via `@supports (-webkit-touch-callout: none)` (only iOS WebKit has that property):

```tsx
<section className="relative min-h-[100lvh] overflow-hidden
    max-lg:supports-[-webkit-touch-callout:none]:min-h-[calc(100lvh+60px)]">
  <Image fill className="object-cover" … />
  <div className="… pb-[calc(24px+var(--fluid-browser-bar)+var(--fluid-safe-bottom))]
      max-lg:supports-[-webkit-touch-callout:none]:pb-[calc(24px+var(--fluid-browser-bar)+var(--fluid-safe-bottom)+60px)]">…</div>
</section>
```

- 60px is slack, not a measurement: the shortfall varies by device and toolbar state, which is how
  the bug survives "correct" units. For a photo or video it is just more artwork below the fold.
- **The content must pad back the same 60px**, or bottom-anchored copy slides into the chrome.
- Scope it with `max-lg:`: it is a phone-chrome problem.
- **Pictures only.** A layout container that overshoots gains 60px of real, scrollable empty space.

## 6. Sticky: `overflow-x: hidden` and `transform` on an ancestor

`overflow-x: hidden` on an ancestor of a sticky element makes that ancestor a scroll container (the
other axis computes to `auto`) with zero scroll range. The sticky element resolves against it and
silently behaves as `static`. Use `overflow-x: clip` on ancestors: same clipping, no scroll
container. On `<html>` itself `hidden` is safe, since nothing above it can become an intermediate
scroll container; that is why the generated `base.css` puts the guard on `html`, never on `body`.

A `transform` (or anything else that creates a containing block) on an ancestor breaks sticky too.
**Never put `transform` or `overflow-x: hidden` on a sticky ancestor**; audit every ancestor. (Motion
code has a stricter form: nothing animates a transform on a sticky, scene or video ancestor.)

## 7. `maximumScale` vs. the 16px input rule

iOS Safari zooms the page when a focused input's font-size is under 16px, and stays zoomed after
blur. Two fixes that trade against each other; pick one and record which, so a later change doesn't
fix one regression by bringing back the other:

- **`maximumScale: 1`** in the viewport meta: one line, but it **disables pinch zoom everywhere**, a
  WCAG 1.4.4 failure. Some app-like sites choose it on purpose; it is an accessibility cost, not a
  neutral default.
- **`font-size: 16px` on every input, select and textarea**: removes the cause and keeps pinch zoom.
  Preferred when the design allows it.

Don't flip an existing choice without confirming which trade-off it solved.

## 8. Overscroll

`base.css` sets `overscroll-behavior: none` on the root, once for the whole page. With no body
background (§4), a rubber-band bounce would show the bare canvas past the page edge; `none` removes
it, and stops momentum past a boundary from feeding jitter into whatever reads scroll position for a
pin or a latch. Where a bounce still shows the root background on a device, colour it per page (§4),
not globally.

## 9. Hydration errors from Safari

**Data detectors.** iOS Safari wraps phone numbers, email addresses, addresses and dates in its own
links before React hydrates, so the DOM no longer matches the server HTML: hydration errors. Turn
detection off and write real links (`<a href="tel:+36…">`, `<a href="mailto:…">`):

```ts
// Next.js app/layout.tsx
export const metadata = {
  formatDetection: { telephone: false, email: false, address: false, date: false },
}
```

Without Next: `<meta name="format-detection" content="telephone=no, email=no, address=no, date=no">`.

**Reduced motion in markup.** A hook that reads `prefers-reduced-motion` on the first client render
(Motion's `useReducedMotion`, a bare `matchMedia`) differs from the server, which can't know it, so
markup branched on it fails hydration (a stat rendered its final value against the server's 0). Read
it with `useSyncExternalStore` and a server snapshot of `false`:

```ts
const QUERY = '(prefers-reduced-motion: reduce)'
const subscribe = (cb: () => void) => {
  const m = matchMedia(QUERY); m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}
export const usePrefersReducedMotion = () =>
  useSyncExternalStore(subscribe, () => matchMedia(QUERY).matches, () => false)
```

## 10. When the bug is not the page

- **A stale stylesheet.** After a CSS edit and a dev-server restart, a plain reload in Safari often
  runs against the cached stylesheet, and a pinned scene or a sized section looks broken while the
  code is fine. Rule it out first: the `--fluid-build` check and the fix (close the tab, `rm -rf
  .next`, restart) are in `verification.md` §6.
- **A dev-only overlay.** A development script that injects a fixed element (an inspector such as
  react-grab) can tint the Safari 26 toolbar in development only. Check a production build before
  chasing a toolbar tint.

## 11. Verification

- **Only a real device verifies the tint.** Emulation doesn't attempt Liquid Glass sampling at all,
  so "looks right in emulation" says nothing about the toolbar.
- **Confirm the deployed build contains the fix before a device test.** A minute of CDN or build
  delay is enough to test the previous deployment and get a false negative; this has cost real
  cycles. Check the asset hash or a visible marker first.
- Run the viewport matrix in `verification.md` (including a width well above the reference, e.g.
  2560) on any change to the scale or a full-height section: several bugs here only appear above the
  design width.

## Traps

- ★ Forcing `theme-color` + a body background is the superseded tint fix for ordinary pages; the
  policy is no forced tint (§3, §4). Edge strips are for full-viewport overlays only (§3b).
- ★ `100svh` on a full-bleed picture hero ends at the toolbar: size the box in `lvh`, pad the content
  back (§1, §5).
- ★ `overflow-x: hidden` or a `transform` on a sticky ancestor kills sticky (§6).
- `env()` in `calc()` with no fallback drops the whole declaration on an engine that doesn't know the
  token (§2).
- Per-component notch padding inside `fluid-container`: the container padding already clears it (§2).
- Removing only one of `theme-color` / the body background: the survivor still steers the tint (§3).
- The overshoot on a layout container, or without the 60px padback (§5).
- `maximumScale: 1` flipped without recording which trade-off it solved (§7).
- Phone numbers or emails left to Safari's detectors, or markup branched on a client-only
  reduced-motion read: hydration errors (§9).
- A restarted dev server with an open tab, or a dev-only overlay tinting the toolbar: not a page bug
  (§10).
- SVG traps (`<img src=*.svg>`, duplicate `clipPath` ids, `<g transform>`, width/height attributes)
  are in `media.md` §4.
