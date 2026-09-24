# fluid-design scripts

Node 20+, ESM, zero runtime dependencies except `playwright` (only needed by
`probe.mjs`, `verify-matrix.mjs` and the browser tests under `test/`,
resolved from the target project — see below).

`bin/fluid` (`cli.mjs`) is the `fluid` command projects use day to day. It
finds the nearest `fluid.config.json` (walking up from `cwd`, or `--config
<file>`) and either runs its own logic or forwards straight to one of the
standalone tools below (`fluid calc|probe|verify|audit` == `node
calc.mjs|probe.mjs|verify-matrix.mjs|audit.mjs`). All of it — the CLI and the
tools — is built on `lib/`, never duplicates a formula, and never hand-writes
a config default: everything traces back to `lib/spec.mjs`.

Animation/scroll-scene verification (a triggered entrance, a scrub scene's
state, a real anchor click through smooth scrolling) lives in the
`scroll-animation` skill's `scripts/` — `audit-motion.mjs`,
`verify-motion.mjs`, `anchor-check.mjs` — not here.

## bin/fluid — the CLI (cli.mjs)

```
fluid init [--yes] [--brownfield] [--stack tailwind-v4|css|scss|stylex] [--integration next|vite|none]
           [--out dir] [--css globals.css] [--desktop 1440x900] [--desktop-at 1024] [--no-mobile]
           [--phone 390] [--max-width 1680] [--set --fluid-<setting>=<n> …] [--force] [--interactive]
fluid generate [--dry] [--force] [--watch]
fluid check
fluid settings [--json]
fluid explain <W>x<H> [--zoom z] [--set --fluid-<setting>=<n> …] [--url http://… [--at <selector>]]
fluid migrate [--write]
fluid calc | probe | verify | audit …   (the tools below)
```

- **`init`** — detects the stack and framework from `package.json` (or, with
  none, from the stylesheet: Rails, Phoenix, Hugo and plain-HTML paths are
  searched), writes a minimal `fluid.config.json` + `fluid.config.schema.json`,
  runs `generate`, and adds the one `@import` plus the settings into the
  project's existing `:root` (or `--css`). On a terminal it asks the preflight
  questions (stack, framework, stylesheet, brownfield, desktop frame, desktop
  breakpoint, mobile bands, phone frame, max width, output folder), each with
  the detected default; `--yes` or a non-terminal (an agent, CI) skips them,
  and every answer is also a flag. `--interactive` forces the questions and
  reads the answers line by line from stdin (the test does this). Answers
  that are settings are written as declarations, only when they differ from
  the default; `--set` adds any setting, validated against the spec with a
  did-you-mean. `--brownfield` (or a stylesheet that already styles
  `html`/`body`) turns `output.base` off and only prints the import. A
  `.scss` stylesheet is never edited: init prints the `@use` and the
  engine import. With no framework integration it also generates
  `runtime/zoom.classic.js`, the zoom runtime as a classic `<script src>`.
  Refuses to run twice without `--force`.
- **`generate`** — writes `output.dir` from the current `fluid.config.json`.
  Compares against `.fluid.lock.json` first: a file that was hand-edited
  since the last generate is left alone (and the whole run fails) unless
  `--force`. `--dry` prints what would change without writing. `--watch`
  regenerates on every save of `fluid.config.json` (it watches the folder,
  since editors often replace the file).
- **`check`** — the CI gate, zero browser: (1) the generated output matches
  what the config would produce right now — missing / stale / hand-edited /
  orphaned; (2) every `--fluid-*` declaration in the project's own CSS is
  linted (unknown name with a did-you-mean, out-of-range value, non-numeric
  value, `scale-min` above `scale-max`, a setting declared outside
  `:root`/`.fluid-scope`, one shadowing another); (3) on
  `tailwind.breakpoints: "none"`, any hand-maintained `--breakpoint-lg` still
  agrees with `bands.desktop.minWidth`. It also names a generator version
  mismatch (the lock records the CLI version that generated the folder), so
  a teammate's binary and CI's `npx` can't silently disagree. Non-zero exit
  on any problem.
- **`settings [--json]`** — prints `settings.reference.css` (every setting,
  commented, with its default), or with `--json` the same as structured data.
