# The fluid scale: one measured unit, two derived type units

Read when: setting up units, changing `fluid.config.json`, adding a new unit role, or explaining the maths.
Skip when: you are only building a section. `section-recipe.md` is the checklist for that.

## Contents
1. The problem it solves
2. The model: drawn number × unit
3. The base unit and its two arms
4. The reference is a viewport, not the container
5. The type units and the knee
6. The ui unit
7. No ceiling (and when to set one)
8. Configuration knobs and where they live
9. Adding a role
10. One scale: why sections may not re-anchor it (and what `fluid-scope` is actually for)
11. Interop with animation (if any)
12. Limitations, and browser zoom
13. The bands (phone / tablet / landscape / desktop)
14. Traps

---

## 1. The problem it solves

A section built at the numbers of a 1680×900 frame is that size on every screen. It fails on both axes:

- **Height.** A 900px section sits 160px past the bottom edge of the glass in a 1440×740 window. A pinned scene's
  last act ends below the fold.
- **Width.** At 900 tall, where a height-only scale does nothing (its factor is exactly 1.000), the
  drawn three-line heading only holds down to 1440 wide. Below that the copy column narrows against a fixed
  512px stat grid and the heading blows out: four lines at 1280, **seven** at 1100 and 1024.

Measured on the reference build, heading line counts per strategy:

| Window | Height only | **Both axes** | Width on type only |
|---|---|---|---|
| 1440×900 | 64px · 3 | 64px · **3** | 64px · 3 |
| 1280×900 | 64px · **4** | 59.6px · **3** | 59.6px · 4 |
| 1100×900 | 64px · **7** | 54.6px · **4** | 54.6px · 6 |
| 1024×900 | 64px · **7** | 52.5px · **4** | 52.5px · 7 |

Scaling type alone is not enough. The *layout* has to take the width arm too, or the column never
gets its room back.

## 2. The model: drawn number × unit

Each unit is a **length that equals exactly 1px at the reference viewport**. So a Figma number is
written as that number, multiplied by the unit:

```
64px in the frame  →  calc(64 * var(--fluid-display))  →  lg:fluid-display-64
```

At 1440×900 the result is 64px, exactly the drawn value. At 1440×700 the unit is about 0.78 and the result is 49.8px.
Everything shrinks against one shared factor, so the frame's proportions hold by construction. There
is no table of per-property min/max pairs to keep in sync, which is the failure mode of
per-property `clamp()` systems.

**The multiplied number must be unitless.** `24 * var(--fluid)` is a number times a length, which is valid.
`24px * var(--fluid)` is a length times a length, which `calc()` rejects. CSS gives no error: the
custom property becomes guaranteed-invalid, everything reading it resolves to nothing, and the element
falls back to `auto`. On the reference build this took down a whole row of certification marks, which sprang to
their intrinsic sizes. It bites hardest when the number arrives through a variable:

```
'--mark-h': '64px'                    // a length
calc(var(--mark-h) * var(--fluid))    // INVALID, silently kills the rule
'--mark-h-n': '64'                    // a number
calc(var(--mark-h-n) * var(--fluid))  // correct
```

If a value must be a plain length below a band's breakpoint and a scaled one above it, keep two tokens.
`fluid audit <src>` flags this (`length-times-unit`), and the SCSS functions `@error` on it.

## 3. The base unit and its two arms

Every band computes `--fluid` the same shape: the smaller of a width arm and (desktop only, when
`fit-height` is on) a height arm, clamped between a floor and a ceiling. Each band reads its own
settings (`--fluid-<band>-base-width`, `-base-height`, `-scale-min`, `-scale-max`; `references/config.md`
has the full list), but the formula the generator writes is one shape, once, on `:root, .fluid-scope`
(`fluid-scope.md` §10) — only the *parameters* a band block points at change per band.

At the defaults, the desktop band (`--fluid-desktop-base-width: 1440`, `-base-height: 900`,
`-scale-min: 0.58`, `-scale-max` unset):

```css
--fluid: max(0.58px, min(100svh / 900, 100vw / 1440));          /* the maths */
--fluid: calc(max(580px, min(calc(100svh * 1000 / 900),
                             calc(100vw * 1000 / 1440))) / 1000);  /* what the generator emits */
```

**Why the ×1000.** Firefox keeps lengths in 1/60px steps and rounds the result of `min()`, `max()`
and `clamp()` to that grid. On a unit of about 0.71px that loses up to 1/60px, 1.6%, and every
drawn number multiplies it. Measured in Firefox 155 at 1024×640: `calc(900 * var(--fluid))` came
out 630px in a 640px window, so a one-screen section left a 10px gap. Comparing lengths 1000 times
larger and dividing once afterwards leaves 0.017px (639.983). Chromium and WebKit were exact either
way. Every unit the generator emits uses this form; a hand-written unit must too. The engine also
uses only `min()`/`max()`/`calc()` — no `clamp()`, no `round()` — because `clamp(a, b, c)` is just
`max(a, min(b, c))` and writing it out keeps every comparison on the same ×1000 lengths.

- **`min()` means fit.** It is `object-fit: contain` written as a scale factor, so the composition can
  never outgrow either axis. `max()` would be cover, and would let text overflow. Separate units per axis
  distort anything that must keep its aspect, and mean nothing for `font-size`, which is a single scalar.
