# iOS Safari: render fixes

**Read when:** anything full-height, sticky or edge-to-edge is about to ship, or a device report
says "it looks wrong on iPhone."
**Skip when:** the change is desktop-only and doesn't touch layout. SVG rules live in `media.md`;
anything that moves (a pin's scroll maths, video playback, a mask sweep) lives in the
`scroll-animation` skill, `references/ios-safari-motion.md`.
**Depends on:** `performance.md` for the render budget; `fluid-scale.md` §3 for why the scale's
height arm is `svh`.

Chrome DevTools' device emulation **cannot** reproduce most of what's in this document — several of
these are Safari/WebKit sampling and rendering behaviours with no emulated equivalent. Verify on a
real device or the matching iOS Simulator; see `verification.md` §3–§4.

## Contents

1. [`svh` vs `lvh` vs `dvh`](#1-svh-vs-lvh-vs-dvh)
2. [`--browser-bar` and safe areas](#2---browser-bar-and-safe-areas)
3. [The iOS 26 toolbar tint — current policy and what's superseded](#3-the-ios-26-toolbar-tint--current-policy-and-whats-superseded)
4. [No body background, no forced theme-color](#4-no-body-background-no-forced-theme-color)
5. [The hero overshoot](#5-the-hero-overshoot)
6. [Sticky: `overflow-x: hidden` and `transform` on an ancestor](#6-sticky-overflow-x-hidden-and-transform-on-an-ancestor)
7. [`maximumScale` vs. the 16px input rule](#7-maximumscale-vs-the-16px-input-rule)
8. [Overscroll / rubber-band](#8-overscroll--rubber-band)
9. [The stale stylesheet](#9-the-stale-stylesheet)
10. [Verification discipline](#10-verification-discipline)
11. [Traps](#traps)

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

**Ordinary one-screen sections, and the fluid scale's own height arm (`fluid-scale.md` §3), stay on
`svh`** — a scroll mid-gesture must not resize their type. A pinned scene's sticky box is the
exception and uses `lvh` with a matching `lvh` negative margin: see the `scroll-animation` skill,
`references/scroll-scenes.md` §The pin pattern. `dvh` is right for almost nothing in this system: it
tracks the toolbar animation live, which is a layout thrash on exactly the surfaces (a pinned
render, a scaled type ramp) that can least afford one.

**`svh` did not hold still on iOS Safari 16.4–17.3.** WebKit bug 261185: with the tab bar hidden,
`svh` computed like `dvh`, so everything sized in `svh` (the fluid height arm included) resized as the
toolbar collapsed. Fixed in Safari 17.4 (March 2024; WebKit commits 270516, 270652). The choice of
`svh` still stands, since `dvh` moves on every version, but a report of "type resizing while I scroll"
from an older iPhone is this bug, not the code. Check the iOS version before debugging.

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

A full-viewport sticky **pinned scene** is a different case with a device-verified negative result
(do not re-chase it): see the `scroll-animation` skill, `references/ios-safari-motion.md`.

## 4. No body background, no forced theme-color

Restated as a standalone rule because it's easy to reintroduce by accident while fixing something
unrelated: under the current policy (§3a), **nothing** paints a global `body`/`html` background and
**nothing** sets a global `theme-color`. If a future change needs the toolbar tinted for a specific
route or section again, reach for the scoped overlay pattern (§3b) or a per-route/per-section CSS
variable driven by whatever already resolves the page's dominant colour (a header-theme probe, if
the `scroll-animation` skill installed one, is a natural signal to reuse) — never reintroduce a
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

## 6. Sticky: `overflow-x: hidden` and `transform` on an ancestor

Specifically an iOS-flavoured trap in practice (sticky sidebars, sticky rails on content pages are
where it's usually discovered), and the one render rule every pinned layer depends on.

`overflow-x: hidden` on an *ancestor* of a sticky element makes that ancestor a scroll container
with zero scroll range on the visible axis: when one axis is set non-visible, the other computes to
`auto`. The sticky element resolves against that zero-range container instead of the real one — it
silently behaves as `static`. Use `overflow-x: clip` on ancestors; it suppresses the same overflow
without the side effect. A root-level `overflow-x: hidden` on `<html>` itself is safe, because
nothing sits above it to be turned into an intermediate scroll container — the trap is specifically
an *ancestor between the root and the sticky element*. That is why the generated `base.css` — written
into your fluid output folder (`output.dir`) by `fluid generate`, and imported by `fluid.css` as
`layer(base)` when `output.base` is on — puts the guard on `html` and never on `body`.

Sticky is also fragile to ancestor `transform` and to anything else that creates a containing block
— audit every ancestor. **The render-safe sticky rule: never put `transform` or `overflow-x: hidden`
on a sticky ancestor.** (The stricter animation form, "nothing animates a transform on a sticky,
scene or video ancestor", is the `scroll-animation` skill's.)

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

## 8. Overscroll / rubber-band

`overscroll-behavior: none` on the root element kills the rubber-band/elastic overscroll effect at
scroll boundaries. The render reason, which is this skill's: with no `body` background (§4), a
rubber-band bounce would expose the bare canvas past the page edge as a gap; `none` removes it. The
second reason (momentum bouncing past a boundary feeds jitter into whatever reads scroll position
for a pin or a latch) is the `scroll-animation` skill's. This is a global layout decision, not a
per-component one — set it once on the document root (`base.css` does).

## 9. The stale stylesheet

**This is almost always the actual cause of "the scroll-driven video/pin is broken" or "the layout
lost its sizes" reports, and it's worth checking before touching any scrub or layout code.** A dev server pushes CSS over its HMR socket;
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

## 10. Verification discipline

- **Only a real device verifies tint.** Chrome DevTools' device emulation cannot reproduce iOS 26's
  Liquid Glass sampling — not "reproduces it imperfectly," genuinely does not attempt it. A build
  that "looks right" in emulation says nothing about the actual chrome tint.
- **Confirm the deployed chunk contains the fix before asking for a device test.** A CDN/build
  propagation delay of even a minute is enough for a device test to run against the *previous*
  deployment and produce a false negative — this specific failure mode (testing a build that didn't
  yet contain the fix) has cost real cycles. Check the deployed asset hash or a visible marker before
  handing a device over for testing.
- Run the viewport matrix in `verification.md` (including the well-above-reference width, e.g.
  2560px) on any change to the fluid scale or a full-height section's geometry — several of the bugs in this
  document are invisible at or below the design reference width and only appear once a viewport
  exceeds it.
- Device discipline for video compositing and scroll behaviour (play watchdog, toolbar-collapse
  feedback into scroll maths) is in the `scroll-animation` skill, `references/ios-safari-motion.md`.

## Traps

- ★ Forcing `theme-color` + a body background is the *superseded* iOS 26 tint fix for an ordinary
  page — the current policy is no forced tint at all (§3, §4). The strips pattern is still correct,
  but scoped to full-viewport overlays only (§3b).
- ★ `100svh` on a full-bleed picture/video hero ends at the toolbar, not the physical screen —
  size the box in `lvh`, pad the content back (§1, §5).
- ★ `overflow-x: hidden` (or a `transform`) on an ancestor of a sticky element kills its stickiness (§6).
- `env()` inside `calc()` with no fallback drops the whole declaration on an engine that doesn't
  recognise the token — always write the fallback (§2).
- Removing only one of `theme-color` / the body background: the survivor still steers the tint (§3).
- The iOS overshoot applied to a plain layout container, or without the matching 60px padback (§5).
- `maximumScale: 1` flipped in or out without recording which trade-off it solved (§7).
- A restarted dev server plus an already-open tab is stale CSS, not a scroll-math or layout bug —
  check `getComputedStyle` before debugging (§9).
- SVG traps (`<img src=*.svg>`, duplicate `clipPath` ids, `<g transform>`, width/height attributes)
  are in `media.md` §SVG.
