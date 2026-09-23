#!/usr/bin/env node
// verify-matrix.mjs — drive a real browser across the desktop matrix (and
// optional mobile sizes) and check the things that fail silently: horizontal
// overflow, drifted/stale fluid units, one-screen sections that overrun the
// viewport, and (optionally) stage items stuck invisible after a reveal
// scroll. Full-page screenshots and a contact sheet are optional.
//
// This is Tier 1 from motion-design-system.md §9: "the browser harness" —
// drive a real page and read numbers out of it, because the bugs that matter
// are invisible in source.
//
// Usage:
//   node verify-matrix.mjs <url> [--config f] [--out dir]
//     [--widths 1024,1280,1440,1680,2560] [--heights 640,700,800,900]
//     [--mobile 390x844,375x667] [--fit-selector '[data-fit=screen]']
//     [--reveal] [--screens]
//
// Exit codes: 0 = every check passed, 1 = at least one failed, 2 = usage /
// invocation error (including "playwright not found").

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig, factors } from './lib/fluid-math.mjs'

const UNIT_TOLERANCE = 0.002

function parseArgs(argv) {
  const out = {
    _: [],
    config: undefined,
    out: 'verify-matrix-out',
    widths: '1024,1280,1440,1680,2560',
    heights: '640,700,800,900',
    mobile: '',
    fitSelector: '[data-fit=screen]',
    reveal: false,
    screens: false
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--config') out.config = argv[++i]
    else if (a === '--out') out.out = argv[++i]
    else if (a === '--widths') out.widths = argv[++i]
    else if (a === '--heights') out.heights = argv[++i]
    else if (a === '--mobile') out.mobile = argv[++i]
    else if (a === '--fit-selector') out.fitSelector = argv[++i]
    else if (a === '--reveal') out.reveal = true
    else if (a === '--screens') out.screens = true
    else if (a.startsWith('--')) { console.error(`[verify-matrix] unknown flag ${a}`); process.exit(2) }
    else out._.push(a)
  }
  return out
}

function parseNumberList(s) {
  return s.split(',').filter(Boolean).map((x) => Number(x.trim()))
}

function parseWxHList(s) {
  if (!s) return []
  return s.split(',').filter(Boolean).map((pair) => {
    const m = /^(\d+)x(\d+)$/.exec(pair.trim())
    if (!m) throw new Error(`bad WxH pair: ${JSON.stringify(pair)}`)
    return { width: Number(m[1]), height: Number(m[2]) }
  })
}

// Resolution order matches probe.mjs: the target project's own node_modules
// first (resolved from process.cwd(), where a consumer runs this from), then
// a bare specifier from the skill's own location. Kept duplicated rather
// than shared through scripts/lib, which is the config generator's tree.
async function resolvePlaywrightModule() {
  const { createRequire } = await import('node:module')
  const { pathToFileURL } = await import('node:url')

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

// ── per-viewport checks, run inside the page ──────────────────────────────

async function checkOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const overflowing = doc.scrollWidth > innerWidth + 1
    if (!overflowing) return { pass: true, offenders: [] }

    const depth = (el) => {
      let d = 0
      for (let p = el.parentElement; p; p = p.parentElement) d++
      return d
    }
    const offenders = []
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.right > innerWidth + 1) {
        offenders.push({
          selector: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''),
          right: Math.round(r.right),
          width: Math.round(r.width),
          depth: depth(el)
        })
      }
    }
    offenders.sort((a, b) => a.depth - b.depth)
    return { pass: false, scrollWidth: doc.scrollWidth, innerWidth, offenders: offenders.slice(0, 10) }
  })
}

