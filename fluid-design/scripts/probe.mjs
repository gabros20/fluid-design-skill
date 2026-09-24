#!/usr/bin/env node
// probe.mjs — a one-shot: load a URL in a real browser, read the fluid units
// and settings at one viewport, compare the units with what the model
// computes from those settings, check the build stamp, and print a verdict.
//
// Usage:
//   node probe.mjs <url> [--config f] [--width 1440] [--height 900]
//   node probe.mjs --help
//
// Verdicts:
//   FRESH   — the resolved units match the expected factors within tolerance.
//   STALE   — the units are present but resolve to old/wrong numbers. This is
//             the classic "HMR pushed CSS, then the server restarted and an
//             open tab kept the previous stylesheet in memory" bug: Next dev
//             sends CSS over the HMR socket, a server restart kills that
//             socket, and an already-open tab does not reliably re-fetch on
//             reconnect. Safari holds it hardest — a plain Cmd+R often re-runs
//             the page against the cached CSS. Fix: close the tab and open a
//             fresh one; if that doesn't clear it, `rm -rf .next && <dev
//             command>`.
//   MISSING — none of the four custom properties resolve to a number at all,
//             i.e. this page does not define the fluid scale (wrong URL,
//             wrong build, or the scale genuinely is not wired up here).
//
// Exit codes: 0 = FRESH, 1 = STALE, 2 = MISSING or usage/invocation error.

import { loadContext } from './lib/context.mjs'
import { evaluate, resolveSettings, valuesOf } from './lib/model.mjs'
import { settingsSpec, ConfigError } from './lib/spec.mjs'
import { buildOutput } from './lib/emit/project.mjs'

const HELP = `
probe.mjs <url> [--config f] [--width 1440] [--height 900]

Loads <url> in a real (headless) browser at the given viewport (default
1440x900, the reference), reads the four fluid custom properties, and prints
what they resolve to against what the model computes from the page's own settings.

Why "STALE" is a real verdict, not just "wrong":
  Next dev pushes CSS over the HMR socket. Restarting the dev server kills
  that socket, and a tab that was already open does not reliably re-fetch the
  stylesheet on reconnect -- it keeps the previous one in memory. Safari holds
  hardest: a plain Cmd+R often re-runs the page against the cached CSS, so the
  reload appears to "not work" while closing the tab fixes it instantly.
  The trigger is always the same pair: globals.css changed AND the server
  restarted while a tab stayed open.

  Fix: close the tab and open a fresh one. If it survives that, blow away the
  build cache and restart the dev server (e.g. \`rm -rf .next && pnpm dev\`).
`

function parseArgs(argv) {
  const out = { _: [], config: undefined, width: 1440, height: 900, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') out.help = true
    else if (a === '--config') out.config = argv[++i]
    else if (a === '--width') out.width = Number(argv[++i])
    else if (a === '--height') out.height = Number(argv[++i])
    else if (a.startsWith('--')) { console.error(`[probe] unknown flag ${a}`); process.exit(2) }
    else out._.push(a)
  }
  return out
}

