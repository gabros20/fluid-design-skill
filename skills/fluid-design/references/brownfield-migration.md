# Brownfield migration: moving an existing site onto the scale

Purpose: Move an existing site onto the scale without a big bang: a fluid-design v1 project through
`fluid migrate`, or a container-based site converted route by route, keeping any existing `cn`.

Read when: the site already exists — either with `.container`/`max-w-7xl` wrappers, px sizes, maybe
some `clamp()` or `vw` type and no fluid-design yet (§"Converting a container-based site"), or
already running fluid-design v1 (§"From fluid-design v1"). The job in both cases is to convert
without a big bang.
Skip when: greenfield. Go straight to `section-recipe.md`.
Inputs: the existing project: its CSS entry, `@theme`, container wrappers and breakpoints, any v1
`fluid.config.json`, any `cn`/`tailwind-merge` helper.
Produces: a migrated or brownfield-initialised `fluid.config.json`, a conversion order, converted
sections, and the `withFluid` change to an existing `cn`.

## Contents

- From fluid-design v1
- Updating a v2 project to 2.1: tablet and landscape width, `$schema`
- Converting a container-based site (never on fluid-design before)
- Bridging old gutter and container tokens
- Traps
- A project that already has `cn` (shadcn and friends)

## From fluid-design v1

Run `fluid migrate [--write]` at the project root (`scripts/lib/model.mjs`'s `migrateV1`). Without
`--write` it is a dry run: it prints what moved and the `fluid.config.json` (v2) it would write.
With `--write` it backs up the old file as `fluid.config.v1.json`, writes the v2
`fluid.config.json` (its `$schema` points at the published schema, so a local
`fluid.config.schema.json` can be deleted), and prints the `:root` snippet of every v1 number that
was not already a v2 default. Paste that into your globals.css `:root`, next to your tokens, then
run `fluid generate`.

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
- **One import.** Replace v1's several (`fluid.css`, `base.css`, `tokens.example.css`) with
  `@import '<output.dir>/fluid.css';` (after `@import 'tailwindcss';` on Tailwind). It carries the
  base layer (`output.base`), the breakpoints, the band variants and every utility.
- **Delete the hand-copied files.** v1 had you copy `fluid-zoom.js`, `fluid-units.js` and `cn.ts`
  into your source and hand-write `.fluid-frame` and a `fluid.config.ts` (`ENGAGE_PX`). v2 generates
  `runtime/units.js`, `runtime/zoom.js`, `cn.ts` and `fluid.ts` (`DESKTOP_PX`/`DESKTOP_QUERY`, plus
  the v1 names while `aliases` is on) into `output.dir`. Delete the copies and import the generated
  files (`contract.md` §5, §7, "Generated files").

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

1. **Floor rounding.** v1's `floor: "auto"` rounded the type floor to 2 decimals. v2 uses the
   **knee** instead (type holds its size below the desktop breakpoint): the same expression,
   `d · knee + (1 − d)` with `knee = bands.desktop.minWidth / base-width`, but exact and live. Across
   the examples it changes only 320×568, by about 0.3%.
2. **`--fluid-ui` under `fit-height: 0`** (v1 `heightAxis: false`). v1's `--fluid-chrome` still read
   the window height, so on a short, wide window the header kept its full size while the layout
   shrank by width. v2's `--fluid-ui` ignores height too, so a header that held its size on a short
   window under v1 now shrinks a little. That is the fix, not a regression.

### If the mobile arm was off in v1

v1's `.fluid-frame` stepped its container padding from 24px to 32px at a 640px breakpoint even with
the mobile arm off. v2's flat mode (`bands.phone: false`) uses one `--fluid-phone-container-padding`
(default 24) below desktop, with no step. Add your own `sm:` padding override if the step mattered
to the design.

## Updating a v2 project to 2.1: tablet and landscape width, `$schema`

**Tablet and landscape now run full width by default.** `--fluid-tablet-container-width` and
`--fluid-landscape-container-width` default to the desktop breakpoint (1024, wider than any window
in those bands) and their `container-padding` to 32. Before, they fell back to the phone's 560
column and 24 padding, which read as a phone floating on a tablet. The defaults are only for a
design with no tablet or landscape frame. To keep the old column, set it in your `:root`:

```css
--fluid-tablet-container-width: 560;    --fluid-tablet-container-padding: 24;
--fluid-landscape-container-width: 560; --fluid-landscape-container-padding: 24;
```

A v1 project keeps its look: `fluid migrate` writes v1's column and gutter (560 and 24, or
`mobile.column`) as these four settings. Check the tablet cells (820×1180, 834×1194) and landscape
cells (844×390, 932×430) with `fluid verify` either way.

**The container padding never drops below the safe-area inset** (`contract.md` §2). A
per-component `padding-inline: max(…, env(safe-area-inset-left))` rule written for a landscape
notch can go once its section sits in a `fluid-container`.

**`$schema`.** A project with a local `fluid.config.schema.json` can point `$schema` at the published
schema, `https://unpkg.com/fluid-design-cli@2/skills/fluid-design/assets/fluid.config.schema.json`,
and delete the copy. New projects get that URL from `fluid init`.

