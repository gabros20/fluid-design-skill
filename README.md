# Fluid Design

**Viewport-fluid layouts that scale as one drawing.**

Your design is drawn on one frame, usually 1440×900. A normal site matches it there and drifts
everywhere else: it cramps at 1280, floats in a sea of margin at 2560, runs off the bottom of a
1440×700 laptop, and needs its phone layout redrawn at every breakpoint. `fluid-design` writes every
drawn number (padding, gap, width, type) as `number × unit`, where the unit is 1px at your design
frame, so the page stays a proportional copy of the design at every window size: pixel-exact at the
frame, one screen tall when the height binds, still right on a 5K display.

It ships three ways, all running the same `fluid` CLI and generating the same files:

- an **agent skill** (Claude Code, Codex, Cursor and other Agent Skills clients) that plans and
  converts the site for you;
- the **npm package** `fluid-design-cli`, for doing it by hand in a Node project;
- a **standalone binary** for projects without Node (Rails, Django, Laravel, Phoenix, Hugo, plain
  HTML).

It generates for **Tailwind v4, plain CSS (and CSS Modules), SCSS and StyleX**.

[![npm](https://img.shields.io/npm/v/fluid-design-cli.svg)](https://www.npmjs.com/package/fluid-design-cli)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Visual guide:** [fluid-design-skill.vercel.app](https://fluid-design-skill.vercel.app) ·
**Source:** [github.com/gabros20/fluid-design-skill](https://github.com/gabros20/fluid-design-skill)

## How it works

There is one measured unit, `--fluid`. It is 1px at the design frame and follows whichever window
axis is tighter: `min(width / 1440, height / 900)` on desktop, with a floor
(`--fluid-desktop-scale-min`, 0.58) and an optional ceiling (`--fluid-desktop-scale-max`). A section
drawn 900 tall therefore always fits the window. It uses `svh`, not `dvh`, so nothing resizes while
the reader scrolls.

You write the number from the design file; the unit does the rest:

```html
<!-- Tailwind v4: the drawn number goes through a fluid-* utility -->
<section class="fluid-container fluid-py-48 lg:fluid-py-120">
  <h1 class="lg:fluid-display-64">…</h1>
  <p class="lg:fluid-copy-18/26 lg:fluid-mt-24">…</p>
</section>
```

```css
/* Plain CSS: the same number times the same unit */
@media (min-width: 1024px) {
  .hero { padding-block: calc(120 * var(--fluid)); }
  .hero h1 { font-size: calc(64 * var(--fluid-display)); }
}
```

Around that unit:

- **Bands.** Phone (a 390 artboard), tablet (600+, the phone design scaled up), landscape phone
  (500 tall or less) and desktop (1024+). Each scales its own artboard, so the phone design is
  drawn once, with no redraw per breakpoint. `bands.phone: false` keeps a flat 1px below desktop.
- **Type roles.** `--fluid-display` and `--fluid-copy` (plus any role you add, such as `caption`)
  read the same unit through a per-band damping curve, so type shrinks more gently than the layout.
- **`--fluid-ui`** for the header, nav and footer: it follows width and never shrinks for a short
  window, so the nav stays usable on a 1440×700 laptop.
- **Limits.** `fluid-grow-until-1680`, `fluid-shrink-until-1280`, `fluid-ui-grow-until-1680` and
  `fluid-off` stop a subtree scaling past a window width; `:root { --fluid-ui-grow-until: 1680 }`
  holds the whole site header together with `--fluid-header-h`.
- **The container.** `fluid-container` is the page wrapper: max width 1680 drawn px, side padding
  80, both from the active band.
- **Browser zoom (WCAG 1.4.4).** Viewport units do not grow with Cmd/Ctrl +. A small runtime
  measures the zoom so text still zooms 1:1 while the layout keeps fitting. It works under a strict
  CSP (a nonce, or the published `FLUID_ZOOM_SHA256`).
- **Off the scale on purpose:** border widths, `em` tracking and fixed text measures.

## Structure vs settings

The whole configuration model is one rule:

- **Structure** changes *which CSS rules exist*: which bands and their breakpoints, the type role
  names, the prefix, `ui` and `zoom` on or off, the output stack and folder. It lives in
  `fluid.config.json` (about a dozen lines, with a JSON Schema) and needs `fluid generate`.
- **Settings** change *a number inside those rules*: artboard widths, scale min and max, per-band
  damping, the container, header heights, limits. They are 43 `@property`-registered CSS variables
  (at the default structure), set in your own `:root` next to your tokens. They apply live, with no
  regenerate, and an invalid value falls back to its default.

```css
@import 'tailwindcss';
@import './styles/fluid/fluid.css';   /* the one import */

:root {
  --fluid-phone-scale-min: 0.8;          /* the smallest phones stop shrinking here */
  --fluid-desktop-display-damping: 0.7;  /* headings shrink a little more with the layout */
}
```

## Boundary

Use `fluid-design` for "match our 1440 Figma frame at every laptop size", "the page floats on a
2560 screen", "the hero doesn't fit on a 13-inch laptop", "the header is huge on 5K", "convert this
Tailwind site to fluid scaling", fluid Tailwind/CSS/SCSS/StyleX tokens, iOS Safari viewport bugs,
media sizing on a growing page, browser zoom, and a page that looks broken right after a CSS edit
and a dev-server restart (a stale stylesheet).

It is not for:

- **Animation.** Triggered entrances, pinned and scrubbed scenes, scroll wells, video playback and
  coexistence with GSAP or Lenis belong to the companion
  [`scroll-animation`](https://github.com/gabros20/scroll-animation-skill) skill. Each works alone;
  together they meet at three points owned here: the desktop breakpoint (`DESKTOP_QUERY` in the
  generated `fluid.ts`), `--fluid-header-h`, and the `translate` property. Drawn motion distances
  scale through `fluidPx()`.
- **Generic "make it responsive" work** with breakpoints and a `clamp()` type ramp, design tokens and
  colour systems as a topic of their own, or component libraries.

## Install

| You are | Install | Then |
|---|---|---|
| **An agent** (Claude Code, Codex, Cursor…) | `npx skills add gabros20/fluid-design-skill`, or from a clone `./install.sh claude` (also `codex`, `agents`, `cursor`, `antigravity`, `opencode`, `grok`, `hermes`, `all`) | ask for what you want; the skill runs `node <skill>/bin/fluid …` itself |
| **A developer in a Node project** (Next, Vite, Astro, Remix, SvelteKit…) | nothing | `npx fluid-design-cli@2 init` |
| **A developer without Node** (Rails, Django, Laravel, Phoenix, Hugo, plain HTML) | `curl -fsSL https://raw.githubusercontent.com/gabros20/fluid-design-skill/main/install-cli.sh \| sh` (Windows: `irm https://raw.githubusercontent.com/gabros20/fluid-design-skill/main/install-cli.ps1 \| iex`) | `fluid init` |

The npm package needs Node 20 or newer. The binary installers verify the download against the
release's `SHA256SUMS`. Only `fluid verify` and `fluid explain --url` (which drive a real browser
through Playwright) need Node; the binary prints the `npx` command for them. Every channel, pinning,
upgrades and removal: [docs/installation.md](docs/installation.md).

## Use

With an agent, describe the outcome:

```text
Use $fluid-design to make this landing page match our 1440×900 Figma frame at every laptop size.
Use $fluid-design to convert this Tailwind site to fluid scaling, route by route.
Use $fluid-design to stop the header growing on a 5K display while the page keeps scaling.
```

(`$fluid-design` is Codex's form; use `/fluid-design`, an `@` mention or plain language in other
clients.) The skill inspects the project, settles a short preflight (stack, design frame, bands),
records the decisions in `fluid.config.json` and a `FLUID.md` decision log, converts section by
section, and verifies at a matrix of viewports.

By hand:

```bash
npx fluid-design-cli@2 init     # asks the design questions (stack, framework, stylesheet, desktop
                                # frame, breakpoints, mobile bands, max width), writes
                                # fluid.config.json, generates, adds the import and your settings
fluid check                     # the CI gate: config, generated files, settings lint, source rules
fluid explain 390x844           # every unit at a viewport, and where each value came from
fluid explain 1440x900 --url http://localhost:3000 --brief   # is the open page current?
fluid verify http://localhost:3000   # the viewport matrix + a real browser-zoom row (Playwright)
```

Every `init` question is also a flag for scripts:
`fluid init --yes --desktop 1600x1000 --set --fluid-desktop-scale-max=1.4`. The full by-hand guide
is [docs/usage.md](docs/usage.md); task recipes are in [docs/recipes.md](docs/recipes.md).

## Outputs

In your project, `fluid init` and `fluid generate` produce:

| Piece | Where |
|---|---|
| The structure | `fluid.config.json` (+ `fluid.config.schema.json` for editor validation) |
| The decisions, when an agent did the work | `FLUID.md` at the project root |
| Everything generated, in one folder you commit and never hand-edit (`output.dir`, default `src/styles/fluid/`) | `fluid.css` (the one import), `base.css`, `settings.reference.css` (every setting with its default), `fluid.ts` (typed constants, `DESKTOP_QUERY`, `fluidPx`), `cn.ts` (Tailwind) / `_index.scss` (SCSS) / `fluid.stylex.ts` (StyleX), `fluid.css-data.json` (settings autocomplete), `runtime/` (the zoom and units scripts), `integrations/` (`<FluidHead />` for Next, `fluidPlugin()` for Vite), `README.md` |
| Your settings | real declarations in your own `:root` |

`fluid generate` refuses to overwrite a hand edit, is CRLF- and formatter-safe, and runs as
`fluid generate --watch` next to a dev server. `fluid check` fails CI when anything drifts.

## Examples

Two complete builds in [`examples/`](examples/) use this skill for layout and the `scroll-animation`
skill for motion:

- [`pizza-next`](examples/pizza-next/): Next 16 + Tailwind v4 + Motion, the default stack and
  settings, with the site header held at 1680 through `--fluid-ui-grow-until`.
- [`pizza-vite-gsap`](examples/pizza-vite-gsap/): Vite + SCSS + GSAP with non-default settings
  (container 1600/64, `--fluid-desktop-scale-max: 1.6`).

Each keeps the agent's `FLUID.md` (decisions), `VERIFY.md` (evidence), `SKILL-FEEDBACK.md` (what
the skill got wrong during the build, since fixed upstream) and `CREDITS.md`.

## Evidence and browser support

- The engine is checked against a JavaScript model in Chromium, WebKit and Firefox (18,840 checks);
  the SCSS module has its own browser suite (7,548 checks).
- A resize step costs about 8 ms in WebKit on a 2,000-element page, guarded in CI.
- CI runs the no-browser suite and the standalone binary on Ubuntu, macOS and Windows, plus the
  three-browser suite.
- Browser floor: Safari 15.4, Chrome 108, Firefox 101 on the CSS, SCSS and StyleX stacks; Tailwind
  v4's own floor (Safari 16.4, Chrome 111, Firefox 128) on the Tailwind stack.
- It was extracted from a production marketing site; the references record the bug behind each rule.

## Documentation

- [Installation](docs/installation.md): every channel, prerequisites, pinning, upgrade, uninstall
- [Usage](docs/usage.md): the by-hand guide, from `fluid init` to CI
- [Recipes](docs/recipes.md): common tasks, with the prompt and the commands
- [All docs](docs/README.md), including the CLI internals, design records and research
- The method itself: [`skills/fluid-design/SKILL.md`](skills/fluid-design/SKILL.md) and its
  [`references/`](skills/fluid-design/references/)

## Evaluations

Four fixture layers keep failures diagnosable, each pointing at a different fix:

| Layer | Question | Fixtures |
|---|---|---|
| Activation | Should `fluid-design` trigger for this request? | `evals/activation/` |
| Traversal | Did it load the smallest sufficient reference set? | `evals/traversal/` |
| Output | Did the work satisfy the artifact and completion contracts? | `evals/output/` (with a scripted grader, `grade.mjs`) |
| Compression | Does a shorter candidate keep the quality? | `evals/compression-ablation/` |

`scripts/check-sync` validates the fixture structure. See [evals/README.md](evals/README.md).

## Repository map

```text
skills/fluid-design/        the runtime pack: SKILL.md, references/, assets/, bin/fluid, scripts/{cli,tools,lib}
.codex-plugin/plugin.json   Codex plugin and release metadata
scripts/                    the skill-family gate (check-sync, lint-skill, count-skill-tokens) and scripts/dev/
                            (generate-fluid.mjs, build-bin.mjs)
tests/                      the CLI, engine, Tailwind, SCSS, zoom and performance suites, and their fixtures
evals/                      activation, traversal, output and compression fixtures
examples/                   pizza-next and pizza-vite-gsap
docs/                       installation, usage, recipes, CLI internals, designs/, research/
site/, remotion/            the visual guide and its video
install.sh                  installs the skill into agent skill folders
install-cli.sh/.ps1         install the standalone fluid binary
```

## Versioning and releases

Each release keeps `package.json`, `.codex-plugin/plugin.json`, the newest `CHANGELOG.md` heading and
the git tag `v<version>` in step. Pushing the tag runs `.github/workflows/release.yml`: it tests,
builds the five binaries (macOS, Linux and Windows) with `SHA256SUMS` into a GitHub Release, and
publishes `fluid-design-cli` to npm. The runtime `SKILL.md` carries no version. History:
[CHANGELOG.md](CHANGELOG.md).

## Contributing

Read [AGENTS.md](AGENTS.md) for the repository invariants and [CONTRIBUTING.md](CONTRIBUTING.md) for
validation and the release flow. The repository is independently versioned and needs no sibling
checkout.

## License

[MIT](LICENSE) · Tamás Gábor ([@gabros20](https://github.com/gabros20)). Example photography comes
from Unsplash and Pexels under their licences, credited per example in `CREDITS.md`; the other
example imagery was generated for this repository.
