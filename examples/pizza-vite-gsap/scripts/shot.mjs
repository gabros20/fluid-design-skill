// Quick look: node scripts/shot.mjs <W>x<H> <out.png> [scrollY|full]
import { chromium } from 'playwright'
const [size, out, mode = '0'] = process.argv.slice(2)
const [w, h] = size.split('x').map(Number)
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: w, height: h } })
await p.goto('http://localhost:4320/', { waitUntil: 'networkidle' })
await p.waitForTimeout(1800)
if (mode === 'full') {
  for (let y = 0; y < (await p.evaluate(() => document.body.scrollHeight)); y += h / 2) {
    await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y)
    await p.waitForTimeout(120)
  }
  await p.waitForTimeout(1500)
  await p.screenshot({ path: out, fullPage: true })
} else {
  await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Number(mode))
  await p.waitForTimeout(1600)
  await p.screenshot({ path: out })
}
await b.close()
