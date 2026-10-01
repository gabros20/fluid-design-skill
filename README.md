# Fluid Design

**Viewport-fluid layouts that scale as one drawing.**

Your designer draws the page on a design frame (an artboard) in Figma, Sketch or Penpot, say
1440×900 for desktop and 390 wide for phones. A normal build matches that frame and drifts on every
other window: cramped at 1280, lost in margin at 2560, cut off on a short laptop. `fluid-design`
writes every size as drawn (`120`, not a converted `7.5rem`) times one unit, so the page is a
proportional copy of the design at every window size.

It ships three ways, all running the same `fluid` CLI and generating the same files: an **agent
skill** (Claude Code, Codex, Cursor and other Agent Skills clients), the **npm package**
`fluid-design-cli`, and a **standalone binary** for projects without Node. It generates for
**Tailwind v4, plain CSS (and CSS Modules), SCSS and StyleX**.

> **Tested on Next.js only, for now.** The scale was built and tuned on a production Next.js (App
> Router) + Tailwind v4 site. The other stacks and frameworks (Vite, Astro, plain HTML; CSS, SCSS,
> StyleX) generate correctly and pass the pack's own tests and examples, but no production site
> runs on them yet. Expect rough edges there, and please report them.

[![npm](https://img.shields.io/npm/v/fluid-design-cli.svg)](https://www.npmjs.com/package/fluid-design-cli)
[![Tested on Next.js](https://img.shields.io/badge/tested%20on-Next.js-black.svg)](#fluid-design)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Visual guide:** [fluid-design-skill.vercel.app](https://fluid-design-skill.vercel.app) ·
**Source:** [github.com/gabros20/fluid-design-skill](https://github.com/gabros20/fluid-design-skill)

## How it works, in 60 seconds

- **The unit.** `--fluid` is 1px when the window is the size of the design frame, and grows or
  shrinks with the window. On desktop it follows whichever window axis is tighter
  (`min(width / frame width, height / frame height)`), so a section drawn as tall as the frame
  always fits the screen. You write `fluid-py-120`; the browser does the maths.
- **Bands.** A band is a range of window sizes with its own design: **phone** (portrait), **tablet**
  (600px and wider), **landscape** (a phone on its side, 500px tall or less) and **desktop** (1024px
  and wider). Each band scales its own frame, so nothing is redrawn per breakpoint.
- **Type roles.** A type role is a size curve that shrinks more gently than the layout: `display`
  for headlines, `copy` for body text and labels. Add your own (`caption`) in the config.
- **`ui`.** A unit for the header, nav and footer: it follows the width and never shrinks for a
  short window, so the nav stays usable on a 1440×700 laptop.
- **Limits.** Stop part of the page scaling past (or below) a window width.
- **Browser zoom.** Viewport units ignore Cmd/Ctrl +. A small runtime measures the zoom so text
  still zooms (WCAG 1.4.4), under a strict CSP too.

Two kinds of configuration, and one rule for which is which:

| | What it is | Where | To change it |
|---|---|---|---|
| **Structure** | which CSS rules exist: bands and breakpoints, type role names, prefix, stack, output folder | `fluid.config.json` (about a dozen lines) | edit, then `fluid generate` |
| **Settings** | numbers inside those rules: frame sizes, scale min and max, damping, container, header | CSS variables in your own `:root` | edit; applies live |

## Install

| You are | Install | Then |
|---|---|---|
| **Using an agent** (Claude Code, Codex, Cursor…) | `npx skills add gabros20/fluid-design-skill`, or from a clone `./install.sh claude` (also `codex`, `agents`, `cursor`, `antigravity`, `opencode`, `grok`, `hermes`, `all`) | ask for what you want |
| **In a Node project** (Next, Vite, Astro, Remix, SvelteKit…) | nothing | `npx fluid-design-cli@2 init` |
| **Without Node** (Rails, Django, Laravel, Phoenix, Hugo, plain HTML) | `curl -fsSL https://raw.githubusercontent.com/gabros20/fluid-design-skill/main/install-cli.sh \| sh` (Windows: `irm https://raw.githubusercontent.com/gabros20/fluid-design-skill/main/install-cli.ps1 \| iex`) | `fluid init` |

The npm package needs Node 20 or newer. The binary installers check the download against the
release's `SHA256SUMS`. `fluid verify` and `fluid explain --url` drive a real browser through
Playwright, so they need Node; the binary prints the `npx` command for them. Pinning, upgrades and
removal: [docs/installation.md](docs/installation.md).

With an agent, describe the outcome:

```text
Use $fluid-design to make this landing page match our Figma frames at every window size.
Use $fluid-design to convert this Tailwind site to fluid scaling, route by route.
```

(`$fluid-design` is Codex's form; use `/fluid-design`, an `@` mention or plain words elsewhere.)
The skill reads the frame sizes off your design, settles a short preflight, records its decisions
in `fluid.config.json` and a `FLUID.md` log, converts section by section and verifies at a matrix
of window sizes.

## Quick start (by hand)

```bash
npx fluid-design-cli@2 init      # asks about 10 questions; Enter keeps each default
```

`init` writes:

- `fluid.config.json`, with `$schema` pointing at the published schema, so your editor completes
  and validates it;
- the generated folder (default `src/styles/fluid/`), which you commit and never edit;
- one `@import` in your global stylesheet, and your frame sizes as settings in its `:root`;
- a `fluid` script in `package.json` (`"fluid": "npx fluid-design-cli@2"`), so the whole team and
  CI can run the CLI without installing anything.

```css
@import 'tailwindcss';
@import '../styles/fluid/fluid.css';

:root {
  --fluid-desktop-base-width: 1600;   /* your desktop frame */
  --fluid-desktop-base-height: 1000;
}
```

Then add the zoom script it prints (Next: `<FluidHead />` in `<head>`; Vite: `fluidPlugin()`;
anything else: `runtime/zoom.classic.js` as the first script in `<head>`) and check the setup:

```bash
npm run fluid -- check            # config, generated files, settings, source rules; use it in CI
npm run fluid -- explain 390x844  # every unit at a window size, and where each value came from
```

Every question is also a flag: `fluid init --yes --desktop 1600x1000 --phone 402`.

## Which class for what (Tailwind v4)

Write the number as drawn: `fluid-py-120` is 120px at the design frame's size.

| You are sizing | Use | Example |
|---|---|---|
| spacing, sizes, positions | `fluid-p-*`, `fluid-w-*`, `fluid-gap-*`, `fluid-top-*`… | `fluid-py-120` |
| headlines | `fluid-display-*` (size/line height) | `fluid-display-64/72` |
| body text, labels, button text | `fluid-copy-*` | `fluid-copy-16/24` |
| a button, chip or icon around role text | `fluid-copy-h-*`, `-w-*`, `-size-*`, `-p-*`, `-px-*`, `-py-*`, `-gap-*` (any role) | `fluid-copy-h-56 fluid-copy-px-24` |
| text inside a box that scales with the layout | `fluid-text-*` | `fluid-text-18/24` |
| the header, nav and footer | `fluid-ui-*` (`text`, `h`, `px`, `gap`…) | `fluid-ui-h-48` |
| the page wrapper, once per section | `fluid-container` | |
| a strip that reaches the window edges but stays aligned with the container | `fluid-bleed-x` | a carousel track |
| one band below desktop | `fluid-phone:`, `fluid-tablet:`, `fluid-landscape:` (desktop is `lg:`) | `fluid-tablet:fluid-px-32` |
| part of the page that stops scaling | `fluid-grow-until-*`, `fluid-shrink-until-*`, `fluid-ui-grow-until-*`, `fluid-off` | `fluid-grow-until-1680` |

A button keeps its proportion to its label when both use the same role:

```html
<a class="fluid-copy-14/20 fluid-copy-h-56 fluid-copy-px-24 inline-flex items-center">Book a table</a>
```

`fluid audit src` finds hand-written values such as `h-[calc(56*var(--fluid-copy))]` and names the
utility that replaces them (`fluid-copy-h-56`).

The other stacks spell the same thing: `calc(120 * var(--fluid))` in CSS, `fd.fluid(120)` and
`fd.fluid-copy(56)` in SCSS, `fluid(120)` and `fluidCopy(56)` in StyleX. Border widths, `em`
letter-spacing and text measures stay off the scale on purpose. The full guide per stack is
[docs/usage.md](docs/usage.md).

## Tuning

Settings are CSS variables with defaults. Set the ones you change in your own `:root`; they apply
live, with no regenerate. `fluid settings` lists all 43 with their defaults and what each does.

```css
:root {
  --fluid-desktop-container-padding: 108;  /* wider page gutters, on every section at once */
  --fluid-phone-scale-min: 0.8;            /* the smallest phones stop shrinking here */
}
```

**The defaults are fallbacks.** Read the real numbers off the design first: frame widths
(`--fluid-desktop-base-width` / `-base-height`, `--fluid-phone-base-width`: a design on iPhone 16 Pro
frames is 402 wide, not the default 390), the content box's widest size
(`--fluid-desktop-container-width`) and the side margin (`--fluid-desktop-container-padding`). A
wrong frame size raises no error; the page is just the wrong size everywhere (numbers from a 1680
frame on a 1440 base render 17% too big).

**Follow the height, or only the width.** On desktop the unit also watches the window's height, so
a section drawn 900 tall always fits one screen. Turn that off with `--fluid-desktop-fit-height: 0`
and the page follows the width only: a short laptop shows the design at full size and scrolls more,
and a wide, short monitor fills its width instead of shrinking to the height with empty side
margins. Keep it on when sections are designed to fill one screen (a hero, a pinned scroll scene).
Turn it off for pages where nothing has to fit one screen. Phones, tablets and landscape always
follow the width only. Height never squashes text: it scales the font size and the line height by
the same number, so cramped lines have another cause (a stale stylesheet is the usual one).

**Tablet and landscape run full width by default**, with a 32px gutter, because most designs have no
frame for them, and the phone design held to a narrow column reads as a phone floating on a big
screen. To keep the column, set
`--fluid-tablet-container-width: 560; --fluid-tablet-container-padding: 24;` (and the same for
`landscape`). Keep `--fluid-tablet-scale-min` equal to `--fluid-phone-scale-max` (both 1.1 by
default) so nothing jumps at the 600px switch. The container gutter never drops below the
safe-area inset, so a phone on its side under `viewport-fit=cover` keeps content clear of the notch.

## The CLI

| Command | Does |
|---|---|
| `fluid init` | set up: config, generated folder, import, settings, npm script |
| `fluid generate [--watch]` | rewrite the generated folder after a structure change |
| `fluid check` | the CI gate: config, generated files, settings lint, source rules |
| `fluid settings [--json]` | every setting with its default |
| `fluid explain 390x844` | every unit at a window size and where each value came from; `--url` reads the live page |
| `fluid verify <url>` | a matrix of window sizes and a real browser-zoom row (Playwright) |
| `fluid migrate --write` | convert a v1 config |
| `fluid calc`, `fluid audit` | the maths without a browser; the full static source scan (`check` runs part of it) |

In a project with the npm script, run them as `npm run fluid -- <command>`. `fluid <command>
--help` has the flags.

## Examples

Two complete builds in [`examples/`](examples/):

- [`pizza-next`](examples/pizza-next/): Next 16 + Tailwind v4 + Motion, default settings, with the
  site header held at 1680 through `--fluid-ui-grow-until`.
- [`pizza-vite-gsap`](examples/pizza-vite-gsap/): Vite + SCSS + GSAP with non-default settings
  (container 1600/64, `--fluid-desktop-scale-max: 1.6`).

Each keeps the agent's `FLUID.md` (decisions) and `VERIFY.md` (evidence).

## Scope

Use it for "match our Figma frame at every laptop size", "the page floats on a 2560 screen", "the
hero doesn't fit on a 13-inch laptop", "the header is huge on 5K", converting a site to fluid
scaling, iOS Safari viewport bugs, media sizing, browser zoom, and a page that looks broken after a
CSS edit and a dev-server restart (a stale stylesheet). It is not for breakpoint-and-`clamp()`
responsive work, colour systems, component libraries or animation. Production use so far is Next.js
+ Tailwind v4; other setups work in the tests but are untested on a live site.

## Evidence and browser support

- The engine is checked against a JavaScript model in Chromium, WebKit and Firefox (19,554
  checks); the SCSS module has its own browser suite (7,548 checks).
- A resize step costs about 8 ms in WebKit on a 2,000-element page, guarded in CI.
- Browser floor: Safari 15.4, Chrome 108, Firefox 101 on the CSS, SCSS and StyleX stacks;
  Tailwind v4's own floor (Safari 16.4, Chrome 111, Firefox 128) on the Tailwind stack.
- It was extracted from a production marketing site; the references record the bug behind each
  rule.

## Documentation

- [Installation](docs/installation.md): every channel, pinning, upgrade, uninstall
- [Usage](docs/usage.md): the by-hand guide, from `fluid init` to CI
- [Recipes](docs/recipes.md): common tasks, with the prompt and the commands
- [All docs](docs/README.md), including the CLI internals and design records
- The method: [`skills/fluid-design/SKILL.md`](skills/fluid-design/SKILL.md) and its
  [`references/`](skills/fluid-design/references/)

## Contributing

[AGENTS.md](AGENTS.md) has the repository layout and invariants, [CONTRIBUTING.md](CONTRIBUTING.md)
the validation commands (`npm run verify`, `npm run test:browsers`) and the release flow, and
[evals/README.md](evals/README.md) the activation, traversal, output and compression fixtures.

```text
skills/fluid-design/   the runtime pack: SKILL.md, references/, assets/, bin/fluid, scripts/
scripts/               the skill-family gate (check-sync) and scripts/dev/ (generator, binary build)
tests/  evals/         the code suites and the agent evaluations
examples/  docs/       two example builds; the docs
site/  remotion/       the visual guide and its video
```

Each release keeps `package.json`, `.codex-plugin/plugin.json`, the newest `CHANGELOG.md` heading
and the git tag in step; pushing the tag builds the binaries into a GitHub Release and publishes
to npm. History: [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE) · Tamás Gábor ([@gabros20](https://github.com/gabros20)). Example photography comes
from Unsplash and Pexels under their licences, credited per example in `CREDITS.md`; the other
example imagery was generated for this repository.
