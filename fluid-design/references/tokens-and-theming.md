# Tokens and theming

Read when: setting up colour, surface and type tokens; adding a dark section; porting components
from another codebase.
Skip when: working on pure layout.

## Tokens live in `globals.css`, next to the fluid settings

There is no separate tokens file to copy from — nothing under `output.dir` is meant to hold your
tokens, and `fluid generate` never touches your `:root`. Tokens go straight into your own stylesheet, `@theme` for the ramp and roles, `:root` for
anything that isn't a Tailwind theme value — the same file, right below the one `fluid generate`
told you to add: this is the shadcn pattern, one `globals.css` owning both the design tokens and the
handful of fluid settings you've chosen to override:

```css
@import 'tailwindcss';
@import '../styles/fluid/fluid.css';

@theme {
  /* your tokens */
}
:root {
  /* your tokens */
  --fluid-phone-scale-min: 0.8; /* only the fluid settings you change */
}
```

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

### The breakpoint ladder ships in `fluid.css` — don't redeclare rungs

Tailwind v4 sorts breakpoint variants by comparing their lengths, and cannot compare px against rem,
so a `--breakpoint-*` token defined in px while the rest stay on the stock rem defaults reorders
every variant. That trap is why the generated `fluid.css` (`tailwind.breakpoints: "ladder"`, the
default) emits the **whole** ladder in one unit itself: `sm 640, md 768, lg = bands.desktop.minWidth,
xl 1280, 2xl 1536`, nudged to stay monotonic if `bands.desktop.minWidth` collides with a default
rung. You don't write this — it's already in the file `fluid generate` produced. The one way to break
it is to redeclare `--breakpoint-lg` (or any other rung) yourself in a second `@theme` block: that
reintroduces the exact px-vs-rem mismatch the ladder exists to avoid, measured once as
`sm:text-[64px]` beating `lg:fluid-display-112` even though 1024px is wider than the 40rem `sm`
breakpoint — it compiles, the classes are present, and it renders like a plausible design choice.
Set `tailwind.breakpoints: "none"` in `fluid.config.json` instead if you need to own the ladder
yourself (`references/config.md`). `scripts/audit.mjs`'s `tw-breakpoint-units` check catches a
redeclared rung.

## A dark theme later without touching components

Keep every component on role names. A dark theme is then one extra block redefining the same names
under `[data-theme='dark']`, plus one `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))`,
and not an edit to thirty components.

## Header ink and `--fluid-header-h`

Header ink that follows the section underneath (`data-header-theme`, the scroll probe, the shared
colour transition) is scroll behaviour: see the `scroll-animation` skill, `references/header-theme.md`.
This skill owns only the header's size: `--fluid-header-h` (`section-recipe.md` §Heroes under a fixed,
floating header), which that skill reads.

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
- [ ] A fixed header's clearance comes from `--fluid-header-h`, never a hand-typed offset.
- [ ] Foreign component sets are namespaced.
