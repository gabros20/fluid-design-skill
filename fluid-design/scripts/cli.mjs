#!/usr/bin/env node
// cli.mjs — the `fluid` command. bin/fluid runs this.
//
//   fluid init [--brownfield] [--stack s] [--integration next|vite|none] [--out dir] [--force]
//   fluid generate [--force] [--dry]
//   fluid check
//   fluid settings [--json]
//   fluid explain <W>x<H> [--zoom z] [--url http://…]
//   fluid migrate [--write]
//   fluid calc | probe | verify | audit …   (the tools under scripts/)
//
// Every command finds fluid.config.json by walking up from the current
// directory, or takes --config <file>.

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve as resolvePath, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { normaliseStructure, settingsSpec, jsonSchema, structureDefaults, ConfigError, SKILL_VERSION, CONFIG_VERSION, bandBlurb } from './lib/spec.mjs'
import { loadProject, readJson, isV1, migrateV1, resolveSettings, evaluate, valuesOf, bandAt, bandMedia } from './lib/model.mjs'
import { buildOutput, fileHash, settingsReferenceCss } from './lib/emit/project.mjs'
import { scanProject, projectStyleFiles, scanDeclarations } from './lib/settings.mjs'
import { num } from './lib/emit/engine.mjs'

const SCRIPTS = dirname(fileURLToPath(import.meta.url))
const SKILL_ROOT = resolvePath(SCRIPTS, '..')
const LOCK = '.fluid.lock.json'

// ── args ────────────────────────────────────────────────────────────────

function parse(argv) {
  const out = { _: [], flags: {} }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        out.flags[key] = next
        i++
      } else out.flags[key] = true
    } else out._.push(a)
  }
  return out
}

const c = {
  red: (s) => (process.stdout.isTTY ? `\x1b[31m${s}\x1b[0m` : s),
  yellow: (s) => (process.stdout.isTTY ? `\x1b[33m${s}\x1b[0m` : s),
  green: (s) => (process.stdout.isTTY ? `\x1b[32m${s}\x1b[0m` : s),
  dim: (s) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s),
  bold: (s) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s)
}

function fail(message, code = 1) {
  console.error(message)
  process.exit(code)
}

function findConfig(flags) {
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
function project(flags, { allowV1 = false } = {}) {
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

// ── generate ────────────────────────────────────────────────────────────

function readLock(outDir) {
  const f = join(outDir, LOCK)
  if (!existsSync(f)) return null
  try {
    return JSON.parse(readFileSync(f, 'utf8'))
  } catch {
    return null
  }
}

/** Compare the generated files with what is on disk. */
function diffOutput(outDir, files) {
  const lock = readLock(outDir)
  const rows = []
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(outDir, rel)
    if (!existsSync(abs)) {
      rows.push({ rel, state: 'missing' })
      continue
    }
    const disk = readFileSync(abs, 'utf8')
    if (disk === content) rows.push({ rel, state: 'ok' })
    else if (lock?.files?.[rel] && lock.files[rel] !== fileHash(disk)) rows.push({ rel, state: 'hand-edited' })
    else rows.push({ rel, state: 'stale' })
  }
  for (const rel of Object.keys(lock?.files ?? {})) {
    if (!(rel in files) && existsSync(join(outDir, rel))) rows.push({ rel, state: 'orphan' })
  }
  return { rows, lock }
}

function cmdGenerate(flags) {
  const p = project(flags)
  const { files, buildId } = buildOutput(p.structure)
  const { rows } = diffOutput(p.outDir, files)
  const edited = rows.filter((r) => r.state === 'hand-edited')
  if (edited.length && !flags.force) {
    fail(`${c.red('Refusing to overwrite hand-edited files')} in ${relative(process.cwd(), p.outDir)}:\n${edited.map((r) => `  ${r.rel}`).join('\n')}\nThese are generated. Move your change into fluid.config.json or a setting, then run ${c.bold('fluid generate --force')}.`)
  }
  const changed = rows.filter((r) => r.state !== 'ok')
  if (flags.dry) {
    for (const r of changed) console.log(`${r.state.padEnd(12)} ${r.rel}`)
    console.log(changed.length ? `${changed.length} file(s) would change` : 'up to date')
    return
  }
  mkdirSync(p.outDir, { recursive: true })
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(p.outDir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }
  for (const r of rows.filter((r) => r.state === 'orphan')) rmSync(join(p.outDir, r.rel), { force: true })
  const lock = { generator: `fluid-design ${SKILL_VERSION}`, build: buildId, stack: p.structure.output.stack, files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, fileHash(v)])) }
  writeFileSync(join(p.outDir, LOCK), JSON.stringify(lock, null, 2) + '\n')
  const out = relative(process.cwd(), p.outDir) || '.'
  console.log(`${c.green('✓')} ${out}: ${Object.keys(files).length} files (${changed.length} changed) · build ${buildId}`)
}

