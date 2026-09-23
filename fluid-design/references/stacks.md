# Styling stacks: the same units, five spellings

Read when: implementing in a stack other than Tailwind v4, or choosing a stack.
Skip when: you are on Tailwind v4 and the utilities are installed.

Every stack spends the same four custom properties (`--fluid`, `--fluid-display`, `--fluid-copy`,
`--fluid-chrome`), defined once on `:root` and redefined inside the engage media query. Only the
authoring surface differs. Generate each stack's layer with
`node scripts/generate-fluid.mjs --stack <name>`. The files in `assets/styles/<name>/` are the
defaults, pre-generated.

## Tailwind v4 (richest)

`assets/styles/tailwind-v4/fluid.css` after `@import 'tailwindcss'`. Functional `@utility` families take the
drawn number: `lg:fluid-py-120`, `lg:fluid-display-64/72`, `lg:fluid-cap-1680`.
- The breakpoint prefix is how the scale stays desktop-only. Below `lg` the units are 1px anyway,
  but the mobile *values* differ from the drawn desktop ones, so the fluid classes are always prefixed.
- Arbitrary values spend the units directly when no utility fits: `lg:grid-cols-[1fr_calc(512*var(--fluid))]`,
  `lg:px-[calc(24*var(--fluid-copy))]`.
- Register the families with tailwind-merge (`cn.ts`).
- `--breakpoint-lg` in `@theme` must equal `engageAt`.

**Tailwind v3**: there is no functional `@utility`. Either upgrade, or add the vanilla layer and write arbitrary
values `lg:py-[calc(120*var(--fluid))]`. That works, but it is verbose and easy to get wrong. Recommend the
upgrade.

## Vanilla CSS and CSS Modules

`assets/styles/css/fluid.css` provides the units, `--header-h` and `.fluid-frame`. Author per component
inside the engage media query:

```css
.hero { padding: 80px 24px 40px; }
@media (width >= 1024px) {
  .hero { padding-block: calc(120 * var(--fluid)); height: calc(900 * var(--fluid)); }
  .hero h1 { font-size: calc(64 * var(--fluid-display)); line-height: calc(72 * var(--fluid-display)); }
}
```

There are no helper classes per value, because vanilla has no arbitrary values, and a class per number is
the explosion the functional utilities avoid. CSS Modules is the same, with class names scoped.

## SCSS

`assets/styles/scss/_fluid.scss` provides `fluid(120)`, `fluid-display(64)`, `fluid-copy(14)`,
`fluid-text(56)`, `fluid-chrome(48)`, `fluid-cap(1680)`, and the mixins `fluid-up`, `fluid-type($size, $lh, $unit)`,
`fluid-frame` and `fluid-units`. The functions `@error` on a number that already has a unit, which turns the
silent `64px * var(--fluid)` failure into a build error. That is a genuine improvement over the Tailwind path.

## StyleX

`assets/styles/stylex/`: `defineVars` for the units plus typed helpers returning `calc()` strings.
Author the breakpoint as a StyleX media-query key. See its README for the one limitation (nested
`max()`/`min()` inside `defineVars`).

## Choosing

| If the project… | Use |
|---|---|
| is greenfield or already on Tailwind v4 | Tailwind v4 |
| is on Tailwind v3 and cannot upgrade | vanilla layer + arbitrary values |
| uses Sass | SCSS |
| uses CSS Modules or plain CSS | vanilla |
| uses StyleX | StyleX |
| mixes several | the one owning the section being built; the units are shared, so mixing is safe |
