// Park the scene at progress 0.5 and sample the presented frame for 2s.
// A scrub that is also PLAYING drifts forward and gets glided back: jitter.
import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto('http://localhost:4320/', { waitUntil: 'networkidle' })
const base = await p.evaluate(() => { const s = document.querySelector('[data-scrub-stage]'); return { top: s.getBoundingClientRect().top + scrollY, range: s.offsetHeight - innerHeight } })
// Arrive the way a reader does: sit in the head loop first, then scroll on.
for (let i = 1; i <= 20; i++) { await p.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), base.top * i / 20); await p.waitForTimeout(40) }
await p.waitForTimeout(2000)
for (let i = 1; i <= 20; i++) { await p.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), base.top + base.range * 0.5 * i / 20); await p.waitForTimeout(40) }
await p.waitForTimeout(2500)
const samples = await p.evaluate(() => new Promise((res) => { const v = document.querySelector('[data-scrub-video]'); const out = []; const t0 = performance.now(); const f = (_n, m) => { out.push(Math.round(m.mediaTime * 30)); if (performance.now() - t0 < 2000) v.requestVideoFrameCallback(f); else res({ paused: v.paused, presented: out.length, min: Math.min(...out), max: Math.max(...out), distinct: new Set(out).size }) }; v.requestVideoFrameCallback(f); setTimeout(() => res({ paused: v.paused, presented: out.length, note: 'no frames presented in 3s (static)' }), 3000) }))
console.log(JSON.stringify(samples))
await b.close()
