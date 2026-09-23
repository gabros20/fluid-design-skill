// Header ink per section, count-up final values, fade-on-exit opacity.
import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto('http://localhost:4320/', { waitUntil: 'networkidle' })
await p.waitForTimeout(600)
const at = async (sel, frac = 0) => {
  const y = await p.evaluate(([s, f]) => { const e = document.querySelector(s); return e.getBoundingClientRect().top + scrollY + e.offsetHeight * f }, [sel, frac])
  const cur = await p.evaluate(() => scrollY)
  for (let i = 1; i <= 15; i++) { await p.evaluate((v) => scrollTo({ top: v, behavior: 'instant' }), cur + ((y - cur) * i) / 15); await p.waitForTimeout(30) }
  await p.waitForTimeout(1600)
  return p.evaluate(() => ({ header: document.querySelector('.site-header').getAttribute('data-theme'), counts: [...document.querySelectorAll('[data-count-up]')].map((e) => e.textContent).join(','), groupOpacity: getComputedStyle(document.querySelector('[data-fade-on-exit]')).opacity }))
}
const rows = { top: await at('.hero'), numbersIn: await at('.numbers', 0.2), numbersLeaving: await at('.numbers', 0.75), scene: await at('.scene', 0.3), footer: await at('.footer'), backToMenu: await at('.menu', 0.3) }
console.table(rows)
await b.close()
