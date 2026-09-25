# Contract: config keys, custom properties, utilities and attributes

**Read when:** you need the exact vocabulary this skill ships — a `fluid.config.json` key, an
emitted custom property, a `fluid-*` utility name, a `data-*` attribute the verifier reads, or a
name the companion `scroll-animation` skill depends on — and you want the name checked against
what actually ships, not remembered from a planning doc.
**Skip when:** you already know the name and just need the *why* behind it — that lives in
`fluid-scale.md` (units/config), `stacks.md` (per-stack authoring surface) or `tokens-and-theming.md`
(design tokens, a separate vocabulary from this one). For the full settings table with every
default and doc string, read `config.md` (generated) — this page names the settings, it does not
repeat their values. Motion attributes and constants (`data-stage`, `data-scrub-*`,
`data-motion-state`, `data-header-theme`, the entrance curves) are the `scroll-animation` skill's
`references/attribute-contract.md`.
**Depends on:** nothing. This is the leaf reference every other doc in this skill cites for exact
names, which is also why it exists on its own rather than folded into one of them.

Every name below was checked against `scripts/lib/spec.mjs`, `scripts/lib/model.mjs`,
`scripts/lib/emit/{engine,tailwind,stacks,project}.mjs` and `scripts/tools/verify.mjs`, as of the
version of this skill you are reading. If a name here ever stops matching the code, the code is
the source of truth — file that as a doc bug against this page.

## Contents

0. Browser support
1. Config: `fluid.config.json` (structure) and settings (CSS variables)
2. Emitted custom properties
3. Utility vocabulary and band variants
4. SCSS and StyleX API
5. `fluid.ts` exports
6. DOM attributes this skill reads
7. The interface with `scroll-animation`
8. Traps

## 0. Browser support

| Stack | Floor | Set by |
|---|---|---|
| CSS, SCSS, StyleX, CSS Modules | Safari 15.4, Chrome 108, Firefox 101 | `svh`. The engine's media queries use classic `min-width`/`max-height` syntax, and the exclusive SCSS band mixins nest `@media not all and (…)` for their upper edge, so nothing newer is needed |
| Tailwind v4 | Safari 16.4, Chrome 111, Firefox 128 | Tailwind v4's own floor; the fluid layer adds nothing above it |

- **Without `@property`** (Firefox < 128, Safari < 16.4): every setting is also read as
  `var(--fluid-…, <default>)`, so the numbers are still correct. Two things are lost: an invalid
  value no longer falls back to its default (it invalidates the formula instead), and
  `fluidPx(n, unit, el)` can't read a unit at an element, so it falls back to the page's units.
- **Range syntax outside the engine.** `fluid.ts`'s `MEDIA` strings and the Tailwind band variants
  use range syntax (`(600px <= width < 1024px)`), which needs Safari 16.4. `DESKTOP_QUERY` is
  classic (`(min-width: 1024px)`). Below 16.4, use `DESKTOP_QUERY` in script, and write your own
  media queries in classic syntax.
- **The zoom runtime** writes through `document.adoptedStyleSheets` (Safari 16.4, Firefox 101) and
  falls back to `<html>`'s style attribute below that.

## 1. Config: `fluid.config.json` (structure) and settings (CSS variables)

Every structure key and every setting, with its default and doc string, is in `config.md`
(generated from `scripts/lib/spec.mjs`); this page does not repeat it. Orientation:

- **Structure** (`fluid.config.json`, needs `fluid generate`) changes which CSS rules exist. Schema:
  `assets/fluid.config.schema.json`. `version` must be `2`; a file without it is read as v1
  (`brownfield-migration.md`). `prefix` renames utilities, classes, variants and Sass functions,
  never a `--fluid*` custom property.
