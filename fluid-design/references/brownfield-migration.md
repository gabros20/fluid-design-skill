# Brownfield migration: moving an existing container-based site onto the scale

Read when: the site already exists, with `.container`/`max-w-7xl` wrappers, px sizes, maybe some
`clamp()` or `vw` type. The job is to convert it without a big bang.
Skip when: greenfield. Go straight to `section-recipe.md`.

## Order of work

1. **Inventory, read-only.** Run `node <skill>/scripts/audit.mjs src --json > fluid-audit.json`. Record:
   - The container: max-width, horizontal padding per breakpoint. That is today's frame and gutter.
   - The breakpoint where the desktop layout starts. That is `engageAt`.
   - Existing fluid attempts (`clamp()`, `vw` font sizes, a `--scale` var). Each is a second ladder that
     will fight the new scale; they are removed per section as that section migrates, never globally first.
   - The shared atoms (button, chip, eyebrow, CTA, card) and their call-site counts.
   - Motion libraries and scroll hijacks (Lenis, locomotive). Flag them for the user (`preflight.md` §2).
   - `overflow-x: hidden` on `body` or wrappers. This is often why `position: sticky` "doesn't work" (`ios-safari.md`).
2. **Decide with the user** (`preflight.md`): the canvas (the widest frame the design is drawn in, or today's
   container max-width if there is no design file), the reference (1440×900), the stack and the engine.
3. **Install the foundation additively** (SKILL.md step 2). Adding units and utilities changes nothing
   until a class uses them. The base layer is the one exception; review each of its rules against the
   existing CSS. The body background and `overflow-x` removals are behaviour changes and need a visual check.
4. **Make the shared atoms opt-in fluid.** Add `fluid?: boolean` to each atom, with a compound variant
   carrying the scaled geometry. Default `false`. Migrated and unmigrated routes can then coexist, and
   an atom never flips under a route that has not moved.
5. **Register the fluid families with the class merger** (`cn.ts`) before any atom emits fluid classes
   and accepts a `className`. That is exactly the override path.
6. **Pick one reference route** (usually the home page) and migrate it section by section with
   `section-recipe.md`. Verify the matrix after each section, not at the end.
7. **Queue the remaining routes.** Track per route: migrated, verified at the matrix, verified at 2560.
8. **Header and footer last,** on `--fluid-chrome`. The chrome is shared by every route, so it moves once all routes can take it.

## Converting a container

| Before | After |
|---|---|
| `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` | `mx-auto w-full max-w-[1680px] px-6 sm:px-8 lg:fluid-cap-1680 lg:fluid-px-80` |
| `.container { max-width: 1280px; padding: 0 2rem }` | `.fluid-frame` (SCSS `@include fluid-frame`) with the canvas and gutter from config |
| a page-level `max-w-[1360px]` | a frame at the canvas + an inner measure (`lg:fluid-cap-1200 mx-auto`) |

If the site has no design file, the current container **is** the drawing. Set `canvas.width` to its
max-width, set `gutter` to its desktop padding, and choose the reference as the viewport where the
site looks right today (usually 1440×900).

## Converting values

- **Keep the drawn number** and change only the unit: `lg:py-[120px]` becomes `lg:fluid-py-120`; `lg:gap-12` (48px)
  becomes `lg:fluid-gap-48`. Convert rem to px first (Tailwind's `12` = 3rem = 48).
- `clamp(2rem, 4vw, 4rem)` type: find the value at the reference viewport (4vw at 1440 = 57.6) and
  replace it with `lg:fluid-display-58` (or the drawn number, if the design has one). Keep the mobile value as
  plain CSS below the breakpoint.
- Tracking in px becomes `em` (`-1px` at 64 = `-0.015625em`).
- `height: 100vh` sections become `100svh` on mobile and `fluid-h-<drawn>` or `fluid-min-h-<drawn>` at the breakpoint.
- `auto-fill` grids, `flex-wrap` bases and `min-w` inside the frame get scaled minimums (`frame-and-gutter.md` §3).

## What breaks during migration, and how to spot it

| Symptom | Cause |
|---|---|
| A section sits a few px right or left of its neighbours at 1680+ | gutter on an ancestor, or a frozen gutter beside a growing cap |
| Grid goes from 4 to 5 or 6 columns on a big monitor | an unscaled `auto-fill` minimum |
| An element snaps to its intrinsic size (logos at random scales) | `Npx * var(--fluid)`: invalid, the declaration is dropped |
| An override class is ignored | fluid families not registered in the merger, or two classes outside `cn` |
| Sticky stopped working | `overflow-x: hidden` on body or a wrapper |
| Mixed sizes on one page: a migrated chip next to an old one | an atom used without its `fluid` prop on a migrated route |
| Everything looks unstyled or full-bleed after a CSS change | a **stale stylesheet** in an open tab, not a code bug (`verification.md`) |

## Traps
- [ ] Old `clamp`/`vw` ladders are removed per section as it migrates, never left alongside.
- [ ] Atoms are opt-in fluid and registered with the merger first.
- [ ] One reference route, fully verified, before the rest.
- [ ] Base-layer removals (body background, `overflow-x`, `theme-color`) get a visual check.
