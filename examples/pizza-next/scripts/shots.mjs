// Hero-at-rest screenshots at the brief's five viewports, plus a stepped
// full-page capture (reveals fired) for each.
//
//   node scripts/shots.mjs <url> [outDir]
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:4310'
const out = process.argv[3] ?? 'verify-out/shots'
mkdirSync(out, { recursive: true })
const SIZES = ['1440x900', '1280x800', '1024x700', '2560x1440', '390x844']

const browser = await chromium.launch()
for (const size of SIZES) {
  const [width, height] = size.split('x').map(Number)
  const page = await browser.newPage({ viewport: { width, height } })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2200) // veil + 1.3s entrance
  await page.screenshot({ path: join(out, `hero-${size}.png`) })
  // Step down so every stage fires, then back to the top for a full-page capture.
  await page.evaluate(async () => {
    const max = document.documentElement.scrollHeight - innerHeight
    for (let y = 0; y <= max; y += Math.round(innerHeight * 0.6)) {
      window.scrollTo({ top: y, behavior: 'instant' })
      await new Promise((r) => setTimeout(r, 180))
    }
    window.scrollTo({ top: max, behavior: 'instant' })
    await new Promise((r) => setTimeout(r, 1500))
    window.scrollTo({ top: 0, behavior: 'instant' })
    await new Promise((r) => setTimeout(r, 400))
  })
  await page.screenshot({ path: join(out, `full-${size}.png`), fullPage: true })
  await page.close()
  console.log('shot', size)
}
await browser.close()
