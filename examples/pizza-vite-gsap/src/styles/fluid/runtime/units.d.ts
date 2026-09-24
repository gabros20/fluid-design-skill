// fluid-design 2.0.0 · GENERATED from fluid.config.json — do not edit. Run `fluid generate`.

// Types for fluid-units.js. `fluid generate` writes both, with the unit list
// set to your roles; fluid.ts re-exports them.

export type FluidUnit = 'fluid' | 'display' | 'copy' | 'ui' // @fluid-units
export type FluidUnits = Readonly<Record<FluidUnit, number>>

/** Every unit in CSS px per drawn px. All 1 on the server or without the stylesheet. */
export declare function fluidUnits(): FluidUnits

/** `n` drawn px on `unit` (default 'fluid'), in CSS px at the current viewport.
 * Pass `el` to read the unit at that element (inside a limit or scope it differs from the page's). */
export declare function fluidPx(n?: number, unit?: FluidUnitName, el?: Element): number
/** The unit names fluidPx accepts ('chrome', the v1 name of 'ui', with aliases on). */
export type FluidUnitName = FluidUnit // @fluid-aliases

/** Call `cb(units)` whenever any unit changes (resize, zoom, a setting). Returns an unsubscribe function. */
export declare function onFluidChange(cb: (units: FluidUnits) => void): () => void
