#!/usr/bin/env node
// cli.mjs — the `fluid` command. bin/fluid runs this.
//
//   fluid init [--brownfield] [--stack s] [--integration next|vite|none] [--out dir] [--force]
//   fluid generate [--force] [--dry]
//   fluid check
//   fluid settings [--json]
//   fluid explain <W>x<H> [--zoom z] [--url http://…]
//   fluid migrate [--write]
//   fluid probe <url>                       (= explain 1440x900 --url <url> --brief)
//   fluid calc | verify | audit …           (the tools under scripts/)
//
// Every command finds fluid.config.json by walking up from the current
// directory, or takes --config <file>.

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, readdirSync, statSync, watch } from 'node:fs'
import { dirname, join, relative, resolve as resolvePath, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createInterface } from 'node:readline'
import { normaliseStructure, settingsSpec, jsonSchema, structureDefaults, ConfigError, SKILL_VERSION, CONFIG_VERSION, bandBlurb, didYouMean, STACKS, INTEGRATIONS } from './lib/spec.mjs'
import { loadProject, readJson, isV1, migrateV1, resolveSettings, evaluate, valuesOf, bandAt, bandMedia } from './lib/model.mjs'
import { buildOutput, fileHash, settingsReferenceCss } from './lib/emit/project.mjs'
import { scanProject, projectStyleFiles, scanDeclarations } from './lib/settings.mjs'
import { findImportInsertion, findRootBlock, hasBaseRules } from './lib/css-scan.mjs'
import { num, scopeSelector } from './lib/emit/engine.mjs'

const LOCK = '.fluid.lock.json'

// ── args ────────────────────────────────────────────────────────────────

/** --flag value, --flag=value, --flag (true). A repeated flag collects an
 * array. --set always takes the next argument, even one starting with --
 * (--set --fluid-desktop-scale-max=1.4). */
const REPEATABLE = new Set(['set'])
function parse(argv) {
  const out = { _: [], flags: {} }
  const put = (k, v) => {
    if (REPEATABLE.has(k)) (out.flags[k] ??= []).push(v)
    else out.flags[k] = v
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq > 2) {
        put(a.slice(2, eq), a.slice(eq + 1))
        continue
      }
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && (REPEATABLE.has(key) || !next.startsWith('--'))) {
        put(key, next)
        i++
      } else put(key, true)
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

/** A message for the user and an exit code. Thrown, never exited on the
 * spot: only run() turns it into an exit, so the watcher and init can catch
 * it and carry on (or roll back). */
export class CliError extends Error {
  constructor(message, code = 1) {
    super(message)
    this.code = code
  }
}

function fail(message, code = 1) {
  throw new CliError(message, code)
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
function diffOutput(outDir, files) {
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

function cmdGenerate(flags) {
  const p = project(flags)
  const { files, buildId } = buildOutput(p.structure)
  const { rows } = diffOutput(p.outDir, files)
  const edited = rows.filter((r) => r.state === 'hand-edited' || r.state === 'unowned')
  if (edited.length && !flags.force) {
    const why = (r) => (r.state === 'unowned' ? `${r.rel} (no ${LOCK} to tell whether it was edited)` : r.rel)
    fail(`${c.red('Refusing to overwrite hand-edited files')} in ${relative(process.cwd(), p.outDir) || '.'}:\n${edited.map((r) => `  ${why(r)}`).join('\n')}\nThese are generated. Move your change into fluid.config.json or a setting, then run ${c.bold('fluid generate --force')}.`)
  }
  const changed = rows.filter((r) => r.state !== 'ok' && r.state !== 'orphan-edited')
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
  for (const r of rows.filter((r) => r.state === 'orphan-edited')) console.log(c.yellow(`! kept ${r.rel}: no longer generated, but edited since — delete it yourself if it's unused`))
  const reformatted = rows.filter((r) => r.state === 'reformatted')
  if (reformatted.length) console.log(c.yellow(`! ${reformatted.length} file(s) had been reformatted by a formatter; regenerated. ${formatterHint(p)}`))
  const lock = { generator: `fluid-design ${SKILL_VERSION}`, build: buildId, stack: p.structure.output.stack, files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, fileHash(v)])) }
  writeFileSync(join(p.outDir, LOCK), JSON.stringify(lock, null, 2) + '\n')
  const out = relative(process.cwd(), p.outDir) || '.'
  console.log(`${c.green('✓')} ${out}: ${Object.keys(files).length} files (${changed.length} changed) · build ${buildId}`)
}

// ── formatters ──────────────────────────────────────────────────────────

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

function formatterHint(p) {
  const rel = relative(p.dir, p.outDir).split(sep).join('/')
  const f = detectFormatter(p.dir)
  if (f === 'biome') return `exclude ${rel}/ in biome.json (files.ignore)`
  return `add ${rel}/ to .prettierignore (or your formatter's ignore list)`
}

/** init: keep a formatter off the generated folder. Prettier's ignore file
 * is plain text, so it is edited; biome.json may carry comments, so it is
 * only named. Returns a line to print, or null. */
