/**
 * The fluid units as numbers, for motion that needs a scaled DISTANCE: a
 * tween's x, a parallax range, a canvas font size.
 *
 * The scroll-animation skill ships a standalone mirror of this so it works
 * without fluid-design; with fluid-design installed, use the one runtime it
 * generates (styles/fluid/runtime/units.js), whose unit list follows
 * fluid.config.json's roles. `references/fluid-interop.md` §3 has the recipes.
 */
export { fluidPx, fluidUnits, onFluidChange } from '@/styles/fluid/fluid'
export type { FluidUnit } from '@/styles/fluid/fluid'
export type { FluidUnits } from '@/styles/fluid/runtime/units.js'
