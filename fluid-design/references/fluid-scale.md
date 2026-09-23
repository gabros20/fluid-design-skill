# The fluid scale: one measured unit, two derived type units

Read when: setting up units, changing `fluid.config.json`, adding a new unit role, or explaining the maths.
Skip when: you are only building a section. `section-recipe.md` is the checklist for that.

## Contents
1. The problem it solves
2. The model: drawn number × unit
3. The base unit and its two arms
4. The reference is a viewport, not the canvas
5. The type units and their floors
6. The chrome unit
7. No ceiling (and when to set one)
8. Configuration knobs and how each derives
9. Adding a role
10. One scale: why sections may not re-anchor it
11. Interop with animation (if any)
12. Limitations, and browser zoom
13. The mobile arm (optional)
14. Traps

---

## 1. The problem it solves

A section built at the numbers of a 1680×900 frame is that size on every screen. It fails on both axes:

- **Height.** A 900px section sits 160px past the bottom edge of the glass in a 1440×740 window. A pinned scene's last act ends
  below the fold.
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

At 1440×900 the result is 64px, exactly the drawn value. At 1440×700 the unit is about 0.88 and the result is 56.3px.
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

If a value must be a plain length below the breakpoint and a scaled one above it, keep two tokens.
`scripts/audit.mjs` flags this (`length-times-unit`), and the SCSS functions `@error` on it.

## 3. The base unit and its two arms

```css
--fluid: max(0.58px, min(calc(100svh / 900), calc(100vw / 1440)));
```

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
- **Floor 0.58** was *chosen*, not derived: "structure stops compressing at a 522px-tall section".
  It is nearly unreachable, because at 1024 wide the width arm is already 0.711.

Below `engageAt` all units are a flat `1px`. Mobile is untouched on purpose: below the breakpoint,
sections stack and scroll, so there is nothing to fit.

## 4. The reference is a viewport, not the canvas

This is the most surprising part of the system, and the part most likely to be "fixed" wrongly.

The height reference matches the drawing: frames are 900 tall and the arm divides by 900. The width
reference does not: frames are 1680 wide, but the arm divides by **1440**. So a number read from
Figma means "this size at 1440 wide", not "this size in a 1680 frame, scaled". Between 1440 and 1680
the factor stays pinned at 1.0 by the height arm, and the composition just gains room.

The drawing is a wider shape than the screen (1.87:1 against 1.60:1), and a contain fit has to
letterbox one axis. There is no third answer:

| | Horizontal | Vertical |
|---|---|---|
| **1440 reference (this system)** | 240px of drawn content does not fit | sections fill the window exactly |
| 1680 reference + scaled gutters | pixel-exact at every width | a 771px section in a 900px window |

The second option was modelled and **rejected twice**. It shrinks every rendering already approved at 1440 by
14%, and it breaks `900 × --fluid = 100svh` across most of the range. That guarantee is load-bearing:
it is what makes a four-act pinned scene exactly 4.00 viewports long.

**Practical consequence: treat 1440 as a content budget, not a canvas.** Drawn content must fit
`reference.width − 2 × gutter` (1280) at full size. The outer 400px is air a wide screen gains, not
space to compose in. Check it with `scripts/calc.mjs budget`. A row over budget is fixed in the drawing
(take the difference out of the whitespace, with design sign-off) or with `cqw`
(`frame-and-gutter.md`), never by changing the divisor.

## 5. The type units and their floors

Things do not compress equally: halving a section's padding is invisible, and halving 14px body copy
makes it unreadable. Each type unit is a **damping of `--fluid`**:

```css
--fluid-display: max(0.82px, var(--fluid), calc(0.62 * var(--fluid) + 0.38px));
--fluid-copy:    max(0.90px, var(--fluid), calc(0.33 * var(--fluid) + 0.67px));
```

Read `0.62` as "display type shrinks at 62% of the rate the layout does". There are three arms, and which one wins
**is** the behaviour:

| Arm | Wins when | Result |
|---|---|---|
| floor | tiny windows | shrinking stops |
| `var(--fluid)` | above the reference | proportional growth |
| damped | below the reference | gentle shrink |

