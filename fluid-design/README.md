# fluid — a viewport-fluid design scale, by hand or by agent

`fluid` sets up a design scale where every drawn number (padding, gap, width, type) is
`number × unit`. The unit is 1px at your design frame's width, so the desktop layout stays a
proportional copy of the frame at every window size. It exists as three things:

- **an agent skill:** an agent reads `SKILL.md` and does the work
- **a CLI,** for people setting it up by hand and for automation
- **the files the CLI generates,** which you commit

This page is the by-hand path. It needs no agent.

## Install

| Your project | Run |
|---|---|
| Has Node (Next, Vite, Astro, Remix, SvelteKit…) | `npx fluid-design-cli@2 init` |
| No Node (Rails, Django, Laravel, Phoenix, Hugo, plain HTML) | `curl -fsSL https://raw.githubusercontent.com/gabros20/fluid-design-skill/main/install.sh \| sh`, then `fluid init` |
| Windows, no Node | `irm https://raw.githubusercontent.com/gabros20/fluid-design-skill/main/install.ps1 \| iex`, then `fluid init` |

The generated files are committed, so the CLI is only needed again when you change the structure,
and in CI. Nothing is added to your dependencies.

## 1. `fluid init`

On a terminal, init asks up to ten questions. Each one has a default detected from your project, and
Enter keeps it:

```
? Styling: tailwind-v4, css, scss or stylex? (tailwind-v4)
? Framework, for the browser-zoom head script: next, vite or none? (next)
? Global stylesheet (gets the import and your settings; empty = print them instead) (src/app/globals.css)
? Does this site already style html and body itself? (y = leave the base layer out) (n)
? Desktop design frame, width x height (1440x900)
? The desktop layout starts at this window width (px) (1024)
? Scale the phone, tablet and landscape layouts too? (n = 1px below desktop) (y)
? Phone design frame width (390)
? The page stops widening at (drawn px) (1680)
? Generated files go in (src/styles/fluid)
```

It then:

- writes `fluid.config.json`
- generates the output folder
- adds one import to your stylesheet
- puts your answers into your `:root` as CSS variables

```css
@import 'tailwindcss';
@import '../styles/fluid/fluid.css';

:root {
  --background: white;             /* your tokens, as before */

  /* fluid settings — every one, with its default, is in ../styles/fluid/settings.reference.css */
  --fluid-desktop-base-width: 1600;
  --fluid-desktop-base-height: 1000;
}
```

It finishes by printing the one line of framework wiring for browser zoom, which you add yourself:
`<FluidHead />` for Next, `fluidPlugin()` for Vite, or a `<script>` tag.

**Scripts and CI:** every answer is also a flag, and `--yes` (or no terminal) skips the questions:

```bash
npx fluid-design-cli@2 init --yes --desktop 1600x1000 --desktop-at 1200 --max-width 1920 \
  --set --fluid-desktop-scale-max=1.4
```

`--set` takes any setting and can be repeated. Each value is checked against the settings list, and a
typo gets a "did you mean". The other flags are `--stack`, `--integration`, `--css`, `--out`,
`--brownfield`, `--no-mobile` and `--phone`.

## 2. Use the scale

On Tailwind, write the design file's number through a `fluid-*` utility. Your editor suggests them
like any other Tailwind class:

```html
<section class="fluid-container lg:fluid-py-120">
  <h1 class="lg:fluid-display-64">…</h1>
  <p class="lg:fluid-copy-18 lg:fluid-mt-24">…</p>
</section>
```

- **Tailwind:** also `fluid-ui-*` for the header, nav and footer, and the band variants
  `fluid-phone:` / `fluid-tablet:` / `fluid-landscape:` / `fluid-desktop:`.
- **CSS:** `calc(64 * var(--fluid-display))`.
- **SCSS:** `@use 'fluid' as fd` gives `fd.fluid(64)`, `fd.fluid-display(64)` and the band
  mixins.
- **StyleX:** the typed helpers in `fluid.stylex.ts`.

