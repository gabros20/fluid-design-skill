# Section recipe: putting one section on the system

Purpose: The per-section checklist for building or converting one section on the scale, with the
shipped anatomy, controls sized on their label, edge-to-edge tracks, heroes under a fixed header,
mobile min-heights, sections over a pinned render, and parts that stop scaling.

Read when: building any section, new or converted.
Skip when: you are working only on media inside an existing section (`media.md`), or only on its
animation (outside this skill).
Inputs: the section's desktop and phone drawings (their numbers) and the container settings.
Produces: one section on one container, every drawn number through a fluid utility, and a fit that
holds at the design frame.

## Contents

- The checklist
- Anatomy, as shipped
- Heroes under a fixed, floating header
- Mobile min-heights: use `svh`, and put the baseline on screen
- When a section rides over a pinned render
- Traps
- A part that should stop scaling

## The checklist

1. **Check the content budget first.** The widest drawn row must fit
   `min(base-width, container-width) − 2 × padding` (1280 at the defaults): `fluid calc budget
   --widths 429,77,157,…`. Over budget, no unit saves it: take the difference out of the whitespace
   (with design sign-off), or write the row as fractions of the content box (`frame-and-gutter.md` §2).
2. **Classify the height.**
   - Drawn at the design frame's height (900): `lg:fluid-h-900`. Exactly one screen whenever height
     binds, never taller than the window.
   - Drawn taller: `lg:fluid-min-h-<drawn>`, a floor, so content grows the section instead of
     spilling out of a locked box. It is honestly more than one screen.
   - Content-driven (lists, prose): no fixed height, block padding only (`lg:fluid-py-80`).
3. **Cancel a mobile min-height that would out-argue the scaled height.** If the section carries an
   unprefixed `min-h-*` (`min-h-[max(640px,100svh)]`), add `lg:min-h-0`, and only then; otherwise two
   min-heights meet at one breakpoint and stylesheet order picks the winner.
4. **Container:** `fluid-container` on the section's inner wrapper, no `lg:` (its width and padding
   follow the band: full width with a 32 gutter on tablet and landscape by default;
   `frame-and-gutter.md` §1). Hand-roll `fluid-cap-<N> fluid-px-<N> mx-auto` only for a section that
   deliberately leaves the standard container (a near-full-bleed band, a narrower one-off).
5. **Swap every number for its fluid twin, keeping the drawn number.** `lg:py-[120px]` →
   `lg:fluid-py-120`; `lg:gap-12` (48) → `lg:fluid-gap-48`; `lg:w-[512px]` → `lg:fluid-w-512`;
   `top: 40px` → `lg:fluid-top-40`; negatives take a leading minus (`lg:-fluid-top-8`). The phone
   frame's numbers go unprefixed beside them (`fluid-py-48 lg:fluid-py-120`).
   **`lg:` is a choice, not a rule:** it scopes a class to desktop. Keep it where mobile and desktop
   are different drawings (most of the time); drop it where they share one composition. For a
   band-only tweak, `fluid-tablet:`/`fluid-landscape:`, never next to `sm:`/`md:`/`max-*:` on the same
   property: band variants always win (`contract.md` §3, audit rule `band-variant-with-breakpoint`).
6. **Scale the contents, not just the whitespace.** Scaling the gaps while leaving the contents fixed
   is worse than scaling nothing: it changes the drawing's proportions. A hero once shipped with its
   gaps on the scale, its title capped at 120px and its card frozen at 560; on a 5K it was the same
   hero with more air. Element sizes, icons (`fluid-size-*`), controls and positioned decorations move too.
7. **Size a control on its label's unit.** A button, chip or icon box around text uses the role box
   utilities of that text's role (`fluid-<role>-h-*`, `-w-*`, `-size-*`, `-p-*`, `-px-*`, `-py-*`,
   `-gap-*`), so box and label keep their proportion:
   `fluid-copy-14/20 fluid-copy-h-56 fluid-copy-px-24 fluid-copy-gap-8`. On `--fluid` the label
   crowds its own padding on a short window, where the two units differ by up to 27%. Do not
   hand-write `h-[calc(56*var(--fluid-copy))]`; `cn` merges the role box utilities with their
   Tailwind groups. SCSS: `fd.fluid-copy(56)` on any property; StyleX: `fluidCopy(56)`.
8. **Edge-to-edge tracks** (a carousel, a logo strip) stay inside the container with `fluid-bleed-x`:
   they reach the window edges while the first item stays on the container's line
   (`frame-and-gutter.md` §1).
9. **Text measures stay measures:** `max-w-[753px]` (or `fluid-cap-753`) inside the container.
10. **Pick each run of type's unit** by what its box does (`typography.md`).
11. **A shared atom you have already extracted takes a `fluid` prop** rather than a hand-rolled
    `calc()` at each call site (`typography.md`, shared atoms). The skill ships no `Btn` or `Eyebrow`:
    extract an atom at its **second** consumer, never ahead of one.
12. **Scale the comparison constants:** any `auto-fill` minimum, `flex-wrap` basis or `min-w` inside
    the scaling box (`frame-and-gutter.md` §3).
13. **Grep the finished file** for a px value with no fluid twin; `fluid audit` does this. What stays
    fixed on purpose: border and stroke widths (a scaled 1px hairline is a blurry 1.5px one), `em`
    tracking, text measures. A px radius on a scaling box scales too (`fluid-rounded-*`), or the
    corner reads sharp on a big screen and blunt on a small one.
14. **Verify the matrix, not one window:** 1024/1280/1440/1680/2560 wide × 640/700/800/900/1440 tall.
    Nothing overflows, no heading changes line count, and the design frame's size matches the design.

## Anatomy, as shipped

