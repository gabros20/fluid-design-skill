# fluid-design v2: fix and refactor plan

This plan covers every finding of the September 2026 review. Four parallel reviews covered
the engine, Tailwind and the runtime, drift and logic, and leanness. I reproduced the headline
findings myself. For each problem it gives the constraints that decide it, the options
considered, and the chosen solution with the reason. §3 is the phased plan, §4 the breaking
changes, §5 the verification.

"Verified" means reproduced by experiment. "Reasoned" means read from code or spec but not
run.

## 1. Constraints every decision respects

- **C1.** Every tuning number stays a CSS variable, and structure stays in JSON. The CSS uses
  no `clamp()` and no `round()`, only min/max/calc in the ×1000 form.
- **C2.** The model (`model.mjs`) and the engine must stay term-for-term equal. Parity with v1
  holds except where it's documented.
- **C3.** Agents run non-interactively, and people run the CLI through npx or the binary. The
  CLI stays zero-dependency and compiles with `bun --compile`.
- **C4.** v2 is unreleased (2.0.0, not published). Breaking changes are allowed now and will
  cost more later. Eagle stays on its hand-maintained v1 CSS and isn't touched.
- **C5.** The scroll-animation skill shares a contract with this one: the desktop breakpoint,
  `--header-h`, `translate`, and `fluidPx`. Any change there lands in both skills together.
- **C6.** Browser floor for the Tailwind stack: Tailwind v4's own floor (Safari 16.4, Chrome
  111, Firefox 128). For the CSS, SCSS and StyleX stacks: as low as the unit itself allows.

## 2. Problems, options, decisions

### P1 (high, verified): Safari resize cost from the `--_fluid-m-*` mirrors

**The problem.**
- Four `@property` lengths (`inherits: true`) mirror the units on `:root` and on every scope,
  so `fluidPx(n, unit, el)` can read a unit at one element.
- Their values depend on the viewport. WebKit therefore re-resolves them on every element on
  every resize.

| Per resize step (width / height) | WebKit | Chromium |
|---|--:|--:|
| Plain px page | 3.4 / 0.0 ms | |
| The same page loading `fluid.css` | 13.9 / 15.7 ms | |
| A fluid page with 50 limit scopes | 44.9 / 58.9 ms | about 5 ms |
| The same fluid page, mirrors removed | 10.3 / 8.6 ms | about 5 ms |
| The same fluid page, mirrors not inherited | 11.3 / 9.5 ms | about 5 ms |

**It's also wrong for SCSS.** The SCSS `fluid-scope` mixin never declares the mirrors, so
inside an SCSS scope `fluidPx(…, el)` reads the page's value, not the scope's (found while
checking this).

**Options.**

| Option | Verdict |
|---|---|
| a. Keep inheriting mirrors, and document the cost | ✗ 3–4 dropped frames per resize step in Safari on a normal page |
| b. No mirrors; `fluidPx(el)` appends a probe child inside `el` and measures it | ✗ Forces a layout per call and mutates the DOM mid-animation. It can't probe inside `<img>`, `<svg>` or `<video>`, or inside a `display: contents` element |
| c. Unregistered mirrors | ✗ Their computed value is an unresolved token string, not a length |
| **d. Mirrors with `inherits: false` and `initial-value: 0px`; `fluidPx(el)` walks up from `el` to the first ancestor whose mirror is non-zero** | ✓ |

**Decision: d.**
- A non-inherited property has no cascade cost on elements that don't declare it (measured
  11.3 / 9.5 ms, the same as having no mirrors).
- `0px` is a clean "not a scope" sentinel, since a real unit is never 0.
- The walk costs one `getComputedStyle` per ancestor, only on the explicit `el` call path,
  which is already documented as "cache per frame".
- The walk finds scopes made by a class, an attribute, or an SCSS/StyleX mixin alike, because
  it reads the declared value rather than matching a selector.
- The SCSS and StyleX scope helpers must emit the mirror declarations too.

**Also.** `references/performance.md` gets WebKit numbers next to the Chromium ones. The
engine matrix gains a test that `fluidPx` matches a mixin scope.

### P2 (high, verified): `fluid-translate-x/y-*` alone doesn't move anything

