# Documentation

| Document | Audience | Purpose |
|---|---|---|
| [Installation](installation.md) | Users | Install, verify, update, and remove the skill |
| [Usage](usage.md) | Users | Activation boundary, workflow, routes, outputs, and completion |
| [Recipes](recipes.md) | Users | Copyable prompts for representative scenarios |
| [CLI internals](cli-internals.md) | Maintainers | How the `fluid` CLI's source, dev scripts and tests fit together |
| [Distribution](designs/DISTRIBUTION.md) | Maintainers | Why the CLI ships as a skill folder, an npm package and binaries |
| [Fix plan, Sep 2026](designs/FIX-PLAN-2026-09.md) | Maintainers | The v2 fix and refactor plan and its outcomes |
| [Review, Sep 2026](designs/REVIEW-2026-09.md) | Maintainers | The review of the fluid system, with its evidence in `designs/review-2026-09/` |
| [Zoom measurements](research/zoom-measurements.md) | Maintainers | The real-browser zoom measurements behind the zoom runtime |

Add focused domain documentation only when the README and runtime router are insufficient. Link to
one source of truth rather than duplicating it.

Research notes, design records, and ADRs are maintainer documentation. Create them for material
decisions future contributors need to understand; they are not mandatory for every release.
