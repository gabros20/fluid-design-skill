# Typography on the fluid scale

Read when: sizing any text from the breakpoint up, building a type scale, choosing fonts, or when a heading
wraps differently from the design.
Skip when: working on mobile-only type, which is ordinary responsive CSS.

## Choosing a unit: ask what the box around the text does

```
Is it type?
├─ no  ───────────────────────────────→ --fluid        (fluid-p, fluid-h, fluid-w …)
└─ yes
   ├─ Its container is a FIXED width (a text measure, a page column)  → fluid-display-* (large) / fluid-copy-* (small)
   └─ Its container SCALES on --fluid (fluid-w-*, fluid-size-*, a cqw box) → fluid-text-*
```

**The container rule is not optional.** Type on a gentle curve inside a box on the steep curve
outgrows its box and re-wraps. Measured: a stat value at `fluid-display-56` inside a `fluid-w-512` cell
went to two lines at 700px tall, where the frame has one. On `fluid-text-56` it holds. A section heading in
a fixed `max-w-[753px]` measure is the opposite case and takes the gentle curve.

**Display versus copy is a judgement about size, not role.** Display shrinks at 62% of the layout's rate, copy
at 33%. Big type can afford to lose more; a 12px label cannot. Above the reference the two are equal,
so the choice only matters on windows smaller than the reference.

**Padding derived from a line box follows that line box.** A button is an 18px line box plus 16/24
padding, so its padding spends `--fluid-copy` like its label does. On `--fluid` the label crowds its own
padding on a short window, where the two units diverge by up to 27%.

## The `/lh` modifier

`lg:fluid-display-64/72` is 64px type on a 72px line box, both scaled by the same unit. Omit the modifier and
only `font-size` is emitted. A unitless `leading-[1.2]` also works, and follows the size for free. Keep line
boxes pinned to the drawn value when the font's natural metrics differ from the drawing. A body face
that was once substituted (a wider, looser font) is why every run of type on the reference build pins its
leading; after the correct face shipped, the pins simply agree with it.

Watch for `tailwind-merge`: it treats a later `text-*` size as clearing an earlier `leading-*`, so write
`text-[…]` before `leading-[…]`, or use the modifier. Inside a `cva` recipe, never put `leading-*` in
the base string when variants set `text-*`; it is silently stripped.

## Tracking in `em`, never in px

`tracking-[-0.01em]` follows the font size for free and needs no fluid twin. A px tracking value (`-1px`)
is exact only at the reference and drifts once the ink scales. Convert: `-1px at 64px = -0.015625em`.
The audit reports px tracking.

## Hard breaks when the natural wrap is not stable

A column and its type that both scale ought to wrap identically at every desktop width, and very
nearly do. Rounding moves the wrap: one line measured 12.48 columns at one factor and 12.51 at another,
so "…INFERENCE ON" fits at 58.9px in a 736px column and does not at 67.2px in an 840px one. The
headline read three lines on one laptop and hung "ON" off the first line on another.

Use a breakpoint-scoped hard break for drawn line breaks: `<br className="hidden lg:inline" />`, or
author each drawn line as a block span. Never rely on the rendered wrap to reproduce a drawn break.
Line-by-line entrances split at these authored breaks: see the `scroll-animation` skill.

## Type that must hold a drawn line count in an over-budget column

Use `cqw` on the content box (`frame-and-gutter.md` §2): `64/1200 = 5.3333cqw`. That is exact at the canvas and
keeps both lines at 1440, where `fluid-display-64` would give four lines.

## Variable-driven title ladders (mobile) plus fluid (desktop)

For display type that must fit a phone width exactly, drive the size from a custom property per
breakpoint and let the breakpoint rule take the fluid value:

```tsx
className="text-[length:var(--title)] [--title:36px] min-[390px]:[--title:40px]
           lg:[--title:min(calc(64*var(--fluid-display)),calc((100vw-160px)/16.2))]"
```

The `min()` with a width-derived term is a guard for a long word that would otherwise overflow at the
breakpoint. Use it sparingly; one fluid unit is the norm.

## Shared type atoms take an opt-in `fluid` prop

A chip, button or label used on 20+ call sites, across routes that migrate at different times, takes
`fluid?: boolean` rather than being fluid by default. Each atom owns its **height contract**: ink size,
block padding, outer line box and inner line box are four numbers that must agree. They live in one
size table inside the component, each with a fluid twin on `--fluid-copy`. Callers who override via
`className` re-derive the contract wrongly. That happened six times on the reference build, and it is why
the size table exists.

```ts
const BOX = { default: 'text-[12px] py-[4px] leading-[16px]', large: 'text-[14px] py-[4px] leading-[18px]' }
const BOX_FLUID = { default: 'lg:text-[calc(12*var(--fluid-copy))] lg:py-[calc(4*var(--fluid-copy))] lg:leading-[calc(16*var(--fluid-copy))]', … }
```

An optical 1px correction on all-caps mono labels goes on an inner span as `translate-y-[0.025em]`,
in `em` so it tracks the ink, and never on the chip, which would move the background with it.

## Fonts

- Load through the framework's font pipeline (`next/font/local` or `@font-face` with `font-display: swap`).
  Ship only the weights actually used. A display face used only at 800 ships one file.
- Map faces to tokens: `--font-sans`, `--font-display`, `--font-heading`, `--font-mono`. If a family ships
  several weights but was historically used at one, set that weight as a base rule so unspecified usage
  does not change (`.font-heading { font-weight: 500 }` in the base layer; utilities override it).
- **A component's name must describe its face.** A `MonoLabel` that renders the sans face caused a
  swap that silently changed typefaces. Name it for what it draws.
- Measure fallback metrics if CLS matters; `size-adjust` on a fallback `@font-face` keeps the swap still.

## Browser font-size setting, and browser zoom

These are two different things.

- **The default font-size setting** (Settings → Appearance → Font size). The type units resolve in px
  from the breakpoint up, so they ignore it there. This is deliberate: the composition's proportions
  are the point. Do not add a rem-anchored twin. Mobile type, below the breakpoint, is ordinary CSS
  and can use rem.
- **Browser zoom** (Cmd/Ctrl +). This one must work: it is what WCAG 1.4.4 tests. Viewport-derived
  type cancels zoom on its own, so the type units read a `--fluid-zoom` factor that
  `assets/runtime/fluid-zoom.js` measures (`fluid-scale.md` §12, Browser zoom). Install the script,
  keep running copy on `fluid-copy-*`/`fluid-display-*` (`fluid-text-*` does not zoom), and draw
  mobile body copy no smaller than its desktop reference size.

## Traps
- [ ] The unit follows the container: `fluid-text-*` inside scaling boxes, never display type.
- [ ] Tracking in `em`; line boxes via `/lh` or unitless ratios.
- [ ] `text-*` before `leading-*` in merged class strings; no `leading-*` in a cva base.
- [ ] Hard breaks are breakpoint-scoped (or block spans); never trust the rendered wrap for a drawn break.
- [ ] Shared atoms own their height contract; fluid is an opt-in prop.
- [ ] `fluid-zoom.js` is inlined in `<head>`, and the verifier's zoom row passes.