**To stop something scaling past a width,** such as a footer or header that shouldn't keep
growing on a 2560 screen:

```html
<footer class="fluid-ui-grow-until-1920">…</footer>      <!-- this subtree only -->
```
```css
:root { --fluid-ui-grow-until: 1680; }   /* the site header: the whole page's ui, and --header-h with it */
```

`fluid-grow-until-*`, `fluid-shrink-until-*` and `fluid-off` work the same way.

## 3. Tune: settings are CSS variables

Every number is a CSS variable, set in your `:root`. It takes effect immediately, with no
regenerate. `settings.reference.css` in the output folder lists all of them with their defaults,
and `fluid settings` prints the same list. An invalid value (`0.8px`, a typo'd number) falls back to
the default instead of breaking the page.

```css
:root {
  --fluid-phone-scale-min: 0.8;          /* the smallest phones stop shrinking here */
  --fluid-desktop-display-damping: 0.7;  /* headings shrink more with the layout */
  --fluid-desktop-scale-max: 1.4;        /* stop growing on huge screens */
}
```

To see what a viewport gets and where each value came from:

```bash
fluid explain 390x844
fluid explain 1920x1080 --set --fluid-grow-until=1680    # what if, without editing anything
fluid explain 1920x1080 --url http://localhost:3000      # the live page, and every limited subtree on it
fluid explain 1920x1080 --url http://localhost:3000 --at header
```

## 4. Change the structure

`fluid.config.json` holds only what changes which CSS rules exist:

- the bands and their breakpoints
- the type role names (add `"caption"` to get `--fluid-caption` and `fluid-caption-*`)
- the prefix
- `ui` and `zoom` on or off
- the output folder and stack

After an edit, run `fluid generate`. Or keep `fluid generate --watch` running next to your dev
server: it regenerates on every save. Your editor completes and validates the file through
`fluid.config.schema.json`.

The generated folder is never edited by hand. `generate` refuses to overwrite a hand edit (use
`--force` once you've moved the change into a setting or the config).

## 5. Check it, in CI too

```bash
fluid check     # exit 1 when anything is wrong
```

It fails the build on:

- a config error
- a mistyped or out-of-range setting, with a suggestion
- generated files that are stale or hand-edited
- a breakpoint that disagrees with the bands

It warns on a `tailwind-merge` that doesn't know the fluid classes, a limit that won't do what you
meant, and output generated by a different version of the CLI.

```yaml
# .github/workflows/ci.yml
- run: npx fluid-design-cli@2 check
```

Pin one version across the team: the same `@2` in CI, and the same binary on every laptop.

## 6. Verify in a real browser (Node + Playwright)

```bash
npm i -D playwright && npx playwright install chromium
npx fluid-design-cli@2 verify http://localhost:3000
```

`verify` renders a matrix of viewports and a real browser-zoom row. It checks for overflow, the
unit maths, one-screen fit, grid columns and screenshots. `probe` is a one-shot check for a stale
stylesheet. Both need Node, so the standalone binary points you to the `npx` command.

## Editor support

- **Class autocomplete:** the Tailwind CSS IntelliSense extension lists every `fluid-*` utility.
- **Settings autocomplete** in CSS files comes from `fluid.css-data.json` in the output folder.
  In VS Code, `init` adds it to `.vscode/settings.json` (`"css.customData"`) when that file exists.
- **Zed:** the Tailwind language server gives the same class autocomplete. For the settings file,
  Zed's CSS server takes `dataPaths` in `lsp.vscode-css-language-server.initialization_options`.
  This is unverified in Zed; `docs/DISTRIBUTION.md` in the repo has the snippet.

## With an agent

Copy the `fluid-design` folder into your agent's skills directory (for Claude Code,
`~/.claude/skills/` or `.claude/skills/`), or run `npx skills add gabros20/fluid-design-skill`. The
agent runs the same CLI from the skill folder. For the method behind every number, start at
`SKILL.md` and `references/fluid-scale.md`.

MIT © Tamás Gábor
