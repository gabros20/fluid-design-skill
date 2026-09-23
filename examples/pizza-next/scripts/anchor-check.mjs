// Anchor-scroll check for SKILL-FEEDBACK item 18: a smooth `#menu` jump from
// the top has to cross the dough scene's scroll well (PullToCentre). Before the
// upstream suspend() fix the well's per-frame `instant` writes cancelled it and
// it landed at act 3. Asserts the target lands within 2px of where the CSS says
// it should (scroll-margin-top + html scroll-padding-top, or the bottom clamp).
//
//   node scripts/anchor-check.mjs [baseUrl]
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:4310'
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844, isMobile: true, hasTouch: true }
]
const TOLERANCE = 2

const browser = await chromium.launch()
let failed = 0
try {
  for (const vp of VIEWPORTS) {
    const { isMobile, hasTouch, ...viewport } = vp
    const ctx = await browser.newContext({ viewport, isMobile, hasTouch })
    const page = await ctx.newPage()
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    const before = await page.evaluate(() => ({
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      y: window.scrollY
    }))

    // Record every scrollY the page passes through, so the result shows the
    // jump really was smooth (i.e. the fix is exercised, not bypassed).
    await page.evaluate(() => {
      window.__ys = []
      const tick = () => {
        window.__ys.push(Math.round(window.scrollY))
        if (!window.__stopTrace) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })

    const link = page.locator('header a[href="#menu"]').first()
    if (!(await link.isVisible())) {
      // The mobile header may hide the link behind a menu; fall back to a
      // synthetic click on the same anchor so the click-capture path still runs.
      await page.evaluate(() => document.querySelector('header a[href="#menu"]').click())
    } else {
      await link.click()
    }

    // Settle: scrollY unchanged for 500ms, 10s cap.
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          let last = -1
          let since = performance.now()
          const t0 = performance.now()
          const poll = () => {
            const y = window.scrollY
            if (y !== last) {
              last = y
              since = performance.now()
            }
            if (performance.now() - since > 500 || performance.now() - t0 > 10000) resolve()
            else requestAnimationFrame(poll)
          }
          poll()
        })
    )

    const r = await page.evaluate(() => {
      window.__stopTrace = true
      const el = document.getElementById('menu')
      const cs = getComputedStyle(el)
      const root = getComputedStyle(document.documentElement)
      const probe = document.createElement('div')
      probe.style.height = 'var(--header-h)'
      document.body.appendChild(probe)
      const headerH = probe.getBoundingClientRect().height
      probe.remove()
      const marginTop = parseFloat(cs.scrollMarginTop) || 0
      const paddingTop = parseFloat(root.scrollPaddingTop) || 0
      const top = el.getBoundingClientRect().top
      const y = window.scrollY
      const maxY = document.documentElement.scrollHeight - innerHeight
      const docTop = top + y
      const targetY = Math.min(maxY, Math.max(0, docTop - marginTop - paddingTop))
      const ys = window.__ys
      const distinct = new Set(ys).size
      return { top, y, targetY, maxY, marginTop, paddingTop, headerH, distinct, samples: ys.length, hash: location.hash }
    })

    // Expected viewport offset of the section: its scroll-margin/padding, unless
    // the page bottom clamps the scroll.
    const expectedTop = r.top + r.y - r.targetY
    const delta = Math.abs(r.y - r.targetY)
    const ok = delta <= TOLERANCE
    if (!ok) failed++
    console.log(
      `${vp.width}x${vp.height}  scroll-behavior=${before.scrollBehavior}  ` +
        `landed y=${Math.round(r.y)} target y=${Math.round(r.targetY)} delta=${delta.toFixed(1)}px  ` +
        `#menu rect.top=${r.top.toFixed(1)} (expected ${expectedTop.toFixed(1)}: scroll-margin-top ${r.marginTop}, ` +
        `scroll-padding-top ${r.paddingTop}; --header-h ${r.headerH.toFixed(1)}px, unused by the anchor)  ` +
        `path: ${r.distinct} distinct scrollY values  hash=${r.hash}  ${ok ? 'PASS' : 'FAIL'}`
    )
    await ctx.close()
  }
} finally {
  await browser.close()
}
process.exit(failed ? 1 : 0)