- **Damping is a shrinking idea only.** Extended upward, type would grow slower than its own frame,
  which loosens the type-to-column ratio that governs line breaks. Above the reference every length
  shares one factor, so wrap points match the frame by construction.
- **The design point is exact for any damping**, since `d·1 + (1−d) = 1`.
- **Two dampings, because one fails both ways.** Measured: 0.45 blows the heading to five lines at
  1024×900; 0.55 takes body copy to 13.5px at 1440×640. 0.62 and 0.33 hold four lines and 14.5px.
- **Floors are derived, not picked.** Each floor is the value its curve reaches at the engage
  breakpoint (`d · engageAt/W + (1−d)`). At the defaults: `0.62·0.711+0.38 = 0.82`, and
  `0.33·0.711+0.67 = 0.90`. So each role hands over to the mobile layout at exactly the value it
  reached. In drawn px that means heading 64 → 52.5, body 16 → 14.4, and the smallest run 14 → 12.6. The generator
  computes this (`floor: "auto"`).
- **A known knee:** the type floors engage at f ≈ 0.70 while the base keeps going to 0.58, so
  between those values type is flat while layout still compresses. This only bites under a 639px-tall window.

Resolved factors at the defaults (reproduce with `scripts/calc.mjs table`):

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

## 6. The chrome unit

Site chrome (header row, menu type, dropdowns, footer links) is not section composition. When height
binds on a short-but-wide window, the layout unit correctly shrinks section frames, but the same shrink
made the nav and footer look undersized without buying any fit.

```css
--fluid-chrome: min(calc(100vw / 1440), max(1px, calc(100svh / 900)));
/* width always; height never pulls it below the design point */
```

| Window | `--fluid` | `--fluid-chrome` |
|---|---|---|
| 1440×700 (short, wide) | 0.78 | **1.00** |
| 1024×900 (narrow, tall) | 0.71 | **0.71** (the nav still has to fit) |
| 2560×1440 | 1.60 | 1.60 |

It has no utility family: call sites spend it the long way, `lg:h-[calc(48*var(--fluid-chrome))]`.
The page rail (cap and gutter) and the header's inset from the top stay on `--fluid`, so the header
stays in lockstep with the hero's top padding.

**`ceiling` also caps `--fluid-chrome`.** Chrome does not read `var(--fluid)` (it has
its own formula, not a damping of the base unit), so a `ceiling` on `--fluid` does nothing to it by
itself: `--fluid-chrome` is wrapped in its own `min(<ceiling>px, …)`. Without this, chrome keeps
growing past the point every other role on the page stopped — measured at 3840×2160 with `ceiling:
1.6`: the hero headline (on the ceiling-capped `--fluid-display`) held at 320px while a footer
wordmark on `fluid-chrome(200)` reached 480px, 1.5× past everything beside it, on exactly the
screens a ceiling exists to tame. Chrome still ignores the *floor* (`units.fluid.floor`) — only the
ceiling half of "independent of floor/ceiling" changed; chrome's own `max(1px, heightArm)` clause
already does the floor's job for it. See §7.

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
re-export at about 3000 wide or set `ceiling`. The generator then emits `min(<ceiling>px, …)` on the
base unit, and the type units stop with it — and, separately, `min(<ceiling>px, …)` on
`--fluid-chrome` too (§6), since chrome does not read `var(--fluid)` and would
otherwise keep growing past the cap on the very displays that set it.

## 8. Configuration knobs

| Knob | Default | Effect |
|---|---|---|
| `reference` | 1440×900 | Where one unit is 1px. The two divisors in `--fluid`. **Not a free knob; see §4.** |
| `engageAt` | 1024 | Where the scale turns on. Also where the auto floors are measured. |
| `units.display.damping` / `units.copy.damping` | 0.62 / 0.33 | How fast type shrinks relative to layout. Lower is gentler. |
| floors | 0.58 / auto / auto | Where a unit stops shrinking. `auto` is the handover value at `engageAt`. |
| `ceiling` | null | Caps growth. |
| `heightAxis` | true | `false` makes the scale width-only: `max(floor, 100vw/W)`. |
| `canvas.width`, `canvas.gutter` | 1680, 80 | The frame cap and page gutter, used by the frame class and the budget check. |

