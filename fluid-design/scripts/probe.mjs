#!/usr/bin/env node
// probe.mjs — a one-shot: load a URL in a real browser, read the four fluid
// custom properties at the current viewport, compare them to what
// fluid-math.mjs expects, and print a verdict.
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

import { loadConfig, factors } from './lib/fluid-math.mjs'

const HELP = `
probe.mjs <url> [--config f] [--width 1440] [--height 900]

Loads <url> in a real (headless) browser at the given viewport (default
1440x900, the reference), reads the four fluid custom properties, and prints
what they resolve to against what fluid-math.mjs expects for that viewport.

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

// Same technique verify-matrix.mjs uses: getPropertyValue() on a custom
// property returns its unevaluated expression string, not a number, so we
// resolve each unit by measuring a probe element sized with it.
async function resolveUnits(page, prefix) {
  return page.evaluate((prefix) => {
    const names = ['', '-display', '-copy', '-chrome']
    const cs = getComputedStyle(document.documentElement)
    const raw = {}
    for (const n of names) raw[n ? n.slice(1) : 'fluid'] = cs.getPropertyValue(`--${prefix}${n}`).trim()

    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;top:-9999px;left:-9999px;height:0;'
    document.body.appendChild(probe)

    const resolved = {}
    for (const n of names) {
      const key = n ? n.slice(1) : 'fluid'
      probe.style.width = `calc(1000 * var(--${prefix}${n}))`
      const w = probe.getBoundingClientRect().width
      resolved[key] = Number.isFinite(w) && w > 0 ? w / 1000 : NaN
    }
    probe.remove()
    return { raw, resolved }
  }, prefix)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || args._.length === 0) {
    console.log(HELP.trim())
    process.exit(args.help ? 0 : 2)
  }

  const url = args._[0]
  let cfg
  try {
    cfg = loadConfig(args.config)
  } catch (err) {
    console.error(err.message)
    process.exit(2)
  }

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

    const { raw, resolved } = await resolveUnits(page, cfg.prefix)
    const expected = factors(cfg, args.width, args.height)

    const allEmpty = Object.values(raw).every((v) => v === '')
    const allNaN = Object.values(resolved).every((v) => Number.isNaN(v))

    console.log(`probe: ${url}  @ ${args.width}x${args.height}`)
    console.log('')
    console.log('unit         raw expression                                        resolved   expected   drift')
    const rows = [
      ['fluid', 'fluid'],
      ['display', 'display'],
      ['copy', 'copy'],
      ['chrome', 'chrome']
    ]
    let maxDrift = 0
    for (const [label, key] of rows) {
      const r = resolved[key]
      const e = expected[key]
      const drift = Number.isFinite(r) ? Math.abs(r - e) : Infinity
      maxDrift = Math.max(maxDrift, Number.isFinite(drift) ? drift : 0)
      console.log(
        `--${cfg.prefix}${key === 'fluid' ? '' : '-' + key}`.padEnd(16) +
        (raw[key] || '(empty)').slice(0, 58).padEnd(59) +
        (Number.isFinite(r) ? r.toFixed(4) : 'NaN').padEnd(11) +
        e.toFixed(4).padEnd(11) +
        (Number.isFinite(r) ? drift.toFixed(4) : '-')
      )
    }
    console.log('')

    let verdict
    if (allEmpty && allNaN) {
      verdict = 'MISSING'
    } else if (maxDrift > 0.002) {
      verdict = 'STALE'
    } else {
      verdict = 'FRESH'
    }

    console.log(`verdict: ${verdict}`)
    if (verdict === 'STALE') {
      console.log('  The units are defined but do not match what this config expects at this')
      console.log('  viewport -- almost always a stale stylesheet, not a code bug. Close the')
      console.log('  tab and open a fresh one; if that persists, rm -rf .next (or the')
      console.log('  equivalent build cache) and restart the dev server. Run with --help for')
      console.log('  the full explanation.')
    } else if (verdict === 'MISSING') {
      console.log('  None of the four custom properties resolve to a number here -- this page')
      console.log('  does not appear to define the fluid scale at all (wrong URL, a build that')
      console.log('  predates it, or it genuinely is not wired up on this route).')
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
