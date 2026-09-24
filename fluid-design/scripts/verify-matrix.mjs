#!/usr/bin/env node
// verify-matrix.mjs — drive a real browser across the desktop matrix (and
// optional mobile sizes) and check the things that fail silently: horizontal
// overflow, drifted/stale fluid units, and one-screen sections that overrun
// the viewport. Full-page screenshots and a contact sheet are optional.
//
// This is Tier 1 from verification.md §7: "the browser harness" — drive a
// real page and read numbers out of it, because the bugs that matter are
// invisible in source. Reveal/scene verification (a triggered entrance
// left stuck invisible, a scroll-driven scene's motion state) lives in the
// scroll-animation skill's verify-motion.mjs, not here.
//
// Usage:
//   node verify-matrix.mjs <url> [--config f] [--out dir]
//     [--widths 1024,1280,1440,1680,2560] [--heights 640,700,800,900,1440]
//     [--mobile 390x844,375x667] [--fit-selector '[data-fit=screen]']
//     [--screens] [--zoom 1.25,1.5,2 | none] [--zoom-bases 1440x900,1920x1080,2560x1440]
//     [--zoom-selector 'main p'] [--zoom-strict]
//
// Exit codes: 0 = every check passed, 1 = at least one failed, 2 = usage /
// invocation error (including "playwright not found").

import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadContext } from './lib/context.mjs'
import { evaluate, resolveSettings, valuesOf } from './lib/model.mjs'
import { settingsSpec, ConfigError } from './lib/spec.mjs'
import { buildOutput } from './lib/emit/project.mjs'

const UNIT_TOLERANCE = 0.002

// How a unit row is checked: the page's OWN settings (the computed value of
// every registered --fluid-* setting, so any override in the project's CSS
// is included) go through model.evaluate(), and the result is compared with
// the unit the page actually renders (a probe sized calc(1000 * var(--unit))).
// That checks the generated formulas under whatever the project tuned.
// Staleness is read off --fluid-build: the page says which build it came
// from, and fluid.config.json says which build it should be.

/** Why a failing unit row failed. */
function diagnoseUnitMismatch(row, page, expectedBuild) {
  if (!page.build && !page.hasFluid) return 'missing'
  if (!page.build) return 'v1'
  if (page.build !== expectedBuild) return 'stale'
  return 'mismatch'
}

function parseArgs(argv) {
  const out = {
    _: [],
    config: undefined,
    out: 'verify-matrix-out',
    widths: '1024,1280,1440,1680,2560',
    heights: '640,700,800,900,1440',
    mobile: null, // default: 390x844,375x667; with the mobile arm on, 360x780,390x844,430x932,768x1024
    fitSelector: '[data-fit=screen]',
    screens: false,
    zoom: '1.25,1.5,2',
    zoomBases: '1440x900,1920x1080,2560x1440',
    zoomSelector: 'main p, p',
    zoomStrict: false,
    browser: 'chromium',
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
    else if (a === '--screens') out.screens = true
    else if (a === '--zoom') out.zoom = argv[++i]
    else if (a === '--zoom-bases') out.zoomBases = argv[++i]
    else if (a === '--zoom-selector') out.zoomSelector = argv[++i]
    else if (a === '--zoom-strict') out.zoomStrict = true
    else if (a === '--browser') out.browser = argv[++i]
    else if (a.startsWith('--')) { console.error(`[verify-matrix] unknown flag ${a}`); process.exit(2) }
    else out._.push(a)
  }
  return out
}

