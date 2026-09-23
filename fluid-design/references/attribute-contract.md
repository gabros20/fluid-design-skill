# Attribute contract

**Read when:** you need the exact, engine-neutral vocabulary this skill ships — a config key, an
emitted custom property, a `fluid-*` utility name, a `data-*` attribute, a motion constant, or a
CSS variable that carries a distance or a scalar range — and you want the name checked against what
actually ships, not remembered from a planning doc.
**Skip when:** you already know the name and just need the *why* behind it — that lives in
`fluid-scale.md` (units/config), `stacks.md` (per-stack authoring surface), `motion-architecture.md`
and `scroll-scenes.md` (motion/scroll behaviour), or `tokens-and-theming.md` (design tokens, a
separate vocabulary from this one).
**Depends on:** nothing. This is the leaf reference every other doc in this skill cites for exact
names, which is also why it exists on its own rather than folded into one of them.

Every name below was checked against the shipped code in `assets/motion/react-motion` and
`assets/motion/gsap`, and against `scripts/generate-fluid.mjs` / `scripts/lib/fluid-math.mjs` for
the CSS side, as of the version of this skill you are reading. If a name here ever stops matching
the code, the code is the source of truth — file that as a doc bug against this page, not against
the primitive.

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
  "ceiling": null
}
```

| Key | Meaning |
|---|---|
| `prefix` | utility/class-name and (SCSS) function/mixin prefix; renames `fluid-*` utilities, the `.fluid-frame` class and the `fluid()`-family Sass identifiers. Does **not** rename `--fluid*` custom properties — those are fixed, see §1 below |
| `reference.width` / `reference.height` | the viewport where 1 unit = 1px — a content budget, not the design canvas (`fluid-scale.md` §2) |
| `canvas.width` | the drawn frame width, emitted as the `fluid-cap-*` grow-only ceiling |
| `canvas.gutter` | the drawn page gutter, for documentation/example use; not baked into a custom property by itself |
| `engageAt` | the min-width (px) where the scale turns on; below it every unit is a flat `1px`. Must be `<= reference.width` |
| `heightAxis` | `true` (default): `--fluid` takes `min(width arm, height arm)`. `false`: width-only, for sites with no one-screen sections |
| `units.fluid.floor` | hard floor in px-equivalent below which `--fluid` stops shrinking (default 0.58) |
| `units.display.damping` / `units.copy.damping` | rate the type unit shrinks relative to `--fluid`, in (0, 1] |
| `units.display.floor` / `units.copy.floor` | `"auto"` = `round2(damping * engageAt/reference.width + (1 - damping))` (0.82 and 0.90 at the shipped defaults) — or a number override |
| `units.chrome.enabled` | emit `--fluid-chrome`, a width-fit/height-floored fourth role for site chrome. Default `true` |
| `ceiling` | `null` (default) = uncapped growth. A number N wraps `--fluid` in `min(Npx, …)`; the type units inherit the cap through it |

### Emitted custom properties

Fixed names — `scripts/lib/fluid-math.mjs`'s `cssUnits()` is the single source, and every stack
generator (`tailwind-v4`, `css`, `scss`, `stylex`) calls it rather than re-deriving these strings.
Only utility/class *names* move with `prefix`; these do not.

```
--fluid          max(<floor>px, min(calc(100svh / H), calc(100vw / W)))      [heightAxis:false → max(floor, 100vw/W)]
--fluid-display  max(<dfloor>px, var(--fluid), calc(d * var(--fluid) + (1-d)px))
--fluid-copy     max(<cfloor>px, var(--fluid), calc(c * var(--fluid) + (1-c)px))
--fluid-chrome   min(calc(100vw / W), max(1px, calc(100svh / H)))            [only emitted when units.chrome.enabled]
--safe-top       env(safe-area-inset-top, 0px)
--safe-bottom    env(safe-area-inset-bottom, 0px)
--browser-bar    calc(100lvh - 100svh)
--header-h       calc(24 * var(--fluid) + var(--safe-top) + <rowH>)   (rowH: 34px below engageAt, 48*var(--fluid-chrome) above when chrome is enabled, else 48*var(--fluid); overridable)
```

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
- translate: `fluid-translate-x/y-*` (writes the `translate` property, not `transform`)
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

## 3. DOM attribute contract

Shared by the React/Motion and GSAP primitives, the verifier and the docs. GSAP is attribute-driven
end to end — it has no props API, so every knob a React consumer would pass as a component prop is
instead a `data-*` attribute GSAP's `init*` functions read off the DOM at mount. React exposes the
same *behaviour* through component props (`<Stage trigger="view" />`, `<StageItem variant="lift" />`)
and only emits the subset of attributes below that something still needs to query from outside React
— CSS (the pre-JS resting state, reduced motion), the `<noscript>` safety net, or the verification
harness. The **On** column calls out where an attribute is GSAP-only.

| Attribute | On | Meaning |
|---|---|---|
| `data-stage="view"\|"mount"` | a triggered entrance group | GSAP-only: `view` fires on scroll-in, `mount` fires immediately. React's `Stage` takes the same choice as the `trigger` prop and emits no attribute for it |
| `data-stage-margin` / `data-stage-margin-lg` | a stage | GSAP-only: IntersectionObserver `rootMargin`; `-lg` overrides from `ENGAGE_QUERY` up. React's `Stage` takes `margin`/`marginLg` props |
| `data-stage-repeat` | a stage | GSAP-only: presence replays the group on every re-entry instead of once. React's `Stage` takes a `repeat` prop |
| `data-stage-item` | an item SSR'd in its hidden state | both engines: required for the pre-JS hidden state and the `<noscript>` override. React's `StageItem` always emits `data-stage-item=""` |
| `data-variant` | a stage item | GSAP-only, on the DOM: `drop \| settle \| settleFade \| lift \| liftFade \| growY \| growX`. React's `StageItem` takes the same values as the `variant` prop |
| `data-delay` | a stage item | GSAP-only, on the DOM: seconds after the stage fires. React's `StageItem` takes a `delay` prop (default 0) |
| `data-stage-veil` | the page-load overlay | both engines: self-driving: fades on mount regardless of any stage. React's `StageVeil` always emits `data-stage-veil=""` |
| `data-count-up="<value>"` | a number | GSAP-only: counts 0→value on first ~60% visible; static text must hold `<value>`. React's `CountUp` takes a `value` prop |
| `data-fade-on-exit` | a group | GSAP-only: fades out as it scrolls above the viewport, tuned with `--exit-from`/`--exit-to`. React's `FadeOnExit` reads the same two CSS variables directly, no attribute needed |
| `data-pull-to-centre` | a marker, first child of the box to attract | GSAP-only: optional `data-clamp` (selector), `data-threshold`, `data-threshold-lg`. React's `PullToCentre` takes `clamp`/`threshold`/`thresholdLg` props |
| `data-scrub-stage` | a scroll scene's range wrapper | both engines: the outer element the scrub logic measures. React's `ScrubStage` always emits it |
| `data-scrub-pin` | the sticky pinned layer, inside the range wrapper | both engines: CSS owns the pin's resting geometry (see `motion.css` for GSAP; `shared/base.css`'s reduced-motion collapse for both). React's `ScrubStage` emits it on the `position: sticky` div — see the note below on why that div's other styles stay inline |
| `data-scrub-video` | the `<video>` inside the pin | GSAP-only: `data-src`/`data-mobile-src`, `poster`/`data-mobile-poster` drive tier selection; GSAP's `motion.css` also styles the box off this attribute. React's `ScrubStage` positions and sizes its `<video>` with an inline `style` and a `src` prop instead — no `data-scrub-video` on the React port |
| `data-scrub-gutter` | optional backdrop element, inside the pin | GSAP-only, on the DOM: painted from `backdropStops`. React's `ScrubStage` targets the same backdrop element with a `ref`, not an attribute |
| `data-scrub-content` | the flow wrapper riding over the pin | both engines: cancels the pin's height contribution (a `-100lvh` margin) — also the reduced-motion reset target (`margin-top: 0`). React's `ScrubStage` emits it on that wrapper div |
| `data-scrub-spacer` | an empty pacing act inside `data-scrub-content` | both engines: marks an act with no camera move or copy of its own — added only to give the full-motion composition room to linger — so `shared/base.css`'s reduced-motion collapse can zero its height instead of leaving a blank band the length of that act (measured: an unmarked 2-viewport spacer left 1800px of empty dark band under reduced motion). Neither engine emits this on its own; author it by hand on any act that is genuinely just spacing. See `references/scroll-scenes.md` §10 |
| `data-scrub-frame="<scoped id>"` | React only: the `<video>`, when a `camera` is supplied | scopes a per-instance `<style>` tag that sets `--frame-w`/`--frame-h` from a media query (`useId()`-based), so two `ScrubStage`s on one page never share a rule. Has no GSAP counterpart — GSAP's `scrubStage.ts` sizes the video from its own options object directly |
| `data-motion-state` | a machine root (the scrub video) | both engines: current mode (`head \| scrub \| tail`), written only on transition, never per frame |
| `data-header-theme="light"\|"dark"` | a section | both engines: what a themed header should read while this section is under it; `--header-theme` overrides it per breakpoint |
| `data-loop-video` | a background loop `<video>` | GSAP-only: optional `data-loop-from-frame` + `data-fps` for the seam-loop policy. React's `InViewLoopVideo` takes the same as props |

### `data-scrub-pin`: the one place an engine difference bites

React's `ScrubStage` writes the pin's `position: sticky; top: 0; height: 100lvh; width: 100%;
overflow: hidden` as an inline `style`, not through a class. An inline style beats **any**
non-`!important` stylesheet declaration, regardless of selector specificity or source order — so
the reduced-motion structural collapse (`shared/base.css`, generated by
`scripts/generate-fluid.mjs`) declares its three rules `!important`:

```css
@media (prefers-reduced-motion: reduce) {
  [data-scrub-stage]   { height: auto !important; }
  [data-scrub-pin]     { position: static !important; height: auto !important; overflow: visible !important; }
  [data-scrub-content] { margin-top: 0 !important; }
}
```

The alternative — moving the pin's geometry into a scoped `<style>` tag the way `--frame-w`/
`--frame-h` are (see `data-scrub-frame` above) — was rejected here: that pattern earns its keep when
the value is *per-instance* (the frame size varies with `camera.frameSize`), and it still only wins
the cascade if its `<style>` tag is guaranteed to load after the global reduced-motion rule, which
is an ordering assumption this skill does not want to make. The pin's `position`/`height`/`overflow`
are the same on every instance, so `!important` on the one shared rule is both simpler and more
robust than trying to out-order a per-instance tag.

GSAP's own `motion.css` uses the identical selectors and the identical `!important` reasoning for
the same collapse, so both engines end up structurally identical under reduced motion even though
only one of them is fighting an inline style to get there.

### Distances and scalar ranges

Not attributes — CSS custom properties set on the animated element itself, read by both engines'
variant/transform code:

| Variable | Carries | Default (both engines) |
|---|---|---|
| `--hero-drop` | signed length, `drop` variant | `-96px` |
| `--hero-settle` | signed length, `settle`/`settleFade` variants | `-24px` |
| `--hero-lift` | signed length, `lift`/`liftFade` variants | `32px` |
| `--exit-from` | scalar in [0, 1], `FadeOnExit` — where the fade starts | see `FadeOnExit`'s own default |
| `--exit-to` | scalar in [0, 1], `FadeOnExit` — where the fade ends (fully hidden) | see `FadeOnExit`'s own default |

## 4. Motion constants (identical in both engines)

Source of truth: `assets/motion/react-motion/lib/transitions.ts` + `lib/constants.ts` +
`lib/triggers.ts` + `lib/scroll.ts` (React), mirrored in `assets/motion/gsap/src/eases.ts` (GSAP).

- `entrance`: 1.3s, `cubic-bezier(0.15, 0.6, 0.2, 1)` — measured, frame-fitted; do not turn into a spring
- `entranceFade`: 0.17s, delay 0.13s, linear
- `veil`: 0.13s, delay 0.17s, linear
- `roll`: 0.3s, `cubic-bezier(0, 0, 0.58, 1)`
- `disclosure`: 0.24s, `cubic-bezier(0.23, 1, 0.32, 1)`
- `indicator`: spring, duration 0.35s, `bounce: 0` (GSAP approximates with `power3.out` at the same duration — not a measured fit)
- line stagger (`lineStagger`): 0.067s
- `REVEAL_TRIGGER`: `0px 0px -20% 0px`; `PAGE_END_TRIGGER`: `0px`; `AT_REST_TRIGGER`: `0px`
- `scrollSpring`: stiffness 120, damping 30, restDelta 0.001
- `ENGAGE_BREAKPOINT_PX`: 1024 (must match `fluid.config.json`'s `engageAt`, Tailwind's
  `--breakpoint-lg`, and SCSS's `$fluid-engage-at`)

## 5. Where this doc is cited from

Every "the attribute contract" or "the DOM contract" pointer in this skill's `references/*.md`,
`assets/motion/gsap/**`, `scripts/verify-matrix.mjs` and `scripts/lib/fluid-math.mjs` resolves here.
If you find one that still names `SKILL.md` §3, `CONTRACT.md`, or `MOTION-DESIGN-SYSTEM.md` for
material that lives above, that citation is stale — fix it to point here (or, for a motion-behaviour
point rather than a name, to `motion-architecture.md`, `scroll-scenes.md` or `performance.md`,
whichever actually holds it).
