# The container: one box, scaled padding, and constants that drift

The page **container** is one utility, `fluid-container`, driven by two settings per band. (v1
called it the frame and its padding the gutter, hence the filename; `brownfield-migration.md` maps
the old names.)

Purpose: The page container (`fluid-container`: max width and scaled padding on one box, per band),
strips that run to the window edges, what to do when a row will not fit, and constants that drift
against a scaled box.

Read when: writing any section's outer structure, a row will not fit the container, a strip or
carousel should reach the window edges, a grid changes its column count on big screens, or a section
sits a few pixels off its neighbours' line.
Skip when: you are only adjusting type inside an existing container.
Inputs: the section's drawn widths and paddings, and the container settings.
Produces: a section wrapper on one container, a content-budget verdict (or fractions for an
over-budget row), and drift-free gaps and constants.

## Contents
1. There is one container, and it is one box (per band; one box; edge to edge with `fluid-bleed-x`; container is not measure)
2. When a row will not fit the container: fractions, not smaller padding
3. A constant compared against a scaled box will drift
4. `fluid-gap-x`: horizontal space inside a scaling box scales
5. Two classes for one property
6. Traps

## 1. There is one container, and it is one box

```tsx
<section className="w-full bg-surface-light">   {/* colour and vertical rhythm only */}
  <div className="fluid-container relative flex flex-col …">
```

- The section carries full-bleed colour; its inner wrapper carries the container, once per section.
- `fluid-container` is `width: 100%`, `margin-inline: auto`, `max-width: var(--fluid-container-width)`,
  `padding-inline: var(--fluid-container-padding)`. Both variables follow the active band, so the
  class needs no `lg:` prefix. SCSS: `@include fd.fluid-container`.

| Band | Width (`--fluid-<band>-container-width`) | Padding (`-container-padding`) |
|---|---|---|
| desktop | 1680, grows above that, never narrows below 1680 CSS px | 80 |
| phone | 560 | 24 |
| tablet, landscape | 1024 (the desktop breakpoint, so in practice full width) | 32 |

**Tablet and landscape are full width by default.** Most designs have no tablet or landscape frame,
and the phone design held to a 560 column read as a phone floating on a tablet; full width with a
32px gutter reads as a layout. To keep the old column:

```css
:root {
  --fluid-tablet-container-width: 560;    --fluid-tablet-container-padding: 24;
  --fluid-landscape-container-width: 560; --fluid-landscape-container-padding: 24;
}
```

**The padding never drops below the safe-area inset.** `--fluid-container-padding` is
`max(drawn padding × unit, env(safe-area-inset-left, 0px), env(safe-area-inset-right, 0px))`. A phone
on its side under `viewport-fit=cover` keeps content clear of the notch with no per-component
safe-area rules, and everything that reads the padding (`fluid-bleed-x`) follows. Elsewhere the
insets are 0 and nothing changes.

**Changing the page gutter later is one setting.** `--fluid-desktop-container-padding: 108;` in
`:root` moved every migrated section at once. Anything that still carries its own gutter (a fixed
`--spacing-gutter: 72px`, a hard-coded `lg:px-18`) stays behind: bridge the token
(`--spacing-gutter: var(--fluid-container-padding)` in `@theme`) and replace hard-coded gutters
route by route (`brownfield-migration.md`).

### Why the desktop width only grows and the padding scales

- **The width only grows**: `max(1680px, 1680 × --fluid)`. Below the design frame the drawn width
  already fits, and shrinking it would narrow the composition on the screens that need room. Above
  it, it must grow, or the section gets taller without getting wider. (The mobile bands track
  `--fluid` directly; there is no drawn ceiling to protect.)
- **The padding scales** (`80 × --fluid`). When width binds it is a fixed 5.6% of the window. When
  height binds (a short, wide window), the box holds its 1680px width while everything inside it,
  padding included, shrinks with the unit: the composition tightens while the outer edge holds
  (measured: a 1600 container stayed 1600px wide in a 1680×700 window, f = 0.78). A frozen 80px
  padding falls from 5.6% of the window at 1440 to 3.1% at 2560, walking the content toward the
  edges. Scaled, the content is `1680f − 160f = 1520f`, the drawn content scaled, with nothing to drift.

