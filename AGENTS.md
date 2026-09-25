# Agent guide — fluid-design-skill

This repository packages one independently versioned runtime skill: `fluid-design`. The GitHub and
plugin package name is `fluid-design-skill`; the runtime identifier and Codex invocation are
`fluid-design` and `$fluid-design`. The same source ships the `fluid` CLI as the npm package
`fluid-design-cli` and as standalone binaries, so a change to the runtime pack reaches agents, npm
users and binary users at once.

## Ownership boundary

`fluid-design` owns making a page the right size: the viewport-fluid scale (`--fluid`, 1px at the
design artboard, from the tighter viewport axis), its bands, type roles and the `ui` unit, the
structure/settings split, limits and scopes, the page container, the generated output per stack
(Tailwind v4, CSS, SCSS, StyleX), media sizing, iOS/Safari viewport and render behaviour, browser
zoom, and the verification of all of it.

It does not own animation: triggered entrances, pinned and scrubbed scenes, scroll wells, video
playback, GSAP, Lenis and header ink belong to the companion `scroll-animation` skill. The two meet
at three points, all owned here (`skills/fluid-design/references/contract.md` §7): the desktop
breakpoint (`DESKTOP_QUERY` in the generated `fluid.ts`), `--fluid-header-h`, and the `translate`
property. Recommend `scroll-animation` when a request needs motion; never invoke it silently and
never add motion to this pack. Generic breakpoint-and-`clamp()` responsive work, colour systems and
component libraries are out of scope too.

## Layout: runtime vs repository tooling

| Path | What | Ships in |
|---|---|---|
| `skills/fluid-design/` | the runtime pack: `SKILL.md` (the router), `references/`, `agents/openai.yaml`, `assets/` (example config, generated reference output per stack, runtime scripts), `bin/fluid`, `scripts/{cli,tools,lib}` | `install.sh`, `npx skills add`, npm (`package.json` `files`), the binaries |
| `scripts/dev/` | `generate-fluid.mjs` (regenerates everything derived from `spec.mjs`), `build-bin.mjs` + `bin-entry.mjs` (standalone binaries into `dist/`) | nothing |
| `scripts/` | the skill-family gate: `check-sync`, `lint-skill`, `count-skill-tokens`, `init`, `test-init` | nothing |
| `tests/` | the CLI, engine, Tailwind, SCSS, zoom and performance suites, `fixtures/` (configs, audit rule pairs), the frozen v1 maths for parity | nothing |
| `evals/` | activation, traversal, output (with `evals.json` + `grade.mjs`) and compression-ablation fixtures | nothing |
| `examples/` | two integration builds: `pizza-next` (Next + Tailwind + Motion), `pizza-vite-gsap` (Vite + SCSS + GSAP) | nothing |
| `docs/` | installation, usage (the by-hand guide), recipes, CLI internals, `designs/`, `research/` | nothing |
| `site/`, `remotion/` | the visual guide and its video | nothing |
| `install.sh` · `install-cli.sh` · `install-cli.ps1` | install the skill · install the binary | — |

## Invariants

- **Never hand-edit a generated file.** Every structure key and setting, with its default, lives in
  `skills/fluid-design/scripts/lib/spec.mjs`. `assets/fluid.config*.json`, `assets/styles/**`,
  `scripts/lib/emit/runtime-assets.mjs` and `references/config.md` (under `skills/fluid-design/`)
  are written by `node scripts/dev/generate-fluid.mjs` (`npm run generate`). The same holds in the
  examples: their `src/styles/fluid/` folders come from `fluid generate`.
- **Run `node scripts/dev/generate-fluid.mjs --check` after any engine, spec or runtime change.**
  It fails when a generated file is stale, a fixture config breaks an invariant, v1 parity breaks,
  or `package.json` disagrees with `SKILL_VERSION`. `npm test` runs it.
- **Versions agree.** `package.json`, `.codex-plugin/plugin.json`, `SKILL_VERSION` in `spec.mjs`
  and the newest released `CHANGELOG.md` heading (`## [x.y.z] — YYYY-MM-DD`) carry the same
  version. `generate-fluid.mjs --check` enforces the first and third, `scripts/check-sync` the
  second and fourth, `release.yml` the tag against the first two. No version in `SKILL.md`.
- **The runtime pack is self-contained.** Nothing under `skills/fluid-design/` imports from
  `scripts/`, `tests/`, `evals/` or `examples/`, and no link in `SKILL.md` or a reference escapes
  the skill root. Repository-only features (the audit self-test) find their files from the
  repository and exit 2 with a clear message in an installed skill.
- **`SKILL.md` is the router.** Frontmatter is `name` and `description` only. Every reference is
  linked directly from it and opens with `Purpose`, `Read when`, `Skip when`, `Inputs`,
  `Produces`, with an early `## Contents` past 100 lines. Put conditional depth in the smallest
  owning reference, not in `SKILL.md`.
- **Every command, flag, setting and path in docs exists.** The CLI's `--help` and
  `references/config.md` are the source; check before writing one into the README, `docs/` or a
  reference.
- **Rules keep their reasons.** Most rules in `references/` record the bug that paid for them.
  Change one only with the evidence, and keep the why next to it.

## Validation

```bash
npm test                  # scripts/check-sync, then npm run test:unit (generate --check, CLI, audit self-test, zoom-detect)
npm run test:browsers     # the three-browser suites, run from the examples (needs their node_modules)
node scripts/dev/build-bin.mjs --target host --smoke   # needs bun
scripts/count-skill-tokens
```

[CONTRIBUTING.md](CONTRIBUTING.md) has where each kind of change goes and the release steps.

## Commits and pushes

- Conventional commit messages: `feat(cli): …`, `fix(engine): …`, `docs: …`, `chore: …`.
- Stage only the paths you changed; other work may be in progress in the same tree.
- Commit when asked. Never push, tag or publish unless the user asks: a pushed `v*` tag runs
  `release.yml`, which creates a GitHub Release and publishes to npm.
