# Styling stacks: the same units, five spellings

Purpose: How the same units are spelled in Tailwind v4, vanilla CSS and CSS Modules, SCSS and
StyleX, how to choose between them, and scopes and limits per stack.

Read when: implementing in a stack other than Tailwind v4, or choosing a stack.
Skip when: you are on Tailwind v4 and `fluid.css` is already imported.
Inputs: `output.stack` or the project's styling stack.
Produces: authoring in the right surface for the stack, scopes and limits included.

## Contents

- Tailwind v4 (richest)
- Vanilla CSS and CSS Modules
- SCSS
- StyleX
- Choosing
- Traps
- Scopes and limits per stack

Every stack spends the same custom properties (`--fluid`, `--fluid-<role>` per entry in `roles`,
`--fluid-ui` with `ui: true`, `--fluid-container-width`/`-padding`, `--fluid-header-h`), defined once on
`:root` and every scope (`.<prefix>-scope`, `[data-fluid-scope]`, limit utilities) and redefined inside each band's media query. Only the authoring surface
differs. `output.stack` in `fluid.config.json` picks it; `fluid generate` writes **one `fluid.css`
per stack** into `output.dir` — there is no separate "install the layer for stack X" step, and no
`--stack` flag to hand-pick a different one at generate time. The files under `assets/styles/<name>/`
are the same generator's output at the shipped defaults, for reference.

## Tailwind v4 (richest)

`<output.dir>/fluid.css`, imported once after `@import 'tailwindcss';`. It carries the `@theme`
breakpoint ladder, the band `@custom-variant`s, the engine and the full `@utility` vocabulary
(`contract.md` §3). Functional `@utility` families take the drawn number: `lg:fluid-py-120`,
`lg:fluid-display-64/72`, `lg:fluid-cap-1680`.

- The `lg:` prefix is how a value stays desktop-only. Below `lg` the units are 1px anyway when
  `bands.phone` is off, but with the mobile bands on (the default) the unprefixed utility is live
  too — it spends the phone frame's numbers, and `lg:` overrides it: `fluid-py-48 lg:fluid-py-120`
  (or `fluid-tablet:fluid-py-64` for a tablet-only override). There is no desktop band variant:
  the desktop band is `lg:`.
- **Band variants vs breakpoints.** `fluid-phone:`, `fluid-tablet:` and `fluid-landscape:` sort
  after every breakpoint variant (Tailwind v4 emits custom variants last), so on one property a band
  variant beats `sm:`/`md:`/`max-*:` whatever the width. Don't mix them on one property; `lg:`,
  `xl:` and `2xl:` are fine, since they start at the desktop band. Audit rule
  `band-variant-with-breakpoint` flags the mix (`contract.md` §3).
- Values: bare numbers in 0.25 steps, anything else bracketed (`fluid-p-[8.3]`); the `/lh`
  modifier is drawn px (`fluid-copy-18/[26.5]`), not a ratio (`contract.md` §3).
- Arbitrary values spend the units directly when no utility fits:
  `lg:grid-cols-[1fr_calc(512*var(--fluid))]`, `lg:px-[calc(24*var(--fluid-copy))]`.
- Register the families with tailwind-merge — the generated `cn.ts` already does this for every
  utility `fluid.css` emits, including the opt-in families that are on.
- `tailwind.breakpoints: "ladder"` (default) makes `--breakpoint-lg` in `@theme` equal
  `bands.desktop.minWidth`; do not redeclare any `--breakpoint-*` yourself — `fluid check` errors on
  one next to the ladder. `fluid init` finds a site's own `--breakpoint-*` and sets
  `tailwind.breakpoints: "none"` instead, keeping them.
- **`fluid.css` defines the whole breakpoint ladder in px, never `lg` alone, when
  `tailwind.breakpoints` is `"ladder"`.** Tailwind v4 has no `tailwind.config` to read a breakpoint
  order from — only whatever `--breakpoint-*` tokens a project's `@theme` defines, with Tailwind's
  own rem defaults filling in anything left undefined. It then emits variants in min-width order by
  comparing breakpoint LENGTHS, and a px value is not comparable against a rem one. Overriding only
  `--breakpoint-lg` (in px) and leaving `sm`/`md`/`xl`/`2xl` on the rem defaults sorts the whole
  `lg:` block before `sm:` regardless of pixel width — measured, `sm:text-[64px]` beat
  `lg:fluid-display-112` even though 1024px is wider than the 40rem `sm` breakpoint. It compiles
  clean and looks like a design mistake, not a units bug. `lg: 64rem` instead of `1024px` is not
  the fix either: a rem media query follows the visitor's browser font-size setting, while the
  engine's `(min-width: 1024px)` band query does not — the two would silently disagree for any
  visitor whose default font size is not 16px. (Browser zoom is not the cause: it scales px and em
  media queries alike.) `scripts/lib/emit/tailwind.mjs`'s `breakpointLadder()` builds it
  (`sm 640, md 768, lg = bands.desktop.minWidth, xl 1280, 2xl 1536px`, nudged to stay monotonic if
  the desktop band collides with a default rung, with a note comment in the generated CSS when it
  does); `tailwind.breakpoints: "none"` opts out and leaves `@theme` breakpoints to the project —
  `fluid check` then verifies any project-owned `--breakpoint-lg` still equals
  `bands.desktop.minWidth`.

**Tailwind v3**: there is no functional `@utility`. Either upgrade, or set `output.stack: "css"`
and write arbitrary values `lg:py-[calc(120*var(--fluid))]`. That works, but it is verbose and easy
to get wrong. Recommend the upgrade. `fluid init` detects Tailwind 3 in `package.json` and picks
the css stack with a note.