### Max width and padding go on the same box

```
padding INSIDE (correct)             padding OUTSIDE (drifts)
┌──── container 1680·f ─────┐        ├─80─┬── container 1520·f ──┬─80─┤
│ 80f │ content │ 80f │                   └─── content ────┘
```

The outside form is only accidentally right and breaks the moment someone freezes the padding: a
product library once sat about 22px right of its own hero at a factor of 1.28. A section may push
the padding to a *descendant* (a full-bleed render where only the copy is inset), never to an
**ancestor**.

### Edge to edge: `fluid-bleed-x`

A strip that should reach the window edges while its content stays on the container's line (a
carousel track, a logo strip) goes inside the container with `fluid-bleed-x` (CSS
`.fluid-bleed-x`, SCSS `@include fd.fluid-bleed-x`):

```tsx
<div className="fluid-container">
  <h2 …>Title on the container line</h2>
  <ul className="fluid-bleed-x flex overflow-x-auto fluid-gap-24">…</ul>
</div>
```

It pulls the element out by the padding plus the space beside the container
(`max(0px, (100vw − container width) / 2)`) and pads back in by the same amount, so the first item
lines up with the title and the track scrolls to the window edge. `100vw` counts a classic desktop
scrollbar, so the strip overshoots half a scrollbar on each side; the `html` overflow guard in
`base.css` clips it (with `output.base: false`, keep your own guard on `html`).

### Container is not measure

A narrow reading column is a **measure** (`fluid-cap-753`, `fluid-cap-1200`), correct only *inside*
the container. The bug is a measure doing the container's job, such as a page-level
`max-w-[1360px]`. A drawn 240px padding on a 1680 container is a 1200 measure, not padding:
`fluid-px-240` eats the content below 1680 (1440 leaves 960, 1280 about 853). Write
`lg:fluid-cap-1200 mx-auto` inside the normal container.

A near-full-bleed band drawn with a 24px inset is a drawn value like any other (`lg:fluid-px-24`
with `fluid-cap-*`, not `fluid-container`). No section may hold its inset *frozen* while the box
beside it grows.

## 2. When a row will not fit the container: fractions, not smaller padding

The content box is a budget: `min(base-width, container-width) − 2 × padding`, 1280 at the design
frame and 1520 at the container's own width with the defaults. `fluid calc budget --widths …` reports
OVER when a row does not fit. A row drawn at 1441 fits at 1520 but not at 1280, and both obvious
escapes are wrong:

- **Trim the numbers.** Shipped once as bar 100 with gaps 28/20/24; the value label measured about
  116, overran the bar, ate the gap and printed `607/TPS177/TPS`.
- **Shrink the padding.** 24px bought the room and took the section off the site's line: it was
  visibly 56px wider than its neighbours.

Instead, state each horizontal value as its drawn fraction of the content width (1520 at the
defaults). With container queries, make the content box an `@container` and use `cqw`:

```tsx
'@container lg:[--copy-w:28.224cqw]'  // 429 / 1520
'lg:[--bar-w:7.566cqw]'               // 115 / 1520
'lg:[--gap-block:6.842cqw]'           // 104 / 1520
```

Exact at the container's width, proportional everywhere else, and it **cannot overflow**. Where the
max width binds the content box is `1520·f`, so `2.632cqw` equals `40 × --fluid` there; `cqw` only
differs where the window binds, which is where `--fluid` promised width the box did not have.
**Heights stay on `--fluid`.** Display type that must keep drawn line breaks in such a column uses
the same move: `64/1200 → 5.3333cqw`, 51.2px with both lines intact at 1440.
`fluid calc budget` prints these fractions.

**Without `cqw`** (a team that avoids newer CSS): a direct child of the content box takes the same
fraction as a percentage (`lg:w-[28.224%]`, `lg:gap-x-[6.842%]`), since percentages resolve against
that box. For type, or anything deeper, write the content width out in plain CSS:
`calc((min(100vw, var(--fluid-container-width)) - 2 * var(--fluid-container-padding)) * 64 / 1520)`
(`100vw` counts a classic scrollbar, a few px of slack). Or take the overage out of the drawing's
whitespace, with design sign-off.

