# Frame and gutter: one box, a scaled gutter, and constants that drift

Read when: writing any section's outer structure, a row will not fit, a grid changes its column count
on big screens, or a section sits a few pixels off its neighbours' rail.
Skip when: you are only adjusting type inside an existing frame.

## Contents
1. There is one page frame, and it is one box (cap and gutter on one box; frame is not measure; the drawn gutter)
2. When a row will not fit the frame: use `cqw`, not a smaller gutter
3. A constant compared against a scaled box will drift
4. `fluid-gap-x`: horizontal space inside a scaling frame scales
5. Two classes for one property
6. Traps

## 1. There is one page frame, and it is one box

```tsx
<section className="w-full bg-surface-light">                         {/* colour and vertical rhythm only */}
  <div className="lg:fluid-cap-1680 lg:fluid-px-80 mx-auto w-full max-w-[1680px] px-6 sm:px-8">
```

Vanilla and SCSS use the `.fluid-frame` class or the `fluid-frame` mixin, which is the same box.

- The section carries full-bleed colour. The inner box carries the frame.
- `fluid-cap-*` is a max-width that **only grows**: `max(1680px, 1680 × --fluid)`. Below the
  reference the drawn width already fits, and shrinking it would narrow the composition on exactly the
  screens that need room. Above the reference it has to grow, or the section gets taller without
  getting wider.
- **The gutter scales** (`lg:fluid-px-80`). This reverses an earlier rule ("a gutter is chrome; it follows
  the breakpoint"). That objection described a case that cannot happen:
  - Width arm binds: the gutter is `80·W/1440`, a fixed **5.6% of the viewport**, which is exactly what you want.
  - Height arm binds (a short, wide window): `fluid-cap-*` is **grow-only**
    (`max(1680px, 1680·f)`), and `f < 1` here, so the `max()`
    resolves to the constant `1680px`, not to `1680·f`. **The frame stays
    canvas-wide in px; it does not get narrower.** `mx-auto` centres that
    canvas-wide box inside a window wider than the canvas (measured: a
    1600-wide canvas produced a 1600px-wide frame in a 1680-wide, 700-tall
    window, f = 0.78) — a window narrower than the canvas instead makes the
    frame fill the window edge-to-edge, same as always. What DOES shrink is
    everything *inside* that box: the gutter (`fluid-px-80` is `80·f`) and
    every other `--fluid`-scaled value, because those read the unit
    directly rather than sitting behind a grow-only `max()`. So the
    composition tightens — gutters, type, gaps all shrink together — while
    the frame's own outer edge holds at the canvas width. The gutter is
    still interior padding either way, and it never touches the bezel.

  A frozen gutter falls from 5.6% of the viewport at 1440 to 3.1% at 2560, walking the composition
  toward the edges. The arithmetic also collapses once it scales: content = `1680f − 160f = 1520f`, the
  drawn content scaled, with nothing to drift.

### Cap and gutter go on the same box

```
gutter INSIDE (correct)          gutter OUTSIDE (drifts)
┌──── cap 1680·f ─────┐          ├─80─┬── cap 1520·f ──┬─80─┤
│ 80f │ content │ 80f │               └─── content ────┘
```

The outside form is only accidentally correct: it breaks again the moment someone freezes the gutter.
That is how a product library came to sit about 22px to the right of its own hero at a factor of 1.28. A
section may push the gutter to a *descendant* (a scene with a full-bleed render where only the copy
is inset). It may never put the gutter on an **ancestor**.

### Frame is not measure

A narrow reading column is not a second frame. `fluid-cap-753`, `fluid-cap-800` and `fluid-cap-1200` are
**measures**, and they are correct, but only *inside* the frame. The bug is a measure doing the frame's
job, such as a page-level `max-w-[1360px]`.

A drawn 240px gutter on a 1680 canvas is a **1200 measure**, not a gutter. `fluid-px-240` was tried;
below 1680 it is bound to the viewport and eats the measure: 1440 leaves 960, and 1280 leaves about 853.
Write it as `lg:fluid-cap-1200 mx-auto` inside the normal rail.

### The drawn gutter is not always 80

A near-full-bleed band drawn with a 24px inset becomes `lg:fluid-px-24`. That is a drawn value like any
other. What no section may do is hold its inset *frozen* while the cap beside it grows.

## 2. When a row will not fit the frame: use `cqw`, not a smaller gutter

The content box is 1280 at the reference and 1520 at the canvas. A row drawn at, say, 1441px
cannot be stated in absolute units. There are two obvious escapes, and both are wrong:

- **Trim the numbers.** Shipped once as bar 100 with gaps 28/20/24. The value label measured about 116,
  so it overran the 100px bar, ate the candle gap, and printed `607/TPS177/TPS`.
- **Shrink the gutter.** 24px up to 1600 bought the room and took the section off the site rail. It was
  visibly 56px wider than its neighbours.

The fix is to stop stating the width axis as a length. Make the frame's content box an `@container`
and express each horizontal value as its drawn fraction of the content width:

```tsx
'@container lg:[--copy-w:28.224cqw]'  // 429 / 1520
'lg:[--bar-w:7.566cqw]'               // 115 / 1520
'lg:[--gap-block:6.842cqw]'           // 104 / 1520
```

This is exact at the canvas, proportional everywhere else, and **cannot overflow**. Type with no
slack of its own goes along with it: a numeral that must fit a bar is `--num: 2.632cqw`.

It costs nothing where the frame *does* fit: whenever the cap binds, the content box is `1520·f`, so `2.632cqw`
equals `40 × --fluid` there. `cqw` only diverges where the viewport binds, which is exactly where
`--fluid` was promising width the box did not have. **Heights stay on `--fluid`.** Only the over-budget axis changes.

The same move works for display type that must hold drawn line breaks in an over-budget column: `64/1200 → 5.3333cqw`
on the content box. That is exact at the canvas, and 51.2px with both lines intact at 1440.

`scripts/calc.mjs budget --widths …` reports OVER and prints these fractions for you.

## 3. A constant compared against a scaled box will drift

This is the general case of §2. Anywhere CSS **compares** a length to a box's size, putting the box
on the scale while leaving the length fixed changes the outcome as the viewport grows. Nothing is
invalid; the layout just reorganises itself.

```tsx
grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))]                    // drifts
grid-cols-[repeat(auto-fill,minmax(min(calc(330*var(--fluid)),100%),1fr))]   // holds
```

With 320 frozen inside a growing frame, the four-column grid became five and then six by the time the factor reached 1.07.
The column count had become a property of the monitor. Scale the minimum and both sides of the comparison move
together. 330 rather than the drawn 320 is the smallest minimum a fifth column can never beat
(`5·330 + 4·8 = 1682 > 1680`). Below the breakpoint it reads as a plain 330px.

What this does **not** buy is four columns at every desktop width. Four 374px cards need 1520 of
content; 1440 has 1280. Below about 1500 the grid is 3-up, and that is arithmetic, not a setting.

### A scaled minimum alone still re-flows on a short, wide window

The grow-only cap above is the trap here: `minmax(min(calc(330*var(--fluid)),100%),1fr)` inside a
`fluid-cap-*` frame holds four columns everywhere the CAP is the thing binding — but the moment
*height* binds (a short, wide window), the frame's own `max-width` stops shrinking (it is
grow-only) while the grid's minimum, sitting directly on `--fluid`, keeps shrinking with `f`. The
frame's content box is no longer on the same scale as the minimum being compared against it, so the
comparison drifts exactly the way this section opened by warning against — measured: a grid that
held 4 columns from 1024×640 to 3840×2160 read **6 columns at 1680×700** (f = 0.78, frame content
box 1520px fixed, minimum `330·0.78 ≈ 257px` shrunk under it). Two fixes:

