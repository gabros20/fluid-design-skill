# Usage: the by-hand guide

This is the path without an agent: you run the `fluid` CLI yourself, commit what it generates, and
write your design's numbers through the fluid units. An agent with the skill installed runs the same
commands (see [With an agent](#with-an-agent) at the end).

Install the CLI first ([installation.md](installation.md)). In a Node project there is nothing to
install: prefix each command below with `npx fluid-design-cli@2`. Without Node, the standalone
binary is `fluid`.

## Contents

1. [Set up: `fluid init`](#1-set-up-fluid-init)
2. [Use the scale](#2-use-the-scale)
3. [Limits: stop part of the page scaling](#3-limits-stop-part-of-the-page-scaling)
4. [Tune: settings are CSS variables](#4-tune-settings-are-css-variables)
5. [See what a viewport gets: `explain` and `verify`](#5-see-what-a-viewport-gets-explain-and-verify)
6. [Change the structure](#6-change-the-structure)
7. [Check it in CI](#7-check-it-in-ci)
8. [Browser support](#browser-support) · [Editor support](#editor-support) · [With an agent](#with-an-agent)

## 1. Set up: `fluid init`

Run it at the project root. On a terminal it asks up to ten questions, each with a default detected
from the project; Enter keeps it:

```text
? Styling: tailwind-v4, css, scss or stylex? (tailwind-v4)
? Framework, for the browser-zoom head script: next, vite or none? (next)
? Global stylesheet (gets the import and your settings; empty = print them instead) (src/app/globals.css)
? Does this site already style html and body itself? (y = leave the base layer out) (n)
? Desktop design frame, width x height (1440x900)
? The desktop layout starts at this window width (px) (1024)
? Scale the phone, tablet and landscape layouts too? (n = 1px below desktop) (y)
? Phone design frame width (390)
? The page stops widening at (drawn px) (1680)
? Generated files go in (src/styles/fluid)
```

What each answer means:

| Question | Becomes | Kind |
|---|---|---|
| Styling | `output.stack` in `fluid.config.json`. Tailwind 3 is detected and gets the CSS stack (the utilities need Tailwind 4) | structure |
| Framework | `output.integration`: `next` generates `<FluidHead />`, `vite` generates `fluidPlugin()`, `none` a classic `zoom.classic.js` script | structure |
| Global stylesheet | where the import and your settings are written | — |
| Styles `html`/`body` already | `output.base: false` (the base layer is left out) | structure |
| Desktop design frame | `--fluid-desktop-base-width` / `--fluid-desktop-base-height` | setting |
| Desktop starts at | `bands.desktop.minWidth` (and Tailwind's `lg:`) | structure |
| Scale the mobile layouts | `bands.phone` / `tablet` / `landscape` on, or all off | structure |
| Phone design frame | `--fluid-phone-base-width` | setting |
| Stops widening at | `--fluid-desktop-container-width` | setting |
| Generated files go in | `output.dir` | structure |

Then it:

- writes `fluid.config.json` (and `fluid.config.schema.json` beside it);
- generates the output folder, with a `.gitattributes` inside so Git's line-ending conversion leaves
  the generated files byte-exact;
- adds one import to your stylesheet and writes your setting answers into your `:root` (on a site
  that already styles `html` and `body`, or with `--brownfield`, it prints both for you to add
  instead);
- adds the output folder to `.prettierignore` when you use Prettier (with Biome it prints the
  `files.ignore` line to add), so a formatter does not rewrite generated files;
- keeps your own Tailwind `--breakpoint-*` values if it finds any (`"tailwind": { "breakpoints":
  "none" }`).

It decides everything before writing anything: if the output folder holds hand-edited files, it
refuses and writes nothing. `--force` overwrites them (and keeps a v1 config as
`fluid.config.v1.json`). If `fluid.config.json` already exists, init stops and points you at
`fluid generate` (or `fluid migrate --write` for a v1 config).

The result, on Tailwind:

```css
@import 'tailwindcss';
@import '../styles/fluid/fluid.css';

:root {
  --background: white;             /* your tokens, as before */

  /* fluid settings — every one, with its default, is in ../styles/fluid/settings.reference.css */
  --fluid-desktop-base-width: 1600;
  --fluid-desktop-base-height: 1000;
}
```

**Browser zoom wiring.** Init ends by printing the one line you add yourself:

- Next: `<FluidHead />` in `<head>`, from `@/styles/fluid/integrations/next`.
- Vite: `plugins: [fluidPlugin()]`, from `./src/styles/fluid/integrations/vite`.
- Anything else: `<script src="…/runtime/zoom.classic.js"></script>` as the first script in
  `<head>`, served from wherever your static files live.

Under a strict Content Security Policy, pass your nonce (`<FluidHead nonce={nonce} />`,
`fluidPlugin({ nonce })`, or `nonce` on the script tag), or allow the hash `FLUID_ZOOM_SHA256`
(exported by `runtime/zoom.js`) in `script-src`.

**Scripts and CI.** Every answer is also a flag, and `--yes` (or no terminal) skips the questions:

```bash
fluid init --yes --desktop 1600x1000 --desktop-at 1200 --max-width 1920 \
  --set --fluid-desktop-scale-max=1.4
```

The flags are `--stack`, `--integration`, `--css`, `--out`, `--brownfield`, `--desktop`,
`--desktop-at`, `--no-mobile`, `--phone`, `--max-width` and `--set` (any setting, repeatable,
checked against the settings list with a "did you mean" for typos).

## 2. Use the scale

Write the number from the design file, never a converted one. Each stack spells the same thing:

| Stack | Layout | Display type |
|---|---|---|
| Tailwind v4 | `lg:fluid-py-120` | `lg:fluid-display-64` |
| CSS, CSS Modules | `calc(120 * var(--fluid))` | `calc(64 * var(--fluid-display))` |
| SCSS (`@use 'fluid' as fd`) | `fd.fluid(120)` | `fd.fluid-display(64)` |
| StyleX (`fluid.stylex.ts`) | `fluid(120)` | `fluidDisplay(64)` |

### Tailwind v4

```html
<section class="fluid-container fluid-py-48 lg:fluid-py-120">
  <h1 class="fluid-display-40 lg:fluid-display-64">…</h1>
  <p class="lg:fluid-copy-18/26 lg:fluid-mt-24">…</p>
</section>
```

- Families cover padding, margin, gap, size, position, `translate`, radii (`fluid-rounded-*`) and
  type (`fluid-display-*`, `fluid-copy-*`, `fluid-text-*`). `fluid-ui-*` is for the header, nav and
  footer. The full list is in
  [`contract.md` §3](../skills/fluid-design/references/contract.md#3-utility-vocabulary-and-band-variants-tailwind-v4-every-other-stack-mirrors-the-same-set).
- Values are bare numbers in 0.25 steps (`fluid-p-24`, `fluid-p-37.5`) or bracketed
  (`fluid-p-[8.3]`).
- The `/lh` modifier is drawn px too: `fluid-copy-18/26` is 18 on 26. `/1.5` would be 1.5 px, so
  for a ratio put `leading-[1.5]` next to the size class.
- Band variants: `fluid-phone:`, `fluid-tablet:`, `fluid-landscape:`. The desktop band is `lg:`.
- `fluid-container` goes once per section, on its inner wrapper.
- Every component that takes `className` needs a `cn` that knows the fluid classes, or two fluid
  classes for one property both ship and stylesheet order picks the winner. With no `cn` yet, import
  the generated one (`cn.ts` in the output folder). If the project already has one (shadcn's
  `src/lib/utils.ts`), keep it and build its `twMerge` with the generated `withFluid`:

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

The CSS stack gives you the units, `--fluid-header-h` and one class, `.fluid-container`. Spend the
units inside each band's media query:

```css
.hero { padding: 80px 24px 40px; }
@media (min-width: 1024px) {
  .hero { padding-block: calc(120 * var(--fluid)); height: calc(900 * var(--fluid)); }
  .hero h1 { font-size: calc(64 * var(--fluid-display)); line-height: calc(72 * var(--fluid-display)); }
}
```

The number is unitless: `64px * var(--fluid)` is invalid CSS and the browser drops the declaration
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
```

The functions `@error` on a number that already has a unit, so the silent `64px * var(--fluid)`
failure becomes a build error.

### StyleX

`fluid.stylex.ts` in the output folder has the typed helpers: `fluid(120)`, one per role
(`fluidDisplay(64)`, `fluidCopy(18)`), `fluidUi`, `fluidText`, `fluidCap` and `fluidContainer`,
built on the same custom properties.

### Script

Every stack gets `fluid.ts`: `DESKTOP_QUERY`, `MEDIA` and typed settings, plus `fluidPx(n, unit,
el)` for a drawn distance in script (a GSAP or Motion offset). Import the breakpoint from there;
never hand-type it.

## 3. Limits: stop part of the page scaling

To stop something scaling past a window width, put a limit on the element itself:

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

Widths are window widths. A limit makes its element a scope, and every `fluid-*` class inside
follows. Behind `*:` or `[&_…]:` it limits nothing, and on `<header>` it drifts from
`--fluid-header-h` (use the `:root` setting above); `fluid check` warns on both. For any other
setting on one subtree, add `class="fluid-scope"` and set it there.

## 4. Tune: settings are CSS variables

Every number is a CSS variable in your `:root`. It applies immediately, with no regenerate.
`settings.reference.css` in the output folder lists all of them with their defaults (43 at the
default structure), and `fluid settings` prints the same list (`--json` for scripts). Tablet and
landscape reuse the phone's container and header settings unless you set theirs. An invalid value
(`0.8px`, a typo'd number) falls back to the default instead of breaking the page.

```css
:root {
  --fluid-phone-scale-min: 0.8;          /* the smallest phones stop shrinking here */
  --fluid-desktop-display-damping: 0.7;  /* headings shrink more with the layout */
  --fluid-desktop-scale-max: 1.4;        /* stop growing on huge screens */
}
```

Your own `--fluid-*` tokens are fine: `fluid check` errors only on a near-typo of a setting or a
name the engine owns (`--fluid`, `--fluid-header-h`, …), and mentions the rest with `--verbose`.

## 5. See what a viewport gets: `explain` and `verify`

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

STALE almost always means an open tab kept an old stylesheet after a dev-server restart: close the
tab and open a fresh one ([recipes](recipes.md#debug-a-page-that-broke-after-a-restart)).

`fluid verify` renders a matrix of viewports (desktop widths 1024–2560 × heights 640–1440, plus the
phone, tablet and landscape sizes) and a real browser-zoom row, and checks horizontal overflow, the
unit maths, one-screen fit (`[data-fit=screen]`), grid column counts and screenshots:

```bash
npm i -D playwright && npx playwright install chromium
npx fluid-design-cli@2 verify http://localhost:3000 --screens
npx fluid-design-cli@2 verify http://localhost:3000 --browser webkit
```

`verify`, `explain --url` and `probe` drive a browser through Playwright, so they run under Node;
the standalone binary prints the `npx` command instead.

## 6. Change the structure

`fluid.config.json` holds only what changes which CSS rules exist:

- the bands and their breakpoints;
- the type role names (add `"caption"` to `roles` for `--fluid-caption` and `fluid-caption-*`);
- the prefix;
- `ui` and `zoom` on or off;
- the output folder and stack.

After an edit, run `fluid generate`, or keep `fluid generate --watch` running next to your dev
server: it regenerates on every save, and an invalid save prints the error and keeps watching.
`fluid generate --dry` shows what would change. Your editor completes and validates the file
through `fluid.config.schema.json`; `skills/fluid-design/references/config.md` lists every key and
setting with its default.

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
fluid check     # exit 1 when anything is wrong
```

It fails on a config error, a mistyped or out-of-range setting (with a suggestion), generated files
that are stale or hand-edited, a breakpoint that disagrees with the bands, a `--breakpoint-*` of
your own next to the generated px ladder, and a leftover `fluid-desktop:` variant (removed: it was
`lg:`). It warns on a `tailwind-merge` that does not know the fluid classes, a limit that will not do
what you meant (on `<header>`, or behind `*:`), a band variant mixed with a breakpoint, a `/1.5`
line-height ratio, a formatter's rewrite of the generated files, and output generated by a different
version of the CLI. `--verbose` adds info notes.

```yaml
# .github/workflows/ci.yml
- run: npx fluid-design-cli@2 check
```

Pin one version across the team: the same `@2` (or an exact `@2.0.0`) in CI and in scripts, and the
same binary release on every laptop. `fluid audit src` runs the static source scan on its own
(`--json` for tooling).

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
- **Settings autocomplete** in CSS files comes from `fluid.css-data.json` in the output folder. In
  VS Code, `init` adds it to `.vscode/settings.json` (`"css.customData"`) when that file exists, and
  prints the line otherwise.
- **Zed:** the Tailwind language server gives the same class autocomplete. For the settings file,
  Zed's CSS server takes `dataPaths` in `lsp.vscode-css-language-server.initialization_options`.
  This is unverified in Zed; [DISTRIBUTION.md](designs/DISTRIBUTION.md) has the snippet.

## With an agent

Install the skill ([installation.md](installation.md)) and describe the outcome. The agent runs the
same CLI from the skill folder (`node <skill>/bin/fluid …`), settles the preflight decisions from
your project, records them in `fluid.config.json` and a `FLUID.md` decision log, converts section by
section and runs the verification gates. For the method behind every number, start at
[`SKILL.md`](../skills/fluid-design/SKILL.md) and
[`fluid-scale.md`](../skills/fluid-design/references/fluid-scale.md).
