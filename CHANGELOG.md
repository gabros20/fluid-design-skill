# Changelog

All notable changes to **fluid-design** are documented here.

The release procedure synchronizes `.codex-plugin/plugin.json`, the root `package.json`
(`fluid-design-cli`), `SKILL_VERSION` in `skills/fluid-design/scripts/lib/spec.mjs`, this changelog,
git tag `v<version>`, and the matching GitHub Release. Runtime `SKILL.md` contains no version
metadata.

## [Unreleased]

### Changed
- Repository adopts the gabros20 skill-template layout: the runtime pack lives in
  `skills/fluid-design/`; the generator and binary builder in `scripts/dev/`; the suites and
  fixtures in `tests/`; evaluation fixtures in `evals/`; `fluid-design-cli` publishes from the root
  `package.json`. `install.sh` now installs the skill into agent skill folders; the standalone
  binary installers are `install-cli.sh` and `install-cli.ps1`.

## [2.0.0] — 2026-09-25

### Added
- One spec (`scripts/lib/spec.mjs`) for every structure key and setting: the JSON Schema, the
  generated `references/config.md`, every `@property` default and the settings lint all derive from
  it.
- Structure vs settings split: `fluid.config.json` (about 15 lines) decides which bands, roles and
  outputs exist; every number (artboards, scale min/max, per-band damping, container, header, zoom
  range) is a registered CSS variable set in the project's own `:root`, live, with no regenerate.
- The `fluid` CLI: `init` (stack/framework detection, interactive on a terminal, every answer also
  a flag), `generate` (hand-edit guard, CRLF- and formatter-safe, `--watch`), `check` (the CI gate:
  generated output current, settings lint with did-you-mean, audit source rules), `settings`,
  `explain` (units and the source of every setting; `--url` reads a live page with a
  OK / STALE / MISMATCH / V1 / MISSING verdict, `--at`, a scopes report), `migrate` (v1 → v2), and
  the `calc`, `verify` and `audit` tools.
- Limits and scopes: `fluid-grow-until-*`, `fluid-shrink-until-*`, `fluid-ui-grow-until`,
  `fluid-off`, and `fluid-scope` for per-subtree settings; `fluidPx()` follows scopes.
- `withFluid` tailwind-merge plugin for projects that already have a `cn`.
- Distribution: the npm package `fluid-design-cli` and standalone binaries for macOS, Linux and
  Windows (`bun build --compile`), released with `SHA256SUMS`.
- Audit rules for the v2 API (`header-limit`, `cn-without-withfluid`, `band-variant-with-breakpoint`,
  `fluid-desktop-variant`, `limit-on-children`, `fluid-leading-ratio`) with a self-tested fixture
  per rule.
- Tailwind IntelliSense autocomplete for every `fluid-*` class and `fluid.css-data.json` for
  settings in CSS files.

### Changed
- The engine writes each formula once (on `:root` and every scope) with `min()`/`max()`/`calc()`
  only, the ×1000 precision form, and the desktop damping "knee" computed exactly instead of v1's
  rounded floor.
- Custom properties are namespaced (`--fluid-header-h`, `--fluid-safe-top`, …); `aliases: true`
  keeps the v1 names for a brownfield migration.
- Browser zoom runtime: Chromium and Safari detection paths (Firefox gated off), CSP nonce/hash
  support, and a classic-script build for projects without a framework integration.

### Fixed
- Safari resize cost, the documented browser floor per stack, bracket values in Tailwind
  utilities, and `generate --watch` on editors that replace the file.

[Unreleased]: https://github.com/gabros20/fluid-design-skill/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/gabros20/fluid-design-skill/releases/tag/v2.0.0
