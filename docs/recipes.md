# Recipes

Common tasks, each with a prompt for an agent and the commands to do it by hand. The prompts use
Codex's `$fluid-design` form; use `/fluid-design`, an `@` mention or plain language in other
clients. The commands are written as `fluid …`: in a Node project, prefix them with
`npx fluid-design-cli@2`.

- [Match a 1440 Figma frame at every laptop size](#match-a-1440-figma-frame-at-every-laptop-size)
- [Stop the header growing on a 5K display](#stop-the-header-growing-on-a-5k-display)
- [Keep an existing shadcn `cn`](#keep-an-existing-shadcn-cn)
- [An SCSS project on Vite](#an-scss-project-on-vite)
- [A site without Node (Rails)](#a-site-without-node-rails)
- [Gate CI on the scale](#gate-ci-on-the-scale)
- [Debug a page that broke after a restart](#debug-a-page-that-broke-after-a-restart)
- [Add a custom type role](#add-a-custom-type-role)
- [Tweak the landscape phone layout](#tweak-the-landscape-phone-layout)

## Match a 1440 Figma frame at every laptop size

Use when the design is drawn on one desktop frame and the build should be pixel-exact there and a
proportional copy everywhere else.

```text
Use $fluid-design to make this landing page match our 1440×900 Figma frame at every laptop size,
with the hero exactly one screen tall.
```

By hand:

```bash
fluid init                                 # 1440x900 is the default frame; a 1600x1000 frame: --desktop 1600x1000
fluid calc budget --widths 400,400,400     # does the widest drawn row fit the container at the artboard?
```

Then write each number from the frame through a fluid utility: `lg:py-[120px]` becomes
`lg:fluid-py-120`, a 64px heading `lg:fluid-display-64`. A section drawn 900 tall gets
`lg:fluid-h-900` and `data-fit="screen"`, so `fluid verify` checks it fits one screen at every
desktop size. At 1440×900 the page must match the frame pixel for pixel; that is the calibration
check. A row over budget is a drawing problem (or a `cqw` one), never a smaller padding: see
[`frame-and-gutter.md`](../skills/fluid-design/references/frame-and-gutter.md).

## Stop the header growing on a 5K display

Use when the page should keep scaling on a big screen but the header, nav and footer should stop at
a comfortable size.

```text
Use $fluid-design to stop the header growing past a 1680 window while the page keeps scaling.
```

By hand, one setting in your `:root`:

```css
:root { --fluid-ui-grow-until: 1680; }
```

The header spends `--fluid-ui`, and `--fluid-header-h` (anchor offsets, the hero's top padding) is
built from it, so both hold together. Do not put `fluid-grow-until-1680` on the `<header>` element:
the header would stop but `--fluid-header-h` on `:root` would not, and the two drift apart above
1680 (`fluid check` warns: `header-limit`). Preview it without editing anything:

```bash
fluid explain 2560x1440 --set --fluid-ui-grow-until=1680
```

To stop the whole page instead, `--fluid-grow-until: 1920` on `:root`, or a ceiling on the unit
itself with `--fluid-desktop-scale-max`.

## Keep an existing shadcn `cn`

Use when a Tailwind project already merges classes through `tailwind-merge` (shadcn's
`src/lib/utils.ts`, or any file importing it).

```text
Use $fluid-design to add the fluid scale to this shadcn project without replacing our cn helper.
```

Keep the file and its callers; change only how it builds `twMerge`:

```ts
import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'
import { withFluid } from '@/styles/fluid/cn'

const twMerge = extendTailwindMerge(withFluid)   // was: import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Already extending it? Pass both: `extendTailwindMerge({ extend: … }, withFluid)`. Never add a second
`cn`. Without `withFluid`, `lg:fluid-p-40 lg:fluid-p-24` keeps both classes and stylesheet order
picks the winner. `fluid check` warns on a `cn` without it (`cn-without-withfluid`).

## An SCSS project on Vite

Use when the project styles with Sass and builds with Vite (the
[`pizza-vite-gsap`](../examples/pizza-vite-gsap/) example is this setup).

```text
Use $fluid-design to put this Vite + SCSS site on the fluid scale.
```

`fluid init` detects `sass` and `vite` and picks the `scss` stack and the Vite integration. Then:

```ts
// vite.config.ts
import { fluidPlugin } from './src/styles/fluid/integrations/vite'

export default defineConfig({
  plugins: [fluidPlugin()],   // the browser-zoom runtime, first in <head>
  css: { preprocessorOptions: { scss: { loadPaths: ['src/styles'] } } }   // so @use 'fluid' resolves
})
```

```ts
// src/main.ts: the units, settings and base layer, imported once
import './styles/fluid/fluid.css'
```

```scss
@use 'fluid' as fd;
.hero {
  @include fd.fluid-desktop { padding-block: fd.fluid(120); @include fd.fluid-type(64, 72); }
}
```

The functions `@error` on a number that already has a unit, so `64px` instead of `64` fails the
build rather than silently dropping the declaration.

## A site without Node (Rails)

Use for Rails, Django, Laravel, Phoenix, Hugo or plain HTML, where there is no `package.json`.

```bash
curl -fsSL https://raw.githubusercontent.com/gabros20/fluid-design-skill/main/install-cli.sh | sh
cd my-rails-app
fluid init
```

`init` finds the stylesheet (`app/assets/stylesheets/application.css` on Rails, `assets/css/main.css`,
`static/css/main.css` and others elsewhere), picks the `css` stack and generates the folder next to
it. It adds the import, or prints it (and your settings) when the stylesheet already styles `html`
and `body`. With no framework integration it generates `runtime/zoom.classic.js`: add it as
the first script in your layout's `<head>`, served from wherever your static files live. Spend the
units in your own CSS:

```css
@media (min-width: 1024px) {
  .hero { padding-block: calc(120 * var(--fluid)); }
}
```

`fluid check`, `fluid explain 1440x900` and `fluid generate --watch` all run from the binary. For
`fluid verify` or `explain --url`, which need Playwright, run `npx fluid-design-cli@2 verify <url>`
on a machine with Node; the binary prints that command for you.

## Gate CI on the scale

Use when the team should not be able to merge stale generated files, a mistyped setting or a
known-bad pattern.

```yaml
# .github/workflows/ci.yml
- run: npx fluid-design-cli@2 check
```

Without Node in CI, install a pinned binary first:

```yaml
- run: curl -fsSL https://raw.githubusercontent.com/gabros20/fluid-design-skill/main/install-cli.sh | FLUID_VERSION=v2.0.0 sh
- run: ~/.local/bin/fluid check
```

`fluid check` exits 1 on a config error, a mistyped or out-of-range setting, stale or hand-edited
generated files, a breakpoint that disagrees with the bands, or a leftover `fluid-desktop:` variant,
and warns on the other source rules (a `cn` without `withFluid`, a limit on `<header>` or behind
`*:`, a band variant mixed with a breakpoint, a `/1.5` line-height ratio). Use the same version in CI as on every laptop; `check` warns
when the generated folder came from a different one.

## Debug a page that broke after a restart

Use when, right after a CSS edit or a `fluid generate` and a dev-server restart, the layout lost its
sizes, the render went full-bleed, or a pinned scene holds its first frame and then snaps to the
last. It is almost always a stale stylesheet in an open tab, not a code bug.

```text
Use $fluid-design to find out why the layout lost its sizes after I restarted the dev server.
```

By hand:

```bash
fluid probe http://localhost:3000
# the same as: fluid explain 1440x900 --url http://localhost:3000 --brief
```

| Verdict | Do |
|---|---|
| OK | the stylesheet is current: keep debugging the code |
| STALE | close the tab and open a fresh one; if it survives, clear the build cache (`rm -rf .next` or your framework's equivalent) and restart |
| MISMATCH | a hand-edited `fluid.css` or a redeclared setting: `fluid check`, then `fluid generate` |
| V1 | the page still loads a v1 or hand-written stylesheet: fix the import |
| MISSING | the page does not load the fluid stylesheet at all: check the import and the URL |

Closing the tab fixing it is proof the code was fine. In the browser console,
`getComputedStyle(document.documentElement).getPropertyValue('--fluid-build')` shows the build stamp
the page is running. Details:
[`verification.md` §6](../skills/fluid-design/references/verification.md#6-the-stale-stylesheet).

## Add a custom type role

Use when the design has a third kind of text (captions, eyebrows) that should shrink on its own
curve rather than as display or copy.

```text
Use $fluid-design to add a caption type role that shrinks less than body copy.
```

Add it to `roles` in `fluid.config.json` and regenerate:

```json
{ "roles": ["display", "copy", "caption"] }
```

```bash
fluid generate
```

That emits `--fluid-caption`, the `fluid-caption-*` utility (with the `/lh` modifier),
`fd.fluid-caption()` on SCSS, `fluidCaption()` on StyleX, `fluidPx(n, 'caption')` for script, and a
damping setting per band that starts at `copy`'s values. Tune it like any setting:

```css
:root { --fluid-desktop-caption-damping: 0.2; }
```

A role name may not collide with an existing word (`ui`, `text`, `container`, a band, a utility
family); validation rejects it with a suggestion.

## Tweak the landscape phone layout

Use when a phone on its side (500px tall or less) needs something different from portrait, without
touching the portrait or desktop layouts.

```text
Use $fluid-design to tighten the hero's vertical padding on a phone in landscape.
```

Use the band variant on that one property:

```html
<section class="fluid-py-48 fluid-landscape:fluid-py-24 lg:fluid-py-120">…</section>
```

Or change how the whole band scales with a setting:

```css
:root { --fluid-landscape-scale-max: 1.1; }
```

Check it with `fluid explain 844x390`. Do not mix a band variant with `sm:`, `md:` or `max-*:` on
the same property: band variants sort after every breakpoint, so they always win
(`band-variant-with-breakpoint`). `lg:` next to a band variant is fine.