- **Settings** are CSS variables, `--fluid-<band>-<key>` or a global `--fluid-<key>`, registered
  with `@property`, set in the project's own `:root` (or a scope, §3), live. At the default
  structure there are 43: 30 registered, 13 optional (unset by default). Per band:
  `base-width`, `base-height` and `fit-height` (desktop only), `scale-min`, `scale-max` (optional on
  desktop), `<role>-damping`, `<role>-floor` (desktop only, optional), `container-width`,
  `container-padding`, `header-height`; the tablet and landscape container and header settings are
  optional and fall back to the phone's ("set mobile once"). Global: `header-inset`, the limits
  `grow-until`, `shrink-until`, `ui-grow-until` (with `ui: true`) and `off`, and
  `zoom-text-full` / `zoom-text-none` (with `zoom: true`, on stacks that have `fluid-text`: not the
  css stack).
- `fluid settings` prints the generated `settings.reference.css`; `fluid explain <W>x<H>` shows what
  each resolves to and where the value came from (default or `file:line`).
- **Your own `--fluid-*` tokens.** `fluid check` treats an unknown `--fluid-*` name as an error only
  when it is within two edits of a real setting (a typo) or is an engine-owned name (`--fluid`,
  `--fluid-ui`, `--fluid-header-h`, …, which would override the engine). Anything else is an info
  note, "fine if it's your own token", shown with `fluid check --verbose`.

## 2. Emitted custom properties

Fixed names — `scripts/lib/spec.mjs`'s `unitNames()` and `scripts/lib/emit/engine.mjs`'s
`formulas()` are the single source, and every stack generator (`tailwind-v4`, `css`, `scss`,
`stylex`) calls the same engine rather than re-deriving these strings. Only utility/class *names*
move with `prefix`; these do not.

```
--fluid                    the layout unit: max(scale-min, min(height arm, width arm, scale-max))
--fluid-z                  --fluid with each arm's viewport × var(--fluid-zoom, 1)   [only with zoom: true;
                            the unzoomed value of --fluid, so type zooms 1:1]
--fluid-<role>              one per entry in `roles` (default --fluid-display, --fluid-copy):
                            max(B, d·max(B, knee) + (1−d), floor)   where B = --fluid-z (or --fluid if zoom: false)
--fluid-ui                  [only with ui: true] follows width, never shrinks for a short window
--fluid-container-width     always emitted: the page container's max-width (grows, never narrows below the setting)
--fluid-container-padding   always emitted: the page container's side padding
--fluid-header-h           calc(header-inset * var(--fluid) + var(--fluid-safe-top) + <row>)
                            row: header-height (CSS px, unscaled) below desktop; header-height * var(--fluid-ui)
                            (or var(--fluid) if ui: false) at desktop
--fluid-safe-top / --fluid-safe-bottom   env(safe-area-inset-top/bottom, 0px)
--fluid-browser-bar         calc(100lvh - 100svh)
--fluid-build                "<SKILL_VERSION>+<structure hash>" stamp on :root, for stale-stylesheet diagnosis
                            (`fluid explain --url`, `fluid verify`)
```

Everything the engine declares is namespaced `--fluid-*`, so a site's own `--header-h` or
`--safe-top` is left alone. With the top-level `aliases: true` (what `fluid migrate` turns on, in
every stack) the v1 names come back as aliases: `--header-h`, `--safe-top`, `--safe-bottom`,
`--browser-bar`, `--fluid-chrome` and, when `bands.phone` is on, `--fluid-column`
(`brownfield-migration.md` has the full list).

`--_fluid-m-<unit>` (one per unit, ×1000, registered `<length>`, `inherits: false`, `0px`
elsewhere) is set on `:root` and every scope; it is what `fluidPx(n, unit, el)` reads.

`--fluid-zoom` is **not** emitted by the stylesheet. `runtime/zoom.js` (generated into
`output.dir`, from `assets/runtime/fluid-zoom.js`) writes it to `:root` through an adopted
stylesheet (the detected browser zoom, 1 when unzoomed or undetectable); the `, 1` fallback keeps
every unit valid without it.

`fluid-text-N` (the Tailwind utility; SCSS's `fluid-text()`, StyleX's `fluidText()`) is not a
custom property — it is `N` blended between `var(--fluid)` and `var(--fluid-z)` by `N`'s share of
the zoom range (`--fluid-zoom-text-full` / `-none`).

