# The container: one box, scaled padding, and constants that drift

The page **container**: one utility, `fluid-container`, plus two per-band settings. (v1 called it
the frame and its padding the gutter, hence the filename; `brownfield-migration.md` maps the old
names.)

Purpose: The page container (`fluid-container`: max width and scaled padding on one box, per band),
what to do when a row will not fit it, and constants that drift against a scaled box.

Read when: writing any section's outer structure, a row will not fit the container, a grid changes
its column count on big screens, or a section sits a few pixels off its neighbours' rail.
Skip when: you are only adjusting type inside an existing container.
Inputs: the section's drawn widths and paddings, and the container settings.
Produces: a section wrapper on one container, a content-budget verdict (or `cqw` fractions for an
over-budget row), and drift-free gaps and constants.

## Contents
1. There is one container, and it is one box (padding and max-width on one box; container is not measure; the drawn padding)
2. When a row will not fit the container: use `cqw`, not smaller padding
3. A constant compared against a scaled box will drift
4. `fluid-gap-x`: horizontal space inside a scaling box scales
5. Two classes for one property
6. Traps

## 1. There is one container, and it is one box

```tsx
<section className="w-full bg-surface-light">   {/* colour and vertical rhythm only */}
  <div className="fluid-container relative flex w-full flex-col …">
```

Every example below adds `lg:` to whatever sits *inside* the container,
because most drawings only change above the desktop band. `fluid-container` itself needs no prefix
at all — its width and padding are already per-band settings, so it does the right thing at
whichever band is active, mobile bands included. SCSS uses the `fluid-container` mixin, which is
the same box.

- The section carries full-bleed colour. The inner box carries the container.
- `fluid-container` is one utility for the whole thing: `width: 100%`, `margin-inline: auto`,
  `max-width: var(--fluid-container-width)`, `padding-inline: var(--fluid-container-padding)`. Both
  variables are per-band settings — `--fluid-<band>-container-width` / `-container-padding` — at
  1680/80 desktop and 560/24 phone by default (tablet and landscape use the phone values unless
  set). Apply it once per section, on its inner wrapper.
- **`--fluid-desktop-container-width` only grows**: `max(1680px, 1680 × --fluid)`. Below the
  reference the drawn width already fits, and shrinking it would narrow the composition on exactly
  the screens that need room. Above the reference it has to grow, or the section gets taller
  without getting wider. (The mobile bands have no such floor: their container width tracks
  `--fluid` directly, since there is no drawn ceiling to protect there.)
- **The padding scales** (`--fluid-container-padding`, `80 × --fluid` on desktop). This reverses an
  earlier rule ("padding is fixed spacing; it follows the breakpoint, not the scale"). That
  objection described a case that cannot happen:
  - Width arm binds: the padding is `80·W/1440`, a fixed **5.6% of the viewport**, which is exactly what you want.
  - Height arm binds (a short, wide window): the container's max-width is **grow-only**
    (`max(1680px, 1680·f)`), and `f < 1` here, so the `max()`
    resolves to the constant `1680px`, not to `1680·f`. **The container stays at its
    reference width in px; it does not get narrower.** Its own centring keeps that
    constant-width box inside a window wider than it (measured: a
    1600-wide container produced a 1600px-wide box in a 1680-wide, 700-tall
    window, f = 0.78) — a window narrower than the container instead makes the
    box fill the window edge-to-edge, same as always. What DOES shrink is
    everything *inside* that box: the padding (`--fluid-container-padding` is `80·f`) and
    every other `--fluid`-scaled value, because those read the unit
    directly rather than sitting behind a grow-only `max()`. So the
    composition tightens — padding, type, gaps all shrink together — while
    the container's own outer edge holds at the reference width. The padding is
    still interior spacing either way, and it never touches the bezel.

  A frozen padding falls from 5.6% of the viewport at 1440 to 3.1% at 2560, walking the composition
  toward the edges. The arithmetic also collapses once it scales: content = `1680f − 160f = 1520f`, the
  drawn content scaled, with nothing to drift.

### Max-width and padding go on the same box

```
padding INSIDE (correct)             padding OUTSIDE (drifts)
┌──── container 1680·f ─────┐        ├─80─┬── container 1520·f ──┬─80─┤
│ 80f │ content │ 80f │                   └─── content ────┘
```

The outside form is only accidentally correct: it breaks again the moment someone freezes the
padding. That is how a product library came to sit about 22px to the right of its own hero at a
factor of 1.28. A section may push the padding to a *descendant* (a scene with a full-bleed render
where only the copy is inset). It may never put the padding on an **ancestor**.

