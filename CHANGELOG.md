# Changelog

All notable changes to **fluid-design** are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/).

A release keeps `.codex-plugin/plugin.json`, the root `package.json` (`fluid-design-cli`),
`SKILL_VERSION` in `skills/fluid-design/scripts/lib/spec.mjs`, this changelog, git tag
`v<version>` and the matching GitHub Release in step. Runtime `SKILL.md` contains no version
metadata.

## [Unreleased]

## [2.1.1] — 2026-10-05

### Fixed
- **`fluid check` and the audit skip agent folders and installed skills.** A project that keeps the
  skill in its repo (`.claude/skills/fluid-design/`, so the whole team's agent loads the same
  version) failed `check` on the skill's own template CSS: 70 false problems on the first
  production site. Both scans now skip `.claude`, `.agents`, `.codex`, `.cursor`, `.gemini`,
  `.opencode`, `.grok`, `.hermes` and any folder with a `SKILL.md`, from one shared list
  (`scripts/lib/skip-dirs.mjs`, which also ends the two scans' slightly different lists). The skill
  stays removable: nothing in a project depends on it.

## [2.1.0] — 2026-10-01

Lessons from the first production site built on v2: what a team actually reached for, what it
hand-wrote because the pack had no answer, and which defaults it had to override on every band.

### Added
- **Box sizes on every type role.** `fluid-<role>-h-*`, `-w-*`, `-size-*`, `-p-*`, `-px-*`, `-py-*`
  and `-gap-*` (Tailwind), on the role's own unit: a button, chip or icon keeps its proportion to the
  label inside it (`fluid-copy-14/20` text in a `fluid-copy-h-56` button). Before this, buttons were
  hand-written as `h-[calc(56*var(--fluid-copy))]`. `cn` merges them with their Tailwind groups.
  SCSS and StyleX already had a function per role that works on any property.
- **`fluid-bleed-x`** (Tailwind utility, `.fluid-bleed-x` class, SCSS mixin): a strip that reaches
  the window's edges from inside a `fluid-container` and pads back in, so its content still lines up
  with the container's (a carousel track).
- **A `fluid` script.** `fluid init` adds `"fluid": "npx fluid-design-cli@2"` to `package.json`
  (when there is none), so the whole team and CI run `npm run fluid -- check` without the skill
  installed.
- The generated `README.md` is rewritten in plain words: the idea, setup, a *which class for what*
  table, tuning, the CLI, the bands.
- **Audit rule `arbitrary-fluid-calc`** (info, Tailwind): an arbitrary value that spells out a
  generated utility, such as `h-[calc(56*var(--fluid-copy))]`, gets the utility as the fix
  (`fluid-copy-h-56`). It reads whole files, since class strings often live in constants; on the
  production site it found 18 hand-written button sizes. The audit also treats `fluid-<role>-h-*`
  and `fluid-ui-h-*` as the same property as `fluid-h-*`.

### Changed
- **Tablet and landscape default to full width.** Their container width now defaults to the
  desktop breakpoint (wider than any window in those bands) with a 32px gutter, instead of holding
  the phone design to the phone's 560 column, which read as a phone floating on a tablet. The
  defaults are fallbacks for designs with no tablet or landscape frame. To keep the old look, set
  `--fluid-tablet-container-width: 560; --fluid-tablet-container-padding: 24;` (and the same for
  `landscape`).
- **The container gutter never drops below the safe-area inset.** `--fluid-container-padding` is
  now `max(drawn padding, env(safe-area-inset-left), env(safe-area-inset-right))`: a phone on its
  side under `viewport-fit=cover` keeps content clear of the notch, and everything that reads the
  padding (`fluid-bleed-x`) follows. Without notch insets nothing changes.
- **Less in the generated folder.** `settings.reference.css` and `fluid.css-data.json` are written
  only with the new `output.editor: true` (the site never reads them; `fluid settings` prints the
  same list). `fluid init` turns it on, and wires the autocomplete, only in a project that already
  keeps `.vscode/settings.json`.
- **No schema copy in the project.** `fluid init` and `fluid migrate` point `$schema` at the
  published schema instead of writing `fluid.config.schema.json` next to the config.
  `fluid generate` in a project set up before 2.1 (a local `$schema`) prints a one-line tip for
  each upgrade step: the schema URL, and the `fluid` npm script.
- **`fluid migrate` keeps a v1 site's tablet and landscape look.** v1 held both to the phone's 560
  column and 24 gutter unless `mobile.column` said otherwise; migrate now writes those as explicit
  settings, so the new full-width default does not change a migrated site.
- `fluid init --help` lists `--interactive` and `--force`.
- **`fluid-scale.md` is split by topic** (about 8,200 tokens down to 3,200): it keeps the model and
  the base unit; `units.md` (type roles, damping, the ui unit, header height, container units, adding
  a role), `bands.md`, `limits-and-scopes.md` and `browser-zoom.md` take the rest, each routed
  directly from `SKILL.md`. Every section link in the references, the CLI messages, the runtime
  comments and the docs points at the new place; a few CLI messages that pointed at the wrong
  section before the split are corrected too.
- The docs, site, video and skill now say where the artboard comes from: it is the desktop frame
  your designer draws on, set as `--fluid-desktop-base-width` / `-base-height` (1440×900 is only
  the default), with `--fluid-desktop-container-width` as the content box's widest size. The skill
  reads the frame size off the design instead of keeping 1440; only a canvas wider than a screen
  (1680×900) keeps the screen size as its base.
- The setting descriptions in `fluid settings`, `fluid.ts` and editor autocomplete use the same
  wording.

## [2.0.0] — 2026-09-25

The first published release. Earlier versions (v1, never tagged) were used from a clone; v2 splits
configuration into structure and settings, adds the `fluid` CLI and three distribution channels, and
adopts the skill-template repository layout.

### Added
- **One spec** (`skills/fluid-design/scripts/lib/spec.mjs`) for every structure key and setting:
  the JSON Schema, the generated `references/config.md`, every `@property` default and the settings
  lint all derive from it.
- **Structure vs settings.** `fluid.config.json` (about a dozen lines) decides which bands, type
  roles and outputs exist; every number (artboards, scale min/max, per-band damping, container,
  header, limits) is a CSS variable set in the project's own `:root`, live, with no regenerate:
  43 at the default structure, 30 registered with their defaults and 13 optional (unset = off, or
  falls back to the phone value). An invalid value falls back to its default.
- **Bands.** Phone (a 390 artboard), tablet, landscape phone and desktop, each scaling its own
  artboard, with exclusive Tailwind band variants `fluid-phone:`, `fluid-tablet:` and
  `fluid-landscape:`. `bands.phone: false` keeps a flat 1px below desktop.
- **Custom type roles** (`roles`), each with its own unit, utility, damping settings and helpers.
- **Browser zoom (WCAG 1.4.4).** A runtime measures the zoom so fluid type follows Cmd/Ctrl +:
  Chromium and Safari detection paths (Firefox gated off), CSP nonce and published SHA-256, a Next
  `<FluidHead />`, a Vite `fluidPlugin()`, and a classic `zoom.classic.js` for everything else.
- **The `fluid` CLI:** `init` (stack and framework detection, questions on a terminal, every
  answer also a flag), `generate` (hand-edit guard, CRLF- and formatter-safe, `--watch`), `check`
  (the CI gate: generated output current, settings lint with did-you-mean, source rules),
  `settings`, `explain` (every unit at a viewport and the source of each value; `--url` reads a live
  page with an OK / STALE / MISMATCH / V1 / MISSING verdict, `--at`, a scopes report), `probe`,
  `migrate` (v1 to v2), and the `calc`, `verify` and `audit` tools.
- **Limits and scopes:** `fluid-grow-until-*`, `fluid-shrink-until-*`, `fluid-ui-grow-until-*`,
  `fluid-off`, and `fluid-scope` for any setting on one subtree; `fluidPx(n, unit, el)` follows
  scopes.
- **`withFluid`**, a tailwind-merge plugin for projects that already have a `cn`.
- **Opt-in Tailwind families:** negative, logical, basis, scroll, space and rounded utilities.
- **Distribution:** the npm package `fluid-design-cli` and standalone binaries for macOS, Linux and
  Windows (`bun build --compile`), released with `SHA256SUMS` and installed by `install-cli.sh` /
  `install-cli.ps1`.
- **Audit rules** for the v2 API (`header-limit`, `cn-without-withfluid`,
  `band-variant-with-breakpoint`, `fluid-desktop-variant`, `limit-on-children`,
  `fluid-leading-ratio`), each with a self-tested fixture pair.
- **Autocomplete:** Tailwind IntelliSense for every `fluid-*` class, and `fluid.css-data.json` for
  settings in CSS files.
- **Verification:** `fluid verify` runs a viewport matrix plus a real browser-zoom row in Chromium,
  WebKit or Firefox; the repository's browser suites check the engine against a model in all three
  (18,840 checks) and the SCSS module (7,548 checks); CI also runs the no-browser suite and the
  standalone binary on Ubuntu, macOS and Windows.

### Changed
- The engine writes each formula once (on `:root` and every scope) with `min()`/`max()`/`calc()`
  only, the ×1000 precision form, and the desktop damping knee computed exactly instead of v1's
  rounded floor.
- Custom properties are namespaced (`--fluid-header-h`, `--fluid-safe-top`, …); `aliases: true`
  keeps the v1 names for a brownfield migration, and `fluid migrate --write` turns it on.
- The skill is scoped to layout, render, responsive and mobile work; animation is out of scope.
- The repository follows the gabros20 skill-template layout: the runtime pack lives in
  `skills/fluid-design/` (router-ordered `SKILL.md`, references with primacy headers); the
  generator and binary builder in `scripts/dev/`; the suites and fixtures in `tests/`; the four
  evaluation layers in `evals/`; `fluid-design-cli` publishes from the root `package.json`.
  `install.sh` installs the skill into agent skill folders; the binary installers are
  `install-cli.sh` and `install-cli.ps1`. The README doubles as the npm page, and `docs/` holds the
  installation guide, the by-hand usage guide and task recipes.

### Fixed
- Safari's resize cost (non-inherited unit mirrors and registered intermediates), the documented
  browser floor per stack, bracket values in Tailwind utilities, `cn` accepting only classes that
  compile, and `generate --watch` on editors that replace the file.

[Unreleased]: https://github.com/gabros20/fluid-design-skill/compare/v2.1.1...HEAD
[2.1.1]: https://github.com/gabros20/fluid-design-skill/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/gabros20/fluid-design-skill/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/gabros20/fluid-design-skill/releases/tag/v2.0.0
