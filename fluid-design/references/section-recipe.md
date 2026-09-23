# Section recipe: putting one section on the system

Read when: building any section, greenfield or converted.
Skip when: you are working only on motion or media inside an existing section. See those references instead.

## The checklist

1. **Check the content budget first.** Add up the drawn widths of the widest row. They must fit
   `reference.width − 2 × gutter` (1280 at the defaults) at full size: `node scripts/calc.mjs budget
   --widths 429,77,157,…`. If the row is over, no choice of unit will save it. Take the difference out
   of the whitespace (with design sign-off), or state that row in `cqw` (`frame-and-gutter.md` §2).
2. **Classify the height.** Is the section a fixed composition drawn at the reference height?
   - Drawn at the reference height (900): `lg:fluid-h-900`. It is exactly one screen whenever height binds, and never taller than the window.
   - Drawn taller: `lg:fluid-min-h-<drawn>`. It is a floor, so content grows the section instead of spilling
     out of a locked box. It is more than one screen, honestly.
   - Content-driven (lists, prose): no fixed height. Block padding only (`lg:fluid-py-80`).
3. **Cancel any mobile floor that would out-argue the scaled height.** If the section carries an
   unscoped `min-h-*` (for example `min-h-[max(640px,100svh)]`), add `lg:min-h-0`. Add it *only* then;
   otherwise you have two min-heights at one breakpoint and stylesheet order picks the winner.
4. **Frame:** `lg:fluid-cap-<canvas> lg:fluid-px-<gutter> mx-auto w-full max-w-[<canvas>px] px-6 sm:px-8`
   on ONE box (`frame-and-gutter.md`).
5. **Swap every `lg:` number for its fluid twin, keeping the drawn number.** `lg:py-[120px]` becomes
   `lg:fluid-py-120`; `lg:gap-12` (48) becomes `lg:fluid-gap-48`; `lg:w-[512px]` becomes `lg:fluid-w-512`;
   an absolutely positioned decoration at `top: 40px` becomes `lg:fluid-top-40`. Negatives go inside
   the value: `lg:top-[calc(-8*var(--fluid))]`.
6. **Do not stop at the vertical values.** Scaling the whitespace while leaving the contents fixed is
   worse than scaling nothing: it changes the drawing's proportions rather than its size. A hero once
   shipped with its gaps on the scale, its title capped at 120px and its card frozen at 560. On a 5K it
   was the same hero with more air in it. Element sizes, icons (`fluid-size-*`), control geometry and
   positioned decorations all have to move too.
