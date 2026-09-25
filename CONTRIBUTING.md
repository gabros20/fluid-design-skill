# Contributing

Contributions should improve the skill's activation, routing, output, validation or portability,
or the `fluid` CLI's behaviour, without adding runtime context an agent does not need. Read
[AGENTS.md](AGENTS.md) first for the layout, the ownership boundary and the invariants.

## Setup

- Node 20 or newer (CI uses 24), `bash` and `python3` for the family gate.
- For the browser suites: install both examples' dependencies and Playwright's browsers:

  ```bash
  (cd examples/pizza-next && pnpm install && npx playwright install chromium webkit firefox)
  (cd examples/pizza-vite-gsap && npm ci)
  ```

- For the standalone binaries: [bun](https://bun.sh).

The repository root has no dependencies of its own, and the CLI has no npm dependencies: it uses
Node built-ins, and `verify` / `explain --url` load Playwright from the project they check.

## Where a change goes

| Change | Edit | Then |
|---|---|---|
| A structure key or setting: its name, default, range or description | `skills/fluid-design/scripts/lib/spec.mjs` | `npm run generate` |
| The engine, a stack's emitted CSS or helpers, the runtime scripts | `skills/fluid-design/scripts/lib/` (`emit/`), `skills/fluid-design/assets/runtime/` | `npm run generate` |
| A CLI command or tool | `skills/fluid-design/scripts/cli/`, `skills/fluid-design/scripts/tools/` | a case in `tests/cli.mjs` |
| An audit rule | `skills/fluid-design/scripts/tools/audit.mjs` | a fixture pair in `tests/fixtures/audit/<rule>/{positive,negative}` |
| The method, a rule and its reason | the smallest owning file in `skills/fluid-design/references/`, linked from `SKILL.md` | update the affected eval fixtures |
| User-facing docs | `README.md` (also the npm page), `docs/` | — |

Never hand-edit a generated file: `skills/fluid-design/assets/fluid.config*.json`,
`skills/fluid-design/assets/styles/**`, `skills/fluid-design/scripts/lib/emit/runtime-assets.mjs`
and `skills/fluid-design/references/config.md` all come from `node scripts/dev/generate-fluid.mjs`.
After `npm run generate`, regenerate the examples too if the output changed:

```bash
(cd examples/pizza-next && node ../../skills/fluid-design/bin/fluid generate)
(cd examples/pizza-vite-gsap && node ../../skills/fluid-design/bin/fluid generate)
```

## Validate

Run before opening a pull request:

```bash
npm run verify              # scripts/check-sync, then npm test
npm test                    # the code: scripts/dev/generate-fluid.mjs --check (generated files
                            #   current, fixture invariants, v1 parity), tests/cli.mjs,
                            #   fluid audit --selftest, tests/zoom-detect.mjs
npm run test:browsers       # from the examples, in Chromium, WebKit and Firefox: engine-matrix,
                            #   tailwind-compile, explain-live, resize-perf, scss-browser
node scripts/dev/build-bin.mjs --target host --smoke   # this machine's binary, then a smoke run
scripts/count-skill-tokens  # SKILL.md and every reference against its token target
```

- `scripts/check-sync` is the skill-family gate: frontmatter, direct reference routing, reference
  primacy headers and contents lists, plugin and client metadata, eval fixture structure, runtime
  links and placeholders, script executability, and the plugin version against the newest
  `CHANGELOG.md` release. `npm run check-sync` runs it alone.
- `npm test` is the code suite without the gate: it answers "does the CLI work", `check-sync`
  answers "is this a conforming skill-family member", and `npm run verify` asks both.
- `npm run build:bin` builds every target into `dist/` and smoke-tests this machine's.

CI (`.github/workflows/ci.yml`) runs `npm test` and the host binary smoke test on Ubuntu, macOS
and Windows, and the browser suites on Ubuntu; `.github/workflows/check-sync.yml` runs the gate,
once per push.

## Before opening a pull request

1. Update the smallest owning file; link instead of duplicating knowledge.
2. Add or update the tests and fixtures the change touches: a `tests/` case for code, an audit
   fixture pair for a rule, and the activation, traversal, output or compression fixtures in
   `evals/` when routing or behaviour changes.
3. Run the validation above.
4. Update `README.md` and `docs/` when the public workflow changes, and `AGENTS.md` / `CLAUDE.md`
   when a repository invariant changes.
5. Record user-visible changes under `## [Unreleased]` in `CHANGELOG.md`.

Use conventional commit messages (`feat(cli): …`, `fix(engine): …`, `docs: …`).

Material contract or architecture decisions get a focused note in `docs/designs/`. Routine fixes do
not need one.

## Releases

Releases use semantic versioning. Four places carry the version and must agree:

| Source | Checked by |
|---|---|
| `package.json` (`fluid-design-cli`) | `generate-fluid.mjs --check` (against `SKILL_VERSION`), `release.yml` (against the tag) |
| `SKILL_VERSION` in `skills/fluid-design/scripts/lib/spec.mjs` | `generate-fluid.mjs --check`; it is stamped into every generated file |
| `.codex-plugin/plugin.json` | `scripts/check-sync` (against the changelog), `release.yml` (against the tag) |
| The newest released `CHANGELOG.md` heading, `## [x.y.z] — YYYY-MM-DD` | `scripts/check-sync` |

The runtime `SKILL.md` carries no version.

To release:

1. Bump all four, move the `[Unreleased]` entries under the new heading, and update the compare
   links at the bottom of `CHANGELOG.md`.
2. Run `npm run generate` (the version is stamped into the generated files) and regenerate the
   examples.
3. Run the validation above and commit.
4. Tag and push: `git tag v<version> && git push origin v<version>`.

`.github/workflows/release.yml` then checks the tag against `package.json` and
`.codex-plugin/plugin.json`, runs `npm run verify`, builds the five binaries with `SHA256SUMS` into a
GitHub Release (which `install-cli.sh` and `install-cli.ps1` download from), and publishes
`fluid-design-cli` to npm through npm Trusted Publishing (GitHub's OIDC identity, no token secret:
the package's Trusted Publisher on npmjs.com names this repository and `release.yml`). Both publish
steps skip what already exists, so re-running a release is safe.