`--fluid` must stay purely proportional on both arms. Adding an intercept to "soften" it breaks §3's
fit guarantee.

## 9. Adding a role

A new unit is one line. Pick a damping and a floor:

```css
/* UI chrome that barely moves: 0.15 → 85% of the way to "not fluid at all". */
--fluid-ui: max(0.92px, var(--fluid), calc(0.15 * var(--fluid) + 0.85px));
```

Add one `@utility` (or one SCSS function) only if it needs a class. A unit that needs a different
reference or axis mix cannot be a damping of `--fluid`: write it as its own
`max(floor, min(…))`.

## 10. One scale: why sections may not re-anchor it

The tempting fix for a section drawn taller than 900 (1198, 987, 973 on the reference build) is to let it
declare its own drawn height as the reference, so `1198 × --fluid = 100svh` there. It was built
(`fluid-frame-N`), it worked, and **it was removed**.

- **Re-basing the base re-bases the type.** Custom properties substitute `var()` where they are
  *declared*. A rule that sets only `--fluid` on a section leaves `--fluid-display` resolving against
  `:root` (measured: `--fluid` reads 0.5 on the section while `--fluid-display` still reads 0.862). A
  working re-base therefore has to redeclare all three.
- **Type then follows its neighbour's height.** Three identical drawn 64px headings rendered at 64,
  60.5 and 54.9px on one page in one window. A reader sees type change size for no nameable reason.

So a section drawn taller than 900 **is** more than one screen at every viewport, and the scale keeps
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
  only at the reference: at 2560×1440 it is 1.6× too short. Script reads the units with
  `assets/runtime/fluid-units.js`: `fluidPx(600)` is 600 drawn px in CSS px right now, `fluidUnits()`
  returns all four, `onFluidChange(cb)` fires when they change. It resolves them through a hidden
  probe element (`getPropertyValue('--fluid')` returns the formula text, not a number) and costs one
  layout read per change. The engine recipes (GSAP function values, Motion `useFluidUnit`, and the
  engine-neutral `--scene-p` pattern where CSS does the multiplying) are in the `scroll-animation`
  skill's `references/fluid-interop.md` §3, which ships a mirror of this file so it works alone.
- **A pin re-measures itself on `ResizeObserver` plus `resize`**, and reads the engage breakpoint and
  `--header-h` from this skill's config. Details: the `scroll-animation` skill, `references/scroll-scenes.md`.

## 12. Limitations

1. Desktop only by default (below `engageAt` the unit is 1px). The optional mobile arm (§13)
   scales phones off their own frame.
2. When width binds, a one-screen section is shorter than the window. That is fine over a pinned
   render, but it changes a pinned scene's act maths: 3.42 viewports at 1024×900 instead of 4.00.
3. **Type ignores the user's browser font-size setting from the breakpoint up.** This is deliberate:
   type is anchored to the viewport so the composition keeps its proportions. Do not "fix" it
   with a rem-anchored twin. The font-size setting is not browser zoom; zoom is handled below.
4. Below the floors both arms go flat, and a `fluid-h-900` section stops matching the viewport. Windows that small
   are out of scope.
5. Resizing reflows type and remaps any pin. Scrolling never does.
6. Only a section drawn at the reference height gets the one-screen guarantee. Others scale without landing on `100svh`.

### Browser zoom (WCAG 1.4.4, resize text)

**The problem.** Desktop zoom (Cmd/Ctrl +) makes a CSS pixel bigger and shrinks the CSS viewport by
the same factor. A length built only from `vw`/`svh` shrinks by exactly that factor, so it renders
at the **same physical size at every zoom level**. `--fluid` has no px or rem term, so without help,
type does not grow at all until zoom pushes the CSS viewport below `engageAt` and the mobile CSS
takes over. Where that happens depends on the window: about 141% on a 1440-wide window, 188% on 1920,
250% on 2560. Measured with real Chromium zoom, body text on an uncompensated build reached 100% of
its size at 150% zoom on 2560×1440, and 122% at 200%. That fails WCAG 1.4.4 on every display wider
than about 1440, and worst on the large displays this system is proudest of.