7. **Text measures stay measures:** `max-w-[753px]` (or a `fluid-cap-753` twin) inside the frame.
8. **Route each run of type through the container question** (`typography.md`).
9. **A shared atom you've already extracted takes a `fluid` prop** rather than a hand-rolled `calc()`
   at each call site — see `typography.md`'s "height contract" note. Nothing in this skill ships a
   `Btn`/`Eyebrow`/etc. component; the anatomy example below inlines the classes a small label like
   that would carry, on purpose (an atom is extracted at its **second** consumer, never invented
   ahead of one — `SKILL.md`'s motion section states the same rule for motion components).
10. **Scale the comparison constants:** any `auto-fill` minimum, `flex-wrap` basis or `min-w` inside
    the scaling box (`frame-and-gutter.md` §3).
11. **Grep the finished file** for a fixed px value that has no fluid twin at the breakpoint. Anything drawn
    in the frame that still reads as a constant is either a deliberate exclusion or a miss. What stays fixed on
    purpose: border and stroke widths (a scaled 1px hairline is a blurry 1.5px one), radii, `em`
    tracking, and text measures. `scripts/audit.mjs` does this grep for you.
12. **Verify the matrix, not one window:** 1024/1280/1440/1680/2560 wide × 640/700/800/900/1440 tall.
    Nothing overflows, no heading changes line count, and 1440×900 is pixel-identical to the frame.

## Anatomy, as shipped

```tsx
<section data-header-theme="dark" className="w-full bg-surface-dark">
  <div className="lg:fluid-cap-1680 lg:fluid-px-80 lg:fluid-h-900 lg:min-h-0 relative mx-auto
                  flex min-h-[max(640px,100svh)] w-full max-w-[1680px] flex-col justify-between
                  px-6 pt-20 pb-10 sm:px-8 lg:fluid-py-120">
    <Stage trigger="view" className="lg:fluid-cap-800 lg:fluid-gap-16 flex max-w-[800px] flex-col gap-4">
      <StageItem variant="liftFade" className="[--hero-lift:20px] lg:[--hero-lift:24px]">
        {/* An "eyebrow" label inlined, not a shipped <Eyebrow> atom — see the
            checklist's item 9. */}
        <span className="lg:fluid-copy-14 text-xs font-semibold tracking-[0.08em] uppercase">
          Label
        </span>
      </StageItem>
      <h2 className="font-heading lg:fluid-display-64/72 text-[40px] leading-[1.2] uppercase sm:text-[52px]">
        <StageItem as="span" variant="liftFade" delay={0.067} className="block">First line</StageItem>
        <StageItem as="span" variant="liftFade" delay={0.134} className="block">second line.</StageItem>
      </h2>
    </Stage>
    <Stage trigger="view">{/* its own stage: it arrives a screen later */}
      <StageItem variant="lift"><Logo className="lg:fluid-h-46 h-8 w-auto" /></StageItem>
    </Stage>
  </div>
</section>
```

What to notice:
- The section is a **server component**. Only `Stage`/`StageItem` are client leaves.
- `data-header-theme` tells a transparent fixed header what ink to use over this section.
- There are two stages, because the copy at the top and the mark on the baseline are two arrivals.
- Mobile values are authored plainly (`text-[40px] sm:text-[52px]`). The fluid classes exist only from `lg`.
- Entrance distances are fixed px in CSS variables, not fluid (engines resolve `var()` once).

The same section in SCSS:

```scss
.hero { min-height: max(640px, 100svh); padding: 80px 24px 40px;
  @include fluid-up { height: fluid(900); min-height: 0; padding-block: fluid(120); }
  &__inner { @include fluid-frame; }
  &__title { font-size: 40px; line-height: 1.2;
    @include fluid-up { @include fluid-type(64, 72, display); } }
}
```

## Heroes under a fixed, floating header

A fixed header contributes nothing to layout, so anything positioned against the viewport top slides
under it unless it subtracts the header's height. `--header-h` combines three terms: the resting inset
(`24 × --fluid`), the safe area, and the row (34px below the breakpoint, `48 × --fluid-chrome` above it). It uses the
**resting** inset, not the scrolled one, so it also holds through the header's transition.

- Plate heroes: `pt-[calc(var(--header-h)+40px)] lg:pt-[calc(var(--header-h)+80*var(--fluid))]`.
- Anchor targets and sticky rails: `scroll-margin-top: calc(var(--header-h) + 24px)`, `top: var(--header-h)`.
- Full-viewport heroes: `min-h-[100svh]` on mobile, `lg:h-[100svh] lg:min-h-0` or `lg:fluid-h-900`.
  iOS 26 measures even `100lvh` short of the physical screen; see `ios-safari.md` §Hero overshoot.

## Mobile floors: use `svh`, and put the baseline on screen

Below the breakpoint the height is the **screen**, not the mobile frame's drawn 900. A mark on the section's baseline
in a layer taller than the viewport sits below the fold at rest. On one project, 900px against an
874px phone hid it by 26px. Use `min-h-[max(640px,100svh)]`: `svh` keeps the baseline visible in
both toolbar states, and 640 is the landscape floor.

## When a section rides over a pinned render

Copy sections inside a scroll scene paint **no background** and use **no `overflow-hidden`**. An
opaque background would cover the render, and clipping risks the pin. See `scroll-scenes.md`.

## Traps
- [ ] `fluid-h-*` only for sections drawn at the reference height; `fluid-min-h-*` for taller ones.
- [ ] `lg:min-h-0` only where an unscoped mobile `min-h` exists.
- [ ] Contents scale along with the whitespace: sizes, icons, controls, decorations.
- [ ] No second sizing ladder inside a section (`xl:` rules on a private var).
- [ ] Mobile floors in `svh`; fixed header subtracted via `--header-h`.
- [ ] No `lg:contents` wrapper on anything that carries a reveal trigger (`motion-architecture.md`).