**The problem.** The utility writes `translate: var(--tw-translate-x) var(--tw-translate-y)`.
Tailwind registers those two variables (initial value 0) only when a core `translate-*` class is
used somewhere. Otherwise the declaration is invalid and computes to `none`.

**Options.**
- **a. Our own `@property --tw-translate-*`.** This duplicates Tailwind's registration, which
  lives in `@layer properties` with a `@supports` fallback for older Safari. Two registrations
  must agree forever. ✗
- **b. Write `translate` with fallbacks:** `var(--tw-translate-x, 0) var(--tw-translate-y, 0)`.
  It composes with core translate classes when they're present and stands alone when they
  aren't. ✓

**Decision: b,** for the negative forms too. The Tailwind compile test gets a page with only
`fluid-translate-y-24`.

### P3 (high, verified): Windows line endings or a formatter make generated files look hand-edited

**Constraints.** The standalone binary targets Windows, and Git's `core.autocrlf` is on by
default there. Prettier or Biome on pre-commit is common. The hand-edit guard must still catch
real edits.

**Options.**

| Option | Verdict |
|---|---|
| a. Normalise `\r\n` → `\n` before comparing and hashing | ✓ Fixes CRLF. Doesn't fix a formatter |
| b. Generate a `.gitattributes` in `output.dir` (`* -text linguist-generated`) | ✓ Git honours nested attribute files, so the bytes stay as generated on checkout |
| c. Add `output.dir` to the project's formatter ignore list at init (`.prettierignore`, `biome.json` `files.ignore`) when that formatter is present | ✓ The only reliable fix for formatters, since Prettier has no file-level ignore comment for CSS |
| d. Compare after whitespace normalisation | ✗ Formatters also change quotes and wrapping, and normalising more hides real edits |

**Decision: a + b + c.**
- When no formatter config is found, init stays quiet.
- `fluid check`: when a "hand-edited" diff is formatting-only (equal once all whitespace and
  quotes are removed), it says "reformatted by a formatter" and names the ignore file to add,
  instead of "edited by hand".

### P4 (high, verified): the settings lint misreads real CSS

Four cases, all verified:
- `@layer base { :root {…} }` is flagged, and `explain` ignores the value.
- `:root, .light {…}` is flagged.
- The CSS/SCSS scope patterns the docs recommend are flagged: a rule plus `data-fluid-scope`,
  or `@include fd.fluid-scope`.
- A project's own `--fluid-space-s: 12px` is a hard error.

**Constraints.**
- `--fluid-*` isn't a reserved namespace, and existing sites use it.
- The lint must stay regex/tokeniser-level: zero dependencies, CSS and SCSS.

**Decisions.**
1. **Scanner:** a small block tokeniser that tracks nesting.
   - `@layer`, `@supports` and the SCSS `&`-free nesting are transparent.
   - `@media` and `@container` are recorded as conditions, which gives an info-level "settings
     are per band already" note.
2. **Selectors:** split the list on commas.
   - An unconditional part (`:root`, `html`) counts as root for `explain`.
   - A qualified part (`:root.dark`, `html[data-theme=x]`, `.light`) is a variant. `explain`
     lists it but doesn't apply it, and the lint says nothing.
3. **Scopes:** a rule counts as a scope, with no warning, when:
   - its selector contains `fluid-scope`, `data-fluid-scope` or a limit class; or
   - its block contains `@include <ns>.fluid-scope` or any limit mixin; or
   - (CSS stack) the setting sits next to a documented marker comment. The marker is optional:
     without it, the note is info-level, "applies only where this element is also a scope".
4. **Unknown `--fluid-*` names:**
   - **Error** only when the name is within edit distance 2 of a real setting (a typo) or is an
     engine-owned unit (`--fluid`, `--fluid-ui`, …), which would override the engine.
   - Otherwise **info**: "not a fluid-design setting; fine if it's your own token (consider
     another prefix)".
5. **Messages:** the whole-number error says "must be a whole number" (not "0 or 1") except for
   `fit-height` and `off`.

### P5 (high, verified): `generate --watch` dies on the first invalid save

**The cause.** `fail()` calls `process.exit` deep inside `project()` and `cmdGenerate()`.

