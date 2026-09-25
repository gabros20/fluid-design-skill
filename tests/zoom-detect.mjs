#!/usr/bin/env node
// zoom-detect.mjs — the zoom runtime's detection and write path, in Node with
// stubbed window/document/navigator values. No browser.
//
// The table holds real zoom (must be read) and the geometries that fool a
// width-only match (must read 1): display scaling plus a side panel whose
// share of the window equals a scaling ratio, and docked DevTools. Each row
// runs twice: through installFluidZoom from the generated runtime/zoom.js,
// and through the generated FLUID_ZOOM_INLINE string evaluated as the inline
// <script> would be. It also checks FLUID_ZOOM_SHA256 is the hash of that
// string, that zoom.classic.js is the same string, and the two write paths
// (adopted stylesheet, and the <html> style fallback that writes nothing on
// an unzoomed page).

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { normaliseStructure } from '../skills/fluid-design/scripts/lib/spec.mjs'
import { buildOutput } from '../skills/fluid-design/scripts/lib/emit/project.mjs'

let failures = 0
const expect = (ok, what, extra = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${!ok && extra ? `\n     ${extra}` : ''}`)
}

const CHROME_WIN = { userAgentData: { brands: [] }, platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' }
const CHROME_MAC = { userAgentData: { brands: [] }, platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' }
const SAFARI = { platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15' }
const FIREFOX = { platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0' }

// A window of ow×oh window px with `toolbar` px of browser chrome on top, a
// side panel taking `panel` of the width, `bottom` window px of DevTools
// docked below, at page zoom z on a display of native ratio `native`.
// innerWidth/innerHeight are CSS px, rounded as browsers report them.
function geometry({ ow = 1920, oh = 1040, toolbar = 85, panel = 0, bottom = 0, z = 1, native = 1, dpr }) {
  return {
    outerWidth: ow,
    outerHeight: oh,
    innerWidth: Math.round((ow * (1 - panel)) / z),
    innerHeight: Math.round((oh - toolbar - bottom) / z),
    devicePixelRatio: dpr ?? native * z
  }
}

const CASES = [
  // real Chromium zoom, read
  { name: 'Chromium 125%, 1x display', nav: CHROME_WIN, g: { z: 1.25 }, want: 1.25 },
  { name: 'Chromium 150%, 1x display', nav: CHROME_WIN, g: { z: 1.5 }, want: 1.5 },
  { name: 'Chromium 200%, 1x display', nav: CHROME_WIN, g: { z: 2 }, want: 2 },
  { name: 'Chromium 125%, Retina (Mac)', nav: CHROME_MAC, g: { ow: 1440, oh: 900, z: 1.25, native: 2 }, want: 1.25 },
  { name: 'Chromium 150%, Retina (Mac)', nav: CHROME_MAC, g: { ow: 1440, oh: 900, z: 1.5, native: 2 }, want: 1.5 },
  { name: 'Chromium 200%, Retina (Mac)', nav: CHROME_MAC, g: { ow: 1440, oh: 900, z: 2, native: 2 }, want: 2 },
  { name: 'Chromium 110%, 1x display, bookmarks bar + infobar', nav: CHROME_WIN, g: { z: 1.1, toolbar: 150 }, want: 1.1 },
  { name: 'Chromium 150% on Windows 150% scaling', nav: CHROME_WIN, g: { ow: 1280, oh: 680, z: 1.5, native: 1.5 }, want: 1.5 },
  { name: 'Chromium unzoomed', nav: CHROME_WIN, g: {}, want: 1 },
  { name: 'Chromium fullscreen 125% (no toolbar)', nav: CHROME_WIN, g: { z: 1.25, toolbar: 0 }, want: 1.25 },
  // width-only false positives, must read 1
  { name: 'Windows 125% scaling + 20% side panel', nav: CHROME_WIN, g: { ow: 1536, oh: 816, native: 1.25, panel: 0.2 }, want: 1 },
  { name: 'Windows 150% scaling + 1/6 side panel', nav: CHROME_WIN, g: { ow: 1280, oh: 680, native: 1.5, panel: 1 / 6 }, want: 1 },
  { name: 'Windows 200% scaling + 25% side panel', nav: CHROME_WIN, g: { ow: 1920, oh: 1040, native: 2, panel: 0.25 }, want: 1 },
  { name: 'Retina Mac + DevTools docked right 50%', nav: CHROME_MAC, g: { ow: 1440, oh: 900, native: 2, panel: 0.5 }, want: 1 },
  { name: 'Retina Mac + DevTools right 50% + bookmarks', nav: CHROME_MAC, g: { ow: 1440, oh: 900, native: 2, panel: 0.5, toolbar: 120 }, want: 1 },
  // real zoom the height axis can't confirm: the documented safe failure
  { name: 'Chromium 125% + DevTools docked bottom (safe: 1)', nav: CHROME_MAC, g: { ow: 1440, oh: 900, z: 1.25, native: 2, bottom: 300 }, want: 1 },
  // no reading
  { name: 'iframe (outerWidth is the top window’s)', nav: CHROME_WIN, g: { z: 1.25 }, iframe: true, want: null },
  { name: 'window not shown yet (outerWidth 0)', nav: CHROME_WIN, g: { ow: 0 }, want: null },
  { name: 'Firefox 110% (gated off)', nav: FIREFOX, g: { dpr: 2.222 }, want: 1 },
  // Safari
  { name: 'Safari 125% (real zoom)', nav: SAFARI, g: { ow: 1440, oh: 900, native: 2, dpr: 2, z: 1.25 }, want: 1.25 },
  { name: 'Safari 150% (real zoom)', nav: SAFARI, g: { ow: 1440, oh: 900, native: 2, dpr: 2, z: 1.5 }, want: 1.5 },
  { name: 'Safari sidebar at 100% (measured 1.2038)', nav: SAFARI, g: { ow: 1440, oh: 900, dpr: 2, panel: 1 - 1 / 1.2038 }, want: 1 },
  { name: 'Safari sidebar at 100% matching the 125% step', nav: SAFARI, g: { ow: 1440, oh: 900, dpr: 2, panel: 0.2 }, want: 1 },
  { name: 'Safari sidebar at 100% matching the 115% step', nav: SAFARI, g: { ow: 1440, oh: 900, dpr: 2, panel: 1 - 1 / 1.15 }, want: 1 }
]

// A fake browser: records what the runtime writes and where.
function fakeBrowser(nav, g, { iframe = false, adopted = true } = {}) {
  const writes = []
  const html = { style: { setProperty: (k, v) => writes.push({ via: 'style', k, v }) } }
  const document = { documentElement: html }
  let sheets = []
  if (adopted) {
    Object.defineProperty(document, 'adoptedStyleSheets', {
      get: () => sheets,
      set: (v) => { sheets = v; writes.push({ via: 'adopt', count: v.length }) }
    })
  }
  class CSSStyleSheet {
    replaceSync(text) { this.text = text; writes.push({ via: 'sheet', text }) }
  }
  const frames = []
  const window = {
    ...g,
    CSSStyleSheet: adopted ? CSSStyleSheet : undefined,
    requestAnimationFrame: (f) => frames.push(f),
    matchMedia: () => ({ addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
    removeEventListener() {}
  }
  window.self = window
  window.top = iframe ? {} : window
  return { env: { window, document, navigator: nav }, writes, frames, sheets: () => sheets }
}

// The value --fluid-zoom ends up with, as getComputedStyle would see it.
function zoomOf(b) {
  const sheet = b.sheets().find((s) => s.text)
  if (sheet) return Number(/--fluid-zoom: ([\d.]+)/.exec(sheet.text)[1])
  const w = b.writes.filter((x) => x.via === 'style').at(-1)
  return w ? Number(w.v) : null
}

const dir = mkdtempSync(join(tmpdir(), 'fluid-zoom-detect-'))
try {
  const s = normaliseStructure({ output: { stack: 'css', integration: 'none' } })
  const { files } = buildOutput(s)
  writeFileSync(join(dir, 'zoom.mjs'), files['runtime/zoom.js'])
  const mod = await import(pathToFileURL(join(dir, 'zoom.mjs')).href)

  // the literal and its hash
  const hash = `sha256-${createHash('sha256').update(mod.FLUID_ZOOM_INLINE, 'utf8').digest('base64')}`
  expect(/^sha256-[A-Za-z0-9+/]{43}=$/.test(mod.FLUID_ZOOM_SHA256), 'FLUID_ZOOM_SHA256 is a CSP sha256 source', mod.FLUID_ZOOM_SHA256)
  expect(mod.FLUID_ZOOM_SHA256 === hash, 'FLUID_ZOOM_SHA256 is the sha256 of FLUID_ZOOM_INLINE', `${mod.FLUID_ZOOM_SHA256} vs ${hash}`)
  expect(/^export const FLUID_ZOOM_INLINE = "/m.test(files['runtime/zoom.js']) && !files['runtime/zoom.js'].includes('toString()'), 'runtime/zoom.js carries the inline script as a string literal, not toString')
  expect(files['runtime/zoom.classic.js'].trimEnd().endsWith('\n' + mod.FLUID_ZOOM_INLINE) && files['runtime/zoom.classic.js'].includes(mod.FLUID_ZOOM_SHA256), 'zoom.classic.js is the same literal, with its hash')
  expect(!/^\s*\/\//m.test(mod.FLUID_ZOOM_INLINE), 'the inline literal has no comment lines')
  const next = buildOutput(normaliseStructure({ output: { stack: 'tailwind-v4', integration: 'next' } })).files
  expect(next['integrations/next.tsx'].includes('<script nonce={nonce}'), 'Next FluidHead passes a nonce through')
  const vite = buildOutput(normaliseStructure({ output: { stack: 'css', integration: 'vite' } })).files
  expect(vite['integrations/vite.ts'].includes('attrs: nonce ? { nonce } : {}'), 'Vite fluidPlugin puts a nonce on the tag')
  const off = buildOutput(normaliseStructure({ zoom: false, output: { stack: 'css', integration: 'next' } })).files
  expect(!off['runtime/zoom.js'] && off['integrations/next.tsx'].includes('return null') && off['integrations/next.tsx'].includes('nonce?: string'), 'zoom: false keeps a FluidHead that takes a nonce and renders nothing')

  const viaInline = (env) => new Function('window', 'document', 'navigator', 'requestAnimationFrame', mod.FLUID_ZOOM_INLINE)(env.window, env.document, env.navigator, env.window.requestAnimationFrame)

  // the table
  for (const c of CASES) {
    for (const [how, run] of [['module', (env) => mod.installFluidZoom(env)], ['inline', viaInline]]) {
      const b = fakeBrowser(c.nav, geometry(c.g), { iframe: c.iframe })
      run(b.env)
      const got = zoomOf(b)
      // null: nothing detected. The adopted path still writes 1, so a
      // missing reading shows up as 1 there.
      const want = c.want === null ? 1 : c.want
      expect(Math.abs(got - want) < 0.001, `${c.name} → ${c.want ?? 'no reading (1)'} [${how}]`, `got ${got}`)
      if (c.want === null) expect(b.frames.length === (c.iframe ? 0 : 1), `  ${c.iframe ? 'no retry in an iframe' : 'retries on the next frame'} [${how}]`)
    }
  }

  // write paths
  {
    const b = fakeBrowser(CHROME_WIN, geometry({}))
    mod.installFluidZoom(b.env)
    expect(b.sheets().length === 1 && zoomOf(b) === 1 && !b.writes.some((x) => x.via === 'style'), 'adopted path: unzoomed writes :root { --fluid-zoom: 1 } to one adopted sheet, no style attribute')
  }
  {
    const b = fakeBrowser(CHROME_WIN, geometry({}), { adopted: false })
    mod.installFluidZoom(b.env)
    expect(b.writes.length === 0, 'fallback path: unzoomed writes nothing (no style attribute on <html>)', JSON.stringify(b.writes))
  }
  {
    const b = fakeBrowser(CHROME_WIN, geometry({ z: 1.5 }), { adopted: false })
    mod.installFluidZoom(b.env)
    expect(zoomOf(b) === 1.5 && b.writes.length === 1, 'fallback path: zoomed writes --fluid-zoom on <html>')
  }
  {
    // Safari < 16.4: CSSStyleSheet exists but its constructor throws.
    const b = fakeBrowser(SAFARI, geometry({ ow: 1440, oh: 900, dpr: 2, z: 1.25 }))
    b.env.window.CSSStyleSheet = function () { throw new TypeError('Illegal constructor') }
    mod.installFluidZoom(b.env)
    expect(zoomOf(b) === 1.25 && b.writes.every((x) => x.via === 'style'), 'a throwing CSSStyleSheet constructor falls back to the style attribute')
  }
  {
    // a change re-writes the same sheet; no change writes nothing
    const g = geometry({ z: 1.25 })
    const handlers = {}
    const b = fakeBrowser(CHROME_WIN, g)
    b.env.window.addEventListener = (t, f) => { handlers[t] = f }
    mod.installFluidZoom(b.env)
    const before = b.writes.length
    handlers.resize()
    const same = b.writes.length === before
    Object.assign(b.env.window, geometry({ z: 1.5 }))
    handlers.resize()
    expect(same && b.sheets().length === 1 && zoomOf(b) === 1.5 && b.writes.filter((x) => x.via === 'adopt').length === 1, 'updates reuse the one sheet (replaceSync), and only when the value changes')
    b.env.document.adoptedStyleSheets = []
    Object.assign(b.env.window, geometry({ z: 2 }))
    handlers.resize()
    expect(b.sheets().length === 1 && zoomOf(b) === 2, 're-adopts the sheet if something replaced adoptedStyleSheets')
  }
} finally {
  rmSync(dir, { recursive: true, force: true })
}

console.log(failures ? `\n${failures} failed` : '\nall passed')
process.exit(failures ? 1 : 0)
