// live.mjs — reading a running page: the one Playwright resolver, and the
// one reader of a page's units, settings, build stamp and scopes. Used by
// `fluid explain --url` (which `fluid probe` is an alias of) and by
// verify.mjs.

import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { settingsSpec } from './spec.mjs'
import { scopeSelector } from './emit/engine.mjs'

export class LiveError extends Error {}

/** Playwright from the project first (where a consumer runs this), then
 * from beside the skill. */
export async function loadPlaywright() {
  const attempts = []
  for (const [label, base] of [[`the project (${process.cwd()})`, pathToFileURL(join(process.cwd(), 'package.json'))], ['beside the skill', import.meta.url]]) {
    try {
      const resolved = createRequire(base).resolve('playwright')
      const mod = await import(pathToFileURL(resolved).href)
      return mod.chromium ? mod : mod.default
    } catch (err) {
      attempts.push(`${label}: ${err.code ?? err.message}`)
    }
  }
  throw new LiveError(['playwright is not installed here (tried ' + attempts.join('; ') + ').', 'In the project: npm i -D playwright && npx playwright install chromium'].join('\n'))
}

export async function readLive(url, { w, h, structure, at = null, zoom = null }) {
  const pw = await loadPlaywright()
  const browser = await pw.chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    await page.goto(url, { waitUntil: 'networkidle' })
    // Emulated zoom: the runtime's variable, set inline (it beats the
    // runtime's adopted sheet), so page and model see the same input.
    if (zoom !== null) await page.evaluate((z) => document.documentElement.style.setProperty('--fluid-zoom', String(z)), zoom)
    const names = settingsSpec(structure).map((s) => s.name)
    const units = ['fluid', ...structure.roles, ...(structure.ui ? ['ui'] : [])]
    const scopeSel = scopeSelector(structure.prefix).replace(/:root,\n/, '')
    const res = await page.evaluate(({ names, units, at, scopeSel, prefix }) => {
      const read = (el) => {
        const cs = getComputedStyle(el)
        const out = {}
        for (const n of names) {
          const v = cs.getPropertyValue(n).trim()
          if (v !== '' && Number.isFinite(Number(v))) out[n] = Number(v)
        }
        return out
      }
      const measure = (host) => {
        const probe = document.createElement('div')
        probe.style.cssText = 'position:absolute;visibility:hidden;left:0;top:0;height:0;padding:0;border:0'
        host.appendChild(probe)
        const got = {}
        for (const u of units) {
          probe.style.width = `calc(1000 * var(--fluid${u === 'fluid' ? '' : '-' + u}))`
          got[u] = probe.getBoundingClientRect().width / 1000
        }
        probe.remove()
        return got
      }
      const root = document.documentElement
      const target = at ? document.querySelector(at) : root
      if (!target) return { missing: true }
      const settings = read(target)
      const overrides = Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, { value: v, source: at ? `the page, at ${at}` : 'the page' }]))
      const result = { overrides, units: measure(at ? target : document.body), isScope: target === root || target.matches(scopeSel), build: getComputedStyle(root).getPropertyValue('--fluid-build').trim().replace(/^"|"$/g, '') }
      if (at) return result
      // Scopes: what each one sets beyond the page, and what inside follows the scale.
      const rootSettings = read(root)
      // By class/attribute, and anywhere a setting changes from the parent:
      // an SCSS/StyleX scope (a mixin, no class) is only visible that way.
      const all = [...document.querySelectorAll(scopeSel)]
      const seen = new Set(all)
      const memo = new Map([[root, JSON.stringify(rootSettings)]])
      const key = (el) => {
        if (!memo.has(el)) memo.set(el, JSON.stringify(read(el)))
        return memo.get(el)
      }
      for (const el of [...document.body.querySelectorAll('*')].slice(0, 5000)) {
        if (!seen.has(el) && el.parentElement && key(el) !== key(el.parentElement)) {
          all.push(el)
          seen.add(el)
        }
      }
      const limitRe = new RegExp(`(^|:)${prefix}-(grow-until|ui-grow-until|shrink-until)-|(^|:)${prefix}-off$`)
      const props = ['width', 'height', 'fontSize', 'paddingTop', 'paddingLeft', 'marginTop', 'gap', 'top', 'left']
      result.scopes = all.slice(0, 20).map((el) => {
        const own = read(el)
        const settings = Object.fromEntries(Object.entries(own).filter(([k, v]) => rootSettings[k] !== v))
        const cls = [...el.classList]
        const label = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls.length ? '.' + cls.slice(0, 4).join('.') : ''}${cls.length > 4 ? '…' : ''}`
        const u = measure(el)
        // Toggle the scale off (or back on) on this scope and count what moves.
        let following = null
        if (Math.abs(u.fluid - 1) > 0.02 || settings['--fluid-off'] === 1) {
          const kids = [...el.querySelectorAll('*')].slice(0, 600)
          const snap = () => kids.map((k) => { const cs = getComputedStyle(k); return props.map((p) => cs[p]).join('|') })
          const before = snap()
          const prev = el.style.getPropertyValue('--fluid-off')
          el.style.setProperty('--fluid-off', own['--fluid-off'] === 1 ? '0' : '1')
          const after = snap()
          if (prev) el.style.setProperty('--fluid-off', prev)
          else el.style.removeProperty('--fluid-off')
          following = before.filter((b, i) => b !== after[i]).length
        }
        return { label, settings, units: u, following, limit: cls.some((c) => limitRe.test(c)) }
      })
      result.scopesTruncated = all.length > 20
      return result
    }, { names, units, at, scopeSel, prefix: structure.prefix })
    if (res.missing) throw new LiveError(`--at ${JSON.stringify(at)} matches nothing on ${url} at ${w}×${h}`)
    return res
  } finally {
    await browser.close()
  }
}

