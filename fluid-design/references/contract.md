# Contract: config keys, custom properties, utilities and attributes

**Read when:** you need the exact vocabulary this skill ships — a config key, an emitted custom
property, a `fluid-*` utility name, a `data-*` attribute the verifier reads, or a name the companion
`scroll-animation` skill depends on — and you want the name checked against what actually ships, not
remembered from a planning doc.
**Skip when:** you already know the name and just need the *why* behind it — that lives in
`fluid-scale.md` (units/config), `stacks.md` (per-stack authoring surface) or `tokens-and-theming.md`
(design tokens, a separate vocabulary from this one). Motion attributes and constants (`data-stage`,
`data-scrub-*`, `data-motion-state`, `data-header-theme`, the entrance curves) are the
`scroll-animation` skill's `references/attribute-contract.md`.
**Depends on:** nothing. This is the leaf reference every other doc in this skill cites for exact
names, which is also why it exists on its own rather than folded into one of them.

Every name below was checked against `scripts/generate-fluid.mjs` / `scripts/lib/fluid-math.mjs` and
`scripts/verify-matrix.mjs`, as of the version of this skill you are reading. If a name here ever
stops matching the code, the code is the source of truth — file that as a doc bug against this page.

## Contents

1. Config: `fluid.config.json` (and the emitted custom properties)
2. Utility vocabulary
3. DOM attributes this skill reads
4. The interface with `scroll-animation`
5. Traps

## 1. Config: `fluid.config.json`

Schema: `assets/fluid.config.schema.json`. Defaults: `assets/fluid.config.json`.

```json
{
  "$schema": "./fluid.config.schema.json",
  "prefix": "fluid",
  "reference": { "width": 1440, "height": 900 },
  "canvas":    { "width": 1680, "gutter": 80 },
  "engageAt": 1024,
  "heightAxis": true,
  "units": {
    "fluid":   { "floor": 0.58 },
    "display": { "damping": 0.62, "floor": "auto" },
    "copy":    { "damping": 0.33, "floor": "auto" },
    "chrome":  { "enabled": true }
  },
  "ceiling": null,
  "zoomCompensation": true,
  "zoomTextRange": [24, 48]
}
```

| Key | Meaning |
|---|---|
| `prefix` | utility/class-name and (SCSS) function/mixin prefix; renames `fluid-*` utilities, the `.fluid-frame` class and the `fluid()`-family Sass identifiers. Does **not** rename `--fluid*` custom properties — those are fixed, see §1 below |
| `reference.width` / `reference.height` | the viewport where 1 unit = 1px — a content budget, not the design canvas (`fluid-scale.md` §4) |
| `canvas.width` | the drawn frame width, emitted as the `fluid-cap-*` grow-only ceiling |
| `canvas.gutter` | the drawn page gutter, for documentation/example use; not baked into a custom property by itself |
| `engageAt` | the min-width (px) where the scale turns on; below it every unit is a flat `1px`. Must be `<= reference.width` |
| `heightAxis` | `true` (default): `--fluid` takes `min(width arm, height arm)`. `false`: width-only, for sites with no one-screen sections |
| `units.fluid.floor` | hard floor in px-equivalent below which `--fluid` stops shrinking (default 0.58) |
| `units.display.damping` / `units.copy.damping` | rate the type unit shrinks relative to `--fluid`, in (0, 1] |
| `units.display.floor` / `units.copy.floor` | `"auto"` = `round2(damping * engageAt/reference.width + (1 - damping))` (0.82 and 0.90 at the shipped defaults) — or a number override |
| `units.chrome.enabled` | emit `--fluid-chrome`, a width-fit/height-floored fourth role for site chrome. Default `true` |
| `ceiling` | `null` (default) = uncapped growth. A number N wraps `--fluid` in `min(Npx, …)`; the type units inherit the cap through it |
| `zoomCompensation` | `true` (default): the display and copy units read their base as `var(--fluid) * var(--fluid-zoom, 1)`, so text follows browser zoom once `assets/runtime/fluid-zoom.js` sets `--fluid-zoom` (`fluid-scale.md` §12, Browser zoom). Without the script the fallback is 1. `false` emits plain `var(--fluid)` |
| `zoomTextRange` | `[full, none]` drawn px, default `[24, 48]`: how much of the zoom `fluid-text-*` takes by font size — all at or below `full`, none at or above `none`, linear between. Tailwind emits it as `clamp(0, (none − n) / (none − full), 1)` inside the utility; SCSS and StyleX resolve it at compile time |

### Emitted custom properties

Fixed names — `scripts/lib/fluid-math.mjs`'s `cssUnits()` is the single source, and every stack
generator (`tailwind-v4`, `css`, `scss`, `stylex`) calls it rather than re-deriving these strings.
Only utility/class *names* move with `prefix`; these do not.

```
--fluid          max(<floor>px, min(calc(100svh / H), calc(100vw / W)))      [heightAxis:false → max(floor, 100vw/W)]
--fluid-display  max(<dfloor>px, B, calc(d * B + (1-d)px))
--fluid-copy     max(<cfloor>px, B, calc(c * B + (1-c)px))
                 where B = calc(var(--fluid) * var(--fluid-zoom, 1))   [zoomCompensation:false → B = var(--fluid)]
--fluid-chrome   min(calc(100vw / W), max(1px, calc(100svh / H)))            [only emitted when units.chrome.enabled]
--safe-top       env(safe-area-inset-top, 0px)
--safe-bottom    env(safe-area-inset-bottom, 0px)
--browser-bar    calc(100lvh - 100svh)
--header-h       calc(24 * var(--fluid) + var(--safe-top) + <rowH>)   (rowH: 34px below engageAt, 48*var(--fluid-chrome) above when chrome is enabled, else 48*var(--fluid); overridable)
```

