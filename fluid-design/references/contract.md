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
`scripts/lib/emit/{engine,tailwind,stacks,project}.mjs` and `scripts/verify-matrix.mjs`, as of the
version of this skill you are reading. If a name here ever stops matching the code, the code is
the source of truth — file that as a doc bug against this page.

## Contents

1. Config: `fluid.config.json` (structure) and settings (CSS variables)
2. Emitted custom properties
3. Utility vocabulary and band variants
4. SCSS and StyleX API
5. `fluid.ts` exports
6. DOM attributes this skill reads
7. The interface with `scroll-animation`
8. Traps

## 1. Config: `fluid.config.json` (structure) and settings (CSS variables)

Two kinds of configuration, split by one rule (`config.md` §intro, `fluid-scale.md`):

- **Structure** changes which CSS rules exist: which bands, their breakpoints, type roles, the
  prefix, output. It lives in `fluid.config.json` and needs `fluid generate`. Schema:
  `assets/fluid.config.schema.json`, generated from `scripts/lib/spec.mjs`'s `STRUCTURE`.
- **Settings** change a number inside those rules. They are CSS variables — `--fluid-<band>-<key>`
  or a global `--fluid-<key>` — registered with `@property` so an invalid value falls back to the
  default, set in the project's own `:root` next to its tokens, live, no regenerate.

Top-level structure keys (full table with defaults and doc strings: `config.md`):

| Key | Kind |
|---|---|
| `version` | must be `2`; a file without it is read as v1 (`brownfield-migration.md`) |
| `prefix` | utility/class/variant/Sass-function prefix. Never renames `--fluid*` custom properties |
| `bands.phone` / `.tablet` / `.landscape` / `.desktop` | which bands exist and where they switch; `phone`/`tablet`/`landscape` also take a plain `true`/`false` |
| `roles` | damped type roles, default `["display", "copy"]`; a custom role starts with `copy`'s dampings |
| `ui` | emit `--fluid-ui` (v1 `chrome`) |
| `zoom` | emit `--fluid-z` and the browser-zoom runtime (v1 `zoomCompensation`) |
| `output.dir` / `.stack` / `.base` / `.integration` | where `fluid generate` writes, which stack, whether to include `base.css`, which head-script integration |
| `tailwind.breakpoints` / `.variants` / `.utilities.*` | Tailwind v4 stack only |
| `aliases` | top-level, every stack: also emit the v1 names (`--fluid-chrome`, `--fluid-column`, `fluid-frame` class/mixin, SCSS `fluid-chrome()`). `fluid migrate` turns this on |

Settings are grouped per band (`phone`, `tablet`, `landscape`, `desktop`) plus a handful that apply
everywhere (`--fluid-header-inset`, `--fluid-zoom-text-full`, `--fluid-zoom-text-none`). The full
list, with every default and one-line doc, is `config.md` §Settings — read that table rather than
re-typing it here; this page only promises the *names* are stable:
`--fluid-<band>-base-width`, `-base-height` (desktop only), `-fit-height` (desktop only),
`-scale-min`, `-scale-max`, `-<role>-damping`, `-<role>-floor`, `-container-width`,
`-container-padding`, `-header-height`. `fluid settings` prints the generated
`settings.reference.css`; `fluid explain <W>x<H>` shows what each resolves to and where the value
came from (default or `file:line`).

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
--fluid-ui                  [only with ui: true] follows width, never shrinks for a short window (v1 --fluid-chrome)
--fluid-container-width     always emitted: the page container's max-width (grows, never narrows below the setting)
--fluid-container-padding   always emitted: the page container's side padding
--header-h                  calc(header-inset * var(--fluid) + var(--safe-top) + <row>)
                            row: header-height (CSS px, unscaled) below desktop; header-height * var(--fluid-ui)
                            (or var(--fluid) if ui: false) at desktop
--safe-top / --safe-bottom  env(safe-area-inset-top/bottom, 0px)
--browser-bar                calc(100lvh - 100svh)
--fluid-build                "<SKILL_VERSION>+<structure hash>" stamp on :root, for stale-stylesheet diagnosis
                            (`fluid explain --url`, `fluid verify`)
