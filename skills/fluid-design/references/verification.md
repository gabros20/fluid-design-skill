# Verification

**Purpose:** Proving the scale works: the zero-browser gate, the scripted harness, the viewport
matrix, real-device checks, the stale-stylesheet diagnosis, and the scripts.
**Read when:** you built or changed a fluid value, a section's container, a full-height section, or
anything else that has to hold across window sizes.
**Skip when:** the change has no viewport dependency (a plain visual diff is enough). Verifying an
animation (reveals, scene progress, anchor jumps) is outside this skill.
**Inputs:** a running page URL, `fluid.config.json`, the fit selectors, real devices where needed.
**Produces:** `fluid check`, `fluid audit` and `fluid verify` results, and a current/stale
stylesheet verdict. This is the one home of the stale-stylesheet diagnosis (§6).

Run the cheapest check first: a bug a script can catch should never wait for a real device, the
scarcest resource. Before any browser, `fluid check` (§7) catches config/output drift and bad
settings.

## Contents

1. Tier 1 — the scripted browser harness
2. Tier 2 — the viewport matrix (and the zoom row)
3. Tier 3 — a real device
4. Real-device render checks
5. The viewport matrix, cell by cell
6. The stale stylesheet
7. The scripts
8. Traps

## 1. Tier 1 — the scripted browser harness

Drive a real headless browser from a script and read numbers out of it: this tier finds the bugs.
(An in-browser debug UI with scrubbers and sliders never caught one and was deleted.)

- **Tile fixed-viewport screenshots into one contact sheet:** what is arguable in one frame is
  obvious across six.
- **Read state, not pixels.** A computed style, `getBoundingClientRect()` or a resolved custom
  property turns "looks off" into "`offsetWidth` is 402, should be 1128". Every bug this system
  caught was found that way; none was visible in the source.

`fluid verify` and `fluid explain <W>x<H> --url` are this tier, packaged.

## 2. Tier 2 — the viewport matrix

Sweep §5's matrix with `fluid verify`; it catches drift that exists only above the design frame.

### The zoom row (WCAG 1.4.4)

`fluid verify` also loads the page under **real** browser zoom (a Chromium profile with the zoom
preference set; emulation cannot run the zoom detector): 125/150/200% on 1440×900, 1920×1080 and
2560×1440. A cell passes when the `--zoom-selector` text (default `main p, p`) grows at least 0.9×
proportionally in physical px (capped at WCAG's 2×), with no overflow. It warns; `--zoom-strict`
fails the run.

| Failure reads | Cause and fix |
|---|---|
| `--fluid-zoom (unset)` on desktop cells | the zoom runtime is missing: `<FluidHead nonce={…} />` (Next), `fluidPlugin()` (Vite), else `runtime/zoom.classic.js` first in `<head>`. A CSP-blocked script reads the same: look for a `script-src` violation (`browser-zoom.md` §3) |
| `--fluid-zoom` is `1` | no zoom detected: the runtime must run in the top window, with `zoom: true`. Docked DevTools also reads 1, by design |
| set, text still failed | generated with `zoom: false`, or the text is on `--fluid` (layout, never compensated). Role units compensate fully; `fluid-text-*` by size (`--fluid-zoom-text-full`/`-none`) |
| only phone-band cells of a wide window fail | the mobile handover (`browser-zoom.md` §5): zoom switched to phone type smaller than the zoomed desktop type. Draw phone body copy no smaller than desktop's |

`--screens` saves a capture per zoom cell through the DevTools protocol (Playwright's screenshot
crops a zoomed page to its top-left 1/zoom); look for big type overrunning its box. The row needs
Playwright's full Chromium; on WebKit, Firefox or the headless shell (which ignores the zoom
preference) it is skipped with a note, never a false pass.

## 3. Tier 3 — a real device

Open the dev server on a phone by local IP, with the browser's remote-debugging console. Nothing
emulated replaces it for `ios-safari.md`'s bugs (toolbar tint sampling has no emulation), several
of which only ever reproduced here. It is the most skipped step: budget for it.

## 4. Real-device render checks

- **Confirm the deployed build has the fix before a device test.** CDN lag otherwise tests the old
  build and reads as "the fix didn't work". `fluid explain 1440x900 --url <deployed-url> --brief`
  names the live build stamp (§6).
- **Check production before chasing a toolbar tint seen only in development.** A dev-only overlay
  script (react-grab) tinted the Safari 26 toolbar grey in development only (`ios-safari.md`).
- **Trust a tint result only on the iOS version it claims to fix**: WebKit's sampling changes.

Only a device verifies (`ios-safari.md`): the toolbar tint (§3), the `lvh` shortfall (§5),
safe-area and `--fluid-browser-bar` padding (§2), the 16px input auto-zoom (§7).

## 5. The viewport matrix, cell by cell

Drift bugs (`frame-and-gutter.md` §3, a frozen gutter) are zero at and below the design frame's
width and grow past it. Sweep a matrix, not a line:

- **Widths:** 1024 / 1280 / 1440 / 1680 and **2560**, the row that exposes drift. With
  `--fluid-desktop-scale-max` set, `fluid verify` adds a viewport past the ceiling so it is exercised.
- **Heights:** 640 / 700 / 800 / 900 / 1440, crossed with the widths.
- **Phones and tablets** (mobile bands on, the default): 320×568, 375×812, 390×844, 430×932 (phone),
  844×390, 932×430 (landscape), 820×1180, 834×1194 (tablet). With `bands.phone: false`: 390×844 and
  375×667. Landscape tablets (1024+) fall in the desktop widths.

