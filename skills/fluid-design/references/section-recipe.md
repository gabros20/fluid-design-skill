# Section recipe: putting one section on the system

Read when: building any section, greenfield or converted.
Skip when: you are working only on media inside an existing section (`media.md`), or only on its
animation (the `scroll-animation` skill).

## The checklist

1. **Check the content budget first.** Add up the drawn widths of the widest row. They must fit
   `min(base-width, container-width) − 2 × padding` (1280 at the defaults) at full size: `fluid calc
   budget --widths 429,77,157,…`. If the row is over, no choice of unit will save it. Take the
   difference out of the whitespace (with design sign-off), or state that row in `cqw`
   (`frame-and-gutter.md` §2).
2. **Classify the height.** Is the section a fixed composition drawn at the reference height?
   - Drawn at the reference height (900): `lg:fluid-h-900`. It is exactly one screen whenever height binds, and never taller than the window.
   - Drawn taller: `lg:fluid-min-h-<drawn>`. It is a floor, so content grows the section instead of spilling
     out of a locked box. It is more than one screen, honestly.
   - Content-driven (lists, prose): no fixed height. Block padding only (`lg:fluid-py-80`).
3. **Cancel any mobile min-height that would out-argue the scaled height.** If the section carries an
   unscoped `min-h-*` (for example `min-h-[max(640px,100svh)]`), add `lg:min-h-0`. Add it *only* then;
   otherwise you have two min-heights at one breakpoint and stylesheet order picks the winner.
4. **Container:** `fluid-container` on the section's inner wrapper (`frame-and-gutter.md`). It needs
   no `lg:` — its max-width and padding are already per-band settings (`--fluid-<band>-container-width`
   / `-container-padding`), so it does the right thing at whichever band is active, mobile bands
   included. Reach for `fluid-cap-<N> fluid-px-<N> mx-auto` by hand only for a section that
   deliberately doesn't use the standard container (a near-full-bleed band, a narrower one-off).
5. **Swap every `lg:` number for its fluid twin, keeping the drawn number.** `lg:py-[120px]` becomes
   `lg:fluid-py-120`; `lg:gap-12` (48) becomes `lg:fluid-gap-48`; `lg:w-[512px]` becomes `lg:fluid-w-512`;
   an absolutely positioned decoration at `top: 40px` becomes `lg:fluid-top-40`. Negatives take the
   leading minus: `lg:-fluid-top-8` (`tailwind.utilities.negative`, on by default).
   **The `lg:` prefix is a choice, not a rule:** it scopes a class to the desktop band. Drop it
   wherever mobile and desktop share one drawn composition and just need different band settings,
   not different classes. For a band-only tweak, `fluid-tablet:`/`fluid-landscape:` work, but never
   next to `sm:`/`md:`/`max-*:` on the same property: band variants always win over those
   (`contract.md` §3, audit rule `band-variant-with-breakpoint`). Keep it wherever mobile and desktop are genuinely separate drawings (a
   different column count, a different stack order) — which is most of the time, since mobile and
   desktop are usually different Figma frames, not one frame scaled down.
6. **Do not stop at the vertical values.** Scaling the whitespace while leaving the contents fixed is
   worse than scaling nothing: it changes the drawing's proportions rather than its size. A hero once
   shipped with its gaps on the scale, its title capped at 120px and its card frozen at 560. On a 5K it
   was the same hero with more air in it. Element sizes, icons (`fluid-size-*`), control geometry and
   positioned decorations all have to move too.
7. **Text measures stay measures:** `max-w-[753px]` (or a `fluid-cap-753` twin) inside the container.
8. **Route each run of type through the container question** (`typography.md`).
9. **A shared atom you've already extracted takes a `fluid` prop** rather than a hand-rolled `calc()`
   at each call site — see `typography.md`'s "height contract" note. Nothing in this skill ships a
   `Btn`/`Eyebrow`/etc. component; the anatomy example below inlines the classes a small label like
   that would carry, on purpose (an atom is extracted at its **second** consumer, never invented
   ahead of one; the `scroll-animation` skill applies the same rule to motion components).
10. **Scale the comparison constants:** any `auto-fill` minimum, `flex-wrap` basis or `min-w` inside
    the scaling box (`frame-and-gutter.md` §3).
11. **Grep the finished file** for a fixed px value that has no fluid twin at the breakpoint. Anything drawn
    in the container that still reads as a constant is either a deliberate exclusion or a miss. What stays fixed on
    purpose: border and stroke widths (a scaled 1px hairline is a blurry 1.5px one), `em`
    tracking, and text measures. A px radius on a scaling box scales too (`fluid-rounded-*`), or the
    corner reads sharp on a big screen and blunt on a small one. `scripts/tools/audit.mjs` does this grep for you.
12. **Verify the matrix, not one window:** 1024/1280/1440/1680/2560 wide × 640/700/800/900/1440 tall.
    Nothing overflows, no heading changes line count, and 1440×900 is pixel-identical to the container.

## Anatomy, as shipped

```tsx
<section className="w-full bg-surface-dark">
  <div className="fluid-container lg:fluid-h-900 lg:min-h-0 relative flex
                  min-h-[max(640px,100svh)] flex-col justify-between
                  pt-20 pb-10 lg:fluid-py-120">
    <div className="lg:fluid-cap-800 lg:fluid-gap-16 flex max-w-[800px] flex-col gap-4">
      {/* An "eyebrow" label inlined, not a shipped <Eyebrow> atom — see the
          checklist's item 9. */}
      <span className="lg:fluid-copy-14 text-xs font-semibold tracking-[0.08em] uppercase">
        Label
      </span>
      <h2 className="font-heading lg:fluid-display-64/72 text-[40px] leading-[1.2] uppercase sm:text-[52px]">
        <span className="block">First line</span>
        <span className="block">second line.</span>
      </h2>
    </div>
    <Logo className="lg:fluid-h-46 h-8 w-auto" />
  </div>
</section>
```