**Decision.** A `CliError` class, thrown everywhere. Only `run()` turns it into a message and
an exit code.
- The watcher catches it, prints it, and keeps watching.
- A half-written JSON file retries on the next change event.

This also makes `init` transactional (P14) and the CLI testable in process.

### P6 (high, reasoned): the Chromium zoom heuristic reads a side panel as zoom

**The problem.** It matches `outerWidth/innerWidth` against `dpr/native` only.
- A Windows laptop at 125% display scaling with a side panel about 20% wide gives r = 1.25,
  which matches dpr 1.25 / native 1.0.
- Other plausible false hits: 150% scaling with a 1/6 panel, 200% with a 25% panel, a retina
  Mac with DevTools docked at 50%.

**Options.**
- **a. Also require the height axis to agree.** Zoom shrinks `innerHeight` by the same factor;
  a side panel or right-docked DevTools doesn't. Accept z only if
  `outerHeight − innerHeight × z` is a real toolbar height, 0–200 window px. This is the check
  the Safari path already uses. ✓
- **b. `visualViewport.scale`.** This is pinch-zoom, not page zoom. ✗
- **c. `matchMedia` resolution.** Same entanglement as dpr. ✗

**Decision: a.**
- DevTools docked at the bottom with real zoom fails the check and reads 1. That's the
  documented safe failure: uncompensated, never inflated.
- Add unit-level fixtures for the known false-positive geometries: a table-driven test of
  `detect()` with stubbed window values, runnable in Node.

### P7 (medium, reasoned): Next `<FluidHead>` causes a hydration warning and no CSP support

**The problem.**
- The script writes an inline `style` on `<html>`, even `--fluid-zoom: 1`. React 19 flags
  extra attributes on `<html>` in development.
- There's no `nonce`, so a strict CSP blocks the script.
- The inline text comes from `Function.prototype.toString`, so no stable hash is possible.

**Options for where the value lives.**

| Option | Verdict |
|---|---|
| a. `documentElement.style`, written only when z ≠ 1, plus docs saying to add `suppressHydrationWarning` | ✗ Still warns for zoomed users, and pushes an edit onto `layout.tsx` |
| b. An injected `<style>` element in `<head>` | ~ React 19 tolerates extra head nodes, but it's a DOM node and needs `style-src` |
| **c. A constructable stylesheet, `document.adoptedStyleSheets`, with `:root { --fluid-zoom: z }`** | ✓ |

**Decision: c, falling back to (a) when `adoptedStyleSheets` is missing** (before Safari 16.4
or Firefox 101, which are below the Tailwind floor anyway).
- It changes no DOM, so React sees no attribute and there's no hydration warning at all.
- A CSSOM `replaceSync` isn't an inline style, so `style-src` doesn't apply.

**CSP.**
- `FluidHead({ nonce })` passes the nonce through, with the usual `headers().get('x-nonce')`
  pattern for Next middleware in the docs.
- Generation writes the inline script as a **string literal** and exports
  `FLUID_ZOOM_SHA256`, so a hash-based CSP works and minifiers can't change it.
- The same literal feeds `zoom.classic.js`, so one source produces three shapes.

**Priority.** `adoptedStyleSheets` rules sit in the author origin after document sheets.
`--fluid-zoom` is runtime-owned, so nothing competes with it.

### P8 (medium, verified): browser floor and range media syntax

**The problem.**
- The engine bands use `(width >= 600px)`, which needs Safari 16.4. On Safari 15.4–16.3 every
  band query is dropped, so the phone band applies at every width: the desktop renders as a
  616px phone column.
- No doc in `references/` states a floor.

**Decision.**
1. The engine emits classic syntax, `(min-width: 600px)` and
   `(orientation: landscape) and (max-height: 500px)`.
   - The engine's bands cascade on lower bounds only, so they need nothing more. Exclusive
     queries (the SCSS/StyleX band mixins, the README) need an upper bound.
     `(max-width: 1023.98px)`, Bootstrap's approach, leaves a 0.02px gap at fractional widths on
     zoomed or HiDPI screens. The exact complement in classic syntax is a nested
     `@media not all and (min-width: 1024px)` inside the band's lower bound. Nested conditional
     rules are supported everywhere `svh` is, so exclusive bands use that, with no gap and no
     overlap.
   - That drops the CSS/SCSS/StyleX floor to what `svh` needs: Safari 15.4, Chrome 108,
     Firefox 101.
   - Tailwind's `@custom-variant` output uses the same syntax, which is harmless.
