# Documentation

Start with the [README](../README.md) for what `fluid-design` does and how to install it. The
runtime method lives in the skill itself: [`SKILL.md`](../skills/fluid-design/SKILL.md) and its
[`references/`](../skills/fluid-design/references/). The documents here are for people.

## For users

| Document | Purpose |
|---|---|
| [Installation](installation.md) | The three channels (agent skill, npm, standalone binary), prerequisites, pinning, upgrade, uninstall |
| [Usage](usage.md) | The by-hand guide: `fluid init`, using the scale per stack, limits, tuning, `explain` and `verify`, structure changes, CI, browser and editor support |
| [Recipes](recipes.md) | Common tasks with a prompt and the commands: a Figma frame, a 5K header, an existing `cn`, SCSS on Vite, a site without Node, CI, a stale stylesheet, a custom type role, a landscape tweak |

## For maintainers

| Document | Purpose |
|---|---|
| [CLI internals](cli-internals.md) | How the `fluid` CLI's source, the dev scripts and the test suites fit together |
| [CONTRIBUTING](../CONTRIBUTING.md) | Validation commands and the release flow |
| [AGENTS](../AGENTS.md) | Repository layout, ownership boundary and invariants |

### Design records (`designs/`)

| Document | Purpose |
|---|---|
| [Distribution](designs/DISTRIBUTION.md) | Why the CLI ships as a skill folder, an npm package and standalone binaries, and how each is built |
| [Fix plan, Sep 2026](designs/FIX-PLAN-2026-09.md) | The v2 fix and refactor plan and its outcomes |
| [Review, Sep 2026](designs/REVIEW-2026-09.md) | The review of the fluid system that led to v2 |
| [Review evidence](designs/review-2026-09/) | The review's raw material: [prior art](designs/review-2026-09/prior-art.md), [browser support and performance](designs/review-2026-09/support-perf.md), and the zoom and performance probe scripts |

### Research (`research/`)

| Document | Purpose |
|---|---|
| [Zoom measurements](research/zoom-measurements.md) | The real-browser zoom measurements behind the zoom runtime's detection |

Design records keep their historical paths and wording (they predate the move to
`skills/fluid-design/`); the current layout is in [AGENTS.md](../AGENTS.md).

Add a document here only when the README and the runtime router are not enough, and link to one
source of truth rather than restating it. Write a design record for a decision future contributors
need to understand; routine fixes do not need one.
