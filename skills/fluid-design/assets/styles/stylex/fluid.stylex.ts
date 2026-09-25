// fluid-design 2.0.0 · GENERATED from fluid.config.json — do not edit. Run `fluid generate`.
// fluid.stylex.ts — typed helpers.

// Typed helpers that build calc() strings against the fluid units, for
// plain values in stylex.create(). The units themselves are global CSS:
// import fluid.css once at your app root. (StyleX's defineVars cannot
// express a var whose formula reads a sibling var, which every unit does.)

function finite(n: number, fn: string): number {
  if (!Number.isFinite(n)) throw new Error(`fluid-design: ${fn}() expects a unitless drawn number, got ${n}.`)
  return n
}

export function fluid(n: number): string {
  return `calc(${finite(n, 'fluid')} * var(--fluid))`
}

export function fluidDisplay(n: number): string {
  return `calc(${finite(n, 'fluidDisplay')} * var(--fluid-display))`
}

export function fluidCopy(n: number): string {
  return `calc(${finite(n, 'fluidCopy')} * var(--fluid-copy))`
}

export function fluidUi(n: number): string {
  return `calc(${finite(n, 'fluidUi')} * var(--fluid-ui))`
}

/** Type on the base unit; `size` is the font size its zoom share is read from. */
export function fluidText(n: number, size: number = n): string {
  finite(n, 'fluidText')
  return `calc(${n} * (var(--fluid) + (var(--fluid-z) - var(--fluid)) * max(0, min(1, (var(--fluid-zoom-text-none, 48) - ${size}) / (var(--fluid-zoom-text-none, 48) - var(--fluid-zoom-text-full, 24))))))`
}

/** A max-width that only grows. */
export function fluidCap(n: number): string {
  return `max(${finite(n, 'fluidCap')}px, calc(${n} * var(--fluid)))`
}

/** The page container, as a style object. */
export const fluidContainer = {
  width: '100%',
  marginInline: 'auto',
  maxWidth: 'var(--fluid-container-width)',
  paddingInline: 'var(--fluid-container-padding)'
} as const
