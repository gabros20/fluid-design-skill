// Types for fluid-units.js. Copy both files.

export type FluidUnit = 'fluid' | 'display' | 'copy' | 'chrome'
export type FluidUnits = Readonly<Record<FluidUnit, number>>

/** Every unit in CSS px per drawn px. All 1 on the server or without the stylesheet. */
export declare function fluidUnits(): FluidUnits

/** `n` drawn px on `unit` (default 'fluid'), in CSS px at the current viewport. */
export declare function fluidPx(n?: number, unit?: FluidUnit): number

/** Call `cb(units)` whenever any unit changes. Returns an unsubscribe function. */
export declare function onFluidChange(cb: (units: FluidUnits) => void): () => void