```

With the top-level `aliases: true` (what `fluid migrate` turns on, in every stack, not only
Tailwind): `--fluid-chrome` (`var(--fluid-ui)`) and, when `bands.phone` is on, `--fluid-column`
(`var(--fluid-container-width)`, `none` from the desktop band). These are the v1 names, kept only
for a migrated project until its call sites move.

`--fluid-zoom` is **not** emitted by the stylesheet. `runtime/zoom.js` (generated into
`output.dir`, from `assets/runtime/fluid-zoom.js`) writes it as an inline style on `<html>` (the
detected browser zoom, 1 when unzoomed or undetectable); the `, 1` fallback keeps every unit valid
without it.

`fluid-text-N` (the Tailwind utility; SCSS's `fluid-text()`, StyleX's `fluidText()`) is not a
custom property — it is `N` blended between `var(--fluid)` and `var(--fluid-z)` by `N`'s share of
the zoom range (`--fluid-zoom-text-full` / `-none`).

Private, never read or set by your CSS: `--_fluid-*` (the per-band parameters each band block
points at the active band's settings; the formulas that read them are written once on
`:root, .<prefix>-scope`). `fluid check` warns if you declare one.

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

Values are always the unitless drawn number.

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
`fluid-landscape:`, `fluid-desktop:` (`<prefix>-<band>:` with a custom `prefix`). Mutually
exclusive — exactly one matches at any viewport (`scripts/lib/model.mjs`'s `exclusiveMedia()`).
`fluid-desktop:` is min-width `bands.desktop.minWidth` and equals `lg:` when
`tailwind.breakpoints: "ladder"` (the default; `stacks.md`).

`fluid-scope`: put class `<prefix>-scope` on an element and set any `--fluid-*` setting on it — the
engine re-declares its formulas there too, so the override applies to that element's subtree only.

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
  `fd.fluid-landscape`, `fd.fluid-desktop`. `fd.fluid-up` is an alias of `fd.fluid-desktop` (the v1
  name for the desktop band)
- Every function `@error`s on a number that already has a unit (`fd.fluid(64px)` fails the build
  instead of silently dropping `64px * var(--fluid)`, length × length)
- With the top-level `aliases: true`: `@mixin fd.fluid-frame` (alias of `fluid-container`) and,
  with `ui: true`, `@function fd.fluid-chrome($n)` (alias of `fluid-ui`)

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
MEDIA: Record<BandName, string>          // one matchMedia query per band; exactly one matches at any viewport
DESKTOP_PX: number                       // bands.desktop.minWidth
DESKTOP_QUERY: string                    // '(min-width: <DESKTOP_PX>px)'
ENGAGE_PX, ENGAGE_QUERY                  // v1 names for the same two
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
| `data-fit="screen"` | a section drawn at the reference height | `scripts/verify-matrix.mjs`'s default `--fit-selector`: asserts the element's height is `<=` the viewport at every desktop cell. Pass another selector with `--fit-selector` |
| `data-verify-grid` | a grid inside a scaling frame | `verify-matrix.mjs` reports its computed `grid-template-columns` track count at every desktop viewport and fails if it changes — the drift symptom of an unscaled `auto-fill` minimum (`frame-and-gutter.md` §3) |
| `data-verify-grid="responsive"` | a grid whose column count is meant to change | reported but never fails the run |

Neither attribute changes rendering; both exist for the verifier. Unchanged from v1.

## 7. The interface with `scroll-animation`

The two skills share exactly three things. Keep them in this skill's generated `fluid.ts` and let
the other read them.

- **The desktop breakpoint.** `bands.desktop.minWidth` in `fluid.config.json`. `fluid generate`
  (any stack) always writes `<output.dir>/fluid.ts` with `DESKTOP_PX` and `DESKTOP_QUERY` (plus the
  `ENGAGE_PX`/`ENGAGE_QUERY` aliases for v1 call sites); the motion ports import one of those
  instead of their own hard-coded breakpoint literal. It must also equal Tailwind's
  `--breakpoint-lg` (§3, `stacks.md`) and the SCSS band mixin's edge.
- **`--header-h`** (§2). Header ink, anchor offsets and scroll wells read it; this skill owns its
  value. It uses the header's **resting** inset, so it holds through a header transition.
- **The `translate` property.** `fluid-translate-*` (and SCSS/StyleX callers writing `translate:`
  directly) writes `translate`, never `transform`, so a per-frame engine `transform` composes with
  it. Entrance distances stay fixed px (engines resolve `var()` once), so no motion value reads a
  fluid unit at animation time.
- **`fluidPx(n, unit)`** (`runtime/units.js`, re-exported from `fluid.ts`), for script that needs a
  scaled *number*, not a CSS declaration — a GSAP tween's `x`, a ScrollTrigger `end`, a canvas font
  size, a Motion transform. `unit` is any role, or `'ui'` (`'chrome'` is accepted as the v1 alias).
  Passing nothing reads `--fluid`. With GSAP, pass functions so ScrollTrigger re-reads them on
  refresh: `gsap.to(el, { x: () => fluidPx(600), scrollTrigger: { invalidateOnRefresh: true } })`.

## 8. Traps

- Renaming `--fluid*` custom properties via `prefix`: `prefix` renames utilities, `fluid-container`
  / `fluid-frame` and Sass identifiers only; the custom property names are fixed (§2).
- A second hand-typed desktop breakpoint in JavaScript. Import `DESKTOP_QUERY` (or `ENGAGE_QUERY`)
  from the generated `fluid.ts` (§5, §7).
- `fluid-translate-*` and an engine both writing `transform`: they do not collide only because the
  utility writes `translate` (§3), and with GSAP only on an element GSAP never tweens (§3).
- A hand-typed header offset instead of `--header-h` (§2, §7).
- Declaring a `--fluid-*` unit (`--fluid`, `--fluid-display`, …) yourself instead of the setting it
  is built from: it silently replaces the engine's formula. `fluid check` warns.
- Setting a `--fluid-<band>-*` setting inside a media query, or on a selector that is not `:root`
  or `.<prefix>-scope`: it either does nothing (settings are already per band) or never applies.
  `fluid check` catches both (`scripts/lib/settings.mjs`'s `lintSettings`).
- Expecting `canvas.gutter` (v1) to still exist. It is `--fluid-<band>-container-padding` now, a
  setting, not a structure key (`preflight.md`).