// A custom property's getPropertyValue() is its formula text, not a number,
// so each unit is measured with a probe sized calc(1000 * var(--unit)). The
// page's settings are read too (registered, so they compute to numbers), and
// the expected units are computed from THEM: any override is accounted for.
async function readPage(page, structure) {
  const names = settingsSpec(structure).map((x) => x.name)
  const units = ['fluid', ...structure.roles, ...(structure.ui ? ['ui'] : [])]
  return page.evaluate(({ names, units }) => {
    const cs = getComputedStyle(document.documentElement)
    const settings = {}
    for (const n of names) {
      const v = cs.getPropertyValue(n).trim()
      if (v !== '' && Number.isFinite(Number(v))) settings[n] = Number(v)
    }
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;top:-9999px;left:-9999px;height:0;'
    document.body.appendChild(probe)
    const resolved = {}
    for (const u of units) {
      probe.style.width = `calc(1000 * var(--fluid${u === 'fluid' ? '' : '-' + u}))`
      const w = probe.getBoundingClientRect().width
      resolved[u] = Number.isFinite(w) && w > 0 ? w / 1000 : NaN
    }
    probe.remove()
    return { settings, resolved, build: cs.getPropertyValue('--fluid-build').trim().replace(/^["']|["']$/g, ''), zoom: Number(cs.getPropertyValue('--fluid-zoom').trim() || 1) }
  }, { names, units })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || args._.length === 0) {
    console.log(HELP.trim())
    process.exit(args.help ? 0 : 2)
  }

  const url = args._[0]
  let ctx
  try {
    ctx = loadContext(args.config)
  } catch (err) {
    console.error(err instanceof ConfigError ? err.message : String(err))
    process.exit(2)
  }
  const { structure } = ctx
  const expectedBuild = ctx.migration ? null : buildOutput(structure).buildId

  let chromium
  try {
    ;({ chromium } = await resolvePlaywrightModule())
  } catch (err) {
    console.error(err.message)
    process.exit(2)
  }

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: args.width, height: args.height } })
    await page.goto(url, { waitUntil: 'networkidle' })
    const live = await readPage(page, structure)
    const e = evaluate(structure, valuesOf(resolveSettings(structure, live.settings)), args.width, args.height, live.zoom)
    const expected = { fluid: e.fluid, ...e.roles, ...(structure.ui ? { ui: e.ui } : {}) }

    console.log(`probe: ${url}  @ ${args.width}x${args.height} (${e.band})`)
    console.log(`build: page ${live.build || '(none: not a v2 stylesheet)'}${expectedBuild ? `, config ${expectedBuild}` : ''}`)
    console.log('')
    console.log('unit                 resolved   expected   drift')
    let maxDrift = 0
    let allNaN = true
    for (const [key, exp] of Object.entries(expected)) {
      const r = live.resolved[key]
      if (Number.isFinite(r)) allNaN = false
      const drift = Number.isFinite(r) ? Math.abs(r - exp) : Infinity
      maxDrift = Math.max(maxDrift, Number.isFinite(drift) ? drift : 0)
      console.log(`--fluid${key === 'fluid' ? '' : '-' + key}`.padEnd(21) + (Number.isFinite(r) ? r.toFixed(4) : 'NaN').padEnd(11) + exp.toFixed(4).padEnd(11) + (Number.isFinite(r) ? drift.toFixed(4) : '-'))
    }
    console.log('')
    let verdict
    if (allNaN) verdict = 'MISSING'
    else if (maxDrift > 0.002 || (expectedBuild && live.build !== expectedBuild)) verdict = 'STALE'
    else verdict = 'FRESH'
    console.log(`verdict: ${verdict}`)
    if (verdict === 'STALE') {
      console.log('  The page is not running what fluid.config.json generates now — almost always a stale')
      console.log('  stylesheet, not a code bug. Run fluid generate, then close the tab and open a fresh one;')
      console.log('  if that persists, clear the build cache (rm -rf .next) and restart the dev server.')
    } else if (verdict === 'MISSING') {
      console.log('  No fluid unit resolves here: this page does not load the fluid stylesheet.')
    }
    process.exit(verdict === 'FRESH' ? 0 : verdict === 'STALE' ? 1 : 2)
  } finally {
    await browser.close()
  }
}

// Local resolver (kept in sync with the one in verify-matrix.mjs; see the
// comment there for why it is duplicated rather than shared through
// scripts/lib, which belongs to the config generator).
async function resolvePlaywrightModule() {
  const { createRequire } = await import('node:module')
  const { pathToFileURL } = await import('node:url')
  const { join } = await import('node:path')

  const attempts = []
  try {
    const cwdRequire = createRequire(pathToFileURL(join(process.cwd(), 'package.json')))
    const resolved = cwdRequire.resolve('playwright')
    attempts.push(`cwd (${process.cwd()}): ${resolved}`)
    const mod = await import(pathToFileURL(resolved).href)
    return mod.chromium ? mod : mod.default
  } catch (err) {
    attempts.push(`cwd (${process.cwd()}): not found (${err.code ?? err.message})`)
  }
  try {
    const here = createRequire(import.meta.url)
    const resolved = here.resolve('playwright')
    attempts.push(`skill-local: ${resolved}`)
    const mod = await import(pathToFileURL(resolved).href)
    return mod.chromium ? mod : mod.default
  } catch (err) {
    attempts.push(`skill-local: not found (${err.code ?? err.message})`)
  }

  throw new Error(
    [
      '[fluid-design] could not resolve "playwright" from either the current project or the skill itself.',
      '',
      'Tried:',
      ...attempts.map((a) => `  - ${a}`),
      '',
      'Fix: run this from the target project directory after installing playwright there',
      '  (npm i -D playwright && npx playwright install chromium)',
      'or install it globally for the skill to fall back on',
      '  (npm i -g playwright && playwright install chromium).'
    ].join('\n')
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
