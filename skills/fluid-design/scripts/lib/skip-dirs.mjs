// skip-dirs.mjs — the folders `fluid check` and the audit never walk into.

import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** Dependencies, build output, and where coding agents keep their config and installed skills. */
export const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage', '.turbo', '.vercel', '.cache',
  'verify-out', 'screenshots',
  '.claude', '.agents', '.codex', '.cursor', '.gemini', '.opencode', '.grok', '.hermes',
])

/**
 * Whether a scan skips the folder `name` at `abs`: a listed folder, or an agent skill installed anywhere
 * in the project (a folder with a SKILL.md). A skill vendored into the repo, this one included, ships
 * example CSS and templates that are not the project's code.
 */
export const isSkippedDir = (name, abs) => SKIP_DIRS.has(name) || existsSync(join(abs, 'SKILL.md'))
