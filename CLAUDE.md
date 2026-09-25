# Claude Code repository guide

Read [AGENTS.md](AGENTS.md) for the layout, ownership boundary, invariants and release steps, and
[CONTRIBUTING.md](CONTRIBUTING.md) before preparing a release. The runtime pack is
`skills/fluid-design/`; generated files there come from `node scripts/dev/generate-fluid.mjs` and are
never hand-edited. Run `npm test` (which starts with `scripts/check-sync`) after every runtime,
routing, metadata, documentation or evaluation change.