// ── check ───────────────────────────────────────────────────────────────

function cmdCheck(flags) {
  const path = findConfig(flags)
  if (!path) fail(`No fluid.config.json found here or above. Start with ${c.bold('fluid init')}.`, 2)
  const json = readJson(path)
  if (isV1(json)) fail(`${c.red('✗')} fluid.config.json is v1. Run ${c.bold('fluid migrate --write')}.`, 1)
  const p = project(flags)
  let errors = 0
  let warns = 0

  // 1. generated files
  const { files } = buildOutput(p.structure)
  const { rows } = diffOutput(p.outDir, files)
  const bad = rows.filter((r) => r.state !== 'ok')
  if (bad.length) {
    errors += bad.length
    console.log(`${c.red('✗')} generated files are out of date (${relative(process.cwd(), p.outDir)}):`)
    for (const r of bad) {
      const why = { missing: 'missing', stale: 'config changed since the last generate', 'hand-edited': 'edited by hand (it will be overwritten)', orphan: 'no longer generated' }[r.state]
      console.log(`    ${r.rel} — ${why}`)
    }
    console.log(`  run ${c.bold('fluid generate')}${bad.some((r) => r.state === 'hand-edited') ? ' (after moving hand edits into a setting)' : ''}`)
  } else console.log(`${c.green('✓')} generated files match fluid.config.json`)

  // 2. settings
  const { findings } = scanProject(p.structure, p.dir, p.outDir)
  for (const f of findings) {
    const tag = f.level === 'error' ? c.red('✗') : f.level === 'warn' ? c.yellow('!') : c.dim('i')
    console.log(`${tag} ${f.file}:${f.line} ${f.message}`)
    if (f.level === 'error') errors++
    if (f.level === 'warn') warns++
  }
  if (!findings.length) console.log(`${c.green('✓')} settings: nothing to flag`)

  // 3. A limit class on the site header limits the header but not the page's
  //    --header-h (anchor offsets, hero padding read it on :root). The root
  //    ui limit keeps both in step.
  const p2 = p.structure.prefix
  const headerLimit = new RegExp(`<header\\b[^>]*class(?:Name)?=[^>]*\\b(?:[\\w-]+:)*${p2}-(?:ui-)?grow-until-(\\[?\\d+\\]?)`, 'g')
  for (const f of sourceFiles(p.dir, p.outDir)) {
    const text = readFileSync(f, 'utf8')
    for (const m of text.matchAll(headerLimit)) {
      warns++
      const line = text.slice(0, m.index).split('\n').length
      console.log(`${c.yellow('!')} ${relative(p.dir, f)}:${line} a grow-until limit on <header> limits the header but not the page's --header-h (anchor offsets and hero padding read it on :root). For the site header, set :root { --fluid-ui-grow-until: ${m[1].replace(/[[\]]/g, '')}; } instead: it holds the header's ui units and --header-h together.`)
    }
  }

  // 4. A cn/twMerge of the project's own that does not know the fluid utilities.
  if (p.structure.output.stack === 'tailwind-v4') {
    for (const f of mergeWithoutFluid(p.dir, p.outDir)) {
      warns++
      console.log(`${c.yellow('!')} ${relative(p.dir, f)} builds a tailwind-merge without withFluid: cn('lg:fluid-p-40', 'lg:fluid-p-24') keeps both there. Add the plugin: extendTailwindMerge(withFluid) (import { withFluid } from the generated cn.ts), or use the generated cn.`)
    }
  }

  // 5. breakpoints you manage yourself must agree with the bands
  if (p.structure.output.stack === 'tailwind-v4' && p.structure.tailwind.breakpoints === 'none') {
    for (const f of projectStyleFiles(p.dir, p.outDir)) {
      const m = /--breakpoint-lg\s*:\s*([\d.]+)(px|rem)/.exec(readFileSync(f, 'utf8'))
      if (m && !(m[2] === 'px' && Number(m[1]) === p.structure.bands.desktop.minWidth)) {
        errors++
        console.log(`${c.red('✗')} ${relative(p.dir, f)}: --breakpoint-lg is ${m[1]}${m[2]}, but the desktop band starts at ${p.structure.bands.desktop.minWidth}px — lg: and the units would switch at different widths`)
      }
    }
  }
  console.log(errors ? c.red(`${errors} problem(s)`) : c.green('OK') + (warns ? c.yellow(` (${warns} warning(s))`) : ''))
  process.exit(errors ? 1 : 0)
}

