# Brownfield migration: moving an existing site onto the scale

Read when: the site already exists — either with `.container`/`max-w-7xl` wrappers, px sizes, maybe
some `clamp()` or `vw` type and no fluid-design yet (§"Converting a container-based site"), or
already running fluid-design v1 (§"From fluid-design v1"). The job in both cases is to convert
without a big bang.
Skip when: greenfield. Go straight to `section-recipe.md`.

## From fluid-design v1

Run `fluid migrate [--write]` at the project root (`scripts/lib/model.mjs`'s `migrateV1`). Without
`--write` it is a dry run: it prints what moved and the `fluid.config.json` (v2) it would write.
With `--write` it backs up the old file as `fluid.config.v1.json`, writes the v2
`fluid.config.json` and `fluid.config.schema.json`, and prints the `:root` snippet of every v1
number that was not already a v2 default — paste that into your globals.css `:root`, next to your
tokens, then run `fluid generate`.

`fluid check`, `generate`, `settings` and an offline `explain` refuse a v1 config and tell you to run
`fluid migrate --write`; `fluid calc`, `fluid verify` and `fluid explain --url` migrate it in
memory, so they work before you do. `fluid init --force` over a v1 config also keeps it as `fluid.config.v1.json`.

### What moves

- **Structure**, `fluid.config.json`: `engageAt` → `bands.desktop.minWidth`; the mobile arm
  (`mobile.enabled`, `.tablet`, `.landscape`) → `bands.phone` / `.tablet` / `.landscape`;
  `units.chrome.enabled` → `ui`; `zoomCompensation` → `zoom`; `utilities.*` → `tailwind.utilities.*`.
  `prefix` and `roles` (always `["display", "copy"]` from v1) carry over unchanged. Full name map:
  `contract.md` §1, `config.md`.
- **Settings**, values only (a v1 number that already equals its v2 default is dropped, not
  carried over): `reference.width/height` → `--fluid-desktop-base-width/-height`; `units.fluid.floor`
  → `--fluid-desktop-scale-min`; `ceiling` → `--fluid-desktop-scale-max`; `units.display/copy.damping`
  → `--fluid-desktop-{display,copy}-damping` (a numeric `floor` too; `floor: "auto"` has no v2
  equivalent to carry — see "Two numbers that move" below); `canvas.width/gutter` →
  `--fluid-desktop-container-width/-padding`; every `mobile.*` number → the matching
  `--fluid-{phone,tablet,landscape}-*` setting; `zoomTextRange` → `--fluid-zoom-text-full/-none`.
- **`aliases: true`** is set automatically by the migration (top-level key, every stack — not only
  Tailwind). It re-emits every v1 name as a thin wrapper around its v2 equivalent, so existing call
  sites keep working the moment you regenerate (table below). Turn it off once every call site has
  moved.
- **The one import.** v1 projects typically had several: `fluid.css`, `base.css`,
  `tokens.example.css`, plus hand-copied `cn.ts` and runtime files. Delete all of those imports and
  replace them with the single line `fluid init`/`fluid migrate` points at:
  `@import '<output.dir>/fluid.css';` (after `@import 'tailwindcss';` on the Tailwind stack). It
  now carries the base layer (`output.base`), the breakpoints, the band variants and every utility
  — there is nothing else to import for the styles.
- **Delete the hand-copied files.** v1 had you copy `assets/runtime/fluid-zoom.js` /
  `fluid-units.js` into your own `src/lib` (or similar), copy `assets/styles/tailwind-v4/cn.ts` by
  hand, and hand-write the `FRAME`/`.fluid-frame` class string. In v2, `fluid generate` writes
  `runtime/units.js(+.d.ts)`, `runtime/zoom.js(+.d.ts)` and `cn.ts` into `output.dir` itself — they
  are generated, not copied. Delete your hand-copied versions and update imports to point at the
  generated ones (`<output.dir>/fluid.ts`, `<output.dir>/cn.ts`, `<output.dir>/runtime/…`). Same
  for a hand-written `fluid.config.ts` (`ENGAGE_PX`/`ENGAGE_QUERY`): delete it, the generated
  `fluid.ts` exports `DESKTOP_PX`/`DESKTOP_QUERY`, plus those same v1 names while `aliases` is on
  (`contract.md` §5, §7).

### v1 names and their v2 equivalents

With `aliases: true`, the left column still works; without it, only the right one exists.

| v1 | v2 |
|---|---|
| `--header-h`, `--safe-top`, `--safe-bottom`, `--browser-bar` | `--fluid-header-h`, `--fluid-safe-top`, `--fluid-safe-bottom`, `--fluid-browser-bar` (namespaced so a site's own `--header-h` is left alone) |
| `--fluid-chrome`, `fluidPx(n, 'chrome')`, SCSS `fd.fluid-chrome($n)` | `--fluid-ui`, `fluidPx(n, 'ui')`, `fd.fluid-ui($n)` |
| `--fluid-column` | `--fluid-container-width` |
| `.fluid-frame` / `fd.fluid-frame` | `fluid-container` / `fd.fluid-container` |
| SCSS `fd.fluid-up` | `fd.fluid-desktop` |
| `ENGAGE_PX` / `ENGAGE_QUERY` | `DESKTOP_PX` / `DESKTOP_QUERY` |

Not aliased, because they were never v1 names: the Tailwind `fluid-desktop:` variant is gone (use
`lg:`; audit rule `fluid-desktop-variant` finds it), and the mobile `*-floor` settings are gone
(`fluid check` names the replacement: `--fluid-<band>-<role>-damping` or `-scale-min`).

Config and concept names that changed (no alias; `fluid migrate` carries the values): `engageAt` →
`bands.desktop.minWidth`; `chrome` → `ui`; `zoomCompensation` → `zoom`; `heightAxis: false` →
`--fluid-desktop-fit-height: 0`; `ceiling` → `--fluid-desktop-scale-max`; `floor` →
`--fluid-desktop-scale-min`; `canvas.width` / `canvas.gutter` → `--fluid-desktop-container-width` /
`-padding` (settings, not structure); the shared `mobile.damping` → one damping per band and role;
`mobile.column: null` → set the band's `container-width` to the desktop one; the
`tokens.example.css` starter is gone (tokens live in your own `globals.css`).

### Two numbers that move

Everything else is geometry-identical to v1 (verified: `v1 parity 47,616 checks`, 0 failures beyond
what is listed here). Two things are intentionally different:

1. **Floor rounding.** v1's `floor: "auto"` rounded the type floor to 2 decimals; v2 replaces the
   "auto" floor with the **knee** — an exact, live value (`bands.desktop.minWidth / base-width` on
   desktop) that needs no rounding, because it follows your settings instead of being computed once
   at generate time. It is the same expression: v1's `d · engageAt/W + (1 − d)` is v2's
   `d · knee + (1 − d)` with `knee = engageAt/W`. Measured across the examples, the only place this changes anything is at
   320×568, where type sits about 0.3% larger or smaller than it did under v1's rounded floor.
2. **`--fluid-ui` under `fit-height: 0`** (v1 `heightAxis: false`). v1's `--fluid-chrome` still read
   the height arm even with `heightAxis: false`, so a short, wide window kept the header at its full
   size while the rest of the layout kept shrinking by width alone. v2's `--fluid-ui` now ignores
   height too when `fit-height` is `0`, so the header scales with the same single axis as everything
   else. If your header noticeably held its size on a short window under v1, expect it to shrink a
   little more now — that is this fix, not a regression.

### If the mobile arm was off in v1

v1's `.fluid-frame` stepped its container padding from 24px to 32px at a 640px breakpoint even with
the mobile arm off. v2's flat mode (`bands.phone: false`) uses one `--fluid-phone-container-padding`
(default 24) below desktop, with no step. Add your own `sm:` padding override if the step mattered
to the design.

## Converting a container-based site (never on fluid-design before)

1. **Inventory, read-only.** Run `node <skill>/scripts/tools/audit.mjs src --json > fluid-audit.json`. Record:
   - The container: max-width, horizontal padding per breakpoint. That is today's container width
     and padding (`--fluid-desktop-container-width` / `-padding` once migrated).
   - The breakpoint where the desktop layout starts. That is `bands.desktop.minWidth`.
   - Existing fluid attempts (`clamp()`, `vw` font sizes, a `--scale` var, and the agency pattern of a
     viewport-driven root font size, `html { font-size: calc(100vw / 1440 * 10) }` with everything in
     `rem`, common in Webflow and Awwwards-style builds). Each is a second ladder that
     will fight the new scale; they are removed per section as that section migrates, never globally first.
   - The shared atoms (button, chip, eyebrow, CTA, card) and their call-site counts.
   - Motion libraries and scroll hijacks (GSAP, Lenis, locomotive, a header script). Note them in
     `FLUID.md` for the `scroll-animation` skill; do not touch them during this migration.
   - `overflow-x: hidden` on `body` or wrappers. This is often why `position: sticky` "doesn't work" (`ios-safari.md`).
2. **Decide with the user** (`preflight.md`): the stack, the desktop artboard (1440×900 by default)
   and the desktop container width/padding (1680/80 by default, or today's container max-width if
   there is no design file).
3. **`fluid init --brownfield`.** It writes `fluid.config.json` and generates `output.dir` with
   `output.base: false` (the base layer's box-sizing/overflow/focus rules are skipped, since the
   project already has its own reset — review each rule against the existing CSS if you want a
   piece of it) and **prints** the one import and a settings starter instead of editing your
   `globals.css` for you — brownfield CSS entry points are too varied to guess safely. Add the
   printed `@import` line yourself, after the project's own reset/tokens. Adding units and
   utilities changes nothing until a class uses them.
4. **Make the shared atoms opt-in fluid.** Add `fluid?: boolean` to each atom, with a compound variant
   carrying the scaled geometry. Default `false`. Migrated and unmigrated routes can then coexist, and
   an atom never flips under a route that has not moved.
5. **`cn.ts` is already generated** with the fluid families registered (Tailwind stack). Import it
   in every atom that accepts a `className`, before any atom emits fluid classes — that is exactly
   the override path.
6. **Pick one reference route** (usually the home page) and migrate it section by section with
   `section-recipe.md`. Verify the matrix after each section, not at the end.
7. **Queue the remaining routes.** Track per route: migrated, verified at the matrix, verified at 2560.
8. **Header and footer last,** on `--fluid-ui`. The header/footer unit is shared by every route, so it
   moves once all routes can take it. **Keep any existing header animation and colour logic, and
   take over only sizing**: the row height, inset, type and gaps move onto `--fluid-ui` (or the
   `fluid-ui-*` utilities) and `--fluid-header-h`; the script that hides, shows or re-inks the header stays
   as it is. Two writers on one property fight, so do not add a second one here. Changing that
   behaviour is a `scroll-animation` decision.

### Converting a container

| Before | After |
|---|---|
| `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` | `lg:fluid-container` (or, for a section whose gutter also needs to feel present below `lg`, `fluid-container` unprefixed once the mobile bands are on) |
| `.container { max-width: 1280px; padding: 0 2rem }` | `.fluid-container` (SCSS `@include fd.fluid-container`) |
| a page-level `max-w-[1360px]` | `fluid-container` for the section, plus an inner measure (`lg:fluid-cap-1200 mx-auto`) |

`fluid-container` reads `--fluid-<band>-container-width` / `-padding` for whichever band is active
— set those two settings once, they are not a structure key (`preflight.md` §2, `contract.md` §1).
If the site has no design file, the current container **is** the drawing: set
`--fluid-desktop-container-width` to its max-width, `--fluid-desktop-container-padding` to its
desktop side padding, and choose `bands.desktop.minWidth` / the desktop base width as the viewport
where the site looks right today (usually 1024 / 1440).

### Converting values

- **Keep the drawn number** and change only the unit: `lg:py-[120px]` becomes `lg:fluid-py-120`; `lg:gap-12` (48px)
  becomes `lg:fluid-gap-48`. Convert rem to px first (Tailwind's `12` = 3rem = 48).
- `clamp(2rem, 4vw, 4rem)` type: find the value at the reference viewport (4vw at 1440 = 57.6) and
  replace it with `lg:fluid-display-58` (or the drawn number, if the design has one). Keep the mobile value as
  plain CSS below the breakpoint, or move it onto the unprefixed `fluid-display-*` utility once the
  mobile bands are on.
- Tracking in px becomes `em` (`-1px` at 64 = `-0.015625em`).
- `height: 100vh` sections become `100svh` on mobile and `fluid-h-<drawn>` or `fluid-min-h-<drawn>` at the breakpoint.
- `auto-fill` grids, `flex-wrap` bases and `min-w` inside the container get scaled minimums (`frame-and-gutter.md` §3).

### What breaks during migration, and how to spot it

| Symptom | Cause |
|---|---|
| A section sits a few px right or left of its neighbours at 1680+ | padding on an ancestor, or a frozen padding beside a growing container |
| Grid goes from 4 to 5 or 6 columns on a big monitor | an unscaled `auto-fill` minimum |
| An element snaps to its intrinsic size (logos at random scales) | `Npx * var(--fluid)`: invalid, the declaration is dropped |
| An override class is ignored | fluid families not registered in `cn.ts`, or two classes outside `cn()` |
| Sticky stopped working | `overflow-x: hidden` on body or a wrapper |
| Mixed sizes on one page: a migrated chip next to an old one | an atom used without its `fluid` prop on a migrated route |
| Everything looks unstyled or full-bleed after a CSS change | a **stale stylesheet** in an open tab, not a code bug (`verification.md` §6) |
| `fluid check` fails on generated files | `output.dir` was hand-edited, or `fluid.config.json` changed since the last `fluid generate`. A formatter's rewrite is only a warning: add the folder to `.prettierignore` (`fluid init` does) or Biome's `files.ignore` |
| A band-only tweak is ignored at some widths, or wins where it shouldn't | a band variant (`fluid-tablet:`) and a breakpoint (`md:`) on one property: the band variant always wins (`contract.md` §3) |
| The site's own `--breakpoint-*` reorder `lg:` | they compete with the generated px ladder: `tailwind.breakpoints: "none"` (what `fluid init` sets when it finds them) |

## Traps
- [ ] Old `clamp`/`vw` ladders are removed per section as it migrates, never left alongside.
- [ ] Atoms are opt-in fluid and registered with `cn.ts` first.
- [ ] One reference route, fully verified, before the rest.
- [ ] `output.base: false` (or its individual rules) gets a visual check against the project's own reset.
- [ ] Header migration changes sizing only; its existing animation and colour logic are untouched.
- [ ] Motion libraries are noted for `scroll-animation`, not removed.
- [ ] A v1 migration runs `fluid migrate --write` before anything else touches `fluid.config.json`,
      and keeps `aliases: true` until every v1 name (`--header-h`, `--fluid-chrome`,
      `--fluid-column`, `.fluid-frame`, `fluid-up`, `ENGAGE_*`) has moved.

## A project that already has `cn` (shadcn and friends)

Do not replace it. Import `withFluid` from the generated `cn.ts` and build the project's `twMerge`
with it: `extendTailwindMerge(withFluid)` where it used to import `twMerge` directly, or add it as the
next argument if the project already extends tailwind-merge. `fluid init` prints the exact lines for
the file it finds; `fluid check` warns while any tailwind-merge setup in the project lacks it.
