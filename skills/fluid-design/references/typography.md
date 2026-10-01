# Typography on the fluid scale

Purpose: Choosing a type unit by what its box does, the `/lh` modifier, named type styles, controls
around a label, `em` tracking, hard breaks, line-count holds, mobile title ladders, shared type
atoms, fonts, and the browser font-size and zoom behaviour.

Read when: sizing any text through a `fluid-*` type utility, building a type scale or named type
styles, sizing a button around its label, choosing fonts, or when a heading wraps differently from the design.
Skip when: a size is plain Tailwind (`text-[15px]`, no `fluid-*` class): it stays what it says at
every band, by design (`bands.md`).
Inputs: the drawn type sizes and line heights, the box each text sits in, and the fonts.
Produces: a type utility per text element (`fluid-display-*`, `fluid-text-*`, `fluid-copy-*`,
`fluid-ui-*`), stable wraps, and font loading.

## Contents

- Type units
- Choosing a unit: ask what the box around the text does
- The `/lh` modifier
- Named type styles
- A control around a label
- Tracking in `em`, never in px
- Hard breaks when the natural wrap is not stable
- Type that must hold a drawn line count in an over-budget column
- Variable-driven title ladders (mobile) plus fluid (desktop)
- Shared type atoms take an opt-in `fluid` prop
- Fonts
- Browser font-size setting, and browser zoom
- Traps

## Type units

A **type role** is a size curve that shrinks more gently than the layout. Each entry in `roles`
(default `display` for headlines, `copy` for body and labels) gets a unit and a `fluid-<role>-N/LH`
utility; a custom role gets its own family when added (`units.md` §3). Two more families are
not roles: `fluid-text-N/LH` is type on the plain `--fluid` unit, for a box that scales with the
layout, and `fluid-ui-text-N/LH` is header, nav and footer type on `--fluid-ui` (follows width, never
shrinks for a short window, `units.md` §2). All take the `/lh` modifier.

## Choosing a unit: ask what the box around the text does

```
Is it type?
├─ no  ───────────────────────────────→ --fluid        (fluid-p, fluid-h, fluid-w …)
└─ yes
   ├─ Header, nav or footer                                           → fluid-ui-text-*
   ├─ Its container is a FIXED width (a text measure, a page column)  → fluid-display-* (large) / fluid-copy-* (small) / a custom role
   └─ Its container SCALES on --fluid (fluid-w-*, fluid-size-*, a cqw box) → fluid-text-*
```

**The container rule is not optional.** Type on a gentle curve inside a box on the steep curve
outgrows the box and re-wraps. Measured: a stat value at `fluid-display-56` inside a `fluid-w-512`
cell went to two lines at 700px tall, where the frame has one; on `fluid-text-56` it holds. A heading
in a fixed `max-w-[753px]` measure is the opposite case and takes the gentle curve.

**Display versus copy is about size.** On desktop, display shrinks at 62% of the layout's rate and
copy at 33% (the **damping**): big type can lose more, a 12px label cannot. Above the design frame
the two are equal. A third size tier with its own curve (an eyebrow, a stat figure) is a third role,
not a class-string hack on `copy`; it starts at `copy`'s damping.

## The `/lh` modifier

`lg:fluid-display-64/72` is 64px type on a 72px line box, both on the same unit. Without the
modifier only `font-size` is emitted. The modifier is drawn px, bare in 0.25 steps or bracketed
(`/[26.5]`): `/1.2` is a 1.2px line box, not a ratio (`fluid audit` flags `fluid-leading-ratio`).
For a ratio, put a unitless `leading-[1.2]` next to the size. Pin line boxes to the drawn value
when the font's metrics differ from the drawing: a substituted, looser body face is why the
reference build pins every leading.

`tailwind-merge` treats a later `text-*` size as clearing an earlier `leading-*`: write `text-[…]`
before `leading-[…]`, or use the modifier. In a `cva` recipe, never put `leading-*` in the base
string when variants set `text-*`; it is silently stripped.

## Named type styles

A team with a fixed type scale can name it once, as `@utility` on the role units, instead of
repeating `fluid-display-32/40` at each call site (a recipe; nothing generates it):

```css
@utility type-h2 { font-size: calc(32 * var(--fluid-display)); line-height: var(--tw-leading, 1.25); letter-spacing: var(--tw-tracking, -0.02em); }
@utility type-body-md { font-size: calc(16 * var(--fluid-copy)); line-height: var(--tw-leading, 1.5); }
```

