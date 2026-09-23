# fluid-design scripts

Node 20+, ESM, zero runtime dependencies except `playwright` (only needed by
`probe.mjs` and `verify-matrix.mjs`, resolved from the target project — see
below). All math comes from `lib/fluid-math.mjs`; these scripts are thin CLIs
over it plus a static scanner.

## calc.mjs — the math, with no browser and no project

```
node calc.mjs [--config f] table [--w 1024,1280,1440,1680,2560] [--h 640,700,800,900,1440] [--raw]
node calc.mjs [--config f] px <N> --unit fluid|display|copy|chrome --at WxH
node calc.mjs [--config f] budget --widths N,N,N,...
```

- **table** — prints the resolved factors (`fluid`, `display`, `copy`,
  `chrome`) for a set of viewports, and which arm (`width`, `height`,
  `floor`, or `below-engage`) is binding at each one. `--w`/`--h` are zipped
  index-wise into one row per pair when they're the same length (this is
  what reproduces fluid-scale.md §3's "Resolved factors" table); otherwise
  it's a full width x height cross product. `--raw` continues the formula
  past `engageAt` instead of flattening to 1 below it — useful for seeing the
  curve's shape, not what actually ships below `lg`.
- **px** — prints what a single drawn number renders to at one viewport,
  e.g. `node calc.mjs px 64 --unit display --at 1280x800`.
- **budget** — sums a drawn row of widths and checks it against the content
  budget at the reference (`reference.width - 2*canvas.gutter`). PASS if it
  fits; on OVER it suggests `cqw` fractions of the canvas content box
  (`N / (canvas.width - 2*canvas.gutter)`) per fluid-scale.md §4.1's
  container-query escape — the fix for a row drawn wider than the reference
  frame can hold.

Exit codes: `0` ok / budget PASS, `1` budget OVER, `2` usage error.

## audit.mjs — static scanner

```
node audit.mjs <srcDir> [--engage lg] [--json]
node audit.mjs --selftest
```

Walks `<srcDir>` (skipping `node_modules`, `.git`, `.next`, `dist`, `build`)
and reports rule violations, each with a rule id, `file:line`, the offending
snippet, a one-line *why*, and a *fix*. Some rules need repo-wide context
(e.g. whether `@custom-variant dark` is declared anywhere, or whether
`LazyMotion strict` is present) — that context is computed once per scan root
before per-file rules run.

Rules (severity in parens): `fixed-px-at-engage` (error; info for the
deliberately-excluded border/radius/tracking/max-w properties),
`length-times-unit` (error), `dvh-on-scaled` (warn), `overflow-hidden-x`
(warn), `dark-variant` (warn), `rounded-with-zero-token` (info),
`motion-strict` (error), `fractional-amount` (warn), `contents-reveal`
(error), `img-svg` (warn), `video-attrs` (warn), `double-fluid-same-prop`
(warn), `type-unit-mismatch` (info).

`--selftest` runs the scanner over `fixtures/audit/<rule-id>/{positive,negative}`
for every rule and asserts each positive fixture trips the rule and each
negative fixture does not. `--json` prints `{ srcDir, findings }` instead of
the readable table.

Exit codes: `0` no error-severity findings, `1` at least one error-severity
finding, `2` usage error. `--selftest` exits `0`/`1` on pass/fail.

## probe.mjs — one-shot freshness check

```
node probe.mjs <url> [--config f] [--width 1440] [--height 900]
node probe.mjs --help
```

Loads `<url>` in a headless browser at one viewport, reads the four fluid
custom properties, resolves each to a number (`getPropertyValue` returns the
unevaluated expression, not a number, so a probe element sized with
`calc(1000 * var(--fluid...))` is measured instead), and compares against
`factors()` from `lib/fluid-math.mjs`. Prints a verdict:

- **FRESH** — resolved values match expected within `0.002`.
- **STALE** — units are present but drift from expected. This is almost
  always the classic bug, not a code bug: Next dev pushes CSS over the HMR
  socket, a server restart kills that socket, and an already-open tab does
  not reliably re-fetch on reconnect. Safari holds it hardest. Fix: close the
  tab and open a fresh one; if that doesn't clear it, blow away the build
  cache (`rm -rf .next`) and restart the dev server. `--help` prints the full
  explanation.
- **MISSING** — none of the four properties resolve to anything (wrong URL,
  a build that predates the scale, or it's genuinely not wired up here).

Exit codes: `0` FRESH, `1` STALE, `2` MISSING or usage/invocation error.

## verify-matrix.mjs — the browser harness

```
node verify-matrix.mjs <url> [--config f] [--out dir]
  [--widths 1024,1280,1440,1680,2560] [--heights 640,700,800,900]
  [--mobile 390x844,375x667] [--fit-selector '[data-fit=screen]']
  [--reveal] [--screens]
```

Drives every viewport in the `widths x heights` desktop matrix, plus each
exact `--mobile WxH` pair, and for each one checks:

- **(a) overflow** — `scrollWidth > innerWidth + 1`. On fail, lists up to 10
  offending elements (`rect.right > innerWidth`), shallowest DOM depth first.
- **(b) units** — the same probe-element technique as `probe.mjs`, checked
  against `factors()` within `0.002`. This doubles as the stale-stylesheet
  detector: a missing or drifted unit means the stylesheet did not rebuild.
- **(c) fit** — every element matching `--fit-selector` has
  `height <= innerHeight + 1`, checked only at/above `engageAt` (below it the
  scale is a flat 1px and the check is meaningless). Reports the height
  ratio.
- **(d) reveal** (`--reveal` only) — step-scrolls to the bottom using rAF +
  200ms per step (a fast scroll outruns `IntersectionObserver` and gives
  false blanks), waits ~1.5s to let the contract's up-to-1.3s entrance
  transition settle, then reports every `[data-stage-item]` under opacity
  `0.99`.
- **(e) screenshots** (`--screens` only) — a full-page PNG per viewport in
  `--out`, plus `contact-sheet.html` tiling all of them with pass/fail
  captions.

Writes `report.json` (every check, every viewport) and prints a readable
summary table plus a detail block per failing viewport. Playwright is
resolved from the target project's `node_modules` first (via
`process.cwd()`, i.e. run this from inside the project), then a skill-local
install, then a clear install hint if neither exists.

Exit codes: `0` every check passed, `1` at least one failed, `2` usage error
or playwright could not be resolved/launched.

## fixtures/

- `fixtures/audit/<rule-id>/{positive,negative}/` — one isolated directory
  pair per audit rule, consumed by `audit.mjs --selftest`.
- `fixtures/page/index.html` — a static page whose `<style>` block is the
  unit CSS generated by `lib/fluid-math.mjs`'s `cssUnits(loadConfig())` at
  the shipped defaults, pasted verbatim (regenerate and re-paste if the
  defaults change). It has one `data-fit="screen"` section sized
  `calc(900 * var(--fluid))`, several `[data-stage-item]` elements made
  visible by a small inline `IntersectionObserver`, and one deliberately
  overflowing element gated behind a `?overflow` query flag. Serve it with
  `python3 -m http.server` from `fixtures/page/` and point `verify-matrix.mjs`
  or `probe.mjs` at it:

  ```
  cd fixtures/page && python3 -m http.server 8934 &
  node ../../verify-matrix.mjs http://localhost:8934/index.html --reveal --screens   # PASS
  node ../../verify-matrix.mjs "http://localhost:8934/index.html?overflow"           # FAIL (overflow)
  ```
