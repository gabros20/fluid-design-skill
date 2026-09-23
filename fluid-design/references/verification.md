# Verification

**Read when:** you've built or changed a scroll scene, a fluid-scale value, or anything else that
needs checking across viewports rather than at one window size.
**Skip when:** the change is a static, non-responsive tweak with no scroll or viewport dependency —
a plain visual diff is enough.
**Depends on:** `scroll-scenes.md` for what a scene's "progress" means as a value to drive
programmatically; `ios-safari.md` §15 for the stale-stylesheet check this document's Tier 1 assumes
you've already ruled out.

Three tiers, cheapest and most automatable first. The order matters: a bug tiers 1–2 can catch
should never wait for tier 3, because a real device is the scarcest resource in this list.

## Contents

1. [Tier 1 — the scripted browser harness](#1-tier-1--the-scripted-browser-harness)
2. [The three bugs it caught](#2-the-three-bugs-it-caught)
3. [Tier 2 — marker CSS](#3-tier-2--marker-css)
4. [Tier 3 — a real device](#4-tier-3--a-real-device)
5. [The viewport matrix](#5-the-viewport-matrix)
6. [The stale-stylesheet probe](#6-the-stale-stylesheet-probe)
7. [The scripts](#7-the-scripts)

## 1. Tier 1 — the scripted browser harness

This is the tier that actually finds bugs. An earlier, more elaborate approach — hundreds of lines
of in-browser dev tooling (a timeline scrubber panel, live spring sliders, a driver registry shipped
to production to feed a debug UI) — was built, shipped, and never caught a single bug before being
deleted. What replaced it, and what does catch bugs, is much smaller: **driving a real headless
browser from a script and reading numbers out of it.**

**Scroll to a scene's *progress*, never to a raw pixel offset** — pixel offsets rot the moment
content above the scene changes height, while progress (0→1 across the scene's own measured range)
stays meaningful regardless of what's above it:

```js
const base = await page.evaluate(() => {
  const s = document.querySelector('[data-scrub-stage]')
  return { top: s.getBoundingClientRect().top + scrollY, range: s.offsetHeight - innerHeight }
})
for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
  await page.evaluate(y => scrollTo(0, y), base.top + base.range * progress)
  await page.waitForTimeout(2500)                 // let any glide/spring settle — see below
  await page.screenshot({ path: `sweep_${progress}.png` })
}
```

The `waitForTimeout` matters: a value that's still gliding toward its target (`scroll-scenes.md`'s
handoff pattern, `video.md`'s playhead glide) needs real time to settle before a screenshot means
anything — a couple of seconds is enough for the exponential approaches this system uses, which
converge to sub-visible error well before that.

**Then tile the screenshots into one contact sheet.** A composition problem that's arguable staring
at one frame is obvious laid out across five or six side by side — this alone catches "the reveal
plays too early relative to arrival" faster than stepping through individually, because the eye
compares neighbours automatically.

**Read state, not just pixels.** `getAnimations()`, a computed `style.transform`, `offsetWidth`,
`getBoundingClientRect()`, a video's `currentTime` — these turn "it looks a bit off" into a specific,
falsifiable claim: "`offsetWidth` is 402 where it should be 1128." Every real bug found this way (§2)
was found by reading one of these, not by looking harder at a screenshot.

## 2. The three bugs it caught

Concrete, because "measure state, not pixels" is abstract until you see what it actually found:

| Symptom | Cause | Found by |
| --- | --- | --- |
| Copy faded out, then faded back in | A scroll-linked value had been promoted to a native accelerated timeline whose range disagreed with the JS scroll math (`scroll-scenes.md` §6, the WAAPI-promotion bug in full) | `getAnimations()` showed a real, running native animation with keyframes at the component's declared range — visible nowhere in source |
| A stat grid sat permanently invisible | A `display: contents` wrapper generates no box, so the `IntersectionObserver` watching it had nothing to observe and the reveal never fired | Computed style plus a direct IO check — invisible from reading the component's JSX, which looked entirely correct |
| "Animates too early and too fast" | The trigger fired at roughly a third of the element visible and settled hundreds of pixels before the element had actually arrived | Scripted scroll plus screenshots at fixed progress steps — not reproducible by scrolling manually at normal speed |

None of the three were visible from reading the source code in isolation. All three were found in
minutes once the harness existed.

## 3. Tier 2 — marker CSS

A small (order of ~90 lines), zero-JS stylesheet toggled by one attribute on the root element, so it
works with no dev panel open, survives a plain screenshot, and works over a USB-connected real
device with no extra tooling:

```css
:root[data-motion-debug~='markers'] [data-scrub-stage]        { outline: 1px dashed #f59e0b; }
:root[data-motion-debug~='markers'] [data-stage]               { outline: 1px solid  #34d399; }
:root[data-motion-debug~='markers'] [data-motion-state='head'] { outline-color: #22c55e; }
:root[data-motion-debug~='markers'] [data-scroll-video],
:root[data-motion-debug~='markers'] [data-scroll-video] *      { outline: 2px solid #ef4444; }
```

A machine's mode attribute (`data-motion-state` in the attribute contract, `references/attribute-contract.md` §3) is written
only **on transition**, not per frame, so a mode flipping is visible as a discrete colour change with
nothing else open — exactly the observability this needs, at the cost this system otherwise polices
against (`scroll-scenes.md` §3's "state per transition, not per frame" rule pays for this for free).

**If this tier is ever extended, the rule that keeps it safe is: the tool must not change what it
measures.** No `border` (changes box size, which changes exactly the geometry being debugged), no
`position: relative` added purely to anchor a label (creates a stacking context that didn't exist
before), no wrapper elements (changes the DOM structure a sticky/pin calculation depends on), no
`overflow: hidden` (kills sticky — `scroll-scenes.md` §1, `ios-safari.md` §6). Outlines only, because
`outline` is the one visual debug affordance that never participates in layout.

## 4. Tier 3 — a real device

Connect a physical phone, hit a dev server by local IP, use the browser's own remote-debugging
console. Nothing substitutes for this — not device emulation, not a simulator for the specific class
of bug `ios-safari.md` documents (toolbar tint sampling has no emulated equivalent at all) — and it
remains, in practice, the least-frequently-done step of the three, precisely because it's the most
friction. Budget for it deliberately rather than treating it as optional polish: several of the bugs
in `ios-safari.md` were *only* ever reproducible this way.

Two device-testing disciplines worth stating explicitly, because both have cost real cycles when
skipped:

- **Confirm the deployed build actually contains the fix before asking for a device test.** Build/CDN
  propagation lag is enough for a device test to run against the previous deployment and produce a
  false negative that reads as "the fix didn't work."
- **A tint/chrome-sampling result is never trustworthy from anything but the physical device class it
  claims to fix** — a fix verified on one iOS version is not verified on another if the underlying
  WebKit sampling behaviour changed between them (`ios-safari.md` §3b's WebKit-bug caveat is the
  concrete example).

## 5. The viewport matrix

Never verify a fluid-scale or scroll-scene change at a single window size — several of the bugs in
`fluid-scale.md` (§4.1, §4.2) and `ios-safari.md` are invisible at or below the design reference
width and only appear once a viewport exceeds it. Sweep a matrix, not a line:

- **Widths:** 1024 / 1280 / 1440 / 1680, plus **one width well above the reference — 2560.** The
  2560 row specifically exists because several drift bugs (a frozen gutter, a frozen grid-column
  minimum) are exactly zero at and below the reference width and only accumulate past it.
- **Heights:** 640 / 700 / 800 / 900, crossed against the widths above.

At each cell, check: nothing overflows, no heading's line count changes unexpectedly, and the design
reference cell (1440×900, or whatever a project's `fluid.config.json` reference is) renders
pixel-identical to the drawn frame.

## 6. The stale-stylesheet probe

Before debugging any scroll/pin behaviour that "suddenly broke," rule out a stale stylesheet first —
full mechanism and fix in `ios-safari.md` §15. The one-line check:

```js
getComputedStyle(document.documentElement).getPropertyValue('--fluid')
```

A fresh, well-formed value (matching current source) means the stylesheet is current — keep
debugging the actual scroll/pin logic. An empty string, or an older/different form of the same
expression, means stop: close the tab, open a fresh one, and only resume debugging application logic
if the symptom survives that.

## 7. The scripts

Three companion scripts (written alongside this skill, referenced here by intent rather than by a
frozen flag list — check each script's own `--help` for the current surface):

- **`scripts/verify-matrix.mjs <url> --reveal --screens --fit-selector`** — drives the viewport
  matrix (§5) against a running dev server, capturing a contact sheet per viewport. `--reveal` steps
  through a scene's progress the way §1's snippet does; `--screens` controls which matrix cells run;
  `--fit-selector` targets the element whose fit against its design frame is being checked (the
  pixel-identical-at-reference assertion in §5).
- **`scripts/probe.mjs <url>`** — a single-viewport, single-pass version of the same read-state
  discipline in §1: dumps computed custom properties, key element rects and any scene's current
  mode/progress for one URL, useful as a fast sanity check between matrix runs.
- **`scripts/audit.mjs <dir>`** — runs after a matrix capture, scanning the resulting screenshots/
  data for the drift signatures `fluid-scale.md` documents (a grid column count that changed between
  adjacent matrix cells, an element that overflowed its frame) rather than requiring a human to
  eyeball every contact sheet.
- **`scripts/calc.mjs table|px|budget`** — a standalone calculator for the fluid-scale arithmetic
  itself: `table` prints the resolved factor at a set of reference viewports (the kind of table in
  `fluid-scale.md` §3's "Resolved factors"), `px` converts a single drawn number to its resolved
  pixel value at a given viewport, `budget` checks a row of drawn widths against the content budget
  at the reference width (`fluid-scale.md` §9 step 1) before a section is built, rather than after it
  ships and overflows.

These are being written by another worker in this skill; treat the flags above as the intended shape
rather than a frozen contract, and check the script's own help output if a flag here doesn't match.