async function readUnits(page, prefix) {
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

async function checkFit(page, selector, innerHeight) {
  return page.evaluate(({ selector, innerHeight }) => {
    const els = [...document.querySelectorAll(selector)]
    return els.map((el, i) => {
      const h = el.getBoundingClientRect().height
      return { index: i, height: Math.round(h), ratio: Number((h / innerHeight).toFixed(4)), pass: h <= innerHeight + 1 }
    })
  }, { selector, innerHeight })
}

// Step-scroll to the bottom with rAF + 200ms per step -- a fast scroll
// outruns IntersectionObserver and gives false blanks (learned the hard way,
// per this skill's contract). Then report every [data-stage-item] still
// under opacity 0.99.
async function checkReveal(page) {
  await page.evaluate(async () => {
    const step = () => new Promise((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve, 200))
    })
    const max = document.documentElement.scrollHeight - innerHeight
    const increment = Math.max(200, Math.round(innerHeight * 0.8))
    for (let y = 0; y <= max; y += increment) {
      window.scrollTo(0, y)
      await step()
    }
    window.scrollTo(0, max)
    // Final settle: the contract's entrance transition runs up to 1.3s
    // (references/attribute-contract.md §4), so a stage item triggered by the last step may still
    // be mid-transition at the 200ms mark. Give it real room before reading
    // opacity, or a perfectly working reveal reads as a false failure.
    await new Promise((resolve) => setTimeout(resolve, 1500))
  })

  return page.evaluate(() => {
    const items = [...document.querySelectorAll('[data-stage-item]')]
    const hidden = []
    items.forEach((el, i) => {
      const op = Number(getComputedStyle(el).opacity)
      if (op < 0.99) {
        hidden.push({
          index: i,
          opacity: op,
          selector: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '')
        })
      }
    })
    return { pass: hidden.length === 0, total: items.length, hidden }
  })
}

// ── one viewport ────────────────────────────────────────────────────────

async function runViewport(browser, url, cfg, opts, viewport, isMobile) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => new Promise((r) => setTimeout(r, 100))) // let fonts/CSS settle

  const result = { width: viewport.width, height: viewport.height, mobile: isMobile, checks: {} }

  // (a) overflow
  result.checks.overflow = await checkOverflow(page)

  // (b) units
  const { raw, resolved } = await readUnits(page, cfg.prefix)
  const expected = factors(cfg, viewport.width, viewport.height)
  const unitRows = ['fluid', 'display', 'copy', 'chrome'].map((key) => {
    const r = resolved[key]
    const drift = Number.isFinite(r) ? Math.abs(r - expected[key]) : Infinity
    return { unit: key, raw: raw[key], resolved: r, expected: expected[key], drift, pass: drift <= UNIT_TOLERANCE }
  })
  const unitsPass = unitRows.every((u) => u.pass)
  result.checks.units = { pass: unitsPass, rows: unitRows }
  if (!unitsPass) {
    const allEmpty = unitRows.every((u) => u.raw === '')
    result.checks.units.staleStylesheet = allEmpty
      ? 'all four custom properties are empty -- the stylesheet does not define the fluid scale at all on this page (missing build, wrong route, or genuinely not wired up)'
      : 'units resolve but drift from the config -- classic stale stylesheet: close the tab and open a fresh one, or rm -rf the build cache and restart the dev server'
  }

  // (c) fit-selector, only meaningful at/above engageAt
  if (viewport.width >= cfg.engageAt) {
    const fitResults = await checkFit(page, opts.fitSelector, viewport.height)
    result.checks.fit = { pass: fitResults.every((f) => f.pass), elements: fitResults }
  } else {
    result.checks.fit = { pass: true, skipped: 'below engageAt' }
  }

  // (d) reveal
  if (opts.reveal) {
    result.checks.reveal = await checkReveal(page)
  }

  // (e) screenshot
  if (opts.screens) {
    mkdirSync(opts.out, { recursive: true })
    const file = `screenshot-${viewport.width}x${viewport.height}${isMobile ? '-mobile' : ''}.png`
    await page.screenshot({ path: join(opts.out, file), fullPage: true })
    result.screenshot = file
  }

  await context.close()
  return result
}

// ── reporting ───────────────────────────────────────────────────────────

function viewportPass(v) {
  return v.checks.overflow.pass && v.checks.units.pass && v.checks.fit.pass && (v.checks.reveal ? v.checks.reveal.pass : true)
}