### Container is not measure

A narrow reading column is not a second container. `fluid-cap-753`, `fluid-cap-800` and
`fluid-cap-1200` are **measures**, and they are correct, but only *inside* the container. The bug is
a measure doing the container's job, such as a page-level `max-w-[1360px]`.

A drawn 240px padding on a 1680 container is a **1200 measure**, not padding. `fluid-px-240` was
tried; below 1680 it is bound to the viewport and eats the measure: 1440 leaves 960, and 1280 leaves
about 853. Write it as `lg:fluid-cap-1200 mx-auto` inside the normal container.

### The drawn padding is not always 80

A near-full-bleed band drawn with a 24px inset becomes `lg:fluid-px-24`. That is a drawn value like
any other, hand-rolled with `fluid-cap-*`/`fluid-px-*` rather than `fluid-container` — a section that
deviates from the standard container isn't using the standard container. What no section may do is
hold its inset *frozen* while the box beside it grows.

## 2. When a row will not fit the container: use `cqw`, not smaller padding

The content box is a budget: `min(desktop base-width, container-width) − 2 × padding`. At the
defaults that's `min(1440, 1680) − 2·80 = 1280` at the reference, and `1680 − 2·80 = 1520` at the
container's own width. `fluid calc budget --widths …` computes this for you and reports OVER when a
row doesn't fit.

A row drawn at, say, 1441px cannot be stated in absolute units — it fits at the container's width
(1520) but not at the reference (1280). There are two obvious escapes, and both are wrong:

- **Trim the numbers.** Shipped once as bar 100 with gaps 28/20/24. The value label measured about 116,
  so it overran the 100px bar, ate the candle gap, and printed `607/TPS177/TPS`.
- **Shrink the padding.** 24px up to 1600 bought the room and took the section off the site rail. It was
  visibly 56px wider than its neighbours.

The fix is to stop stating the width axis as a length. Make the container's content box an
`@container` and express each horizontal value as its drawn fraction of the content width:

```tsx
'@container lg:[--copy-w:28.224cqw]'  // 429 / 1520
'lg:[--bar-w:7.566cqw]'               // 115 / 1520
'lg:[--gap-block:6.842cqw]'           // 104 / 1520
```

This is exact at the container's width, proportional everywhere else, and **cannot overflow**. Type
with no slack of its own goes along with it: a numeral that must fit a bar is `--num: 2.632cqw`.

It costs nothing where the container *does* fit: whenever the max-width binds, the content box is
`1520·f`, so `2.632cqw` equals `40 × --fluid` there. `cqw` only diverges where the viewport binds,
which is exactly where `--fluid` was promising width the box did not have. **Heights stay on
`--fluid`.** Only the over-budget axis changes.

The same move works for display type that must hold drawn line breaks in an over-budget column: `64/1200 → 5.3333cqw`
on the content box. That is exact at the container's width, and 51.2px with both lines intact at 1440.

`fluid calc budget --widths 429,77,157,…` reports OVER and prints these fractions for you.

## 3. A constant compared against a scaled box will drift

This is the general case of §2. Anywhere CSS **compares** a length to a box's size, putting the box
on the scale while leaving the length fixed changes the outcome as the viewport grows. Nothing is
invalid; the layout just reorganises itself.

```tsx
grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))]                    // drifts
grid-cols-[repeat(auto-fill,minmax(min(calc(330*var(--fluid)),100%),1fr))]   // holds
```

With 320 frozen inside a growing container, the four-column grid became five and then six by the
time the factor reached 1.07. The column count had become a property of the monitor. Scale the
minimum and both sides of the comparison move together. 330 rather than the drawn 320 is the
smallest minimum a fifth column can never beat (`5·330 + 4·8 = 1682 > 1680`). Below the breakpoint
it reads as a plain 330px.

What this does **not** buy is four columns at every desktop width. Four 374px cards need 1520 of
content; 1440 has 1280. Below about 1500 the grid is 3-up, and that is arithmetic, not a setting.

### A scaled minimum alone still re-flows on a short, wide window