/** Files that build their own tailwind-merge (a shadcn lib/utils.ts, a local cn)
 * without the fluid plugin: fluid classes would not merge there. */
function mergeWithoutFluid(root, skip) {
  const out = []
  for (const f of sourceFiles(root, skip, /\.(ts|tsx|js|jsx|mjs)$/)) {
    const t = readFileSync(f, 'utf8')
    if (/from\s+['"]tailwind-merge['"]/.test(t) && !/\bwithFluid\b/.test(t)) out.push(f)
  }
  return out
}

const SOURCE_EXT = /\.(tsx|jsx|html|vue|svelte|astro|mdx)$/
function sourceFiles(root, skip, ext = SOURCE_EXT) {
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (['node_modules', '.git', '.next', 'dist', 'build', 'out', '.turbo', '.vercel'].includes(name)) continue
      const abs = join(dir, name)
      if (abs === skip) continue
      if (statSync(abs).isDirectory()) walk(abs)
      else if (ext.test(name)) out.push(abs)
    }
  }
  walk(root)
  return out
}

// ── settings ────────────────────────────────────────────────────────────

function cmdSettings(flags) {
  const path = findConfig(flags)
  const structure = path ? project(flags).structure : normaliseStructure({})
  if (flags.json) console.log(JSON.stringify(settingsSpec(structure).map(({ name, band, default: d, min, max, registered, doc }) => ({ name, band, default: d, min, max, registered, doc })), null, 2))
  else process.stdout.write(settingsReferenceCss(structure))
}

// ── explain ─────────────────────────────────────────────────────────────

function parseWxH(s) {
  const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(String(s ?? ''))
  if (!m) fail(`expected a viewport like 390x844, got ${JSON.stringify(s)}`, 2)
  return [Number(m[1]), Number(m[2])]
}

function printExplain(structure, resolved, w, h, zoom, label) {
  const e = evaluate(structure, valuesOf(resolved), w, h, zoom)
  const band = e.band
  const flat = band === 'phone' && !structure.bands.phone.enabled
  console.log(`${c.bold(`${w}×${h}`)}${zoom !== 1 ? ` (CSS px) at ${Math.round(zoom * 100)}% zoom` : ''} → ${c.bold(band)}: ${bandBlurb(structure, band).replace(/^\S+ — /, '')}${label ? c.dim(`  (${label})`) : ''}`)
  const media = bandMedia(structure)[band]
  if (media) console.log(c.dim(`  @media ${media}`))
  console.log('')
  const row = (name, v, note = '') => console.log(`  ${name.padEnd(26)} ${v.padEnd(12)} ${c.dim(note)}`)
  row('--fluid', `${e.fluid.toFixed(4)}`, `100 drawn px = ${(100 * e.fluid).toFixed(1)} CSS px`)
  if (structure.zoom && zoom !== 1) row('--fluid-z', `${e.fluidZ.toFixed(4)}`, 'the layout unit with the zoom undone, what type reads')
  for (const r of structure.roles) row(`--fluid-${r}`, `${e.roles[r].toFixed(4)}`, `64 drawn px = ${(64 * e.roles[r]).toFixed(1)} CSS px`)
  if (structure.ui) row('--fluid-ui', `${e.ui.toFixed(4)}`)
  row('--fluid-container-width', `${e.containerWidth.toFixed(1)}px`)
  row('--fluid-container-padding', `${e.containerPadding.toFixed(1)}px`)
  row('--header-h', `${e.headerHeight.toFixed(1)}px`, '+ safe-area inset')
  console.log('')
  console.log(`  settings in play (${band}${flat ? ', flat' : ''}):`)
  for (const [name, r] of Object.entries(resolved)) {
    if (r.spec.band !== band && r.spec.band !== null) continue
    const v = r.value === null ? 'unset' : num(r.value)
    const src = r.source === 'default' ? c.dim('default') : c.green(`← ${r.source}`)
    console.log(`    ${name.padEnd(38)} ${v.padEnd(8)} ${src}`)
  }
}