What to notice:
- The section is plain markup and can stay a **server component**.
- `fluid-container` replaced the old three-class combo (`max-w-[1680px] mx-auto px-6 sm:px-8
  lg:fluid-cap-1680 lg:fluid-px-80`) with one class; its own padding stands in for the plain `px-6
  sm:px-8` this anatomy used to carry below `lg`.
- The copy group at the top and the mark on the baseline are separate children of a
  `justify-between` column: two drawn positions, not one block.
- The heading's drawn lines are authored as block spans, so a later entrance can split at the
  authored break (`typography.md` §Hard breaks).
- Mobile values are authored plainly (`text-[40px] sm:text-[52px]`). The fluid classes exist only from `lg`.
- Entrances: see the `scroll-animation` skill. It wraps these same elements (its `Stage`/`StageItem`
  in React) without changing any class here. Its entrance distances are fixed px in CSS variables,
  not fluid (engines resolve `var()` once), and a section whose header ink it drives also carries
  `data-header-theme`.

The same section in SCSS:

```scss
@use 'fluid' as fd;

.hero { min-height: max(640px, 100svh); padding: 80px 24px 40px;
  @include fd.fluid-desktop { height: fd.fluid(900); min-height: 0; padding-block: fd.fluid(120); }
  &__inner { @include fd.fluid-container; }
  &__title { font-size: 40px; line-height: 1.2;
    @include fd.fluid-desktop { @include fd.fluid-type(64, 72, display); } }
}
```

## Heroes under a fixed, floating header

A fixed header contributes nothing to layout, so anything positioned against the viewport top slides
under it unless it subtracts the header's height. `--fluid-header-h` is emitted by the engine from the
header settings, combining three terms: the resting inset (`--fluid-header-inset × --fluid`, 24 by
default), the safe area, and the row (`--fluid-<band>-header-height`: 34 CSS px on mobile bands, not
scaled, set once on phone; `48 × --fluid-ui` on desktop). It uses the **resting** inset, not the
scrolled one, so it also holds through the header's transition. (`--header-h` is its v1 name,
emitted as an alias only with `aliases: true`.)

- Plate heroes: `pt-[calc(var(--fluid-header-h)+40px)] lg:pt-[calc(var(--fluid-header-h)+80*var(--fluid))]`.
- Anchor targets and sticky rails: `scroll-margin-top: calc(var(--fluid-header-h) + 24px)`, `top: var(--fluid-header-h)`.
- Full-viewport heroes: `min-h-[100svh]` on mobile, `lg:h-[100svh] lg:min-h-0` or `lg:fluid-h-900`.
  iOS 26 measures even `100lvh` short of the physical screen; see `ios-safari.md` §5.
- Header, nav and footer own utilities: `fluid-ui-p-*`, `fluid-ui-px-*`, `fluid-ui-py-*`,
  `fluid-ui-gap-*`, `fluid-ui-w-*`, `fluid-ui-h-*`, `fluid-ui-size-*`, `fluid-ui-text-*` — all on
  `--fluid-ui`, the unit that follows width and never shrinks for a short window.

## Mobile min-heights: use `svh`, and put the baseline on screen

Below the breakpoint the height is the **screen**, not the mobile artboard's drawn 900. A mark on the section's baseline
in a layer taller than the viewport sits below the fold at rest. On one project, 900px against an
874px phone hid it by 26px. Use `min-h-[max(640px,100svh)]`: `svh` keeps the baseline visible in
both toolbar states, and 640 is the landscape floor.

## When a section rides over a pinned render

Copy sections inside a pinned scene have extra rules (no background, no `overflow-hidden`): see the
`scroll-animation` skill, `references/scroll-scenes.md`.

## Traps
- [ ] `fluid-h-*` only for sections drawn at the reference height; `fluid-min-h-*` for taller ones.
- [ ] `lg:min-h-0` only where an unscoped mobile `min-h` exists.
- [ ] Contents scale along with the whitespace: sizes, icons, controls, decorations.
- [ ] No second sizing ladder inside a section (`xl:` rules on a private var).
- [ ] Mobile min-heights in `svh`; fixed header subtracted via `--fluid-header-h`.
- [ ] No `lg:contents` wrapper on anything that carries a reveal trigger (the `scroll-animation`
      skill explains why; `audit.mjs` no longer checks it here).
- [ ] A part that must stop scaling has a limit on its wrapper (`fluid-grow-until-*`,
      `fluid-shrink-until-*`, `fluid-off`), not fixed px on its children; the site header uses
      `:root { --fluid-ui-grow-until: … }` instead.
- [ ] Components taking `className` merge through a `cn` built with `withFluid`.

## A part that should stop scaling

Put a limit on its wrapper, in window px: `fluid-grow-until-1680`, `fluid-shrink-until-1280`,
`fluid-off`. Everything inside follows; nothing outside changes. The site header is the exception:
limit it with `:root { --fluid-ui-grow-until: 1680; }` so `--fluid-header-h` (anchor offsets, hero padding)
follows it (`fluid-scale.md` §10).