- **Purely proportional, no intercept.** That is what makes `900 * var(--fluid) === 100svh` hold whenever the
  height arm wins, so a section drawn 900 tall is exactly one screen. When the width arm wins, the
  section comes out shorter than the window (800 in 1280×900, 640 in 1024×900). The precise
  guarantee: **never taller than the window, and exactly one screen tall whenever height binds.**
- **`svh`, not `dvh`.** The small viewport does not move when a mobile toolbar collapses. With `dvh`
  the type would resize mid-scroll, and over a scrubbed video that thrashes layout on the worst possible surface.
  (Pinned layers use `lvh`; see the `scroll-animation` skill, `references/scroll-scenes.md`.)
- **`100vw` includes a classic scrollbar gutter.** That is harmless when scrollbars are hidden or overlay. If it bites,
  use `calc((100vw - var(--scrollbar-width)) / 1440)`.
- **`--fluid-desktop-scale-min: 0.58`** was *chosen*, not derived: "structure stops compressing at a 522px-tall section".
  It is nearly unreachable, because at 1024 wide the width arm is already 0.711. Unlike a v1 `floor`, this is a
  live CSS variable — change it without a regenerate.
- **`--fluid-desktop-fit-height: 0`** turns the desktop band width-only: `max(scale-min, min(100vw/base-width, scale-max))`.
  The mobile bands (§13) are width-only by construction — they scale a phone frame, which has no
  "fits one screen" guarantee to keep.

Below the desktop band's breakpoint (`bands.desktop.minWidth`, default 1024), which band's formula
runs depends on `bands.phone`: by default (`bands.phone: true`) the phone, tablet and landscape
bands each scale their own frame the same way (§13). Set `bands.phone: false` and everything below
desktop is a flat `1px` unit instead — v1's only mobile behaviour.

## 4. The reference is a viewport, not the container

This is the most surprising part of the system, and the part most likely to be "fixed" wrongly.

The height reference matches the drawing: frames are 900 tall and the arm divides by 900. The width
reference does not: frames are 1680 wide, but the arm divides by **1440**. So a number read from
Figma means "this size at 1440 wide", not "this size in a 1680 frame, scaled". Between 1440 and 1680
the factor stays pinned at 1.0 by the height arm, and the composition just gains room. 1680 is the
default `--fluid-desktop-container-width` — the page container's cap (§6, `fluid-container`), not the
unit's reference.

The drawing is a wider shape than the screen (1.87:1 against 1.60:1), and a contain fit has to
letterbox one axis. There is no third answer:

| | Horizontal | Vertical |
|---|---|---|
| **1440 reference (this system)** | 240px of drawn content does not fit | sections fill the window exactly |
| 1680 container width + scaled padding | pixel-exact at every width | a 771px section in a 900px window |

The second option was modelled and **rejected twice**. It shrinks every rendering already approved at 1440 by
14%, and it breaks `900 × --fluid = 100svh` across most of the range. That guarantee is load-bearing:
it is what makes a four-act pinned scene exactly 4.00 viewports long.

**Practical consequence: treat 1440 as a content budget, not a container.** Drawn content must fit
`base-width − 2 × container-padding` (1440 − 160 = 1280) at full size. The outer 400px (to the 1680
container cap) is air a wide screen gains, not space to compose in. Check it with `fluid calc budget`.
A row over budget is fixed in the drawing (take the difference out of the whitespace, with design
sign-off) or with `cqw` (`frame-and-gutter.md`), never by changing the divisor.

## 5. The type units and the knee

Things do not compress equally: halving a section's padding is invisible, and halving 14px body copy
makes it unreadable. Each type unit is a **damping of `--fluid`** (or `--fluid-z` with `zoom: true`,
§12), plus an optional hard floor:

```css
--fluid-display: max(--fluid, d·max(--fluid, knee) + (1 − d), floor);   /* d = --fluid-desktop-display-damping, 0.62 default */
--fluid-copy:    max(--fluid, d·max(--fluid, knee) + (1 − d), floor);   /* d = --fluid-desktop-copy-damping,    0.33 default */
```

Read `0.62` as "display type shrinks at 62% of the rate the layout does". `floor` is
`--fluid-desktop-<role>-floor`, an **optional** setting — unset by default, because the knee below
already holds type up.

- **The knee replaces v1's `floor: "auto"`.** `knee = bands.desktop.minWidth / base-width`
  (1024 / 1440 = 0.7111 at the defaults) — exact, and it moves live with either setting, no
  regenerate. On mobile bands the knee is just that band's `scale-min`, which is a no-op: `--fluid`
  on those bands never drops below its own `scale-min` by construction, so `max(--fluid, knee)`
  always resolves to `--fluid` there, and mobile type just follows the plain damped curve. Desktop is
  the one band where the knee does real work, because its `scale-min` (0.58) sits *below* the knee
  (0.7111): the composition keeps compressing past the knee, and type stops at the value it reached
  there.
- **Exactly v1's auto floor, by construction.** `d · engageAt/W + (1 − d)` (v1) and
  `d · knee + (1 − d)` (v2) are the same expression with `knee = engageAt/W`. The only numeric
  difference: v1 rounded the floor to 2 decimals; v2 computes it live. Measured on the examples,
  this only shows up at 320×568, 0.3% of the type size.
