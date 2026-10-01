# Tokens and theming

Purpose: Where colour, surface and type tokens live next to the fluid settings, semantic roles over
the brand ramp, the traps that compile cleanly and render wrong, dark themes, header ink, hit
targets, selection and focus.

Read when: setting up colour, surface and type tokens; adding a dark section; porting components
from another codebase.
Skip when: working on pure layout.
Inputs: the design tokens and the existing `globals.css` / `@theme`.
Produces: semantic tokens in `globals.css` that components use, free of the compile-clean traps.

## Contents

- Tokens live in `globals.css`, next to the fluid settings
- Semantic names over the ramp
- Four traps that compile and render plausibly wrong
- A dark theme later without touching components
- Header ink and `--fluid-header-h`
- Small hit targets in a drawn row
- Selection and focus
- Traps

## Tokens live in `globals.css`, next to the fluid settings

Tokens go in your own stylesheet, never in `output.dir` (`fluid generate` never touches your
`:root`): `@theme` for the ramp and roles, `:root` for everything else, right below the fluid
import. One `globals.css` holds the design tokens and the few fluid settings you change (the shadcn
pattern):

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

Components write `bg-surface-dark text-text-heading`, never `bg-[#171819]` or a ramp step. The
reference build drifted into 65 uses of `bg-brand-gold-500` and dozens of raw hexes (five near-blacks
nobody chose), so a theme or brand refresh meant editing every section. Add a role as soon as a
second section needs the same colour for the same reason.

**A mid-luminance brand hue (gold) is a background, not text on light surfaces:** `#fccc36` is
1.52:1 on white. Name roles explicitly: `-ink` is text *in* the hue (a darker step that clears
4.5:1), `on-` is text *on* it. Not a gold focus ring on light grounds either (1.29:1); a dark ring
at 16:1 shows where you are.

## Four traps that compile and render plausibly wrong

1. **`rounded-*` still rounds.** A `--radius-custom: 0` token *adds* a utility; it does not reset
   Tailwind's radius scale, so a ported `rounded-xl` still rounds on a square design.
2. **`dark:` fires on the OS setting.** Without `@custom-variant dark (…)`, Tailwind v4's `dark:` is
   a `prefers-color-scheme` query: it fires for half your visitors on a site with no dark mode. No
   dark theme, no `dark:` (the audit flags it).
3. **A utility whose token does not exist emits nothing**, and Tailwind never warns. A typo ships
   no colour.
4. **A name shared with another codebase means something else there.** A site and an app that both
   define `border-secondary` resolve it differently; ported markup draws a near-invisible hairline.
   Namespace the second set's tokens (`app-*`) so a foreign name either exists or fails.

`scripts/tools/audit.mjs` catches 1 and 2; a lint list of banned token families catches 4.

### The breakpoint ladder ships in `fluid.css`: don't redeclare rungs

The generated `fluid.css` already emits the whole breakpoint ladder in px (`lg` = the desktop
breakpoint). Redeclaring `--breakpoint-lg` or any rung in your own `@theme` mixes px and rem, which
Tailwind v4 cannot sort: `sm:text-[64px]` then beat `lg:fluid-display-112` on a wide window, and it
looks like a design choice. To own the ladder, set `tailwind.breakpoints: "none"` (`stacks.md` has
the full story). `fluid check` errors on a rung declared next to the ladder.

## A dark theme later without touching components

Keep every component on role names. A dark theme is then one block redefining those names under
`[data-theme='dark']` plus `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))`,
not an edit to thirty components.

## Header ink and `--fluid-header-h`

Header ink that follows the section underneath is scroll behaviour, outside this skill. This
skill owns only the header's size, `--fluid-header-h` (`section-recipe.md` §Heroes under a fixed,
floating header), which header scripts read.

## Small hit targets in a drawn row

Nav items drawn at 13px line boxes fail WCAG 2.5.8's 24px minimum. Grow the target with a
transparent `::after` (`absolute inset-x-0 -inset-y-[15px]`), not padding, which would move items
whose gaps are drawn. The pseudo-element takes no space and hit-tests as its element, so `:hover`
and `onMouseEnter` fire on it.

## Selection and focus

`::selection` uses the exact brand hue of the chips and CTA; a near-miss reads as a mistake.
`:focus-visible` gets a 2px outline at a 2px offset, in a colour that clears contrast on its ground.
`:focus:not(:focus-visible) { outline: none }`.

## Traps
- [ ] Components use role tokens only; there are no raw hexes in sections.
- [ ] Brand hue as text uses an `-ink` step that clears AA.
- [ ] No `dark:` without a custom variant; no `rounded-*` on a square design.
- [ ] A fixed header's clearance comes from `--fluid-header-h`, never a hand-typed offset.
- [ ] Foreign component sets are namespaced.
