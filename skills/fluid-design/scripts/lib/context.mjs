// context.mjs — what every tool needs about a project: the structure, and
// the settings in effect with where each came from.
//
//   findConfig(from)         nearest fluid.config.json walking up, or null
//   loadContext(path?)       { structure, resolved, dir, outDir, configPath, migration, findings }
//
// Settings come from the project's own CSS (top-level :root declarations,
// the same scan `fluid check` lints). A v1 config is migrated in memory and
// its numbers become the overrides, so the tools work before `fluid migrate`.

import { existsSync } from 'node:fs'
import { dirname, join, resolve as resolvePath, relative } from 'node:path'
import { loadProject, resolveSettings } from './model.mjs'
import { scanProject } from './settings.mjs'

export function findConfig(from = process.cwd()) {
  let dir = resolvePath(from)
  for (;;) {
    const f = join(dir, 'fluid.config.json')
    if (existsSync(f)) return f
    const up = dirname(dir)
    if (up === dir) return null
    dir = up
  }
}

export function loadContext(configPath) {
  const path = configPath === undefined ? findConfig() : resolvePath(configPath)
  const p = loadProject(path ?? undefined)
  const outDir = resolvePath(p.dir, p.structure.output.dir)
  let overrides = {}
  let findings = []
  if (p.migration) {
    for (const [k, v] of Object.entries(p.settings)) overrides[k] = { value: v, source: `${relative(process.cwd(), path)} (v1)` }
  } else if (path) {
    const r = scanProject(p.structure, p.dir, outDir)
    overrides = r.overrides
    findings = r.findings
  }
  return { structure: p.structure, resolved: resolveSettings(p.structure, overrides), dir: p.dir, outDir, configPath: path, migration: p.migration, findings }
}