- Line height as a ratio and tracking in `em`, both read through `--tw-leading`/`--tw-tracking`
  first (the pattern Tailwind's own `text-*` uses), so a `leading-*` or `tracking-*` on the element
  still wins whatever the stylesheet order.
- The number is the drawn size; the role unit does the scaling, per band. Where phone and desktop
  draw different sizes, define a style per size and pick with `lg:`.
- `tailwind-merge` does not know these names: never put two on one element, or register them in
  your `cn` as a `font-size` group.

## A control around a label

A button is a line box plus padding, so its box spends the label's unit. Use the **role box
utilities** (`fluid-<role>-h-*`, `-w-*`, `-size-*`, `-p-*`, `-px-*`, `-py-*`, `-gap-*`):

```tsx
<button className="fluid-copy-14/20 fluid-copy-h-56 fluid-copy-px-24 fluid-copy-gap-8 inline-flex items-center">
```

On `--fluid` the label crowds its padding on a short window, where the two units differ by up to
27%. An icon that matches the label's line goes on the same unit (`fluid-copy-size-20`). That is
also the plain alternative to the `lh` unit (`size-[1lh]`): `lh` needs Safari 16.4, Chrome 109,
Firefox 120, so a team that avoids newer CSS writes the drawn line box instead. SCSS
`fd.fluid-copy(56)` and StyleX `fluidCopy(56)` work on any property.

## Tracking in `em`, never in px

`tracking-[-0.01em]` follows the font size and needs no fluid twin. A px value (`-1px`) is exact
only at the design frame. Convert: `-1px at 64px = -0.015625em`. The audit reports px tracking.

## Hard breaks when the natural wrap is not stable

A column and its type that both scale nearly always wrap the same, but rounding moves the wrap: one
line measured 12.48 columns at one factor and 12.51 at another, so a headline read three lines on
one laptop and hung "ON" off the first line on another. Author drawn breaks as block spans or
`<br className="hidden lg:inline" />`; never rely on the rendered wrap. Line-by-line entrances split
at these breaks.

## Type that must hold a drawn line count in an over-budget column

Size it as a fraction of the content box (`frame-and-gutter.md` §2): `64/1200 = 5.3333cqw` is exact
at the container's width and keeps both lines at 1440, where `fluid-display-64` gives four. Without
`cqw`, write the content width out in plain CSS (the same section shows how).

## Variable-driven title ladders (mobile) plus fluid (desktop)

With the mobile bands on, plain `fluid-display-*` at the phone frame's number already covers 320–430
smoothly. Use a ladder only when one width needs a number off the band's curve (a long word that
overflows at one breakpoint):

```tsx
className="text-[length:var(--title)] [--title:36px] min-[390px]:[--title:40px]
           lg:[--title:min(calc(64*var(--fluid-display)),calc((100vw-160px)/16.2))]"
```

The width-based `min()` guards that long word. Use it sparingly.

## Shared type atoms take an opt-in `fluid` prop

A chip, button or label on 20+ call sites, across routes that migrate at different times, takes
`fluid?: boolean`. Each atom owns its **height contract**: ink size, block padding, outer and inner
line box must agree, so they live in one size table in the component. Callers who override through
`className` re-derive it wrongly; that happened six times on the reference build.

```ts
const BOX = { default: 'text-[12px] py-[4px] leading-[16px]', large: 'text-[14px] py-[4px] leading-[18px]' }
const BOX_FLUID = { default: 'lg:fluid-copy-12/16 lg:fluid-copy-py-4', large: 'lg:fluid-copy-14/18 lg:fluid-copy-py-4' }
```

An optical 1px nudge on all-caps mono labels goes on an inner span as `translate-y-[0.025em]`, never
on the chip, which would move its background.

## Fonts

- Load through the framework's pipeline (`next/font/local`, or `@font-face` with `font-display: swap`).
  Ship only the weights used.
- Map faces to tokens (`--font-sans`, `--font-display`, `--font-heading`, `--font-mono`). If a family
  ships several weights but was used at one, set that weight as a base rule so unspecified usage
  does not change.
- **A component's name must describe its face.** A `MonoLabel` that rendered the sans face caused a
  swap that silently changed typefaces.
- Measure fallback metrics if CLS matters; `size-adjust` on a fallback `@font-face` keeps the swap still.

## Browser font-size setting, and browser zoom

- **The default font-size setting** is ignored by the type units from a band's breakpoint up, on
  purpose: the composition's proportions are the point. Do not add a rem-anchored twin. With
  `bands.phone: false`, mobile type is ordinary CSS and can use rem.
- **Browser zoom** (Cmd/Ctrl +) must work: WCAG 1.4.4 tests it. Viewport-based type cancels zoom on
  its own, so the type units read a `--fluid-zoom` factor the generated `runtime/zoom.js` measures
  (`browser-zoom.md`). Wire `FluidHead`/`fluidPlugin` or `runtime/zoom.classic.js` first in
  `<head>`, and draw mobile body copy no smaller than desktop. Roles zoom fully; `fluid-text-*` zooms
  fully up to `--fluid-zoom-text-full` (24 drawn) and not at all from `--fluid-zoom-text-none` (48),
  so a big title holds its scaled box while reading-size copy beside it zooms.

## Traps
- [ ] The unit follows the container: `fluid-text-*` in scaling boxes, `fluid-ui-text-*` in header and nav.
- [ ] Tracking in `em`; line boxes through `/lh` or unitless ratios.
- [ ] `text-*` before `leading-*` in merged class strings; no `leading-*` in a cva base.
- [ ] Controls size on their label's role (`fluid-copy-h-*`), not on `--fluid` or a hand-written `calc()`.
- [ ] Hard breaks are breakpoint-scoped or block spans.
- [ ] The zoom script is wired in `<head>`, and `fluid verify`'s zoom row passes.
- [ ] A band's type is tuned with its damping setting (`--fluid-<band>-<role>-damping`), not a
  different drawn number per breakpoint.
