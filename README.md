# fluid-design, a Claude skill

A skill that teaches a coding agent to build a website, or convert an existing one, onto a
**viewport-fluid design system**. From the desktop band's `minWidth` up, every drawn number
(padding, gap, width, type, offsets) is written as `number × unit`. The unit is 1px at a reference
viewport and follows whichever viewport axis is tighter. The desktop composition then stays a
proportional copy of the design frame at every size: exactly one screen tall when height binds,
never overflowing, pixel-exact at the reference, and still correct on a 5K display. Below the
desktop band, phone/tablet/landscape-phone bands scale their own artboard the same way.

It also covers what that scale has to survive in a real browser: iOS 26 Safari viewport units,
toolbar tint and safe areas, sticky pitfalls, Safari's SVG rendering bugs, image `sizes` on a page
that grows past the reference, video element sizing and posters, browser zoom (viewport-derived type
does not grow under Cmd/Ctrl + on its own; a small runtime restores 1:1 text zoom), and a
viewport-matrix verifier with a real-browser-zoom row.

**Scope: fluid design only.** This skill contains no animation. Triggered entrances, pinned and
scrubbed scenes, scroll wells, video playback, header ink that follows the section underneath, and
coexistence with existing GSAP, Lenis or header scripts live in the companion skill,
[`scroll-animation`](https://github.com/gabros20/scroll-animation-skill). Each works alone; together
they share the desktop band's `minWidth`, `--fluid-header-h` and the `translate` property
(`fluid-design/references/contract.md` §7).

The whole thing is extracted from a production marketing site. Nearly every rule in `references/`
records the bug it prevents and the measurement behind it.

## v2 quick start

Three ways to run the same `fluid` CLI:

| You are | Install | Then |
|---|---|---|
| **An agent** (Claude Code, Codex, Cursor…) | `cp -r fluid-design ~/.claude/skills/` (or `.claude/skills/` in a project), or `npx skills add gabros20/fluid-design-skill` | ask for what you want: the skill runs `node <skill>/bin/fluid …` itself |
| **A developer, Node project** | nothing | `npx fluid-design-cli@2 init` |
| **A developer, no Node** (Rails, Django, Laravel, Phoenix, Hugo, plain HTML) | `curl -fsSL https://raw.githubusercontent.com/gabros20/fluid-design-skill/main/install.sh \| sh` (Windows: `install.ps1`) | `fluid init` |

By hand, `fluid init` asks the design questions on the terminal (stack, framework, stylesheet,
desktop frame, breakpoints, mobile bands, max width). Each has a detected default, and each is also
a flag for scripts: `fluid init --yes --desktop 1600x1000 --set --fluid-desktop-scale-max=1.4`. The
full by-hand guide, covering tuning, `generate --watch`, CI, explain and verify, is
[`fluid-design/README.md`](fluid-design/README.md), which is also the npm page. How it ships, and
why: [`docs/DISTRIBUTION.md`](docs/DISTRIBUTION.md).

In a project:

```bash
fluid init          # detects your stack/framework, writes fluid.config.json,
                     # runs `fluid generate`, and adds the one import + your
                     # settings into your existing :root
```

That's the whole install: **one import**.

```css
@import 'tailwindcss';
@import './styles/fluid/fluid.css';
```

Everything you tune afterwards is a CSS variable, set in your own `:root` next to your tokens — no
regenerate, changes apply live:

```css
:root {
  --fluid-phone-scale-min: 0.8;
  --fluid-desktop-display-damping: 0.7;
}
```

`fluid.config.json` (structure: which bands exist, type role names, output stack/folder) only needs
`fluid generate` again when you change *that* — which bands exist, not a number inside one:

```json
{
  "$schema": "./fluid.config.schema.json",
  "version": 2,
  "bands": {
    "phone": true,
    "tablet": { "minWidth": 600 },
    "landscape": { "maxHeight": 500 },
    "desktop": { "minWidth": 1024 }
  },
  "output": { "integration": "next" }
}
```

Then, before trusting any of it:

```bash
fluid check                # CI gate: generated output current? settings valid? zero browser.
fluid explain 390x844      # every unit at a viewport, and where each setting came from
fluid verify <url>         # the viewport matrix + zoom row, in a real browser
fluid explain 1440x900 --url <url> --brief   # is the open page running the current stylesheet?
```

Browser floor: Tailwind v4's own (Safari 16.4, Chrome 111, Firefox 128) on the Tailwind stack;
Safari 15.4, Chrome 108, Firefox 101 on the CSS, SCSS and StyleX stacks
(`fluid-design/references/contract.md` §0).

Ask the agent for what you want, for example "make this landing page match our 1680×900 Figma
frames at every laptop size" or "convert this Tailwind site to fluid scaling." The skill runs a
short preflight (styling stack, design frame, bands) and records the decisions in `fluid.config.json`
and `FLUID.md` in your project.

## What's inside

```
fluid-design/                      the skill: copy this folder into your skills directory
  SKILL.md                         workflow: preflight → foundation → sections → tokens → media → verify
  references/                      the method and its reasons
    preflight.md                   the decisions, their defaults, detection hints
    config.md                      GENERATED — every fluid.config.json key and every setting, with its default
    fluid-scale.md                 the unit, its maths and knobs, interop with animation
    frame-and-gutter.md            the page container, scaled gutters, constants that drift
    section-recipe.md              the per-section checklist
    typography.md                  choosing type units, line boxes, hard breaks, fonts
    tokens-and-theming.md          semantic tokens and the traps that compile clean
    brownfield-migration.md        converting a container-based site, route by route
    stacks.md                      Tailwind v4 · vanilla CSS · SCSS · StyleX · CSS Modules
    media.md                       images, inline SVG rules, video element rendering, posters
    ios-safari.md                  svh/lvh/dvh, safe areas, toolbar tint, hero overshoot, sticky
    performance.md                 render budget: image sizes on a growing page, fonts, budgets
    verification.md                fluid check/explain/verify/audit, the matrix, real-device checks, the stale stylesheet
    contract.md                    browser floor, exact config keys, custom properties, utilities, attributes
  assets/
    fluid.config.json (+ schema)   the example config, and its JSON Schema
    styles/                        pre-generated reference output per stack (tailwind-v4 · css · scss ·
                                   stylex): fluid.css, base.css, settings.reference.css, fluid.ts, …
    runtime/fluid-zoom.js (+ .d.ts) makes fluid type follow browser zoom (fluid generate stamps it and adds
                                   the CSP literal + hash, and zoom.classic.js with no framework)
    runtime/fluid-units.js (+ .d.ts) the units as numbers for script: fluidPx(), onFluidChange()
  README.md                        the by-hand guide (no agent), also the npm page
  bin/fluid                        the `fluid` CLI (node scripts/cli.mjs); scripts/bin-entry.mjs for the binary
  scripts/
    cli.mjs                        fluid init/generate/check/settings/explain/migrate, + calc/verify/audit passthrough
    calc.mjs                       factor tables, drawn-px resolution, content-budget check (cqw suggestions)
    probe.mjs                      old name for `fluid explain --url --brief` (the stale-stylesheet verdict)
    verify-matrix.mjs              Playwright: overflow, unit maths, one-screen fit, grid column counts,
                                   screenshots, the real-zoom row, across a viewport matrix
    audit.mjs                      static scan for the silent layout failure modes (self-tested)
    generate-fluid.mjs             the skill's OWN generator: regenerates assets/ and references/config.md
                                   from scripts/lib/spec.mjs; --check also runs the tests below
    lib/                           spec (the one source of truth) · model (the maths) · settings (the lint) ·
                                   css-scan (the CSS tokenizer) · live (the live-page reader) ·
                                   context (what the CLI/tools share) · emit/ (CSS/Tailwind/SCSS/StyleX/project)
    test/                          parity.mjs (v1 maths, no browser) · cli.mjs (the CLI, no browser) ·
                                   zoom-detect.mjs (the zoom runtime, no browser) ·
                                   engine-matrix.mjs + tailwind-compile.mjs (real browsers, run from a
                                   project with playwright/tailwind — see examples/pizza-next)
    fixtures/                      v1-configs (parity fixtures) · configs (v2 structures) · audit (rule fixtures)
  evals/evals.json                 test prompts used to validate the skill

examples/                          integration examples using both skills
  pizza-next/                      Next 16 + Tailwind v4 + Motion editorial restaurant page (default stack)
  pizza-vite-gsap/                 Vite + SCSS + GSAP, non-default settings (container 1600/64, scale-max 1.6)
```

Both examples were migrated to v2 (`fluid migrate --write` then `fluid generate`) with no visual or
behavioural change intended; each records the migration and its verification in its own `VERIFY.md`.
They also use **both** skills: their layout, units and Safari fixes come from `fluid-design`, their
entrances, pinned scrub and loops from `scroll-animation`. Each contains the agent's `FLUID.md` (its
decisions), `VERIFY.md` (evidence), `SKILL-FEEDBACK.md` (what the skill got wrong during the build;
all of it has since been fixed upstream) and `CREDITS.md`.