- **Damping is a shrinking idea only.** Extended upward, type would grow slower than its own frame,
  which loosens the type-to-column ratio that governs line breaks. Above the reference every length
  shares one factor, so wrap points match the frame by construction.
- **The design point is exact for any damping**, since `d·1 + (1−d) = 1`.
- **Two dampings, because one fails both ways.** Measured: 0.45 blows the heading to five lines at
  1024×900; 0.55 takes body copy to 13.5px at 1440×640. 0.62 and 0.33 hold four lines and 14.5px.
- **A known knee:** the type floors engage at f ≈ 0.70 while the base keeps going to 0.58, so
  between those values type is flat while layout still compresses. This only bites under a 640px-tall
  desktop-band window (width ≥ 1024, height short enough that the height arm binds below the knee).

Resolved factors at the defaults (reproduce with `fluid calc table`, run inside a project):

| `--fluid` | at height | at width | display | copy |
|---|---|---|---|---|
| 1.000 | 900+ | 1440+ | 1.000 | 1.000 |
| 0.889 | 800 | 1280 | 0.931 | 0.963 |
| 0.778 | 700 | 1120 | 0.862 | 0.927 |
| 0.711 | 640 | 1024 | 0.821 | 0.905 |

In a 1440×700 window the layout is at 78%, display type at 86% and body at 93%: the composition tightens and
the type keeps its presence. A floor alone would have let type shrink at the layout's rate and then
stop dead.

Which unit a given run of type uses is decided by its **container**; see `typography.md` §Choosing a unit.
Adding a third role beyond `display`/`copy` is one config entry, not a hand-written formula — §9.

## 6. The ui unit

Site ui (header row, menu type, dropdowns, footer links) is not section composition. When height
binds on a short-but-wide window, the layout unit correctly shrinks section frames, but the same shrink
made the nav and footer look undersized without buying any fit.

```css
--fluid-ui: min(calc(100vw / 1440), max(1px, calc(100svh / 900)));
/* width always; height never pulls it below the design point */
```

| Window | `--fluid` | `--fluid-ui` |
|---|---|---|
| 1440×700 (short, wide) | 0.78 | **1.00** |
| 1024×900 (narrow, tall) | 0.71 | **0.71** (the nav still has to fit) |
| 2560×1440 | 1.60 | 1.60 |

With `ui: true` (the default) it has its own utility family, `fluid-ui-{p,px,py,gap,w,h,size,text}-*`
and `fluid-ui-text-*`, and the SCSS/StyleX helpers `fluid-ui()`/`fluidUi()` — v1's chrome had none of
these; call sites spent it the long way, `lg:h-[calc(48*var(--fluid-chrome))]`. Script reads it as
`fluidPx(n, 'ui')` (`'chrome'` is accepted as the v1 alias). The header's container (max width and padding) and its
inset from the top stay on `--fluid`, so the header stays in lockstep with the hero's top
padding: `--header-h = header-inset·--fluid + safe-top + header-row`, where `header-row` is
`header-height · --fluid-ui` on desktop and a flat CSS px on mobile (`--fluid-desktop-header-height`,
`--fluid-<band>-header-height`).

**`scale-max` caps `--fluid-ui` too, automatically.** Both units read the same private
`--_fluid-max` parameter, which the band block points at `--fluid-desktop-scale-max`. Setting that
one setting caps both — there is no separate ceiling to remember for ui, which is a real trap v1
had (§6 there needed its own `min(ceiling, …)` wrap on chrome, easy to forget). See §7.

**Intentional v2 change:** with `--fluid-desktop-fit-height: 0` (v1 `heightAxis: false`),
`--fluid-ui` now also ignores height — it shares `--fluid`'s height-arm input, which `fit-height 0`
disables. v1's chrome always read the height arm regardless of `heightAxis`, so a short wide window
kept the header at 1× while the layout grew. If you rely on the old asymmetry, note it when
migrating.

## 7. No ceiling (and when to set one)

Above the reference the whole composition (layout, type, pinned render, wordmarks) scales as one, so
a large display shows the drawn frame at a larger size instead of a fixed frame stranded in empty
space. CSS pixels are not device pixels, which keeps this tamer than it sounds:

| Display | `--fluid` | Section | Heading (64 drawn) | Body (16) |
|---|---|---|---|---|
| MacBook Pro 16" (1728×1117) | 1.10 | 990 | 70 | 18 |
| 27" 5K (2560×1440) | 1.50–1.60 | 1350–1440 | 96–102 | 24–26 |
| 32" Pro Display XDR | 1.78 | 1600 | 114 | 28 |

The real ceiling is asset resolution. Inline SVG scales perfectly; a 1920-wide raster upscales. Either
re-export at about 3000 wide or set `--fluid-desktop-scale-max` (unset by default — no ceiling). Both
`--fluid` and, by construction, `--fluid-ui` stop growing with it (§6); the type units stop with
`--fluid` too, since they are built from it. Check a specific viewport with
`fluid calc px 64 --unit display --at 3840x2160`, or `fluid explain 3840x2160`.

## 8. Configuration knobs and where they live

