# Tokens and theming

Read when: setting up colour, surface and type tokens; adding a dark section; theming a header over
mixed sections; porting components from another codebase.
Skip when: working on pure layout.

## Semantic names over the ramp

Define the brand as ramps (`--color-brand-gold-50…900`, `--color-brand-dark-50…950`) and **alias them**
into roles that components use:

```css
@theme {
  --color-surface-light: var(--color-brand-neutral-page);
  --color-surface-dark:  var(--color-brand-dark-850);
  --color-text-heading:  var(--color-brand-neutral-black);
  --color-text-body:     var(--color-brand-dark-500);
  --color-border-primary: var(--color-brand-dark-300);
  --color-icons-brand:   var(--color-brand-gold-500);
}
```

Components write `bg-surface-dark text-text-heading`, never `bg-[#171819]` and never the ramp step.
The reason is practical: the reference build drifted into 65 uses of `bg-brand-gold-500` and dozens of
raw hexes (`#e7e7e7`, `#f1f1f1`, `#080808`, `#090909`, `#0f0f0f`, `#101010`), which is five near-blacks
nobody chose. A later theme or brand refresh then means editing every section. Add a role the moment
a second section needs the same colour for the same reason.

**Gold, or any mid-luminance brand hue, is a ground, not a text colour on light surfaces.** `#fccc36`
measures 1.52:1 on white. Give roles explicit names: `-ink` is text *in* the hue (a darker ramp step
that clears 4.5:1), `on-` is text *on* the hue. The focus ring is not brand gold on light grounds
either (1.29:1); a dark ring at 16:1 is the one that shows where you are.

## Four traps that compile and render plausibly wrong

1. **`rounded-*` still rounds.** A `--radius-custom: 0` token *adds* a utility; it does not reset
   Tailwind's radius scale. A ported `rounded-xl` still rounds on a square-cornered design.
2. **`dark:` fires on the OS setting.** Without `@custom-variant dark (…)`, Tailwind v4's `dark:` is a
   `prefers-color-scheme` media query, so it fires for half your visitors on a site that has no dark
   mode. If there is no dark theme, ban `dark:` (the audit flags it).
3. **A utility whose token does not exist emits nothing.** Tailwind never warns. A typo in a token name
   ships no colour at all.
4. **A name shared with another codebase means something else there.** A site and a product app that
   both define `border-secondary` resolve it to different colours. Ported markup compiles and draws a
   near-invisible hairline. Namespace a second component set's tokens (`app-*`) so a foreign name
   either exists or fails, and never silently means something else.

`scripts/audit.mjs` catches 1 and 2; a lint list of banned token families catches 4.

## A dark theme later without touching components

Keep every component on role names. A dark theme is then one extra block redefining the same names
under `[data-theme='dark']`, plus one `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))`,
and not an edit to thirty components.

## Header ink that follows the section underneath

A transparent fixed header has no surface of its own, so its ink cannot belong to the page. A black
nav pinned over a black section disappears.

- Sections declare themselves with `data-header-theme="light|dark"`. Only sections that depart from the
  page's base theme need marking; leave light fields unmarked on a light-base page.
- If the darkness changes by breakpoint, use a custom property that a plain utility can vary:
  `data-header-theme="dark" className="[--header-theme:light] lg:[--header-theme:dark]"`. The variable
  wins where it is set (for example, a section that is mid-grey on mobile and black from `lg`: white ink on that
  grey measures 2.2:1 where black measures 5.6:1).
- The probe measures section extents once into document coordinates (again on resize) and compares
  them against the header row's vertical middle on scroll. React state changes only when the resolved theme
  changes: a few times per page, never per frame. It subscribes to scroll rather than using an
  IntersectionObserver because `rootMargin` takes no `calc()`, and a 1px band would have to be rebuilt every time
  the mobile toolbar resizes the viewport.
- Probe with layout metrics (`offsetTop`/`offsetHeight`), not `getBoundingClientRect`. The header is
  mid-entrance-transform at first paint, and a rect probe reads about 100px too high.
- Every themed part of the header uses one colour transition (`transition-colors duration-200 ease-out`).
  200ms is the compromise between a theme dissolve (which wants 300+) and link hover (which must feel instant).
  If different parts use different durations, the bar comes apart mid-flip.
- An unmarked dark band is a bug: the nav keeps light-page ink over it. Check each dark section.

Implementations: `assets/motion/react-motion/hooks/useHeaderTheme.ts`, `assets/motion/gsap/src/headerTheme.ts`.

## Small hit targets in a drawn row

Nav items drawn at 13px line boxes fail WCAG 2.5.8's 24px minimum. Grow the target with a transparent
`::after` pseudo-element (`absolute inset-x-0 -inset-y-[15px]`) rather than padding. Padding would
move items whose gaps are drawn geometry. The pseudo-element takes no space and hit-tests as its
element, so `:hover` and `onMouseEnter` fire on it.

## Selection and focus

`::selection` uses the exact brand hue that the chips and CTA use; a near-miss hue reads as a mistake.
`:focus-visible` gets a 2px outline with a 2px offset in a colour that measures against the ground it sits on.
`:focus:not(:focus-visible) { outline: none }`.

## Traps
- [ ] Components use role tokens only; there are no raw hexes in sections.
- [ ] Brand hue as text uses an `-ink` step that clears AA.
- [ ] No `dark:` without a custom variant; no `rounded-*` on a square design.
- [ ] Every dark band either carries `data-header-theme` or sits on a dark-base page.
- [ ] Foreign component sets are namespaced.
