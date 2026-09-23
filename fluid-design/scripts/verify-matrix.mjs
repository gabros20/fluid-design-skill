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
import { loadConfig, factors, cssUnits } from './lib/fluid-math.mjs'

const UNIT_TOLERANCE = 0.002

// Structural signatures of expression shapes THIS generator (current
// version) can never produce — so a raw computed value matching one of
// these is necessarily left over from an older/different build, not from a
// generator bug in the CURRENT config. Anything that differs from the
// expected expression WITHOUT matching one of these is reported as a plain
// mismatch instead of "stale," because a fresh, correctly-timestamped build
// can still disagree with the config it was supposedly built from (see
// generate-fluid.mjs's SCSS-emitter bugs #1/#2 — a bug that was misdiagnosed
// as a stale stylesheet in exactly this spot before this fix).
const KNOWN_STALE_SIGNATURES = [
  /clamp\(/, // a pre-rewrite clamp()-based formula; this generator only ever emits max()/min()
  /100vh\b/, // dvh/vh-based older formula; current generator always divides svh, never bare vh
  /--fluid-fluid\b/ // the SCSS chrome-disabled string-concat bug's own literal (fixed in generate-fluid.mjs)
]

/** The exact expression cssUnits(cfg) would emit for `key` ('fluid'|'display'|'copy'|'chrome')
 * at `width` CSS px, or null if this property isn't emitted at all for this config
 * (e.g. --fluid-chrome when units.chrome.enabled is false). */
function expectedRawExpr(units, key, width, engageAt) {
  const prop = key === 'fluid' ? '--fluid' : `--fluid-${key}`
  const bucket = width >= engageAt ? units.engaged : units.root
  return prop in bucket ? bucket[prop] : null
}

/** Distinguishes a genuinely stale build from any other kind of drift, so a
 * generator/config bug is never reported with "close the tab" advice that
 * cannot fix it. */
function diagnoseUnitMismatch(raw, expected) {
  if (raw === '') return 'missing'
  if (expected === null) return raw === '' ? 'missing' : 'unexpected' // property shouldn't exist for this config at all
  if (raw === expected) return 'match'
  if (KNOWN_STALE_SIGNATURES.some((re) => re.test(raw))) return 'stale'
  return 'mismatch'
}

function parseArgs(argv) {
  const out = {
    _: [],
    config: undefined,
    out: 'verify-matrix-out',
    widths: '1024,1280,1440,1680,2560',
    heights: '640,700,800,900,1440',
    mobile: '390x844,375x667',
    fitSelector: '[data-fit=screen]',
    reveal: false,
    screens: false,
    help: false
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') out.help = true
    else if (a === '--config') out.config = argv[++i]
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

const USAGE = `verify-matrix.mjs — drive a real browser across the desktop matrix (and mobile sizes)
and check overflow, drifted/stale fluid units, one-screen sections and (optionally) reveal state.

Usage:
  node verify-matrix.mjs <url> [--config f] [--out dir]
    [--widths 1024,1280,1440,1680,2560] [--heights 640,700,800,900,1440]
    [--mobile 390x844,375x667 | none] [--fit-selector '[data-fit=screen]']
    [--reveal] [--screens]

Options:
  --config <file>     config file to load instead of the shipped defaults
  --out <dir>         output directory for report.json / screenshots (default: verify-matrix-out)
  --widths <list>     comma-separated desktop widths (default: 1024,1280,1440,1680,2560)
  --heights <list>    comma-separated desktop heights (default: 640,700,800,900,1440)
  --mobile <list>     comma-separated WxH pairs (default: 390x844,375x667), or "none" to disable
  --fit-selector <s>  selector checked against "height <= viewport" (default: [data-fit=screen])
  --reveal            step-scroll and check every [data-stage-item] ends visible
  --screens           write a full-page screenshot per viewport + a contact sheet
  -h, --help          print this message and exit

When the config sets a \`ceiling\`, one extra desktop viewport is appended automatically — sized so
the natural (uncapped) --fluid factor clears the ceiling by 25% — so the ceiling is always exercised
even if every viewport in --widths/--heights lands at or below it (this is what let the SCSS
ceiling bug in generate-fluid.mjs ship unnoticed: the shipped defaults never crossed it).

[data-verify-grid] elements get a column-count report: the computed grid-template-columns track
count at every desktop viewport must match, unless the element is marked
data-verify-grid="responsive", in which case it is reported but never fails the run.

Exit codes: 0 = every check passed, 1 = at least one failed, 2 = usage / invocation error
(including "playwright not found").`

function parseNumberList(s) {
  return s.split(',').filter(Boolean).map((x) => Number(x.trim()))
}

function parseWxHList(s) {
  if (!s || s.trim().toLowerCase() === 'none') return []
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

// The four custom properties are FIXED NAMES (`--fluid`, `--fluid-display`,
// `--fluid-copy`, `--fluid-chrome`) regardless of `fluid.config.json`'s
// `prefix` — only utility/class/function names move with `prefix`
// (references/attribute-contract.md §1). `readUnits` therefore never takes a
// prefix argument; reading `--${cfg.prefix}...` here would silently read
// nothing at all on any project with a non-default prefix.
async function readUnits(page) {
  return page.evaluate(() => {
    const names = ['', '-display', '-copy', '-chrome']
    const cs = getComputedStyle(document.documentElement)
    const raw = {}
    for (const n of names) raw[n ? n.slice(1) : 'fluid'] = cs.getPropertyValue(`--fluid${n}`).trim()

    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;top:-9999px;left:-9999px;height:0;'
    document.body.appendChild(probe)

    const resolved = {}
    for (const n of names) {
      const key = n ? n.slice(1) : 'fluid'
      probe.style.width = `calc(1000 * var(--fluid${n}))`
      const w = probe.getBoundingClientRect().width
      resolved[key] = Number.isFinite(w) && w > 0 ? w / 1000 : NaN
    }
    probe.remove()
    return { raw, resolved }
  })
}

// [data-verify-grid] elements: the number of tracks the browser actually laid
// out (computed grid-template-columns' space-separated track list), not a
// guess from source -- catches the exact drift class frame-and-gutter.md §3
// documents, where a frozen or wrongly-scaled comparison constant reflows
// the column count only past the reference width.
async function checkGridCols(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll('[data-verify-grid]')]
    return els.map((el, i) => {
      const cs = getComputedStyle(el)
      const tracks = cs.gridTemplateColumns.trim()
      const columns = tracks === '' || tracks === 'none' ? 0 : tracks.split(/\s+/).length
      return {
        index: i,
        selector: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : ''),
        columns,
        responsive: el.getAttribute('data-verify-grid') === 'responsive'
      }
    })
  })
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

  // (b) units — raw is the computed, UNEVALUATED expression text (what the
  // stylesheet actually says); resolved is the probe-measured number.
  // Printing raw next to expected is what makes a generator/config
  // disagreement diagnosable on the spot instead of guessed at (§9).
  const { raw, resolved } = await readUnits(page)
  const expected = factors(cfg, viewport.width, viewport.height)
  const expectedUnits = cssUnits(cfg)
  const unitRows = ['fluid', 'display', 'copy', 'chrome'].map((key) => {
    const r = resolved[key]
    const drift = Number.isFinite(r) ? Math.abs(r - expected[key]) : Infinity
    const expectedExpr = expectedRawExpr(expectedUnits, key, viewport.width, cfg.engageAt)
    return {
      unit: key,
      raw: raw[key],
      rawExpr: raw[key], // the exact computed expression text, alongside `expected` below
      resolved: r,
      expected: expected[key],
      expectedExpr,
      diagnosis: diagnoseUnitMismatch(raw[key], expectedExpr),
      drift,
      pass: drift <= UNIT_TOLERANCE
    }
  })
  const unitsPass = unitRows.every((u) => u.pass)
  result.checks.units = { pass: unitsPass, rows: unitRows }

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

  // (e') grid-cols — column count per [data-verify-grid] element. Compared
  // across desktop (non-mobile) viewports once every viewport has run; see
  // the summary/report assembly in main().
  result.checks.gridCols = await checkGridCols(page)

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

// Aggregates each [data-verify-grid] element's column count ACROSS desktop
// (non-mobile) viewports — this is a cross-viewport property, not a
// per-viewport one, so it is reported and gated separately from
// `viewportPass`. A grid marked `data-verify-grid="responsive"` is reported
// but never fails the run — it is allowed to change column count by design.
function buildGridColsReport(viewports) {
  const desktop = viewports.filter((v) => !v.mobile)
  const bySelector = new Map()
  for (const v of desktop) {
    for (const g of v.checks.gridCols ?? []) {
      const key = `${g.index}:${g.selector}`
      if (!bySelector.has(key)) bySelector.set(key, { selector: g.selector, responsive: false, byViewport: [] })
      const entry = bySelector.get(key)
      entry.responsive = entry.responsive || g.responsive
      entry.byViewport.push({ width: v.width, height: v.height, columns: g.columns })
    }
  }
  const grids = [...bySelector.values()].map((entry) => {
    const counts = new Set(entry.byViewport.map((b) => b.columns))
    const consistent = counts.size <= 1
    return { ...entry, consistent, pass: entry.responsive || consistent }
  })
  return { pass: grids.every((g) => g.pass), grids }
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
        const name = u.unit === 'fluid' ? '--fluid' : `--fluid-${u.unit}`
        console.log(`  unit ${name}: resolved ${u.resolved} vs expected ${u.expected.toFixed(4)} (drift ${Number.isFinite(u.drift) ? u.drift.toFixed(4) : 'n/a'})`)
        console.log(`    raw (stylesheet):  ${u.rawExpr || '(empty)'}`)
        console.log(`    expected (config): ${u.expectedExpr ?? '(not emitted for this config)'}`)
        switch (u.diagnosis) {
          case 'missing':
            console.log('    -> missing: the stylesheet does not define this property on this page (missing build, wrong route, or genuinely not wired up)')
            break
          case 'stale':
            console.log('    -> classic stale stylesheet (raw matches a known OLDER generated form): close the tab and open a fresh one, or rm -rf the build cache and restart the dev server')
            break
          case 'mismatch':
            console.log('    -> expression mismatch: config vs stylesheet — this is a fresh build that disagrees with fluid.config.json (a generator bug or a hand-edited stylesheet), not staleness; compare the two lines above')
            break
          case 'unexpected':
            console.log('    -> this property should not be emitted for this config at all, but the stylesheet defines it anyway')
            break
        }
      }
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

function printGridColsReport(report) {
  if (report.grids.length === 0) return
  console.log('grid-cols (desktop viewports only):')
  for (const g of report.grids) {
    const cols = g.byViewport.map((b) => `${b.width}x${b.height}=${b.columns}`).join(', ')
    const tag = g.responsive ? 'responsive (not gated)' : g.pass ? 'PASS' : 'FAIL — column count changed across desktop viewports'
    console.log(`  [${g.selector}] ${tag}`)
    console.log(`    ${cols}`)
  }
  console.log('')
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
  if (args.help) {
    console.log(USAGE)
    process.exit(0)
  }
  const url = args._[0]
  if (!url) {
    console.error('usage: node verify-matrix.mjs <url> [--config f] [--out dir] [--widths …] [--heights …] [--mobile W1xH1,W2xH2|none] [--fit-selector sel] [--reveal] [--screens]')
    console.error('       node verify-matrix.mjs --help')
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

  // When the config sets a ceiling, add ONE viewport sized so the natural
  // (uncapped) --fluid factor clears it by 25% — otherwise a ceiling can go
  // completely unexercised by the default matrix (the exact way the SCSS
  // emitter's ceiling bug in generate-fluid.mjs shipped unnoticed: every
  // default-matrix viewport at or below the reference never crosses it).
  const ceilingViewports = []
  if (cfg.ceiling !== null) {
    const w = Math.ceil(cfg.ceiling * 1.25 * cfg.reference.width)
    const h = Math.ceil(cfg.ceiling * 1.25 * cfg.reference.height)
    ceilingViewports.push({ width: w, height: h })
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
    for (const cv of ceilingViewports) {
      const r = await runViewport(browser, url, cfg, args, cv, false)
      r.ceilingCheck = true
      viewports.push(r)
    }
    for (const m of mobiles) {
      viewports.push(await runViewport(browser, url, cfg, args, m, true))
    }
  } finally {
    await browser.close()
  }

  const gridColsReport = buildGridColsReport(viewports)

  mkdirSync(args.out, { recursive: true })
  const report = {
    url,
    config: { prefix: cfg.prefix, reference: cfg.reference, engageAt: cfg.engageAt, ceiling: cfg.ceiling },
    generatedAt: new Date().toISOString(),
    viewports,
    gridCols: gridColsReport
  }
  writeFileSync(join(args.out, 'report.json'), JSON.stringify(report, null, 2))
  if (args.screens) writeContactSheet(args.out, viewports)

  printSummary(viewports)
  printGridColsReport(gridColsReport)

  const anyFail = viewports.some((v) => !viewportPass(v)) || !gridColsReport.pass
  console.log(anyFail ? 'FAIL' : 'PASS')
  console.log(`report: ${join(args.out, 'report.json')}`)
  process.exit(anyFail ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