Two kinds, split by one rule (`config.md`): **structure** (`fluid.config.json`, needs
`fluid generate`) changes which CSS rules exist; **settings** (CSS variables, registered with
`@property`, live in your own `:root`) change a number inside those rules, no regenerate.

| What | v2 name | Kind |
|---|---|---|
| Reference viewport | `--fluid-desktop-base-width` / `-base-height` | setting (default 1440×900) |
| Where the desktop band switches on, and where the type knee sits (§5) | `bands.desktop.minWidth` | structure (default 1024) |
| Width-only vs both axes | `--fluid-desktop-fit-height` (1/0) | setting |
| Where a band's unit stops shrinking / growing | `--fluid-<band>-scale-min` / `-scale-max` | setting (desktop `-scale-max` unset = no ceiling) |
| Type damping, per band and role | `--fluid-<band>-<role>-damping` | setting |
| Type hard floor (optional) | `--fluid-<band>-<role>-floor` | setting, unset by default |
| Page container | `--fluid-<band>-container-width` / `-container-padding` | setting (§4) |
| Which type roles exist | `roles` | structure (default `["display", "copy"]`, §9) |
| The ui unit, on/off | `ui` | structure (default on, §6) |
| Browser-zoom compensation, on/off | `zoom` | structure (default on, §12) |
| Which bands exist, and their breakpoints | `bands.{phone,tablet,landscape,desktop}` | structure (§13) |

`--fluid` must stay purely proportional on both arms. Adding an intercept to "soften" it breaks §3's
fit guarantee — that applies whether you are tuning a setting or hand-writing a unit.

The full list, every default and every doc string: `references/config.md` (generated from
`scripts/lib/spec.mjs`, the one source of truth) or `fluid settings` for the live CSS-variable
reference against your own config.

## 9. Adding a role

A new type role is one array entry, not a hand-written formula:

```json
{ "roles": ["display", "copy", "eyebrow"] }
```