The grow-only max-width above is the trap here: `minmax(min(calc(330*var(--fluid)),100%),1fr)`
inside a `fluid-container` (or a hand-rolled `fluid-cap-*` box) holds four columns everywhere the
container's max-width is the thing binding — but the moment *height* binds (a short, wide window),
the container's own `max-width` stops shrinking (it is grow-only) while the grid's minimum, sitting
directly on `--fluid`, keeps shrinking with `f`. The container's content box is no longer on the
same scale as the minimum being compared against it, so the comparison drifts exactly the way this
section opened by warning against — measured: a grid that held 4 columns from 1024×640 to
3840×2160 read **6 columns at 1680×700** (f = 0.78, container content box 1520px fixed, minimum
`330·0.78 ≈ 257px` shrunk under it). Two fixes:

**(a) Cap the column count directly — the general answer.**

```
grid-template-columns: repeat(auto-fill, minmax(max(min(calc(330*var(--fluid)),100%),calc((100% - 3*24px)/4)),1fr))
```

The minimum is now the LARGER of two floors: the scaled 330 (holds the column count everywhere the
container itself is on the scale) and `(100% - 3·gap)/4` — a quarter of whatever the container's
content box actually is right now, minus the three gaps between four columns. That second term is
not on `--fluid` at all; it is a plain percentage of the box `auto-fill` is actually laying out
into, so it tracks the container's real content width even on the short-wide windows where that
width stopped moving with `f`. Together the two floors make `minmax(...)` bound the grid to **at
most four columns** under every combination of window width and height, not just the ones where the
container's max-width and the minimum happen to be on the same scale. Adjust `4` and `3*24px`
(columns and gap count) to match the drawn grid.

**(b) Put the grid's own width on the scale instead of relying on the container.** `fluid-w-<drawn>
max-w-full` sizes the grid itself directly off `--fluid` (capped at the container's own width via
`max-w-full`, so it never overflows), rather than inheriting a content box whose width tracks the
scale only when the max-width is what's binding. This holds the column count too, but it is a
narrower fix — it only helps a grid whose own box can legitimately be smaller than its container's
full content width; a grid meant to fill the container edge-to-edge wants (a) instead.

**Recommendation: reach for (a) first.** It is correct for a grid that fills its container (the common
case), needs no change to the grid's own sizing, and holds under every viewport combination — width
binding, height binding, or the max-width's own grow-only floor — rather than only the ones where the
container's content box and the scaled minimum happen to move together. `scripts/tools/verify.mjs`'s
grid-cols report is what catches a regression here: mark the grid `data-verify-grid` and it fails
the run whenever the computed column count differs across desktop viewports, unless the grid opts
out (by design) with `data-verify-grid="responsive"`.

| Construct | The constant that drifts |
|---|---|
| `repeat(auto-fill/auto-fit, minmax(N, 1fr))` | N (the column count changes) |
| `flex-wrap` + `basis-[Npx]` | N (the wrap point moves) |
| `min-w-*` on a flex or grid child | the point where it stops shrinking |
| container queries | the threshold, if the container scales |
| `calc(100% - Npx)` | N shrinks as a share of the box |

Ratios are immune: `fr`, percentages and unitless `line-height` are already relative. A
`minmax(0,904fr)_minmax(0,512fr)` split needs nothing.

## 4. `fluid-gap-x`: horizontal space inside a scaling box scales

`gap-x` was once deliberately left out ("horizontal space is a padding concern"). That was wrong
inside a box that scales. Five partner marks on `fluid-h-*` inside a `fluid-w-560` column, 40px
apart, drifted from the drawn wrap points as the column grew. Use `fluid-gap-x-*` for space between
items inside a scaling box. Space *between page columns* can stay on the breakpoint.

## 5. Two classes for one property

`tailwind-merge` only resolves conflicts inside `cn()`, and only after the fluid families are
registered (`assets/styles/tailwind-v4/cn.ts`). A plain `className="lg:fluid-min-h-987 lg:min-h-0"`
never passes through `cn`, so **stylesheet order** picks the winner, not class order. Do not write both.
`audit.mjs` flags `double-fluid-same-prop`.

## Traps
- [ ] Max-width and padding are on one box; padding is never on an ancestor.
- [ ] Padding is `fluid-px-*` (or the container's own settings) from the breakpoint up, never a frozen `px-20`.
- [ ] Text measures sit inside the container and never replace it; a drawn 240 padding is a 1200 measure.
- [ ] The widest row fits `min(base-width, container-width) − 2 × padding` (`fluid calc budget`), or it is expressed in `cqw`.
- [ ] Every `auto-fill` minimum, wrap basis and `min-w` inside a scaling box is scaled too.
- [ ] Spot-check at 2560 wide: drift and re-flow are invisible at and below the reference.