2. **No `svh` fallback.** A `@supports not (height: 1svh)` block would add a variable to every
   formula for browsers with under 0.1% share in 2026, against C1's leanness. We state the
   floor instead.
3. **Where `@property` is missing** (before Firefox 128, Safari 16.4, Chrome 85), the `var()`
   fallbacks produce the correct numbers (verified). Only "an invalid value falls back to the
   default" is lost, so we document that.
4. **A stated floor per stack** goes in `references/contract.md` §0 and the README table.
   `docs/REVIEW-2026-09.md` gets corrected.

### P9 (medium, verified): generic variable names clobber a site's own

**The problem.**
- The engine declares `--header-h`, `--safe-top`, `--safe-bottom` and `--browser-bar` unlayered
  on `:root` and on every scope.
- A site's own `--header-h` loses, even inside a scope.

**Options.**
- **a. Declare them in `@layer`.** Unlayered site CSS would win, but then the engine's own
  consumers read the site's meaning. It swaps one collision for another. ✗
- **b. Namespace them:** `--fluid-header-h`, `--fluid-safe-top`, `--fluid-safe-bottom`,
  `--fluid-browser-bar`. ✓

**Decision: b.** Everything prefixed `--fluid-` is ours, which is also the rule the lint (P4)
relies on.
- **v1 names:** `aliases: true` (set by `fluid migrate`) also emits `--header-h`, `--safe-top`
  and `--safe-bottom`.
- **scroll-animation (C5):** it reads `var(--fluid-header-h, var(--header-h, 0px))`, so it works
  against both a v2 engine and a v1 or hand-made site like Eagle. Its docs and fixtures follow.
- **Examples** are updated.

### P10 (medium, verified): band variants vs breakpoints, and the breakpoint ladder vs a site's own

**The problems.**
- Tailwind orders every `@custom-variant` after every breakpoint variant.
  - `fluid-desktop:p-40 xl:p-60` stays at 40 on an XL screen.
  - `fluid-tablet:a md:b` resolves to `a` at 800px.
  - Nothing in Tailwind v4 lets a custom variant sort between breakpoints.
- The generated `@theme` ladder silently replaces a site's own `--breakpoint-*`. A site's
  rem-based rung sorts after the px ladder, so `md:` then overrides `2xl:`.

**Options for the variants.**

| Option | Verdict |
|---|---|
| a. Express bands as breakpoints (`--breakpoint-fluid-tablet: 600px`) | ✗ min-width only, which loses exclusivity; landscape isn't a width at all |
| b. Keep the variants and document the rule | ~ necessary, not sufficient |
| **c. Remove `fluid-desktop:`, keep phone, tablet and landscape, and lint mixing** | ✓ |

**Why c.** `fluid-desktop:` is byte-for-byte `lg:` (the ladder sets `lg` to the desktop band),
and it's the variant most likely to be mixed with `xl:` and `2xl:`.
- The three mobile variants exist for what breakpoints can't express: an exclusive band, and
  orientation plus height.
- New audit rule `band-variant-with-breakpoint`: the same utility property on one element under
  a band variant and a breakpoint variant. For example `fluid-tablet:p-4 md:p-8`, or
  `fluid-phone:hidden sm:block`. It reports that band variants always win, and suggests
  `max-lg:` / `md:max-lg:` or one system.
- A new README section, "Band variants vs breakpoints".

**The ladder.**
- `fluid init` scans the project's CSS for `--breakpoint-*`. If it finds any, it sets
  `tailwind.breakpoints: "none"` and says so. The existing check that `lg` equals
  `desktop.minWidth` stays.
- `fluid check` flags `--breakpoint-*` redeclared anywhere while `breakpoints` is `ladder`.
  That's an error: the mixed units reorder the variants.
- The generated `@theme` block explains all of this in one comment line.