- **`explain <W>x<H> [--zoom z] [--url http://…]`** — the band a viewport
  falls in, every resolved unit, and where each setting in play came from
  (default, or `file:line` in the project's CSS). With `--url` it loads the
  live page in a headless browser instead, reads its own computed settings,
  and compares the page's resolved units and build stamp against what the
  config generates now (`verification.md` §6), then lists every scope on the
  page with its settings, units and how many elements inside follow the
  scale (a limit with nothing fluid inside is flagged). `--at <selector>`
  explains one element; `--set` changes the prediction without editing.
- **`migrate [--write]`** — converts a v1 `fluid.config.json` to v2: prints
  what moved, the new config, and a `:root` snippet of every v1 number that
  differed from its v2 default (nothing to carry over prints instead).
  `--write` replaces the config (keeping the v1 file as
  `fluid.config.v1.json`) and turns the top-level `aliases` setting on, so a
  brownfield migration keeps emitting the v1 custom-property/class names
  (`--fluid-chrome`, `--fluid-column`, `.fluid-frame`) alongside the v2 ones
  until callers are moved over.
- **`calc | probe | verify | audit`** — `calc.mjs`, `probe.mjs`,
  `verify-matrix.mjs`, `audit.mjs` (below), imported in process with the
  remaining args forwarded verbatim (a compiled binary has no node to spawn).

## Distribution: npm, binaries, the skill folder

One source, three ways to run it (`docs/DISTRIBUTION.md` has the reasoning):

- **The skill folder:** `node <skill>/bin/fluid`, what agents run.
- **npm:** `package.json` publishes this folder as `fluid-design-cli` (bin
  `fluid`); tests, the v1 parity fixtures and `build-bin.mjs` are left out.
  `generate-fluid.mjs --check` fails when its version isn't `SKILL_VERSION`.
- **`build-bin.mjs`:** standalone binaries (`bun build --compile` of
  `bin-entry.mjs`) for darwin-arm64/x64, linux-x64/arm64 and windows-x64,
  plus `SHA256SUMS`, into `dist/`. `--target host` builds one, and `--smoke`
  runs the host binary through init, check, calc, explain and audit in a
  project without Node. The runtime files are embedded through
  `lib/emit/runtime-assets.mjs` (generated from `assets/runtime/`), so the
  binary reads nothing from the skill. `verify`, `probe` and `explain --url`
  need Playwright, so the binary refuses them and prints the `npx` command.
  The repo's `.github/workflows/release.yml` runs it on a `v*` tag and
  attaches the output to the GitHub Release, which `install.sh` and
  `install.ps1` at the repo root download from after checking the sha256.

## calc.mjs — the math, with no browser and no live project

```
node calc.mjs table [--w list] [--h list] [--zoom z] [--raw]
node calc.mjs px <N> --unit fluid|<role>|ui --at WxH [--zoom z]
node calc.mjs budget --widths N,N,...
```

Reads the nearest `fluid.config.json` and the settings the project's own CSS
sets at the top level (`lib/context.mjs`'s `loadContext`, the same scan
`fluid check` lints), or `--config`.

- **table** — prints the resolved unit (`fluid`, each role, `ui` if on) for a
  set of viewports, and which arm is binding at each one (`width`, `height`,
  `min`, `max`, or `flat` below the desktop band with the mobile bands off).
  `--w`/`--h` are zipped index-wise into one row per pair when they're the
  same length (the default 11-viewport list is what reproduces
  `fluid-scale.md` §5's "Resolved factors" table); otherwise it's a full
  width × height cross product. `--raw` continues the desktop formula past
  `bands.desktop.minWidth` instead of flattening below it — useful for seeing
  the curve's shape, not what actually ships below the desktop band.
- **px** — prints what a single drawn number renders to at one viewport and
  unit, e.g. `node calc.mjs px 64 --unit display --at 1280x800`.
- **budget** — sums a drawn row of widths and checks it against the content
  budget at the artboard (`min(base-width, container-width) − 2 ×
  container-padding`). PASS if it fits; on OVER it suggests `cqw` fractions of
  the container's content box (`N / (container-width − 2×padding)`) per
  `fluid-scale.md` §4.1's container-query escape.

Exit codes: `0` ok / budget PASS, `1` budget OVER, `2` usage error.

## probe.mjs — one-shot freshness check

```
node probe.mjs <url> [--config f] [--width 1440] [--height 900]
node probe.mjs --help
```

Loads `<url>` in a headless browser at one viewport, reads every registered
`--fluid-*` setting the page's `:root` resolves to a number plus every unit
(`getPropertyValue` returns the unevaluated expression, not a number, so each
unit is measured with a probe element sized `calc(1000 * var(--fluid...))`),
computes what the model expects from those settings, and reads the
`--fluid-build` stamp. Prints a verdict:

- **FRESH** — every resolved unit matches expected within `0.002`, and the
  page's build stamp matches what the current `fluid.config.json` generates.
- **STALE** — a unit drifted, or the build stamp doesn't match. Almost always
  the classic bug, not a code bug: Next dev pushes CSS over the HMR socket, a
  server restart kills that socket, and an already-open tab does not reliably
  re-fetch on reconnect. Safari holds it hardest. Fix: close the tab and open
  a fresh one; if that doesn't clear it, blow away the build cache (`rm -rf
  .next`) and restart the dev server. `--help` prints the full explanation.
- **MISSING** — no unit resolves to anything (wrong URL, a build that
  predates the scale, or it's genuinely not wired up here).

Exit codes: `0` FRESH, `1` STALE, `2` MISSING or usage/invocation error.

## verify-matrix.mjs — the browser harness

```
node verify-matrix.mjs <url> [--config f] [--out dir]
  [--widths 1024,1280,1440,1680,2560] [--heights 640,700,800,900,1440]
  [--mobile 390x844,375x667 | none] [--fit-selector '[data-fit=screen]']   (mobile bands on: 320x568,375x812,390x844,430x932,844x390,932x430,820x1180,834x1194)
  [--screens] [--zoom 1.25,1.5,2 | none] [--zoom-bases 1440x900,1920x1080,2560x1440]
  [--zoom-selector 'main p, p'] [--zoom-strict] [--browser chromium|webkit|firefox]
```

Drives every viewport in the `widths x heights` desktop matrix, plus each
exact `--mobile WxH` pair, and for each one checks:

- **(a) overflow** — `scrollWidth > innerWidth + 1`. On fail, lists up to 10
  offending elements (`rect.right > innerWidth`), shallowest DOM depth first.
- **(b) units** — the page's OWN settings (every registered `--fluid-*`
  custom property it resolves) run through the model, then compared against
  what the page actually renders — the same probe-element technique as
  `probe.mjs`, within `0.002`. A failing row is diagnosed from the
  `--fluid-build` stamp: `missing` (no fluid stylesheet at all), `v1` (a
  stylesheet with no build stamp), `stale` (a stamp that doesn't match what
  `fluid.config.json` generates now), or `mismatch` (current build, wrong
  number — a hand-edited `fluid.css`, or a setting redeclared somewhere
  `fluid check` would catch).
- **(c) fit** — every element matching `--fit-selector` has
  `height <= innerHeight + 1`, checked only at/above `bands.desktop.minWidth`
  (below it the scale is flat and the check is meaningless). Reports the
  height ratio.
- **(d) grid-cols** — `[data-verify-grid]` elements' computed
  `grid-template-columns` track count, compared across every desktop
  viewport (mobile excluded); a `data-verify-grid="responsive"` element is
  reported but never fails the run.
- **(e) screenshots** (`--screens` only) — a full-page PNG per viewport in
  `--out`, plus `contact-sheet.html` tiling all of them with pass/fail
  captions.
- **(f) zoom row** (WCAG 1.4.4) — for each `--zoom-bases` window at or above
  `bands.desktop.minWidth`, the page is loaded under REAL browser zoom: a
  throwaway Chromium profile whose `Preferences` set
  `partition.default_zoom_level` (factor = 1.2^level). The `--zoom-selector`
  text's font-size × zoom is its physical size; a cell passes at >= 0.9 ×
  zoom (capped at 2×) with no horizontal overflow. Needs `channel: 'chromium'`
  (Playwright's full Chromium, i.e. the new headless): the headless shell
  ignores the zoom preference, and on `--browser webkit|firefox` the row is
  skipped outright (it only ever drives Chromium's zoom preference). Warns by
  default; `--zoom-strict` gates the exit code.

When the config sets `--fluid-desktop-scale-max`, one extra desktop viewport
is appended automatically, sized so the natural (uncapped) factor clears the
ceiling by 25% — so the ceiling is always exercised even if every viewport in
`--widths`/`--heights` lands at or below it.

`--browser webkit|firefox` runs the whole matrix (minus the zoom row) in
another engine (`npx playwright install webkit firefox`). WebKit is the
closest a script gets to Safari. Firefox rounds `min()`/`max()` results to
1/60px — the reason the engine's precision form exists.

Writes `report.json` (every check, every viewport) and prints a readable
summary table plus a detail block per failing viewport. Playwright is
resolved from the target project's `node_modules` first (via
`process.cwd()`, i.e. run this from inside the project), then a skill-local
install, then a clear install hint if neither exists.

Exit codes: `0` every check passed, `1` at least one failed, `2` usage error
or playwright could not be resolved/launched.

## audit.mjs — static scanner

```
node audit.mjs <srcDir> [--engage lg] [--json]
node audit.mjs --selftest
node audit.mjs --help
```

Unchanged in shape from v1: walks `<srcDir>` (skipping `node_modules`, `.git`,
`.next`, `dist`, `build`, `.turbo`, `.cache`, `out`) and reports rule
violations, each with a rule id, `file:line`, the offending snippet, a
one-line *why*, and a *fix*. Some rules need repo-wide context (e.g. whether
`@custom-variant dark` is declared anywhere, or whether a `--radius-*: 0`
token is defined) — that context is computed once per scan root, over EVERY
file including this skill's own generated output (`base.css` and friends),
before per-file rules run. Generated files are then skipped by the per-file
rules themselves (scanning generated output for hand-authoring mistakes is
never meaningful) but still feed that shared context.

Rules (severity in parens): `fixed-px-at-engage` (error; info for the
deliberately-excluded border/radius/tracking/max-w properties),
`fixed-px-at-engage-scss` (error/info, the SCSS/vanilla-CSS twin of the
above), `length-times-unit` (error), `dvh-on-scaled` (warn),
`overflow-hidden-x` (warn), `dark-variant` (warn), `rounded-with-zero-token`
(info), `tw-breakpoint-units` (error — a mixed-unit or partial
`--breakpoint-*` set, the Tailwind v4 variant-ordering trap), `img-svg`
(warn), `double-fluid-same-prop` (warn), `type-unit-mismatch` (info).

Motion-specific rules (`motion-strict`, `scroll-well-vs-smooth-scroll`,
`fractional-amount`, `contents-reveal`, `video-attrs`, plus
`lenis-with-scroll-well` and `gsap-pin-with-sticky-scene`) live in the
`scroll-animation` skill's `scripts/audit-motion.mjs`.

`--selftest` runs the scanner over `fixtures/audit/<rule-id>/{positive,negative}`
for every rule and asserts each positive fixture trips the rule and each
negative fixture does not. `--json` prints `{ srcDir, findings }` instead of
the readable table.

Exit codes: `0` no error-severity findings, `1` at least one error-severity
finding, `2` usage error. `--selftest` exits `0`/`1` on pass/fail.

## generate-fluid.mjs — the SKILL's own generator

```
node generate-fluid.mjs            write every generated file this skill commits
node generate-fluid.mjs --check    write nothing; exit 1 if anything is stale, a
                                    fixture breaks an invariant, or v1 parity fails
```

Not a tool for a consuming project — projects run `fluid generate`. This one
regenerates everything in the skill itself that is derived from
`lib/spec.mjs`, so none of it can drift from that one source:

- `assets/fluid.config.json` / `assets/fluid.config.schema.json` — the
  example config at every default, and its JSON Schema.
- `assets/styles/{tailwind-v4,css,scss,stylex}/…` — the reference output for
  each stack at the defaults (`runtime/` excluded; its source is
  `assets/runtime/`).
- `references/config.md` — the structure + settings tables (every row is
  built from `STRUCTURE`/`settingsSpec()` in `lib/spec.mjs`, never hand-typed).

`--check` additionally runs `checkInvariants()` — no `clamp()`/`round()` in
the generated CSS, one `@property` per registered setting, every setting
actually read somewhere in the output, each role's unit present, `--fluid-z`/
`--fluid-ui` present iff `zoom`/`ui` are on, `aliases` followed exactly,
`base.css` presence follows `output.base`, every Tailwind utility family
present iff its `tailwind.utilities.*` flag is on, an integration emitted iff
`output.integration` isn't `none` — over the defaults and every fixture in
`fixtures/configs/`, then runs `test/parity.mjs` (below) as a subprocess.
`npm test` is `generate-fluid.mjs --check && node scripts/test/cli.mjs &&
node scripts/audit.mjs --selftest` — the full no-browser gate.

## lib/ — everything above is a thin CLI over these

- **`spec.mjs`** — the one place every structure key and setting name,
  default, doc string and constraint lives (`STRUCTURE`, `settingsSpec()`,
  `jsonSchema()`, `structureDefaults()`, `RESERVED_ROLE_NAMES`,
  `didYouMean()`). `references/config.md`, the JSON Schema, every
  `@property` default and the settings lint all trace back to this file —
  nothing duplicates a default anywhere else.
- **`model.mjs`** — `normaliseStructure()` (validate + fill defaults),
  `resolveSettings()`/`valuesOf()` (settings + their source), `evaluate()`
  (the maths in JS, mirroring the generated CSS, for `calc`/`explain`/tests),
  `bandAt()`/`bandMedia()`/`exclusiveMedia()`, and `migrateV1()`/`isV1()`
  (v1 config → v2 structure + settings, with human-readable notes on what moved).
- **`settings.mjs`** — `scanDeclarations()` (every `--fluid-*`/`--_fluid-*`
  declaration in a CSS/SCSS file, with its line and selector context) and
  `lintSettings()` (the rules `fluid check` reports: unknown name, bad value,
  range, redundant media query, wrong scope, shadowing). `scanProject()`
  walks every style file under a project root except `output.dir`.
- **`context.mjs`** — `loadContext()`: what every static tool (`calc`,
  `probe`, `verify-matrix`, `explain`) needs in one call — the structure, the
  resolved settings with where each came from, and the output dir. A v1
  config is migrated in memory so these tools work before `fluid migrate`.
- **`emit/engine.mjs`** — the unit engine as CSS: `@property` registrations,
  band parameter blocks, and the formulas (written once, on `:root,
  .<prefix>-scope`). Owns the ×1000 precision form (Firefox rounds a
  `min()`/`max()` result to 1/60px) and the knee (the desktop damping curve
  read at `bands.desktop.minWidth / base-width` instead of a v1-style rounded
  "auto floor"). `min()`/`max()`/`calc()` only — no `clamp()`, no `round()`.
- **`emit/tailwind.mjs`** — the `@theme` breakpoint ladder (the whole sm–2xl
  ladder in px, because Tailwind v4 cannot sort a px override against its own
  rem defaults), `@custom-variant` band variants, the `@utility` vocabulary,
  and `cn.ts` (a `tailwind-merge` config that knows the fluid utility groups).
- **`emit/stacks.mjs`** — the non-Tailwind outputs: plain CSS classes, SCSS
  (`_index.scss`: functions + band mixins, `@use 'fluid' as fd`), StyleX
  helpers, and `fluid.ts` (typed constants + `SETTINGS` table +
  `setFluidSetting()`, shared by every stack).
- **`emit/project.mjs`** — `buildOutput()`: assembles everything `fluid
  generate` writes into `output.dir` (`fluid.css`, `base.css`,
  `settings.reference.css`, `fluid.ts`, plus the stack-specific file,
  `runtime/`, `integrations/`, `README.md`), deterministic and content-hashed
  for the hand-edit guard.
- **`emit/readme.mjs`** — the generated output folder's own `README.md`
  (install, tuning, bands, units, why, file list) — what a developer reads
  standing in `output.dir`, not this file.
- **`v1-math.mjs`** — the FROZEN v1 maths (`factors()`, `mergeConfig()`,
  `resolveFloors()`, `resolveBandFloors()`), used ONLY by `test/parity.mjs`
  to check v2 reproduces v1's numbers. Never imported by the generator or the
  CLI — v2's real engine is `emit/engine.mjs`.

## test/

Run from the skill root unless noted. `generate-fluid.mjs --check` runs
`parity.mjs` itself; the rest are run directly or via `npm test` /
`npm run test:browsers`.

- **`test/parity.mjs`** — v2's model must reproduce v1's numbers for every v1
  config. Each fixture in `fixtures/v1-configs/` (plus the v1 defaults, with
  and without the mobile arm) is migrated to v2 structure + settings and
  evaluated on a viewport × zoom grid, compared against the frozen v1 maths
  in `lib/v1-math.mjs`. Tolerance `1e-9`, except where v1 rounded a type
  floor to 2 decimals — there v2's exact knee value is allowed the documented
  slack (≤ 0.005). No browser. `node scripts/test/parity.mjs`.
- **`test/cli.mjs`** — the `fluid` command end to end, no browser, no
  network: `init` on a throwaway greenfield Next+Tailwind project (the
  config, the one import, the settings starter, every generated file,
  `check` passing clean), `check` catching a typo and a bad unit with a
  did-you-mean, `explain` showing a setting's `file:line` and the resolved
  override, `generate`'s hand-edit guard and `--force`, `settings`,
  `init --brownfield` (prints instead of editing, base off), and `migrate
  --write` on a v1 fixture (detects the stack/integration, turns `aliases`
  on, keeps the v1 file, then `generate` writes the SCSS module and the Vite
  plugin). It also covers a flag-driven `init` (bands, artboard, `--set`
  as declarations, defaults left out, typos and bad values rejected),
  `init --interactive` with scripted answers, a Rails-style project with no
  `package.json` (css stack, output beside the stylesheet, the classic zoom
  script), `explain --set`, a version-mismatched lock, and
  `generate --watch`. `node scripts/test/cli.mjs`.
- **`test/engine-matrix.mjs`** — the generated engine CSS against
  `model.evaluate()`, in real browsers. For each of a set of structures
  (defaults, flat below desktop, zoom off, ui off, a custom role, no
  tablet/landscape, width-only + ceiling, floors set, desktop at a moved
  `minWidth`) plus every migrated v1 fixture, it renders a probe page and
  measures every unit at a viewport × zoom grid. Then, on the defaults: a
  live setting override, an invalid value falling back to its default, and
  the same numbers with `@property` stripped. `node scripts/test/engine-matrix.mjs
  [--browsers chromium,webkit,firefox]` — needs `playwright`, resolved from
  the current directory first, so run it from a project that has it, e.g.
  `cd examples/pizza-next && node ../../fluid-design/scripts/test/engine-matrix.mjs`.
- **`test/tailwind-compile.mjs`** — the generated Tailwind layer through the
  real Tailwind v4 compiler (`@tailwindcss/postcss`): band variants, every
  utility family, a custom role, the container, negatives all compile to the
  expected CSS. Then in a browser: exactly one band variant matches at each
  viewport, and `.fluid-scope` re-scopes a setting to a subtree. Needs
  `tailwindcss`, `@tailwindcss/postcss`, `postcss` and `playwright` in the
  current project — same caveat as `engine-matrix.mjs`, run it from
  `examples/pizza-next`.
- **`test/scss-browser.mjs`** — the SCSS module (`_index.scss`) compiled with
  `sass` and measured in Chromium, WebKit and Firefox against
  `model.evaluate()`: the unit functions, every band mixin, `fluid-scope`,
  `fluid-container`, `fluid-type`, and every limit mixin
  (`fluid-grow-until`, `fluid-shrink-until`, `fluid-ui-grow-until`,
  `fluid-off`). Run it from `examples/pizza-vite-gsap` (sass + playwright).
- **`test/explain-live.mjs`** — `fluid explain --url` against a served page:
  the scopes report (a limit with nothing fluid inside must warn), `--at`,
  and `--at` with no match. Needs playwright.

## fixtures/

- **`fixtures/v1-configs/`** — real v1 `fluid.config.json` files (`canvas-
  gutter-ceiling`, `chrome-disabled`, `mobile-arm`, `utilities-flipped`,
  `width-only`, `zoom-off`), each a genuine v1 shape. Consumed by
  `test/parity.mjs`, by `generate-fluid.mjs --check` (migrated then checked
  against the same invariants as any v2 structure), and by
  `test/engine-matrix.mjs`.
- **`fixtures/configs/`** — v2 structures exercising the less-default corners
  (`custom-role`, `flat-below-desktop`, `moved-breakpoints`, `phone-only`,
  `scss-vite`, `stylex-next`, `tailwind-minimal`, `ui-off`, `zoom-off`,
  `css-aliases`), each checked against `generate-fluid.mjs --check`'s
  invariants.
- **`fixtures/audit/<rule-id>/{positive,negative}/`** — one isolated
  directory pair per audit rule, consumed by `audit.mjs --selftest`.