## Structure vs settings, in one sentence

Anything that changes **which CSS rules exist** — which bands, type role names, the output stack —
is structure, lives in `fluid.config.json`, and needs `fluid generate`. Anything that changes **a
number inside those rules** — an artboard width, a damping curve, a container width, a growth
ceiling — is a setting: a `@property`-registered CSS variable, set in your own `:root`, live, no
regenerate. `fluid check` lints the settings and confirms the generated output hasn't drifted from
the config; `references/config.md` (generated) lists every key of both kinds with its default.

## The system in one paragraph

`--fluid` is 1px at the desktop artboard (default 1440×900) from `bands.desktop.minWidth` (default
1024) up, computed from `min()`/`max()` of the two viewport axes — a section drawn as tall as the
artboard never outgrows the window, svh not dvh so nothing resizes mid-scroll. Type roles
(`display`, `copy` by default) read the same unit through a per-band damping curve, so they shrink
more gently than the layout; below the band's edge the curve is read at the edge (the "knee"),
which is what holds headings up on a short window. The `ui` unit (header/nav/footer) follows width
and never shrinks for a short window. Below `bands.desktop.minWidth`, optional phone/tablet/landscape
bands scale a **separate** mobile artboard (default 390 wide) the same way — one set of phone
numbers, no orientation variants. Every setting is a CSS variable with a registered default,
override it in your own `:root`; `fluid.config.json` only decides which bands and rules exist.
Type units read `--fluid-z`, which folds in `--fluid-zoom` (written by a small runtime script), so
text still follows browser zoom (WCAG 1.4.4) even though the layout unit itself never does. Each
section has one `fluid-container` (the centred page wrapper, max width and padding from the active
band's settings) applied once, to its inner wrapper. Read `fluid-design/references/fluid-scale.md`
for why each of those numbers is what it is, and `references/config.md` for the exact key/setting
list.

## Tests

From `fluid-design/`:

```bash
npm test              # generate-fluid.mjs --check (regeneration + invariants + v1 parity)
                       #   && test/cli.mjs (the fluid CLI, no browser)
                       #   && audit.mjs --selftest
npm run test:browsers  # engine-matrix + tailwind-compile + explain-live (from examples/pizza-next)
                       #   && scss-browser (from examples/pizza-vite-gsap): 3 browsers, needs the
                       #   examples' node_modules installed
npm run build:bin      # the standalone binaries → dist/, smoke-tested on this machine (needs bun)
```

Releases: push a tag `v2.x.y` matching `fluid-design/package.json`. `.github/workflows/release.yml`
tests, builds the five binaries with `SHA256SUMS` into a GitHub Release, and publishes
`fluid-design-cli` to npm if the `NPM_TOKEN` repo secret is set.

`generate-fluid.mjs --check` is also what proves nothing in `assets/styles/**` or
`references/config.md` has drifted from `scripts/lib/spec.mjs`, the one place every name and default
lives.

## Credits and licence

The skill and example code are MIT licensed (see `LICENSE`). Example photography comes from Unsplash
and Pexels under their licences, credited per example in `CREDITS.md`. The other example imagery was
generated for this repository.