### P11 (medium, verified): decimals and bracket values compile to nothing, and `cn` drops working classes

**The problem.**
- Tailwind v4 accepts bare numbers only in 0.25 steps.
- `fluid-p-8.3` and `fluid-p-[37]` emit nothing, but `cn`'s validator accepts both. So
  `cn('fluid-p-24 fluid-p-8.3')` silently drops the working class.
- The line-height modifier `/1.5` becomes 1.5 drawn px.

**Decisions.**
1. **Every value family:** `--value(--fluid-step-*, number, [number])`, so `fluid-p-[8.3]` and
   `fluid-p-[37]` work. The same goes for `--modifier(…)`.
2. **The `cn` validator** accepts exactly what compiles: integers and 0.25 multiples bare, and
   any non-negative number in brackets. A class that wouldn't compile isn't recognised, so it
   can't evict a working one.
3. **Modifiers stay drawn px** (consistent: every number in the system is drawn px).
   - New audit rule `fluid-leading-ratio`: `fluid-(text|role)-N/M` with M < 4 warns "that's M
     drawn px of line height; for a ratio use `leading-[1.1]`".
   - The docs state it.
4. **Role names** are validated against the full utility family list (P21).

### P12 (medium, verified): a missing lock overwrites hand edits, and orphans are deleted blind

**Decision.**
- **No lock but files present:** `generate` refuses with a file list unless `--force`. The one
  exception is a file whose normalised content equals the new output with only the version
  stamp different, which is a plain upgrade.
- **Orphans:** removed only when their hash equals the lock's. An edited orphan is kept, with a
  warning.

### P13 (medium, reasoned): `explain --url --zoom` reports false drift

**Decision.**
- Before measuring, set `--fluid-zoom` on the page to the flag value, so the model and the page
  see the same input.
- Label it "emulated zoom (the runtime's variable), not browser zoom". `verify` covers real zoom.
- Validate `--zoom` as a finite number between 0.25 and 5, like `parseWxH`.

### P14 (medium, reasoned): `init --force` is not safe

**Decision.** Init builds everything in memory first: config, output, globals edit.
- It runs the hand-edit guard on the target folder before writing anything.
- `--force` then also forces generate.
- A v1 config is backed up to `fluid.config.v1.json`, exactly as `migrate --write` does.

### P15 (medium, reasoned): project detection gaps

**Decision.**
- **Tailwind version:** read `tailwindcss`'s version range. For `^3` or `~3`: stack `css`, with
  a note that "Tailwind v3: fluid utilities need v4; use `var(--fluid)` in arbitrary values".
- **More candidate stylesheets:** `app/globals.scss`, `src/app/globals.scss`,
  `styles/globals.scss`.
- **Brownfield test:** a real tokeniser pass (the P4 scanner) looks for any top-level rule
  whose selector list starts with `html` or `body`, qualified or not.
- **Insertion points:** the P4 tokeniser also finds the import point (after `@charset` and after
  any `@import`/`@use` layer header, never above `@charset`) and the first `:root` at nesting
  depth 0.

### P16 (medium, reasoned): `probe` and `verify` ignore a v1 config's migrated numbers

**Decision.** When the config is v1, the expected settings are `ctx.resolved` (the migrated
values), because a v1 page carries no v2 settings. For v2, the page's live settings stay the
truth. This lands once, in the shared live module (S1).

### P17 (medium, reasoned): `audit` ignores the config

**Decision.**
- `audit` loads the context when a config exists, so the prefix and desktop variant come from
  the config (`lg:` only, after P10).
- `--engage` is renamed `--desktop-variant`, with `--engage` kept as a silent alias.
- A test covers a custom-prefix fixture.

### P18 (medium, verified): some forms of limit class don't create a scope