function printSummary(viewports) {
  console.log('width  height  mobile  overflow  units  fit  reveal  overall')
  for (const v of viewports) {
    const c = v.checks
    const cell = (b) => (b === undefined ? '-' : b ? 'PASS' : 'FAIL')
    console.log(
      [
        String(v.width).padEnd(7),
        String(v.height).padEnd(8),
        (v.mobile ? 'yes' : 'no').padEnd(8),
        cell(c.overflow.pass).padEnd(10),
        cell(c.units.pass).padEnd(7),
        cell(c.fit.pass).padEnd(5),
        cell(c.reveal?.pass).padEnd(8),
        viewportPass(v) ? 'PASS' : 'FAIL'
      ].join('')
    )
  }
  console.log('')
  for (const v of viewports) {
    if (viewportPass(v)) continue
    console.log(`FAIL at ${v.width}x${v.height}${v.mobile ? ' (mobile)' : ''}:`)
    if (!v.checks.overflow.pass) {
      console.log(`  overflow: scrollWidth ${v.checks.overflow.scrollWidth} > innerWidth ${v.checks.overflow.innerWidth}`)
      for (const o of v.checks.overflow.offenders) console.log(`    ${o.selector}  right=${o.right} width=${o.width} depth=${o.depth}`)
    }
    if (!v.checks.units.pass) {
      for (const u of v.checks.units.rows.filter((r) => !r.pass)) {
        console.log(`  unit --${u.unit === 'fluid' ? 'fluid' : 'fluid-' + u.unit}: resolved ${u.resolved} vs expected ${u.expected.toFixed(4)} (drift ${Number.isFinite(u.drift) ? u.drift.toFixed(4) : 'n/a'})`)
      }
      console.log(`    -> ${v.checks.units.staleStylesheet}`)
    }
    if (!v.checks.fit.pass) {
      for (const f of v.checks.fit.elements.filter((f) => !f.pass)) {
        console.log(`  fit[${f.index}]: height ${f.height} > viewport ${v.height} (ratio ${f.ratio})`)
      }
    }
    if (v.checks.reveal && !v.checks.reveal.pass) {
      for (const h of v.checks.reveal.hidden) console.log(`  reveal[${h.index}] ${h.selector}: opacity ${h.opacity}`)
    }
    console.log('')
  }
}

function writeContactSheet(outDir, viewports) {
  const shots = viewports.filter((v) => v.screenshot)
  if (shots.length === 0) return
  const cells = shots
    .map((v) => `<figure><img src="${v.screenshot}" loading="lazy"><figcaption>${v.width}x${v.height}${v.mobile ? ' (mobile)' : ''} — ${viewportPass(v) ? 'PASS' : 'FAIL'}</figcaption></figure>`)
    .join('\n')
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>contact sheet</title>
<style>
body{font-family:system-ui,sans-serif;background:#111;color:#eee;margin:0;padding:24px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
figure{margin:0;background:#1a1a1a;border-radius:8px;overflow:hidden}
img{display:block;width:100%;height:auto}
figcaption{padding:8px 12px;font-size:13px}
</style></head>
<body><div class="grid">
${cells}
</div></body></html>`
  writeFileSync(join(outDir, 'contact-sheet.html'), html)
}

// ── main ────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const url = args._[0]
  if (!url) {
    console.error('usage: node verify-matrix.mjs <url> [--config f] [--out dir] [--widths …] [--heights …] [--mobile W1xH1,W2xH2] [--fit-selector sel] [--reveal] [--screens]')
    process.exit(2)
  }

  let cfg
  try {
    cfg = loadConfig(args.config)
  } catch (err) {
    console.error(err.message)
    process.exit(2)
  }

  let widths, heights, mobiles
  try {
    widths = parseNumberList(args.widths)
    heights = parseNumberList(args.heights)
    mobiles = parseWxHList(args.mobile)
  } catch (err) {
    console.error(`[verify-matrix] ${err.message}`)
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
  const viewports = []
  try {
    for (const h of heights) {
      for (const w of widths) {
        viewports.push(await runViewport(browser, url, cfg, args, { width: w, height: h }, false))
      }
    }
    for (const m of mobiles) {
      viewports.push(await runViewport(browser, url, cfg, args, m, true))
    }
  } finally {
    await browser.close()
  }

  mkdirSync(args.out, { recursive: true })
  const report = {
    url,
    config: { prefix: cfg.prefix, reference: cfg.reference, engageAt: cfg.engageAt },
    generatedAt: new Date().toISOString(),
    viewports
  }
  writeFileSync(join(args.out, 'report.json'), JSON.stringify(report, null, 2))
  if (args.screens) writeContactSheet(args.out, viewports)

  printSummary(viewports)

  const anyFail = viewports.some((v) => !viewportPass(v))
  console.log(anyFail ? 'FAIL' : 'PASS')
  console.log(`report: ${join(args.out, 'report.json')}`)
  process.exit(anyFail ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