At each cell: nothing overflows, no heading changes its line count unexpectedly, and the design
frame cell (1440×900 by default, or the project's `--fluid-desktop-base-width`/`-height`) matches the
drawn frame pixel for pixel.

## 6. The stale stylesheet

**This is almost always the real cause of "the pin is broken" or "the layout lost its sizes" right
after a CSS edit.** Rule it out before reading any layout or scroll code.

**Why.** A dev server pushes CSS over its HMR socket. Restarting the server kills the socket, and an
open tab does not reliably re-fetch the stylesheet (Safari holds on hardest: Cmd+R often reuses the
cached CSS). The trigger is always the pair: **the fluid output or a global stylesheet changed AND
the server restarted while a tab stayed open.** The `@utility` classes stay in the HTML with no rule
behind them: a pinned frame collapses to `height: auto` (the pin holds, then snaps), a section
without `fluid-container` goes full-bleed. It reads like scroll maths and sends debugging into the
wrong file.

**The check.** Every generated stylesheet stamps `--fluid-build` on `:root`, `"<skill-version>+<config-hash>"`:

```js
getComputedStyle(document.documentElement).getPropertyValue('--fluid-build')
```

`fluid explain 1440x900 --url <page-url> --brief` (alias `fluid probe <url>`) compares it with what
the current `fluid.config.json` generates and ends with a verdict:

| Verdict | Means | Exit |
|---|---|---|
| **OK** | current build, units match the model | 0 |
| **STALE** | the page's build stamp differs from what the config generates now | 1 |
| **MISMATCH** | current build, but a unit drifts: a hand-edited `fluid.css`, or a setting redeclared where `fluid check` doesn't look | 1 |
| **V1** | no `--fluid-build` (v1 or hand-written CSS) against a v2 config | 1 |
| **MISSING** | no fluid unit resolves: the page doesn't load the fluid stylesheet | 2 |

**The fix.** Close the tab and open a fresh one. If that fails, clear the build cache (`rm -rf
.next`) and restart. **If closing the tab fixed it, the code was fine.** After any global
stylesheet change or `fluid generate`, restart the dev server and open a fresh tab before judging
the screen: `@utility` rules only exist in a freshly rebuilt stylesheet.

## 7. The scripts

`fluid init` adds a `fluid` npm script (`npx fluid-design-cli@2`), so the team and CI run the CLI
without the skill: `npm run fluid -- check`. It finds the nearest `fluid.config.json` (`--config` for
another); each command's `--help` has the full flags.

- **`fluid check [--verbose]`**: the zero-browser gate. **Put `npm run fluid -- check` in CI ahead of
  the build;** it exits non-zero on any error. It checks `output.dir` against what the config
  generates now (a formatter's rewrite only warns), lints every `--fluid-*` setting your CSS declares
  (typo, engine-owned name, out-of-range value), runs the audit's source rules, and checks the
  breakpoint ladder against `bands.desktop.minWidth`. `--verbose` adds info notes.
- **`fluid explain <W>x<H> [--set --fluid-<setting>=<n>] [--url <page> [--at <sel>] [--brief]]`**:
  every unit at one viewport, its band, and where each setting came from (default or `file:line`);
  `--set` predicts a change without editing a file. `--url` reads the live page's own settings,
  compares units and build stamps, ends with §6's verdict, and lists every scope (flagging one
  nothing inside follows).
- **`fluid verify <url> [--screens] [--fit-selector <sel>] [--browser webkit|firefox]`**: drives §5's
  matrix against a running server. It fails on overflow, on a unit that drifts (named `missing`,
  `v1`, `stale` or `mismatch`, as in §6), on a fit-selector element (default `[data-fit=screen]`)
  taller than the viewport, and on a `[data-verify-grid]` whose column count changes across desktop
  viewports (unless `="responsive"`). `--screens` adds screenshots and a contact sheet. Run WebKit
  (closest to Safari) before a device test, and Firefox for precision bugs (it rounds
  `min()`/`max()` to 1/60px, `fluid-scale.md` §3). Exit 0 pass, 1 failed, 2 usage or no Playwright.
- **`fluid calc table|px|budget`**: the maths, no browser. `table`: each unit at a set of viewports
  and which arm binds; `px <N> --unit <unit> --at WxH`: one drawn number; `budget --widths N,N,…`:
  does a drawn row fit the content box at the design frame, before you build it. On OVER it suggests
  `cqw` fractions (`frame-and-gutter.md` §2); a project avoiding `cqw` caps the row with `fluid-cap-*`
  or asks for a redraw.
- **`fluid audit <src>`**: the static scanner. Each finding has a rule id (`fixed-px-at-engage`,
  `length-times-unit`, …; the rules live in `scripts/tools/audit.mjs`), `file:line`, the snippet, a why and a fix.
  `arbitrary-fluid-calc` (info, Tailwind, audit only) finds a hand-written calc a generated utility
  covers, anywhere in a file (class strings often live in constants):
  `h-[calc(56*var(--fluid-copy))]` → `fluid-copy-h-56`, `lg:px-[calc(24*var(--fluid))]` → `lg:fluid-px-24`.

## 8. Traps

- Verifying at one window. Drift is zero at and below the design frame; keep 2560 in the matrix.
- Verifying in one engine. The Firefox 1/60px rounding bug passed every Chromium check.
- Debugging layout before running `fluid check` and ruling out a stale stylesheet (§6).
- A device test before the deployed build has the fix, or a dev-only toolbar tint chased before
  checking production (§4). Emulation does not attempt Liquid Glass tint sampling at all.
- Testing zoom by shrinking the viewport: no `devicePixelRatio` change, so the zoom detector cannot
  run. Use the zoom row.
- A debug tool that changes what it measures: no `border`, added `position: relative`, wrappers or
  `overflow: hidden` (it kills sticky, `ios-safari.md` §6). Outlines only.
