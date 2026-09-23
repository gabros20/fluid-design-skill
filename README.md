# fluid-design, a Claude skill

A skill that teaches a coding agent to build a website, or convert an existing one, onto a
**viewport-fluid design system**. From the desktop breakpoint up, every drawn number (padding, gap,
width, type, offsets) is written as `number × unit`. The unit is 1px at a reference viewport and
follows whichever viewport axis is tighter. The desktop composition then stays a proportional copy
of the design frame at every size: exactly one screen tall when height binds, never overflowing,
pixel-exact at the reference, and still correct on a 5K display.

It also covers what that scale has to survive in a real browser: iOS 26 Safari viewport units,
toolbar tint and safe areas, sticky pitfalls, Safari's SVG rendering bugs, image `sizes` on a page
that grows past the reference, video element sizing and posters, browser zoom (viewport-derived type
does not grow under Cmd/Ctrl + on its own; a small runtime restores 1:1 text zoom), and a
viewport-matrix verifier with a real-browser-zoom row.

**Scope: fluid design only.** This skill contains no animation. Triggered entrances, pinned and
scrubbed scenes, scroll wells, video playback, header ink that follows the section underneath, and
coexistence with existing GSAP, Lenis or header scripts live in the companion skill,
[`scroll-animation`](https://github.com/gabros20/scroll-animation-skill). Each works alone; together
they share the engage breakpoint, `--header-h` and the `translate` property
(`fluid-design/references/contract.md` §4).

The whole thing is extracted from a production marketing site. Nearly every rule in `references/`
records the bug it prevents and the measurement behind it.

## What's inside

```
fluid-design/                      the skill: copy this folder into your skills directory
  SKILL.md                         workflow: preflight → foundation → sections → tokens → media → verify
  references/                      the method and its reasons
    preflight.md                   the decisions, their defaults, detection hints
    fluid-scale.md                 the unit, its maths and knobs, interop with animation
    frame-and-gutter.md            one frame box, scaled gutters, constants that drift
    section-recipe.md              the per-section checklist
    typography.md                  choosing type units, line boxes, hard breaks, fonts
    tokens-and-theming.md          semantic tokens and the traps that compile clean
    brownfield-migration.md        converting a container-based site, route by route
    stacks.md                      Tailwind v4 · vanilla CSS · SCSS · StyleX · CSS Modules
    media.md                       images, inline SVG rules, video element rendering, posters
    ios-safari.md                  svh/lvh/dvh, safe areas, toolbar tint, hero overshoot, sticky
    performance.md                 render budget: image sizes on a growing page, fonts, budgets
    verification.md                the matrix, real-device checks, the stale-stylesheet probe
    contract.md                    exact config keys, custom properties, utilities, attributes
  assets/
    fluid.config.json (+ schema)   the numbers: reference viewport, canvas, gutter, engage breakpoint,
                                   dampings, floors, ceiling
    styles/                        pre-generated unit and utility layers for tailwind-v4 · css · scss ·
                                   stylex, the ts config constants, plus a shared iOS/sticky-safe base layer
    runtime/fluid-zoom.js (+ .d.ts) makes the fluid type follow browser zoom (inline it in <head>)
    runtime/fluid-units.js (+ .d.ts) the units as numbers for script: fluidPx(), onFluidChange()
  scripts/
    generate-fluid.mjs             config → stack layers (deterministic; --check guards drift)
    calc.mjs                       factor tables, drawn-px resolution, content-budget check (cqw suggestions)
    audit.mjs                      static scan for the silent layout failure modes (self-tested)
    verify-matrix.mjs              Playwright: overflow, unit maths, one-screen fit, grid column counts,
                                   screenshots across a viewport matrix
    probe.mjs                      one-shot stale-stylesheet diagnosis
  evals/evals.json                 test prompts used to validate the skill

examples/                          integration examples using both skills
  pizza-next/                      Next 16 + Tailwind v4 + Motion editorial restaurant page (default stack)
  pizza-vite-gsap/                 Vite + SCSS + GSAP, non-default config (canvas 1600, gutter 64, ceiling 1.6)
```

The two examples were built before the split and use **both** skills: their layout, units and
Safari fixes come from `fluid-design`, their entrances, pinned scrub and loops from
`scroll-animation`. Each contains the agent's `FLUID.md` (its decisions), `VERIFY.md` (evidence),
`SKILL-FEEDBACK.md` (what the skill got wrong during the build; all of it has since been fixed
upstream) and `CREDITS.md`.

## Install

```bash
# Claude Code (user-level)
cp -r fluid-design ~/.claude/skills/fluid-design
# or project-level
cp -r fluid-design .claude/skills/fluid-design
```

For animation, install [`scroll-animation`](https://github.com/gabros20/scroll-animation-skill) the
same way.

Then ask for what you want, for example "make this landing page match our 1680×900 Figma frames at every
laptop size" or "convert this Tailwind site to fluid scaling". The skill runs a short preflight (styling
stack, design frame, engage breakpoint) and records the answers in `fluid.config.json` and `FLUID.md`
in your project.

## The system in one paragraph

`--fluid = max(0.58px, min(100svh/900, 100vw/1440))` from the engage breakpoint (1024) up, and 1px
below it. Display type uses `max(0.82px, --fluid, 0.62·--fluid + 0.38px)` and copy uses
`max(0.90px, --fluid, 0.33·--fluid + 0.67px)`, so type shrinks more gently than the layout, while
above the reference everything grows as one. The type units read `--fluid × --fluid-zoom` so text
still follows browser zoom. Site chrome uses a width-led unit that height never
shrinks. Each section has one frame box: `fluid-cap-<canvas>` (grow-only) plus a scaled gutter.
Rows that exceed the `1440 − 2·gutter` content budget move to `cqw`, and any constant compared
against a scaling box (an auto-fill minimum, a wrap basis) is scaled too. Read
`fluid-design/references/fluid-scale.md` for why each of those numbers is what it is.

## Credits and licence

The skill and example code are MIT licensed (see `LICENSE`). Example photography comes from Unsplash
and Pexels under their licences, credited per example in `CREDITS.md`. The other example imagery was
generated for this repository.