`fluid generate` then emits, for every band: `--fluid-<band>-eyebrow-damping` and `-eyebrow-floor`
settings (starting at `copy`'s defaults — mobile 0.6, desktop 0.33 — until you tune them), the
`--fluid-eyebrow` unit, the `fluid-eyebrow-*` Tailwind utility (with the `/lh` modifier), the SCSS
`fd.fluid-eyebrow($n)` function or StyleX `fluidEyebrow(n)` helper, and `fluidPx(n, 'eyebrow')` for
script. Nothing to write by hand; tune it afterwards the same way as `display`/`copy`
(`--fluid-desktop-eyebrow-damping: 0.5;` in your `:root`).

A role name may not collide with a word the system already uses as a unit, utility or setting —
`ui`, `text`, `container`, `scope`, `cap`, `build`, a band name, a spacing utility name (`p`, `w`,
`gap`, …). `fluid.config.json` validation rejects a collision with a did-you-mean.

A unit that needs a different reference or axis mix entirely is not a role — it cannot be a damping
of `--fluid`. Write it as its own `max(floor, min(…))`, on the ×1000 precision form (§3). It stays
outside `roles[]`, so `fluid check`'s settings lint does not know about it.

## 10. One scale: why sections may not re-anchor it (and what `fluid-scope` is actually for)

The tempting fix for a section drawn taller than 900 (1198, 987, 973 on the reference build) is to let it
declare its own drawn height as the reference, so `1198 × --fluid = 100svh` there. It was built
(`fluid-frame-N`), it worked, and **it was removed**.

- **Re-basing the base re-bases the type — in v1.** Custom properties substitute `var()` where they
  are *declared*. A v1 rule that set only `--fluid` on a section left `--fluid-display` resolving
  against `:root` (measured: `--fluid` reads 0.5 on the section while `--fluid-display` still reads
  0.862). A working re-base had to redeclare all three by hand.
- **`fluid-scope` fixes the mechanics, not the underlying problem.** Put class `fluid-scope` on an
  element and set any `--fluid-*` **setting** on it (`<section class="fluid-scope" style="--fluid-desktop-container-width: 1200">`).
  The engine writes its whole formula block on `:root, .fluid-scope` (§3), so every unit — `--fluid`,
  every role, `--fluid-ui`, the container — recomputes together inside that subtree from whatever
  settings are in scope. That is a real, supported way to give one section a different container
  width, a gentler type damping, or a different `scale-min` — the settings model working as intended.
  It does **not** make re-anchoring the reference height a good idea: setting
  `--fluid-desktop-base-height` on a `.fluid-scope` section still recomputes that section's whole
  scale consistently (the v1 mechanical bug is gone), but the *site-wide* guarantee — one proportional
  factor describing the whole page — is exactly what a per-section reference breaks. Two sections with
  different reference heights size the same drawn number differently for no reason a reader can name.
  That was `fluid-frame-N`, and it was removed for that reason, not because of the mechanical bug.
- **Declaring a unit directly is still wrong**, `fluid-scope` or not: `--fluid-desktop-base-height:
  700` on `.fluid-scope` goes through the setting and the formula still runs. `--fluid: 0.5` on any
  selector *replaces* the engine's formula outright — no clamp, no relationship to the other units —
  and `fluid check` warns on it.
- **Settings only apply on `:root` or `.fluid-scope`.** One set inside a media query, or on any other
  selector, either does nothing (bands already gate per viewport) or never applies. `fluid check`
  catches both (`scripts/lib/settings.mjs`).

So a section drawn taller than the artboard **is** more than one screen at every viewport, and the scale keeps
it a faithful proportional copy of the drawing. Making it fit is a drawing job: take the room out of
its padding (622 of one 1198-tall section was whitespace). A second sizing ladder inside a section
(for example a width-only `--stage` var with `xl:` rules) is the same mistake and must be removed.

## 11. Interop with animation (if any)

This skill ships no animation. If the companion `scroll-animation` skill (or any engine) animates
the page, four facts keep the two from fighting:

- **No property collides.** Animation writes `transform`/`opacity`; the scale writes `font-size`,
  `padding`, `gap`, `width` and `height`. The units recompute on resize only, never per frame and
  never during a scroll.
- **`fluid-translate-*` writes the independent `translate` property**, so it composes with
  Motion's per-frame `transform` instead of fighting it for one declaration.
- **GSAP is different: it folds `translate` in.** On its first tween of an element's transform
  (`x`, `y`, `scale`, `rotation`…), GSAP reads that element's CSS `translate`, `rotate` and `scale`,
  bakes them into its own `transform` and sets them to `none` inline. A plain percentage survives
  (as `xPercent`), so `translate: -50% 0` centring still works. A px or `calc()` value, which is
  every `fluid-translate-*`, is frozen at the size the page had at that moment; a later resize or
  a CSS-variable change is ignored. Measured on the Vite example (GSAP 3.15): every entrance-tweened
  element carried an inline `translate: none`, and a `calc()` drift on one of them never moved.
  With GSAP, put scaled offsets on a child or wrapper that GSAP never tweens.
- **Entrance offsets stay in fixed px.** Engines resolve `var()` once at animation start, so a scaled
  offset goes stale on resize. That is not worth it for a 24–40px offset.
- **Travel scales.** A drawn distance typed into motion code (`x: 600`, `end: '+=1800'`) is right
  only at the reference: at 2560×1440 it is 1.6× too short. Script reads the units through the
  generated `runtime/units.js` (from `assets/runtime/fluid-units.js`, re-exported by `fluid.ts`):
  `fluidPx(600)` is 600 drawn px in CSS px right now, `fluidPx(24, 'ui')` reads the ui unit
  (`'chrome'` accepted as the v1 alias), `fluidUnits()` returns all of them, `onFluidChange(cb)`
  fires when they change. It resolves them through a hidden probe element
  (`getPropertyValue('--fluid')` returns the formula text, not a number) and costs one layout read
  per change. The engine recipes (GSAP function values, Motion `useFluidUnit`, and the
  engine-neutral `--scene-p` pattern where CSS does the multiplying) are in the `scroll-animation`
  skill's `references/fluid-interop.md` §3, which ships a mirror of this file so it works alone.
- **A pin re-measures itself on `ResizeObserver` plus `resize`**, and reads the desktop breakpoint
  and `--header-h` from this skill's generated `fluid.ts` (`DESKTOP_PX`/`DESKTOP_QUERY`). Details:
  the `scroll-animation` skill, `references/scroll-scenes.md`.

## 12. Limitations

1. Below `bands.desktop.minWidth`, the mobile bands (§13) scale phones, tablets and phones-on-their-side
   off their own frames by default. `bands.phone: false` makes the unit a flat `1px` down there instead.
2. When width binds, a one-screen section is shorter than the window. That is fine over a pinned
   render, but it changes a pinned scene's act maths: 3.42 viewports at 1024×900 instead of 4.00.
3. **Type ignores the user's browser font-size setting from the desktop breakpoint up.** This is
   deliberate: type is anchored to the viewport so the composition keeps its proportions. Do not "fix" it
   with a rem-anchored twin. The font-size setting is not browser zoom; zoom is handled below.
4. Below the floors both arms go flat, and a `fluid-h-900` section stops matching the viewport. Windows that small
   are out of scope.
5. Resizing reflows type and remaps any pin. Scrolling never does.
6. Only a section drawn at the reference height gets the one-screen guarantee. Others scale without landing on `100svh`.

### Browser zoom (WCAG 1.4.4, resize text)

**The problem.** Desktop zoom (Cmd/Ctrl +) makes a CSS pixel bigger and shrinks the CSS viewport by
the same factor. A length built only from `vw`/`svh` shrinks by exactly that factor, so it renders
at the **same physical size at every zoom level**. `--fluid` has no px or rem term, so without help,
type does not grow at all until zoom pushes the CSS viewport below the desktop breakpoint and the mobile CSS
takes over. Where that happens depends on the window: about 141% on a 1440-wide window, 188% on 1920,
250% on 2560. Measured with real Chromium zoom, body text on an uncompensated build reached 100% of
its size at 150% zoom on 2560×1440, and 122% at 200%. That fails WCAG 1.4.4 on every display wider
than about 1440, and worst on the large displays this system is proudest of.

**The fix, on by default.** `zoom: true` in `fluid.config.json` (v1 `zoomCompensation`) emits `--fluid-z`: the
`--fluid` formula with each viewport arm multiplied by `var(--fluid-zoom, 1)` *inside* the same floor
and ceiling, and the two type units read it as their base instead of `--fluid`. The generated
`runtime/zoom.js` (from `assets/runtime/fluid-zoom.js`) detects the zoom factor and writes it to
`--fluid-zoom` on `<html>`. A viewport arm times the zoom is exactly its unzoomed value, and the clamp then
lands where it did at 100%, so each type unit resolves to the CSS px it had at 100% and renders z
times larger: **text zooms 1:1, floors and dampings included.** Measured on the same build after
installing it: 110/125/150/200% zoom gives 110/125/150/200% text wherever the desktop layout is
still active, at 1440, 1920 and 2560, with no horizontal overflow.

- **Only type is compensated.** `--fluid` (layout) and `--fluid-ui` stay as they are. Scaling
  the layout by the zoom would make the composition z times wider than the zoomed viewport. Instead
  the layout keeps fitting, and the larger text reflows inside its columns, which is what zoom is for.
- **`fluid-text-*` zooms by size** (`--fluid-zoom-text-full` / `--fluid-zoom-text-none`, settings,
  default 24 / 48): fully up to 24px drawn, not at all from 48px, linearly between. It is type
  inside a box that scales on `--fluid`, and that box does not zoom. Measured on the Vite example at
  2560×1440 and 200%: zooming it fully, the 200px hero title wrapped onto two lines and ran over the
  body copy beside it. Leaving it out entirely, the body copy that build sets in `fluid-text` (8 of
  its 14 type styles) did not zoom at all. By size, the title holds its one line and the copy
  doubles. The share is read from the font size for the line-height too, so a line box never zooms
  differently from its text (SCSS `fd.fluid-text($n, $size)`, StyleX `fluidText(n, size)`; the
  Tailwind `fluid-text-*` utility and its `/lh` modifier do it for you). Display, copy and a custom
  role always zoom fully: they sit in fixed measures and wrap.
- **Fixed ui does not move out of the way.** A fixed side tab or sticky bar keeps its size and
  position while the text beside it grows, so at 200% it can sit over copy it cleared at 100%
  (seen on the Vite example's reservation tab). Check fixed elements in the zoom screenshots.
- **Install it inline in `<head>`**, before first paint, or a page opened at a remembered zoom
  level renders small type and then jumps. `output.integration` generates the wiring: Next —
  `import { FluidHead } from '…/fluid/integrations/next'` → `<head><FluidHead /></head>`; Vite —
  `import { fluidPlugin } from './fluid/integrations/vite'` → `plugins: [fluidPlugin()]`; otherwise
  inline `FLUID_ZOOM_INLINE` from the generated `runtime/zoom.js` in a plain `<script>` at the top of
  `<head>` yourself. `runtime/zoom.d.ts` ships alongside it (TypeScript with `allowJs: false` needs
  the types).
- **How it detects zoom, and when it gives up.** No browser exposes the page zoom. Two signals carry
  it in Chromium and Firefox: `outerWidth / innerWidth`, and `devicePixelRatio` over the native ratio.
  Each is ambiguous alone (a side panel inflates the first; dpr 2 is a Retina screen or 200% on a 1x
  one), so zoom is accepted only when both agree within 4%. A side panel, docked devtools, an
  iframe, device emulation or a browser that keeps dpr fixed under zoom all read as 1, which is the
  old behaviour. It can fail to compensate; it does not inflate type on an unzoomed page. Zoom-out is
  not compensated. `outerWidth` reads 0 until the first frame in Chromium, so the script retries on
  the next frames.
- **Per engine, measured on real browsers (2026-09-24):**

  | Engine | Signal | Result |
  |---|---|---|
  | Chromium (Chrome, Edge, Arc, Brave, Opera) | `outerWidth/innerWidth` agreeing with `devicePixelRatio` | exact at 110–300% |
  | Safari 26 (macOS) | `outerWidth/innerWidth` snapped to Safari's steps, checked against the height | exact at 115, 125, 150, 175, 200% |
  | Firefox 146 | none reliable | not compensated (reads 1) |

  **Safari** keeps `devicePixelRatio` fixed, but `innerWidth` shrinks by exactly the zoom (ratios
  1.1507, 1.2506, 1.5000, 1.7500, 2.0000). The sidebar shrinks `innerWidth` too, but not
  `innerHeight`, so a width ratio is accepted only when the toolbar height it implies,
  `outerHeight − innerHeight × z`, is 0–150 points. That check is necessary: with the sidebar open at
  125% the width ratio was 1.5060, within 0.4% of Safari's 150% step, and the implied toolbar (−126)
  rejected it. Sidebar plus zoom therefore reads 1, which is safe but uncompensated. Measured by
  driving real Safari zoom and the sidebar through Cua Driver, reading `assets/runtime/zoom-debug.html`.

  **Firefox** reports `outerWidth` and `screen.width` in zoomed CSS px too, so zoom shows only in
  `devicePixelRatio`, mixed with the display's own ratio. Measured on real Firefox 146 (Retina,
  Cmd + driven through Cua Driver): `devicePixelRatio` 2, 2.222, 2.4, 2.609, 3, 3.333, 4 at 100, 110,
  120, 133, 150, 170, 200%, while `outerWidth/innerWidth` stayed at 1.01–1.05 throughout (the rest is
  Firefox's own sidebar). Firefox's steps overlap: 3 is Retina at 150% or 1× at 300%, 2.4 is Retina
  at 120% or 1× at 240%. The screen size cannot break the tie, because a Retina Mac in "Larger Text"
  mode reports what a 1× screen zoomed in does. A wrong factor inflates type, so Firefox reads 1.
  On Firefox, desktop-layout type on wide windows ignores zoom until the page falls through to
  mobile; the mobile bands make that step small. Say so before promising WCAG 1.4.4 to a client.
- **Check a browser yourself:** serve `assets/runtime/zoom-debug.html` next to `zoom.js`, open it,
  zoom, and read the live signals and the detected `--fluid-zoom` off the page.
- **The mobile handover.** When zoom pushes the CSS viewport below the desktop breakpoint, the page
  switches to a mobile band, and text becomes *mobile size × zoom*. On a window wider than the
  reference the desktop type had grown past its drawn size, so the handover is a step down. Measured:
  body copy drawn 15px on mobile against 17.65px on a 1920 desktop reached 170% at 200% zoom (255% at
  300%). Keep mobile body copy no smaller than its desktop reference size to shrink that step. The
  runtime cannot help here, because mobile type is plain px with nothing to multiply, unless the
  mobile band itself scales it (§13) — which softens the step further, see §13's last bullet.
- **Check it** with `fluid verify <url>`: its zoom row loads the page under real browser zoom
  and reports physical text growth (`verification.md`). To *see* a zoomed page, capture it through the
  DevTools protocol (`Page.captureScreenshot`); Playwright's own `page.screenshot` crops a zoomed
  page to its top-left 1/zoom and makes a fitting layout look cut off. `zoom: false` turns the unit
  change off; do that only with the client's informed agreement, and record it in `FLUID.md`.

## 13. The bands (phone / tablet / landscape / desktop)

On by default (`bands.phone: true`, and with it `tablet`/`landscape`: `false = a flat 1px below
desktop`, v1's only mobile behaviour). The **phone design scales off its own frame** in three bands,
and the desktop design keeps its own scale above the desktop breakpoint. The usual brief is a
desktop frame (1680 container, reference 1440×900) and a phone frame (390), with no tablet design;
this is built for that.

| Band | Media condition | Scales off | Clamp (settings) | Covers |
|---|---|---|---|---|
| phone | default | `100vw / --fluid-phone-base-width` (390) | `--fluid-phone-scale-min/-max` (0.82–1.10) | iPhone SE (320) to Pro Max (430) |
| tablet | `width >= bands.tablet.minWidth` (600) | `100vw / --fluid-tablet-base-width` (700) | `--fluid-tablet-scale-min/-max` (1.10–1.30) | portrait tablets: iPad mini 1.10, Air 1.17, Pro 11 1.19 |
| landscape | `(orientation: landscape) and (height <= bands.landscape.maxHeight)` (500) | `100vw / --fluid-landscape-base-width` (780) | `--fluid-landscape-scale-min/-max` (1.00–1.20) | a phone on its side: SE 1.00, 15 1.08, Pro Max 1.20 |
| desktop | `width >= bands.desktop.minWidth` (1024) | 1440×900, both axes | `--fluid-desktop-scale-min` (0.58–) | laptops, and **landscape tablets** (iPad 1024–1366 wide: 0.71–0.95) |

- **All three mobile bands run the same drawing.** Authors write the phone frame's numbers once
  (`fluid-py-48`, `fluid-display-44/48`); the bands only change what the unit is. No orientation
  variants, no tablet utilities. Rotating a phone swaps the unit in CSS and the page reflows.
- **Why landscape needs its own rule.** By width alone a phone on its side (844×390) and a portrait
  iPad (834×1194) are the same. Height separates them: under 500px tall is a phone. The landscape
  block is emitted after the tablet block so it wins when both match (a Pro Max on its side is 932
  wide) — `bandAt()` (`scripts/lib/model.mjs`) checks desktop, then landscape, then tablet, then phone.
- **Continuous, then one switch.** The phone band tops out at 1.10, exactly where the tablet band
  starts, and landscape never goes below 1.00, so rotating never shrinks the design. The only jump
  is at the desktop breakpoint, where the composition itself changes to the desktop one.
- **The container cap.** On tablet and landscape the frame is capped at
  `--fluid-<band>-container-width` drawn px (default 560, same setting family as the desktop
  container, §4 and §6) through the `fluid-container` utility: the phone composition is centred at
  616–728px instead of stretching its lines across an 834px screen. Full-bleed section colour stays
  full width because it is on the section, not the container. There is no dedicated off switch (v1's
  `column: null`) — set the band's `container-width` to match your desktop one to stop capping it.
- **Type damping is its own knob per band**, not shared. `--fluid-phone-display-damping`,
  `--fluid-tablet-display-damping` and `--fluid-landscape-display-damping` (and the `copy`
  equivalents) all start at the same default (display 0.85, copy 0.60) but tune independently — v1's
  `mobile.damping` was one value shared across all three. The desktop dampings (0.62 / 0.33) were
  tuned for a 0.58–1.0 range; across the phone band's 0.82–1.10 they leave type nearly static (body
  16 → 15.1 at 320). With the phone dampings type follows the layout more closely below 390: heading
  44 → 42.6 at 375 and 37.3 at 320, body 16 → 15.6 and 14.3. Above the reference, type grows with the
  layout as on desktop. Smallest drawn labels shrink too: draw phone labels at 12 or more, or raise
  `--fluid-phone-copy-damping` toward 0.33.
- **Why the clamps are narrow.** A phone composition stretched past about 1.3× reads as a toy, and
  outside a clamp the unit is plain px, so text zoom on the phone keeps working there.
- **A designed tablet.** If the designer draws one (say 834), author its numbers with `md:` (or
  `fluid-tablet:`) and set `bands.tablet.minWidth` plus the tablet settings to that frame:
  `--fluid-tablet-base-width: 834`, `--fluid-tablet-scale-min/-max` for the real range. Same
  primitive, a real reference instead of the held phone design.
- **Holding a band still.** `--fluid-<band>-scale-min` and `-scale-max` both set to the same number
  makes that band plain px; `bands.tablet: false` or `bands.landscape: false` leaves those screens on
  the phone band (held at its 1.10 cap).
- **Plain Tailwind still works per value.** `text-[15px]` stays 15px everywhere; the arm only moves
  what is written through `fluid-*`. Fluid on desktop with fixed breakpoints below is simply
  `bands.phone: false`.

Measured on `examples/pizza-next` (hero heading `fluid-display-44`, `lg:fluid-display-112/112`,
`fluid calc px 44 --unit display --at WxH`): phone 320 → 37.3, 375 → 42.6, 390 → 44.0 (reference), 430
→ 48.4; tablet 768 (iPad mini portrait) → 48.4, 820 (iPad Air portrait) → 51.5; landscape 844×390
(iPhone 15 landscape) → 47.6, 932×430 (Pro Max landscape) → 52.6; a landscape iPad at 1024×768 is
already the desktop band (`bandAt()` checks desktop first), at unit 0.821, so the desktop heading
(`lg:fluid-display-112`) reads 91.9px there instead. Both examples pass `fluid verify` in
Chromium/WebKit/Firefox plus a real-zoom row, with geometry identical to v1 at 9 of 10 device
viewports (`references/verification.md`).

- **Converting an existing site:** since v2 turns the phone band on by default, an existing site
  adopting this skill gets it without an extra setting — check the geometry is what you expect at
  390×844 before and after (the phone frame's unit is exactly 1 there, so moving mobile px to fluid
  utilities is a no-op). Remove `sm:`/`md:` size overrides that were never drawn: they are what makes
  a tablet jump. `bands.phone: false` opts back out to v1's flat behaviour.
- **Keep off it:** input font sizes (iOS zooms into a focused input under 16px; keep inputs at a fixed
  16px), text measures, borders, tracking, entrance offsets, icons of 24px and under.
- **What the arm does for zoom:** a desktop window zoomed past the breakpoint lands in these bands,
  where mobile type is up to 1.3× its drawn size, so the drop at the handover mostly closes
  (measured at 1920×1080 and 200%: 166% flat, 212% with the mobile bands on).

## 14. Traps

- `max()` instead of `min()` to combine the arms: cover, not contain, and text overflows.
- `dvh` in the unit: type resizes while the reader scrolls on mobile Safari.
- Anchoring the reference to the container width (1680) instead of the viewport (1440).
- An intercept in `--fluid` (`clamp(…, 1px)`, `a·vw + b`): `900 × --fluid` stops equalling `100svh`.
  (The mobile bands' `clamp(min, 100vw/base-width, max)` is not this: it has no intercept, and no
  height guarantee to keep.)
- With the mobile bands on (the default), a fluid input font size: iOS zooms into inputs under 16px (§13).
- Declaring a `--fluid-*` unit (`--fluid`, `--fluid-display`, …) yourself instead of the setting it is
  built from, `.fluid-scope` or not: it replaces the engine's formula outright, and the other units
  do not recompute with it. `fluid check` warns (§10).
- Setting a `--fluid-<band>-*` setting inside a media query, or on a selector that is not `:root` or
  `.fluid-scope`: it either does nothing (bands already gate per viewport) or never applies.
  `fluid check` catches both (§10).
- A length times a unit (`64px * var(--fluid)`): invalid, and the declaration drops silently.
- A hand-written unit that compares sub-pixel lengths in `min()`/`max()`: Firefox rounds the result to
  1/60px, up to 1.6% off per unit (§3). Compare ×1000 lengths and divide once.
- Not wiring up the browser-zoom script (`FluidHead`/`fluidPlugin`, or the inline `runtime/zoom.js`):
  vw/svh type does not grow under browser zoom, a WCAG 1.4.4 failure on wide displays (§12, Browser zoom).
- Multiplying anything already clamped by the zoom: the whole type unit (its px term already zooms:
  146% text at 125% on a 1440 window), or `--fluid` itself where the floor or ceiling binds (plain px
  there: measured 156% text at 125% on a 3840×2160 window with `--fluid-desktop-scale-max: 1.6`).
  Multiply the viewport arms, then clamp; that is `--fluid-z`.
- A custom role name that collides with a reserved word (`ui`, `text`, `container`, `scope`, `cap`,
  a band name, a spacing utility name): config validation rejects it with a did-you-mean (§9).