async function cmdExplain(flags, args) {
  const p = project(flags)
  const [w, h] = parseWxH(args[0])
  const zoom = flags.zoom ? Number(flags.zoom) : 1
  if (flags.url) {
    const live = await readLiveSettings(flags.url, w, h, p.structure)
    // Registered settings always compute to a value; only a non-default one was set by the page.
    const defaults = Object.fromEntries(settingsSpec(p.structure).map((x) => [x.name, x.default]))
    for (const [k, o] of Object.entries(live.overrides)) if (o.value === defaults[k]) delete live.overrides[k]
    const resolved = resolveSettings(p.structure, live.overrides)
    printExplain(p.structure, resolved, w, h, zoom, `settings read from ${flags.url}`)
    const e = evaluate(p.structure, valuesOf(resolved), w, h, zoom)
    const got = live.units
    console.log('')
    const rows = [['--fluid', e.fluid, got.fluid], ...p.structure.roles.map((r) => [`--fluid-${r}`, e.roles[r], got[r]]), ...(p.structure.ui ? [['--fluid-ui', e.ui, got.ui]] : [])]
    let worst = 0
    for (const [n, exp, g] of rows) worst = Math.max(worst, Math.abs(exp - g))
    console.log(worst < 0.002 ? c.green(`  ✓ the page's units match (worst drift ${worst.toExponential(1)})`) : c.red(`  ✗ the page's units drift by up to ${worst.toFixed(4)} — a stale stylesheet (close the tab, reopen) or a hand-edited fluid.css`))
    if (live.build && live.build !== buildOutput(p.structure).buildId) console.log(c.yellow(`  ! the page was built from ${live.build}; this config generates ${buildOutput(p.structure).buildId} — run fluid generate, restart, reopen the tab`))
    return
  }
  const { overrides } = scanProject(p.structure, p.dir, p.outDir)
  printExplain(p.structure, resolveSettings(p.structure, overrides), w, h, zoom, 'settings from your CSS, top-level :root')
}

async function readLiveSettings(url, w, h, structure) {
  const pw = loadPlaywright()
  const browser = await pw.chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    await page.goto(url, { waitUntil: 'networkidle' })
    const names = settingsSpec(structure).map((s) => s.name)
    const units = ['fluid', ...structure.roles, ...(structure.ui ? ['ui'] : [])]
    return await page.evaluate(({ names, units }) => {
      const cs = getComputedStyle(document.documentElement)
      const overrides = {}
      for (const n of names) {
        const v = cs.getPropertyValue(n).trim()
        if (v !== '' && Number.isFinite(Number(v))) overrides[n] = { value: Number(v), source: 'the page' }
      }
      const probe = document.createElement('div')
      probe.style.cssText = 'position:fixed;visibility:hidden;left:0;top:0;height:0'
      document.body.appendChild(probe)
      const got = {}
      for (const u of units) {
        probe.style.width = `calc(1000 * var(--fluid${u === 'fluid' ? '' : '-' + u}))`
        got[u] = probe.getBoundingClientRect().width / 1000
      }
      probe.remove()
      return { overrides, units: got, build: cs.getPropertyValue('--fluid-build').trim().replace(/^"|"$/g, '') }
    }, { names, units })
  } finally {
    await browser.close()
  }
}

export function loadPlaywright() {
  for (const base of [join(process.cwd(), 'package.json'), import.meta.url]) {
    try {
      return createRequire(base)('playwright')
    } catch {}
  }
  fail('playwright is not installed here: npm i -D playwright && npx playwright install chromium', 2)
}

// ── config files ────────────────────────────────────────────────────────