**The fix, on by default.** `zoomCompensation: true` in `fluid.config.json` makes the two type units
read their base as `var(--fluid) * var(--fluid-zoom, 1)`. `assets/runtime/fluid-zoom.js` detects the
zoom factor and writes it to `--fluid-zoom` on `<html>`. Multiplying the zoomed-down `--fluid` by the
zoom gives back exactly the unzoomed value, so each type unit resolves to the CSS px it had at 100%
and renders z times larger: **text zooms 1:1, floors and dampings included.** Measured on the same
build after installing it: 110/125/150/200% zoom gives 110/125/150/200% text wherever the desktop
layout is still active, at 1440, 1920 and 2560, with no horizontal overflow.

- **Only type is compensated.** `--fluid` (layout) and `--fluid-chrome` stay as they are. Scaling
  the layout by the zoom would make the composition z times wider than the zoomed viewport. Instead
  the layout keeps fitting, and the larger text reflows inside its columns, which is what zoom is for.
- **`fluid-text-*` zooms by size** (`zoomTextRange`, default `[24, 48]`): fully up to 24px drawn,
  not at all from 48px, linearly between. It is type inside a box that scales on `--fluid`, and that
  box does not zoom. Measured on the Vite example at 2560×1440 and 200%: zooming it fully, the 200px
  hero title wrapped onto two lines and ran over the body copy beside it. Leaving it out entirely,
  the body copy that build sets in `fluid-text` (8 of its 14 type styles) did not zoom at all. By size,
  the title holds its one line and the copy doubles. The share is read from the font size for the
  line-height too, so a line box never zooms differently from its text (SCSS `fluid-text($lh, $size)`,
  StyleX `fluidText(lh, size)`; `fluid-type()` and the Tailwind `/lh` modifier do it for you).
  Display and copy always zoom fully: they sit in fixed measures and wrap.
