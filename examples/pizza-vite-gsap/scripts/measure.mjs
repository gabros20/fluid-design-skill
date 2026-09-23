// node scripts/measure.mjs WxH  — frame vs chrome-sized content at one viewport
import { chromium } from 'playwright'
const [w, h] = process.argv[2].split('x').map(Number)
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: w, height: h } })
await p.goto('http://localhost:4320/', { waitUntil: 'networkidle' })
await p.waitForTimeout(800)
console.log(JSON.stringify(await p.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { w: Math.round(b.width), right: Math.round(b.right), scrollW: e.scrollWidth } }
  const frame = document.querySelector('.footer__frame'); const cs = getComputedStyle(frame)
  const mark = document.querySelector('.footer__mark')
  const range = document.createRange(); range.selectNodeContents(mark)
  return { frame: r('.footer__frame'), frameContentRight: Math.round(frame.getBoundingClientRect().right - parseFloat(cs.paddingRight)), markInkRight: Math.round(range.getBoundingClientRect().right), markFont: getComputedStyle(mark).fontSize, heroTitle: getComputedStyle(document.querySelector('.hero__title')).fontSize }
})))
await b.close()
