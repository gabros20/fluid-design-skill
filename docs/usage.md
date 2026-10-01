# Usage: the by-hand guide

This is the path without an agent: you run the `fluid` CLI, commit what it generates, and write
your design's numbers through the fluid units. An agent with the skill runs the same commands
([With an agent](#with-an-agent)).

In a Node project there is nothing to install: run `npx fluid-design-cli@2 init`, and after that
`npm run fluid -- <command>` (init adds the script). Without Node, install the binary and run
`fluid <command>` ([installation.md](installation.md)). Below, `fluid` stands for either.

Words used here:

- **design frame** (artboard): the frame the designer draws in, 1440×900 for desktop and 390 wide
  for phones by default.
- **`--fluid`**: the unit, 1px at the design frame's size, growing and shrinking with the window.
- **band**: a range of window sizes with its own design: phone, tablet, landscape (a phone on its
  side), desktop.
- **type role**: a size curve that shrinks more gently than the layout: `display` (headlines),
  `copy` (body text, labels).
- **structure** is which rules exist (`fluid.config.json`, needs `fluid generate`); **settings** are
  the numbers in them (CSS variables in your `:root`, live). Every option lives in exactly one of
  the two, so one change never means editing both. A number goes in `:root` only.

## Contents

1. [Set up: `fluid init`](#1-set-up-fluid-init)
2. [Use the scale](#2-use-the-scale)
3. [Limits: stop part of the page scaling](#3-limits-stop-part-of-the-page-scaling)
4. [Tune: settings are CSS variables](#4-tune-settings-are-css-variables)
5. [See what a window gets: `explain` and `verify`](#5-see-what-a-window-gets-explain-and-verify)
6. [Change the structure](#6-change-the-structure)
7. [Check it in CI](#7-check-it-in-ci)
8. [Browser support](#browser-support) · [Editor support](#editor-support) · [With an agent](#with-an-agent)

## 1. Set up: `fluid init`

Run it at the project root. On a terminal it asks up to ten questions, each with a default detected
from the project; Enter keeps it:

| Question | Becomes | Kind |
|---|---|---|
| Styling: tailwind-v4, css, scss or stylex? | `output.stack` (Tailwind 3 gets `css`: the utilities need Tailwind 4) | structure |
| Framework: next, vite or none? | `output.integration`: `<FluidHead />`, `fluidPlugin()`, or a classic `zoom.classic.js` | structure |
| Global stylesheet | where the import and your settings go (empty: print them) | — |
| Does the site already style `html` and `body`? | `output.base: false` (no base layer) | structure |
| Desktop design frame, width x height | `--fluid-desktop-base-width` / `-base-height` | setting |
| The desktop layout starts at | `bands.desktop.minWidth` (and Tailwind's `lg:`) | structure |
| Scale the phone, tablet and landscape layouts too? | the mobile bands on, or 1px below desktop | structure |
| Phone design frame width | `--fluid-phone-base-width` | setting |
| The page stops widening at | `--fluid-desktop-container-width` | setting |
| Generated files go in | `output.dir` | structure |

**Read the frame answers off the design file.** The defaults are only fallbacks:

| Answer | Read it from |
|---|---|
| Desktop design frame | the desktop frame's width × height (1440×900, 1680×1050…) |
| Phone design frame | the phone frame's width: 390, 375, or 402 for iPhone 16 Pro frames |
| Stops widening at | the content box's widest size, side margins included |

**The base is your Figma frame's size, nothing else.** Example: a 1680×1050 frame with a 48px
heading. Set the base to 1680×1050 and type `48`:

| Browser window | The heading renders at |
|---|---|
| 1440×900 | 41px (scaled down) |
| 1680×1050, same as the frame | **48px, exactly as drawn** |
| 1920×1080 | 49px (capped by the height) |

Forget to set it and the base stays at 1440×900: the 1680 design renders 17% too big everywhere
(the heading is 56px on a 1680 screen). Rare case: a 1440 layout in the middle of an extra-wide
1680 canvas. Measure the layout, not the canvas: base 1440×900, container width 1680, which are
the defaults.

**Height on or off.** On desktop the unit also follows the window's height by default, so a
section drawn as tall as the frame always fits one screen. `--fluid-desktop-fit-height: 0` makes it
follow the width only:

| Window (frame) | Height on, `1` (default) | Height off, `0` |
|---|---|---|
| 1440×700 (1440×900) | 0.78×, the 900-tall hero fits the screen | 1×, the hero is 900px and scrolls |
| 2000×1013 (1680×1050) | 0.96×, the page leaves empty side margins | 1.19×, the page fills the width |

Keep it on for one-screen sections (a hero, a pinned scroll scene); turn it off when nothing has to
fit one screen. The mobile bands always follow the width only. Height scales the font size and the
line height together, so it never squashes text.

Then init:

- writes `fluid.config.json`, with `$schema` pointing at the published schema
  (`https://unpkg.com/fluid-design-cli@2/skills/fluid-design/assets/fluid.config.schema.json`), so
  no schema copy lives in your project;
- generates the output folder, with a `.gitattributes` that keeps Git's line-ending conversion off
  the generated files;
- adds one import to your stylesheet and writes the settings you changed into your `:root` (on a
  site that already styles `html` and `body`, or with `--brownfield`, it prints both instead);
- adds `"fluid": "npx fluid-design-cli@2"` to `package.json` scripts when there is none;
- adds the output folder to `.prettierignore` with Prettier (with Biome it prints the
  `files.ignore` line), so a formatter does not rewrite generated files;
- in a project that already has `.vscode/settings.json`, turns on `output.editor` and wires
  settings autocomplete ([Editor support](#editor-support));
- keeps your own Tailwind `--breakpoint-*` values (`"tailwind": { "breakpoints": "none" }`).

It decides everything before writing anything: if the output folder holds hand-edited files, it
refuses and writes nothing (`--force` overwrites them, and keeps a v1 config as
`fluid.config.v1.json`). If `fluid.config.json` exists, it stops and points you at
`fluid generate` (or `fluid migrate --write` for a v1 config).

The result, on Tailwind:

```css
@import 'tailwindcss';
@import '../styles/fluid/fluid.css';

:root {
  --background: white;             /* your tokens, as before */

  /* fluid settings: `npm run fluid -- settings` lists every one with its default */
  --fluid-desktop-base-width: 1600;
  --fluid-desktop-base-height: 1000;
}
```

The generated folder (Tailwind + Next) holds `fluid.css` (the one import), `base.css`, `fluid.ts`,
`cn.ts`, `runtime/units.js` and `runtime/zoom.js` (with `.d.ts`), `integrations/next.tsx`,
`README.md`, `.gitattributes` and `.fluid.lock.json`. SCSS adds `_index.scss`, StyleX
`fluid.stylex.ts`; with `output.integration: none`, `runtime/zoom.classic.js` replaces the
integration.

**Browser zoom.** Init ends by printing the one line you add yourself:

- Next: `<FluidHead />` in `<head>`, from `@/styles/fluid/integrations/next`.
- Vite: `plugins: [fluidPlugin()]`, from `./src/styles/fluid/integrations/vite`.
- Anything else: `<script src="…/runtime/zoom.classic.js"></script>` as the first script in
  `<head>`, served from wherever your static files live.

Under a strict Content Security Policy, pass your nonce (`<FluidHead nonce={nonce} />`,
`fluidPlugin({ nonce })`, or `nonce` on the script tag), or allow the hash `FLUID_ZOOM_SHA256`
(exported by `runtime/zoom.js`) in `script-src`.

**Scripts and CI.** Every answer is also a flag; `--yes` (or no terminal) skips the questions:

```bash
fluid init --yes --desktop 1600x1000 --desktop-at 1200 --phone 402 --max-width 1920 \
  --set --fluid-desktop-scale-max=1.4
```

The flags are `--stack`, `--integration`, `--css`, `--out`, `--brownfield`, `--desktop`,
`--desktop-at`, `--no-mobile`, `--phone`, `--max-width` and `--set` (any setting, repeatable,
checked against the settings list with a "did you mean" for typos).

## 2. Use the scale

Write the number from the design file, never a converted one. Each stack spells it its own way:

| Stack | Layout | Display type | A box on the copy role |
|---|---|---|---|
| Tailwind v4 | `lg:fluid-py-120` | `lg:fluid-display-64` | `fluid-copy-h-56` |
| CSS, CSS Modules | `calc(120 * var(--fluid))` | `calc(64 * var(--fluid-display))` | `calc(56 * var(--fluid-copy))` |
| SCSS (`@use 'fluid' as fd`) | `fd.fluid(120)` | `fd.fluid-display(64)` | `fd.fluid-copy(56)` |
| StyleX (`fluid.stylex.ts`) | `fluid(120)` | `fluidDisplay(64)` | `fluidCopy(56)` |

### Tailwind v4

```html
<section class="fluid-container fluid-py-48 lg:fluid-py-120">
  <h1 class="fluid-display-40 lg:fluid-display-64">…</h1>
  <p class="lg:fluid-copy-18/26 lg:fluid-mt-24">…</p>
  <a class="fluid-copy-14/20 fluid-copy-h-56 fluid-copy-px-24">Book a table</a>
</section>
```

- Families cover padding, margin, gap, size, position, `translate`, radii (`fluid-rounded-*`) and
  type (`fluid-display-*`, `fluid-copy-*`, `fluid-text-*`). `fluid-ui-*` is for the header, nav and
  footer. The full list is in
  [`contract.md` §3](../skills/fluid-design/references/contract.md#3-utility-vocabulary-and-band-variants-tailwind-v4-every-other-stack-mirrors-the-same-set).
- **Controls scale with their label.** Every type role has box utilities on its own unit:
  `fluid-<role>-h-*`, `-w-*`, `-size-*`, `-p-*`, `-px-*`, `-py-*`, `-gap-*`. A button sized with
  `fluid-copy-h-56` keeps its proportion to `fluid-copy-14/20` text at every window size; sized with
  `fluid-h-56`, it would follow the layout's curve instead of its label's.
- Values are bare numbers in 0.25 steps (`fluid-p-24`, `fluid-p-37.5`) or bracketed
  (`fluid-p-[8.3]`).
- The `/lh` modifier is drawn px too: `fluid-copy-18/26` is 18 on 26. `/1.5` would be 1.5 px, so
  for a ratio put `leading-[1.5]` next to the size class.
- Band variants: `fluid-phone:`, `fluid-tablet:`, `fluid-landscape:`. The desktop band is `lg:`.
- `fluid-container` goes once per section, on its inner wrapper.
- `fluid-bleed-x`, inside a `fluid-container`, reaches the window edges and pads back in, so the
  content still lines up with the container (a carousel track, an edge-to-edge strip). It uses
  `100vw`, which counts a desktop scrollbar; the overflow guard on `html` (in `base.css`) clips the
  half-scrollbar overshoot.
- Every component that takes `className` needs a `cn` that knows the fluid classes, or two fluid
  classes for one property both ship and stylesheet order picks the winner. With no `cn` yet,
  import the generated one (`cn.ts` in the output folder). If the project already has one
  (shadcn's `src/lib/utils.ts`), keep it and build its `twMerge` with the generated `withFluid`:

  ```ts
  import { extendTailwindMerge } from 'tailwind-merge'
  import { withFluid } from '@/styles/fluid/cn'
  const twMerge = extendTailwindMerge(withFluid)
  ```

**Band variants vs breakpoints.** Tailwind v4 emits every custom variant after every breakpoint
variant, so on one property `fluid-phone:` / `fluid-tablet:` / `fluid-landscape:` always beat
`sm:`, `md:` and `max-*:`, whatever the window width: `fluid-tablet:p-4 md:p-8` stays `p-4` on an
800px tablet. Use one system per property. `lg:`, `xl:` and `2xl:` are safe next to a band variant,
because they start at the desktop band, where no band variant matches. `fluid check` flags the mix
(`band-variant-with-breakpoint`).

### CSS and CSS Modules

The CSS stack gives you the units, `--fluid-header-h` and two classes: `.fluid-container` and
`.fluid-bleed-x`. Spend the units inside each band's media query:

```css
.hero { padding: 80px 24px 40px; }
@media (min-width: 1024px) {
  .hero { padding-block: calc(120 * var(--fluid)); height: calc(900 * var(--fluid)); }
  .hero h1 { font-size: calc(64 * var(--fluid-display)); line-height: calc(72 * var(--fluid-display)); }
}
```

The number is unitless: `64px * var(--fluid)` is invalid CSS, and the browser drops the declaration
silently.

### SCSS

Import `fluid.css` once, globally; then use the functions and band mixins:

```scss
@use 'fluid' as fd;   // the folder that holds fluid/ must be on Sass loadPaths
.hero {
  @include fd.fluid-desktop {
    padding-block: fd.fluid(120);
    @include fd.fluid-type(64, 72);
  }
}
.track { @include fd.fluid-bleed-x; }
```

The functions `@error` on a number that already has a unit, so the silent `64px * var(--fluid)`
failure becomes a build error. A role function (`fd.fluid-copy(56)`) works on any property, so it
sizes controls the way the Tailwind box utilities do.

### StyleX

`fluid.stylex.ts` in the output folder has the typed helpers: `fluid(120)`, one per role
(`fluidDisplay(64)`, `fluidCopy(18)`), `fluidUi`, `fluidText`, `fluidCap` and `fluidContainer`,
built on the same custom properties. For a full-bleed strip, use the `.fluid-bleed-x` class from
`fluid.css`.

### Script

Every stack gets `fluid.ts`: `DESKTOP_QUERY`, `MEDIA` and typed settings, plus `fluidPx(n, unit,
el)` for a drawn distance in script (a GSAP or Motion offset). Import the breakpoint from there;
never hand-type it.

## 3. Limits: stop part of the page scaling

Put a limit on the element itself:

```html
<footer class="fluid-ui-grow-until-1920">…</footer>   <!-- this subtree only -->
```

```css
:root { --fluid-ui-grow-until: 1680; }   /* the site header, and --fluid-header-h with it */
```

| Utility | Inside the element |
|---|---|
| `fluid-grow-until-1680` | units stop growing above a 1680 window |
| `fluid-shrink-until-1280` | units stop shrinking below a 1280 window |
| `fluid-ui-grow-until-1680` | only `--fluid-ui` stops growing |
| `fluid-off` | nothing scales: one drawn px is one CSS px |

Widths are window widths. A limit makes its element a scope (a part of the page with its own
settings), and every `fluid-*` class inside follows. Behind `*:` or `[&_…]:` it limits nothing, and
on `<header>` it drifts from `--fluid-header-h` (use the `:root` setting above); `fluid check` warns
on both. For any other setting on one subtree, add `class="fluid-scope"` and set it there.

## 4. Tune: settings are CSS variables

Every number is a CSS variable in your `:root`. It applies immediately, with no regenerate. `fluid
settings` prints all of them with their defaults and what each does (43 at the default structure;
`--json` for scripts). An invalid value (`0.8px`, a typo'd number) falls back to the default
instead of breaking the page.

```css
:root {
  --fluid-desktop-container-padding: 108;  /* wider page gutters, on every section at once */
  --fluid-desktop-scale-max: 1.4;          /* stop growing on huge screens */
  --fluid-phone-scale-min: 0.8;            /* the smallest phones stop shrinking here */
}
```

**Tablet and landscape.** Most designs have no frame for them, so by default both run the phone
design full width (`--fluid-tablet-container-width` and `--fluid-landscape-container-width` default
to the desktop breakpoint, 1024, wider than any window in those bands) with a 32px gutter. A phone
design held to a narrow column read as a phone floating on a big screen. To keep the column:

```css
:root {
  --fluid-tablet-container-width: 560;
  --fluid-tablet-container-padding: 24;
  --fluid-landscape-container-width: 560;
  --fluid-landscape-container-padding: 24;
}
```

Their header heights still fall back to the phone value. Keep `--fluid-tablet-scale-min` equal to
`--fluid-phone-scale-max` (both 1.1 by default), so nothing jumps at the 600px switch.

**Notches.** The container gutter is never less than the safe-area inset:
`--fluid-container-padding` is `max(drawn padding × unit, env(safe-area-inset-left),
env(safe-area-inset-right))`. With `viewport-fit=cover`, a phone on its side keeps content clear of
the notch with no per-component safe-area rules, and everything that reads the padding
(`fluid-bleed-x`) follows. Elsewhere the insets are 0 and nothing changes.

**An existing site.** An old fixed gutter token does not follow a later change of
`--fluid-desktop-container-padding`. While routes migrate, point the old token at the fluid one,
then replace hard-coded gutters (`lg:px-18`) route by route:

```css
@theme { --spacing-gutter: var(--fluid-container-padding); }   /* px-gutter now follows the setting */
```

Your own `--fluid-*` tokens are fine: `fluid check` errors only on a near-typo of a setting or a
name the engine owns (`--fluid`, `--fluid-header-h`, …), and mentions the rest with `--verbose`.

## 5. See what a window gets: `explain` and `verify`

```bash
fluid explain 390x844                                    # the band, every unit, where each value came from
fluid explain 1920x1080 --set --fluid-grow-until=1680    # a what-if, without editing anything
fluid explain 1920x1080 --zoom 1.5                       # at a browser zoom level
fluid explain 1920x1080 --url http://localhost:3000      # the live page and every limited subtree on it
fluid explain 1920x1080 --url http://localhost:3000 --at header   # one element
fluid explain 1440x900 --url http://localhost:3000 --brief        # just the verdict
fluid probe http://localhost:3000                        # the same one-shot verdict
fluid calc budget --widths 400,400,400                   # does a drawn desktop row fit the container?
```

`--url` ends with a verdict and an exit code:

| Verdict | Means | Exit |
|---|---|---|
| OK | the page runs the current stylesheet and its units match the model | 0 |
| STALE | the page's build stamp differs from what the config generates now | 1 |
| MISMATCH | current build, but a unit drifts (a hand-edited `fluid.css`, or a setting redeclared where `fluid check` doesn't look) | 1 |
| V1 | a stylesheet with no build stamp against a v2 config | 1 |
| MISSING | the page does not load the fluid stylesheet | 2 |

When a row is over budget, `calc budget` prints `cqw` widths. If your team avoids container units,
give direct children of the content box the same fractions as percentages (`lg:w-[28.224%]`);
[`frame-and-gutter.md`](../skills/fluid-design/references/frame-and-gutter.md) has the deeper
cases.

STALE almost always means an open tab kept an old stylesheet after a dev-server restart: close the
tab and open a fresh one ([recipes](recipes.md#debug-a-page-that-broke-after-a-restart)).

`fluid verify` renders a matrix of window sizes (desktop widths 1024–2560 × heights 640–1440, plus
the phone, tablet and landscape sizes) and a real browser-zoom row, and checks horizontal overflow,
the unit maths, one-screen fit (`[data-fit=screen]`), grid column counts and screenshots:

```bash
npm i -D playwright && npx playwright install chromium
npm run fluid -- verify http://localhost:3000 --screens
npm run fluid -- verify http://localhost:3000 --browser webkit
```

`verify`, `explain --url` and `probe` drive a browser through Playwright, so they run under Node;
the standalone binary prints the `npx` command instead.

## 6. Change the structure

`fluid.config.json` holds only what changes which CSS rules exist:

- the bands and their breakpoints;
- the type role names (add `"caption"` to `roles` for `--fluid-caption` and `fluid-caption-*`);
- the prefix;
- `ui` and `zoom` on or off;
- the output folder and stack, and `output.editor` (the editor aids).

After an edit, run `fluid generate`, or keep `fluid generate --watch` running next to your dev
server: it regenerates on every save, and an invalid save prints the error and keeps watching.
`fluid generate --dry` shows what would change. Your editor completes and validates the file
through the published schema in `$schema`;
[`config.md`](../skills/fluid-design/references/config.md) lists every key and setting with its
default.

Never edit the generated folder. `generate` refuses to overwrite a hand edit (use `--force` once
you have moved the change into a setting or the config). A formatter's rewrite (whitespace, quotes)
is only a warning, and the message names the ignore file to add it to.

After a `fluid generate` or any edit to a global stylesheet, restart the dev server and open a
fresh tab before judging what you see.

A project on fluid-design v1: `fluid migrate` prints the v2 config and the settings to carry over
(a dry run); `fluid migrate --write` writes it, keeps the old file as `fluid.config.v1.json`, and
sets `aliases: true` so the v1 names keep working.

## 7. Check it in CI

```bash
npm run fluid -- check     # exit 1 when anything is wrong
```

It fails on a config error, a mistyped or out-of-range setting (with a suggestion), generated files
that are stale or hand-edited, a breakpoint that disagrees with the bands, a `--breakpoint-*` of
your own next to the generated px ladder, and a leftover `fluid-desktop:` variant (removed: it is
`lg:`). It warns on a `tailwind-merge` that does not know the fluid classes, a limit that will not
do what you meant (on `<header>`, or behind `*:`), a band variant mixed with a breakpoint, a `/1.5`
line-height ratio, a formatter's rewrite of the generated files, and output generated by a
different version of the CLI. `--verbose` adds info notes.

```yaml
# .github/workflows/ci.yml
- run: npm run fluid -- check
```

Pin one version across the team: the script's `@2` (or an exact `@2.1.0`) in CI and locally, and
the same binary release on every laptop. `fluid audit src` runs the full static source scan
(`--json` for tooling); beyond what `check` runs, it points out hand-written values such as
`h-[calc(56*var(--fluid-copy))]` and names the utility that replaces them (`fluid-copy-h-56`).

## Browser support

| Stack | Floor |
|---|---|
| CSS, CSS Modules, SCSS, StyleX | Safari 15.4, Chrome 108, Firefox 101 (what `svh` needs; the generated media queries use classic `min-width` syntax) |
| Tailwind v4 | Tailwind v4's own: Safari 16.4, Chrome 111, Firefox 128 |

Without `@property` (Firefox before 128, Safari before 16.4) the numbers are still right. You lose
two things: an invalid setting no longer falls back to its default, and `fluidPx(n, unit, el)` reads
the page's units instead of the element's. `fluid.ts`'s `MEDIA` strings use range syntax (Safari
16.4); `DESKTOP_QUERY` is classic.

Browser zoom is compensated in Chromium and Safari. Firefox exposes no reliable signal, so there
fluid type does not grow with zoom until the page falls through to the mobile layout.

## Editor support

- **Class autocomplete:** the Tailwind CSS IntelliSense extension lists every `fluid-*` utility.
- **Config autocomplete:** `$schema` in `fluid.config.json` points at the published schema.
- **Settings autocomplete** in CSS files needs `"output": { "editor": true }`, which also writes
  `fluid.css-data.json` and `settings.reference.css` (every setting with its default) into the
  output folder. Init turns it on and adds the data file to `css.customData` only when the project
  already has `.vscode/settings.json`. Elsewhere, set it yourself and add
  `"css.customData": ["src/styles/fluid/fluid.css-data.json"]` to your VS Code settings; or skip it
  and run `fluid settings`, which prints the same list.
- **Zed:** the Tailwind language server gives the same class autocomplete. For the settings file,
  Zed's CSS server takes `dataPaths` in `lsp.vscode-css-language-server.initialization_options`.
  This is unverified in Zed; [DISTRIBUTION.md](designs/DISTRIBUTION.md) has the snippet.

## With an agent

Install the skill ([installation.md](installation.md)) and describe the outcome. The agent runs the
same CLI from the skill folder (`node <skill>/bin/fluid …`), reads the frame sizes off your
design, records its decisions in `fluid.config.json` and a `FLUID.md` decision log, converts section by section and runs the verification gates. For the
method behind every number, start at [`SKILL.md`](../skills/fluid-design/SKILL.md) and
[`fluid-scale.md`](../skills/fluid-design/references/fluid-scale.md).