## 3. A constant compared against a scaled box will drift

Anywhere CSS **compares** a length to a box, putting the box on the scale while the length stays
fixed changes the outcome as the window grows. Nothing is invalid; the layout reorganises itself.

```tsx
grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))]                    // drifts
grid-cols-[repeat(auto-fill,minmax(min(calc(330*var(--fluid)),100%),1fr))]   // holds
```

With 320 frozen in a growing container, a four-column grid became five, then six by a factor of
1.07: the column count had become a property of the monitor. Scale the minimum and both sides move
together. 330 rather than the drawn 320 is the smallest minimum a fifth column can never beat
(`5·330 + 4·8 = 1682 > 1680`). This does **not** buy four columns at every width: four 374px cards
need 1520 of content and 1440 has 1280, so below about 1500 the grid is 3-up by arithmetic.

### A scaled minimum still re-flows on a short, wide window

When height binds, the container's grow-only width holds while the scaled minimum keeps shrinking,
so the two are no longer on one scale. Measured: a grid that held 4 columns from 1024×640 to
3840×2160 read **6 columns at 1680×700** (f = 0.78, content 1520px fixed, minimum about 257px).

**(a) Cap the column count — reach for this first:**

```
grid-template-columns: repeat(auto-fill, minmax(max(min(calc(330*var(--fluid)),100%),calc((100% - 3*24px)/4)),1fr))
```

The minimum is the larger of the scaled 330 and a quarter of the box's real content width minus the
three gaps. The second term is a plain percentage, so it tracks the box even where its width stopped
moving with the unit: at most four columns at every width and height. Adjust `4` and `3*24px` to the
drawn grid.

**(b) Put the grid's own width on the scale** (`fluid-w-<drawn> max-w-full`). This holds too, but
only for a grid that may be narrower than its container; a grid that fills the container wants (a).

`fluid verify` catches a regression: mark the grid `data-verify-grid` and the run fails when its
column count differs across desktop windows (`data-verify-grid="responsive"` opts out by design).

| Construct | The constant that drifts |
|---|---|
| `repeat(auto-fill/auto-fit, minmax(N, 1fr))` | N (the column count changes) |
| `flex-wrap` + `basis-[Npx]` | N (the wrap point moves) |
| `min-w-*` on a flex or grid child | where it stops shrinking |
| container queries | the threshold, if the container scales |
| `calc(100% - Npx)` | N shrinks as a share of the box |

Ratios are immune: `fr`, percentages and unitless `line-height`. `minmax(0,904fr)_minmax(0,512fr)` needs nothing.

## 4. `fluid-gap-x`: horizontal space inside a scaling box scales

Five partner marks on `fluid-h-*` inside a `fluid-w-560` column, 40px apart, drifted from the drawn
wrap points as the column grew. Use `fluid-gap-x-*` between items inside a scaling box. Space
*between page columns* can stay on the breakpoint.

## 5. Two classes for one property

`tailwind-merge` resolves conflicts only inside `cn()`, and only once the fluid families are
registered (`withFluid`). A plain `className="lg:fluid-min-h-987 lg:min-h-0"` never passes through
`cn`, so **stylesheet order** picks the winner, not class order. Do not write both; `fluid audit`
flags `double-fluid-same-prop`.

## 6. Traps
- [ ] Max width and padding on one box; padding never on an ancestor.
- [ ] Padding comes from the container's settings (or `fluid-px-*`), never a frozen `px-20` or an old gutter token.
- [ ] Text measures sit inside the container; a drawn 240 padding is a 1200 measure.
- [ ] The widest row fits `min(base-width, container-width) − 2 × padding` (`fluid calc budget`), or is written as fractions.
- [ ] Edge-to-edge strips use `fluid-bleed-x` inside the container, not a second, wider wrapper.
- [ ] Every `auto-fill` minimum, wrap basis and `min-w` inside a scaling box is scaled too.
- [ ] Spot-check at 2560 wide and at a short, wide window: drift is invisible at and below the design frame.
