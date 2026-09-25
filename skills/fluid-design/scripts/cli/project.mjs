// project.mjs — the project on disk: finding and loading fluid.config.json, the lock, comparing generated output with what is there, keeping formatters off it.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve as resolvePath, sep } from 'node:path'
import { ConfigError, normaliseStructure, structureDefaults } from '../lib/spec.mjs'
import { loadProject } from '../lib/model.mjs'
import { fileHash } from '../lib/emit/project.mjs'
import { c, fail } from './ui.mjs'

export const LOCK = '.fluid.lock.json'


export function findConfig(flags) {
  if (flags.config) return resolvePath(flags.config)
  let dir = process.cwd()
  for (;;) {
    const f = join(dir, 'fluid.config.json')
    if (existsSync(f)) return f
    const up = dirname(dir)
    if (up === dir) return null
    dir = up
  }
}

/** Load a v2 project, or exit with a clear message. */
export function project(flags, { allowV1 = false } = {}) {
  const path = findConfig(flags)
  if (!path) fail(`No fluid.config.json found here or above. Start with ${c.bold('fluid init')}.`, 2)
  let p
  try {
    p = loadProject(path)
  } catch (err) {
    fail(err instanceof ConfigError ? err.message : String(err), 2)
  }
  if (p.migration && !allowV1) {
    fail(`${relative(process.cwd(), path) || path} is a v1 config. Run ${c.bold('fluid migrate --write')} first: it converts the structure and prints the settings to keep.`, 2)
  }
  return { ...p, path, outDir: resolvePath(p.dir, p.structure.output.dir) }
}


function readLock(outDir) {
  const f = join(outDir, LOCK)
  if (!existsSync(f)) return null
  try {
    return JSON.parse(readFileSync(f, 'utf8'))
  } catch {
    return null
  }
}

// CRLF from a Windows checkout (core.autocrlf) is not an edit.
const lf = (t) => t.replace(/\r\n/g, '\n')
// Equal once whitespace and quotes go: a formatter (Prettier, Biome) did it.
const squash = (t) => t.replace(/\s+/g, '').replace(/["'`]/g, '')
// Equal once the version stamps go: a plain upgrade.
const unstamp = (t) => lf(t).replace(/fluid-design \d+\.\d+\.\d+/g, 'fluid-design V').replace(/\d+\.\d+\.\d+\+[0-9a-f]{8}/g, 'BUILD').replace(/sha256-[A-Za-z0-9+/=]+/g, 'SHA')

/** Compare the generated files with what is on disk. States:
 *  ok · missing · stale (generated before, config or version changed) ·
 *  reformatted (a formatter's whitespace/quotes: safe to overwrite) ·
 *  hand-edited (differs from what the lock says was written) ·
 *  unowned (no lock to tell: refuse unless --force) · orphan (no longer generated). */
export function diffOutput(outDir, files) {
  const lock = readLock(outDir)
  const rows = []
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(outDir, rel)
    if (!existsSync(abs)) {
      rows.push({ rel, state: 'missing' })
      continue
    }
    const disk = lf(readFileSync(abs, 'utf8'))
    if (disk === content) rows.push({ rel, state: 'ok' })
    else if (lock?.files?.[rel] ? lock.files[rel] === fileHash(disk) : unstamp(disk) === unstamp(content)) rows.push({ rel, state: 'stale' })
    else if (squash(unstamp(disk)) === squash(unstamp(content))) rows.push({ rel, state: 'reformatted' })
    else rows.push({ rel, state: lock?.files?.[rel] ? 'hand-edited' : 'unowned' })
  }
  for (const rel of Object.keys(lock?.files ?? {})) {
    const abs = join(outDir, rel)
    if (rel in files || !existsSync(abs)) continue
    // Only delete what we wrote and nobody changed since.
    rows.push({ rel, state: lock.files[rel] === fileHash(lf(readFileSync(abs, 'utf8'))) ? 'orphan' : 'orphan-edited' })
  }
  return { rows, lock }
}

/** Which formatter the project runs, if any: Prettier or Biome would
 * rewrite the generated files on save or commit. */
function detectFormatter(root) {
  let deps = {}
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    deps = { ...pkg.dependencies, ...pkg.devDependencies }
  } catch {}
  const any = (names) => names.some((n) => existsSync(join(root, n)))
  if (deps['@biomejs/biome'] || any(['biome.json', 'biome.jsonc'])) return 'biome'
  if (deps.prettier || any(['.prettierrc', '.prettierrc.json', '.prettierrc.js', '.prettierrc.cjs', '.prettierrc.mjs', '.prettierrc.yaml', '.prettierrc.yml', 'prettier.config.js', 'prettier.config.mjs', 'prettier.config.cjs'])) return 'prettier'
  return null
}

export function formatterHint(p) {
  const rel = relative(p.dir, p.outDir).split(sep).join('/')
  const f = detectFormatter(p.dir)
  if (f === 'biome') return `exclude ${rel}/ in biome.json (files.ignore)`
  return `add ${rel}/ to .prettierignore (or your formatter's ignore list)`
}

/** init: keep a formatter off the generated folder. Prettier's ignore file
 * is plain text, so it is edited; biome.json may carry comments, so it is
 * only named. Returns a line to print, or null. */
export function ignoreForFormatter(root, outDir) {
  const f = detectFormatter(root)
  const rel = relative(root, outDir).split(sep).join('/')
  if (f === 'prettier') {
    const file = join(root, '.prettierignore')
    const cur = existsSync(file) ? readFileSync(file, 'utf8') : ''
    if (cur.split(/\r?\n/).some((l) => l.trim().replace(/^\/|\/$/g, '') === rel)) return null
    writeFileSync(file, `${cur}${cur && !cur.endsWith('\n') ? '\n' : ''}# generated by fluid-design: \`fluid generate\` owns these files\n${rel}/\n`)
    return `${c.green('✓')} .prettierignore: ${rel}/ (generated files stay byte-exact, so fluid check can tell a hand edit)`
  }
  if (f === 'biome') return `${c.yellow('!')} Biome: add "${rel}/**" to files.ignore in biome.json, so it doesn't reformat the generated files`
  return null
}


/** Drop every key still at its default, keeping `version` and `bands`
 * (the bands are the one thing worth seeing at a glance). */
export function minimalStructure(full) {
  const d = structureDefaults()
  const prune = (v, dv) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && dv && typeof dv === 'object') {
      const out = {}
      for (const [k, x] of Object.entries(v)) {
        const p = prune(x, dv[k])
        if (p !== undefined) out[k] = p
      }
      return Object.keys(out).length ? out : undefined
    }
    return JSON.stringify(v) === JSON.stringify(dv) ? undefined : v
  }
  const s = normaliseStructure(full)
  const bands = {
    phone: s.bands.phone.enabled,
    tablet: s.bands.tablet.enabled ? { minWidth: s.bands.tablet.minWidth } : false,
    landscape: s.bands.landscape.enabled ? { maxHeight: s.bands.landscape.maxHeight } : false,
    desktop: { minWidth: s.bands.desktop.minWidth }
  }
  const { version, bands: _b, ...rest } = s
  return { version, bands, ...(prune(rest, (({ version, bands, ...r }) => r)(d)) ?? {}) }
}
