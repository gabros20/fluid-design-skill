# Recipes

Common tasks, each with a prompt for an agent and the commands to do it by hand. The prompts use
Codex's `$fluid-design` form; use `/fluid-design`, an `@` mention or plain language in other
clients. The commands are written as `fluid …`. In a Node project `fluid init` adds a `fluid` script
to `package.json`, so run them as `npm run fluid -- check` (or `npx fluid-design-cli@2 check`).

Settings are the numbers you tune: CSS variables in your own `:root`, applied live with no
regenerate. `fluid settings` lists every one with its default.

- [Match your Figma frame at every laptop size](#match-your-figma-frame-at-every-laptop-size)
- [Size a button with its label](#size-a-button-with-its-label)
- [A carousel that runs to the window edge](#a-carousel-that-runs-to-the-window-edge)
- [Named type styles](#named-type-styles)
- [Widen the page gutter later](#widen-the-page-gutter-later)
- [Bridge an old gutter token while you migrate](#bridge-an-old-gutter-token-while-you-migrate)
- [Keep the old tablet column](#keep-the-old-tablet-column)
- [Stop the header growing on a 5K display](#stop-the-header-growing-on-a-5k-display)
- [Keep an existing shadcn `cn`](#keep-an-existing-shadcn-cn)
- [An SCSS project on Vite](#an-scss-project-on-vite)
- [A site without Node (Rails)](#a-site-without-node-rails)
- [Gate CI on the scale](#gate-ci-on-the-scale)
- [Debug a page that broke after a restart](#debug-a-page-that-broke-after-a-restart)
- [Add a custom type role](#add-a-custom-type-role)
- [Tweak the landscape phone layout](#tweak-the-landscape-phone-layout)

## Match your Figma frame at every laptop size

Use when the design is drawn on one desktop frame (the artboard) and the build should be
pixel-exact there and a proportional copy everywhere else. First read the frame sizes off the design
file: 1440×900, 1680×1050, whatever the designer used, and the phone frame's width too (402 for an
iPhone 16 Pro frame, not the 390 default). The defaults are only fallbacks for a frame the design
doesn't have.

```text
Use $fluid-design to make this landing page match our 1680×1050 Figma frame at every laptop size,
with the hero exactly one screen tall.
```

By hand:

```bash
fluid init --desktop 1680x1050 --phone 402 # the frames' sizes; 1440x900 and 390 are only defaults
fluid explain 1512x982                     # what a 14" MacBook Pro gets: --fluid 0.9000
fluid calc budget --widths 400,400,400     # does the widest drawn row fit the container?
```

`init` writes the frame into your `:root`. You can also set it, or change it later, by hand:

```css
:root {
  --fluid-desktop-base-width: 1680;          /* the frame */
  --fluid-desktop-base-height: 1050;
  --fluid-desktop-container-width: 1680;     /* the content box's widest size, margins included */
  --fluid-desktop-container-padding: 80;     /* the side margin */
}
```

Then write each number from the frame through a fluid utility: `lg:py-[120px]` becomes
`lg:fluid-py-120`, a 64px heading `lg:fluid-display-64`. A section drawn as tall as the frame gets
`lg:fluid-h-1050` (`lg:fluid-h-900` on a 900 frame) and `data-fit="screen"`, so `fluid verify`
checks it fits one screen at every desktop size. At a window the size of the frame the page must
match it pixel for pixel; that is the calibration check.

If the base doesn't match the frame, nothing errors: the page just renders at the wrong size
everywhere. Numbers from a 1680 frame on the default 1440 base come out 17% too big.

A row over budget is a drawing problem (or a `cqw` one), never a smaller padding: see
[`frame-and-gutter.md`](../skills/fluid-design/references/frame-and-gutter.md).

## Size a button with its label

Use when a button, chip or icon should keep its proportion to the text inside it. The label is
`copy` text, which shrinks more gently than the layout; a box sized in plain `fluid-h-*` would shrink
faster than its label and squeeze it.

```text
Use $fluid-design to size our primary button so it scales with its label.
```

Size the box on the label's own unit with the role box utilities (`fluid-<role>-h-*`, `-w-*`,
`-size-*`, `-p-*`, `-px-*`, `-py-*`, `-gap-*`):

```html
<a href="/contact"
   class="inline-flex items-center fluid-copy-h-56 fluid-copy-px-24 fluid-copy-gap-8 fluid-copy-14/20">
  Get in touch <ArrowRight class="fluid-copy-size-16" />
</a>
```

The numbers are as drawn: a 56px button with 24px side padding and 14/20 text. They replace
hand-written `h-[calc(56*var(--fluid-copy))]`. `cn` merges them with their Tailwind groups, so
`cn('fluid-copy-h-56', 'fluid-copy-h-48')` keeps the last. A headline-sized control uses
`fluid-display-h-*` and so on; a custom role gets its own set. SCSS and StyleX use the role function on
any property: `height: fd.fluid-copy(56)`, `fluidCopy(56)`.

## A carousel that runs to the window edge

Use when a slider track or a strip should run to both window edges while its first item still lines
up with the page content.

```text
Use $fluid-design to let the testimonials carousel bleed to the window edges, aligned with the container.
```

Keep it inside the section's `fluid-container` and add `fluid-bleed-x` to the track:

```html
<section class="fluid-container">
  <h2 class="fluid-display-40/48">What clients say</h2>
  <ul class="fluid-bleed-x flex snap-x overflow-x-auto fluid-gap-24">…</ul>
</section>
```

It pulls the track out to the window edges with a negative margin and pads it back in by the same
amount, so the first slide starts at the container's edge and later slides scroll past it. In CSS
it is the `.fluid-bleed-x` class; in SCSS `@include fd.fluid-bleed-x`. On a desktop with a visible
scrollbar `100vw` counts the scrollbar, so the strip overshoots by half a scrollbar on each side; the
overflow guard on `html` clips it.

## Named type styles

Use when the design system names its text styles (H1, H2, Body M…) and the team wants one class per
style instead of repeating sizes. Not generated: define them once in your CSS, on the role units.

```css
@utility type-h2 {
  font-size: calc(32 * var(--fluid-display));
  line-height: var(--tw-leading, 1.25);
  letter-spacing: var(--tw-tracking, -0.02em);
}
@utility type-body-md {
  font-size: calc(16 * var(--fluid-copy));
  line-height: var(--tw-leading, 1.5);
}
```

`<h2 class="type-h2">` then scales like `fluid-display-32`. The line height is a ratio and the
tracking is in `em`, so both follow the size. Writing them as `var(--tw-leading, …)` and
`var(--tw-tracking, …)` keeps `leading-*` and `tracking-*` working as overrides on one element. A
style whose size changes per band takes a band prefix where it is used (`type-body-md lg:type-h2`).

## Widen the page gutter later

Use when the designer changes the side margin after sections are built.

```text
Use $fluid-design to widen the desktop page margins from 80 to 108.
```

It is one setting in your `:root`:

```css
:root { --fluid-desktop-container-padding: 108; }
```

Every section on `fluid-container` (and every `fluid-bleed-x` strip, which reads the same padding)
moves at once. Sections with hard-coded gutters (`lg:px-18`, a fixed gutter token) do not: find them
first, or bridge them (next recipe). Preview with
`fluid explain 1440x900 --set --fluid-desktop-container-padding=108`. The phone, tablet and
landscape bands have their own `--fluid-<band>-container-padding`.

## Bridge an old gutter token while you migrate

Use in an existing site that has its own fixed gutter (`--spacing-gutter: 72px` behind `px-gutter`)
and moves to `fluid-container` one route at a time. Left alone, the old token stays 72 when the
fluid padding changes, and migrated and unmigrated pages disagree.

```css
@theme inline {
  --spacing-gutter: var(--fluid-container-padding);   /* was 72px; now the fluid gutter */
}
```

`inline` makes `px-gutter` read the fluid padding where it is used, so it follows the band, scopes
and the setting above. The old token now changes below desktop too, so check pages that used it on
phones. Replace hard-coded gutters (`lg:px-18`) route by route, and delete the bridge when no route
uses it. [`brownfield-migration.md`](../skills/fluid-design/references/brownfield-migration.md) has
the full migration.

## Keep the old tablet column

Use when the design has no tablet or landscape frame and the team prefers the earlier look: the phone
design held to a 560 column instead of full width.

By default the tablet and landscape bands run the phone design full width with a 32px gutter, which
reads as a layout rather than a phone floating on a big screen. To go back:

```css
:root {
  --fluid-tablet-container-width: 560;
  --fluid-tablet-container-padding: 24;
  --fluid-landscape-container-width: 560;
  --fluid-landscape-container-padding: 24;
}
```

Check it with `fluid explain 820x1180` and `fluid explain 844x390`. Whatever you choose, keep
`--fluid-tablet-scale-min` equal to `--fluid-phone-scale-max` (both 1.1 by default) so nothing jumps
at the 600px switch. If the design does have a tablet frame, build that instead.

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
- run: npm run fluid -- check   # the script fluid init added; or: npx fluid-design-cli@2 check
```

Without Node in CI, install a pinned binary first:

```yaml
- run: curl -fsSL https://raw.githubusercontent.com/gabros20/fluid-design-skill/main/install-cli.sh | FLUID_VERSION=v2.1.0 sh
- run: ~/.local/bin/fluid check
```

`fluid check` exits 1 on a config error, a mistyped or out-of-range setting, stale or hand-edited
generated files, a breakpoint that disagrees with the bands, or a leftover `fluid-desktop:` variant,
and warns on the other source rules (a `cn` without `withFluid`, a limit on `<header>` or behind
`*:`, a band variant mixed with a breakpoint, a `/1.5` line-height ratio). Use the same version in
CI as on every laptop; `check` warns when the generated folder came from a different one.

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
