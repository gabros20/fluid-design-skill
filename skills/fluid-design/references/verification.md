# Verification

**Purpose:** Proving the scale works: the scripted harness, the viewport matrix, real-device checks,
the matrix cell by cell, the stale-stylesheet diagnosis, and the scripts.
**Read when:** you've built or changed a fluid-scale value, a section frame, a full-height section, or
anything else that needs checking across viewports rather than at one window size.
**Skip when:** the change is a static, non-responsive tweak with no viewport dependency — a plain
visual diff is enough. Verifying an animation (reveals, scene progress, anchor jumps through a
scroll well) is outside this skill.
**Inputs:** a running page URL, `fluid.config.json`, the fit selectors, and access to real devices
where needed.
**Produces:** `fluid check`, `fluid audit` and `fluid verify` results across the matrix, and a
current/stale stylesheet verdict.
**Depends on:** nothing. This is the one home of the stale-stylesheet diagnosis (§6); the other
references link here.

Three tiers, cheapest and most automatable first. The order matters: a bug the scripted tiers can
catch should never wait for a real device, because a real device is the scarcest resource in this list.
Before any of them: `fluid check` (§7) is the zero-browser gate — it catches a config/output drift or
a bad setting before you spend a viewport sweep chasing something that was never going to render right.

## Contents