## Vanilla CSS and CSS Modules

`output.stack: "css"`. `<output.dir>/fluid.css` provides the units, `--fluid-header-h` and one class,
`.fluid-container` (the page container — `width: 100%; margin-inline: auto; max-width:
var(--fluid-container-width); padding-inline: var(--fluid-container-padding)`). Author per
component inside each band's media query:

```css
.hero { padding: 80px 24px 40px; }
@media (min-width: 1024px) {
  .hero { padding-block: calc(120 * var(--fluid)); height: calc(900 * var(--fluid)); }
  .hero h1 { font-size: calc(64 * var(--fluid-display)); line-height: calc(72 * var(--fluid-display)); }
}
```

Classic `min-width` syntax keeps your own queries at the stack's floor (Safari 15.4,
`contract.md` §0); range syntax (`width >= 1024px`) needs Safari 16.4. There are no helper classes
per value, because vanilla has no arbitrary values, and a class per
number is the explosion the functional utilities avoid. **CSS Modules is the same stack** —
`output.stack: "css"` again, with class names scoped by the bundler; nothing about fluid-design
changes for it. There is no separate CSS Modules output.

## SCSS

`output.stack: "scss"`. `<output.dir>/_index.scss` provides the functions and mixins on top of the
same `fluid.css` (import `fluid.css` once, globally, from your JS entry or a plain `@import`; the
units, settings and base styles live there, not in `_index.scss`):

```scss
@use 'fluid' as fd;   // the folder that holds fluid/ must be on Sass loadPaths
.hero { @include fd.fluid-desktop { padding-block: fd.fluid(120); @include fd.fluid-type(64, 72); } }
```

`fd.fluid($n)`, `fd.fluid-<role>($n)` per role, `fd.fluid-ui($n)` (`ui: true`), `fd.fluid-text($n,
$size: $n)`, `fd.fluid-cap($n)`, the mixin `fd.fluid-type($size, $lh, $unit: <first role>)`, band
mixins `fd.fluid-phone`, `fd.fluid-tablet`, `fd.fluid-landscape`, `fd.fluid-desktop` (one per
enabled band, mutually exclusive), and `fd.fluid-container`. The
functions `@error` on a number that already has a unit, which turns the silent
`64px * var(--fluid)` failure into a build error. That is a genuine improvement over the Tailwind
arbitrary-value path. Full list: `contract.md` §4.

## StyleX

`output.stack: "stylex"`. `<output.dir>/fluid.stylex.ts`: typed helpers returning `calc()`
strings — `fluid(n)`, `fluidDisplay(n)` / `fluidCopy(n)` (one per role, camelCased), `fluidUi(n)`
(`ui: true`), `fluidText(n, size = n)`, `fluidCap(n)`, and `fluidContainer` (a plain style object,
not a function). Author the breakpoint as a StyleX media-query key against `DESKTOP_QUERY` from the
generated `fluid.ts`. The one limitation: StyleX's `defineVars` cannot express a variable whose
formula reads a sibling variable, which every fluid unit does — that is why the units are plain
global CSS (`fluid.css`, imported once) and StyleX only gets typed `calc()`-string helpers, not
`defineVars` tokens.

## Choosing

| If the project… | `output.stack` |
|---|---|
| is greenfield or already on Tailwind v4 | `tailwind-v4` |
| is on Tailwind v3 and cannot upgrade | `css` + arbitrary values |
| uses Sass | `scss` |
| uses CSS Modules or plain CSS | `css` |
| uses StyleX | `stylex` |
| mixes several | the one owning the section being built; the units and `fluid.ts` are shared, so mixing is safe |

## Traps

- Overriding only `--breakpoint-lg` in px with `tailwind.breakpoints: "none"` and no ladder of your
  own: the rem defaults for the other rungs sort the whole `lg:` block before `sm:`. Either keep
  `"ladder"` (default) or ship the full ladder yourself in px.
- `lg: 64rem` as the "fix": a rem query follows the browser font-size, the band's px query does not.
- Fluid classes without the band-variant prefix, when `bands.phone` is off: they are then plain 1px
  units below desktop, so they only make sense for a value that is the same number on every band.
- Two classes for one property outside `cn()`: stylesheet order picks the winner
  (`frame-and-gutter.md` §5).
- `64px * var(--fluid)` in vanilla or Tailwind arbitrary values: invalid and silently dropped. SCSS
  turns it into a build error.
- Hand-editing anything in `output.dir`: it is generated. `fluid generate` refuses to overwrite a
  hand-edited file without `--force`; move the change into `fluid.config.json` (structure) or a
  setting (a number) instead.

## Scopes and limits per stack

- **Tailwind:** `fluid-grow-until-1680`, `fluid-shrink-until-1280`, `fluid-ui-grow-until-1680`,
  `fluid-off` on the element (they make it a scope), or `fluid-scope` plus any setting.
- **SCSS:** `@include fd.fluid-grow-until(1680)` (also `fluid-shrink-until`, `fluid-ui-grow-until`,
  `fluid-off`) on any selector; `@include fd.fluid-scope` alone to scope other settings. The mixin
  writes the engine's formulas, mirrors included, on that selector (about 60 lines of CSS per use).
- **CSS, CSS Modules, StyleX:** add `data-fluid-scope` to the element and set the setting on it
  (`style="--fluid-grow-until: 1680"` or a rule in your own CSS).
