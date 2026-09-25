# Claude Code repository guide

Read [AGENTS.md](AGENTS.md) before changing runtime behaviour and
[CONTRIBUTING.md](CONTRIBUTING.md) before preparing a release. Keep `fluid-design` focused on making
the page the right size (the fluid scale, bands, settings, generated output per stack, media, iOS
Safari, browser zoom and verification) and hand animation to the companion `scroll-animation`
skill.

The runtime pack is `skills/fluid-design/`; everything else is repository tooling. Never hand-edit a
generated file: change `skills/fluid-design/scripts/lib/spec.mjs` or the emitters and run
`node scripts/dev/generate-fluid.mjs` (then `--check`). Keep `package.json`,
`.codex-plugin/plugin.json`, `SKILL_VERSION` and the newest `CHANGELOG.md` release in step. Run
`npm test` (which starts with `scripts/check-sync`) after every runtime, routing, metadata,
documentation or evaluation change. Commit only the paths you changed, with conventional messages;
never push or tag unless asked.
