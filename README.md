# fluid-design, a Claude skill

A skill that teaches a coding agent to build a website, or convert an existing one, onto a
**viewport-fluid design system**. From the desktop breakpoint up, every drawn number (padding, gap,
width, type, offsets) is written as `number × unit`. The unit is 1px at a reference viewport and
follows whichever viewport axis is tighter. The desktop composition then stays a proportional copy
of the design frame at every size: exactly one screen tall when height binds, never overflowing,
pixel-exact at the reference, and still correct on a 5K display.

It also ships the **motion system** that goes with the scale (triggered entrances, a pinned scrubbed
video scene, scroll wells, header ink that follows the section underneath) and the fixes those need:
iOS 26 Safari toolbar and viewport behaviour, all-intra video scrubbing, frame-accurate loops, sticky
pitfalls, and animation performance budgets.

The whole thing is extracted from a production marketing site. Nearly every rule in `references/`
records the bug it prevents and the measurement behind it.

## What's inside

```
fluid-design/                      the skill: copy this folder into your skills directory
  SKILL.md                         workflow: preflight → foundation → sections → tokens → motion → media → verify
  references/                      the method and its reasons (fluid scale, frame & gutter, section recipe,
                                   typography, tokens, brownfield migration, stacks, motion architecture,
                                   scroll scenes, video, iOS/Safari, performance, verification, attribute contract)
  assets/
    fluid.config.json (+ schema)   the numbers: reference viewport, canvas, gutter, engage breakpoint,
                                   dampings, floors, ceiling
    styles/                        pre-generated unit and utility layers for tailwind-v4 · css · scss · stylex,
                                   plus a shared iOS/sticky-safe base layer
    motion/react-motion/           React + Motion primitives: Stage/StageItem/StageVeil, CountUp, FadeOnExit,
                                   ScrubStage, PullToCentre, useHeaderTheme, InViewLoopVideo
    motion/gsap/                   the same primitives for GSAP, framework-agnostic and attribute-driven
  scripts/
    generate-fluid.mjs             config → stack layers (deterministic; --check guards drift)
    calc.mjs                       factor tables, drawn-px resolution, content-budget check (cqw suggestions)
    audit.mjs                      static scan for the silent failure modes (27+ rules, self-tested)
    verify-matrix.mjs              Playwright: overflow, unit maths, one-screen fit, reveals, grids,
                                   screenshots across a viewport matrix
    probe.mjs                      one-shot stale-stylesheet diagnosis
  evals/evals.json                 test prompts used to validate the skill

examples/
  pizza-next/                      Next 16 + Tailwind v4 + Motion editorial restaurant page (default stack)
  pizza-vite-gsap/                 Vite + SCSS + GSAP, non-default config (canvas 1600, gutter 64, ceiling 1.6)
```

Each example contains the agent's `FLUID.md` (its decisions), `VERIFY.md` (evidence),
`SKILL-FEEDBACK.md` (what the skill got wrong during the build; all of it has since been fixed
upstream in the skill) and `CREDITS.md`.

## Install

```bash
# Claude Code (user-level)
cp -r fluid-design ~/.claude/skills/fluid-design
# or project-level
cp -r fluid-design .claude/skills/fluid-design
```

Then ask for what you want, for example "make this landing page match our 1680×900 Figma frames at every
laptop size" or "convert this Tailwind site to fluid scaling". The skill runs a short preflight (styling
stack, animation engine, design frame) and records the answers in `fluid.config.json` and `FLUID.md`
in your project.

## The system in one paragraph

`--fluid = max(0.58px, min(100svh/900, 100vw/1440))` from the engage breakpoint (1024) up, and 1px
below it. Display type uses `max(0.82px, --fluid, 0.62·--fluid + 0.38px)` and copy uses
`max(0.90px, --fluid, 0.33·--fluid + 0.67px)`, so type shrinks more gently than the layout, while
above the reference everything grows as one. Site chrome uses a width-led unit that height never
shrinks. Each section has one frame box: `fluid-cap-<canvas>` (grow-only) plus a scaled gutter.
Rows that exceed the `1440 − 2·gutter` content budget move to `cqw`, and any constant compared
against a scaling box (an auto-fill minimum, a wrap basis) is scaled too. Read
`fluid-design/references/fluid-scale.md` for why each of those numbers is what it is.

## Credits and licence

The skill and example code are MIT licensed (see `LICENSE`). Example photography comes from Unsplash
and Pexels under their licences, credited per example in `CREDITS.md`. The other example imagery was
generated for this repository.