**The problem.**
- `fluid-off!` and `!fluid-off` (Tailwind's important forms) aren't matched.
- `[--fluid-grow-until:1680]` (an arbitrary property) sets the value but isn't a scope.
- `*:fluid-off` puts the class on the parent, but the rule applies to the children.
- False positive: `[class*=":fluid-off"]` matches `lg:fluid-offset-4`, which contradicts the
  comment above it.

**Decision.** The scope selector becomes:
- `[class~="fluid-off"]` and `[class~="fluid-off!"]` / `[class~="!fluid-off"]`
- variant forms: `[class*=":fluid-off "]`, `[class$=":fluid-off"]`, and the same with `!`
- the grow/shrink/ui substrings as now
- **new:** `[class*="[--fluid-"]`, so any arbitrary property setting a fluid setting makes its
  element a scope. That is correct, and it's cheap.

**`*:` variants** can't be matched honestly (it would take `[class*="*:fluid-"] > *` for every
limit). Instead, the audit rule `limit-on-children` flags them.

**Measured:** a false-positive scope costs recalc, not correctness. Selectors are prefix-aware
as today.

### P19 (low-medium, verified): an artboard of 0 at runtime collapses the page

**The problem.** `--fluid-desktop-base-width: 0` is a valid `<number>`, so it reaches the
formula: `x / 0` gives NaN, which resolves to 0 and removes all spacing.

**Decision.** The engine reads `max(1, var(--fluid-<band>-base-width, N))`, and the same for
`base-height`, on the four reads. The lint already rejects values below 1 statically. This
covers the "set it live in devtools" path.

### P20 (low, reasoned): runtime housekeeping in `fluid-units.js`

**Decisions.**
- Keep one ResizeObserver and disconnect it when the probes are rebuilt.
- Don't mark the cache dirty on `window.resize`. The units depend on `svh`, not on the iOS
  toolbar. Rely on the probe ResizeObserver, which fires only when a unit's value changes. That
  removes a forced layout mid-scroll on iOS.
- `fluidUnits()` returns a frozen copy.
- Document that without `@property` (before Firefox 128), reads at an element fall back to the
  page's units.

### P21 (low, verified): role names can collide with utility families

**The problem.** `min-w`, `ui-text` and `gap-x` pass validation, which creates duplicate
`@utility` names and puts one class in two merge groups.

**Decision.** `RESERVED_ROLE_NAMES` is derived from the generated utility family list plus the
existing reserved words, so it can't drift. Did-you-mean errors are included.

### P22 (low, verified): other small issues

- **Header-limit regex:**
  - It misses when an attribute before `className` contains `=>`.
  - It matches inside a `data-*` string.
  - It becomes the audit rule `header-limit` (S6), using a JSX/HTML tag scanner that respects
    braces and quotes, and matching only in `class`/`className` values and `cn(…)` arguments.
- **`verify-matrix` usage text:** the default mobile list is corrected, and "mobile arm" is
  removed.

### P23 (docs, verified): documentation drift

- `verification.md:105`: `explain --url` example is missing `<W>x<H>`.
- **Zoom head script:** one story everywhere. Next/Vite use the integration; anything else uses
  `runtime/zoom.classic.js` (or the `FLUID_ZOOM_INLINE` literal). Fix SKILL.md, `preflight.md`
  L165, `verification.md` L67 and `fluid-scale.md` L477. `zoom.js`'s own comment names the v1
  path.
- **`section-recipe.md:101`:** SCSS example without the `fd.` namespace, and using
  `fluid-up` (P-S3).
- **`contract.md:60`:** the global settings list is missing the limits, and `zoom-text-*` is
  wrongly listed for the css stack.
- **`spec.mjs` doc strings:** "(v1 engageAt)" moves to the migration notes.

## 3. Simplifications (the leanness review), decided