**(a) Cap the column count directly — the general answer.**

```
grid-template-columns: repeat(auto-fill, minmax(max(min(calc(330*var(--fluid)),100%),calc((100% - 3*24px)/4)),1fr))
```

The minimum is now the LARGER of two floors: the scaled 330 (holds the column count everywhere the
frame itself is on the scale) and `(100% - 3·gap)/4` — a quarter of whatever the container's content
box actually is right now, minus the three gaps between four columns. That second term is not on
`--fluid` at all; it is a plain percentage of the box `auto-fill` is actually laying out into, so it
tracks the frame's real content width even on the short-wide windows where that width stopped
moving with `f`. Together the two floors make `minmax(...)` bound the grid to **at most four
columns** under every combination of window width and height, not just the ones where the cap and
the minimum happen to be on the same scale. Adjust `4` and `3*24px` (columns and gap count) to match
the drawn grid.

**(b) Put the grid's own width on the scale instead of relying on the frame.** `fluid-w-<drawn>
max-w-full` sizes the grid itself directly off `--fluid` (capped at the container's own width via
`max-w-full`, so it never overflows), rather than inheriting a content box whose width tracks the
scale only when the cap is what's binding. This holds the column count too, but it is a narrower fix
— it only helps a grid whose own box can legitimately be smaller than its frame's full content
width; a grid meant to fill the frame edge-to-edge wants (a) instead.

**Recommendation: reach for (a) first.** It is correct for a grid that fills its frame (the common
case), needs no change to the grid's own sizing, and holds under every viewport combination — width
binding, height binding, or the cap's own grow-only floor — rather than only the ones where the
frame's content box and the scaled minimum happen to move together. `scripts/verify-matrix.mjs`'s
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

## 4. `fluid-gap-x`: horizontal space inside a scaling frame scales

`gap-x` was once deliberately left out ("horizontal space is a gutter concern"). That was wrong inside a frame that
scales. Five partner marks on `fluid-h-*` inside a `fluid-w-560` column, 40px apart, drifted from the
drawn wrap points as the column grew. Use `fluid-gap-x-*` for space between items inside a scaling
box. Space *between page columns* can stay on the breakpoint.

## 5. Two classes for one property

`tailwind-merge` only resolves conflicts inside `cn()`, and only after the fluid families are
registered (`assets/styles/tailwind-v4/cn.ts`). A plain `className="lg:fluid-min-h-987 lg:min-h-0"`
never passes through `cn`, so **stylesheet order** picks the winner, not class order. Do not write both.
`audit.mjs` flags `double-fluid-same-prop`.

## Traps
- [ ] Cap and gutter are on one box; the gutter is never on an ancestor.
- [ ] The gutter is `fluid-px-*` from the breakpoint up, never a frozen `px-20`.
- [ ] Text measures sit inside the frame and never replace it; a drawn 240 gutter is a 1200 measure.
- [ ] The widest row fits `reference − 2·gutter`, or it is expressed in `cqw`.
- [ ] Every `auto-fill` minimum, wrap basis and `min-w` inside a scaling box is scaled too.
- [ ] Spot-check at 2560 wide: drift and re-flow are invisible at and below the reference.
