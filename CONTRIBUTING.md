# Contributing

Contributions should improve the skill's activation, traversal, execution, validation, or
portability without adding unnecessary runtime context.

## Before opening a pull request

1. Update the smallest owning runtime file; link instead of duplicating knowledge. A name or default
   changes in `skills/fluid-design/scripts/lib/spec.mjs`, then `npm run generate` rewrites every
   file derived from it.
2. Add or update activation, traversal, output, and regression fixtures affected by the change, and
   a `tests/` case (or an audit fixture pair under `tests/fixtures/audit/<rule>/`) for code changes.
3. Run:

   ```bash
   npm test                  # scripts/check-sync + generate --check + CLI + audit self-test + zoom-detect
   npm run test:browsers     # needs examples/pizza-next and examples/pizza-vite-gsap node_modules
   node scripts/dev/build-bin.mjs --target host --smoke   # needs bun
   scripts/count-skill-tokens
   ```

4. Update README/user docs when the public workflow changes and `AGENTS.md`/`CLAUDE.md` when
   repository invariants change.
5. Record user-visible behavior changes in `CHANGELOG.md`.

Material contract or architecture decisions should receive a focused design note in
`docs/designs/`. Routine fixes do not require ceremonial research documents.

## Releases

Use semantic versioning. Update `.codex-plugin/plugin.json`, the root `package.json`,
`SKILL_VERSION` in `skills/fluid-design/scripts/lib/spec.mjs` and the newest released changelog
heading together, then push tag `v<version>`: `.github/workflows/release.yml` checks the tag against
the package and plugin versions, runs `npm test`, attaches the binaries and `SHA256SUMS` to the
GitHub Release, and publishes `fluid-design-cli` to npm when `NPM_TOKEN` is set.
