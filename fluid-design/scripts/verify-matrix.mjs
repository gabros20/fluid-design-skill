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
  /clamp\(/, // a pre-rewrite desktop clamp()-based formula. Desktop rows only: the mobile arm's clamp(min, 100vw/N, max) below engageAt is current
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

/** Collapses whitespace and strips a redundant leading zero before a decimal
 * point (`0.9px` -> `.9px`) so two computed-vs-expected expressions that are
 * the SAME value serialised two different ways never register as a
 * mismatch. Measured: the browser's `getComputedStyle` drops the leading
 * zero (and reformats `var()` internals) even when the raw text otherwise
 * matches the generator's own output character-for-character, which made
 * every passing unit row on `display`/`copy` (values built from `--fluid`
 * inside a further `calc()`) come back diagnosed "mismatch" despite
 * `pass: true` and `drift: 0`. */
function normalizeExpr(s) {
  if (typeof s !== 'string') return s
  return s
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(?<!\d)0+(\.\d)/g, '$1')
}

/** Distinguishes a genuinely stale build from any other kind of drift, so a
 * generator/config bug is never reported with "close the tab" advice that
 * cannot fix it. */
function diagnoseUnitMismatch(raw, expected, engaged = true) {
  if (raw === '') return 'missing'
  if (expected === null) return raw === '' ? 'missing' : 'unexpected' // property shouldn't exist for this config at all
  if (normalizeExpr(raw) === normalizeExpr(expected)) return 'match'
  const signatures = engaged ? KNOWN_STALE_SIGNATURES : KNOWN_STALE_SIGNATURES.filter((re) => re.source !== 'clamp\\(')
  if (signatures.some((re) => re.test(raw))) return 'stale'
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

// The four custom properties are FIXED NAMES (`--fluid`, `--fluid-display`,
// `--fluid-copy`, `--fluid-chrome`) regardless of `fluid.config.json`'s
// `prefix` — only utility/class/function names move with `prefix`
// (references/contract.md §1). `readUnits` therefore never takes a
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
    const pass = drift <= UNIT_TOLERANCE
    return {
      unit: key,
      raw: raw[key],
      rawExpr: raw[key], // the exact computed expression text, alongside `expected` below
      resolved: r,
      expected: expected[key],
      expectedExpr,
      // Only computed for a failing row -- diagnoseUnitMismatch's job is to
      // explain a FAILURE, and even after normalizeExpr a passing row can
      // still carry harmless string drift (e.g. resolved var() internals)
      // that would otherwise print "mismatch" in report.json next to
      // pass: true, drift: 0 and mislead anyone reading the JSON directly
      // (the console table already only prints diagnosis for failing rows).
      diagnosis: pass ? undefined : diagnoseUnitMismatch(raw[key], expectedExpr, viewport.width >= cfg.engageAt),
      drift,
      pass
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

async function runZoomRow(chromium, url, cfg, opts) {
  const zooms = parseNumberList(opts.zoom)
  const bases = parseWxHList(opts.zoomBases).filter((b) => b.width >= cfg.engageAt)
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
        engaged: m.innerWidth >= cfg.engageAt,
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
      console.log('  -> --fluid-zoom is unset: assets/runtime/fluid-zoom.js is not installed on this page. Inline')
      console.log('     FLUID_ZOOM_INLINE in <head> (fluid-scale.md §12).')
    } else if (engagedTextFails.some((r) => r.fluidZoom === '1')) {
      console.log('  -> fluid-zoom.js is installed but detected no zoom. Check it runs in the top window and that')
      console.log('     the config has zoomCompensation: true (the type units must read var(--fluid-zoom, 1)).')
    } else if (engagedTextFails.length > 0) {
      console.log('  -> --fluid-zoom is set but type did not grow: the stylesheet predates zoomCompensation (regenerate')
      console.log('     it), or this text is on --fluid / fluid-text-*, which are never compensated.')
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
    // With the mobile arm on, the phone matrix spans the clamp: a small phone
    // (below the reference), the reference, a large phone, and a tablet on
    // the cap, so every arm of clamp(min, 100vw/ref, max) is checked.
    const defaultMobile = cfg.mobile.enabled ? '360x780,390x844,430x932,768x1024' : '390x844,375x667'
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

  let zoom = null
  if (args.zoom && args.zoom.trim().toLowerCase() !== 'none') {
    try {
      zoom = await runZoomRow(chromium, url, cfg, args)
    } catch (err) {
      zoom = { skipped: `could not launch Chromium with a zoom profile (${err.message.split('\n')[0]}); run npx playwright install chromium`, rows: [] }
    }
  }

  const gridColsReport = buildGridColsReport(viewports)

  mkdirSync(args.out, { recursive: true })
  const report = {
    url,
    config: { prefix: cfg.prefix, reference: cfg.reference, engageAt: cfg.engageAt, ceiling: cfg.ceiling, zoomCompensation: cfg.zoomCompensation },
    generatedAt: new Date().toISOString(),
    viewports,
    gridCols: gridColsReport,
    zoom
  }
  writeFileSync(join(args.out, 'report.json'), JSON.stringify(report, null, 2))
  if (args.screens) writeContactSheet(args.out, viewports)

  printSummary(viewports)
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