/** JSON with small objects and arrays kept on one line. */
export function prettyJson(value, indent = '') {
  const inner = indent + '  '
  if (Array.isArray(value)) {
    const flat = JSON.stringify(value)
    return flat.length <= 72 ? flat.replace(/,/g, ', ') : `[\n${value.map((v) => inner + prettyJson(v, inner)).join(',\n')}\n${indent}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    if (!entries.length) return '{}'
    const flat = `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v).replace(/,/g, ', ').replace(/:/g, ': ')}`).join(', ')} }`
    if (flat.length <= 72 && entries.every(([, v]) => typeof v !== 'object' || v === null || JSON.stringify(v).length < 40)) return flat
    return `{\n${entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${prettyJson(v, inner)}`).join(',\n')}\n${indent}}`
  }
  return JSON.stringify(value)
}

/** Drop every key still at its default, keeping `version` and `bands`
 * (the bands are the one thing worth seeing at a glance). */
function minimalStructure(full) {
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

// ── migrate ─────────────────────────────────────────────────────────────

function cmdMigrate(flags) {
  const path = findConfig(flags)
  if (!path) fail('No fluid.config.json found.', 2)
  const json = readJson(path)
  if (!isV1(json)) {
    console.log(`${relative(process.cwd(), path)} is already v${CONFIG_VERSION}.`)
    return
  }
  const { $schema, ...v1 } = json
  let m
  try {
    m = migrateV1(v1)
  } catch (err) {
    fail(err.message, 2)
  }
  const det = detectProject(dirname(path))
  const structure = { ...m.structure, output: { dir: det.outDir, stack: det.stack, integration: det.integration } }
  const out = { $schema: './fluid.config.schema.json', ...minimalStructure(structure) }
  const text = prettyJson(out) + '\n'
  const settings = Object.entries(m.settings)
  const snippet = settings.length ? `:root {\n${settings.map(([k, v]) => `  ${k}: ${num(v)};`).join('\n')}\n}` : null
  console.log(c.bold('What moved:'))
  for (const n of m.notes) console.log(`  - ${n}`)
  console.log('')
  console.log(c.bold('fluid.config.json (v2):'))
  console.log(text)
  if (snippet) {
    console.log(c.bold("Settings your v1 config set — put these in your globals.css :root, next to your tokens:"))
    console.log(snippet)
    console.log('')
  } else console.log(c.dim('Every v1 number you set matches a v2 default: no settings to carry over.\n'))
  if (flags.write) {
    const backup = path.replace(/\.json$/, '.v1.json')
    copyFileSync(path, backup)
    writeFileSync(path, text)
    writeFileSync(join(dirname(path), 'fluid.config.schema.json'), JSON.stringify(jsonSchema(), null, 2) + '\n')
    console.log(`${c.green('✓')} wrote ${relative(process.cwd(), path)} (v1 kept as ${relative(process.cwd(), backup)}) and fluid.config.schema.json`)
    console.log(`Next: add the settings above to your CSS, run ${c.bold('fluid generate')}, and replace your old fluid imports with the one ${c.bold("@import './fluid/fluid.css'")}.`)
  } else console.log(c.dim('Dry run. Re-run with --write to replace fluid.config.json (the v1 file is kept as fluid.config.v1.json).'))
}

// ── init ────────────────────────────────────────────────────────────────

const GLOBALS_CANDIDATES = ['src/app/globals.css', 'app/globals.css', 'src/styles/globals.css', 'styles/globals.css', 'src/index.css', 'src/main.css', 'src/styles/main.css', 'src/style.css']

function detectProject(root) {
  let pkg = {}
  try {
    pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  } catch {}
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  const integration = deps.next ? 'next' : deps.vite ? 'vite' : 'none'
  const stack = deps.tailwindcss ? 'tailwind-v4' : deps.sass || deps['sass-embedded'] ? 'scss' : deps['@stylexjs/stylex'] ? 'stylex' : 'css'
  const globals = GLOBALS_CANDIDATES.find((f) => existsSync(join(root, f))) ?? null
  const srcStyles = existsSync(join(root, 'src')) ? 'src/styles/fluid' : 'styles/fluid'
  return { integration, stack, globals, outDir: globals && dirname(globals) !== 'src/app' && dirname(globals) !== 'app' ? `${dirname(globals)}/fluid` : srcStyles }
}

function cmdInit(flags) {
  const root = process.cwd()
  const configPath = join(root, 'fluid.config.json')
  if (existsSync(configPath) && !flags.force) fail(`fluid.config.json already exists. ${isV1(readJson(configPath)) ? `It is v1: run ${c.bold('fluid migrate --write')}.` : `Run ${c.bold('fluid generate')}, or init --force to start over.`}`, 2)
  const det = detectProject(root)
  const brownfield = !!flags.brownfield
  const structure = {
    $schema: './fluid.config.schema.json',
    version: CONFIG_VERSION,
    output: {
      dir: flags.out ?? det.outDir,
      stack: flags.stack ?? det.stack,
      base: !brownfield,
      integration: flags.integration ?? det.integration
    }
  }
  try {
    normaliseStructure(structure)
  } catch (err) {
    fail(err.message, 2)
  }
  const { $schema, ...rest } = structure
  writeFileSync(configPath, prettyJson({ $schema, ...minimalStructure(rest) }) + '\n')
  writeFileSync(join(root, 'fluid.config.schema.json'), JSON.stringify(jsonSchema(), null, 2) + '\n')
  console.log(`${c.green('✓')} fluid.config.json (${structure.output.stack}, ${structure.output.integration === 'none' ? 'no framework integration' : structure.output.integration}${brownfield ? ', brownfield: base off' : ''})`)
  cmdGenerate({ config: configPath })

  const p = project({ config: configPath })
  const tw = p.structure.output.stack === 'tailwind-v4'
  const globalsPath = flags.css ? resolvePath(flags.css) : det.globals ? join(root, det.globals) : null
  const importPath = globalsPath ? toImport(relative(dirname(globalsPath), join(p.outDir, 'fluid.css'))) : `./${p.structure.output.dir}/fluid.css`
  const refPath = toImport(relative(globalsPath ? dirname(globalsPath) : root, join(p.outDir, 'settings.reference.css')))
  const starterLines = [`  /* fluid settings — uncomment to change; every one is in ${refPath} */`, '  /* --fluid-phone-scale-min: 0.82; */', '  /* --fluid-desktop-display-damping: 0.62; */']
  const importLine = `@import '${importPath}';`
  if (globalsPath && existsSync(globalsPath) && !brownfield) {
    let css = readFileSync(globalsPath, 'utf8')
    if (!css.includes(importPath)) {
      const tailwindImport = /@import\s+['"]tailwindcss['"][^;]*;\n?/.exec(css)
      css = tailwindImport ? css.replace(tailwindImport[0], `${tailwindImport[0].trimEnd()}\n${importLine}\n`) : `${importLine}\n${css}`
      // Settings sit with your tokens: inside your first top-level :root, or a new one.
      const rootRule = /^:root\s*\{/m.exec(css)
      if (rootRule) {
        let depth = 0
        let i = rootRule.index + rootRule[0].length - 1
        for (; i < css.length; i++) {
          if (css[i] === '{') depth++
          else if (css[i] === '}' && --depth === 0) break
        }
        const before = css.slice(0, i).replace(/\s*$/, '')
        css = `${before}\n\n${starterLines.join('\n')}\n${css.slice(i)}`
      } else css = `${css.trimEnd()}\n\n:root {\n${starterLines.join('\n')}\n}\n`
      writeFileSync(globalsPath, css)
      console.log(`${c.green('✓')} ${relative(root, globalsPath)}: added ${importLine}, and a commented settings starter in your :root`)
    }
  } else {
    console.log('')
    console.log(c.bold(`Add to ${globalsPath ? relative(root, globalsPath) : 'your global CSS'}${tw ? ", after @import 'tailwindcss';" : ''}:`))
    console.log(`  ${importLine}`)
    console.log(c.dim('  and set any settings you want to change in your :root (settings.reference.css lists them).'))
  }
  // An existing cn (shadcn's lib/utils.ts, …): keep it, add the plugin.
  if (tw) {
    const existing = mergeWithoutFluid(root, p.outDir)
    if (existing.length) {
      const cnImport = toImport(relative(dirname(existing[0]), join(p.outDir, 'cn'))).replace(/\.ts$/, '')
      console.log('')
      console.log(c.bold(`You already have a cn: ${relative(root, existing[0])}. Keep it and teach it the fluid classes:`))
      console.log(`  import { extendTailwindMerge } from 'tailwind-merge'`)
      console.log(`  import { withFluid } from '${cnImport}'`)
      console.log(`  const twMerge = extendTailwindMerge(withFluid)   // instead of importing twMerge directly`)
      console.log(c.dim('  (already extending it? pass withFluid as the next argument: extendTailwindMerge({ extend: … }, withFluid))'))
    }
  }

  // Editor autocomplete for the settings in CSS files (VS Code custom data).
  const vsc = join(root, '.vscode/settings.json')
  const dataRel = toImport(relative(root, join(p.outDir, 'fluid.css-data.json'))).replace(/^\.\//, '')
  if (existsSync(vsc)) {
    try {
      const cur = JSON.parse(readFileSync(vsc, 'utf8'))
      const list = new Set([...(cur['css.customData'] ?? []), dataRel])
      cur['css.customData'] = [...list]
      writeFileSync(vsc, JSON.stringify(cur, null, 2) + '\n')
      console.log(`${c.green('✓')} .vscode/settings.json: settings autocomplete (css.customData)`)
    } catch {
      console.log(c.dim(`  (could not parse .vscode/settings.json; add "css.customData": ["${dataRel}"] for settings autocomplete)`))
    }
  } else console.log(c.dim(`  settings autocomplete in VS Code: add "css.customData": ["${dataRel}"] to .vscode/settings.json`))
  if (p.structure.zoom) {
    console.log('')
    console.log(c.bold('Browser zoom:'))
    if (p.structure.output.integration === 'next') console.log(`  app/layout.tsx:  import { FluidHead } from '…/${p.structure.output.dir}/integrations/next'  →  <head><FluidHead /></head>`)
    else if (p.structure.output.integration === 'vite') console.log(`  vite.config.ts:  import { fluidPlugin } from './${p.structure.output.dir}/integrations/vite'  →  plugins: [fluidPlugin()]`)
    else console.log(`  inline FLUID_ZOOM_INLINE from ${p.structure.output.dir}/runtime/zoom.js in a <script> at the top of <head>`)
  }
  console.log('')
  console.log(`Then: ${c.bold('fluid check')} · ${c.bold('fluid explain 390x844')}`)
}