Private, never read or set by your CSS: `--_fluid-*` (the per-band parameters each band block
points at the active band's settings, the formulas that read them, written once on `:root` and
every scope, and the mirrors above). `fluid check` warns if you declare one.

## 3. Utility vocabulary and band variants (Tailwind v4; every other stack mirrors the same set)

The exact `@utility` set is generated by `scripts/lib/emit/tailwind.mjs`'s `utilitiesCss()` into
`<output.dir>/fluid.css`. Layout utilities spend `--fluid`:

- padding: `fluid-p/px/py/pt/pb/pl/pr-*`
- margin: `fluid-m/mx/my/mt/mb/ml/mr-*`
- gap: `fluid-gap/gap-x/gap-y-*`
- size: `fluid-w/h/size/min-w/min-h/max-h-*`
- position: `fluid-inset/top/right/bottom/left-*`
- translate: `fluid-translate-x/y-*` (writes the `translate` property, not `transform`, so it
  composes with Motion's `transform`. **Not with GSAP on the same element**: GSAP folds
  `translate` into its own transform and freezes a px/`calc()` value at load size; put the offset
  on a child or wrapper GSAP does not tween, `fluid-scale.md` §11)
- `fluid-container`: the page container — `width: 100%; margin-inline: auto; max-width:
  var(--fluid-container-width); padding-inline: var(--fluid-container-padding)`. Apply once per
  section, to that section's own inner wrapper.
- `fluid-cap-*`: `max-width: max(Npx, N*var(--fluid))` — grow-only