**The `fluid` script.** A project set up before `fluid init` added it can add
`"fluid": "npx fluid-design-cli@2"` to `package.json` scripts, so the team and CI run
`npm run fluid -- check` without the skill installed.

## Converting a container-based site (never on fluid-design before)

1. **Inventory, read-only.** Run `node <skill>/scripts/tools/audit.mjs src --json > fluid-audit.json`. Record:
   - The container: max-width and side padding per breakpoint (`--fluid-desktop-container-width` /
     `-padding` once migrated), and any gutter or max-width token (bridge it, below).
   - The breakpoint where the desktop layout starts. That is `bands.desktop.minWidth`.
   - Existing fluid attempts (`clamp()`, `vw` font sizes, a `--scale` var, or a viewport-driven root
     font size, `html { font-size: calc(100vw / 1440 * 10) }` with everything in `rem`). Each is a
     second ladder that fights the new scale: remove it per section as that section migrates, never
     globally first.
   - The shared atoms (button, chip, eyebrow, CTA, card) and their call-site counts.
   - Motion libraries and scroll hijacks (GSAP, Lenis, locomotive, a header script). Note them in
     `FLUID.md`; do not touch them during this migration.
   - `overflow-x: hidden` on `body` or wrappers. This is often why `position: sticky` "doesn't work" (`ios-safari.md`).
2. **Decide with the user** (`preflight.md`): the stack, the desktop artboard (1440×900 by default)
   and the desktop container width/padding (1680/80 by default, or today's container max-width if
   there is no design file).
3. **`fluid init --brownfield`.** It writes `fluid.config.json` and generates `output.dir` with
   `output.base: false` (the project has its own reset; compare the base rules against it, including
   the `html` overflow guard `fluid-bleed-x` relies on). It **prints** the import and a settings
   starter instead of editing `globals.css`, because brownfield entry points vary too much to guess.
   Add the `@import` after the project's own reset and tokens. Nothing changes until a class uses
   the units.
4. **Make the shared atoms opt-in fluid.** Add `fluid?: boolean` to each atom, with a compound variant
   carrying the scaled geometry. Default `false`. Migrated and unmigrated routes can then coexist, and
   an atom never flips under a route that has not moved.
5. **`cn.ts` is already generated** with the fluid families registered (Tailwind stack). Import it
   in every atom that accepts a `className`, before any atom emits fluid classes — that is exactly
   the override path.
6. **Pick one reference route** (usually the home page) and migrate it section by section with
   `section-recipe.md`. Verify the matrix after each section, not at the end.
7. **Queue the remaining routes.** Track per route: migrated, verified at the matrix, verified at 2560.
8. **Header and footer last,** on `--fluid-ui`: every route shares them, so they move once all
   routes can take it. **Take over sizing only**: row height, inset, type and gaps move onto
   `--fluid-ui` (`fluid-ui-*`) and `--fluid-header-h`; the script that hides, shows or re-inks the
   header stays as it is, because two writers on one property fight.

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

## Bridging old gutter and container tokens

A site rarely migrates every route at once, and its old gutter token keeps its fixed value. In the
production site, `--spacing-gutter: 72px` (used as `px-gutter`) and hard-coded `lg:px-18` stayed at
72px when the team later widened `--fluid-desktop-container-padding` to 108: migrated sections moved,
old ones did not. Point the old token at the fluid unit while routes migrate:

```css
@theme inline {
  --spacing-gutter: var(--fluid-container-padding);   /* was 72px */
}
```

Bridge an old max-width token to `--fluid-container-width` the same way. `inline` writes the
`var()` into each utility, so it resolves on the element and follows a scope's settings too. Every
`px-gutter` then follows the active band's padding, notch clearance included, and one setting moves
old and new routes together. Hard-coded gutters (`lg:px-18`, `px-[72px]`) don't follow a
token: replace them route by route with `fluid-container` on the section's inner wrapper, and grep
for them before calling a route done. Remove the bridge once nothing uses the old token.

## Traps
- [ ] Old gutter and container tokens point at `--fluid-container-padding` / `-width` while routes
      migrate; hard-coded gutters are replaced route by route.
- [ ] Old `clamp`/`vw` ladders are removed per section as it migrates, never left alongside.
- [ ] Atoms are opt-in fluid and registered with `cn.ts` first.
- [ ] One reference route, fully verified, before the rest.
- [ ] `output.base: false` (or its individual rules) gets a visual check against the project's own reset.
- [ ] Header migration changes sizing only; its existing animation and colour logic are untouched.
- [ ] Motion libraries are noted in `FLUID.md`, not removed.
- [ ] A v1 migration runs `fluid migrate --write` before anything else touches `fluid.config.json`,
      and keeps `aliases: true` until every v1 name (`--header-h`, `--fluid-chrome`,
      `--fluid-column`, `.fluid-frame`, `fluid-up`, `ENGAGE_*`) has moved.

## A project that already has `cn` (shadcn and friends)

Do not replace it. Import `withFluid` from the generated `cn.ts` and build the project's `twMerge`
with it: `extendTailwindMerge(withFluid)` where it used to import `twMerge` directly, or add it as the
next argument if the project already extends tailwind-merge. `fluid init` prints the exact lines for
the file it finds; `fluid check` warns while any tailwind-merge setup in the project lacks it.