function ignoreForFormatter(root, outDir) {
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

// ── check ───────────────────────────────────────────────────────────────

async function cmdCheck(flags) {
  const path = findConfig(flags)
  if (!path) fail(`No fluid.config.json found here or above. Start with ${c.bold('fluid init')}.`, 2)
  const json = readJson(path)
  if (isV1(json)) fail(`${c.red('✗')} fluid.config.json is v1. Run ${c.bold('fluid migrate --write')}.`, 1)
  const p = project(flags)
  let errors = 0
  let warns = 0

  // 1. generated files
  const { files } = buildOutput(p.structure)
  const { rows, lock } = diffOutput(p.outDir, files)
  // A formatter's rewrite and a kept orphan are warnings; the rest fail.
  const soft = new Set(['reformatted', 'orphan-edited'])
  const bad = rows.filter((r) => r.state !== 'ok')
  // Two versions of the CLI (a teammate's binary, CI's npx) generate
  // different stamps: name it, instead of a list of "stale" files.
  if (lock?.generator && lock.generator !== `fluid-design ${SKILL_VERSION}`) {
    console.log(`${c.yellow('!')} ${relative(process.cwd(), p.outDir)} was generated by ${lock.generator}; this is fluid-design ${SKILL_VERSION}. Pin one version (npx fluid-design-cli@<version>, or the same binary) across the team and CI, or run ${c.bold('fluid generate')} with this one.`)
    warns++
  }
  if (bad.length) {
    errors += bad.filter((r) => !soft.has(r.state)).length
    warns += bad.filter((r) => soft.has(r.state)).length
    console.log(`${c.red('✗')} generated files are out of date (${relative(process.cwd(), p.outDir)}):`)
    for (const r of bad) {
      const why = { missing: 'missing', stale: 'config or CLI version changed since the last generate', reformatted: `reformatted by a formatter (${formatterHint(p)})`, 'hand-edited': 'edited by hand (it will be overwritten)', unowned: `differs, and there is no ${LOCK} to tell whether by hand`, orphan: 'no longer generated', 'orphan-edited': 'no longer generated, and edited since (generate keeps it)' }[r.state]
      console.log(`    ${r.rel} — ${why}`)
    }
    console.log(`  run ${c.bold('fluid generate')}${bad.some((r) => r.state === 'hand-edited') ? ' (after moving hand edits into a setting)' : ''}`)
  } else console.log(`${c.green('✓')} generated files match fluid.config.json`)

  // 2. settings (info notes, like "your own --fluid-space-s token", only with --verbose)
  const { findings } = scanProject(p.structure, p.dir, p.outDir)
  let infos = 0
  for (const f of findings) {
    if (f.level === 'info') infos++
    if (f.level === 'info' && !flags.verbose) continue
    const tag = f.level === 'error' ? c.red('✗') : f.level === 'warn' ? c.yellow('!') : c.dim('i')
    console.log(`${tag} ${f.file}:${f.line} ${f.message}`)
    if (f.level === 'error') errors++
    if (f.level === 'warn') warns++
  }
  if (findings.length === infos) console.log(`${c.green('✓')} settings: nothing to flag${infos ? c.dim(` (${infos} note(s): fluid check --verbose)`) : ''}`)

  // 3. Source rules (the audit's, self-tested): a limit on <header>, a
  //    tailwind-merge without withFluid, band variants mixed with
  //    breakpoints, the removed fluid-desktop:, limits on children,
  //    line-height modifiers that read as ratios.
  const { runAudit, CHECK_RULES } = await import('./audit.mjs')
  const audit = runAudit({ root: p.dir, prefix: p.structure.prefix, desktopVariant: 'lg', roles: p.structure.roles, stack: p.structure.output.stack, outDir: p.outDir, rules: CHECK_RULES })
  for (const f of audit) {
    if (f.severity === 'info' && !flags.verbose) continue
    const tag = f.severity === 'error' ? c.red('✗') : f.severity === 'warn' ? c.yellow('!') : c.dim('i')
    console.log(`${tag} ${f.rel}:${f.line} ${f.why} ${c.dim(f.fix)}`)
    if (f.severity === 'error') errors++
    if (f.severity === 'warn') warns++
  }

  // 4. The px breakpoint ladder replaces @theme's; a rung you declare too
  //    (a rem md: sorts after the px 2xl:) reorders the variants.
  if (p.structure.output.stack === 'tailwind-v4' && p.structure.tailwind.breakpoints === 'ladder') {
    for (const f of projectStyleFiles(p.dir, p.outDir)) {
      const text = readFileSync(f, 'utf8')
      for (const m of text.matchAll(/--breakpoint-([\w-]+)\s*:\s*([^;]+);/g)) {
        errors++
        const line = text.slice(0, m.index).split('\n').length
        console.log(`${c.red('✗')} ${relative(p.dir, f)}:${line} --breakpoint-${m[1]}: ${m[2].trim()} competes with the fluid px ladder (fluid.css sets sm-2xl, lg = the desktop band). Remove it, or set "tailwind": { "breakpoints": "none" } in fluid.config.json and keep your own (lg must then be ${p.structure.bands.desktop.minWidth}px).`)
      }
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
  process.exitCode = errors ? 1 : 0
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

function parseZoom(v) {
  if (v === undefined) return 1
  const z = Number(v)
  if (!Number.isFinite(z) || z < 0.25 || z > 5) fail(`--zoom wants a factor between 0.25 and 5 (1.5 = 150%), got ${JSON.stringify(v)}`, 2)
  return z
}

async function cmdExplain(flags, args) {
  const [w, h] = parseWxH(args[0])
  const zoom = parseZoom(flags.zoom)
  if (flags.at && !flags.url) fail('--at reads an element on a live page: add --url http://localhost:3000 (offline, --set --fluid-grow-until=1680 asks the same what-if)', 2)
  if (flags.url) return explainLive(flags, w, h, zoom)
  const p = project(flags)
  const extra = Object.fromEntries(Object.entries(settingsFromFlags(p.structure, flags)).map(([k, v]) => [k, { value: v, source: '--set' }]))
  const { overrides, variants = [] } = scanProject(p.structure, p.dir, p.outDir)
  printExplain(p.structure, resolveSettings(p.structure, { ...overrides, ...extra }), w, h, zoom, Object.keys(extra).length ? 'settings from your CSS, top-level :root, plus --set' : 'settings from your CSS, top-level :root')
  if (variants.length) {
    console.log('')
    console.log(c.dim('  also set under a condition (not applied above):'))
    for (const v of variants) console.log(c.dim(`    ${v.name}: ${num(v.value)}  on ${v.selector}  ← ${v.source}`))
  }
}

/** explain --url (and probe): the live page against the model. Verdicts and
 * exit codes: OK 0 · STALE / MISMATCH / V1 1 · MISSING 2. A v1 config works
 * too: its migrated numbers are the expectation (a v1 page has no v2
 * settings to read). */
async function explainLive(flags, w, h, zoom) {
  if (IS_BINARY) needsNode('fluid explain --url')
  const { readLive, LiveError } = await import('./lib/live.mjs')
  const { loadContext } = await import('./lib/context.mjs')
  let ctx
  try {
    ctx = loadContext(flags.config)
  } catch (err) {
    fail(err.message, 2)
  }
  const structure = ctx.structure
  const at = typeof flags.at === 'string' ? flags.at : null
  const extra = Object.fromEntries(Object.entries(settingsFromFlags(structure, flags)).map(([k, v]) => [k, { value: v, source: '--set' }]))
  let live
  try {
    live = await readLive(flags.url, { w, h, structure, at, zoom: flags.zoom === undefined ? null : zoom })
  } catch (err) {
    if (err instanceof LiveError) fail(err.message, 2)
    throw err
  }
  let resolved
  if (ctx.migration) resolved = ctx.resolved
  else {
    // Registered settings always compute to a value; only a non-default one was set by the page.
    const defaults = Object.fromEntries(settingsSpec(structure).map((x) => [x.name, x.default]))
    for (const [k, o] of Object.entries(live.overrides)) if (o.value === defaults[k]) delete live.overrides[k]
    resolved = resolveSettings(structure, { ...live.overrides, ...extra })
  }
  const label = `${ctx.migration ? 'v1 config (migrated in memory); ' : ''}settings read ${at ? `at ${at} on` : 'from'} ${flags.url}${flags.zoom !== undefined ? `, emulated zoom ${zoom} (the runtime's variable, not browser zoom: fluid verify covers that)` : ''}`
  if (!flags.brief) printExplain(structure, resolved, w, h, zoom, label)
  const e = evaluate(structure, valuesOf(resolved), w, h, zoom)
  const got = live.units
  const rows = [['--fluid', e.fluid, got.fluid], ...structure.roles.map((r) => [`--fluid-${r}`, e.roles[r], got[r]]), ...(structure.ui ? [['--fluid-ui', e.ui, got.ui]] : [])]
  let worst = 0
  for (const [, exp, g] of rows) worst = Math.max(worst, Math.abs(exp - g))
  const expectedBuild = ctx.migration ? null : buildOutput(structure).buildId
  console.log('')
  if (flags.brief) {
    console.log(`  ${flags.url} @ ${w}x${h} (${e.band})`)
    for (const [n, exp, g] of rows) console.log(`  ${n.padEnd(18)} page ${Number.isFinite(g) ? g.toFixed(4) : 'NaN'}   expected ${exp.toFixed(4)}`)
    console.log('')
  }
  let verdict
  if (!(got.fluid > 0)) verdict = 'MISSING'
  else if (!ctx.migration && !live.build) verdict = 'V1'
  else if (expectedBuild && live.build !== expectedBuild) verdict = 'STALE'
  else if (worst >= 0.002 && !Object.keys(extra).length) verdict = at && !live.isScope ? 'NOT-A-SCOPE' : 'MISMATCH'
  else verdict = 'OK'
  const say = {
    OK: c.green(`  ✓ OK: the ${at ? 'element' : 'page'}'s units match (worst drift ${worst.toExponential(1)})${Object.keys(extra).length ? c.dim(' — --set changes the prediction only; the page is measured as it is') : ''}`),
    MISSING: c.red('  ✗ MISSING: no fluid unit resolves here — this page does not load the fluid stylesheet (wrong URL or build, or not wired up)'),
    V1: c.yellow('  ! V1: the page runs a stylesheet with no --fluid-build stamp (v1, or hand-written); this config is v2: fluid generate, then load the new fluid.css'),
    STALE: c.red(`  ✗ STALE: the page was built from ${live.build}; this config generates ${expectedBuild}. Run fluid generate, then close the tab and open a fresh one; if it persists, clear the build cache (rm -rf .next) and restart the dev server`),
    MISMATCH: c.red(`  ✗ MISMATCH: current build, but the units drift by up to ${worst.toFixed(4)} — a hand-edited fluid.css, or a setting redeclared where fluid check doesn't look`),
    'NOT-A-SCOPE': c.red(`  ✗ ${at} sets fluid settings but is not a scope, so its units are its nearest scope's. Add a limit utility, class="${structure.prefix}-scope" or data-fluid-scope to it.`)
  }[verdict]
  console.log(say)
  if (!at && !flags.brief) printScopes(structure, live)
  process.exitCode = verdict === 'OK' ? 0 : verdict === 'MISSING' ? 2 : 1
}

/** fluid probe <url> [--width 1440] [--height 900]: the one-shot freshness
 * check, now explain --url --brief. */
async function cmdProbe(flags, args) {
  if (!args[0]) fail('fluid probe <url> [--width 1440] [--height 900]  (the same as: fluid explain 1440x900 --url <url> --brief)', 2)
  return explainLive({ ...flags, url: args[0], brief: true }, Number(flags.width ?? 1440), Number(flags.height ?? 900), 1)
}

/** Every scope on the page (limit utilities, fluid-scope, data-fluid-scope):
 * its settings, its units against the page's, and how many elements inside
 * follow the scale. A limit with nothing to limit is a warning. */
function printScopes(structure, live) {
  if (!live.scopes.length) return
  console.log('')
  console.log(`  scopes on this page (${live.scopes.length}${live.scopesTruncated ? '+' : ''}):`)
  for (const s of live.scopes) {
    const units = ['fluid', ...(structure.ui ? ['ui'] : [])].map((u) => `${u} ${s.units[u].toFixed(4)}${Math.abs(s.units[u] - live.units[u]) > 5e-4 ? c.dim(` (page ${live.units[u].toFixed(4)})`) : ''}`).join('  ')
    const set = Object.entries(s.settings).map(([k, v]) => `${k}: ${v}`).join('; ')
    console.log(`    ${c.bold(s.label)}`)
    console.log(`      ${set || c.dim('no settings of its own')}`)
    console.log(`      ${units}`)
    if (s.following === null) console.log(c.dim(`      the unit is 1 here, so what follows it can't be told apart; try another viewport`))
    else if (s.following === 0) console.log(`      ${c.yellow('!')} nothing inside is sized with fluid units: this ${s.limit ? 'limit' : 'scope'} does nothing. Move it to the element whose children use the fluid classes, or remove it.`)
    else console.log(c.dim(`      ${s.following} element(s) inside follow the scale`))
  }
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

const GLOBALS_CANDIDATES = [
  // Node frameworks
  'src/app/globals.css', 'app/globals.css', 'src/styles/globals.css', 'styles/globals.css', 'src/index.css', 'src/main.css', 'src/styles/main.css', 'src/style.css',
  'src/app/globals.scss', 'app/globals.scss', 'styles/globals.scss', 'src/styles/main.scss', 'src/main.scss', 'styles/main.scss',
  // no Node: Rails, Phoenix, Hugo, Django, plain HTML
  'app/assets/stylesheets/application.css', 'app/assets/stylesheets/application.scss', 'app/assets/tailwind/application.css', 'assets/css/app.css', 'assets/css/main.css', 'assets/scss/main.scss', 'static/css/main.css', 'static/css/style.css', 'css/style.css', 'style.css', 'styles.css'
]

function detectProject(root) {
  let pkg = {}
  try {
    pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  } catch {}
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  const integration = deps.next ? 'next' : deps.vite ? 'vite' : 'none'
  const globals = GLOBALS_CANDIDATES.find((f) => existsSync(join(root, f))) ?? null
  const globalsText = globals ? readFileSync(join(root, globals), 'utf8') : ''
  // Tailwind 3 has no @utility/@custom-variant: the css stack, spent through arbitrary values.
  const twVersion = String(deps.tailwindcss ?? '').replace(/^[^\d]*/, '')
  const tailwind3 = /^[0-3](\.|$)/.test(twVersion) || /@tailwind\s+(base|utilities)/.test(globalsText)
  const tailwind4 = !tailwind3 && (!!deps.tailwindcss || /@import\s+['"]tailwindcss['"]/.test(globalsText))
  const stack = tailwind4 ? 'tailwind-v4' : deps.sass || deps['sass-embedded'] || /\.s[ac]ss$/.test(globals ?? '') ? 'scss' : deps['@stylexjs/stylex'] ? 'stylex' : 'css'
  const srcStyles = existsSync(join(root, 'src')) ? 'src/styles/fluid' : 'styles/fluid'
  // An existing site styles html/body itself: leave the base layer out.
  const brownfield = hasBaseRules(globalsText)
  // Breakpoints the site declares itself: keep them, leave the ladder out.
  const ownBreakpoints = [...globalsText.matchAll(/--breakpoint-([\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])
  return { integration, stack, tailwind3, ownBreakpoints, globals, brownfield, node: !!pkg.name || Object.keys(deps).length > 0, outDir: globals && !['src/app', 'app', '.'].includes(dirname(globals)) ? `${dirname(globals)}/fluid` : srcStyles }
}

/** --set name=value (repeatable) and --fluid-*=value → { '--fluid-…': number },
 * validated against the settings spec. */
function settingsFromFlags(structure, flags) {
  const specs = settingsSpec(structure)
  const byName = new Map(specs.map((x) => [x.name, x]))
  const pairs = [...(flags.set ?? []).map((a) => String(a)), ...Object.entries(flags).filter(([k]) => k.startsWith('fluid-')).map(([k, v]) => `${k}=${v}`)]
  const out = {}
  for (const pair of pairs) {
    const eq = pair.lastIndexOf('=')
    if (eq < 1) fail(`--set wants name=value, got ${JSON.stringify(pair)} (e.g. --set --fluid-desktop-scale-max=1.4)`, 2)
    const bare = pair.slice(0, eq).replace(/^-+/, '')
    const name = [`--${bare}`, `--fluid-${bare}`].find((n) => byName.has(n))
    if (!name) {
      const guess = didYouMean(`--${bare.startsWith('fluid-') ? bare : `fluid-${bare}`}`, [...byName.keys()])
      fail(`unknown setting ${pair.slice(0, eq)}${guess ? ` — did you mean ${guess}?` : ''} (fluid settings lists them)`, 2)
    }
    out[name] = checkSettingValue(byName.get(name), pair.slice(eq + 1))
  }
  return out
}

function checkSettingValue(spec, raw) {
  const v = Number(String(raw).trim())
  const bad = (why) => fail(`${spec.name}: ${JSON.stringify(raw)} ${why}`, 2)
  if (String(raw).trim() === '' || !Number.isFinite(v)) bad('is not a plain number (settings take no units)')
  if (spec.min !== undefined && v < spec.min) bad(`is below ${spec.min}`)
  if (spec.max !== undefined && v > spec.max) bad(`is above ${spec.max}`)
  if (spec.integer && !Number.isInteger(v)) bad('must be a whole number')
  return v
}

/** Questions on a TTY (or --interactive); answers come line by line, so a
 * script can pipe them in. EOF or an empty line takes the default. */
function prompter() {
  const rl = createInterface({ input: process.stdin, terminal: false })
  const lines = rl[Symbol.asyncIterator]()
  let closed = false
  return {
    async ask(question, def, check = (v) => v) {
      for (let tries = 0; tries < 5; tries++) {
        process.stdout.write(`${c.bold('?')} ${question} ${c.dim(`(${def === '' ? 'none' : def})`)} `)
        const next = closed ? { done: true } : await lines.next()
        if (next.done) closed = true
        const raw = next.done ? '' : next.value.trim()
        if (!process.stdin.isTTY) process.stdout.write(`${raw}\n`)
        if (raw === '') return def
        const v = check(raw)
        if (v !== undefined) return v
        console.log(c.red(`  ${JSON.stringify(raw)} is not one of the options`))
      }
      return def
    },
    close: () => rl.close()
  }
}

const oneOf = (list) => (v) => (list.includes(v) ? v : undefined)
const yesNo = (v) => (/^(y|yes)$/i.test(v) ? true : /^(n|no)$/i.test(v) ? false : undefined)
const posInt = (v) => (/^\d+$/.test(v) && Number(v) > 0 ? Number(v) : undefined)
const wxh = (v) => {
  const m = /^(\d+)\s*[x×*]\s*(\d+)$/i.exec(v)
  return m ? [Number(m[1]), Number(m[2])] : undefined
}

async function cmdInit(flags) {
  const root = process.cwd()
  const configPath = join(root, 'fluid.config.json')
  const existingV1 = existsSync(configPath) && isV1(readJson(configPath))
  if (existsSync(configPath) && !flags.force) fail(`fluid.config.json already exists. ${existingV1 ? `It is v1: run ${c.bold('fluid migrate --write')}.` : `Run ${c.bold('fluid generate')}, or init --force to start over.`}`, 2)
  const det = detectProject(root)
  if (det.tailwind3) console.log(c.yellow(`! Tailwind 3 found: the fluid utilities need Tailwind 4 (@utility). Using the css stack: spend the units in arbitrary values, e.g. p-[calc(24*var(--fluid))].`))
  const defaults = Object.fromEntries(settingsSpec(normaliseStructure({})).map((x) => [x.name, x.default]))
  const flagWxH = (k) => (flags[k] === undefined ? undefined : wxh(String(flags[k])) ?? fail(`--${k} wants WIDTHxHEIGHT, e.g. 1440x900`, 2))
  const flagInt = (k) => (flags[k] === undefined ? undefined : posInt(String(flags[k])) ?? fail(`--${k} wants a whole number of px`, 2))
  const a = {
    stack: flags.stack ?? det.stack,
    integration: flags.integration ?? det.integration,
    css: flags.css ?? det.globals ?? '',
    brownfield: flags.brownfield ? true : det.brownfield,
    desktop: flagWxH('desktop') ?? [defaults['--fluid-desktop-base-width'], defaults['--fluid-desktop-base-height']],
    desktopAt: flagInt('desktop-at') ?? structureDefaults().bands.desktop.minWidth,
    mobile: !flags['no-mobile'],
    phone: flagInt('phone') ?? defaults['--fluid-phone-base-width'],
    maxWidth: flagInt('max-width') ?? defaults['--fluid-desktop-container-width'],
    out: flags.out
  }
  const interactive = (process.stdin.isTTY && !flags.yes) || !!flags.interactive
  if (interactive) {
    console.log(`${c.bold('fluid init')} ${c.dim('— Enter keeps the default in brackets. Everything here can be changed later.')}\n`)
    const q = prompter()
    a.stack = await q.ask('Styling: tailwind-v4, css, scss or stylex?', a.stack, oneOf(STACKS))
    a.integration = await q.ask('Framework, for the browser-zoom head script: next, vite or none?', a.integration, oneOf(INTEGRATIONS))
    a.css = await q.ask('Global stylesheet (gets the import and your settings; empty = print them instead)', a.css, (v) => v)
    a.brownfield = await q.ask('Does this site already style html and body itself? (y = leave the base layer out)', a.brownfield ? 'y' : 'n', yesNo)
    if (typeof a.brownfield === 'string') a.brownfield = a.brownfield === 'y'
    a.desktop = await q.ask('Desktop design frame, width x height', a.desktop.join('x'), wxh)
    if (typeof a.desktop === 'string') a.desktop = wxh(a.desktop)
    a.desktopAt = await q.ask('The desktop layout starts at this window width (px)', a.desktopAt, posInt)
    a.mobile = await q.ask('Scale the phone, tablet and landscape layouts too? (n = 1px below desktop)', a.mobile ? 'y' : 'n', yesNo)
    if (typeof a.mobile === 'string') a.mobile = a.mobile === 'y'
    if (a.mobile) a.phone = await q.ask('Phone design frame width', a.phone, posInt)
    a.maxWidth = await q.ask('The page stops widening at (drawn px)', a.maxWidth, posInt)
    const outDefault = a.out ?? (a.css && !['src/app', 'app', '.'].includes(dirname(a.css)) ? `${dirname(a.css)}/fluid` : det.outDir)
    a.out = await q.ask('Generated files go in', outDefault, (v) => v)
    q.close()
    console.log('')
  }
  const brownfield = !!a.brownfield
  const structure = {
    $schema: './fluid.config.schema.json',
    version: CONFIG_VERSION,
    bands: a.mobile ? { desktop: { minWidth: a.desktopAt } } : { phone: false, tablet: false, landscape: false, desktop: { minWidth: a.desktopAt } },
    output: {
      dir: a.out ?? (a.css && !['src/app', 'app', '.'].includes(dirname(a.css)) ? `${dirname(a.css)}/fluid` : det.outDir),
      stack: a.stack,
      base: !brownfield,
      integration: a.integration
    },
    // The site's own --breakpoint-* stay; the px ladder would compete with them.
    ...(a.stack === 'tailwind-v4' && det.ownBreakpoints.length ? { tailwind: { breakpoints: 'none' } } : {})
  }
  let normalised
  try {
    normalised = normaliseStructure(structure)
  } catch (err) {
    fail(err.message, 2)
  }
  // Answers that are settings become declarations in your :root; only what
  // differs from the default is written.
  const byName = new Map(settingsSpec(normalised).map((x) => [x.name, x]))
  const chosen = {
    '--fluid-desktop-base-width': a.desktop[0],
    '--fluid-desktop-base-height': a.desktop[1],
    '--fluid-desktop-container-width': a.maxWidth,
    ...(a.mobile ? { '--fluid-phone-base-width': a.phone } : {}),
    ...settingsFromFlags(normalised, flags)
  }
  const settings = Object.entries(chosen).filter(([k, v]) => byName.has(k) && v !== byName.get(k).default)
  for (const [k, v] of settings) checkSettingValue(byName.get(k), v)

  // Everything is decided and validated before anything is written: the
  // hand-edit guard runs on the target folder first, so a refusal leaves
  // the project exactly as it was.
  const outDir = resolvePath(root, normalised.output.dir)
  const pre = diffOutput(outDir, buildOutput(normalised).files).rows.filter((r) => r.state === 'hand-edited' || r.state === 'unowned')
  if (pre.length && !flags.force) fail(`${c.red('Refusing to overwrite hand-edited files')} in ${relative(root, outDir)}:\n${pre.map((r) => `  ${r.rel}`).join('\n')}\nNothing was written. Run init --force to replace them.`, 2)
  if (existingV1) {
    copyFileSync(configPath, configPath.replace(/\.json$/, '.v1.json'))
    console.log(`${c.yellow('!')} the v1 config is kept as fluid.config.v1.json (fluid migrate would have carried its numbers over; see its notes there)`)
  }
  const { $schema, ...rest } = structure
  writeFileSync(configPath, prettyJson({ $schema, ...minimalStructure(rest) }) + '\n')
  writeFileSync(join(root, 'fluid.config.schema.json'), JSON.stringify(jsonSchema(), null, 2) + '\n')
  console.log(`${c.green('✓')} fluid.config.json (${structure.output.stack}, ${structure.output.integration === 'none' ? 'no framework integration' : structure.output.integration}${brownfield ? ', brownfield: base off' : ''}${a.mobile ? '' : ', flat below desktop'}${structure.tailwind ? ', your own breakpoints kept' : ''})`)
  if (structure.tailwind) {
    const lg = det.ownBreakpoints.find(([k]) => k === 'lg')
    console.log(c.dim(`  your @theme declares --breakpoint-${det.ownBreakpoints.map(([k]) => k).join('/-')}: the px ladder is off ("breakpoints": "none").${lg && lg[1] !== `${normalised.bands.desktop.minWidth}px` ? ` Set --breakpoint-lg: ${normalised.bands.desktop.minWidth}px so lg: and the desktop band switch together (now ${lg[1]}); fluid check enforces it.` : ''}`))
  }
  cmdGenerate({ config: configPath, force: flags.force })
  const fmt = ignoreForFormatter(root, outDir)
  if (fmt) console.log(fmt)

  const p = project({ config: configPath })
  const tw = p.structure.output.stack === 'tailwind-v4'
  const globalsPath = a.css ? resolvePath(root, a.css) : null
  const importPath = globalsPath ? toImport(relative(dirname(globalsPath), join(p.outDir, 'fluid.css'))) : `./${p.structure.output.dir}/fluid.css`
  const refPath = toImport(relative(globalsPath ? dirname(globalsPath) : root, join(p.outDir, 'settings.reference.css')))
  const settingLines = settings.map(([k, v]) => `  ${k}: ${num(v)};`)
  const starterLines = [
    `  /* fluid settings — every one, with its default, is in ${refPath} */`,
    ...settingLines,
    ...(settingLines.length ? [] : ['  /* --fluid-phone-scale-min: 0.82; */', '  /* --fluid-desktop-display-damping: 0.62; */'])
  ]
  const importLine = `@import '${importPath}';`
  const editable = globalsPath && existsSync(globalsPath) && !brownfield && /\.css$/.test(globalsPath)
  if (editable) {
    let css = readFileSync(globalsPath, 'utf8')
    if (!css.includes(importPath)) {
      // Right after @import 'tailwindcss' when there is one, else after any
      // @charset / @import / @layer header (never above @charset).
      const tailwindImport = /@import\s+['"]tailwindcss['"][^;]*;\n?/.exec(css)
      if (tailwindImport) css = css.replace(tailwindImport[0], `${tailwindImport[0].trimEnd()}\n${importLine}\n`)
      else {
        const at = findImportInsertion(css)
        css = `${css.slice(0, at)}${at && !css.slice(0, at).endsWith('\n') ? '\n' : ''}${importLine}\n${css.slice(at)}`
      }
      // Settings sit with your tokens: inside your first top-level :root, or a new one.
      const block = findRootBlock(css)
      if (block) {
        const before = css.slice(0, block.closeIndex).replace(/\s*$/, '')
        css = `${before}\n\n${starterLines.join('\n')}\n${css.slice(block.closeIndex)}`
      } else css = `${css.trimEnd()}\n\n:root {\n${starterLines.join('\n')}\n}\n`
      writeFileSync(globalsPath, css)
      console.log(`${c.green('✓')} ${relative(root, globalsPath)}: added ${importLine}, and ${settingLines.length ? `${settingLines.length} setting(s)` : 'a commented settings starter'} in your :root`)
    }
  } else {
    const scssFile = globalsPath && /\.s[ac]ss$/.test(globalsPath)
    console.log('')
    if (scssFile) {
      console.log(c.bold('Load the engine once, as plain CSS (from your entry: import \'…/fluid.css\', or a <link>):'))
      console.log(`  ${p.structure.output.dir}/fluid.css`)
      console.log(c.bold(`and in ${relative(root, globalsPath)} (and any .scss that draws on the scale):`))
      console.log(`  @use '${toImport(relative(dirname(globalsPath), p.outDir))}' as fd;`)
    } else {
      console.log(c.bold(`Add to ${globalsPath ? relative(root, globalsPath) : 'your global CSS'}${tw ? ", after @import 'tailwindcss';" : ''}:`))
      console.log(`  ${importLine}`)
    }
    console.log(c.bold('and in your :root, next to your tokens:'))
    console.log(`:root {\n${starterLines.join('\n')}\n}`)
  }
  // An existing cn (shadcn's lib/utils.ts, …): keep it, add the plugin.
  if (tw) {
    const { runAudit } = await import('./audit.mjs')
    const existing = [...new Set(runAudit({ root, prefix: p.structure.prefix, stack: p.structure.output.stack, outDir: p.outDir, rules: ['cn-without-withfluid'] }).map((f) => f.file))]
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
    else console.log(`  first thing in <head>:  <script src="/…/${p.structure.output.dir}/runtime/zoom.classic.js"></script>  (served from wherever your static files live; a classic script, not a module, so a page opened zoomed paints right the first time)`)
  }
  console.log('')
  console.log(`Then: ${c.bold('fluid check')} · ${c.bold('fluid explain 390x844')} · change a structure key and ${c.bold('fluid generate')} (or keep ${c.bold('fluid generate --watch')} running)`)
}

function toImport(rel) {
  const p = rel.split(sep).join('/')
  return p.startsWith('.') ? p : `./${p}`
}

// ── tools ───────────────────────────────────────────────────────────────

// In process, not as child processes: inside a compiled binary there is no
// node to spawn and no script files on disk. Each tool reads process.argv
// and runs on import.
const TOOLS = {
  calc: () => import('./calc.mjs'),
  verify: () => import('./verify-matrix.mjs'),
  audit: () => import('./audit.mjs')
}
const BROWSER_TOOLS = new Set(['verify'])

/** A standalone binary (bun build --compile) rather than node running the skill. */
export const IS_BINARY = typeof process.versions.bun === 'string' && import.meta.url.includes('$bunfs')

function needsNode(what) {
  fail(`${what} drives a real browser through Playwright, a Node library, so it runs under Node, not in the standalone binary:\n  npx fluid-design-cli@${SKILL_VERSION.split('.')[0]} ${process.argv.slice(2).join(' ')}\n(in a project with playwright installed: npm i -D playwright && npx playwright install chromium)`, 2)
}

async function runTool(name, args) {
  if (IS_BINARY && BROWSER_TOOLS.has(name)) needsNode(`fluid ${name}`)
  process.argv = [process.argv[0], name, ...args]
  globalThis.__fluidTool = name
  await TOOLS[name]()
}

// ── generate --watch ────────────────────────────────────────────────────

function cmdWatch(flags) {
  const path = findConfig(flags)
  if (!path) fail(`No fluid.config.json found here or above. Start with ${c.bold('fluid init')}.`, 2)
  // An invalid save (a typo'd key, JSON half-written) prints its error and
  // keeps watching: the next save retries.
  const once = () => {
    try {
      cmdGenerate({ ...flags, config: path, watch: undefined })
    } catch (err) {
      console.error(err instanceof CliError || err instanceof ConfigError ? err.message : c.red(err.stack ?? String(err)))
    }
  }
  once()
  console.log(c.dim(`watching ${relative(process.cwd(), path)} — Ctrl+C to stop`))
  let timer
  // Watch the directory: editors often replace the file instead of writing it.
  watch(dirname(path), (event, name) => {
    if (name !== 'fluid.config.json') return
    clearTimeout(timer)
    timer = setTimeout(once, 80)
  })
}

// ── main ────────────────────────────────────────────────────────────────

const HELP = `fluid ${SKILL_VERSION} — fluid-design

  fluid init [--yes] [--brownfield] [--stack tailwind-v4|css|scss|stylex] [--integration next|vite|none]
             [--css path/to/globals.css] [--out dir] [--desktop 1440x900] [--desktop-at 1024]
             [--no-mobile] [--phone 390] [--max-width 1680] [--set --fluid-<setting>=<n> …]
      write fluid.config.json, generate, and wire the one import + your settings. Asks on a
      terminal (Enter keeps each default); --yes, or no terminal, takes the defaults and flags.
  fluid generate [--dry] [--force] [--watch]
                                        write output.dir from fluid.config.json (--watch: on every save)
  fluid check [--verbose]               config, generated files, settings lint, source rules — non-zero on problems (CI)
  fluid settings [--json]               every setting with its default
  fluid explain <W>x<H> [--zoom 1.5] [--set --fluid-grow-until=1680]
                [--url http://localhost:3000 [--at 'header'] [--brief]]
                                        the band, every unit, and where each value came from; --url
                                        reads the live page (and every limited scope on it), --at one
                                        element; ends with a verdict: OK 0 · STALE/MISMATCH/V1 1 · MISSING 2
  fluid migrate [--write]               convert a v1 config
  fluid probe <url> [--width 1440] [--height 900]
                                        one-shot freshness verdict (explain --url --brief)
  fluid calc | verify | audit           the tools (calc.mjs, verify-matrix.mjs, audit.mjs)

  --config <file>   use this config instead of the nearest fluid.config.json`

export async function main(argv = process.argv.slice(2)) {
  const [cmd, ...rest] = argv
  if (TOOLS[cmd]) return runTool(cmd, rest)
  const { _, flags } = parse(rest)
  switch (cmd) {
    case 'init':
      return cmdInit(flags)
    case 'generate':
      return flags.watch ? cmdWatch(flags) : cmdGenerate(flags)
    case 'check':
      return cmdCheck(flags)
    case 'settings':
      return cmdSettings(flags)
    case 'explain':
      return cmdExplain(flags, _)
    case 'probe':
      return cmdProbe(flags, _)
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

/** main() with the CLI's error handling: config errors are messages, not stacks. */
export function run(argv) {
  return main(argv).catch((err) => {
    if (err instanceof CliError) {
      console.error(err.message)
      process.exitCode = err.code
    } else if (err instanceof ConfigError) {
      console.error(err.message)
      process.exitCode = 2
    } else {
      console.error(err.stack ?? String(err))
      process.exitCode = 2
    }
  })
}

const isMain = process.argv[1] && pathToFileURL(resolvePath(process.argv[1])).href === import.meta.url
// In the binary every module shares the entry's URL: bin-entry.mjs is the only caller there.
if (isMain && !IS_BINARY) run()