```tsx
<section className="w-full bg-surface-dark">
  <div className="fluid-container lg:fluid-h-900 lg:min-h-0 relative flex
                  min-h-[max(640px,100svh)] flex-col justify-between
                  pt-20 pb-10 lg:fluid-py-120">
    <div className="lg:fluid-cap-800 lg:fluid-gap-16 flex max-w-[800px] flex-col gap-4">
      <span className="lg:fluid-copy-14 text-xs font-semibold tracking-[0.08em] uppercase">
        Label
      </span>
      <h2 className="font-heading lg:fluid-display-64/72 text-[40px] leading-[1.2] uppercase sm:text-[52px]">
        <span className="block">First line</span>
        <span className="block">second line.</span>
      </h2>
      <a href="#" className="lg:fluid-copy-16/24 lg:fluid-copy-h-56 lg:fluid-copy-px-24
                             inline-flex h-12 items-center px-5 text-sm">Get in touch</a>
    </div>
    <Logo className="lg:fluid-h-46 h-8 w-auto" />
  </div>
</section>
```

What to notice:
- Plain markup: it can stay a **server component**.
- `fluid-container` replaces the old `max-w-[1680px] mx-auto px-6 sm:px-8 lg:fluid-cap-1680
  lg:fluid-px-80`; its own padding covers the mobile `px-6 sm:px-8`.
- The label is inlined, not a shipped atom (checklist item 11); the link's box is on its label's unit (item 7).
- The copy group and the mark on the baseline are separate children of a `justify-between` column:
  two drawn positions, not one block.
- The heading's drawn lines are block spans, so a later entrance can split at the authored break
  (`typography.md` §Hard breaks).
- Mobile values are plain here (`text-[40px] sm:text-[52px]`), as on a site with `bands.phone: false`;
  with the mobile bands on, write the phone frame's numbers as unprefixed `fluid-*` instead.
- Entrances wrap these elements without changing a class. Entrance distances stay fixed px (engines
  resolve `var()` once).

The same section in SCSS:

```scss
@use 'fluid' as fd;

.hero { min-height: max(640px, 100svh); padding: 80px 24px 40px;
  @include fd.fluid-desktop { height: fd.fluid(900); min-height: 0; padding-block: fd.fluid(120); }
  &__inner { @include fd.fluid-container; }
  &__title { font-size: 40px; line-height: 1.2;
    @include fd.fluid-desktop { @include fd.fluid-type(64, 72, display); } }
  &__cta { @include fd.fluid-desktop { height: fd.fluid-copy(56); padding-inline: fd.fluid-copy(24); } }
}
```

## Heroes under a fixed, floating header

A fixed header takes no layout space, so anything placed against the window top slides under it
unless it subtracts the header's height. `--fluid-header-h` adds three terms: the resting inset
(`--fluid-header-inset × --fluid`, 24 by default), the safe area, and the row
(`--fluid-<band>-header-height`: 34 CSS px on the mobile bands, unscaled, set once on phone;
`48 × --fluid-ui` on desktop). It uses the **resting** inset, so it holds through the header's
scroll transition. (`--header-h` is its v1 name, only with `aliases: true`.)

- Plate heroes: `pt-[calc(var(--fluid-header-h)+40px)] lg:pt-[calc(var(--fluid-header-h)+80*var(--fluid))]`.
- Anchor targets and sticky rails: `scroll-margin-top: calc(var(--fluid-header-h) + 24px)`, `top: var(--fluid-header-h)`.
- Full-screen heroes: `min-h-[100svh]` on mobile, `lg:h-[100svh] lg:min-h-0` or `lg:fluid-h-900`.
  iOS 26 measures even `100lvh` short of the physical screen (`ios-safari.md` §5).
- Header, nav and footer use the `fluid-ui-*` utilities (`p`, `px`, `py`, `gap`, `w`, `h`, `size`,
  `text`), on `--fluid-ui`: it follows width and never shrinks for a short window.

## Mobile min-heights: use `svh`, and put the baseline on screen

Below the breakpoint the height is the **screen**, not a drawn 900. A mark on the baseline of a layer
taller than the window sits below the fold: 900px against an 874px phone hid it by 26px. Use
`min-h-[max(640px,100svh)]`: `svh` keeps the baseline visible in both toolbar states, and 640 is the
landscape floor.

## When a section rides over a pinned render

Copy sections inside a pinned scene take no background (it would cover the render) and no
`overflow-hidden`.

## Traps
- [ ] `fluid-h-*` only for sections drawn at the design frame's height; `fluid-min-h-*` for taller ones.
- [ ] `lg:min-h-0` only where an unprefixed mobile `min-h` exists.
- [ ] Contents scale with the whitespace: sizes, icons, controls (role box utilities), decorations.
- [ ] No second sizing ladder inside a section (`xl:` rules on a private variable).
- [ ] Mobile min-heights in `svh`; a fixed header subtracted through `--fluid-header-h`.
- [ ] No `lg:contents` wrapper on anything that carries a reveal trigger (a `display: contents` box
      has no geometry to observe).
- [ ] Edge-to-edge tracks use `fluid-bleed-x`, not a second, wider wrapper.
- [ ] A part that must stop scaling has a limit on its wrapper, not fixed px on its children.
- [ ] Components taking `className` merge through a `cn` built with `withFluid`.

## A part that should stop scaling

Put a limit on its wrapper, in window px: `fluid-grow-until-1680`, `fluid-shrink-until-1280`,
`fluid-off`. Everything inside follows; nothing outside changes. The site header is the exception:
`:root { --fluid-ui-grow-until: 1680; }`, so `--fluid-header-h` (anchor offsets, hero padding)
follows it (`limits-and-scopes.md` §2).