- **Fixed chrome does not move out of the way.** A fixed side tab or sticky bar keeps its size and
  position while the text beside it grows, so at 200% it can sit over copy it cleared at 100%
  (seen on the Vite example's reservation tab). Check fixed elements in the zoom screenshots.
- **Install it inline in `<head>`**, before first paint, or a page opened at a remembered zoom
  level renders small type and then jumps. Next: `<script dangerouslySetInnerHTML={{ __html:
  FLUID_ZOOM_INLINE }} />`; anywhere else, the same string in a plain `<script>`. Copy both
  `fluid-zoom.js` and `fluid-zoom.d.ts` (TypeScript with `allowJs: false` needs the types).
- **How it detects zoom, and when it gives up.** No browser exposes the page zoom. Two signals carry
  it in Chromium and Firefox: `outerWidth / innerWidth`, and `devicePixelRatio` over the native ratio.
  Each is ambiguous alone (a side panel inflates the first; dpr 2 is a Retina screen or 200% on a 1x
  one), so zoom is accepted only when both agree within 4%. A side panel, docked devtools, an
  iframe, device emulation or a browser that keeps dpr fixed under zoom all read as 1, which is the
  old behaviour. It can fail to compensate; it does not inflate type on an unzoomed page. Zoom-out is
  not compensated. `outerWidth` reads 0 until the first frame in Chromium, so the script retries on
  the next frames. Verified with real Chromium zoom; **Safari and Firefox are unverified**, so check
  them on the real browser before promising compliance to a client.
- **The mobile handover.** When zoom pushes the CSS viewport below `engageAt`, the page switches to
  its mobile CSS, and text becomes *mobile size × zoom*. On a window wider than the reference the
  desktop type had grown past its drawn size, so the handover is a step down. Measured: body copy
  drawn 15px on mobile against 17.65px on a 1920 desktop reached 170% at 200% zoom (255% at 300%).
  Keep mobile body copy no smaller than its desktop reference size to shrink that step. The runtime
  cannot help here, because mobile type is plain px with nothing to multiply.
- **Check it** with `scripts/verify-matrix.mjs`: its zoom row loads the page under real browser zoom
  and reports physical text growth (`verification.md`). To *see* a zoomed page, capture it through the
  DevTools protocol (`Page.captureScreenshot`); Playwright's own `page.screenshot` crops a zoomed
  page to its top-left 1/zoom and makes a fitting layout look cut off. `zoomCompensation: false` turns the unit
  change off; do that only with the client's informed agreement, and record it in `FLUID.md`.

## 13. The mobile arm (optional)

Off by default. With `mobile.enabled`, the units stop being a flat 1px below `engageAt`:

```css
:root { --fluid: clamp(0.85px, calc(100vw / 390), 1.25px); }   /* mobile.min, mobile.reference, mobile.max */
```

- **Width only.** Below the breakpoint sections stack and scroll, so there is nothing to fit on the
  height axis, and a height term would make type move with the phone's toolbar.
- **Clamped both ways.** The phone frame is drawn at `reference` (390). At 360 the unit is 0.92, at
  430 it is 1.10. It stops shrinking at `min` (0.85, a 331px screen) and stops growing at `max` (1.25,
  from 488px), so the tablet band (768–1023) shows the phone composition at 1.25× instead of a phone
  layout stretched 2.6×. If the design has its own tablet frame, author it with `sm:`/`md:` values as
  before; those stay plain px unless you write them as fluid too.
- **The type units damp it** like the desktop ones (0.62 / 0.33), with floors read at `min`: body
  copy drawn 16 is 15.6px on a 360 phone rather than 14.8px. Chrome uses `--fluid` directly.
- **Browser zoom** is compensated the same way as on desktop (§12), inside the clamp.

**What it changes for authoring.** The unprefixed utility becomes the phone frame's drawn number and
`lg:` takes the desktop frame's:

```html
<section class="fluid-py-48 lg:fluid-py-120">
<h2 class="fluid-display-40/44 lg:fluid-display-64/72">
```

Both numbers come straight from their frames. Without the arm the mobile half is `py-12` or
`py-[48px]`, correct only at the width it was checked at.

- **At the reference width nothing moves.** The unit is exactly 1 at 390, so converting an existing
  site's mobile px to fluid utilities is visually a no-op at 390 and only changes the other widths.
  That is the check for a conversion: element geometry at 390×844 identical before and after.
- **Keep off it:** input font sizes (iOS zooms into a focused input under 16px, and a fluid 16 is
  15.6 on a 360 phone; keep inputs at a fixed 16px), text measures, borders, radii, tracking,
  entrance offsets, icons of 24px and under.
- **Validated on the Next example** (`examples/pizza-next`, about 100 mobile values in 8 files):
  geometry of all 247 elements at 390×844 identical before and after the conversion; the full matrix
  including 360×780, 430×932 and 768×1024 passes (no overflow, units match the maths); reveals and
  the pinned scene pass at 360, 390 and 768.
- **What the arm does for zoom:** a desktop window zoomed past the breakpoint falls into the mobile
  CSS. With the arm, that CSS sits at `max` on such a wide CSS viewport, so mobile type there is 1.25×
  its drawn size and the drop at the handover closes: measured on the Next example, body copy at
  1920×1080 and 200% went from 166% (flat mobile) to 212% (mobile arm).

## 14. Traps

- `max()` instead of `min()` to combine the arms: cover, not contain, and text overflows.
- `dvh` in the unit: type resizes while the reader scrolls on mobile Safari.
- Anchoring the reference to the canvas (1680) instead of the laptop viewport (1440).
- An intercept in `--fluid` (`clamp(…, 1px)`, `a·vw + b`): `900 × --fluid` stops equalling `100svh`.
  (The mobile arm's `clamp(min, 100vw/390, max)` is not this: it has no intercept, and no height
  guarantee to keep.)
- With the mobile arm on, a fluid input font size: iOS zooms into inputs under 16px (§13).
- Overriding `--fluid` on one section: the type units resolved at `:root` do not re-derive (§10).
- A length times a unit (`64px * var(--fluid)`): invalid, and the declaration drops silently.
- A `ceiling` on `--fluid` expecting it to cap chrome: `--fluid-chrome` is its own formula (§6).
- Shipping without `fluid-zoom.js`: vw/svh type does not grow under browser zoom, a WCAG 1.4.4
  failure on wide displays (§12, Browser zoom).
- Multiplying the whole type unit by the zoom instead of its `--fluid` base: the unit's px term
  already zooms, so the text overshoots (146% at 125% zoom on a 1440 window, by the unit maths).
