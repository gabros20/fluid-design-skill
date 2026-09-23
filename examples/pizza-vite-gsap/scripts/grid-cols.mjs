// Column count of the auto-fill menu grid across viewports (frame-and-gutter.md §3).
import { chromium } from 'playwright'
const b = await chromium.launch()
for (const s of ['390x844', '1024x640', '1024x700', '1280x800', '1440x900', '1600x900', '1680x700', '2560x1440', '3840x2160']) {
  const [w, h] = s.split('x').map(Number)
  const p = await b.newPage({ viewport: { width: w, height: h } })
  await p.goto('http://localhost:4320/', { waitUntil: 'load' })
  const cols = await p.evaluate(() => getComputedStyle(document.querySelector('.menu__grid')).gridTemplateColumns.split(' ').length)
  console.log(s.padEnd(10), 'cols', cols)
  await p.close()
}
await b.close()