| # | Change | Decision and reason |
|---|---|---|
| S1 | Merge `probe` into `explain --url`, and share `lib/live.mjs` | **Do it.** One Playwright resolver instead of three copies, and one live reader (units, settings, build stamp, scopes) used by `explain` and `verify`. `explain --url` gains probe's verdicts (OK / MISSING / V1 / STALE / MISMATCH) and exit codes. `fluid probe <url>` stays one release as an alias printing the new command. About −330 lines and one fewer tool to learn. |
| S2 | Settings from 49 to 35 | **Do it.** (a) Drop the phone, tablet and landscape `*-floor` settings (−6). They're new in v2 and unused, and the knee already equals scale-min there, so a mobile floor can only bind above scale-min, which damping expresses better. The desktop floors stay (v1 migration). (b) Tablet and landscape `container-width`, `container-padding` and `header-height` become unregistered, reading `var(--fluid-tablet-…, var(--fluid-phone-…, default))`: "set mobile once, override a band if needed" (−6 registered). (c) Keep `zoom-text-full/none`: they're a design choice (which text counts as display), not a measured constant. Removes 3 private variables per mobile band block. |
| S3 | Every v1 name follows `aliases` | **Do it.** `fluid-up` (SCSS), `ENGAGE_PX`/`ENGAGE_QUERY`, the runtime's `chrome` alias and the new `--header-h`/`--safe-*` (P9) are emitted only with `aliases: true`. The v1 prose (~65 mentions) moves to `brownfield-migration.md`. Eagle is unaffected: it isn't generated. scroll-animation's own `chrome` alias stays in its copy. |
| S4 | Deduplicate generated output | **Partly.** Keep `settings.reference.css`, now that people use the CLI by hand: it's the copy-a-line reference for people without the CLI at hand. The generated README links to it instead of repeating the list. Keep the four reference stacks in the skill: agents read `_index.scss` and `fluid.stylex.ts` to learn those APIs, and `generate --check` keeps them honest. The cost is repo size only. |
| S5 | Deduplicate the docs | **Do it.** `contract.md` §1 and `fluid-scale.md` §8 point at the generated `config.md`. The zoom measurement diary (~90 lines) moves to `docs/zoom-measurements.md`. The stale-stylesheet story lives once, in `verification.md`, and the others link to it. `scripts/README.md` stays but is left out of the npm package. |
| S6 | One source scanner | **Do it.** `check`'s source scans become audit rules: `header-limit`, `cn-without-withfluid`, and the new `band-variant-with-breakpoint`, `limit-on-children` and `fluid-leading-ratio`. They share audit's walker, comment masking and fixture self-test. `check` runs audit's rule set with the project context, so there is one scanner with self-tests. |
| S7 | Shorter formulas | **Measure, then decide.** Register the intermediates that don't depend on the viewport (scale min/max × 1000, the knee, the in-band limit flags) as `<number>` on `:root` and scopes. They never change on resize, so they carry no recalc cost, and the expanded `--fluid-display` shrinks from about 1,300 characters. Adopt only if WebKit and Chromium resize time drops by at least 15% with parity intact. Otherwise record the measurement and keep the current form. |

## 4. Phased plan

Each phase is committed separately and verified before the next (§6).

**Phase 1: engine and cross-skill contract** (P1, P2, P8, P9, P18, P19, S2, S3 engine part)
- `engine.mjs`:
  - non-inheriting mirrors with `0px`
  - classic media syntax plus the `.98` upper bound
  - namespaced variables, with the v1 names under `aliases`
  - the new scope selector forms
  - the base-width/height guard
  - fewer mobile settings
- `stacks.mjs`: the SCSS and StyleX scope helpers declare mirrors. `fluid-up` and the aliases
  move under `aliases`.
- `tailwind.mjs`: translate fallbacks.
- `spec.mjs` + `model.mjs`: the settings changes, applied term for term (C2).
- `fluid-units.js`: the `fluidPx(el)` ancestor walk (P1), plus the P20 housekeeping.
- **scroll-animation** (C5):
  - `--fluid-header-h` with the `--header-h` fallback
  - its `fluidPx` mirror uses the walk
  - docs, smoke test and distance check follow

**Phase 2: runtime and integrations** (P6, P7)
- `fluid-zoom.js`: the height cross-check, plus `adoptedStyleSheets` with a fallback.
- The script is generated as a literal, and `FLUID_ZOOM_SHA256` is exported.
- `FluidHead({ nonce })`. The Vite plugin accepts `{ nonce }` for `transformIndexHtml`.
- A node test of `detect()` with stubbed window values for the false-positive geometries.

**Phase 3: CLI robustness** (P3, P5, P12, P13, P14, P15, P16)
- `CliError` everywhere, and a resilient watcher.
- CRLF normalisation, the nested `.gitattributes` and formatter-ignore at init, and the
  formatting-only diagnosis.