const USAGE = `verify-matrix.mjs — drive a real browser across the desktop matrix (and mobile sizes)
and check overflow, drifted/stale fluid units and one-screen sections.

Usage:
  node verify-matrix.mjs <url> [--config f] [--out dir]
    [--widths 1024,1280,1440,1680,2560] [--heights 640,700,800,900,1440]
    [--mobile 390x844,375x667 | none] [--fit-selector '[data-fit=screen]']
    [--screens] [--zoom 1.25,1.5,2 | none] [--zoom-bases 1440x900,1920x1080,2560x1440]
    [--zoom-selector 'main p, p'] [--zoom-strict]

Options:
  --config <file>     config file to load instead of the shipped defaults
  --out <dir>         output directory for report.json / screenshots (default: verify-matrix-out)
  --widths <list>     comma-separated desktop widths (default: 1024,1280,1440,1680,2560)
  --heights <list>    comma-separated desktop heights (default: 640,700,800,900,1440)
  --mobile <list>     comma-separated WxH pairs (default: 390x844,375x667; with the mobile arm on,
                      360x780,390x844,430x932,768x1024), or "none" to disable
  --fit-selector <s>  selector checked against "height <= viewport" (default: [data-fit=screen])
  --screens           write a full-page screenshot per viewport + a contact sheet, and a
                      viewport screenshot per zoom-row cell (zoom-WxH-PCT.jpg)
  --zoom <list>       browser zoom levels for the zoom row (default: 1.25,1.5,2), or "none"
  --zoom-bases <list> window sizes the zoom row runs on (default: 1440x900,1920x1080,2560x1440)
  --zoom-selector <s> the body text measured at each zoom (default: "main p, p"; first visible match)
  --zoom-strict       a zoom-row failure fails the run (default: reported as a warning)
  --browser <name>    chromium (default), webkit or firefox. WebKit is the closest thing to Safari
                      a script can drive: run it before asking for a device test. The zoom row
                      needs Chromium and is skipped on the others.
  -h, --help          print this message and exit

Reveal/scene checks (a triggered entrance stuck invisible, a scroll-driven
scene's data-motion-state across progress) live in the scroll-animation
skill's verify-motion.mjs --reveal/--scenes, not here.

When the config sets a \`ceiling\`, one extra desktop viewport is appended automatically — sized so
the natural (uncapped) --fluid factor clears the ceiling by 25% — so the ceiling is always exercised
even if every viewport in --widths/--heights lands at or below it (this is what let the SCSS
ceiling bug in generate-fluid.mjs ship unnoticed: the shipped defaults never crossed it).

[data-verify-grid] elements get a column-count report: the computed grid-template-columns track
count at every desktop viewport must match, unless the element is marked
data-verify-grid="responsive", in which case it is reported but never fails the run.

The zoom row (WCAG 1.4.4, resize text): for each base window it loads the page under REAL
browser zoom (a throwaway Chromium profile with Preferences default_zoom_level, which shrinks
the CSS viewport exactly as Cmd/Ctrl + does), measures the --zoom-selector font-size, and
converts it to physical size (CSS px × zoom). It passes when the text grows at least 90% of
proportionally (>= 0.9 × zoom, capped at the WCAG target of 2×, against the same window at
100%) with no horizontal overflow.
Pure vw/svh type fails this on wide windows unless assets/runtime/fluid-zoom.js is installed
(fluid-scale.md §12). Needs Playwright's full Chromium (npx playwright install chromium): the
headless shell ignores the zoom preference, and the row is skipped with a note without it.

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

// Custom-property names are fixed (--fluid, --fluid-<role>, --fluid-ui)
// whatever `prefix` is; only utility/class names move with it.
async function readUnits(page, structure) {
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
    return {
      settings,
      resolved,
      build: cs.getPropertyValue('--fluid-build').trim().replace(/^["']|["']$/g, ''),
      hasFluid: cs.getPropertyValue('--fluid').trim() !== '',
      zoom: Number(cs.getPropertyValue('--fluid-zoom').trim() || 1)
    }
  }, { names, units })
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

// ── one viewport ────────────────────────────────────────────────────────

async function runViewport(browser, url, ctx, opts, viewport, isMobile) {
  const { structure, expectedBuild } = ctx
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => new Promise((r) => setTimeout(r, 100))) // let fonts/CSS settle

  const result = { width: viewport.width, height: viewport.height, mobile: isMobile, checks: {} }

  // (a) overflow
  result.checks.overflow = await checkOverflow(page)

  // (b) units: the page's own settings through the model, against what it renders.
  const live = await readUnits(page, structure)
  const values = valuesOf(resolveSettings(structure, live.settings))
  const e = evaluate(structure, values, viewport.width, viewport.height, live.zoom)
  const expected = { fluid: e.fluid, ...e.roles, ...(structure.ui ? { ui: e.ui } : {}) }
  const overridden = Object.keys(live.settings).filter((k) => values[k] !== undefined && settingsSpec(structure).find((x) => x.name === k)?.default !== live.settings[k])
  const unitRows = Object.keys(expected).map((key) => {
    const r = live.resolved[key]
    const drift = Number.isFinite(r) ? Math.abs(r - expected[key]) : Infinity
    const pass = drift <= UNIT_TOLERANCE
    return { unit: key, resolved: r, expected: expected[key], drift, pass, diagnosis: pass ? undefined : diagnoseUnitMismatch(key, live, expectedBuild) }
  })
  result.band = e.band
  result.build = live.build
  result.checks.units = { pass: unitRows.every((u) => u.pass), rows: unitRows, overridden }

  // (c) fit-selector, only meaningful at/above engageAt
  if (viewport.width >= structure.bands.desktop.minWidth) {
    const fitResults = await checkFit(page, opts.fitSelector, viewport.height)
    result.checks.fit = { pass: fitResults.every((f) => f.pass), elements: fitResults }
  } else {
    result.checks.fit = { pass: true, skipped: 'below engageAt' }
  }

  // (d) grid-cols — column count per [data-verify-grid] element. Compared
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

// ── zoom row ─────────────────────────────────────────────────────────────

// Chromium stores page zoom as a level where factor = 1.2^level.
const zoomLevel = (z) => Math.log(z) / Math.log(1.2)
const ZOOM_PASS_RATIO = 0.9

async function measureAtZoom(chromium, url, base, z, selector, shotPath = null) {
  const dir = mkdtempSync(join(tmpdir(), 'fluid-zoom-'))
  mkdirSync(join(dir, 'Default'), { recursive: true })
  writeFileSync(join(dir, 'Default', 'Preferences'), JSON.stringify({ partition: { default_zoom_level: { x: zoomLevel(z) } } }))
  let ctx
  try {
    ctx = await chromium.launchPersistentContext(dir, {
      headless: true,
      channel: 'chromium', // the new headless: the headless shell ignores default_zoom_level
      viewport: null,
      args: [`--window-size=${base.width},${base.height}`]
    })
    const page = ctx.pages()[0] ?? (await ctx.newPage())
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.evaluate(() => new Promise((r) => setTimeout(r, 150)))
    const m = await page.evaluate((selector) => {
      const el = [...document.querySelectorAll(selector)].find((e) => {
        const r = e.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'
      })
      return {
        innerWidth,
        innerHeight,
        dpr: devicePixelRatio,
        fluidZoom: getComputedStyle(document.documentElement).getPropertyValue('--fluid-zoom').trim(),
        fontSize: el ? parseFloat(getComputedStyle(el).fontSize) : null,
        target: el ? el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') : null
      }
    }, selector)
    const overflow = await checkOverflow(page)
    let screenshot
    if (shotPath) {
      // Through the DevTools protocol, not page.screenshot(): Playwright's
      // capture crops a zoomed page to its top-left 1/zoom, which makes a
      // layout that fits look cut off.
      const cdp = await ctx.newCDPSession(page)
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 })
      writeFileSync(shotPath, Buffer.from(data, 'base64'))
      screenshot = shotPath
    }
    return { ...m, overflow, screenshot }
  } finally {
    if (ctx) await ctx.close()
    rmSync(dir, { recursive: true, force: true })
  }
}

async function runZoomRow(chromium, url, ctx, opts) {
  const desktopMin = ctx.structure.bands.desktop.minWidth
  const zooms = parseNumberList(opts.zoom)
  const bases = parseWxHList(opts.zoomBases).filter((b) => b.width >= desktopMin)
  const rows = []
  for (const base of bases) {
    const shot = (z) => (opts.screens ? join(opts.out, `zoom-${base.width}x${base.height}-${Math.round(z * 100)}.jpg`) : null)
    if (opts.screens) mkdirSync(opts.out, { recursive: true })
    const ref = await measureAtZoom(chromium, url, base, 1, opts.zoomSelector, shot(1))
    if (ref.fontSize === null) {
      rows.push({ base, zoom: 1, pass: false, note: `no visible element matches ${opts.zoomSelector}` })
      continue
    }
    if (Math.abs(ref.innerWidth - base.width) > 2) {
      return { skipped: `window-size did not apply (innerWidth ${ref.innerWidth} for ${base.width}): is the full Chromium installed?`, rows: [] }
    }
    rows.push({ base, zoom: 1, ...ref, physical: ref.fontSize, ratio: 1, pass: ref.overflow.pass })
    for (const z of zooms) {
      const m = await measureAtZoom(chromium, url, base, z, opts.zoomSelector, shot(z))
      if (Math.abs(m.innerWidth * z - base.width) > base.width * 0.02) {
        return { skipped: `zoom did not apply (innerWidth ${m.innerWidth} at ${z * 100}%): the headless shell ignores zoom; run npx playwright install chromium`, rows: [] }
      }
      const physical = m.fontSize === null ? null : m.fontSize * z
      const ratio = physical === null ? null : physical / ref.fontSize
      // WCAG 1.4.4 asks for 200%, so the target is proportional growth up to
      // 2x: at 300% text must reach 180%, not 270%. Past the engage handover
      // the mobile copy size decides it, which is legitimately smaller than
      // the scaled desktop copy on a wide display.
      const textPass = ratio !== null && ratio >= ZOOM_PASS_RATIO * Math.min(z, 2)
      rows.push({
        base,
        zoom: z,
        ...m,
        physical,
        ratio,
        engaged: m.innerWidth >= desktopMin,
        textPass,
        pass: textPass && m.overflow.pass
      })
    }
  }
  return { rows, pass: rows.every((r) => r.pass) }
}

function printZoomRow(zoom, strict) {
  if (!zoom) return
  if (zoom.skipped) {
    console.log(`zoom row: skipped — ${zoom.skipped}`)
    console.log('')
    return
  }
  console.log(`zoom row (WCAG 1.4.4; text must reach >= ${ZOOM_PASS_RATIO} x zoom, capped at 2x; no horizontal overflow)${strict ? '' : ' — warning only, --zoom-strict to gate'}:`)
  console.log('window      zoom  css viewport  scale     --fluid-zoom  text px  on screen  growth  overflow  result')
  for (const r of zoom.rows) {
    if (r.note) {
      console.log(`${r.base.width}x${r.base.height}  ${r.note}`)
      continue
    }
    console.log(
      [
        `${r.base.width}x${r.base.height}`.padEnd(12),
        `${Math.round(r.zoom * 100)}%`.padEnd(6),
        `${r.innerWidth}x${r.innerHeight}`.padEnd(14),
        (r.zoom === 1 ? 'fluid' : r.engaged ? 'fluid' : 'mobile').padEnd(10),
        (r.fluidZoom || '(unset)').padEnd(14),
        r.fontSize.toFixed(2).padEnd(9),
        r.physical.toFixed(2).padEnd(11),
        `${Math.round(r.ratio * 100)}%`.padEnd(8),
        (r.overflow.pass ? 'none' : `+${r.overflow.scrollWidth - r.overflow.innerWidth}px`).padEnd(10),
        r.pass ? 'PASS' : strict ? 'FAIL' : 'WARN'
      ].join('')
    )
  }
  if (!zoom.pass) {
    const failed = zoom.rows.filter((r) => !r.note && !r.pass)
    const engagedTextFails = failed.filter((r) => r.engaged && !r.textPass)
    const mobileTextFails = failed.filter((r) => !r.engaged && !r.textPass)
    if (engagedTextFails.some((r) => r.fluidZoom === '')) {
      console.log('  -> --fluid-zoom is unset: the zoom runtime is not installed on this page. Render <FluidHead/> (Next),')
      console.log('     add fluidPlugin() (Vite), or inline FLUID_ZOOM_INLINE from runtime/zoom.js in <head> (fluid-scale.md §12).')
    } else if (engagedTextFails.some((r) => r.fluidZoom === '1')) {
      console.log('  -> fluid-zoom.js is installed but detected no zoom. Check it runs in the top window and that')
      console.log('     fluid.config.json has zoom: true (the type units must read var(--fluid-zoom, 1)).')
    } else if (engagedTextFails.length > 0) {
      console.log('  -> --fluid-zoom is set but type did not grow: the stylesheet was generated with zoom: false, or this')
      console.log('     text is on --fluid (layout), which is never compensated.')
    }
    if (mobileTextFails.length > 0) {
      console.log('  -> mobile handover: at these zoom levels the CSS viewport dropped below engageAt and the page uses')
      console.log('     its mobile type, which is smaller than the desktop type had grown to on this window. Draw mobile')
      console.log('     body copy no smaller than the desktop reference size (fluid-scale.md §12, "The mobile handover").')
    }
    if (failed.some((r) => !r.overflow.pass)) {
      console.log('  -> horizontal overflow at zoom is a reflow bug (WCAG 1.4.10): a fixed width that the larger text broke out of.')
    }
  }
  console.log('')
}

// ── reporting ───────────────────────────────────────────────────────────

function viewportPass(v) {
  return v.checks.overflow.pass && v.checks.units.pass && v.checks.fit.pass
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
  console.log('width  height  mobile  overflow  units  fit  overall')
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
        console.log(`  unit ${name} (${v.band}): resolved ${u.resolved} vs expected ${u.expected.toFixed(4)} (drift ${Number.isFinite(u.drift) ? u.drift.toFixed(4) : 'n/a'})`)
        switch (u.diagnosis) {
          case 'missing':
            console.log('    -> missing: this page does not load the fluid stylesheet (wrong URL, a build without it, or not wired up)')
            break
          case 'v1':
            console.log('    -> the page runs a v1 fluid stylesheet (no --fluid-build): regenerate with `fluid generate` and replace the old imports')
            break
          case 'stale':
            console.log(`    -> stale stylesheet: the page was built from ${v.build}, fluid.config.json generates a different build. Run fluid generate, restart, and open a fresh tab`)
            break
          case 'mismatch':
            console.log('    -> current build, wrong number: fluid.css was edited by hand, or a unit is redeclared somewhere (fluid check lints that)')
            break
        }
      }
    }
    if (!v.checks.fit.pass) {
      for (const f of v.checks.fit.elements.filter((f) => !f.pass)) {
        console.log(`  fit[${f.index}]: height ${f.height} > viewport ${v.height} (ratio ${f.ratio})`)
      }
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
    console.error('usage: node verify-matrix.mjs <url> [--config f] [--out dir] [--widths …] [--heights …] [--mobile W1xH1,W2xH2|none] [--fit-selector sel] [--screens]')
    console.error('       node verify-matrix.mjs --help')
    process.exit(2)
  }

  let ctx
  try {
    ctx = loadContext(args.config)
  } catch (err) {
    console.error(err instanceof ConfigError ? err.message : String(err))
    process.exit(2)
  }
  const { structure } = ctx
  ctx.expectedBuild = ctx.migration ? null : buildOutput(structure).buildId
  const desktopMax = ctx.resolved['--fluid-desktop-scale-max']?.value ?? null

  let widths, heights, mobiles
  try {
    widths = parseNumberList(args.widths)
    heights = parseNumberList(args.heights)
    // With the mobile arm on, the phone matrix spans the clamp: a small phone
    // (below the reference), the reference, a large phone, and a tablet on
    // the cap, so every arm of clamp(min, 100vw/ref, max) is checked.
    const defaultMobile = structure.bands.phone.enabled ? '320x568,375x812,390x844,430x932,844x390,932x430,820x1180,834x1194' : '390x844,375x667'
    mobiles = parseWxHList(args.mobile ?? defaultMobile)
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
  if (desktopMax !== null) {
    const w = Math.ceil(desktopMax * 1.25 * ctx.resolved['--fluid-desktop-base-width'].value)
    const h = Math.ceil(desktopMax * 1.25 * ctx.resolved['--fluid-desktop-base-height'].value)
    ceilingViewports.push({ width: w, height: h })
  }

  let chromium, engine
  try {
    const pw = await resolvePlaywrightModule()
    chromium = pw.chromium
    engine = pw[args.browser]
    if (!['chromium', 'webkit', 'firefox'].includes(args.browser) || !engine) throw new Error(`[verify-matrix] --browser must be chromium, webkit or firefox (got ${JSON.stringify(args.browser)})`)
  } catch (err) {
    console.error(err.message)
    process.exit(2)
  }

  let browser
  try {
    browser = await engine.launch()
  } catch (err) {
    console.error(`[verify-matrix] could not launch ${args.browser}: ${err.message.split('\n')[0]}\n  Fix: npx playwright install ${args.browser}`)
    process.exit(2)
  }
  const viewports = []
  try {
    for (const h of heights) {
      for (const w of widths) {
        viewports.push(await runViewport(browser, url, ctx, args, { width: w, height: h }, false))
      }
    }
    for (const cv of ceilingViewports) {
      const r = await runViewport(browser, url, ctx, args, cv, false)
      r.ceilingCheck = true
      viewports.push(r)
    }
    for (const m of mobiles) {
      viewports.push(await runViewport(browser, url, ctx, args, m, true))
    }
  } finally {
    await browser.close()
  }

  let zoom = null
  if (args.browser !== 'chromium' && args.zoom && args.zoom.trim().toLowerCase() !== 'none') {
    zoom = { skipped: `the zoom row drives Chromium's zoom preference; run it with --browser chromium (this run: ${args.browser})`, rows: [] }
  } else if (args.zoom && args.zoom.trim().toLowerCase() !== 'none') {
    try {
      zoom = await runZoomRow(chromium, url, ctx, args)
    } catch (err) {
      zoom = { skipped: `could not launch Chromium with a zoom profile (${err.message.split('\n')[0]}); run npx playwright install chromium`, rows: [] }
    }
  }

  const gridColsReport = buildGridColsReport(viewports)

  mkdirSync(args.out, { recursive: true })
  const report = {
    url,
    browser: args.browser,
    config: { structure, expectedBuild: ctx.expectedBuild, settings: Object.fromEntries(Object.entries(ctx.resolved).filter(([, r]) => r.source !== 'default').map(([k, r]) => [k, { value: r.value, source: r.source }])) },
    generatedAt: new Date().toISOString(),
    viewports,
    gridCols: gridColsReport,
    zoom
  }
  writeFileSync(join(args.out, 'report.json'), JSON.stringify(report, null, 2))
  if (args.screens) writeContactSheet(args.out, viewports)

  printSummary(viewports)
  const builds = [...new Set(viewports.map((v) => v.build).filter(Boolean))]
  if (ctx.expectedBuild && builds.length && !builds.includes(ctx.expectedBuild)) {
    console.log(`note: the page was built from ${builds.join(', ')}, fluid.config.json generates ${ctx.expectedBuild}. Run fluid generate and reload before trusting a PASS.`)
    console.log('')
  }
  const tuned = [...new Set(viewports.flatMap((v) => v.checks.units.overridden ?? []))]
  if (tuned.length) console.log(`settings the page overrides (checked with its own values): ${tuned.join(', ')}\n`)
  printGridColsReport(gridColsReport)
  printZoomRow(zoom, args.zoomStrict)

  const zoomFail = args.zoomStrict && zoom && !zoom.skipped && !zoom.pass
  const anyFail = viewports.some((v) => !viewportPass(v)) || !gridColsReport.pass || zoomFail
  console.log(anyFail ? 'FAIL' : 'PASS')
  console.log(`report: ${join(args.out, 'report.json')}`)
  process.exit(anyFail ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