Type utilities: `fluid-<role>-*` (one family per entry in `roles`: `fluid-display-*`,
`fluid-copy-*`, and a custom role's own `fluid-<role>-*`) spends `--fluid-<role>`; `fluid-text-*`
spends the base unit blended toward the zoomed one. Both take the `/lh` modifier
(`fluid-display-64/72`).

With `ui: true`, the ui unit gets its own small family (header/nav/footer boxes and their type):
`fluid-ui-{p,px,py,gap,w,h,size}-*`, `fluid-ui-text-*`.

Values are always the unitless drawn number. Bare numbers work in 0.25 steps (`fluid-p-24`,
`fluid-p-37.5`); anything else goes in brackets (`fluid-p-[8.3]`), which Tailwind v4 requires. The
`/lh` modifier is a drawn line box in px too, bare or bracketed (`fluid-copy-18/26`,
`fluid-copy-18/[26.5]`): `/1.5` means 1.5 drawn px, not a ratio. For a ratio, put `leading-[1.5]`
next to the size class (audit rule `fluid-leading-ratio`). The generated `cn` accepts exactly what
compiles, so a class that emits nothing (`fluid-p-8.3`) never evicts one that works.

**Opt-in families** (`tailwind.utilities` in `fluid.config.json`; Tailwind v4 only — the other
stacks spend the units through functions, so this list does not apply to them):

| Key | Default | Utilities |
|---|---|---|
| `negative` | on | `-fluid-{m,mx,my,mt,mb,ml,mr,inset,top,right,bottom,left,translate-x,translate-y}-*`, plus the logical ones when `logical` is on |
| `logical` | on | `fluid-{ps,pe,ms,me,start,end,inset-x,inset-y}-*` (writing-mode and RTL safe) |
| `basis` | on | `fluid-basis-*` |
| `scroll` | on | `fluid-scroll-{mt,pt,mb,pb}-*` (anchor offsets under a scaled header) |
| `space` | on | `fluid-space-x/y-*` (margin on every child but the last) |
| `rounded` | on | `fluid-rounded(-t/-b/-l/-r)-*`. A radius is part of its box's shape, so it scales with the box; `rounded-full` and % radii need nothing |

All are registered with tailwind-merge in the generated `cn.ts` (a negative lands in its
positive's group; `cn.ts`'s header explains why — without it, `lg:fluid-p-40 lg:fluid-p-24` keeps
both classes and CSS source order picks the winner). With `negative` off, negatives go inside an
arbitrary value: `lg:top-[calc(-8*var(--fluid))]`.

**Band variants** (`tailwind.variants`, default on): `fluid-phone:`, `fluid-tablet:`,
`fluid-landscape:` (`<prefix>-<band>:` with a custom `prefix`). Mutually exclusive — exactly one
matches at any viewport (`scripts/lib/model.mjs`'s `exclusiveMedia()`). They exist for what a
breakpoint can't say: an exclusive band, and orientation plus height. The desktop band is `lg:`:
`tailwind.breakpoints: "ladder"` (the default) puts `lg` at `bands.desktop.minWidth`. There is no
`fluid-desktop:` variant; it was byte-for-byte `lg:` (audit rule `fluid-desktop-variant`).

**Band variants vs breakpoints.** Tailwind v4 emits every custom variant after every breakpoint
variant, and nothing lets one sort between them. So on one property a band variant always beats a
breakpoint, whatever the widths say: `fluid-tablet:p-4 md:p-8` stays at `p-4` on an 800px tablet,
and `fluid-phone:hidden sm:block` stays hidden on a 500px phone.

- Don't mix a band variant with `sm:`, `md:` or a `max-*:` breakpoint on one property. Use one
  system for it: the band variants alone, or breakpoints alone (`max-lg:`, `md:max-lg:`).
- `lg:`, `xl:` and `2xl:` are fine next to a band variant: they start at the desktop band, where no
  band variant matches.
- Audit rule `band-variant-with-breakpoint` (also run by `fluid check`) flags the mix.

**Scopes and limits.** A scope is an element the engine re-declares its formulas on, so settings set
there apply to its subtree only. An element is a scope when it has class `<prefix>-scope`, attribute
`data-fluid-scope`, any limit utility, or a Tailwind arbitrary property that sets a fluid setting
(`[--fluid-grow-until:1680]`). The engine matches limits by class substring, so variants
(`lg:fluid-off`), the important forms (`fluid-off!`, `!fluid-off`) and a Tailwind `prefix()` still
count. A `*:` or `[&_…]:` variant on a limit does not: the class sits on the parent, the rule on
the children, and neither is a scope (audit rule `limit-on-children`).

| Utility | Writes | Effect inside |
|---|---|---|
| `<prefix>-grow-until-<W>` | `--fluid-grow-until: W` | units hold their size at a W-wide window above it |
| `<prefix>-shrink-until-<W>` | `--fluid-shrink-until: W` | units hold their size at a W-wide window below it (ui too) |
| `<prefix>-ui-grow-until-<W>` | `--fluid-ui-grow-until: W` | only `--fluid-ui` |
| `<prefix>-off` | `--fluid-off: 1` | nothing scales |

`W` is a whole number of window px (bare, or `[1680]`); a limit applies in the band containing W.
The same four are settings (`config.md`), usable on `:root`. Autocomplete suggests common widths
(375 … 2560). `fluid-scale.md` §10 has the semantics and the `--fluid-header-h` trap.

**Autocomplete.** Every value utility resolves through a suggestion scale first
(`@theme inline reference { --fluid-step-*: … }`, which emits no CSS), then any number or bracketed
number — so Tailwind IntelliSense lists `fluid-p-24`, `fluid-display-64/72` and the rest, and
`fluid-p-37.5` and `fluid-p-[8.3]` still work.
Settings complete in CSS files through `fluid.css-data.json` (VS Code `css.customData`; `fluid init`
wires it).

Other stacks: vanilla CSS and CSS Modules spend the same custom properties directly in `calc()`,
with no per-value helper classes (`stacks.md`).

## 4. SCSS and StyleX API

**SCSS** (`_index.scss`, generated; `@use 'fluid' as fd;` with the folder holding `fluid/` on Sass
`loadPaths` — the units, settings and base styles themselves come from `fluid.css`, imported once
globally):

- `fd.fluid($n)`, `fd.fluid-<role>($n)` (one per role), `fd.fluid-ui($n)` (with `ui: true`)
- `fd.fluid-text($n, $size: $n)` — `$size` is the font size its zoom share is read from; pass it
  for a line-height so the line box zooms with its text
- `fd.fluid-cap($n)` — grow-only max-width
- `@mixin fd.fluid-type($size, $lh, $unit: <first role>)` — font-size + line-height together;
  `$unit` is one of the roles, `text`, or `ui`
- `@mixin fd.fluid-container` — the page container
- Band mixins, one per enabled band: `@include fd.fluid-phone { }`, `fd.fluid-tablet`,
  `fd.fluid-landscape`, `fd.fluid-desktop`. Exactly one matches at any viewport (the upper edges
  are nested `@media not all and (…)`, classic syntax)
- `@mixin fd.fluid-scope` and the limit mixins `fd.fluid-grow-until($w)`,
  `fd.fluid-shrink-until($w)`, `fd.fluid-ui-grow-until($w)`, `fd.fluid-off` — each writes the
  engine's formulas (mirrors included) on that selector
- Every function `@error`s on a number that already has a unit (`fd.fluid(64px)` fails the build
  instead of silently dropping `64px * var(--fluid)`, length × length)
- With the top-level `aliases: true`: the v1 names `@mixin fd.fluid-up` (= `fd.fluid-desktop`),
  `@mixin fd.fluid-frame` (= `fluid-container`) and, with `ui: true`, `@function fd.fluid-chrome($n)`

**StyleX** (`fluid.stylex.ts`, generated): typed helpers returning the same `calc()` strings —
`fluid(n)`, `fluid<Role>(n)` (camelCased per role, e.g. `fluidDisplay`), `fluidUi(n)` (with
`ui: true`), `fluidText(n, size = n)`, `fluidCap(n)`, and `fluidContainer` (a style object, not a
function). Author the breakpoint as a StyleX media-query key against `DESKTOP_QUERY` (§5).

## 5. `fluid.ts` exports (every stack gets this file)

Generated by `scripts/lib/emit/stacks.mjs`'s `fluidTs()` into `<output.dir>/fluid.ts`:

```ts
FLUID_VERSION: string
type BandName = 'phone' | 'tablet' | 'landscape' | 'desktop'   // only the enabled bands
type RoleName = 'display' | 'copy' | …                          // = roles
type FluidUnit = 'fluid' | 'display' | 'copy' | … | 'ui'
BANDS: readonly BandName[]
ROLES: readonly RoleName[]
MEDIA: Record<BandName, string>          // one matchMedia query per band; exactly one matches (range syntax: Safari 16.4+)
DESKTOP_PX: number                       // bands.desktop.minWidth
DESKTOP_QUERY: string                    // '(min-width: <DESKTOP_PX>px)'
ENGAGE_PX, ENGAGE_QUERY                  // only with aliases: true (v1 names for the same two)
PREFIX: string
CONTAINER_CLASS: string                  // '<prefix>-container'
type FluidSetting = keyof typeof SETTINGS
SETTINGS: Record<FluidSetting, { band: BandName | null, default: number | null, doc: string }>
function setFluidSetting(name, value, el = document.documentElement): void   // value: null removes the override
```

Plus a re-export of the runtime: `fluidPx`, `fluidUnits`, `onFluidChange` (from
`runtime/units.js`, generated from `assets/runtime/fluid-units.js` — see §7). `fluid.ts` is the
one file every consumer imports; there is no separate `fluid.config.ts`.

## 6. DOM attributes this skill reads

| Attribute | On | Meaning |
|---|---|---|
| `data-fit="screen"` | a section drawn at the reference height | `scripts/tools/verify.mjs`'s default `--fit-selector`: asserts the element's height is `<=` the viewport at every desktop cell. Pass another selector with `--fit-selector` |
| `data-verify-grid` | a grid inside a scaling frame | `verify.mjs` reports its computed `grid-template-columns` track count at every desktop viewport and fails if it changes — the drift symptom of an unscaled `auto-fill` minimum (`frame-and-gutter.md` §3) |
| `data-verify-grid="responsive"` | a grid whose column count is meant to change | reported but never fails the run |

Neither attribute changes rendering; both exist for the verifier.

## 7. The interface with `scroll-animation`

The two skills share exactly three things. Keep them in this skill's generated `fluid.ts` and let
the other read them.

- **The desktop breakpoint.** `bands.desktop.minWidth` in `fluid.config.json`. `fluid generate`
  (any stack) always writes `<output.dir>/fluid.ts` with `DESKTOP_PX` and `DESKTOP_QUERY`; the
  motion ports import one of those instead of their own hard-coded breakpoint literal. It must also
  equal Tailwind's `--breakpoint-lg` (§3, `stacks.md`) and the SCSS band mixin's edge.
- **`--fluid-header-h`** (§2). Header ink, anchor offsets and scroll wells read it; this skill owns
  its value. It uses the header's **resting** inset, so it holds through a header transition.
  `scroll-animation` reads `var(--fluid-header-h, var(--header-h, 0px))`, so it also works on a v1
  or hand-made site; `--header-h` itself is emitted here only with `aliases: true`.
- **The `translate` property.** `fluid-translate-*` (and SCSS/StyleX callers writing `translate:`
  directly) writes `translate`, never `transform`, so a per-frame engine `transform` composes with
  it. Entrance distances stay fixed px (engines resolve `var()` once), so no motion value reads a
  fluid unit at animation time.
- **`fluidPx(n, unit, el)`** (`runtime/units.js`, re-exported from `fluid.ts`), for script that
  needs a scaled *number*, not a CSS declaration — a GSAP tween's `x`, a ScrollTrigger `end`, a
  canvas font size, a Motion transform. `unit` is any role, or `'ui'` (`'chrome'` too, only with
  `aliases: true`). Passing nothing reads `--fluid`. With `el`, it walks up to the nearest scope and
  reads the unit there (limits included); cache it per frame, not per tween tick. With GSAP, pass functions so ScrollTrigger re-reads them on
  refresh: `gsap.to(el, { x: () => fluidPx(600), scrollTrigger: { invalidateOnRefresh: true } })`.

## 8. Traps

- Renaming `--fluid*` custom properties via `prefix`: `prefix` renames utilities, `fluid-container`
  and Sass identifiers only; the custom property names are fixed (§2).
- A second hand-typed desktop breakpoint in JavaScript. Import `DESKTOP_QUERY` from the generated
  `fluid.ts` (§5, §7).
- A band variant and a `sm:`/`md:`/`max-*:` breakpoint on one property: the band variant always
  wins (§3).
- `fluid-translate-*` and an engine both writing `transform`: they do not collide only because the
  utility writes `translate` (§3), and with GSAP only on an element GSAP never tweens (§3).
- A hand-typed header offset instead of `--fluid-header-h` (§2, §7).
- Declaring a `--fluid-*` unit (`--fluid`, `--fluid-display`, …) yourself instead of the setting it
  is built from: it silently replaces the engine's formula. `fluid check` warns.
- Setting a `--fluid-<band>-*` setting inside a media query, or on a selector that is not `:root`
  or a scope: it either does nothing (settings are already per band) or never applies.
  `fluid check --verbose` notes both (`scripts/lib/settings.mjs`'s `lintSettings`).

## Class merging (`cn.ts`, Tailwind)

The generated `cn.ts` exports `withFluid` (a tailwind-merge plugin that puts every `fluid-*` family in
the group of the property it sets, and gives the limits groups of their own), `twMerge`
(`extendTailwindMerge(withFluid)`) and `cn`. A project with its own `cn` (shadcn's `lib/utils.ts`)
keeps it and adds the plugin: `extendTailwindMerge(withFluid)`, or
`extendTailwindMerge({ extend: … }, withFluid)` when it already extends tailwind-merge. Tested with
both shapes in `scripts/test/tailwind-compile.mjs`.
