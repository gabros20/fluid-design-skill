# Frame and gutter: one box, a scaled gutter, and constants that drift

Read when: writing any section's outer structure, a row will not fit, a grid changes its column count
on big screens, or a section sits a few pixels off its neighbours' rail.
Skip when: you are only adjusting type inside an existing frame.

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
  - Height arm binds (a short window): the frame is `1680·f`, narrower than the window, so it floats centred.
    The gutter is then interior padding, and whether it is 71 or 80 is invisible.

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
