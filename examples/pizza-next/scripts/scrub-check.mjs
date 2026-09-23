// Scene sweep for the dough ScrubStage (verification.md §1): scroll to scene
// PROGRESS (never raw px), let the glide settle, read state, screenshot.
//
//   node scripts/scrub-check.mjs <url> [outDir] [WxH]
//
// Reads `window.__scrub()` when the page defines it (dev builds only — the
// component strips it in production) and always reads the DOM contract:
// `video[data-motion-state]`, `currentTime`, and the video's transform.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:4310'
const out = process.argv[3] ?? 'verify-out/scrub'
const [W, H] = (process.argv[4] ?? '1440x900').split('x').map(Number)
mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H } })
await page.goto(url, { waitUntil: 'networkidle' })

const base = await page.evaluate(() => {
  const s = document.querySelector('[data-scrub-stage]')
  return { top: s.getBoundingClientRect().top + scrollY, range: s.offsetHeight - innerHeight }
})

// Approach from above in steps so the wake/warm observers fire the way a reader's scroll would.
for (let y = 0; y < base.top; y += Math.round(H * 0.8)) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y)
  await page.waitForTimeout(150)
}

const rows = []
for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(base.top + base.range * progress))
  await page.waitForTimeout(2500)
  const state = await page.evaluate(() => {
    const v = document.querySelector('[data-scrub-stage] video')
    const dbg = typeof window.__scrub === 'function' ? window.__scrub() : null
    return {
      mode: v?.getAttribute('data-motion-state'),
      time: v ? +v.currentTime.toFixed(3) : null,
      frame: v ? Math.round(v.currentTime * 30) : null,
      paused: v?.paused,
      ready: v?.readyState,
      src: v?.currentSrc?.split('/').pop(),
      transform: v?.style.transform,
      header: getComputedStyle(document.querySelector('header nav')).color,
      scrub: dbg && { mode: dbg.mode, modeFromP: dbg.modeFromP, targetTime: dbg.targetTime, awake: dbg.awake, travel: dbg.travel }
    }
  })
  const file = `scrub-${W}x${H}-p${String(progress).replace('.', '')}.png`
  await page.screenshot({ path: join(out, file) })
  rows.push({ progress, ...state, file })
  console.log(JSON.stringify({ progress, ...state }))
}
writeFileSync(join(out, `scrub-${W}x${H}.json`), JSON.stringify({ url, viewport: [W, H], base, rows }, null, 2))
await browser.close()
