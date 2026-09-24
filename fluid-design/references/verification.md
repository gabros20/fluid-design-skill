# Verification

**Read when:** you've built or changed a fluid-scale value, a section frame, a full-height section, or
anything else that needs checking across viewports rather than at one window size.
**Skip when:** the change is a static, non-responsive tweak with no viewport dependency — a plain
visual diff is enough. Verifying an animation (reveals, scene progress, anchor jumps through a
scroll well) is the `scroll-animation` skill's `references/verification.md`.
**Depends on:** `ios-safari.md` §9 for the stale-stylesheet mechanism this document's harness assumes
you've already ruled out.

Three tiers, cheapest and most automatable first. The order matters: a bug the scripted tiers can
catch should never wait for a real device, because a real device is the scarcest resource in this list.

## Contents

1. [Tier 1 — the scripted browser harness](#1-tier-1--the-scripted-browser-harness)
2. [Tier 2 — the viewport matrix](#2-tier-2--the-viewport-matrix)
3. [Tier 3 — a real device](#3-tier-3--a-real-device)
4. [Real-device render checks](#4-real-device-render-checks)
5. [The viewport matrix, cell by cell](#5-the-viewport-matrix-cell-by-cell)
6. [The stale-stylesheet probe](#6-the-stale-stylesheet-probe)
7. [The scripts](#7-the-scripts)
8. [Traps](#traps)

## 1. Tier 1 — the scripted browser harness

This is the tier that actually finds bugs. An earlier, more elaborate approach — hundreds of lines
of in-browser dev tooling (a timeline scrubber panel, live sliders, a registry shipped to production
to feed a debug UI) — was built, shipped, and never caught a single bug before being deleted. What
replaced it, and what does catch bugs, is much smaller: **driving a real headless browser from a
script and reading numbers out of it.**

- **Screenshot at fixed viewports, then tile them into one contact sheet.** A composition problem
  that's arguable staring at one frame is obvious laid out across five or six side by side, because
  the eye compares neighbours automatically.
- **Read state, not just pixels.** A computed style, `offsetWidth`, `getBoundingClientRect()`, a
  resolved custom property — these turn "it looks a bit off" into a specific, falsifiable claim:
  "`offsetWidth` is 402 where it should be 1128." The bugs this system has caught were found by
  reading one of these, not by looking harder at a screenshot, and none of them were visible from
  reading the source in isolation.

`scripts/verify-matrix.mjs` and `scripts/probe.mjs` (§7) are this tier, packaged.

## 2. Tier 2 — the viewport matrix

A layout change is never verified at one window: sweep the matrix in §5 with
`scripts/verify-matrix.mjs`. It is scripted like tier 1 but broader, and it is what catches the
drift bugs that exist only above the reference.

### The zoom row (WCAG 1.4.4)

`verify-matrix.mjs` also loads the page under **real** browser zoom: a throwaway Chromium profile
with the zoom preference set, which shrinks the CSS viewport exactly as Cmd/Ctrl + does (viewport
emulation cannot run the zoom detector, so it is not used). By default it runs 125/150/200% on
1440×900, 1920×1080 and 2560×1440, measures the `--zoom-selector` text (default `main p, p`, first
visible match; point it at running body copy), and converts it to physical size. A cell passes when
text grows at least 0.9× proportionally, capped at the WCAG target of 2×, with no horizontal
overflow. It warns by default; `--zoom-strict` makes it gate the run.

Reading a failure:
- `--fluid-zoom (unset)` on desktop cells: `fluid-zoom.js` is not installed.
- set, but text flat: the stylesheet predates `zoomCompensation` (regenerate it), or the text is on
  `--fluid`/`fluid-text-*`, which never zooms.
- only the `mobile` cells of a wide window: the mobile handover (`fluid-scale.md` §12). The page
  switched to mobile type that is smaller than the desktop type had grown to. Draw mobile body copy
  no smaller than its desktop reference size.

With `--screens` it also saves a viewport capture per zoom cell (`zoom-<window>-<pct>.jpg`), taken
through the DevTools protocol: Playwright's own screenshot crops a zoomed page to its top-left
1/zoom, which makes a fitting layout look cut off. Look at them for what the numbers cannot see:
big type in a scaled box running over its neighbours, fixed chrome covering grown copy.

It needs Playwright's full Chromium (`npx playwright install chromium`). The headless shell ignores
the zoom preference, and the row is then skipped with a note rather than reporting false passes.

## 3. Tier 3 — a real device

Connect a physical phone, hit a dev server by local IP, use the browser's own remote-debugging
console. Nothing substitutes for this — not device emulation, not a simulator for the specific class
of bug `ios-safari.md` documents (toolbar tint sampling has no emulated equivalent at all) — and it
remains, in practice, the least-frequently-done step of the three, precisely because it's the most
friction. Budget for it deliberately rather than treating it as optional polish: several of the bugs
in `ios-safari.md` were *only* ever reproducible this way.

## 4. Real-device render checks

Two device-testing disciplines worth stating explicitly, because both have cost real cycles when
skipped:

- **Confirm the deployed build actually contains the fix before asking for a device test.** Build/CDN
  propagation lag is enough for a device test to run against the previous deployment and produce a
  false negative that reads as "the fix didn't work."
- **A tint/chrome-sampling result is never trustworthy from anything but the physical device class it
  claims to fix** — a fix verified on one iOS version is not verified on another if the underlying
  WebKit sampling behaviour changed between them.

What only a device can verify here: the iOS toolbar tint (`ios-safari.md` §3), the `lvh` shortfall
and hero overshoot (§5 there), safe-area and `--browser-bar` padding (§2 there), and the 16px input
auto-zoom (§7 there). Video compositing and scroll-driven behaviour on a device are the
`scroll-animation` skill's checks.

## 5. The viewport matrix, cell by cell

Never verify a fluid-scale change at a single window size — several of the bugs in
`frame-and-gutter.md` (§3's drifting constants, a frozen gutter) and `ios-safari.md` are invisible at
or below the design reference width and only appear once a viewport exceeds it. Sweep a matrix, not a line:

- **Widths:** 1024 / 1280 / 1440 / 1680, plus **one width well above the reference — 2560.** The
  2560 row specifically exists because several drift bugs (a frozen gutter, a frozen grid-column
  minimum) are exactly zero at and below the reference width and only accumulate past it.
- **Heights:** 640 / 700 / 800 / 900 / 1440, crossed against the widths above.
- **Phones:** 390×844 and 375×667 by default. With the mobile arm on, the default set spans every band: 320×568, 375×812, 390×844, 430×932 (phone), 844×390, 932×430 (landscape phone), 820×1180, 834×1194 (portrait tablet). Landscape tablets (1024+) are covered by the desktop widths.

At each cell, check: nothing overflows, no heading's line count changes unexpectedly, and the design
reference cell (1440×900, or whatever a project's `fluid.config.json` reference is) renders
pixel-identical to the drawn frame.

## 6. The stale-stylesheet probe

Before debugging any layout or pin behaviour that "suddenly broke," rule out a stale stylesheet
first — full mechanism and fix in `ios-safari.md` §9. The one-line check:

```js
getComputedStyle(document.documentElement).getPropertyValue('--fluid')
```

A fresh, well-formed value (matching current source) means the stylesheet is current — keep
debugging the actual logic. An empty string, or an older/different form of the same expression,
means stop: close the tab, open a fresh one, and only resume debugging application logic if the
symptom survives that. `scripts/probe.mjs <url>` runs this check for you.

## 7. The scripts

`audit.mjs` is a **static source scanner** (regex/heuristic rules over your project's source files),
not a scanner of matrix screenshots or captured drift data. The companion scripts are referenced
here by intent rather than by a frozen flag list — check each script's own `--help` for the current
surface:

- **`scripts/verify-matrix.mjs <url> --screens --fit-selector '[data-fit=screen]'`** — drives the
  viewport matrix (§5) against a running server. It checks horizontal overflow, compares every
  resolved unit against the maths (and names a stale stylesheet when the computed expression has an
  older shape), checks that each `--fit-selector` element (default `[data-fit=screen]`) is no taller
  than the viewport, and reports the column count of every `[data-verify-grid]` element, failing if
  it changes across desktop viewports unless the element is marked `data-verify-grid="responsive"`.
  `--screens` writes a full-page screenshot per viewport plus a contact sheet. When the config sets
  a `ceiling`, one extra viewport is appended automatically, sized so the natural factor clears the
  ceiling by 25%, so the ceiling is always exercised (this is what let an SCSS ceiling bug ship
  unnoticed: the shipped defaults never crossed it). The zoom row (§2) checks text growth under
  real browser zoom (`--zoom`, `--zoom-bases`, `--zoom-selector`, `--zoom-strict`).
  `--browser webkit|firefox` runs the same matrix in another engine (`npx playwright install webkit
  firefox`). WebKit is the closest a script gets to Safari: run it before asking for a device test.
  Firefox is where precision bugs show (it rounds `min()`/`max()` results to 1/60px, `fluid-scale.md`
  §3). The zoom row needs Chromium and is skipped on the others. Exit codes: 0 pass, 1 a check failed, 2 usage
  error or Playwright not found. Reveal checking and anchor-jump checking are not here: they are
  the `scroll-animation` skill's `verify-motion` script.
- **`scripts/probe.mjs <url>`** — a single-viewport, single-pass version of the same read-state
  discipline in §1: dumps computed custom properties and key element rects for one URL, and runs the
  stale-stylesheet check (§6). A fast sanity check between matrix runs.
- **`scripts/calc.mjs table|px|budget`** — a standalone calculator for the fluid-scale arithmetic
  itself: `table` prints the resolved factor at a set of viewports (the "Resolved factors" table in
  `fluid-scale.md` §5), `px` converts a single drawn number to its resolved pixel value at a given
  viewport, `budget` checks a row of drawn widths against the content budget at the reference width
  (`fluid-scale.md` §4) before a section is built, rather than after it ships and overflows.
- **`scripts/audit.mjs <dir>`** — the static scanner itself: walks your project's source, applying
  the rule table in `scripts/README.md` (`fixed-px-at-engage`, `length-times-unit`, and the rest),
  each finding carrying a rule id, `file:line`, the offending snippet, a *why* and a *fix*.
  `--selftest` runs it over its own positive/negative fixtures and asserts each trips (or doesn't).

## Traps

- Verifying at one window. Drift bugs are exactly zero at and below the reference; keep 2560 in the matrix.
- Verifying in one engine. Run the matrix with `--browser webkit` and `--browser firefox` too: the
  Firefox 1/60px rounding bug passed every Chromium check.
- Debugging layout before ruling out a stale stylesheet (§6).
- Asking for a device test before confirming the deployed build contains the fix (§4).
- Trusting emulation for toolbar tint. It does not attempt Liquid Glass sampling at all.
- Testing zoom by shrinking the viewport. It reproduces the CSS but not `devicePixelRatio`, so the
  zoom detector cannot run; use the zoom row, which applies real browser zoom.
- A debug tool that changes what it measures: no `border`, no added `position: relative`, no wrapper
  elements, no `overflow: hidden` (it kills sticky, `ios-safari.md` §6). Outlines only.