`--fluid-zoom` is **not** emitted by the stylesheet. `assets/runtime/fluid-zoom.js` writes it as an
inline style on `<html>` (the detected browser zoom, 1 when unzoomed or undetectable); the `, 1`
fallback keeps every unit valid without it.

All properties are `1px` in `:root` (or omitted, for `--fluid-chrome`, when `units.chrome.enabled`
is `false`) and are redefined inside `@media (width >= engageAt)`.

If `ceiling` is set, `--fluid` is wrapped in `min(<ceiling>px, …)` **before** `--fluid-display` and
`--fluid-copy` read it, so the cap propagates through `var(--fluid)` the same way in generated CSS
as it does in `scripts/lib/fluid-math.mjs`'s `factors()`.

## 2. Utility vocabulary (Tailwind v4; every other stack mirrors the same set)

The exact `@utility` set in `assets/styles/tailwind-v4/fluid.css`. Layout utilities spend `--fluid`:

- padding: `fluid-p/px/py/pt/pb/pl/pr-*`
- margin: `fluid-m/mx/my/mt/mb/ml/mr-*`
- gap: `fluid-gap/gap-x/gap-y-*`
- size: `fluid-w/h/size/min-w/min-h/max-h-*`
- position: `fluid-inset/top/right/bottom/left-*`
- translate: `fluid-translate-x/y-*` (writes the `translate` property, not `transform`, so it composes
  with an animation engine's `transform`)
- `fluid-text-*` (font-size on `--fluid`, with the `/lh` modifier)
- `fluid-cap-*`: `max-width: max(Npx, N*var(--fluid))` — grow-only

Type utilities: `fluid-display-*` spends `--fluid-display`; `fluid-copy-*` spends `--fluid-copy`.
Both take the `/lh` modifier.

Values are always the unitless drawn number. Negatives go inside an arbitrary value:
`lg:top-[calc(-8*var(--fluid))]`.

Other stacks (`references/stacks.md`): vanilla CSS and CSS Modules spend the same four custom
properties directly in `calc()`, with no per-value helper classes. SCSS exposes `fluid(120)`,
`fluid-display(64)`, `fluid-copy(14)`, `fluid-text(56)`, `fluid-chrome(48)`, `fluid-cap(1680)`, and
the engage breakpoint as `$fluid-engage-at` (`assets/styles/scss/_fluid.scss`) — not `$engage`.
StyleX exposes typed helpers returning the same `calc()` strings via `defineVars`.

## 3. DOM attributes this skill reads

| Attribute | On | Meaning |
|---|---|---|
| `data-fit="screen"` | a section drawn at the reference height | `scripts/verify-matrix.mjs`'s default `--fit-selector`: asserts the element's height is `<=` the viewport at every desktop cell. Pass another selector with `--fit-selector` |
| `data-verify-grid` | a grid inside a scaling frame | `verify-matrix.mjs` reports its computed `grid-template-columns` track count at every desktop viewport and fails if it changes — the drift symptom of an unscaled `auto-fill` minimum (`frame-and-gutter.md` §3) |
| `data-verify-grid="responsive"` | a grid whose column count is meant to change | reported but never fails the run |

Neither attribute changes rendering; both exist for the verifier.

### `--header-h`

Emitted with the units (§1): `calc(24 * var(--fluid) + var(--safe-top) + <rowH>)`, where `rowH` is
34px below `engageAt` and `48 * var(--fluid-chrome)` above it (`48 * var(--fluid)` when chrome is
disabled). It uses the header's **resting** inset, so it holds through a header transition. Override
it on `:root` when the header row is drawn at another height. Consumers: plate hero padding, anchor
`scroll-margin-top`, sticky `top` (`section-recipe.md` §Heroes under a fixed, floating header).

## 4. The interface with `scroll-animation`

The two skills share exactly three things. Keep them in this skill's config and let the other read them.

- **The engage breakpoint.** `engageAt` in `fluid.config.json`. `node scripts/generate-fluid.mjs --stack ts`
  emits `fluid.config.ts` with `ENGAGE_PX` and `ENGAGE_QUERY`; the motion ports import it (or read
  `fluid.config.json`) instead of their own `ENGAGE_BREAKPOINT_PX` literal. It must also equal
  Tailwind's `--breakpoint-lg` and SCSS's `$fluid-engage-at`.
- **`--header-h`** (§3). Header ink, anchor offsets and scroll wells read it; this skill owns its value.
- **The `translate` property.** `fluid-translate-*` writes `translate`, never `transform`, so a
  per-frame engine `transform` composes with it. Entrance distances stay fixed px (engines resolve
  `var()` once), so no motion value reads a fluid unit at animation time.

## Traps

- Renaming `--fluid*` custom properties via `prefix`: `prefix` renames utilities, `.fluid-frame` and
  Sass identifiers only; the custom property names are fixed (§1).
- A second hand-typed engage breakpoint in JavaScript. Import `ENGAGE_QUERY` from the generated
  `fluid.config.ts` (§4).
- `fluid-translate-*` and an engine both writing `transform`: they do not collide only because the
  utility writes `translate` (§2).
- A hand-typed header offset instead of `--header-h` (§3).
- Expecting `canvas.gutter` to exist as a custom property. It does not; it is used by the frame class
  and the budget check (§1).
