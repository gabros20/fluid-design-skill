# The other units: type roles, ui, header height, container

Purpose: The units built from `--fluid`: the type roles (damping, and where type holds its size),
`--fluid-ui` for the header, nav and footer, `--fluid-header-h`, the container units, and adding a
role.

Read when: tuning how type shrinks, sizing the header or footer, reading the container units, or
adding a type role.
Skip when: you are choosing which unit a run of text uses (`typography.md`) or building a section
(`section-recipe.md`).
Inputs: `fluid.config.json` (`roles`, `ui`), the damping and container settings in the project's
`:root`.
Produces: a damping, role or container decision with its reasoning.

The base unit, its two axes and the ×1000 form are in `fluid-scale.md`; the per-band numbers in
`bands.md`.

## Contents
1. The type units, and where type holds its size
2. The ui unit, the header height and the container units
3. Adding a role
4. Traps

## 1. The type units, and where type holds its size

Halving a section's padding is invisible; halving 14px body copy makes it unreadable. Each type unit
is a **damping** of `--fluid` (of `--fluid-z` with `zoom: true`, `browser-zoom.md`), plus an optional floor:

```css
--fluid-display: max(--fluid, d·max(--fluid, knee) + (1 − d), floor);   /* d = --fluid-desktop-display-damping, 0.62 */
--fluid-copy:    max(--fluid, d·max(--fluid, knee) + (1 − d), floor);   /* d = --fluid-desktop-copy-damping,    0.33 */
```

Read `0.62` as "display type shrinks at 62% of the layout's rate". `floor`
(`--fluid-desktop-<role>-floor`) is optional and unset by default, because the knee already holds
type up.

- **Type holds its size below the desktop breakpoint (the knee).** `knee = bands.desktop.minWidth /
  base-width` (1024 / 1440 = 0.7111), live with either setting. Desktop `scale-min` (0.58) sits
  below it, so the layout keeps compressing past the knee while type stays at the size it reached
  there. On the mobile bands the knee is the band's own `scale-min`, which `--fluid` never goes
  below, so it does nothing and mobile type follows its damped curve. That is also why the mobile
  bands have no floor setting: a floor there could only bind above `scale-min`, which the damping
  says better.
- **Damping only shrinks.** Extended upward, type would grow slower than its frame and loosen the
  type-to-column ratio that decides line breaks. Above the design frame every length shares one
  factor, so wraps match the frame.
- **The design frame is exact for any damping**, since `d·1 + (1−d) = 1`.
- **Two dampings, because one fails both ways.** Measured: 0.45 blows the heading to five lines at
  1024×900; 0.55 takes body copy to 13.5px at 1440×640. 0.62 and 0.33 hold four lines and 14.5px.
- **Where it shows:** between f ≈ 0.70 and 0.58 type is flat while the layout still compresses. Only
  a desktop window under about 640px tall reaches that range.

Resolved factors at the defaults (`fluid calc table` in a project):

| `--fluid` | at height | at width | display | copy |
|---|---|---|---|---|
| 1.000 | 900+ | 1440+ | 1.000 | 1.000 |
| 0.889 | 800 | 1280 | 0.931 | 0.963 |
| 0.778 | 700 | 1120 | 0.862 | 0.927 |
| 0.711 | 640 | 1024 | 0.821 | 0.905 |

In a 1440×700 window the layout is at 78%, display at 86% and body at 93%: the composition tightens
and type keeps its presence. A floor alone would let type shrink at the layout's rate and then stop
dead. Which unit a run of type uses depends on its box (`typography.md` §Choosing a unit); a third
role is one config entry (§3).

## 2. The ui unit, the header height and the container units

Header, nav and footer are not section composition. When height binds on a short, wide window, the
layout unit rightly shrinks sections, but the same shrink made the nav and footer look undersized
without buying any fit.

```css
--fluid-ui: min(calc(100vw / 1440), max(1px, calc(100svh / 900)));
/* width always; height never pulls it below the design frame's size */
```

| Window | `--fluid` | `--fluid-ui` |
|---|---|---|
| 1440×700 (short, wide) | 0.78 | **1.00** |
| 1024×900 (narrow, tall) | 0.71 | **0.71** (the nav still has to fit) |
| 2560×1440 | 1.60 | 1.60 |

With `ui: true` (default) it has `fluid-ui-{p,px,py,gap,w,h,size}-*` and `fluid-ui-text-*`, SCSS
`fluid-ui()`, StyleX `fluidUi()`, and `fluidPx(n, 'ui')`. `scale-max` caps it too (both units read
the same private maximum), and with `--fluid-desktop-fit-height: 0` it ignores height as well.

**The header height.** The header's container and its top inset stay on `--fluid`, in step with
the hero's top padding:
`--fluid-header-h = header-inset·--fluid + --fluid-safe-top + header-row`, where `header-row` is
`header-height · --fluid-ui` on desktop and flat CSS px on the mobile bands. Tablet and landscape
header heights fall back to the phone's. `--header-h` is its v1 alias (`aliases: true`).

**The container units.** `--fluid-container-width` and `--fluid-container-padding` are built from
the active band's `container-width` and `container-padding` settings:

- Desktop width only grows: `max(1680px, 1680 × --fluid)` (`frame-and-gutter.md` §1 has why).
  The mobile bands' widths track `--fluid` directly.
- **The padding never drops below the safe-area inset:** `max(padding × --fluid,
  env(safe-area-inset-left, 0px), env(safe-area-inset-right, 0px))`. A phone on its side under
  `viewport-fit=cover` keeps content clear of the notch with no per-component rules; elsewhere the
  insets are 0.
- Defaults: desktop 1680/80, phone 560/24, tablet and landscape 1024/32. 1024 is the desktop
  breakpoint, wider than any window in those bands, so they run full width (`bands.md`).

## 3. Adding a role

A new type role is one array entry:

```json
{ "roles": ["display", "copy", "eyebrow"] }
```

`fluid generate` then emits `--fluid-<band>-eyebrow-damping` for every band and
`--fluid-desktop-eyebrow-floor` (starting at `copy`'s values: mobile 0.6, desktop 0.33), the
`--fluid-eyebrow` unit, the `fluid-eyebrow-*` text utility with `/lh`, its role box utilities
(`fluid-eyebrow-h-*`, `-px-*`, …), SCSS `fd.fluid-eyebrow($n)`, StyleX `fluidEyebrow(n)` and
`fluidPx(n, 'eyebrow')`. Tune it like the others (`--fluid-desktop-eyebrow-damping: 0.5;`).

A role name may not collide with a word already in use: `ui`, `text`, `container`, `scope`, `cap`,
`build`, a band name, a utility family (`p`, `w`, `gap`, `min`, …), first word included (`min-w`,
`gap-x`, `ui-text` are rejected, since `fluid-<role>-*` would collide). Config validation rejects a
collision with a did-you-mean.

A unit with a different reference or axis mix is not a role (it cannot be a damping of `--fluid`).
Write it as its own `max(floor, min(…))` on the ×1000 form (`fluid-scale.md` §3); `fluid check`'s settings lint does
not know about it.

## 4. Traps

- Damping above 1 or a floor to "fix" small type on desktop: the knee already holds type up below
  the desktop breakpoint; a floor makes type shrink at the layout's rate and then stop dead (§1).
- A role name that collides with a reserved word, first word included (§3).
- A limit on `<header>` instead of `--fluid-ui-grow-until` on `:root`: the header and
  `--fluid-header-h` drift apart (`limits-and-scopes.md`).