function toImport(rel) {
  const p = rel.split(sep).join('/')
  return p.startsWith('.') ? p : `./${p}`
}

// ── tools ───────────────────────────────────────────────────────────────

function runTool(script, args) {
  const r = spawnSync(process.execPath, [join(SCRIPTS, script), ...args], { stdio: 'inherit' })
  process.exit(r.status ?? 1)
}

// ── main ────────────────────────────────────────────────────────────────

const HELP = `fluid ${SKILL_VERSION} — fluid-design

  fluid init [--brownfield] [--stack tailwind-v4|css|scss|stylex] [--integration next|vite|none] [--out dir] [--css globals.css]
      write fluid.config.json, generate, and wire the one import (brownfield: print it instead)
  fluid generate [--dry] [--force]      write output.dir from fluid.config.json
  fluid check                           config, generated files, settings lint — non-zero on problems (CI)
  fluid settings [--json]               every setting with its default
  fluid explain <W>x<H> [--zoom 1.5] [--url http://localhost:3000]
                                        the band, every unit, and where each value came from
  fluid migrate [--write]               convert a v1 config
  fluid calc | probe | verify | audit   the tools (calc.mjs, probe.mjs, verify-matrix.mjs, audit.mjs)

  --config <file>   use this config instead of the nearest fluid.config.json`

async function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  const tools = { calc: 'calc.mjs', probe: 'probe.mjs', verify: 'verify-matrix.mjs', audit: 'audit.mjs' }
  if (tools[cmd]) return runTool(tools[cmd], rest)
  const { _, flags } = parse(rest)
  switch (cmd) {
    case 'init':
      return cmdInit(flags)
    case 'generate':
      return cmdGenerate(flags)
    case 'check':
      return cmdCheck(flags)
    case 'settings':
      return cmdSettings(flags)
    case 'explain':
      return cmdExplain(flags, _)
    case 'migrate':
      return cmdMigrate(flags)
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(HELP)
      return
    case '--version':
    case '-v':
      console.log(SKILL_VERSION)
      return
    default:
      fail(`unknown command "${cmd}"\n\n${HELP}`, 2)
  }
}

const isMain = process.argv[1] && pathToFileURL(resolvePath(process.argv[1])).href === import.meta.url
if (isMain || process.argv[1]?.endsWith(`${sep}bin${sep}fluid`)) {
  main().catch((err) => fail(err instanceof ConfigError ? err.message : err.stack ?? String(err), 2))
}