- Lock-missing and orphan safety.
- Emulated zoom for `explain`.
- Transactional init.
- Detection: the Tailwind version, SCSS candidates, the tokeniser-based insertion.
- `lib/live.mjs` (S1) with v1-aware expectations. `probe` becomes an alias.

**Phase 4: lint and audit unification** (P4, P10 lint, P11 lint, P17, P21, P22, S6)
- `settings.mjs`: the tokenizing scanner, selector lists, scope recognition, and the
  typo-distance policy.
- `audit.mjs`: context-aware. The new rules come with positive/negative fixtures, plus the moved
  `check` scans.
- `check` runs audit's rules with the project context.

**Phase 5: Tailwind layer** (P10, P11)
- `fluid-desktop:` is removed. Ladder detection at init and check.
- `[number]` values and modifiers, and the exact `cn` validator.
- Role-name reservation from the family list.

**Phase 6: docs** (P8 floor, P23, S5)
- Browser floor per stack. The drift fixes. The deduplication and the moved diary.
- New sections: "Band variants vs breakpoints", CSP / nonce / hash, the formatter ignore, and
  the lint policy for your own `--fluid-*` tokens.
- `SKILL.md` and the evals are updated for the renamed variables and the removed variant.

**Phase 7: tests, CI, examples** (and S7)
- **Engine matrix:**
  - a scoped case, measured inside a limit scope and inside a mixin scope, comparing `fluidPx`
    against the model
  - a no-`@property` row
  - a Safari resize performance guard: the median resize step on a fixed 2,000-element page,
    in WebKit, below a threshold of 2× the plain-px baseline
- **CLI test:** CRLF, a formatter-reformatted file, a missing lock, watch surviving an invalid
  save, `init --force` over v1, Tailwind 3 detection, `@charset` insertion.
- **Audit fixtures** for every new rule. **Tailwind compile test:** lone translate, decimals,
  brackets, and a `cn` case with a non-compiling class.
- **CI:** a browser job that installs both examples' dependencies and the Playwright browsers,
  then runs `npm run test:browsers`. Plus a Windows and macOS matrix for the binary smoke test,
  CRLF included.
- **Examples:**
  - rename to `--fluid-header-h` where used
  - regenerate, rebuild, and run `verify` in 3 browsers, `verify-motion`, the anchor check and
    scroll-animation `npm test`
- **S7** measurement and decision, recorded in `performance.md`.

## 5. Breaking changes (v2 is unreleased, so none reach a published user)

| Change | Who is affected | Migration |
|---|---|---|
| `--header-h`, `--safe-top`, `--safe-bottom`, `--browser-bar` → `--fluid-*` | v2 projects reading them directly; scroll-animation | `aliases: true` keeps the old names; scroll-animation reads both |
| `fluid-desktop:` removed | v2 markup using it | Replace with `lg:`. The audit rule points it out |
| Mobile `*-floor` settings removed | v2 CSS setting them | The lint names the replacement: `*-damping` or `scale-min` |
| Tablet/landscape container and header settings unregistered | none (setting them still works) | none |
| `fluid-up`, `ENGAGE_*`, `chrome` only with `aliases` | v1-style code without `migrate` | `fluid migrate` sets `aliases: true` |
| `fluid probe` → `fluid explain --url` | scripts calling `probe` | the alias prints the new command for one release |

## 6. Verification, per phase and at the end

- `npm test`: generate `--check` (parity, invariants, drift), the CLI test, the audit self-test.
- `npm run test:browsers`: the engine matrix, including scopes and the no-`@property` row; the
  Tailwind compile test; the SCSS browser test; `explain-live`. All in Chromium, WebKit and
  Firefox.
- **The WebKit resize guard (P1):** on the review's 50-scope page, at most 12 ms per width step,
  down from 45.
- **Both examples:** build, `fluid check`, `verify` in 3 browsers, `verify-motion`,
  `anchor-check`, and geometry equal to before at 390×844 and 1440×900 (except the intended
  `--fluid-header-h` rename).
- **scroll-animation:** `npm test`.
- **Binary:** the build-bin smoke test on macOS here, and Windows and Linux in CI.
- **The review's reproductions become regression tests.** Each verified finding above gets a
  test that fails before its fix and passes after.
