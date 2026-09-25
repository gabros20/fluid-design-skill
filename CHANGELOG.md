# Changelog

All notable changes to **fluid-design** are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/).

A release keeps `.codex-plugin/plugin.json`, the root `package.json` (`fluid-design-cli`),
`SKILL_VERSION` in `skills/fluid-design/scripts/lib/spec.mjs`, this changelog, git tag
`v<version>` and the matching GitHub Release in step. Runtime `SKILL.md` contains no version
metadata.

## [Unreleased]

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

[Unreleased]: https://github.com/gabros20/fluid-design-skill/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/gabros20/fluid-design-skill/releases/tag/v2.0.0
