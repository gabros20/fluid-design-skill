// parity.mjs — v2's model must reproduce v1's numbers for every v1 config.
//
// Each v1 fixture (plus the v1 defaults, with and without the mobile arm) is
// migrated to v2 structure + settings, evaluated on a viewport grid at three
// zoom levels, and compared with the frozen v1 maths (lib/v1-math.mjs).
// Tolerance is 1e-9, except where v1 used a ROUNDED type floor (round2): v2
// uses the exact knee value there, a documented difference of <= 0.005.

import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mergeConfig, factors, resolveFloors, resolveBandFloors } from './lib/v1-math.mjs'
import { migrateV1, evaluateDefaults } from '../skills/fluid-design/scripts/lib/model.mjs'
import { normaliseStructure } from '../skills/fluid-design/scripts/lib/spec.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(here, './fixtures/v1-configs')
const cases = [['v1 defaults', {}], ['v1 defaults + mobile', { mobile: { enabled: true } }]]
for (const f of readdirSync(fixturesDir).filter((f) => f.endsWith('.json')).sort()) {
  const json = JSON.parse(readFileSync(join(fixturesDir, f), 'utf8'))
  delete json.$schema
  cases.push([f, json])
}

const widths = [320, 360, 375, 390, 414, 430, 480, 568, 599, 600, 667, 700, 768, 820, 834, 844, 900, 932, 1000, 1023, 1024, 1100, 1280, 1366, 1440, 1536, 1680, 1920, 2200, 2560, 3000]
const heights = [360, 390, 430, 500, 501, 568, 640, 700, 768, 800, 844, 900, 932, 1080, 1180, 1440]
const zooms = [1, 1.25, 2]

let failures = 0
let checks = 0
for (const [label, v1json] of cases) {
  const v1 = mergeConfig(v1json)
  const m = migrateV1(v1json)
  const s = normaliseStructure(m.structure)
  // Where v1 rounded a floor, allow the rounding error; elsewhere exact.
  const floorSlack = (() => {
    const e = resolveFloors(v1)
    const r = v1.engageAt / v1.reference.width
    const exact = (d) => d * r + (1 - d)
    const mob = resolveBandFloors(v1, v1.mobile.min)
    return Math.max(
      Math.abs(e.display - exact(v1.units.display.damping)),
      Math.abs(e.copy - exact(v1.units.copy.damping)),
      Math.abs(mob.display - (v1.mobile.damping.display * v1.mobile.min + 1 - v1.mobile.damping.display)),
      Math.abs(mob.copy - (v1.mobile.damping.copy * v1.mobile.min + 1 - v1.mobile.damping.copy)),
      ...['tablet', 'landscape'].flatMap((b) => {
        const f = resolveBandFloors(v1, v1.mobile[b].min)
        return [Math.abs(f.display - (v1.mobile.damping.display * v1.mobile[b].min + 1 - v1.mobile.damping.display)), Math.abs(f.copy - (v1.mobile.damping.copy * v1.mobile[b].min + 1 - v1.mobile.damping.copy))]
      })
    ) + 1e-9
  })()
  let worst = 0
  let worstAt = ''
  for (const w of widths) {
    for (const h of heights) {
      for (const z of zooms) {
        const a = factors(v1, w, h, z)
        const b = evaluateDefaults(s, w, h, z, m.settings)
        const pairs = [['fluid', a.fluid, b.fluid], ['display', a.display, b.roles.display], ['copy', a.copy, b.roles.copy], ['ui', a.chrome, b.ui]]
        for (const [k, x, y] of pairs) {
          checks++
          const d = Math.abs(x - y)
          // Intentional v2 change: v1's chrome unit read the height even with
          // heightAxis false (a 3000x360 width-only page kept its header at 1x
          // while the layout ran at 2.08x). v2's ui follows the layout's axes.
          if (k === 'ui' && v1.heightAxis === false) continue
          const tol = k === 'display' || k === 'copy' ? floorSlack : 1e-9
          if (d > worst) {
            worst = d
            worstAt = `${w}x${h} z${z} ${k}: v1 ${x} v2 ${y}`
          }
          if (d > tol) {
            failures++
            if (failures <= 20) console.error(`FAIL ${label} ${w}x${h} z${z} ${k}: v1 ${x} v2 ${y} (tol ${tol})`)
          }
        }
      }
    }
  }
  console.log(`${label.padEnd(28)} worst |Δ| ${worst.toExponential(2)}  (rounded-floor slack ${floorSlack.toExponential(2)})  ${worstAt}`)
}
console.log(`${checks} checks, ${failures} failures`)
process.exit(failures ? 1 : 0)