1. [Tier 1 — the scripted browser harness](#1-tier-1--the-scripted-browser-harness)
2. [Tier 2 — the viewport matrix](#2-tier-2--the-viewport-matrix)
3. [Tier 3 — a real device](#3-tier-3--a-real-device)
4. [Real-device render checks](#4-real-device-render-checks)
5. [The viewport matrix, cell by cell](#5-the-viewport-matrix-cell-by-cell)
6. [The stale stylesheet](#6-the-stale-stylesheet)
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

`fluid verify` and `fluid explain <W>x<H> --url` (§7) are this tier, packaged. `fluid explain
<W>x<H>` without `--url` is the same read-state discipline with no browser at all: what every unit
resolves to and which setting produced it.

## 2. Tier 2 — the viewport matrix

A layout change is never verified at one window: sweep the matrix in §5 with `fluid verify`
(`scripts/tools/verify.mjs`). It is scripted like tier 1 but broader, and it is what catches the
drift bugs that exist only above the reference.

### The zoom row (WCAG 1.4.4)

`fluid verify` also loads the page under **real** browser zoom: a throwaway Chromium profile
with the zoom preference set, which shrinks the CSS viewport exactly as Cmd/Ctrl + does (viewport
emulation cannot run the zoom detector, so it is not used). By default it runs 125/150/200% on
1440×900, 1920×1080 and 2560×1440 (each base must be at or above the desktop band's `minWidth`),
measures the `--zoom-selector` text (default `main p, p`, first visible match; point it at running
body copy), and converts it to physical size. A cell passes when text grows at least 0.9× proportionally,
capped at the WCAG target of 2×, with no horizontal overflow. It warns by default; `--zoom-strict`
makes it gate the run.

Reading a failure:
- `--fluid-zoom (unset)` on desktop cells: the zoom runtime is not installed on this page — render
  `<FluidHead nonce={…} />` (Next), add `fluidPlugin()` (Vite), or, anything else, load
  `runtime/zoom.classic.js` as the first `<script>` in `<head>` (or paste `FLUID_ZOOM_INLINE` from
  `runtime/zoom.js` into it). Under a strict CSP, a blocked script reads the same way: check the
  console for a `script-src` violation (`fluid-scale.md` §12, CSP).
- `--fluid-zoom` set to `1`: the runtime is installed but detected no zoom — check it runs in the top
  window, and that `fluid.config.json` has `zoom: true`. A side panel or bottom-docked DevTools
  also reads 1 by design.
- set, growing, but the text still failed: the stylesheet was generated with `zoom: false`, or the
  text sits on `--fluid` (layout) directly, which is never compensated. `--fluid-<role>` (`display`,
  `copy`, …) always compensates fully; `fluid-text-*` compensates by size, in full below
  `--fluid-zoom-text-full` and not at all above `--fluid-zoom-text-none` (the range in between blends).
- only the mobile-band cells of a wide window fail: the mobile handover (`fluid-scale.md` §12). The
  page switched to mobile type that is smaller than the desktop type had grown to. Draw mobile body
  copy no smaller than its desktop reference size.

With `--screens` it also saves a viewport capture per zoom cell (`zoom-<window>-<pct>.jpg`), taken
through the DevTools protocol: Playwright's own screenshot crops a zoomed page to its top-left
1/zoom, which makes a fitting layout look cut off. Look at them for what the numbers cannot see:
big type in a scaled box running over its neighbours, fixed ui covering grown copy.

It needs Playwright's full Chromium (`npx playwright install chromium`) and runs only with
`--browser chromium` (the default); on `--browser webkit`/`firefox` it is skipped with a note — the
zoom row drives a Chromium-only preference. The headless shell ignores the zoom preference too, and
the row is then skipped with a note rather than reporting false passes.

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
  false negative that reads as "the fix didn't work." `fluid explain 1440x900 --url <deployed-url>
  --brief` (§7) names the exact build stamp the live page is running (§6) — check it before asking.
- **A tint/chrome-sampling result is never trustworthy from anything but the physical device class it
  claims to fix** — a fix verified on one iOS version is not verified on another if the underlying
  WebKit sampling behaviour changed between them.

What only a device can verify here: the iOS toolbar tint (`ios-safari.md` §3), the `lvh` shortfall
and hero overshoot (§5 there), safe-area and `--fluid-browser-bar` padding (§2 there), and the 16px input
auto-zoom (§7 there). Video compositing and scroll-driven behaviour on a device are outside this
skill.

## 5. The viewport matrix, cell by cell

Never verify a fluid-scale change at a single window size — several of the bugs in
`frame-and-gutter.md` (§3's drifting constants, a frozen gutter) and `ios-safari.md` are invisible at
or below the design reference width and only appear once a viewport exceeds it. Sweep a matrix, not a line:

- **Widths:** 1024 / 1280 / 1440 / 1680, plus **one width well above the reference — 2560.** The
  2560 row specifically exists because several drift bugs (a frozen gutter, a frozen grid-column
  minimum) are exactly zero at and below the reference width and only accumulate past it. When
  `--fluid-desktop-scale-max` is set, `fluid verify` adds one more viewport automatically, sized so
  the natural (uncapped) factor clears the ceiling by 25% — the ceiling is otherwise easy to leave
  unexercised by a default-shaped matrix.
- **Heights:** 640 / 700 / 800 / 900 / 1440, crossed against the widths above.
- **Phones:** 390×844 and 375×667 by default. With the mobile bands on (the v2 default), the default
  set spans every band: 320×568, 375×812, 390×844, 430×932 (phone), 844×390, 932×430 (landscape phone),
  820×1180, 834×1194 (portrait tablet). Landscape tablets (1024+) are covered by the desktop widths.

At each cell, check: nothing overflows, no heading's line count changes unexpectedly, and the design
reference cell (1440×900, or whatever a project's `fluid.config.json` bands.desktop artboard is)
renders pixel-identical to the drawn frame.

## 6. The stale stylesheet

**This is almost always the actual cause of "the scroll-driven video/pin is broken" or "the layout
lost its sizes" reports right after a CSS edit.** Rule it out before reading any layout, scrub or
pin code.

**Why it happens.** A dev server pushes CSS over its HMR socket (Next dev does). Restarting the
server kills that socket, and a tab that was already open does not reliably re-fetch the stylesheet
on reconnect — it keeps the previous one in memory. Safari holds it hardest: a plain Cmd+R often
re-runs the page against the cached CSS, so the reload appears to "not work" while closing the tab
fixes it instantly. The trigger is always the same pair: **the fluid output changed (a
`fluid generate`, or an edit to a global stylesheet such as `globals.css`) AND the server restarted
while a tab stayed open.**

**Why it looks like a motion or layout bug.** Utilities defined through an at-rule (Tailwind v4's
`@utility`) are still in the rendered HTML with no rule behind them once the stylesheet goes stale:
the class name is there, the CSS that gives it meaning isn't. A missing height utility on a pinned
scene's frame collapses it to `height: auto`, so the pin keeps its 0→1 progress but has almost no
travel to spread it over: it holds the first frame, then snaps to the last. A missing container
utility makes the render full-bleed. It reads like a scroll-math bug and sends a debugging session
into the wrong file.

**The check.** Every generated stylesheet stamps a build id on `:root`:

```js
getComputedStyle(document.documentElement).getPropertyValue('--fluid-build')
```

It reads `"<skill-version>+<config-hash>"`, e.g. `"2.0.0+a1b2c3d4"`. `fluid explain 1440x900 --url
<page-url> --brief` compares it with what the current `fluid.config.json` generates and ends with a
verdict (`fluid probe <url>` is the old name, kept as an alias):

| Verdict | Means | Exit |
|---|---|---|
| **OK** | current build, units match the model | 0 |
| **STALE** | the page's build stamp differs from what the config generates now | 1 |
| **MISMATCH** | current build, but a unit drifts: a hand-edited `fluid.css`, or a setting redeclared where `fluid check` doesn't look | 1 |
| **V1** | a stylesheet with no `--fluid-build` (v1, or hand-written) against a v2 config | 1 |
| **MISSING** | no fluid unit resolves: the page doesn't load the fluid stylesheet (wrong URL or build, or not wired up) | 2 |

**The fix.** Close the tab and open a fresh one. If the symptom survives that, clear the build cache
and restart the dev server (`rm -rf .next`, or the framework's equivalent). **Closing the tab fixing
it is proof the code was fine** — a genuine logic bug doesn't care which tab is open.

**After any change to a global stylesheet** (or a `fluid generate`): restart the dev server and open
a fresh tab before judging what's on screen. At-rule utilities only exist in a freshly rebuilt
stylesheet; there's no partial-HMR path for them.

## 7. The scripts

All of these are also reachable through the `fluid` CLI (`fluid check`, `fluid explain`, `fluid
verify`, `fluid calc`, `fluid audit`), which finds the nearest `fluid.config.json` for
you; call the underlying script directly with `--config <file>` when you need to point at a config
that isn't an ancestor of the current directory. Referenced here by intent rather than a frozen flag
list — check each script's own `--help` for the current surface:

- **`fluid check [--verbose]`** — the zero-browser CI gate. Confirms the generated output in
  `output.dir` matches what `fluid.config.json` would produce right now (missing / stale /
  hand-edited / orphaned files; a formatter's whitespace-and-quotes rewrite is a warning, with the
  ignore-file line to add), lints every `--fluid-*` setting your project's CSS declares (a typo'd
  or engine-owned name, out-of-range value, `scale-min` above `scale-max`; `@layer`/`@supports`
  wrappers and selector lists are read correctly), runs the audit's source rules (`header-limit`,
  `cn-without-withfluid`, `band-variant-with-breakpoint`, `fluid-desktop-variant`,
  `limit-on-children`, `fluid-leading-ratio`), errors on a `--breakpoint-*` declared next to the px
  ladder, and — on `tailwind.breakpoints: "none"` — checks your own `--breakpoint-lg` still agrees
  with `bands.desktop.minWidth`. Info notes (your own `--fluid-*` token, a setting inside a media
  query or on a non-scope selector) print only with `--verbose`. Non-zero exit on any error: put it
  in CI ahead of a build.
- **`fluid explain <W>x<H> [--zoom z] [--url http://… [--brief]]`** — every unit at one viewport,
  the band it falls in, and where each setting in play came from (default, or `file:line` in your
  CSS). With `--url` it loads the live page instead: reads its *own* computed settings (so a page
  that overrides a setting is checked against that override, not flagged for it), compares resolved
  units against what the model computes from them, compares build stamps, and ends with a verdict
  (§6's table). It works on a v1 config too, expecting its migrated numbers. `--zoom` with `--url`
  is emulated (it sets the runtime's `--fluid-zoom` on the page, not browser zoom; `fluid verify`
  covers real zoom). `--brief` prints just the units and the verdict. It also lists every scope on
  the page (limit utilities, `.fluid-scope`, `[data-fluid-scope]`, and any element where a setting
  changes, which is how an SCSS/StyleX mixin scope shows up) with its own settings, its units next
  to the page's, and how many elements inside follow the scale; a scope with none is flagged, since
  its limit does nothing there. `--at <selector>` explains one element instead, and says so when it
  sets fluid settings without being a scope. `--set --fluid-<setting>=<n>` (repeatable) changes the
  prediction without touching any file, offline or with `--url`.
- **`fluid verify <url> --screens --fit-selector '[data-fit=screen]'`** (`scripts/tools/verify.mjs`)
  — drives the viewport matrix (§5) against a running server. It checks horizontal overflow, checks
  units the same way `fluid explain --url` does — resolved against the page's own settings, with the
  build stamp (§6) diagnosing *why* a mismatched unit is wrong: `missing` (no fluid stylesheet at all),
  `v1` (a stylesheet with no `--fluid-build`), `stale` (a build stamp that doesn't match what
  `fluid.config.json` generates now), or `mismatch` (current build, wrong number — a hand-edited
  `fluid.css`, or a setting redeclared somewhere `fluid check` should catch) — checks that each
  `--fit-selector` element (default `[data-fit=screen]`) is no taller than the viewport, and reports
  the column count of every `[data-verify-grid]` element, failing if it changes across desktop
  viewports unless the element is marked `data-verify-grid="responsive"`. `--screens` writes a
  full-page screenshot per viewport plus a contact sheet. The zoom row (§2) checks text growth under
  real browser zoom (`--zoom`, `--zoom-bases`, `--zoom-selector`, `--zoom-strict`). `--browser
  webkit|firefox` runs the same matrix in another engine (`npx playwright install webkit firefox`).
  WebKit is the closest a script gets to Safari: run it before asking for a device test. Firefox is
  where precision bugs show (it rounds `min()`/`max()` results to 1/60px, `fluid-scale.md` §3). The
  zoom row needs Chromium and is skipped on the others. Exit codes: 0 pass, 1 a check failed, 2 usage
  error or Playwright not found. Reveal checking and anchor-jump checking are not here.
- **`fluid calc table|px|budget`** (`scripts/tools/calc.mjs`) — a standalone calculator for the fluid-scale
  arithmetic itself, reading settings from the nearest `fluid.config.json` and the project's own CSS
  (or `--config`): `table` prints the resolved unit at a set of viewports plus which arm is binding
  (`width`, `height`, `min`, `max`, or `flat` below the desktop band) — the "Resolved factors" table
  in `fluid-scale.md` §5; `px` converts a single drawn number to its resolved pixel value at a given
  viewport and unit (`--unit fluid|<role>|ui`); `budget` checks a row of drawn widths against the
  content budget at the artboard (`min(base-width, container-width) − 2×padding`) before a section is
  built, rather than after it ships and overflows, suggesting `cqw` fractions of the container's
  content box on OVER (`fluid-scale.md` §4.1's container-query escape).
- **`fluid audit <src>`** (`scripts/tools/audit.mjs`) — the static scanner: walks your project's source,
  applying the rule table in `scripts/README.md` (`fixed-px-at-engage`, `length-times-unit`,
  `band-variant-with-breakpoint`, `limit-on-children`, and the rest), each finding carrying a rule
  id, `file:line`, the offending snippet, a *why* and a *fix*. With a `fluid.config.json` above the
  source it takes the prefix, roles and stack from it; `--desktop-variant` names the desktop
  breakpoint (default `lg`). `--selftest` runs it over its own positive/negative fixtures and
  asserts each trips (or doesn't).

## Traps

- Verifying at one window. Drift bugs are exactly zero at and below the reference; keep 2560 in the matrix.
- Verifying in one engine. Run the matrix with `--browser webkit` and `--browser firefox` too: the
  Firefox 1/60px rounding bug passed every Chromium check.
- Debugging layout before ruling out a stale stylesheet (§6) or running `fluid check` first.
- Asking for a device test before confirming the deployed build contains the fix (§4).
- Trusting emulation for toolbar tint. It does not attempt Liquid Glass sampling at all.
- Testing zoom by shrinking the viewport. It reproduces the CSS but not `devicePixelRatio`, so the
  zoom detector cannot run; use the zoom row, which applies real browser zoom.
- A debug tool that changes what it measures: no `border`, no added `position: relative`, no wrapper
  elements, no `overflow: hidden` (it kills sticky, `ios-safari.md` §6). Outlines only.
