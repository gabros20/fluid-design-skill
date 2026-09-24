/**
 * The fluid units as numbers, for motion that needs a scaled DISTANCE: a
 * tween's x, a ScrollTrigger end, a parallax range.
 *
 * The scroll-animation skill ships a standalone mirror of this so it works
 * without fluid-design; with fluid-design installed, use the one runtime it
 * generates (styles/fluid/runtime/units.js), whose unit list follows
 * fluid.config.json's roles. `references/fluid-interop.md` §3 has the recipes.
 */
import { fluidPx, type FluidUnit } from '../styles/fluid/fluid'

export { fluidPx, fluidUnits, onFluidChange, type FluidUnit } from '../styles/fluid/fluid'
export type { FluidUnits } from '../styles/fluid/runtime/units.js'

/**
 * A GSAP function-based value for `n` drawn px: `x: fluidValue(600)`.
 * GSAP calls it at tween creation and again on every ScrollTrigger refresh
 * when the trigger has `invalidateOnRefresh: true` (ScrollTrigger refreshes
 * on resize by itself), so the distance follows the scale. A plain number
 * would freeze the distance at whatever window the page loaded in.
 */
export function fluidValue(n: number, unit: FluidUnit = 'fluid'): () => number {
  return () => fluidPx(n, unit)
}

/** A ScrollTrigger `end` of `n` drawn px of scroll: `end: fluidEnd(1800)`. */
export function fluidEnd(n: number, unit: FluidUnit = 'fluid'): () => string {
  return () => `+=${fluidPx(n, unit)}`
}
