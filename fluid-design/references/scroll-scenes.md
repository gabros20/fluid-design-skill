# Scroll scenes

**Read when:** you're building a pinned/scrubbed section — a `position: sticky` layer whose content
changes as a function of scroll offset — or a scroll well that pulls a section to rest.
**Skip when:** the section is a plain triggered reveal (see `motion-architecture.md`) or you need
the video-decoder half of a scrubbed scene (see `video.md`, which this document cross-references
for the two clocks it shares with a scene).
**Depends on:** `fluid-scale.md` for `svh`/`lvh` and the viewport-fluid unit; `motion-architecture.md`
§3 for why a scroll scene is a deliberate promotion, not a default.

A scroll scene is the expensive, rare case — one per page in the reference build, against ~30
triggered sections. Every rule here earns its keep by having broken something first.

## Contents

1. [The pin pattern](#1-the-pin-pattern)
2. [Progress advances 1/(N−1) per viewport](#2-progress-advances-1n1-per-viewport)
3. [The latch: a discrete crossing with hysteresis](#3-the-latch-a-discrete-crossing-with-hysteresis)
4. [The three clocks](#4-the-three-clocks)
5. [A spring never feeds a threshold](#5-a-spring-never-feeds-a-threshold)
6. [The direct style write](#6-the-direct-style-write)
7. [The camera: reframing a scene per viewport](#7-the-camera-reframing-a-scene-per-viewport)
8. [The scroll well](#8-the-scroll-well)
9. [The header theme probe](#9-the-header-theme-probe)
10. [The attribute contract and reduced motion](#10-the-attribute-contract-and-reduced-motion)
11. [Traps](#traps)

## 1. The pin pattern

```tsx
<div ref={rangeRef}>                                        {/* the geometry source */}
  <div className="sticky top-0 h-[100lvh] overflow-hidden">…the pinned layer…</div>
  <div className="relative -mt-[100lvh]">{children}</div>   {/* sections ride over it */}
</div>
```

Three rules, each the fix for something that measured wrong:

- **Measure the OUTER div, never the sticky one.** A scroll-progress hook pointed at a sticky
  element *freezes* — by definition it stops moving relative to the viewport, so its own rect is
  useless as a ruler.
- **The negative margin exactly cancels the sticky child's contribution to wrapper height,** in the
  **same unit** as the pin. If the pin is `100lvh`, the margin must be `-mt-[100lvh]` — not `-100svh`
  and not a hardcoded px value. Left mismatched, the measured range comes out one toolbar-height
  taller or shorter than the content, and the pin overruns or underruns its own runway at the
  bottom.
- **Use `lvh` for the pin, not `svh`, and this is the one that bites on iOS.** `svh` is the viewport
  with the toolbar *shown* — but a scrub scene is read *while scrolling*, which is exactly when
  Safari collapses the toolbar and the visible area grows to `lvh`. A pin measured in `svh` is then
  shorter than the physical screen by the toolbar's height, and the page background shows through
  as a band along the bottom edge. `lvh` is the largest of the three units, so the pin always covers
  the screen; when the toolbar is showing it simply overhangs, and `overflow-hidden` absorbs that.
  Deliberately not `dvh` — that tracks the toolbar's live animation, so the pin (and every framing
  read inside it) would resize on every collapse, a layout thrash a scrubbed video is the worst
  possible surface for.

Flip side: **ordinary one-screen sections should use `svh`**, not `lvh` — see `ios-safari.md` for
why the pin and its sections deliberately use different units even though they sit in the same
scene, and `fluid-scale.md` §2 for why the fluid unit's own height arm is defined in `svh`.

Sticky is fragile to ancestor `overflow`, `transform` and containing blocks — audit every ancestor.
In particular: **no ancestor of a pin may carry `overflow-x: hidden`.** When one axis is set
non-visible, the other computes to `auto`, so the ancestor becomes a zero-range scroll container and
every sticky element inside silently behaves as `static`. Use `overflow-x: clip` instead — it
suppresses the same overflow without triggering that side effect. (`overflow-x: hidden` is safe on
the true document root, because nothing above it can turn it into an intermediate scroll container —
the trap is specifically an *ancestor between the root and the pin*.)

## 2. Progress advances 1/(N−1) per viewport

> With a pin, scroll progress (0→1 across the whole range) advances **1/(N−1) per viewport**, where
> N is the scene's total height in viewports.

Three 1-viewport children give N=3, so the landmarks fall on **halves**, and there is no middle
third at all — a natural mistake to make when reasoning "three acts, so thirds." Wanting thirds from
three acts means N=4: one act has to be two viewports tall. Get this wrong and a mode boundary that
should sit at 33% instead sits at 50%, which reads as "why does act two start halfway."

In px: `range = wrapper.offsetHeight - window.innerHeight`, measured into a ref via a
`ResizeObserver` (never state — this is read inside scroll handlers, and writing it during
measurement must cost no render). This is exactly what a `useScroll`-style progress hook divides by
to produce its 0→1 value, so every pixel tolerance below (§3) converts through this same number
rather than approximating it.

## 3. The latch: a discrete crossing with hysteresis

For mode changes, header theme flips, chapter activation, media handoffs. A state write per
**transition** is fine; a state write per **frame** is the ban this exists to prevent.

```ts
const modeRef = useRef<Mode>('head')
const [mode, setMode] = useState<Mode>('head')

onProgressChange((p) => {
  const { headExit, headEnter, tailEnter, tailExit } = boundsFromRangePx(rangePxRef.current)
  const current = modeRef.current
  let next = current
  if (current === 'head' && p > headExit) next = 'scrub'
  else if (current === 'scrub' && p < headEnter) next = 'head'
  else if (current === 'scrub' && p > tailEnter) next = 'tail'
  else if (current === 'tail' && p < tailExit) next = 'scrub'
  if (next !== current) { modeRef.current = next; setMode(next) }   // ref updates first — handlers must not wait for a render
})
```

Two thresholds per boundary, never one — the value that *enters* a mode is never the value that
*leaves* it, so a scroll stopping dead on the boundary, or a trackpad jittering across it, cannot
flap the mode.

**Tolerances in px, hysteresis as a ratio of the tolerance — not a second absolute constant:**

```ts
const LOOP_TOLERANCE_PX = 100          // the number you actually tune
const LOOP_HYSTERESIS_RATIO = 0.7      // NOT a second px constant
```

Px rather than a progress fraction, because a fraction is a different physical distance on every
viewport height — a hold that reads as 100px on a laptop reads as 160px on a tall monitor at the
same fraction. Convert through the measured range (§2).

Hysteresis as a *fraction* of the tolerance, because as two independent absolute constants they can
be set into an invalid pair. Shipped once as a 140px hysteresis against a 200px tolerance; dropping
the tolerance to 100px later made the re-entry threshold **negative** — unsatisfiable by any scroll
position, so the loop it gated simply never came back on scroll-up. Tied to the tolerance, the pair
stays valid by construction: whatever the tolerance is retuned to, `0.7 ×` it is always a smaller,
positive number.

The general rule, worth carrying past this one case: **when two constants must maintain a
relationship, express one in terms of the other.** An invariant you cannot violate beats an
invariant you have to remember to keep true.

## 4. The three clocks

```
scroll (raw)    → machines, latches, thresholds, velocity        — exact, unsprung
scroll (lagged) → visuals                                        — spring-smoothed
media           → anything that's a function of what is RENDERED — the decoder's own playhead
```

The first two are a standard scroll-scrubbing idea made explicit (GSAP's `scrub: 0.5` lags tweens
while `onEnter` still fires on the true position). The third is the one that surprises:

> **Anything whose correct value is a function of what is on screen must read the thing on screen,
> not the thing driving it.**

In a scrubbed video scene the playhead *glides* toward its scroll target rather than jumping to it
(see `video.md` §Glide), and during either end loop scroll is static while the render keeps cycling.
Anything cosmetic that should track the picture — a letterboxed gutter colour, a camera's tracking
offset — has to read `video.currentTime`, not scroll progress, or it visibly desyncs from what's on
screen during exactly the moments (loops, handoffs) it most needs to agree. The general shape:
**scroll owns the composition, the render owns the correction.**

## 5. A spring never feeds a threshold

A smoothed value *settles across* a boundary rather than landing on it, so `value >= threshold`
flips true, false, true as it rings down past the line. Machines and latches read **raw**, unsprung
progress. Always — no exceptions for "it's a small spring."

## 6. The direct style write

> **Anything scroll-linked that sits over a pin must be written by hand, not bound through a
> declarative animation library's `style` prop.**

The obvious version — binding a scroll-derived value straight into `style={{ opacity }}` — was
**broken** in the reference build, and the failure is worth reproducing in full because it's
invisible by inspection.

**The bug.** A copy layer sat under a `-mt-[100svh]` overlapping a sticky sibling (the pin), and its
opacity was bound to a scroll-derived value through the animation library's declarative `style`
prop. The library promoted that scroll-linked property to a **native, hardware-accelerated browser
timeline** where it could — measured with `getAnimations()`, this produced a real, running WAAPI
animation:

```
offset 0.10 → opacity 1
offset 0.35 → opacity 0        duration 1000ms, fill both, running
```

The keyframes were correct. But the browser's own native view-range for that element **did not
agree with the progress the JS scroll math computed**, precisely because the element sat under the
pin's negative margin — the two agreed while the fade was descending, then diverged past the fade's
end: the native timeline ran *backwards* there, and the copy faded back in, over the render it
existed to hide. The JS value was correct throughout; only the accelerated path disagreed with it.

**The fix.**

```ts
const ref = useRef<HTMLDivElement>(null)
const { scrollYProgress } = useScroll({ target: ref, offset: EXIT_OFFSET })

onProgressChange((p) => {
  const el = ref.current
  if (!el || reduced) return
  el.style.opacity = String(compute(p))
})

// first paint has no scroll event to react to
useEffect(() => { ref.current?.style.setProperty('opacity', String(compute(scrollYProgress.get()))) }, [])

return <div ref={ref}>{children}</div>   // NOT the library's animated element — nothing is bound
```

It costs one style write per scroll frame on one node, which is what the bound version cost anyway —
the fix is not more expensive, it's just not delegated.

**Three rules travel with this pattern:**

- **Quantise the write** when it feeds something coarse. A colour rounding to 1/256 is finer than
  8-bit colour can express, so a frame that would repaint identical values costs nothing once
  quantised and compared before writing.
- **A declarative binding and a manual writer may share a node, but never a property.** A
  declarative library typically only manages the keys present in its own `style` prop, so
  `style={{ '--frame-w': … }}` alongside a hand-written `style.transform` is safe — but passing
  `transform` in that prop *and* writing it by hand is not: the next re-render clobbers the manual
  write, and the re-render that does it will be something innocent, like a mode change three steps
  away from the code that broke.
- **Reduced motion is now the writer's job** — see `motion-architecture.md` §11. A global
  reduced-motion config degrades declarative *animations*; it cannot reach a value the app writes by
  hand.

Outside a pin, binding through a declarative animation API is still correct and still preferred.
The trap is specifically a scroll-linked value on an element whose native accelerated view-range can
disagree with the measured one, and sitting under a pin's negative margin is how that disagreement
happens.

## 7. The camera: reframing a scene per viewport

A phone is not a small desktop. A composition framed for a 1440px laptop reads tiny at 402px, and
the correct mobile treatment is often a **different crop of the same asset**, not a shrunk version
of the desktop animation.

Express it as shots, not as pixels:

```ts
const SHOTS = {
  head: { zoom: 1,     subject: [0.5862, 0.4791], at: [0.649, 0.604] },
  tail: { zoom: 0.851, subject: [0.4833, 0.4984], at: [0.723, 0.429] }
}
// x = at.x · containerWidth − subject.x · displayedWidth
// (same for y)
```

`subject` is a point **inside the asset**, normalised, constant per render. `at` is where that point
should land **inside the container**, normalised — that's the art direction, and the decomposition
is what makes the whole thing viewport-general and reviewable: "the card's centre goes at 65%
across, 60% down" is a sentence a designer can confirm without reading code.

Three rules fall out:

- **Two shots, not one crop.** The start and end frames of a designed sequence essentially never
  share a crop. Interpolating `{zoom, subject, at}` on scroll lands on both exactly and produces a
  pull-back-and-pan for free — a fixed crop can only ever satisfy one end.
- **Drive the zoom by viewport HEIGHT, not width.** Phones vary far more in aspect ratio than in
  height. A width-driven zoom tuned at a phone's width puts the subject several tablet-widths across
  on a tablet; a height-driven zoom gives the same composition at both aspects, and "tablet" stops
  needing to be a special case.
- **CSS owns width and height; JS writes only a transform.** No scroll frame may cost layout — size
  the box in CSS (a `max()`/`calc()` expression against `svh`, per `fluid-scale.md`'s convention),
  and let the per-frame write be a single composed `transform` string (§6's direct-write pattern),
  never a change to `width`/`height`.

Where the composition asks for more render than the crop physically has on a wide window, clamp the
zoom to whatever keeps the asset's own canvas edges off-screen — take the *max* of the designed zoom
and the coverage-forcing zoom on each axis, so the composition is honoured wherever there's room and
only the scale gives way where there isn't; the subject still lands exactly where the shot puts it.

A camera that also needs to *track* a subject moving inside its own footage (rather than just pan
between two static shots) is covered in `video.md`'s reframing recipe — store the *drift* from a
straight interpolation between the two shots, not the raw path, so both endpoints stay exactly on
the designed frames by construction and a tracking term can never pull the composition off them.

## 8. The scroll well

A continuous attractor — call it a scroll well — nudges the page a fraction of the way toward
resting on one box, every frame, for as long as it's "engaged." It is a materially different
mechanism from scroll-snap or a momentum-handoff spring, and the reasons those two were tried and
rejected are worth keeping:

- **Native CSS scroll-snap**'s proximity radius is UA-defined and nowhere near a useful trigger
  distance, and its settle is a UA-paced dart the page has no control over.
- **A spring fired once at a threshold crossing** needs velocity tracking, absorb/veto budgets,
  deviation detection and a rest-detection override to avoid reading as "the page waits for you to
  stop, then grabs you" — a discrete animation fired at a discrete moment is exactly that, however
  well-tuned.

**Gravity, not a snap** is the actual model. There's no trigger moment and no animation with a start
and an end — a running well simply attracts the scroll for as long as its owner (typically an
`IntersectionObserver` on the target) keeps it running. The nudge is **additive**: each frame reads
the current scroll position as-is (visitor input already applied) and writes `position + step`, so
the well can never overwrite, cancel or out-argue a scroll — it only ever adds a little on top. A
creeping arrival is helped along at a creep's pace; there's no moment where the page "settles, then
snaps," because the pull was already running the whole way in.

**The visitor always wins, by one rule instead of five.** Motion the well did *not* write is the
visitor's; enough of it directed away from rest (past a small threshold) releases the well for the
rest of the visit, and motion toward rest pays that meter back down. One exception: a flicked
arrival's inertia tail coasts past rest with nobody's hand on it, which the arithmetic above reads
as "away" motion. The well forgives **one overshoot per visit** — a release followed by a short
quiet period, close to rest, resumes the pull, because that's an arrival that never quite landed,
not a decision to leave. Once the target has actually come to rest, that forgiveness is spent:
every later departure is read as a decision, never argued with again.

**The band rule — one rest state, or an interval of them.** A target that *fits* the viewport has
exactly one position worth resting at: centred. A target that does *not* fit has a whole band of
equally-valid rest positions — anywhere from "its top at the viewport top" to "its bottom at the
viewport bottom" shows the target and nothing else, and there's no principled reason to prefer one
over another. So: inside that band the well produces zero error and does nothing; outside it, it
reaches for the nearer edge. This one expression covers "sections that fit" and "sections taller
than the viewport" without asking which breakpoint it is, and it resolves a real conflict a flat
"centre it" or "top-align it" both fail: centring an overflowing target can slice its own top line
off-screen; a flat top-align fixes arriving downward and breaks arriving upward, hauling the reader
back to the top of a section they scrolled up *away* from on purpose.

**Clamping to the pin.** A scroll well pointed at a target *inside* a pinned scene must be bounded
to that scene's own scroll range, or a target shorter than the viewport asks to rest at a scroll
position **outside the pin entirely** — a strip of the previous section showing over the render,
which is not a composition anyone designed. Clamped correctly, the well's two extremes land exactly
on the pin's progress-0 and progress-1, which *are* the designed rest states, at every viewport.

**The viewport height is a snapshot, not a live read — this is the one iOS-specific piece.** iOS
collapses its toolbar *while* scrolling, which changes `window.innerHeight` without changing
anything about the layout a target's rect is measured against. Read live, the attractor's target
moves under the pull — and worse, a well scrolling *up* re-reveals the toolbar, which shrinks the
viewport, which moves the target up again: a feedback loop. Capture the height once per visit and
refresh it only on a resize that clearly isn't the toolbar (a width change, or a height change too
large to be chrome — roughly a quarter of the viewport height is a reasonable cutoff). This is the
same problem `lvh`/`svh` solve for layout geometry (§1), applied to the well's own arithmetic.

Every distance the well reasons about should be expressed on the site's fluid scale unit
(`fluid-scale.md`), not as a flat px constant — a flat px threshold silently means a different
*fraction* of the composition as the window shrinks, which is what makes a well that forgives
generously at one size hold rigidly at another. What deliberately stays absolute: a rest-threshold
epsilon (a "closer than anyone can see" fact about screens, not a length in the composition) and any
duration in milliseconds (a gesture doesn't get faster because the window is shorter).

`behavior: 'instant'` on every write the well makes is load-bearing wherever the page also sets
smooth-scroll behaviour globally (`ios-safari.md`, `performance.md`) — left to a smooth default,
every frame of the well's own loop would queue a new smooth animation against the one before it.

**Trap: that same `instant` write cancels a smooth scroll the well did not start.** `instant`
protects the well's OWN writes from a page-wide `scroll-behavior: smooth`, but it does nothing for
the reverse case — a header anchor link, a router hash jump, or any other programmatic
`scrollTo`/`scrollIntoView` that happens to pass through the well's target gets cancelled one rAF at
a time by the well's per-frame writes, and never arrives. Measured: a "Menu" anchor click from the
top of the page landed 900px short of its target, every time, because a scroll well sat between the
click and the destination. The same mechanism made a headless verification harness's stepped
`scrollTo` calls stall partway down the page — every cell below the well read as a reveal failure
that had nothing to do with `IntersectionObserver` (see `verification.md`'s note on
`verify-matrix.mjs --reveal`).

The fix is to suspend the well's writes — not the loop, which still has to keep watching for the
away-meter and reclaim logic to stay correct — for the duration of any scroll it did not initiate.
Both engines' `scrollPull` expose `suspend(ms?)` on the returned controller for a caller that is
about to drive its own scroll, and call it automatically from two listeners registered in capture
phase: a `click` on `a[href^="#"]` or any same-path hash link, and `hashchange`. The suspension
clears on the earlier of a `scrollend` event or a fallback timeout (Safari does not fire `scrollend`
as of this writing), so it never outlives the scroll it was covering for.

`scripts/audit.mjs`'s `scroll-well-vs-smooth-scroll` rule flags (informationally, not as an error) a
project that uses a scroll well alongside a page-wide `scroll-behavior: smooth` — a reminder that the
two automatic listeners cover anchor clicks and `hashchange` only; a router navigation or an
imperative `scrollIntoView` outside a click handler still needs an explicit `suspend()` call around
it.

## 9. The header theme probe

A `fixed` header that paints no background of its own — floating over whatever section is currently
underneath it — needs to know that section's declared ink colour (light or dark) continuously as the
page scrolls, so its own text can invert.

The natural instinct is an `IntersectionObserver` shrunk to a band at the header's own height. It
doesn't work cleanly: `rootMargin` takes no `calc()`, so that band has to be computed from
`window.innerHeight` and the observer rebuilt whenever it changes — which on mobile is *every time
the URL bar collapses*.

**Subscribe to scroll instead.** Measure every themed section's vertical extent once, into document
coordinates, and re-measure only on resize (a `ResizeObserver` on `document.body` catches viewport
changes, font swaps, images settling and accordions opening — more reliable than a bare resize
listener, which misses content reflow). A scroll frame then costs a handful of numeric comparisons
against those cached bands — no DOM read, and it's exact at every scroll offset with nothing to
rebuild.

```ts
const probe = header.offsetTop + header.offsetHeight / 2   // offsetTop/offsetHeight: layout
                                                              // metrics, immune to an entrance
                                                              // transform still running on the
                                                              // header at first paint — a rect
                                                              // read there would probe too high
function resolve(scroll: number) {
  const y = scroll + probe
  let next = base
  for (const band of bands) if (y >= band.top && y < band.bottom) next = band.theme  // last match wins
  setTheme(prev => prev === next ? prev : next)   // write only on an actual change
}
```

Write React/framework state only when the resolved theme **changes** — a handful of times per page
load, not per scroll frame — which keeps this inside the "state per transition, not per frame" rule
(§3). Sections declare their theme with a data attribute (`data-header-theme="dark"`) that a
per-breakpoint CSS custom property can override, so a section that's dark from one breakpoint and
light below it needs no JS branch — just a class.

## 10. The attribute contract and reduced-motion structural collapse

A scroll scene's range wrapper, pin, content wrapper, mode machine and reveal groups all carry the
same small set of data attributes documented in `references/attribute-contract.md` (`data-scrub-stage`,
`data-scrub-pin`, `data-scrub-content`, `data-scrub-spacer`, `data-motion-state`, `data-header-theme`,
etc.) — these exist so the verification harness (`verification.md`) and a debug-marker stylesheet can
hook the DOM without touching layout, and so the two animation engines expose an identical shape to
tooling regardless of which one drives them.

**Reduced motion's structural half lives in the base stylesheet, not in component logic:**

```css
@media (prefers-reduced-motion: reduce) {
  [data-scrub-stage]   { height: auto !important; }
  [data-scrub-pin]     { position: static !important; height: 100svh !important; overflow: visible !important; }
  [data-scrub-content] { margin-top: 0 !important; }
  [data-scrub-spacer]  { height: 0 !important; }
}
```

Without this, a visitor who asked for less motion still gets the full multi-viewport runway and a
released pin: several viewports of scrolling past a now-static composition, which is worse than the
motion it replaced. A plain media query is deliberate rather than `motion-reduce:`-style utility
classes — those collide with the pin's own responsive utilities at equal specificity, so which one
wins becomes an accident of build output order; a media query doesn't care about order.

`!important` on every declaration is required, not decorative — see `attribute-contract.md`'s
`data-scrub-pin` entry: the React port writes the pin's sticky geometry as an inline `style`, which
beats any non-`!important` stylesheet rule regardless of selector specificity or source order.

**`[data-scrub-pin]` collapses to `100svh`, not `auto`.** The pin holds the settled frame under
reduced motion — the head loop's first frame, camera frozen — and that frame is an
absolutely-positioned `<video>` inside the pin. `height: auto` on a box whose only content is
absolutely positioned measures to **zero**, since an out-of-flow descendant contributes nothing to
its parent's auto height: the reduced-motion state that is supposed to show the settled shot instead
collapses to an empty strip. `100svh` gives the pin the box the frame was actually framed for.

**Mark any empty pacing act with `data-scrub-spacer`.** A scene sometimes includes an act with no
camera move and no copy of its own — added purely to give the full-motion composition room to
linger on a beat. Under reduced motion there is nothing left in it worth scrolling through, so it
must collapse to zero height rather than leaving that runway behind as dead space — measured: an
unmarked 2-viewport spacer left 1800px of empty dark band a reduced-motion reader had to scroll past
for no reason. Neither engine infers this automatically; a spacer act has to be marked by hand.

## Traps

- ★ **`overflow-x: hidden` on an ancestor kills every sticky pin below it** — the non-visible axis
  makes the other compute to `auto` (§1). Use `clip`.
- ★ **Measuring the sticky element instead of the range wrapper freezes the progress value at 0**
  (§1) — it never moves relative to the viewport by definition.
- ★ **Three 1-viewport acts in a pin give halves, not thirds** (§2).
- ★ **A bound scroll-linked value over a pin can be promoted to a native accelerated timeline whose
  range disagrees with the JS progress math** — write it by hand instead (§6).
- ★ **A spring feeding a threshold test** rings true/false/true on settle (§5).
- ★ **Two hysteresis/tolerance constants set independently can drift into an invalid pair** — tie
  one to the other as a ratio (§3).
- A fresh offset array/object literal built per render resubscribes the scroll listener — use a
  module-level constant.
- `position: sticky` creates a stacking context; `position: relative` without a `z-index` does not —
  a load veil or overlay pinned above the header can get trapped under a sticky ancestor's stacking
  context this way.
- `content-visibility: auto` inside a scroll scene's runway zeroes the geometry the scene measures —
  it belongs only on below-fold *flow* sections, never inside or around a pin (`performance.md`).
- A scroll well pointed at a target with no `clamp` inside a pinned scene can ask to rest at a
  scroll position outside the pin's own range (§8).
- Reading `window.innerHeight` live inside a scroll well's arithmetic on iOS creates a feedback loop
  with the collapsing toolbar (§8).
- Writing header-theme state every scroll tick (instead of only on an actual change) reintroduces
  the "state per frame" cost this pattern exists to avoid (§9).
