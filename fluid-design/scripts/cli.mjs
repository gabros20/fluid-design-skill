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

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, readdirSync, statSync, watch } from 'node:fs'
import { dirname, join, relative, resolve as resolvePath, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { createInterface } from 'node:readline'
import { normaliseStructure, settingsSpec, jsonSchema, structureDefaults, ConfigError, SKILL_VERSION, CONFIG_VERSION, bandBlurb, didYouMean, STACKS, INTEGRATIONS } from './lib/spec.mjs'
import { loadProject, readJson, isV1, migrateV1, resolveSettings, evaluate, valuesOf, bandAt, bandMedia } from './lib/model.mjs'
import { buildOutput, fileHash, settingsReferenceCss } from './lib/emit/project.mjs'
import { scanProject, projectStyleFiles, scanDeclarations } from './lib/settings.mjs'
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
  const { rows, lock } = diffOutput(p.outDir, files)
  const bad = rows.filter((r) => r.state !== 'ok')
  // Two versions of the CLI (a teammate's binary, CI's npx) generate
  // different stamps: name it, instead of a list of "stale" files.
  if (lock?.generator && lock.generator !== `fluid-design ${SKILL_VERSION}`) {
    console.log(`${c.yellow('!')} ${relative(process.cwd(), p.outDir)} was generated by ${lock.generator}; this is fluid-design ${SKILL_VERSION}. Pin one version (npx fluid-design-cli@<version>, or the same binary) across the team and CI, or run ${c.bold('fluid generate')} with this one.`)
    warns++
  }
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
  const extra = Object.fromEntries(Object.entries(settingsFromFlags(p.structure, flags)).map(([k, v]) => [k, { value: v, source: '--set' }]))
  if (flags.at && !flags.url) fail('--at reads an element on a live page: add --url http://localhost:3000 (offline, --set --fluid-grow-until=1680 asks the same what-if)', 2)
  if (flags.url) {
    if (IS_BINARY) needsNode('fluid explain --url')
    const at = typeof flags.at === 'string' ? flags.at : null
    const live = await readLiveSettings(flags.url, w, h, p.structure, at)
    // Registered settings always compute to a value; only a non-default one was set by the page.
    const defaults = Object.fromEntries(settingsSpec(p.structure).map((x) => [x.name, x.default]))
    for (const [k, o] of Object.entries(live.overrides)) if (o.value === defaults[k]) delete live.overrides[k]
    const resolved = resolveSettings(p.structure, { ...live.overrides, ...extra })
    printExplain(p.structure, resolved, w, h, zoom, at ? `settings read at ${at} on ${flags.url}` : `settings read from ${flags.url}`)
    const e = evaluate(p.structure, valuesOf(resolved), w, h, zoom)
    const got = live.units
    console.log('')
    const rows = [['--fluid', e.fluid, got.fluid], ...p.structure.roles.map((r) => [`--fluid-${r}`, e.roles[r], got[r]]), ...(p.structure.ui ? [['--fluid-ui', e.ui, got.ui]] : [])]
    let worst = 0
    for (const [, exp, g] of rows) worst = Math.max(worst, Math.abs(exp - g))
    if (Object.keys(extra).length) console.log(c.dim('  (--set changes the prediction only; the page is measured as it is)'))
    else if (worst < 0.002) console.log(c.green(`  ✓ the ${at ? 'element' : "page"}'s units match (worst drift ${worst.toExponential(1)})`))
    else if (at && !live.isScope) console.log(c.red(`  ✗ ${at} sets fluid settings but is not a scope, so its units are its nearest scope's. Add a limit utility, class="${p.structure.prefix}-scope" or data-fluid-scope to it.`))
    else console.log(c.red(`  ✗ the ${at ? 'element' : 'page'}'s units drift by up to ${worst.toFixed(4)} — a stale stylesheet (close the tab, reopen) or a hand-edited fluid.css`))
    if (live.build && live.build !== buildOutput(p.structure).buildId) console.log(c.yellow(`  ! the page was built from ${live.build}; this config generates ${buildOutput(p.structure).buildId} — run fluid generate, restart, reopen the tab`))
    if (!at) printScopes(p.structure, live)
    return
  }
  const { overrides } = scanProject(p.structure, p.dir, p.outDir)
  printExplain(p.structure, resolveSettings(p.structure, { ...overrides, ...extra }), w, h, zoom, Object.keys(extra).length ? 'settings from your CSS, top-level :root, plus --set' : 'settings from your CSS, top-level :root')
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

async function readLiveSettings(url, w, h, structure, at = null) {
  const pw = loadPlaywright()
  const browser = await pw.chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    await page.goto(url, { waitUntil: 'networkidle' })
    const names = settingsSpec(structure).map((s) => s.name)
    const units = ['fluid', ...structure.roles, ...(structure.ui ? ['ui'] : [])]
    const scopeSel = scopeSelector(structure.prefix).replace(/:root,\n/, '')
    const res = await page.evaluate(({ names, units, at, scopeSel, prefix }) => {
      const read = (el) => {
        const cs = getComputedStyle(el)
        const out = {}
        for (const n of names) {
          const v = cs.getPropertyValue(n).trim()
          if (v !== '' && Number.isFinite(Number(v))) out[n] = Number(v)
        }
        return out
      }
      const measure = (host) => {
        const probe = document.createElement('div')
        probe.style.cssText = 'position:absolute;visibility:hidden;left:0;top:0;height:0;padding:0;border:0'
        host.appendChild(probe)
        const got = {}
        for (const u of units) {
          probe.style.width = `calc(1000 * var(--fluid${u === 'fluid' ? '' : '-' + u}))`
          got[u] = probe.getBoundingClientRect().width / 1000
        }
        probe.remove()
        return got
      }
      const root = document.documentElement
      const target = at ? document.querySelector(at) : root
      if (!target) return { missing: true }
      const settings = read(target)
      const overrides = Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, { value: v, source: at ? `the page, at ${at}` : 'the page' }]))
      const result = { overrides, units: measure(at ? target : document.body), isScope: target === root || target.matches(scopeSel), build: getComputedStyle(root).getPropertyValue('--fluid-build').trim().replace(/^"|"$/g, '') }
      if (at) return result
      // Scopes: what each one sets beyond the page, and what inside follows the scale.
      const rootSettings = read(root)
      // By class/attribute, and anywhere a setting changes from the parent:
      // an SCSS/StyleX scope (a mixin, no class) is only visible that way.
      const all = [...document.querySelectorAll(scopeSel)]
      const seen = new Set(all)
      const memo = new Map([[root, JSON.stringify(rootSettings)]])
      const key = (el) => {
        if (!memo.has(el)) memo.set(el, JSON.stringify(read(el)))
        return memo.get(el)
      }
      for (const el of [...document.body.querySelectorAll('*')].slice(0, 5000)) {
        if (!seen.has(el) && el.parentElement && key(el) !== key(el.parentElement)) {
          all.push(el)
          seen.add(el)
        }
      }
      const limitRe = new RegExp(`(^|:)${prefix}-(grow-until|ui-grow-until|shrink-until)-|(^|:)${prefix}-off$`)
      const props = ['width', 'height', 'fontSize', 'paddingTop', 'paddingLeft', 'marginTop', 'gap', 'top', 'left']
      result.scopes = all.slice(0, 20).map((el) => {
        const own = read(el)
        const settings = Object.fromEntries(Object.entries(own).filter(([k, v]) => rootSettings[k] !== v))
        const cls = [...el.classList]
        const label = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls.length ? '.' + cls.slice(0, 4).join('.') : ''}${cls.length > 4 ? '…' : ''}`
        const u = measure(el)
        // Toggle the scale off (or back on) on this scope and count what moves.
        let following = null
        if (Math.abs(u.fluid - 1) > 0.02 || settings['--fluid-off'] === 1) {
          const kids = [...el.querySelectorAll('*')].slice(0, 600)
          const snap = () => kids.map((k) => { const cs = getComputedStyle(k); return props.map((p) => cs[p]).join('|') })
          const before = snap()
          const prev = el.style.getPropertyValue('--fluid-off')
          el.style.setProperty('--fluid-off', own['--fluid-off'] === 1 ? '0' : '1')
          const after = snap()
          if (prev) el.style.setProperty('--fluid-off', prev)
          else el.style.removeProperty('--fluid-off')
          following = before.filter((b, i) => b !== after[i]).length
        }
        return { label, settings, units: u, following, limit: cls.some((c) => limitRe.test(c)) }
      })
      result.scopesTruncated = all.length > 20
      return result
    }, { names, units, at, scopeSel, prefix: structure.prefix })
    if (res.missing) fail(`--at ${JSON.stringify(at)} matches nothing on ${url} at ${w}×${h}`, 2)
    return res
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

const GLOBALS_CANDIDATES = [
  // Node frameworks
  'src/app/globals.css', 'app/globals.css', 'src/styles/globals.css', 'styles/globals.css', 'src/index.css', 'src/main.css', 'src/styles/main.css', 'src/style.css', 'src/styles/main.scss', 'src/main.scss', 'styles/main.scss',
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
  const stack = deps.tailwindcss || /@import\s+['"]tailwindcss['"]/.test(globalsText) ? 'tailwind-v4' : deps.sass || deps['sass-embedded'] || /\.s[ac]ss$/.test(globals ?? '') ? 'scss' : deps['@stylexjs/stylex'] ? 'stylex' : 'css'
  const srcStyles = existsSync(join(root, 'src')) ? 'src/styles/fluid' : 'styles/fluid'
  // An existing site styles html/body itself: leave the base layer out.
  const brownfield = /(^|[}\s,])(html|body)\s*[,{]/m.test(globalsText.replace(/\/\*[\s\S]*?\*\//g, ''))
  return { integration, stack, globals, brownfield, node: !!pkg.name || Object.keys(deps).length > 0, outDir: globals && !['src/app', 'app', '.'].includes(dirname(globals)) ? `${dirname(globals)}/fluid` : srcStyles }
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
  if (existsSync(configPath) && !flags.force) fail(`fluid.config.json already exists. ${isV1(readJson(configPath)) ? `It is v1: run ${c.bold('fluid migrate --write')}.` : `Run ${c.bold('fluid generate')}, or init --force to start over.`}`, 2)
  const det = detectProject(root)
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
    }
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

  const { $schema, ...rest } = structure
  writeFileSync(configPath, prettyJson({ $schema, ...minimalStructure(rest) }) + '\n')
  writeFileSync(join(root, 'fluid.config.schema.json'), JSON.stringify(jsonSchema(), null, 2) + '\n')
  console.log(`${c.green('✓')} fluid.config.json (${structure.output.stack}, ${structure.output.integration === 'none' ? 'no framework integration' : structure.output.integration}${brownfield ? ', brownfield: base off' : ''}${a.mobile ? '' : ', flat below desktop'})`)
  cmdGenerate({ config: configPath })

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
  probe: () => import('./probe.mjs'),
  verify: () => import('./verify-matrix.mjs'),
  audit: () => import('./audit.mjs')
}
const BROWSER_TOOLS = new Set(['probe', 'verify'])

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
  const once = () => {
    try {
      cmdGenerate({ ...flags, config: path, watch: undefined })
    } catch (err) {
      console.error(c.red(err.message))
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
  fluid check                           config, generated files, settings lint — non-zero on problems (CI)
  fluid settings [--json]               every setting with its default
  fluid explain <W>x<H> [--zoom 1.5] [--set --fluid-grow-until=1680]
                [--url http://localhost:3000 [--at 'header']]
                                        the band, every unit, and where each value came from; --url
                                        reads the live page (and every limited scope on it), --at one element
  fluid migrate [--write]               convert a v1 config
  fluid calc | probe | verify | audit   the tools (calc.mjs, probe.mjs, verify-matrix.mjs, audit.mjs)

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
  return main(argv).catch((err) => fail(err instanceof ConfigError ? err.message : err.stack ?? String(err), 2))
}

const isMain = process.argv[1] && pathToFileURL(resolvePath(process.argv[1])).href === import.meta.url
// In the binary every module shares the entry's URL: bin-entry.mjs is the only caller there.
if (isMain && !IS_BINARY) run()
