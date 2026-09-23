// Drive the one scroll scene by PROGRESS (verification.md §1), read
// data-motion-state + the decoder playhead, and screenshot each step.
// node scripts/scrub-modes.mjs [WxH] [outDir]
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
const [size = '1440x900', out = 'verify-out/scrub'] = process.argv.slice(2)
const [w, h] = size.split('x').map(Number)
mkdirSync(out, { recursive: true })
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: w, height: h } })
await p.goto('http://localhost:4320/', { waitUntil: 'networkidle' })
await p.waitForTimeout(800)
const base = await p.evaluate(() => {
  const s = document.querySelector('[data-scrub-stage]')
  return { top: s.getBoundingClientRect().top + scrollY, range: s.offsetHeight - innerHeight }
})
const rows = []
// Walk in steps so the latch sees every crossing, as a reader would;
// then come back to 0 to prove the reverse transitions (hysteresis) too.
for (const target of [0, 0.5, 1, 0.5, 0]) {
  const from = await p.evaluate(() => scrollY)
  const to = base.top + base.range * target
  for (let i = 1; i <= 20; i++) {
    await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), from + ((to - from) * i) / 20)
    await p.waitForTimeout(40)
  }
  await p.waitForTimeout(2500) // let the glide settle
  const s = await p.evaluate(() => {
    const v = document.querySelector('[data-scrub-video]')
    const st = document.querySelector('[data-scrub-stage]').getBoundingClientRect()
    return {
      mode: v.getAttribute('data-motion-state'),
      frame: Math.round(v.currentTime * 30),
      paused: v.paused,
      progress: +Math.min(1, Math.max(0, -st.top / (st.height - innerHeight))).toFixed(3),
      header: document.querySelector('.site-header').getAttribute('data-theme')
    }
  })
  rows.push({ target, ...s })
  await p.screenshot({ path: `${out}/scrub-${size}-p${target}-${rows.length}.png` })
}
console.table(rows)
await b.close()
